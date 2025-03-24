import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Import auth guard
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Import environment validation
import { validate } from './config/env.validation';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TagsModule } from './tags/tags.module';
import { CompaniesModule } from './companies/companies.module';
import { ExchangesModule } from './exchanges/exchanges.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`],
    }),
    
    // Rate limiting to prevent abuse
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      }
    ]),
    
    // Scheduled tasks
    ScheduleModule.forRoot(),
    
    // Our Prisma module
    PrismaModule,
    
    // Feature modules
    AuthModule,
    UsersModule,
    TagsModule,
    CompaniesModule,
    ExchangesModule,
    EmailModule,
  ],
  controllers: [],
  providers: [
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}