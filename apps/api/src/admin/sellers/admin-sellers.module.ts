import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { NotificationsModule } from "../../notifications/notifications.module";
import { SearchModule } from "../../search/search.module";
import { StorageModule } from "../../storage/storage.module";
import { AdminSellersController } from "./admin-sellers.controller";
import { AdminSellersService } from "./admin-sellers.service";

@Module({
  imports: [AuthModule, NotificationsModule, SearchModule, StorageModule],
  controllers: [AdminSellersController],
  providers: [AdminSellersService]
})
export class AdminSellersModule {}
