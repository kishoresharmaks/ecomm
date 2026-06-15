import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { FinanceModule } from "../finance/finance.module";
import { AdminRefundActionsController } from "./admin-refunds-actions.controller";
import { AdminRefundsController, AdminReturnsController } from "./admin-returns.controller";
import {
  CustomerOrderReturnsController,
  CustomerReturnsController,
} from "./customer-returns.controller";
import { DeliveryReturnsController } from "./delivery-returns.controller";
import { SellerReturnsController } from "./seller-returns.controller";
import { ReturnsService } from "./returns.service";

@Module({
  imports: [CustomersModule, FinanceModule],
  controllers: [
    CustomerOrderReturnsController,
    CustomerReturnsController,
    AdminReturnsController,
    AdminRefundsController,
    AdminRefundActionsController,
    SellerReturnsController,
    DeliveryReturnsController,
  ],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
