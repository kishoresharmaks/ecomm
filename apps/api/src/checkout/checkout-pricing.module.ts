import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { LocationsModule } from "../locations/locations.module";
import {
  AdminCourierProvidersController,
  AdminRoutingSimulatorController,
  AdminShippingRateCardsController,
  CheckoutDeliveryController,
} from "./checkout-delivery.controller";
import { DeliveryRoutingService } from "./delivery-routing.service";
import { CheckoutPricingService } from "./checkout-pricing.service";

@Module({
  imports: [CustomersModule, LocationsModule],
  controllers: [
    CheckoutDeliveryController,
    AdminShippingRateCardsController,
    AdminCourierProvidersController,
    AdminRoutingSimulatorController,
  ],
  providers: [CheckoutPricingService, DeliveryRoutingService],
  exports: [CheckoutPricingService, DeliveryRoutingService]
})
export class CheckoutPricingModule {}
