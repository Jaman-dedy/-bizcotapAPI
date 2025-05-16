import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { TagOrdersController } from './tag-orders.controller';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from 'prisma/prisma.module';
import { FormConfigController } from './form-config.controller';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TagsController, TagOrdersController, FormConfigController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}