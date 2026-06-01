import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { ProductQueryDto } from "../products/dto/product-query.dto";
import { PublicSellerQueryDto } from "../sellers/dto/public-seller-query.dto";
import { StorefrontService } from "./storefront.service";

@ApiTags("Storefront")
@Public()
@Controller("storefront")
export class StorefrontController {
  constructor(@Inject(StorefrontService) private readonly storefrontService: StorefrontService) {}

  @Get("home")
  @ApiOperation({ summary: "Read the dynamic storefront homepage payload." })
  getHome(@Query() query: PublicSellerQueryDto) {
    return this.storefrontService.getHome(query);
  }

  @Get("deals")
  @ApiOperation({ summary: "List active flash-sale deals for storefront browsing." })
  listDeals(@Query() query: ProductQueryDto) {
    return this.storefrontService.listDeals(query);
  }
}
