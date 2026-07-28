import { Module } from "@nestjs/common";
import { CmsModule } from "../cms/cms.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { MobileStorefrontController } from "./mobile-storefront.controller";
import { MobileStorefrontService } from "./mobile-storefront.service";

@Module({
  imports: [CmsModule, StorefrontModule],
  controllers: [MobileStorefrontController],
  providers: [MobileStorefrontService],
})
export class MobileModule {}
