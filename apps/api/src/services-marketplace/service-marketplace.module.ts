import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ServiceMarketplaceController } from "./service-marketplace.controller";
import { ServiceMarketplaceService } from "./service-marketplace.service";

@Module({
  imports: [CustomersModule, NotificationsModule],
  controllers: [ServiceMarketplaceController],
  providers: [ServiceMarketplaceService],
  exports: [ServiceMarketplaceService],
})
export class ServiceMarketplaceModule {}
