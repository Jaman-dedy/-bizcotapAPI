// src/insights/insights.service.ts
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Request } from 'express';
import * as geoip from 'geoip-lite';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';



@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private prisma: PrismaService) {}

  // === Tag View and Action Tracking ===

  /**
   * Records a tag view when someone visits a tag
   */
  async recordTagView(tuid: string, req: Request): Promise<void> {
    try {
      // Find the tag
      const tag = await this.prisma.userTag.findUnique({
        where: { tuid },
        select: { id: true },
      });

      if (!tag) {
        return; // Tag not found, silently exit
      }

      // Get viewer info
      const viewerInfo = this.getViewerInfo(req);

      // Record the view
      await this.prisma.tagView.create({
        data: {
          tagId: tag.id,
          tuid,
          viewerIp: viewerInfo.hashedIp,
          location: viewerInfo.location,
          userAgent: viewerInfo.userAgent,
          referer: Array.isArray(viewerInfo.referer) ? viewerInfo.referer.join(', ') : viewerInfo.referer,
        },
      });
    } catch (error) {
      console.error('Error recording tag view:', error);
      // Don't throw - analytics should never break the main application
    }
  }

  /**
   * Records a tag action (phone call, email, website visit, etc.)
   */
  async recordTagAction(tuid: string, action: string, req: Request): Promise<void> {
    try {
      // Find the tag
      const tag = await this.prisma.userTag.findUnique({
        where: { tuid },
        select: { id: true },
      });

      if (!tag) {
        return; // Tag not found, silently exit
      }

      // Get viewer info
      const viewerInfo = this.getViewerInfo(req);

      // Record the action
      await this.prisma.tagAction.create({
        data: {
          tagId: tag.id,
          tuid,
          action,
          viewerIp: viewerInfo.hashedIp,
          location: viewerInfo.location,
          userAgent: viewerInfo.userAgent,
        },
      });
    } catch (error) {
      console.error('Error recording tag action:', error);
      // Don't throw - analytics should never break the main application
    }
  }

  /**
   * Helper method to extract and anonymize visitor information
   */
  private getViewerInfo(req: Request) {
    // Get IP address
    const ip = 
      req.headers['x-forwarded-for'] || 
      req.connection.remoteAddress || 
      'unknown';
    
    // Hash the IP for privacy
    const hashedIp = crypto
      .createHash('sha256')
      .update(ip.toString())
      .digest('hex');
    
    // Get geolocation info
    let location: string | null = null;
    try {
      const ipString = ip.toString().split(',')[0].trim();
      const geo = geoip.lookup(ipString);
      if (geo) {
        location = JSON.stringify({
          country: geo.country,
          region: geo.region,
          city: geo.city,
          timezone: geo.timezone,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
    
    // Get user agent info
    const userAgent = req.headers['user-agent'];
    
    // Get referer
    const referer = req.headers.referer || req.headers.referrer || null;
    
    return {
      hashedIp,
      location,
      userAgent,
      referer,
    };
  }

  // === Basic Tag Information ===

  /**
   * Gets basic tag information for checking access rights
   */
  async getTagBasicInfo(tuid: string) {
    const tag = await this.prisma.userTag.findUnique({
      where: { tuid },
      select: {
        id: true,
        tuid: true,
        userId: true,
        companyId: true,
      },
    });

    return tag;
  }

  // === Individual User Insights ===

  /**
   * Gets all tags owned by a user with basic metrics
   */
  async getUserTags(userId: number) {
    const tags = await this.prisma.userTag.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
        createdAt: true,
        _count: {
          select: {
            views: true,
            actions: true,
          },
        },
        user: true,
      },
    });
    
    return tags.map(tag => ({
      id: tag.id,
      tuid: tag.tuid,
      name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
      views: tag._count.views,
      actions: tag._count.actions,
      createdAt: tag.createdAt,
    }));
  }

  /**
   * Gets aggregated insights across all of a user's tags
   */
  async getAggregateUserInsights(userId: number) {
    // Get all user's tags
    const tags = await this.prisma.userTag.findMany({
      where: { userId },
      select: { id: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty stats
    if (tagIds.length === 0) {
      return {
        totalTags: 0,
        totalViews: 0,
        totalActions: 0,
        averageViewsPerTag: 0,
        conversionRate: 0,
      };
    }
    
    // Get total views
    const totalViews = await this.prisma.tagView.count({
      where: { tagId: { in: tagIds } },
    });
    
    // Get total actions
    const totalActions = await this.prisma.tagAction.count({
      where: { tagId: { in: tagIds } },
    });
    
    return {
      totalTags: tags.length,
      totalViews,
      totalActions,
      averageViewsPerTag: totalViews / tags.length,
      conversionRate: totalViews > 0 ? (totalActions / totalViews) * 100 : 0,
    };
  }

  /**
   * Gets performance trends for a user's tags over the last 30 days
   */
  async getUserTrends(userId: number) {
    // Get all user's tags
    const tags = await this.prisma.userTag.findMany({
      where: { userId },
      select: { id: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty trends
    if (tagIds.length === 0) {
      return {
        viewTrend: [],
        actionTrend: [],
      };
    }
    
    // Get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get daily views
    const viewTrend = await this.prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${thirtyDaysAgo} 
      GROUP BY DATE(createdAt) 
      ORDER BY date ASC
    `;
    
    // Get daily actions
    const actionTrend = await this.prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date, 
        COUNT(*) as count 
      FROM TagAction 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${thirtyDaysAgo} 
      GROUP BY DATE(createdAt) 
      ORDER BY date ASC
    `;
    
    return {
      viewTrend,
      actionTrend,
    };
  }

  /**
   * Gets the user's top-performing tag with detailed metrics
   */
  async getUserTopTag(userId: number) {
    // Get all user's tags with view count
    const tags = await this.prisma.userTag.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
        _count: {
          select: {
            views: true,
            actions: true,
          },
        },
      },
    });
    
    if (tags.length === 0) {
      return null;
    }
    
    // Find the tag with the most views
    const topTag = tags.reduce((max, tag) => 
      tag._count.views > max._count.views ? tag : max, tags[0]);
    
    // Get action breakdown for this tag
    const actionBreakdown = await this.prisma.tagAction.groupBy({
      by: ['action'],
      where: { tagId: topTag.id },
      _count: true,
    });
    
    // Get geographic breakdown for this tag
    const geoBreakdown = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.country') as country, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId = ${topTag.id} AND location IS NOT NULL 
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 5
    `;
    
    return {
      id: topTag.id,
      tuid: topTag.tuid,
      name: `${(topTag.tagInfo as any).fname || ''} ${(topTag.tagInfo as any).lname || ''}`.trim(),
      views: topTag._count.views,
      actions: topTag._count.actions,
      actionBreakdown: actionBreakdown.map(item => ({
        action: item.action,
        count: item._count,
      })),
      geoBreakdown,
    };
  }

  /**
   * Gets recent activity for a user's tags
   */
  async getRecentActivity(userId: number) {
    // Get all user's tags
    const tags = await this.prisma.userTag.findMany({
      where: { userId },
      select: { id: true, tuid: true, tagInfo: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    const tagMap = tags.reduce((map, tag) => {
      map[tag.id] = {
        tuid: tag.tuid,
        name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
      };
      return map;
    }, {});
    
    // No tags? Return empty activity
    if (tagIds.length === 0) {
      return [];
    }
    
    // Get recent views (last 20)
    const recentViews = await this.prisma.tagView.findMany({
      where: { tagId: { in: tagIds } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tagId: true,
        createdAt: true,
        location: true,
      },
    });
    
    // Get recent actions (last 20)
    const recentActions = await this.prisma.tagAction.findMany({
      where: { tagId: { in: tagIds } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tagId: true,
        action: true,
        createdAt: true,
        location: true,
      },
    });
    
    // Combine and sort activities
    const activities = [
      ...recentViews.map(view => ({
        type: 'view',
        tagId: view.tagId,
        tagTuid: tagMap[view.tagId]?.tuid,
        tagName: tagMap[view.tagId]?.name,
        timestamp: view.createdAt,
        location: view.location ? JSON.parse(view.location) : null,
      })),
      ...recentActions.map(action => ({
        type: 'action',
        actionType: action.action,
        tagId: action.tagId,
        tagTuid: tagMap[action.tagId]?.tuid,
        tagName: tagMap[action.tagId]?.name,
        timestamp: action.createdAt,
        location: action.location ? JSON.parse(action.location) : null,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
     .slice(0, 20);
    
    return activities;
  }

  // === Company Admin Insights ===

  /**
   * Gets aggregated metrics for a company
   */
  async getCompanyMetrics(companyId: number) {
    // Get all company tags
    const tags = await this.prisma.userTag.findMany({
      where: { companyId },
      select: { id: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty metrics
    if (tagIds.length === 0) {
      return {
        totalTags: 0,
        totalViews: 0,
        totalActions: 0,
        averageViewsPerTag: 0,
        conversionRate: 0,
        viewsThisMonth: 0,
        viewsGrowth: 0,
      };
    }
    
    // Get total views
    const totalViews = await this.prisma.tagView.count({
      where: { tagId: { in: tagIds } },
    });
    
    // Get total actions
    const totalActions = await this.prisma.tagAction.count({
      where: { tagId: { in: tagIds } },
    });
    
    // Get this month's views
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthViews = await this.prisma.tagView.count({
      where: { 
        tagId: { in: tagIds },
        createdAt: { gte: thisMonth },
      },
    });
    
    // Get last month's views
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastMonthViews = await this.prisma.tagView.count({
      where: { 
        tagId: { in: tagIds },
        createdAt: { 
          gte: lastMonth,
          lt: thisMonth,
        },
      },
    });
    
    // Calculate growth percentage
    const viewsGrowth = lastMonthViews > 0 
      ? ((thisMonthViews - lastMonthViews) / lastMonthViews) * 100 
      : (thisMonthViews > 0 ? 100 : 0);
    
    return {
      totalTags: tags.length,
      totalViews,
      totalActions,
      averageViewsPerTag: totalViews / tags.length,
      conversionRate: totalViews > 0 ? (totalActions / totalViews) * 100 : 0,
      viewsThisMonth: thisMonthViews,
      viewsGrowth,
    };
  }

  /**
   * Gets team performance metrics for a company
   */
  async getTeamPerformance(companyId: number) {
    // Get company employees with their tags
    const employees = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userTags: {
          select: {
            id: true,
            _count: {
              select: {
                views: true,
                actions: true,
              },
            },
          },
        },
      },
    });
    
    return employees.map(employee => {
      const totalViews = employee.userTags.reduce((sum, tag) => sum + tag._count.views, 0);
      const totalActions = employee.userTags.reduce((sum, tag) => sum + tag._count.actions, 0);
      
      return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        // email: employee.email, // Removed as it is not part of the expected type
        tagCount: employee.userTags.length,
        totalViews,
        totalActions,
        conversionRate: totalViews > 0 ? (totalActions / totalViews) * 100 : 0,
      };
    }).sort((a, b) => b.totalViews - a.totalViews);
  }

  /**
   * Gets trending tags within a company
   */
  async getTrendingCompanyTags(companyId: number) {
    // Get last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Get all company tags
    const tags = await this.prisma.userTag.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty trends
    if (tagIds.length === 0) {
      return [];
    }
    
    // Get recent views for these tags
    const recentViews = await this.prisma.tagView.groupBy({
      by: ['tagId'],
      where: { 
        tagId: { in: tagIds },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });
    
    // Create a map of tag ID to view count
    const viewCountMap = recentViews.reduce((map, item) => {
      map[item.tagId] = item._count;
      return map;
    }, {});
    
    // Return tags with view counts
    return tags.map(tag => ({
      id: tag.id,
      tuid: tag.tuid,
      name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
      ownerName: `${tag.user.firstName} ${tag.user.lastName}`,
      recentViews: viewCountMap[tag.id] || 0,
    }))
    .sort((a, b) => b.recentViews - a.recentViews)
    .slice(0, 10);
  }

  /**
   * Gets geographical insights for a company
   */
  async getCompanyGeoInsights(companyId: number) {
    // Get all company tags
    const tags = await this.prisma.userTag.findMany({
      where: { companyId },
      select: { id: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty insights
    if (tagIds.length === 0) {
      return {
        countries: [],
        regions: [],
        cities: [],
      };
    }
    
    // Get country breakdown
    const countries = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.country') as country, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND location IS NOT NULL 
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `;
    
    // Get region breakdown
    const regions = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.region') as region, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND location IS NOT NULL 
      GROUP BY region 
      ORDER BY count DESC 
      LIMIT 10
    `;
    
    // Get city breakdown
    const cities = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.city') as city, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND location IS NOT NULL 
      GROUP BY city 
      ORDER BY count DESC 
      LIMIT 10
    `;
    
    return {
      countries,
      regions,
      cities,
    };
  }

  /**
   * Gets employee leaderboard for a company
   */
  async getEmployeeLeaderboard(companyId: number) {
    // Get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get company employees with their tags
    const employees = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userTags: {
          select: {
            id: true,
          },
        },
      },
    });
    
    // Prepare result array
    const result: {
      id: number;
      name: string;
      createdAt: Date;
      tagCount: number;
      totalViews: number;
      totalActions: number;
      activeTagsPercent: number;
    }[] = [];
    // For each employee, get their view and action counts
    for (const employee of employees) {
      const tagIds = employee.userTags.map(tag => tag.id);
      
      if (tagIds.length === 0) {
        result.push({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          totalViews: 0,
          totalActions: 0,
          createdAt: new Date(),
          tagCount: 0,
          activeTagsPercent: 0,
        });
        continue;
      }
      
      // Get recent views
      const recentViews = await this.prisma.tagView.count({
        where: { 
          tagId: { in: tagIds },
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      
      // Get recent actions
      const recentActions = await this.prisma.tagAction.count({
        where: { 
          tagId: { in: tagIds },
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      
      result.push({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        createdAt: new Date(),
        tagCount: 0,
        totalViews: 0,
        totalActions: 0,
        activeTagsPercent: 0
      });
    }
    
    // Sort by views
  }

  /**
   * Gets monthly trends for a company
   */
  async getCompanyMonthlyTrends(companyId: number) {
    // Get all company tags
    const tags = await this.prisma.userTag.findMany({
      where: { companyId },
      select: { id: true },
    });
    
    const tagIds = tags.map(tag => tag.id);
    
    // No tags? Return empty trends
    if (tagIds.length === 0) {
      return {
        months: [],
        viewCounts: [],
        actionCounts: [],
      };
    }
    
    // Get last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    
    // Get monthly views
    const monthlyViews = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${sixMonthsAgo} 
      GROUP BY month 
      ORDER BY month ASC
    `;
    
    // Get monthly actions
    const monthlyActions = await this.prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month, 
        COUNT(*) as count 
      FROM TagAction 
      WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${sixMonthsAgo} 
      GROUP BY month 
      ORDER BY month ASC
    `;
    
    // Format data for chart
    const months: string[] = [];
    const viewCounts: number[] = [];
    const actionCounts: number[] = [];
    
    // Initialize with all months
    for (let i = 0; i < 6; i++) {
      const date = new Date(sixMonthsAgo);
      date.setMonth(date.getMonth() + i);
      const monthStr = date.toISOString().substring(0, 7);
      months.push(monthStr);
      viewCounts.push(0);
      actionCounts.push(0);
    }
    
    // Fill in view counts
    for (const item of monthlyViews as { month: string; count: number }[]) {
      const index = months.indexOf(item.month);
      if (index >= 0) {
        viewCounts[index] = parseInt(item.count.toString());
      }
    }
    
    // Fill in action counts
    for (const item of monthlyActions) {
      const index = months.indexOf(item.month);
      if (index >= 0) {
        actionCounts[index] = parseInt(item.count.toString());
      }
    }
    
    return {
      months,
      viewCounts,
      actionCounts,
    };
  }

  /**
   * Gets insights about company users and their tags
   */
  async getCompanyUsersInsights(companyId: number) {
    // Get company info
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
      },
    });
    
    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }
    
    // Get company users
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        userTags: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });
    
    // Get all active tags for the company
    const allTags = await this.prisma.userTag.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });
    
    // Get total views
    const totalViews = allTags.length > 0
      ? await this.prisma.tagView.count({
          where: { tagId: { in: allTags.map(tag => tag.id) } },
        })
      : 0;
    
    // Get users with tags and metrics
    const userInsights = users.map(user => {
      const activeTags = user.userTags.filter(tag => tag.isActive).length;
      const inactiveTags = user.userTags.length - activeTags;
      
      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        activeTags,
        inactiveTags,
        totalTags: user.userTags.length,
      };
    });
    
    return {
      company: {
        id: company.id,
        name: company.name,
      },
      totalUsers: users.length,
      totalTags: allTags.length,
      totalViews,
      averageTagsPerUser: users.length > 0 ? allTags.length / users.length : 0,
      averageViewsPerTag: allTags.length > 0 ? totalViews / allTags.length : 0,
      users: userInsights,
    };
  }

  // === Super Admin Insights ===

  /**
   * Gets platform-wide metrics for super admin
   */
  async getPlatformMetrics() {
    // Get total users
    const totalUsers = await this.prisma.user.count();
    
    // Get total companies
    const totalCompanies = await this.prisma.company.count();
    
    // Get total tags
    const totalTags = await this.prisma.userTag.count();
    
    // Get total views
    const totalViews = await this.prisma.tagView.count();
    
    // Get total actions
    const totalActions = await this.prisma.tagAction.count();
    
    // Get this month's new users
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const newUsersThisMonth = await this.prisma.user.count({
      where: { createdAt: { gte: thisMonth } },
    });
    
    // Get last month's new users
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const newUsersLastMonth = await this.prisma.user.count({
      where: { 
        createdAt: { 
          gte: lastMonth,
          lt: thisMonth,
        },
      },
    });
    
    // Calculate growth percentage
    const userGrowth = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
      : (newUsersThisMonth > 0 ? 100 : 0);
    
    return {
      totalUsers,
      totalCompanies,
      totalTags,
      totalViews,
      totalActions,
      newUsersThisMonth,
      userGrowth,
      averageTagsPerUser: totalUsers > 0 ? totalTags / totalUsers : 0,
      averageViewsPerTag: totalTags > 0 ? totalViews / totalTags : 0,
      conversionRate: totalViews > 0 ? (totalActions / totalViews) * 100 : 0,
    };
  }

  /**
   * Gets company comparison data for super admin
   */
  async getCompanyComparison() {
    // Get top companies by number of tags
    const topCompaniesByTags = await this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            userTags: true,
          },
        },
      },
      orderBy: {
        userTags: {
          _count: 'desc',
        },
      },
      take: 10,
    });
    
    // Get top companies by number of views
    const viewsPerCompany = await this.prisma.$queryRaw`
      SELECT 
        c.id as id,
        c.name as name,
        COUNT(tv.id) as viewCount
      FROM Company c
      JOIN UserTag ut ON c.id = ut.companyId
      JOIN TagView tv ON ut.id = tv.tagId
      GROUP BY c.id, c.name
      ORDER BY viewCount DESC
      LIMIT 10
    `;
    
    return {
      topCompaniesByTags: topCompaniesByTags.map(company => ({
        id: company.id,
        name: company.name,
        tagCount: company._count.userTags,
      })),
      topCompaniesByViews: viewsPerCompany,
    };
  }

  /**
   * Gets user growth trends for super admin
   */
  async getUserGrowthTrends() {
    // Get last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    
    // Get monthly new users
    const monthlyNewUsers = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month, 
        COUNT(*) as count 
      FROM User 
      WHERE createdAt >= ${twelveMonthsAgo} 
      GROUP BY month 
      ORDER BY month ASC
    `;
    
    // Get monthly new tags
    const monthlyNewTags = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month, 
        COUNT(*) as count 
      FROM UserTag 
      WHERE createdAt >= ${twelveMonthsAgo} 
      GROUP BY month 
      ORDER BY month ASC
    `;
    
    // Format data for chart
    const months: string[] = [];
    const userCounts: number[] = [];
    const tagCounts: number[] = [];
    
    // Initialize with all months
    for (let i = 0; i < 12; i++) {
      const date = new Date(twelveMonthsAgo);
      date.setMonth(date.getMonth() + i);
      const monthStr = date.toISOString().substring(0, 7);
      months.push(monthStr);
      userCounts.push(0);
      tagCounts.push(0);
    }
    
    // Fill in user counts
    for (const item of monthlyNewUsers as { month: string; count: number }[]) {
      const index = months.indexOf(item.month);
      if (index >= 0) {
        userCounts[index] = parseInt(item.count.toString());
      }
    }
    
    // Fill in tag counts
    for (const item of monthlyNewTags as { month: string; count: number }[]) {
      const index = months.indexOf(item.month);
      if (index >= 0) {
        tagCounts[index] = parseInt(item.count.toString());
      }
    }
    
    return {
      months,
      userCounts,
      tagCounts,
    };
  }

  /**
   * Gets detailed insights for a specific company
   */
 /**
 * Gets detailed insights for a specific company
 */
async getDetailedCompanyInsights(companyId: number): Promise<{
  id: number;
  name: string;
  totalUsers: number;
  totalTags: number;
  totalViews: number;
  totalActions: number;
  averageViewsPerTag: number;
  conversionRate: number;
  monthlyTrends: { months: string[]; viewCounts: number[] };
} | null> {
  // Get company info
  const company = await this.prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          userTags: true,
        },
      },
    },
  });

  if (!company) {
    return null;
  }

  // Get company tags
  const tags = await this.prisma.userTag.findMany({
    where: { companyId },
    select: { id: true },
  });

  const tagIds = tags.map(tag => tag.id);

  // Get total users for this company
  const totalUsers = await this.prisma.user.count({
    where: { companyId },
  });

  // Get total views
  const totalViews = tagIds.length > 0 
    ? await this.prisma.tagView.count({
        where: { tagId: { in: tagIds } },
      })
    : 0;

  // Get total actions
  const totalActions = tagIds.length > 0
    ? await this.prisma.tagAction.count({
        where: { tagId: { in: tagIds } },
      })
    : 0;

  // Get monthly views (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyViews: { month: string; count: number }[] = tagIds.length > 0
    ? await this.prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT 
          DATE_FORMAT(createdAt, '%Y-%m') as month, 
          COUNT(*) as count 
        FROM TagView 
        WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${sixMonthsAgo} 
        GROUP BY month 
        ORDER BY month ASC
      `
    : [];

  // Format data for chart
  const months: string[] = [];
  const viewCounts: number[] = [];

  // Initialize with all months
  for (let i = 0; i < 6; i++) {
    const date = new Date(sixMonthsAgo);
    date.setMonth(date.getMonth() + i);
    const monthStr = date.toISOString().substring(0, 7);
    months.push(monthStr);
    viewCounts.push(0);
  }

  // Fill in view counts
  for (const item of monthlyViews) {
    const index = months.indexOf(item.month);
    if (index >= 0) {
      viewCounts[index] = parseInt(item.count.toString());
    }
  }

  return {
    id: company.id,
    name: company.name,
    totalUsers,
    totalTags: company._count.userTags,
    totalViews,
    totalActions,
    averageViewsPerTag: company._count.userTags > 0 ? totalViews / company._count.userTags : 0,
    conversionRate: totalViews > 0 ? (totalActions / totalViews) * 100 : 0,
    monthlyTrends: {
      months,
      viewCounts,
    },
  };
}

  /**
   * Gets tag order metrics for super admin
   */
  async getTagOrderMetrics() {
    // Get tag order counts by status
    const tagOrdersByStatus = await this.prisma.tagOrder.groupBy({
      by: ['status'],
      _count: true,
    });
    
    // Get tag orders by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    
    const monthlyTagOrders = await this.prisma.$queryRaw<{ month: string; count: number }[]>`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month, 
        COUNT(*) as count 
      FROM TagOrder 
      WHERE createdAt >= ${sixMonthsAgo} 
      GROUP BY month 
      ORDER BY month ASC
    `;
    
    // Get average time to approve/reject (in hours)
    const approvalTimes = await this.prisma.$queryRaw`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, o.createdAt, t.createdAt)) as avgApprovalHours
      FROM TagOrder o
      JOIN UserTag t ON o.id = t.tagOrderId
      WHERE o.status = 'APPROVED'
    `;
    
    // Format data for status chart
    const statusMap = {
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
    };
    
    const statusCounts = Object.keys(statusMap).map(status => {
      const orderCount = tagOrdersByStatus.find(item => item.status === status);
      return {
        status: statusMap[status],
        count: orderCount ? orderCount._count : 0,
      };
    });
    
    // Format data for monthly chart
    const months: string[] = [];
    const orderCounts: number[] = [];
    
    // Initialize with all months
    for (let i = 0; i < 6; i++) {
      const date = new Date(sixMonthsAgo);
      date.setMonth(date.getMonth() + i);
      const monthStr = date.toISOString().substring(0, 7);
      months.push(monthStr);
      orderCounts.push(0);
    }
    
    // Fill in order counts
    for (const item of monthlyTagOrders) {
      const index = months.indexOf(item.month);
      if (index >= 0) {
        orderCounts[index] = parseInt(item.count.toString());
      }
    }
    
    return {
      statusCounts,
      monthlyTrends: {
        months,
        orderCounts,
      },
      avgApprovalHours: Array.isArray(approvalTimes) && approvalTimes[0]?.avgApprovalHours ? Number(approvalTimes[0].avgApprovalHours) : 0,
    };
  }

  /**
   * Gets global activity heatmap for super admin
   */
  async getGlobalActivityHeatmap() {
    // Get the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    // Get tag views by hour and day
    const viewHeatmap: { dayOfWeek: number; hour: number; count: number }[] = await this.prisma.$queryRaw`
      SELECT 
        DAYOFWEEK(createdAt) - 1 as dayOfWeek,
        HOUR(createdAt) as hour,
        COUNT(*) as count
      FROM TagView
      WHERE createdAt >= ${sevenDaysAgo}
      GROUP BY dayOfWeek, hour
      ORDER BY dayOfWeek, hour
    `;
    
    // Initialize heatmap data
    const heatmapData: { day: string; hour: number; count: number }[] = [];
    
    // Days of the week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Initialize with all hours for all days
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({
          day: days[day],
          hour,
          count: 0,
        });
      }
    }
    
    // Fill in counts
    for (const item of viewHeatmap) {
      const dayIndex = item.dayOfWeek;
      const hour = item.hour;
      
      if (dayIndex >= 0 && dayIndex < 7 && hour >= 0 && hour < 24) {
        const index = dayIndex * 24 + hour;
        if (index >= 0 && index < heatmapData.length) {
          heatmapData[index].count = parseInt(item.count.toString());
        }
      }
    }
    
    return heatmapData;
  }

  async getCompaniesInsights(): Promise<{
    id: number;
    name: string;
    createdAt: Date;
    userCount: number;
    tagCount: number;
    totalViews: number;
    totalActions: number;
    activeTagsPercent: number;
  }[]> {
    try {
      // Fetch companies with aggregated metrics in a single query
      const companiesWithMetrics = await this.prisma.$queryRaw<Array<{
        id: number;
        name: string;
        createdAt: Date;
        user_count: number;
        tag_count: number;
        active_tags_count: number;
        total_views: number;
        total_actions: number;
      }>>`
        WITH CompanyTagMetrics AS (
          SELECT 
            c.id AS company_id,
            COUNT(DISTINCT ut.id) AS tag_count,
            COUNT(DISTINCT CASE WHEN ut.is_active THEN ut.id END) AS active_tags_count,
            COALESCE(SUM(tv.view_count), 0) AS total_views,
            COALESCE(SUM(ta.action_count), 0) AS total_actions
          FROM 
            "Company" c
          LEFT JOIN 
            "UserTag" ut ON ut.company_id = c.id
          LEFT JOIN (
            SELECT 
              tag_id, 
              COUNT(*) AS view_count 
            FROM 
              "TagView"
            GROUP BY 
              tag_id
          ) tv ON tv.tag_id = ut.id
          LEFT JOIN (
            SELECT 
              tag_id, 
              COUNT(*) AS action_count 
            FROM 
              "TagAction"
            GROUP BY 
              tag_id
          ) ta ON ta.tag_id = ut.id
          GROUP BY 
            c.id
        )
        SELECT 
          c.id,
          c.name,
          c.created_at AS "createdAt",
          (SELECT COUNT(*) FROM "User" WHERE company_id = c.id) AS user_count,
          COALESCE(ctm.tag_count, 0) AS tag_count,
          COALESCE(ctm.active_tags_count, 0) AS active_tags_count,
          COALESCE(ctm.total_views, 0) AS total_views,
          COALESCE(ctm.total_actions, 0) AS total_actions
        FROM 
          "Company" c
        LEFT JOIN 
          CompanyTagMetrics ctm ON ctm.company_id = c.id
        ORDER BY 
          c.name ASC
      `;
  
      // Transform the raw query results into CompanyInsights
      return companiesWithMetrics.map(company => ({
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
        userCount: Number(company.user_count),
        tagCount: Number(company.tag_count),
        totalViews: Number(company.total_views),
        totalActions: Number(company.total_actions),
        activeTagsPercent: company.tag_count > 0
          ? (Number(company.active_tags_count) / Number(company.tag_count)) * 100
          : 0,
      }));
    } catch (error) {
      this.logger.error('Error fetching companies insights', error);
      throw new BadRequestException('Failed to retrieve companies insights');
    }
  }
  /**
   * Gets user activity heatmap for super admin
   */


  // === Tag Analytics ===

  /**
   * Gets detailed insights for a specific tag
   */
  async getTagInsights(tuid: string) {
    const tag = await this.prisma.userTag.findUnique({
      where: { tuid },
      select: { id: true },
    });

    if (!tag) {
      return null;
    }

    // Get total views
    const totalViews = await this.prisma.tagView.count({
      where: { tagId: tag.id },
    });

    // Get views by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewsByDate = await this.prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId = ${tag.id} AND createdAt >= ${thirtyDaysAgo} 
      GROUP BY DATE(createdAt) 
      ORDER BY date ASC
    `;

    // Get actions summary
    const actionsSummary = await this.prisma.tagAction.groupBy({
      by: ['action'],
      where: { tagId: tag.id },
      _count: true,
    });

    // Get unique visitors (approximation based on hashed IPs)
    const uniqueVisitors = await this.prisma.tagView.groupBy({
      by: ['viewerIp'],
      where: { 
        tagId: tag.id,
        viewerIp: { not: null },
      },
    });

    // Get locations summary
    const locationsSummary = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.country') as country, 
        COUNT(*) as count 
      FROM TagView 
      WHERE tagId = ${tag.id} AND location IS NOT NULL 
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `;

    // Get devices summary based on user agent
    const devicesSummary = this.analyzeUserAgents(
      (await this.prisma.tagView.findMany({
        where: { tagId: tag.id, userAgent: { not: null } },
        select: { userAgent: true },
      })).filter(view => view.userAgent !== null) as { userAgent: string }[]
    );

    return {
      totalViews,
      uniqueVisitors: uniqueVisitors.length,
      viewsByDate,
      actionsSummary: actionsSummary.map(item => ({
        action: item.action,
        count: item._count,
      })),
      locationsSummary,
      devicesSummary,
    };
  }

  /**
   * Gets analytics data for all tags owned by a user or company
   */
  async getAllTagsInsights(userId?: number, companyId?: number) {
    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (companyId) {
      where.companyId = companyId;
    }
    
    const tags = await this.prisma.userTag.findMany({
      where,
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
        _count: {
          select: {
            views: true,
            actions: true,
          },
        },
      },
    });
    
    // Get total views across all tags
    const totalViews = tags.reduce((sum, tag) => sum + tag._count.views, 0);
    
    // Get total actions across all tags
    const totalActions = tags.reduce((sum, tag) => sum + tag._count.actions, 0);
    
    // Get top 5 tags by views
    const topTagsByViews = [...tags]
      .sort((a, b) => b._count.views - a._count.views)
      .slice(0, 5)
      .map(tag => ({
        tuid: tag.tuid,
        name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
        views: tag._count.views,
      }));
    
    // Get views by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const tagIds = tags.map(tag => tag.id);
    
    const viewsByDate = tagIds.length > 0
      ? await this.prisma.$queryRaw`
          SELECT 
            DATE(createdAt) as date, 
            COUNT(*) as count 
          FROM TagView 
          WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${thirtyDaysAgo} 
          GROUP BY DATE(createdAt) 
          ORDER BY date ASC
        `
      : [];
    
    // Get actions summary
    const actionsSummary = tagIds.length > 0
      ? await this.prisma.tagAction.groupBy({
          by: ['action'],
          where: { tagId: { in: tagIds } },
          _count: true,
        })
      : [];
    
    return {
      totalTags: tags.length,
      totalViews,
      totalActions,
      topTagsByViews,
      viewsByDate,
      actionsSummary: actionsSummary.map(item => ({
        action: item.action,
        count: item._count,
      })),
    };
  }

  /**
   * Gets tag analytics data for export
   */
  async getTagAnalyticsForExport(tuid: string) {
    const tag = await this.prisma.userTag.findUnique({
      where: { tuid },
      select: { 
        id: true,
        tuid: true,
        tagInfo: true,
        userId: true,
        companyId: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        company: {
          select: {
            name: true,
          }
        },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with TUID ${tuid} not found`);
    }

    // Get all views
    const views = await this.prisma.tagView.findMany({
      where: { tagId: tag.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        location: true,
        userAgent: true,
        referer: true,
      },
    });

    // Get all actions
    const actions = await this.prisma.tagAction.findMany({
      where: { tagId: tag.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        createdAt: true,
        location: true,
        userAgent: true,
      },
    });

    return {
      tag: {
        tuid: tag.tuid,
        name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
        owner: `${tag.user.firstName} ${tag.user.lastName}`,
        email: tag.user.email,
        company: tag.company?.name || 'Individual',
        createdAt: tag.createdAt,
      },
      views: views.map(view => ({
        timestamp: view.createdAt,
        location: view.location ? JSON.parse(view.location) : null,
        userAgent: view.userAgent,
        referer: view.referer,
      })),
      actions: actions.map(action => ({
        action: action.action,
        timestamp: action.createdAt,
        location: action.location ? JSON.parse(action.location) : null,
        userAgent: action.userAgent,
      })),
    };
  }

  /**
   * Gets company analytics data for export
   */
  async getCompanyAnalyticsForExport(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { 
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Get company users
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        _count: {
          select: {
            userTags: true,
          },
        },
      },
    });

    // Get company tags
    const tags = await this.prisma.userTag.findMany({
      where: { companyId },
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
        isActive: true,
        userId: true,
        createdAt: true,
        _count: {
          select: {
            views: true,
            actions: true,
          },
        },
      },
    });

    // Get monthly view counts (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    
    const tagIds = tags.map(tag => tag.id);
    
    const monthlyViews = tagIds.length > 0
      ? await this.prisma.$queryRaw`
          SELECT 
            DATE_FORMAT(createdAt, '%Y-%m') as month, 
            COUNT(*) as count 
          FROM TagView 
          WHERE tagId IN (${Prisma.join(tagIds)}) AND createdAt >= ${twelveMonthsAgo} 
          GROUP BY month 
          ORDER BY month ASC
        `
      : [];

    return {
      company: {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
      },
      users: users.map(user => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        tagCount: user._count.userTags,
      })),
      tags: tags.map(tag => {
        const userIndex = users.findIndex(u => u.id === tag.userId);
        const userName = userIndex >= 0 
          ? `${users[userIndex].firstName} ${users[userIndex].lastName}`
          : 'Unknown';
          
        return {
          tuid: tag.tuid,
          name: `${(tag.tagInfo as any).fname || ''} ${(tag.tagInfo as any).lname || ''}`.trim(),
          owner: userName,
          isActive: tag.isActive,
          createdAt: tag.createdAt,
          views: tag._count.views,
          actions: tag._count.actions,
        };
      }),
      monthlyViews,
    };
  }

  /**
   * Get analytics for a specific date range
   */
  async getDateRangeAnalytics(options: {
    tagId?: string;
    companyId?: number;
    userId?: number;
    startDate: Date;
    endDate: Date;
  }) {
    const { tagId, companyId, userId, startDate, endDate } = options;
    
    // Build tag filter
    let tagFilter: any = {};
    
    if (tagId) {
      // Filter by specific tag
      const tag = await this.prisma.userTag.findUnique({
        where: { tuid: tagId },
        select: { id: true },
      });
      
      if (!tag) {
        throw new NotFoundException(`Tag with TUID ${tagId} not found`);
      }
      
      tagFilter = { tagId: tag.id };
    } else if (companyId) {
      // Filter by company
      const companyTags = await this.prisma.userTag.findMany({
        where: { companyId },
        select: { id: true },
      });
      
      tagFilter = { tagId: { in: companyTags.map(tag => tag.id) } };
    } else if (userId) {
      // Filter by user
      const userTags = await this.prisma.userTag.findMany({
        where: { userId },
        select: { id: true },
      });
      
      tagFilter = { tagId: { in: userTags.map(tag => tag.id) } };
    } else {
      throw new BadRequestException('At least one filter (tagId, companyId, or userId) must be provided');
    }
    
    // Build date range filter
    const dateFilter = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };
    
    // Get views in date range
    const views = await this.prisma.tagView.findMany({
      where: {
        ...tagFilter,
        ...dateFilter,
      },
      select: {
        id: true,
        createdAt: true,
        location: true,
        referer: true,
      },
    });
    
    // Get actions in date range
    const actions = await this.prisma.tagAction.findMany({
      where: {
        ...tagFilter,
        ...dateFilter,
      },
      select: {
        id: true,
        action: true,
        createdAt: true,
      },
    });
    
    // Get daily views
    const dailyViews = await this.prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date, 
        COUNT(*) as count 
      FROM TagView 
      WHERE ${Object.keys(tagFilter).length > 0 ? Prisma.sql`${this.buildWhereClause(tagFilter)} AND` : Prisma.empty}
        createdAt >= ${startDate} AND createdAt <= ${endDate}
      GROUP BY DATE(createdAt) 
      ORDER BY date ASC
    `;
    
    // Get action breakdown
    const actionBreakdown = await this.prisma.tagAction.groupBy({
      by: ['action'],
      where: {
        ...tagFilter,
        ...dateFilter,
      },
      _count: true,
    });
    
    // Get geographic breakdown
    const geographicBreakdown = await this.prisma.$queryRaw`
      SELECT 
        JSON_EXTRACT(location, '$.country') as country, 
        COUNT(*) as count 
      FROM TagView 
      WHERE ${Object.keys(tagFilter).length > 0 ? Prisma.sql`${this.buildWhereClause(tagFilter)} AND` : Prisma.empty}
        createdAt >= ${startDate} AND createdAt <= ${endDate} AND
        location IS NOT NULL
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `;
    
    return {
      totalViews: views.length,
      totalActions: actions.length,
      dailyViews,
      actionBreakdown: actionBreakdown.map(item => ({
        action: item.action,
        count: item._count,
      })),
      geographicBreakdown,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  // === Utility Methods ===

  /**
   * Helper method to analyze user agent strings
   */
  private analyzeUserAgents(userAgents: { userAgent: string }[]) {
    const devices = {
      mobile: 0,
      desktop: 0,
      tablet: 0,
    };
    
    const browsers = {
      chrome: 0,
      safari: 0,
      firefox: 0,
      edge: 0,
      other: 0,
    };
    
    userAgents.forEach(({ userAgent }) => {
      if (!userAgent) return;
      
      // Detect device type
      if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
        if (/iPad|tablet/i.test(userAgent)) {
          devices.tablet++;
        } else {
          devices.mobile++;
        }
      } else {
        devices.desktop++;
      }
      
      // Detect browser
      if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
        browsers.chrome++;
      } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
        browsers.safari++;
      } else if (/Firefox/i.test(userAgent)) {
        browsers.firefox++;
      } else if (/Edg/i.test(userAgent)) {
        browsers.edge++;
      } else {
        browsers.other++;
      }
    });
    
    return {
      devices,
      browsers,
    };
  }

  /**
   * Converts analytics data to CSV format
   */
  convertAnalyticsToCSV(analyticsData: any): string {
    let csv = '';
    
    // For tag analytics export
    if (analyticsData.tag) {
      // Tag info header
      csv += 'Tag Information\n';
      csv += 'TUID,Name,Owner,Email,Company,Created At\n';
      csv += `${analyticsData.tag.tuid},"${analyticsData.tag.name}","${analyticsData.tag.owner}",`;
      csv += `${analyticsData.tag.email},"${analyticsData.tag.company}",${analyticsData.tag.createdAt}\n\n`;
      
      // Views data
      csv += 'View Data\n';
      csv += 'Timestamp,Country,Region,City,User Agent,Referrer\n';
      
      analyticsData.views.forEach(view => {
        const location = view.location || {};
        csv += `${view.timestamp},`;
        csv += `"${location.country || ''}","${location.region || ''}","${location.city || ''}",`;
        csv += `"${view.userAgent || ''}","${view.referer || ''}"\n`;
      });
      
      csv += '\n';
      
      // Actions data
      csv += 'Action Data\n';
      csv += 'Action Type,Timestamp,Country,Region,City,User Agent\n';
      
      analyticsData.actions.forEach(action => {
        const location = action.location || {};
        csv += `"${action.action}",${action.timestamp},`;
        csv += `"${location.country || ''}","${location.region || ''}","${location.city || ''}",`;
        csv += `"${action.userAgent || ''}"\n`;
      });
    }
    
    // For company analytics export
    else if (analyticsData.company) {
      // Company info header
      csv += 'Company Information\n';
      csv += 'ID,Name,Created At\n';
      csv += `${analyticsData.company.id},"${analyticsData.company.name}",${analyticsData.company.createdAt}\n\n`;
      
      // Users data
      csv += 'Users\n';
      csv += 'ID,Name,Email,Role,Tag Count\n';
      
      analyticsData.users.forEach(user => {
        csv += `${user.id},"${user.name}",${user.email},"${user.role}",${user.tagCount}\n`;
      });
      
      csv += '\n';
      
      // Tags data
      csv += 'Tags\n';
      csv += 'TUID,Name,Owner,Active,Created At,Views,Actions\n';
      
      analyticsData.tags.forEach(tag => {
        csv += `${tag.tuid},"${tag.name}","${tag.owner}",${tag.isActive},`;
        csv += `${tag.createdAt},${tag.views},${tag.actions}\n`;
      });
      
      csv += '\n';
      
      // Monthly views
      csv += 'Monthly Views\n';
      csv += 'Month,View Count\n';
      
      analyticsData.monthlyViews.forEach(item => {
        csv += `${item.month},${item.count}\n`;
      });
    }
    
    return csv;
  }

  /**
   * Helper method to build a Prisma where clause from an object
   */
  private buildWhereClause(whereObj: any): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];
    
    for (const [key, value] of Object.entries(whereObj)) {
      if (typeof value === 'object' && value !== null) {
        if ('in' in value && Array.isArray(value.in)) {
          conditions.push(Prisma.sql`${Prisma.raw(key)} IN (${Prisma.join(value.in)})`);
        } else {
          // Handle other operators like gt, lt, etc. if needed
          for (const [op, val] of Object.entries(value)) {
            let operator = '';
            
            switch (op) {
              case 'gt': operator = '>'; break;
              case 'gte': operator = '>='; break;
              case 'lt': operator = '<'; break;
              case 'lte': operator = '<='; break;
              case 'equals': operator = '='; break;
              case 'not': operator = '!='; break;
              default: continue;
            }
            
            conditions.push(Prisma.sql`${Prisma.raw(key)} ${Prisma.raw(operator)} ${val}`);
          }
        }
      } else {
        conditions.push(Prisma.sql`${Prisma.raw(key)} = ${value}`);
      }
    }
    
    if (conditions.length === 0) {
      return Prisma.sql`1=1`; // Default true condition
    }
    
    if (conditions.length === 1) {
      return conditions[0];
    }
    
    return Prisma.sql`(${Prisma.join(conditions, ' AND ')})`; 
  }
}