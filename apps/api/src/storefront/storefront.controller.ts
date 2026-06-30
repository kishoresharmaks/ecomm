import { Controller, Get, Headers, Inject, Query } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
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
  @ApiHeader({ name: "Authorization", required: false })
  getHome(
    @Query() query: PublicSellerQueryDto,
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("x-clerk-user-id") clerkUserId: string | undefined,
    @Headers("x-indihub-dev-clerk-id") devClerkUserId: string | undefined,
    @Headers("x-indihub-user-id") platformUserId: string | undefined,
  ) {
    const optionalClerkUserId = clerkUserId ?? devClerkUserId;
    const options = {
      ...(authorizationHeader ? { authorizationHeader } : {}),
      ...(optionalClerkUserId ? { clerkUserId: optionalClerkUserId } : {}),
      ...(platformUserId ? { platformUserId } : {}),
    };
    return this.storefrontService.getHome(query, options);
  }

  @Get("deals")
  @ApiOperation({ summary: "List active flash-sale deals for storefront browsing." })
  listDeals(@Query() query: ProductQueryDto) {
    return this.storefrontService.listDeals(query);
  }

  @Get("contact")
  @ApiOperation({ summary: "Read public contact and support channel configuration." })
  getContactConfig() {
    return this.storefrontService.getContactConfig();
  }
}
