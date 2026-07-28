import { Module } from "@nestjs/common";
import { StorefrontCacheService } from "./storefront-cache.service";

@Module({
  providers: [StorefrontCacheService],
  exports: [StorefrontCacheService],
})
export class StorefrontCacheModule {}
