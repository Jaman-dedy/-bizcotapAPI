// src/insights/insights.controller.ts
import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Request,
    BadRequestException,
    HttpException,
    HttpStatus,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
  } from '@nestjs/swagger';
  import { InsightsService } from './insights.service';
  import { UserRole } from '@prisma/client';
  import { RolesGuard } from 'src/auth/guards/roles.guard';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { Public } from 'src/common/decorators/public.decorator';
  import { TagInsightsDto, CompanyInsightsDto, AdminInsightsDto } from './dto/insights.dto';
  
  @ApiTags('insights')
  @Controller('insights')
  @ApiBearerAuth()
  export class InsightsController {
    constructor(private readonly insightsService: InsightsService) {}
  
    // === Individual User Endpoints ===
  
    @Get('individual-dashboard')
    @ApiOperation({ summary: 'Get insights dashboard for individual users' })
    @ApiResponse({ 
      status: 200, 
      description: 'Individual dashboard data',
      type: Object 
    })
    async getIndividualDashboard(@Request() req) {
      try {
        const userId = req.user.userId;
        
        // Get all user's tags with basic metrics
        const tags = await this.insightsService.getUserTags(userId);
        
        // Get aggregated data across all user's tags
        const aggregateData = await this.insightsService.getAggregateUserInsights(userId);
        
        // Get performance trends (last 30 days)
        const trends = await this.insightsService.getUserTrends(userId);
        
        // Get top-performing individual tag
        const topTag = await this.insightsService.getUserTopTag(userId);
        
        return {
          tags,
          aggregateData,
          trends,
          topTag,
          recentActivity: await this.insightsService.getRecentActivity(userId)
        };
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve individual dashboard: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('tag/:tuid')
    @ApiOperation({ summary: 'Get insights for a specific tag' })
    @ApiParam({ name: 'tuid', description: 'Tag unique identifier' })
    @ApiResponse({ 
      status: 200, 
      description: 'Tag insights data',
      type: TagInsightsDto 
    })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    async getTagInsights(@Param('tuid') tuid: string, @Request() req) {
      try {
        // First, check if the user has access to this tag
        const tag = await this.insightsService.getTagBasicInfo(tuid);
        
        if (!tag) {
          throw new BadRequestException('Tag not found');
        }
        
        // Check access rights based on role
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          // Company admins can see all company tags
          if (req.user.role === UserRole.COMPANY_ADMIN) {
            if (tag.companyId !== req.user.companyId) {
              throw new BadRequestException('You do not have access to this tag');
            }
          } 
          // Regular users can only see their own tags
          else if (tag.userId !== req.user.userId) {
            throw new BadRequestException('You do not have access to this tag');
          }
        }
        
        // User has access, get insights
        const insights = await this.insightsService.getTagInsights(tuid);
        
        if (!insights) {
          return { message: 'No insights available for this tag' };
        }
        
        return insights;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        throw new HttpException(
          `Failed to retrieve tag insights: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('my-tags')
    @ApiOperation({ summary: 'Get insights for all tags owned by the logged-in user' })
    @ApiResponse({ 
      status: 200, 
      description: 'Tag insights data',
      type: Object
    })
    async getMyTagsInsights(@Request() req) {
      try {
        return this.insightsService.getAllTagsInsights(req.user.userId);
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve tag insights: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    // === Company Admin Endpoints ===
  
    @Get('company-dashboard')
    @UseGuards(RolesGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get company dashboard insights' })
    @ApiResponse({ 
      status: 200, 
      description: 'Company dashboard data',
      type: CompanyInsightsDto
    })
    @ApiResponse({ status: 403, description: 'Forbidden - requires company admin access' })
    async getCompanyDashboard(@Request() req) {
      try {
        const companyId = req.user.companyId;
        
        if (!companyId && req.user.role === UserRole.COMPANY_ADMIN) {
          return {
            message: 'No company associated with this admin account',
            data: { totalTags: 0, totalViews: 0 }
          };
        }
        
        // For super admin, allow filtering by companyId query param
        const targetCompanyId = req.user.role === UserRole.SUPER_ADMIN && req.query.companyId
          ? parseInt(req.query.companyId, 10)
          : companyId;
        
        // Get company metrics
        const companyMetrics = await this.insightsService.getCompanyMetrics(targetCompanyId);
        
        // Get team performance metrics
        const teamPerformance = await this.insightsService.getTeamPerformance(targetCompanyId);
        
        // Get trending tags within company
        const trendingTags = await this.insightsService.getTrendingCompanyTags(targetCompanyId);
        
        // Get geographical insights
        const geoInsights = await this.insightsService.getCompanyGeoInsights(targetCompanyId);
        
        return {
          companyMetrics,
          teamPerformance,
          trendingTags,
          geoInsights,
          employeeLeaderboard: await this.insightsService.getEmployeeLeaderboard(targetCompanyId),
          monthlyTrends: await this.insightsService.getCompanyMonthlyTrends(targetCompanyId)
        };
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve company dashboard: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('company')
    @UseGuards(RolesGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get company tag insights (admin only)' })
    @ApiQuery({ name: 'companyId', required: false, type: Number, description: 'Company ID (super admin only)' })
    @ApiResponse({ 
      status: 200, 
      description: 'Company tag insights data',
      type: Object
    })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin access' })
    async getCompanyInsights(@Request() req) {
      try {
        if (req.user.role === UserRole.COMPANY_ADMIN && !req.user.companyId) {
          return { 
            message: 'No company associated with this admin account',
            data: {
              totalTags: 0,
              totalViews: 0,
              totalActions: 0,
              topTagsByViews: [],
              viewsByDate: [],
              actionsSummary: [],
            }
          };
        }
        
        // For company admin, show only their company insights
        if (req.user.role === UserRole.COMPANY_ADMIN) {
          return this.insightsService.getAllTagsInsights(
            undefined, 
            req.user.companyId
          );
        }
        
        // For super admin, allow filtering by company ID
        const companyId = req.query.companyId ? +req.query.companyId : undefined;
        return this.insightsService.getAllTagsInsights(undefined, companyId);
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve company insights: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('company-users')
    @UseGuards(RolesGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get insights about company users and their tags' })
    @ApiQuery({ name: 'companyId', required: false, type: Number, description: 'Company ID (super admin only)' })
    @ApiResponse({ status: 200, description: 'Company users insights' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin access' })
    async getCompanyUsersInsights(@Request() req) {
      try {
        const companyId = req.user.role === UserRole.COMPANY_ADMIN
          ? req.user.companyId
          : (req.query.companyId ? +req.query.companyId : undefined);
        
        if (!companyId) {
          throw new BadRequestException('Company ID is required');
        }
        
        return this.insightsService.getCompanyUsersInsights(companyId);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        throw new HttpException(
          `Failed to retrieve company users insights: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    // === Super Admin Endpoints ===
  
    @Get('admin-dashboard')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get super admin dashboard insights' })
    @ApiQuery({ name: 'companyId', required: false, type: Number, description: 'Optional company ID for detailed view' })
    @ApiResponse({ 
      status: 200, 
      description: 'Admin dashboard data',
      type: AdminInsightsDto
    })
    @ApiResponse({ status: 403, description: 'Forbidden - requires super admin access' })
    async getSuperAdminDashboard(@Request() req, @Query('companyId') companyId?: string) {
      try {
        // Get platform-wide metrics
        const platformMetrics = await this.insightsService.getPlatformMetrics();
        
        // Get company comparison data
        const companyComparison = await this.insightsService.getCompanyComparison();
        
        // Get user growth trends
        const userGrowth = await this.insightsService.getUserGrowthTrends();
        
        // Get detailed data for a specific company if requested
        let companyDetails: {
          id: number;
          name: string;
          totalUsers: any;
          totalTags: any;
          totalViews: any;
          totalActions: any;
          averageViewsPerTag: number;
          conversionRate: number;
          monthlyTrends: { months: string[]; viewCounts: number[] };
        } | null = null;
        if (companyId) {
          companyDetails = await this.insightsService.getDetailedCompanyInsights(+companyId);
        }
        
        return {
          platformMetrics,
          companyComparison,
          userGrowth,
          companyDetails,
          tagOrderMetrics: await this.insightsService.getTagOrderMetrics(),
          globalHeatmap: await this.insightsService.getGlobalActivityHeatmap()
        };
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve admin dashboard: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('companies')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get insights about all companies' })
    @ApiResponse({ status: 200, description: 'Companies insights' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires super admin access' })
    async getCompaniesInsights() {
      try {
        return this.insightsService.getCompaniesInsights();
      } catch (error) {
        throw new HttpException(
          `Failed to retrieve companies insights: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    // === Action Tracking Endpoints ===
  
    @Get('record-action/:tuid/:action')
    @Public()
    @ApiOperation({ summary: 'Record a tag action (public endpoint)' })
    @ApiParam({ name: 'tuid', description: 'Tag unique identifier' })
    @ApiParam({ name: 'action', enum: ['phone_call', 'email', 'website_visit', 'download_vcf', 'social_link'] })
    @ApiResponse({ status: 200, description: 'Action recorded' })
    @ApiResponse({ status: 400, description: 'Invalid action type' })
    async recordAction(
      @Param('tuid') tuid: string,
      @Param('action') action: string,
      @Request() req
    ) {
      try {
        // Validate action type
        const validActions = ['phone_call', 'email', 'website_visit', 'download_vcf', 'social_link'];
        if (!validActions.includes(action)) {
          throw new BadRequestException('Invalid action type');
        }
        
        // Record the action
        await this.insightsService.recordTagAction(tuid, action, req);
        
        return { success: true };
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        // Don't expose internal errors for this public endpoint
        console.error('Error recording action:', error);
        return { success: false, message: 'Failed to record action' };
      }
    }
  
    // === Analytics Data Export ===
  
    @Get('export/tag/:tuid')
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: 'Export tag analytics data' })
    @ApiParam({ name: 'tuid', description: 'Tag unique identifier' })
    @ApiQuery({ name: 'format', enum: ['json', 'csv'], required: false, description: 'Export format' })
    @ApiResponse({ status: 200, description: 'Analytics data export' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires access rights' })
    async exportTagAnalytics(
      @Param('tuid') tuid: string,
      @Query('format') format: string = 'json',
      @Request() req
    ) {
      try {
        // First, check if the user has access to this tag
        const tag = await this.insightsService.getTagBasicInfo(tuid);
        
        if (!tag) {
          throw new BadRequestException('Tag not found');
        }
        
        // Check access rights based on role
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          // Company admins can see all company tags
          if (req.user.role === UserRole.COMPANY_ADMIN) {
            if (tag.companyId !== req.user.companyId) {
              throw new BadRequestException('You do not have access to this tag');
            }
          } 
          // Regular users can only see their own tags
          else if (tag.userId !== req.user.userId) {
            throw new BadRequestException('You do not have access to this tag');
          }
        }
        
        // Get analytics data
        const analyticsData = await this.insightsService.getTagAnalyticsForExport(tuid);
        
        // Return in requested format
        if (format.toLowerCase() === 'csv') {
          return this.insightsService.convertAnalyticsToCSV(analyticsData);
        }
        
        return analyticsData;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        throw new HttpException(
          `Failed to export analytics: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    @Get('export/company/:companyId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Export company analytics data' })
    @ApiParam({ name: 'companyId', description: 'Company ID' })
    @ApiQuery({ name: 'format', enum: ['json', 'csv'], required: false, description: 'Export format' })
    @ApiResponse({ status: 200, description: 'Company analytics data export' })
    @ApiResponse({ status: 403, description: 'Forbidden - requires admin access' })
    async exportCompanyAnalytics(
      @Param('companyId') companyId: string,
      @Query('format') format: string = 'json',
      @Request() req
    ) {
      try {
        const companyIdNum = parseInt(companyId, 10);
        
        // Check access rights for company admin
        if (req.user.role === UserRole.COMPANY_ADMIN && req.user.companyId !== companyIdNum) {
          throw new BadRequestException('You do not have access to this company data');
        }
        
        // Get analytics data
        const analyticsData = await this.insightsService.getCompanyAnalyticsForExport(companyIdNum);
        
        // Return in requested format
        if (format.toLowerCase() === 'csv') {
          return this.insightsService.convertAnalyticsToCSV(analyticsData);
        }
        
        return analyticsData;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        throw new HttpException(
          `Failed to export company analytics: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  
    // === Date Range Analytics ===
  
    @Get('analytics/date-range')
    @UseGuards(RolesGuard)
    @ApiOperation({ summary: 'Get insights for a specific date range' })
    @ApiQuery({ name: 'tagId', required: false, type: String, description: 'Tag ID (tuid)' })
    @ApiQuery({ name: 'companyId', required: false, type: Number, description: 'Company ID' })
    @ApiQuery({ name: 'userId', required: false, type: Number, description: 'User ID' })
    @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Start date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', required: true, type: String, description: 'End date (YYYY-MM-DD)' })
    @ApiResponse({ status: 200, description: 'Date range analytics' })
    async getDateRangeAnalytics(
      @Query('tagId') tagId: string,
      @Query('companyId') companyId: string,
      @Query('userId') userId: string,
      @Query('startDate') startDate: string,
      @Query('endDate') endDate: string,
      @Request() req
    ) {
      try {
        // Parse dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Validate dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
        }
        
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);
        
        // Check access rights based on role
        if (req.user.role !== UserRole.SUPER_ADMIN) {
          // Company admins can only see their company data
          if (req.user.role === UserRole.COMPANY_ADMIN) {
            if (companyId && parseInt(companyId, 10) !== req.user.companyId) {
              throw new BadRequestException('You do not have access to this company data');
            }
            
            // Override companyId with admin's company
            companyId = req.user.companyId.toString();
          } 
          // Regular users can only see their own data
          else {
            if (userId && parseInt(userId, 10) !== req.user.userId) {
              throw new BadRequestException('You do not have access to this user data');
            }
            
            // Override userId with current user
            userId = req.user.userId.toString();
          }
        }
        
        // Get analytics
        return this.insightsService.getDateRangeAnalytics({
          tagId,
          companyId: companyId ? parseInt(companyId, 10) : undefined,
          userId: userId ? parseInt(userId, 10) : undefined,
          startDate: start,
          endDate: end,
        });
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        
        throw new HttpException(
          `Failed to retrieve date range analytics: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }