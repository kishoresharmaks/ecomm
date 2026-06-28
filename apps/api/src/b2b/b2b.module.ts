import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LocationsModule } from "../locations/locations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { SellersModule } from "../sellers/sellers.module";
import { StorageModule } from "../storage/storage.module";
import { AdminB2BAnalyticsController, AdminB2BController } from "./admin-b2b.controller";
import { AdminB2BOrdersController } from "./admin-b2b-orders.controller";
import { AdminB2BPaymentsController } from "./admin-b2b-payments.controller";
import { AdminBusinessBuyersController } from "./admin-business-buyers.controller";
import { B2BBuyerController } from "./b2b-buyer.controller";
import { B2BGateway } from "./b2b.gateway";
import { B2BService } from "./b2b.service";
import { SellerB2BController } from "./seller-b2b.controller";
import { SellerB2BOrdersController } from "./seller-b2b-orders.controller";

@Module({
  imports: [AuthModule, LocationsModule, NotificationsModule, PaymentsModule, SellersModule, StorageModule],
  controllers: [
    B2BBuyerController,
    SellerB2BController,
    SellerB2BOrdersController,
    AdminB2BController,
    AdminB2BAnalyticsController,
    AdminB2BOrdersController,
    AdminB2BPaymentsController,
    AdminBusinessBuyersController,
  ],
  providers: [B2BService, B2BGateway],
  exports: [B2BService],
})
export class B2BModule {}
