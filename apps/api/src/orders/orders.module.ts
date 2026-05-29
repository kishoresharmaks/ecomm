import { Module } from "@nestjs/common";
import { CheckoutPricingModule } from "../checkout/checkout-pricing.module";
import { CustomersModule } from "../customers/customers.module";
import { FinanceModule } from "../finance/finance.module";
import { LocationsModule } from "../locations/locations.module";
import { MarketModule } from "../market/market.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdminDeliveryController } from "./admin-delivery.controller";
import { AdminOrdersController } from "./admin-orders.controller";
import {
  AdminCourierShipmentsController,
  CourierWebhooksController,
  FinanceCourierCodRemittancesController,
} from "./courier-logistics.controller";
import { CourierLogisticsService } from "./courier-logistics.service";
import { CustomerOrdersController } from "./customer-orders.controller";
import { DeliveryPartnerProfileController } from "./delivery-partner-profile.controller";
import { DeliveryPartnerOrdersController } from "./delivery-partner-orders.controller";
import { FinanceOrderPaymentsController } from "./finance-order-payments.controller";
import { OrdersService } from "./orders.service";
import { PublicOrdersController } from "./public-orders.controller";
import { SellerOrdersController } from "./seller-orders.controller";

@Module({
  imports: [CheckoutPricingModule, CustomersModule, FinanceModule, LocationsModule, MarketModule, NotificationsModule, PaymentsModule],
  controllers: [
    CustomerOrdersController,
    AdminOrdersController,
    AdminCourierShipmentsController,
    AdminDeliveryController,
    FinanceCourierCodRemittancesController,
    FinanceOrderPaymentsController,
    SellerOrdersController,
    DeliveryPartnerProfileController,
    DeliveryPartnerOrdersController,
    PublicOrdersController,
    CourierWebhooksController
  ],
  providers: [OrdersService, CourierLogisticsService],
  exports: [OrdersService]
})
export class OrdersModule {}
