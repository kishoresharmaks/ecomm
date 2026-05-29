import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { SellerReportsController } from "./seller-reports.controller";

@Module({
  controllers: [ReportsController, SellerReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
