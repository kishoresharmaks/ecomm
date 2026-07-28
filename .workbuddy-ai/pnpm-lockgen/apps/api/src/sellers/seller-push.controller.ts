import { Body, Controller, Header, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { RegisterSellerPushTokenDto, RevokeSellerPushTokenDto } from "./dto/seller-push-token.dto";
import { SellersService } from "./sellers.service";

@ApiTags("Seller Push")
@Roles(RoleCode.SELLER)
@Controller("seller/push-tokens")
export class SellerPushController {
  constructor(@Inject(SellersService) private readonly sellersService: SellersService) {}

  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Register this device for seller mobile push notifications." })
  register(@CurrentUser() actor: RequestUser, @Body() dto: RegisterSellerPushTokenDto) {
    return this.sellersService.registerPushToken(actor, dto);
  }

  @Post("revoke")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Revoke this device's seller mobile push token." })
  revoke(@CurrentUser() actor: RequestUser, @Body() dto: RevokeSellerPushTokenDto) {
    return this.sellersService.revokePushToken(actor, dto);
  }
}
