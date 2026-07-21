import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { MarketModule } from "../market/market.module";
import { TaxModule } from "../tax/tax.module";
import { ReportsController } from "./reports.controller";
import { GstComplianceService } from "./gst-compliance.service";
import { ReportsService } from "./reports.service";
import { SellerReportsController } from "./seller-reports.controller";

@Module({
  imports: [FinanceModule, MarketModule, TaxModule],
  controllers: [ReportsController, SellerReportsController],
  providers: [GstComplianceService, ReportsService],
  exports: [GstComplianceService],
})
export class ReportsModule {}
