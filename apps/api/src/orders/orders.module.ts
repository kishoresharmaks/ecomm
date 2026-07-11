import { Module } from "@nestjs/common";
import { CheckoutPricingModule } from "../checkout/checkout-pricing.module";
import { CouponsModule } from "../coupons/coupons.module";
import { CustomersModule } from "../customers/customers.module";
import { DealsModule } from "../deals/deals.module";
import { FinanceModule } from "../finance/finance.module";
import { LocationsModule } from "../locations/locations.module";
import { MapsModule } from "../maps/maps.module";
import { MarketModule } from "../market/market.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsModule } from "../payments/payments.module";
import { ReturnsModule } from "../returns/returns.module";
import { AdminDeliveryController } from "./admin-delivery.controller";
import { AdminOrdersController } from "./admin-orders.controller";
import {
  AdminCourierShipmentsController,
  CourierWorkspaceController,
  CourierWebhooksController,
  FinanceCourierCodRemittancesController,
  SellerCourierPackagesController,
} from "./courier-logistics.controller";
import { CourierAdaptersModule } from "./courier-adapters/courier-adapters.module";
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
import { InternalOrdersController } from "./internal-orders.controller";

@Module({
  imports: [CheckoutPricingModule, CourierAdaptersModule, CouponsModule, CustomersModule, DealsModule, FinanceModule, LocationsModule, MapsModule, MarketModule, NotificationsModule, PaymentsModule, ReturnsModule],
  controllers: [
    InternalOrdersController,
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
  providers: [OrdersService, CourierLogisticsService],
  exports: [OrdersService]
})
export class OrdersModule {}
