import { Module } from "@nestjs/common";
import { MarketController } from "./market.controller";
import { FxProviderService } from "./fx-provider.service";
import { MarketService } from "./market.service";

@Module({
  controllers: [MarketController],
  providers: [FxProviderService, MarketService],
  exports: [FxProviderService, MarketService]
})
export class MarketModule {}
