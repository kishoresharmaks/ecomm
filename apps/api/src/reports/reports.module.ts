import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { MarketModule } from "../market/market.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { SellerReportsController } from "./seller-reports.controller";

@Module({
  imports: [FinanceModule, MarketModule],
  controllers: [ReportsController, SellerReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
