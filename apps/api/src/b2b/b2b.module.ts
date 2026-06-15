import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SellersModule } from "../sellers/sellers.module";
import { AdminB2BController } from "./admin-b2b.controller";
import { AdminB2BOrdersController } from "./admin-b2b-orders.controller";
import { AdminBusinessBuyersController } from "./admin-business-buyers.controller";
import { B2BBuyerController } from "./b2b-buyer.controller";
import { B2BService } from "./b2b.service";
import { SellerB2BController } from "./seller-b2b.controller";
import { SellerB2BOrdersController } from "./seller-b2b-orders.controller";

@Module({
  imports: [LocationsModule, NotificationsModule, SellersModule],
  controllers: [
    B2BBuyerController,
    SellerB2BController,
    SellerB2BOrdersController,
    AdminB2BController,
    AdminB2BOrdersController,
    AdminBusinessBuyersController,
  ],
  providers: [B2BService],
  exports: [B2BService]
})
export class B2BModule {}
