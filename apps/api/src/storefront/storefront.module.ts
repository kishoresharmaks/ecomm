import { Module } from "@nestjs/common";
import { CmsModule } from "../cms/cms.module";
import { DealsModule } from "../deals/deals.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [CmsModule, DealsModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
  exports: [StorefrontService],
})
export class StorefrontModule {}
