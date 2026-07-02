import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { ServiceMarketplaceController } from "./service-marketplace.controller";
import { ServiceMarketplaceService } from "./service-marketplace.service";

@Module({
  imports: [CustomersModule, FinanceModule, NotificationsModule, PaymentsModule],
  controllers: [ServiceMarketplaceController],
  providers: [ServiceMarketplaceService],
  exports: [ServiceMarketplaceService],
})
export class ServiceMarketplaceModule {}
