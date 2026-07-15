import { Module } from "@nestjs/common";
import { AdminCmsController } from "./admin-cms.controller";
import { CmsService } from "./cms.service";
import { PublicCmsController } from "./public-cms.controller";

import { StorefrontCacheModule } from "../storefront/storefront-cache.module";

@Module({
  imports: [StorefrontCacheModule],
  controllers: [PublicCmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService]
})
export class CmsModule {}

