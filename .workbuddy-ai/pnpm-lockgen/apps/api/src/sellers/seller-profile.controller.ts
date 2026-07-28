import { Body, Controller, Get, Header, Headers, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { encryptForBearerSession } from "../common/encrypted-response";
import { UpdateSellerProfileDto } from "./dto/seller-profile.dto";
import { SellersService } from "./sellers.service";

@ApiTags("Seller Profile")
@Roles(RoleCode.SELLER)
@Controller("seller/profile")
export class SellerProfileController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Read the authenticated seller store profile." })
  async getProfile(
    @CurrentUser() actor: RequestUser,
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("x-indihub-accept-encrypted-response") acceptEncryptedResponse: string | undefined,
  ) {
    const response = await this.sellersService.getMySellerProfile(actor);
    return encryptForBearerSession(authorizationHeader, response, acceptEncryptedResponse);
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Update the authenticated seller store profile." })
  async updateProfile(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateSellerProfileDto,
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("x-indihub-accept-encrypted-response") acceptEncryptedResponse: string | undefined,
  ) {
    const response = await this.sellersService.updateMySellerProfile(actor, dto);
    return encryptForBearerSession(authorizationHeader, response, acceptEncryptedResponse);
  }

  @Post("courier-pickups/:providerCode/sync")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Create or reuse the seller pickup location with a live courier provider." })
  async syncCourierPickup(
    @CurrentUser() actor: RequestUser,
    @Param("providerCode") providerCode: string,
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("x-indihub-accept-encrypted-response") acceptEncryptedResponse: string | undefined,
  ) {
    const response = await this.sellersService.syncMyCourierPickup(actor, providerCode);
    return encryptForBearerSession(authorizationHeader, response, acceptEncryptedResponse);
  }
}
