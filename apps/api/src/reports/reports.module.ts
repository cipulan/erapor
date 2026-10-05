import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportCompletenessService } from "./report-completeness.service";
import { PdfService } from "./pdf.service";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportCompletenessService, PdfService],
  exports: [ReportsService, ReportCompletenessService],
})
export class ReportsModule {}
