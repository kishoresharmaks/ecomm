import { Module } from "@nestjs/common";
import { NotificationsModule } from "../../notifications/notifications.module";
import { AdminSellersController } from "./admin-sellers.controller";
import { AdminSellersService } from "./admin-sellers.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminSellersController],
  providers: [AdminSellersService]
})
export class AdminSellersModule {}
