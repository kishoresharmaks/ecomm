import { Module } from "@nestjs/common";
import { SearchModule } from "../search/search.module";
import { AdminCategoriesController } from "./admin-categories.controller";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

import { StorefrontCacheModule } from "../storefront/storefront-cache.module";

@Module({
  imports: [SearchModule, StorefrontCacheModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService]
})
export class CategoriesModule {}
