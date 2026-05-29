import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { UpdateSellerProfileDto } from "./dto/seller-profile.dto";
import { SellersService } from "./sellers.service";

@ApiTags("Seller Profile")
@Roles(RoleCode.SELLER)
@Controller("seller/profile")
export class SellerProfileController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {}

  @Get()
  @ApiOperation({ summary: "Read the authenticated seller store profile." })
  getProfile(@CurrentUser() actor: RequestUser) {
    return this.sellersService.getMySellerProfile(actor);
  }

  @Patch()
  @ApiOperation({ summary: "Update the authenticated seller store profile." })
  updateProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpdateSellerProfileDto) {
    return this.sellersService.updateMySellerProfile(actor, dto);
  }
}
