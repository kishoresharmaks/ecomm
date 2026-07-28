import { Controller, Get, Header, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { MarketCurrencyQueryDto } from "./dto/market-query.dto";
import { MarketService } from "./market.service";

const publicMarketCurrencyCacheHeader = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";

@ApiTags("Market")
@Controller("market")
export class MarketController {
  constructor(@Inject(MarketService) private readonly marketService: MarketService) {}

  @Public()
  @Get("currency")
  @Header("Cache-Control", publicMarketCurrencyCacheHeader)
  @ApiOperation({ summary: "Read country currency and latest cached INR conversion rate." })
  getCurrency(@Query() query: MarketCurrencyQueryDto) {
    return this.marketService.getMarketCurrency(query.countryCode ?? "IN");
  }
}
