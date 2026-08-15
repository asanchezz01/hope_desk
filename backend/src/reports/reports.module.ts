import { Module } from '@nestjs/common';
import { ReportPdfService } from './report-pdf.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
  exports: [ReportsService, ReportPdfService],
})
export class ReportsModule {}
