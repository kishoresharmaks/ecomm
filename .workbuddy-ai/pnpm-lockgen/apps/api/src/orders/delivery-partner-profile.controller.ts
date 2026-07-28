import { Body, Controller, Get, Inject, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { UpdateOwnDeliveryPartnerProfileDto } from "./dto/delivery-operations.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Delivery Partner Profile")
@Roles(RoleCode.DELIVERY_PARTNER)
@Controller("delivery/profile")
export class DeliveryPartnerProfileController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "Read the authenticated delivery partner profile." })
  getProfile(@CurrentUser() actor: RequestUser) {
    return this.ordersService.getDeliveryPartnerProfile(actor);
  }

  @Patch()
  @ApiOperation({ summary: "Update the authenticated delivery partner profile." })
  updateProfile(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateOwnDeliveryPartnerProfileDto,
  ) {
    return this.ordersService.updateOwnDeliveryPartnerProfile(actor, dto);
  }
}
