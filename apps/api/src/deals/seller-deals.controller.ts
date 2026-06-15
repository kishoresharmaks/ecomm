import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { DealsService } from "./deals.service";
import { EnrollDealProductsDto } from "./dto/deal.dto";

@ApiTags("Seller Deals")
@Roles(RoleCode.SELLER)
@Controller("seller/deals")
export class SellerDealsController {
  constructor(@Inject(DealsService) private readonly dealsService: DealsService) {}

  @Get()
  @ApiOperation({ summary: "List deal campaigns available to this seller." })
  listDeals(@CurrentUser() actor: RequestUser) {
    return this.dealsService.listSellerDeals(actor);
  }

  @Get(":dealId")
  @ApiOperation({ summary: "Read seller deal detail and eligible products." })
  getDeal(@CurrentUser() actor: RequestUser, @Param("dealId") dealId: string) {
    return this.dealsService.getSellerDeal(actor, dealId);
  }

  @Post(":dealId/accept")
  @ApiOperation({ summary: "Accept a deal campaign." })
  acceptDeal(@CurrentUser() actor: RequestUser, @Param("dealId") dealId: string) {
    return this.dealsService.acceptSellerDeal(actor, dealId);
  }

  @Post(":dealId/decline")
  @ApiOperation({ summary: "Decline a deal campaign." })
  declineDeal(@CurrentUser() actor: RequestUser, @Param("dealId") dealId: string) {
    return this.dealsService.declineSellerDeal(actor, dealId);
  }

  @Post(":dealId/products")
  @ApiOperation({ summary: "Enroll eligible products into an accepted deal." })
  enrollProducts(
    @CurrentUser() actor: RequestUser,
    @Param("dealId") dealId: string,
    @Body() dto: EnrollDealProductsDto,
  ) {
    return this.dealsService.enrollSellerProducts(actor, dealId, dto);
  }

  @Delete(":dealId/products/:productId")
  @ApiOperation({ summary: "Remove a product from a deal before the join deadline." })
  removeProduct(
    @CurrentUser() actor: RequestUser,
    @Param("dealId") dealId: string,
    @Param("productId") productId: string,
  ) {
    return this.dealsService.removeSellerProduct(actor, dealId, productId);
  }
}
