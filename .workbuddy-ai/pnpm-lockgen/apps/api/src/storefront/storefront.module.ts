import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CmsModule } from "../cms/cms.module";
import { DealsModule } from "../deals/deals.module";
import { MarketModule } from "../market/market.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontStoreRankingService } from "./storefront-store-ranking.service";
import { StorefrontService } from "./storefront.service";
import { StorefrontCacheModule } from "./storefront-cache.module";

@Module({
  imports: [AuthModule, CmsModule, DealsModule, MarketModule, StorefrontCacheModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, StorefrontStoreRankingService],
  exports: [StorefrontService, StorefrontCacheModule],
})
export class StorefrontModule {}
