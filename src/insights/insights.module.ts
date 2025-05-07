// src/insights/insights.module.ts
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { TagViewMiddleware } from '../common/middleware/tag-view.middleware';

@Module({
  imports: [PrismaModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TagViewMiddleware)
      .forRoutes({ path: 'tag/:tuid', method: RequestMethod.GET });
  }
}