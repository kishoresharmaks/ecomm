import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import type { RequestUser } from "../../auth/types/indihub-request";
import { AdminSellersService } from "./admin-sellers.service";
import { SellerApprovalDto, SellerQueryDto, SellerSuspensionDto } from "./dto/seller-approval.dto";

@ApiTags("admin sellers")
@Roles(RoleCode.ADMIN)
@Controller("admin/sellers")
export class AdminSellersController {
  constructor(@Inject(AdminSellersService) private readonly adminSellersService: AdminSellersService) {}

  @Get()
  @ApiOkResponse({ description: "Seller list for admin management." })
  listSellers(@Query() query: SellerQueryDto) {
    return this.adminSellersService.listSellers(query);
  }

  @Get("pending")
  @ApiOkResponse({ description: "Pending seller registrations." })
  getPendingSellers() {
    return this.adminSellersService.getPendingSellers();
  }

  @Get(":sellerId")
  @ApiOkResponse({ description: "Seller detail for admin management." })
  getSeller(@Param("sellerId") sellerId: string) {
    return this.adminSellersService.getSeller(sellerId);
  }

  @Patch(":sellerId/approval")
  @ApiOkResponse({ description: "Seller approval status updated." })
  updateSellerApproval(
    @Param("sellerId") sellerId: string,
    @Body() dto: SellerApprovalDto,
    @CurrentUser() currentUser?: RequestUser
  ) {
    return this.adminSellersService.updateSellerApproval(sellerId, dto, currentUser);
  }

  @Patch(":sellerId/suspension")
  @ApiOkResponse({ description: "Seller suspension status updated." })
  updateSellerSuspension(
    @Param("sellerId") sellerId: string,
    @Body() dto: SellerSuspensionDto,
    @CurrentUser() currentUser: RequestUser
  ) {
    return this.adminSellersService.updateSellerSuspension(sellerId, dto, currentUser);
  }
}
