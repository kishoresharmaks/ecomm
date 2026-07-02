import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReturnsModule } from "../returns/returns.module";
import { SellersModule } from "../sellers/sellers.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [FinanceModule, NotificationsModule, ReturnsModule, SellersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
