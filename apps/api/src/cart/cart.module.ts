import { Module } from "@nestjs/common";
import { CheckoutPricingModule } from "../checkout/checkout-pricing.module";
import { CustomersModule } from "../customers/customers.module";
import { MarketModule } from "../market/market.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  imports: [CheckoutPricingModule, CustomersModule, MarketModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService]
})
export class CartModule {}
