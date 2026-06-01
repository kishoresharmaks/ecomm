import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SellersModule } from "../sellers/sellers.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [NotificationsModule, SellersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
