import { Body, Controller, Header, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { RegisterDeliveryPushTokenDto, RevokeDeliveryPushTokenDto } from "./dto/delivery-push-token.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Delivery Push")
@Roles(RoleCode.DELIVERY_PARTNER)
@Controller("delivery/push-tokens")
export class DeliveryPushController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Register this device for delivery partner push notifications." })
  register(@CurrentUser() actor: RequestUser, @Body() dto: RegisterDeliveryPushTokenDto) {
    return this.ordersService.registerDeliveryPushToken(actor, dto);
  }

  @Post("revoke")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Revoke this device's delivery partner push token." })
  revoke(@CurrentUser() actor: RequestUser, @Body() dto: RevokeDeliveryPushTokenDto) {
    return this.ordersService.revokeDeliveryPushToken(actor, dto);
  }
}
