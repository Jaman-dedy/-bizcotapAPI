import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateExchangeDto } from './dto';
import { ExchangedInfo } from '@prisma/client';
import { ExchangeQueryDto } from './dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ExchangesService {
  constructor(private prisma: PrismaService) {}

  async createExchange(createExchangeDto: CreateExchangeDto, userId?: number): Promise<ExchangedInfo> {
    // Find the tag by TUID
    const tag = await this.prisma.userTag.findUnique({
      where: { tuid: createExchangeDto.tagTuid },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with TUID ${createExchangeDto.tagTuid} not found`);
    }

    if (!tag.isActive) {
      throw new BadRequestException(`Tag with TUID ${createExchangeDto.tagTuid} is not active`);
    }

    // Create the exchange record
    return this.prisma.exchangedInfo.create({
      data: {
        names: createExchangeDto.names,
        email: createExchangeDto.email,
        phoneNumber: createExchangeDto.phoneNumber,
        longitude: createExchangeDto.longitude,
        latitude: createExchangeDto.latitude,
        additionalInfo: createExchangeDto.additionalInfo ?? undefined,
        userTagId: tag.id,
        userId: tag.userId, // The owner of the tag
        senderId: userId, // The person who scanned the tag (if authenticated)
      },
    });
  }

  async findAllExchanges(userId: number, query: ExchangeQueryDto): Promise<ExchangedInfo[]> {
    // Build the query
    const where: any = { userId };

    // Add tag filter if provided
    if (query.tagTuid) {
      const tag = await this.prisma.userTag.findUnique({
        where: { tuid: query.tagTuid },
        select: { id: true },
      });

      if (!tag) {
        throw new NotFoundException(`Tag with TUID ${query.tagTuid} not found`);
      }

      where.userTagId = tag.id;
    }

    // Add search filter if provided
    if (query.search) {
      where.OR = [
        { names: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phoneNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Fetch exchanges
    return this.prisma.exchangedInfo.findMany({
      where,
      include: {
        userTag: {
          select: {
            tuid: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findExchangeById(id: number, userId: number): Promise<ExchangedInfo> {
    const exchange = await this.prisma.exchangedInfo.findUnique({
      where: { id },
      include: {
        userTag: {
          select: {
            tuid: true,
          },
        },
      },
    });

    if (!exchange) {
      throw new NotFoundException(`Exchange with ID ${id} not found`);
    }

    // Check if the user has permission to view this exchange
    if (exchange.userId !== userId) {
      throw new BadRequestException('You do not have permission to view this exchange');
    }

    return exchange;
  }

  async removeExchange(id: number, userId: number): Promise<ExchangedInfo> {
    // Check if the exchange exists and belongs to the user
    const exchange = await this.findExchangeById(id, userId);

    return this.prisma.exchangedInfo.delete({
      where: { id },
    });
  }

  async getExchangeStatistics(userId: number): Promise<any> {
    // Get the count of exchanges by month
    const monthlyStats = await this.prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count
      FROM "ExchangedInfo"
      WHERE "userId" = ${userId}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month DESC
      LIMIT 12
    `;

    // Get the count of exchanges by tag
    const tagStats = await this.prisma.exchangedInfo.groupBy({
      by: ['userTagId'],
      where: {
        userId,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Get tag details for the tag stats
    const tagDetails = await this.prisma.userTag.findMany({
      where: {
        id: {
          in: tagStats.map(stat => stat.userTagId),
        },
      },
      select: {
        id: true,
        tuid: true,
        tagInfo: true,
      },
    });

    // Map tag details to stats
    const tagStatsWithDetails = tagStats.map(stat => {
      const tag = tagDetails.find(t => t.id === stat.userTagId);
      return {
        userTagId: stat.userTagId,
        tuid: tag?.tuid,
        tagName: (tag?.tagInfo as { name: string })?.name || 'Unnamed Tag',
        count: stat._count.id,
      };
    });

    return {
      totalExchanges: await this.prisma.exchangedInfo.count({
        where: { userId },
      }),
      monthlyStats,
      tagStats: tagStatsWithDetails,
    };
  }
}