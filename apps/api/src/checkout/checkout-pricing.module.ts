import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { LocationsModule } from "../locations/locations.module";
import { PaymentsModule } from "../payments/payments.module";
import {
  AdminCourierProvidersController,
  AdminLocationServiceabilityController,
  AdminRoutingSimulatorController,
  AdminShippingRateCardsController,
  CheckoutDeliveryController,
} from "./checkout-delivery.controller";
import { DeliveryRoutingService } from "./delivery-routing.service";
import { CheckoutPricingService } from "./checkout-pricing.service";

@Module({
  imports: [CustomersModule, LocationsModule, PaymentsModule],
  controllers: [
    CheckoutDeliveryController,
    AdminShippingRateCardsController,
    AdminCourierProvidersController,
    AdminRoutingSimulatorController,
    AdminLocationServiceabilityController,
  ],
  providers: [CheckoutPricingService, DeliveryRoutingService],
  exports: [CheckoutPricingService, DeliveryRoutingService]
})
export class CheckoutPricingModule {}
