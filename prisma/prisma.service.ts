import { Injectable, OnModuleInit, OnModuleDestroy, Logger, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  // formConfig: any;

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      // Optional: Add log levels for debugging
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to disconnect from database', error);
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    // Instead of using $on('beforeExit'), use process.on('beforeExit')
    process.on('beforeExit', async () => {
      this.logger.log('Shutting down application');
      await app.close();
    });
  }

  async findContactsByCompanyId(companyId: number) {
    // Using Prisma's relational query capabilities
    return this.exchangedInfo.findMany({
      where: {
        userTag: {
          companyId: companyId,
        },
      },
      include: {
        userTag: {
          include: {
            company: true,
          },
        },
        user: true,
        sender: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findContactsByCompanyIdRaw(companyId: number) {
    return this.$queryRaw`
      SELECT 
        e.id, e.names, e.email, e.phoneNumber, e.longitude, e.latitude, 
        e.additionalInfo, e.createdAt, e.updatedAt, e.consentGiven,
        t.id AS "tagId", t.tuid AS "tagUuid", t.tagInfo AS "tagInfo",
        c.id AS "companyId", c.name AS "companyName"
      FROM "ExchangedInfo" e
      JOIN "UserTag" t ON e."userTagId" = t.id
      JOIN "Company" c ON t."companyId" = c.id
      WHERE c.id = ${companyId}
      ORDER BY e."createdAt" DESC
    `;
  }
}