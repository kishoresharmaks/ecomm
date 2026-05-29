import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { MarketCurrencyQueryDto } from "./dto/market-query.dto";
import { MarketService } from "./market.service";

@ApiTags("Market")
@Controller("market")
export class MarketController {
  constructor(@Inject(MarketService) private readonly marketService: MarketService) {}

  @Public()
  @Get("currency")
  @ApiOperation({ summary: "Read country currency and latest cached INR conversion rate." })
  getCurrency(@Query() query: MarketCurrencyQueryDto) {
    return this.marketService.getMarketCurrency(query.countryCode ?? "IN");
  }
}
