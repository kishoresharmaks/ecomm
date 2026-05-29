import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SellerProfileController } from "./seller-profile.controller";
import { SellerSubscriptionsController } from "./seller-subscriptions.controller";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [LocationsModule, NotificationsModule],
  controllers: [SellersController, SellerProfileController, SellerSubscriptionsController],
  providers: [SellersService, SellerSubscriptionsService],
  exports: [SellersService, SellerSubscriptionsService]
})
export class SellersModule {}
