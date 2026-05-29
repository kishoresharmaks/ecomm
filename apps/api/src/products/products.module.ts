import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminProductsController } from "./admin-products.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { SellerProductsController } from "./seller-products.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [ProductsController, SellerProductsController, AdminProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
