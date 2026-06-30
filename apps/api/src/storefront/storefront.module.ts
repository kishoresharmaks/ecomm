import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CmsModule } from "../cms/cms.module";
import { DealsModule } from "../deals/deals.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontStoreRankingService } from "./storefront-store-ranking.service";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [AuthModule, CmsModule, DealsModule],
  controllers: [StorefrontController],
  providers: [StorefrontService, StorefrontStoreRankingService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
