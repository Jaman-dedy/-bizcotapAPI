import { Module } from '@nestjs/common';
import { EmailModule } from 'src/email/email.module';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { TagOrdersController } from './tag-orders.controller';

@Module({
  imports: [EmailModule],
  controllers: [TagsController, TagOrdersController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}