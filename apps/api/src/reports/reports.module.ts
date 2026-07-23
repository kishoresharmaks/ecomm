import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { MarketModule } from "../market/market.module";
import { TaxModule } from "../tax/tax.module";
import { StorageModule } from "../storage/storage.module";
import {
  AdminReportExportController,
  FinanceReportDataController,
  FinanceReportExportController,
  SellerReportExportController,
} from "./report-export.controller";
import { ReportExportService } from "./report-export.service";
import { ReportsController } from "./reports.controller";
import { GstComplianceService } from "./gst-compliance.service";
import { OrderTaxRegisterService } from "./order-tax-register.service";
import { ReportsService } from "./reports.service";
import { SellerReportsController } from "./seller-reports.controller";

@Module({
  imports: [FinanceModule, MarketModule, StorageModule, TaxModule],
  controllers: [
    ReportsController,
    SellerReportsController,
    AdminReportExportController,
    FinanceReportDataController,
    FinanceReportExportController,
    SellerReportExportController,
  ],
  providers: [
    GstComplianceService,
    OrderTaxRegisterService,
    ReportExportService,
    ReportsService,
  ],
  exports: [GstComplianceService],
})
export class ReportsModule {}
