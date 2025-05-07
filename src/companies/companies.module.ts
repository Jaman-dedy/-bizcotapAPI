import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [
    // Configure MulterModule for file uploads
    MulterModule.register({
      dest: './public/companies/logos',
    }),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}