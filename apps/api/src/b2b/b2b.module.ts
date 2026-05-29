import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminB2BController } from "./admin-b2b.controller";
import { AdminBusinessBuyersController } from "./admin-business-buyers.controller";
import { B2BBuyerController } from "./b2b-buyer.controller";
import { B2BService } from "./b2b.service";
import { SellerB2BController } from "./seller-b2b.controller";

@Module({
  imports: [LocationsModule, NotificationsModule],
  controllers: [B2BBuyerController, SellerB2BController, AdminB2BController, AdminBusinessBuyersController],
  providers: [B2BService],
  exports: [B2BService]
})
export class B2BModule {}
