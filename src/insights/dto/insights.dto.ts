// src/insights/dto/insights.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TagInsightsDto {
  @ApiProperty({ description: 'Total number of views' })
  totalViews: number;

  @ApiProperty({ description: 'Number of unique visitors' })
  uniqueVisitors: number;

  @ApiProperty({ description: 'Views by date' })
  viewsByDate: { date: string; count: number }[];

  @ApiProperty({ description: 'Actions summary' })
  actionsSummary: { action: string; count: number }[];

  @ApiProperty({ description: 'Locations summary' })
  locationsSummary: { country: string; count: number }[];

  @ApiProperty({ description: 'Devices summary' })
  devicesSummary: {
    devices: { mobile: number; desktop: number; tablet: number };
    browsers: { chrome: number; safari: number; firefox: number; edge: number; other: number };
  };
}

export class CompanyInsightsDto {
  @ApiProperty({ description: 'Company metrics' })
  companyMetrics: {
    totalTags: number;
    totalViews: number;
    totalActions: number;
    averageViewsPerTag: number;
    conversionRate: number;
    viewsThisMonth: number;
    viewsGrowth: number;
  };

  @ApiProperty({ description: 'Team performance metrics' })
  teamPerformance: {
    id: number;
    name: string;
    tagCount: number;
    totalViews: number;
    totalActions: number;
    conversionRate: number;
  }[];

  @ApiProperty({ description: 'Trending tags' })
  trendingTags: {
    id: number;
    tuid: string;
    name: string;
    ownerName: string;
    recentViews: number;
  }[];

  @ApiProperty({ description: 'Geographic insights' })
  geoInsights: {
    countries: { country: string; count: number }[];
    regions: { region: string; count: number }[];
    cities: { city: string; count: number }[];
  };

  @ApiProperty({ description: 'Employee leaderboard' })
  employeeLeaderboard: {
    id: number;
    name: string;
    totalViews: number;
    totalActions: number;
    createdAt: Date;
    tagCount: number;
    activeTagsPercent: number;
  }[];

  @ApiProperty({ description: 'Monthly trends' })
  monthlyTrends: {
    months: string[];
    viewCounts: number[];
    actionCounts: number[];
  };
}

export class AdminInsightsDto {
  @ApiProperty({ description: 'Platform metrics' })
  platformMetrics: {
    totalUsers: number;
    totalCompanies: number;
    totalTags: number;
    totalViews: number;
    totalActions: number;
    newUsersThisMonth: number;
    userGrowth: number;
    averageTagsPerUser: number;
    averageViewsPerTag: number;
    conversionRate: number;
  };

  @ApiProperty({ description: 'Company comparison' })
  companyComparison: {
    topCompaniesByTags: { id: number; name: string; tagCount: number }[];
    topCompaniesByViews: { id: number; name: string; viewCount: number }[];
  };

  @ApiProperty({ description: 'User growth trends' })
  userGrowth: {
    months: string[];
    userCounts: number[];
    tagCounts: number[];
  };

  @ApiProperty({ description: 'Company details', required: false })
  companyDetails?: {
    id: number;
    name: string;
    totalUsers: number;
    totalTags: number;
    totalViews: number;
    totalActions: number;
    averageViewsPerTag: number;
    conversionRate: number;
    monthlyTrends: { months: string[]; viewCounts: number[] };
  } | null;

  @ApiProperty({ description: 'Tag order metrics' })
  tagOrderMetrics: {
    statusCounts: { status: string; count: number }[];
    monthlyTrends: { months: string[]; orderCounts: number[] };
    avgApprovalHours: number;
  };

  @ApiProperty({ description: 'Global activity heatmap' })
  globalHeatmap: { day: string; hour: number; count: number }[];
}