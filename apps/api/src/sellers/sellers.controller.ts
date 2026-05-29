import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CreateSellerOnboardingDto } from "./dto/create-seller-registration.dto";
import { PublicSellerQueryDto } from "./dto/public-seller-query.dto";
import { SellersService } from "./sellers.service";

@ApiTags("sellers")
@Controller("sellers")
export class SellersController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {}

  @Post("register")
  @ApiCreatedResponse({ description: "Seller registration submitted for admin approval." })
  registerSeller(@CurrentUser() actor: RequestUser, @Body() dto: CreateSellerOnboardingDto) {
    return this.sellersService.registerSeller(actor, dto);
  }

  @Public()
  @Get()
  listPublicSellers(@Query() query: PublicSellerQueryDto) {
    return this.sellersService.listPublicSellers(query);
  }

  @Public()
  @Get(":slug")
  getPublicSeller(@Param("slug") slug: string) {
    return this.sellersService.getPublicSeller(slug);
  }
}
