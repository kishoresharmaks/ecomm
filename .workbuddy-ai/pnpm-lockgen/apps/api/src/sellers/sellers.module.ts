import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CourierAdapterRegistry } from "../orders/courier-adapters/courier-adapter.registry";
import { SearchModule } from "../search/search.module";
import { SellerProfileController } from "./seller-profile.controller";
import { SellerPushController } from "./seller-push.controller";
import { SellerSubscriptionsController } from "./seller-subscriptions.controller";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";
import { SellersController } from "./sellers.controller";
import { SellersService } from "./sellers.service";

@Module({
  imports: [LocationsModule, NotificationsModule, SearchModule],
  controllers: [SellersController, SellerProfileController, SellerPushController, SellerSubscriptionsController],
  providers: [SellersService, SellerSubscriptionsService, CourierAdapterRegistry],
  exports: [SellersService, SellerSubscriptionsService]
})
export class SellersModule {}
