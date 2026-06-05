import { Module } from "@nestjs/common";
import { CheckoutPricingModule } from "../checkout/checkout-pricing.module";
import { CustomersModule } from "../customers/customers.module";
import { FinanceModule } from "../finance/finance.module";
import { LocationsModule } from "../locations/locations.module";
import { MapsModule } from "../maps/maps.module";
import { MarketModule } from "../market/market.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdminDeliveryController } from "./admin-delivery.controller";
import { AdminOrdersController } from "./admin-orders.controller";
import {
  AdminCourierShipmentsController,
  CourierWorkspaceController,
  CourierWebhooksController,
  FinanceCourierCodRemittancesController,
  SellerCourierPackagesController,
} from "./courier-logistics.controller";
import { CourierAdapterRegistry } from "./courier-adapters/courier-adapter.registry";
import { CourierLogisticsService } from "./courier-logistics.service";
import { CustomerOrdersController } from "./customer-orders.controller";
import { DeliveryPartnerProfileController } from "./delivery-partner-profile.controller";
import {
  DeliveryPartnerOrdersController,
  FinanceDeliveryPartnerPayoutsController,
  DeliveryPartnerWalletController,
} from "./delivery-partner-orders.controller";
import { FinanceOrderPaymentsController } from "./finance-order-payments.controller";
import { OrdersService } from "./orders.service";
import { PublicOrdersController } from "./public-orders.controller";
import { SellerOrdersController } from "./seller-orders.controller";

@Module({
  imports: [CheckoutPricingModule, CustomersModule, FinanceModule, LocationsModule, MapsModule, MarketModule, NotificationsModule, PaymentsModule],
  controllers: [
    CustomerOrdersController,
    AdminOrdersController,
    AdminCourierShipmentsController,
    CourierWorkspaceController,
    SellerCourierPackagesController,
    AdminDeliveryController,
    FinanceCourierCodRemittancesController,
    FinanceOrderPaymentsController,
    SellerOrdersController,
    DeliveryPartnerProfileController,
    DeliveryPartnerOrdersController,
    DeliveryPartnerWalletController,
    FinanceDeliveryPartnerPayoutsController,
    PublicOrdersController,
    CourierWebhooksController
  ],
  providers: [OrdersService, CourierLogisticsService, CourierAdapterRegistry],
  exports: [OrdersService]
})
export class OrdersModule {}
