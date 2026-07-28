import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminDealsController } from "./admin-deals.controller";
import { DealPricingService } from "./deal-pricing.service";
import { DealsService } from "./deals.service";
import { SellerDealsController } from "./seller-deals.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminDealsController, SellerDealsController],
  providers: [DealsService, DealPricingService],
  exports: [DealPricingService],
})
export class DealsModule {}
