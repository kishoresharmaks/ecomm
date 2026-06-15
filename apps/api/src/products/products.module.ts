import { Module } from "@nestjs/common";
import { DealsModule } from "../deals/deals.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SearchModule } from "../search/search.module";
import { SellersModule } from "../sellers/sellers.module";
import { AdminProductsController } from "./admin-products.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { SellerProductsController } from "./seller-products.controller";

@Module({
  imports: [DealsModule, NotificationsModule, SearchModule, SellersModule],
  controllers: [ProductsController, SellerProductsController, AdminProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
