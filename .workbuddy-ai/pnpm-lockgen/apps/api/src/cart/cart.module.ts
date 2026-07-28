import { Module } from "@nestjs/common";
import { CheckoutPricingModule } from "../checkout/checkout-pricing.module";
import { CouponsModule } from "../coupons/coupons.module";
import { CustomersModule } from "../customers/customers.module";
import { DealsModule } from "../deals/deals.module";
import { MarketModule } from "../market/market.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  imports: [CheckoutPricingModule, CouponsModule, CustomersModule, DealsModule, MarketModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService]
})
export class CartModule {}
