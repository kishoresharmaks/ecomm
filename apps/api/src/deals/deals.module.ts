import { Module } from "@nestjs/common";
import { AdminDealsController } from "./admin-deals.controller";
import { DealPricingService } from "./deal-pricing.service";
import { DealsService } from "./deals.service";
import { SellerDealsController } from "./seller-deals.controller";

@Module({
  controllers: [AdminDealsController, SellerDealsController],
  providers: [DealsService, DealPricingService],
  exports: [DealPricingService],
})
export class DealsModule {}
