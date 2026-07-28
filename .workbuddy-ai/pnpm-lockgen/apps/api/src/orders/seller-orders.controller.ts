import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { UpdateDeliveryDto } from "./dto/delivery-update.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { UpdateSellerOrderStatusDto } from "./dto/order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Seller Orders")
@Roles(RoleCode.SELLER)
@Controller("seller/orders")
export class SellerOrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List orders containing the authenticated seller's products." })
  listOrders(@CurrentUser() actor: RequestUser, @Query() query: OrderQueryDto) {
    return this.ordersService.listSellerOrders(actor, query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read seller order detail." })
  getOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.ordersService.getSellerOrder(actor, orderNumber);
  }

  @Patch(":orderNumber/status")
  @ApiOperation({ summary: "Update seller-side order status." })
  updateSellerOrderStatus(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateSellerOrderStatusDto
  ) {
    return this.ordersService.updateSellerOrderStatus(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/delivery")
  @ApiOperation({ summary: "Update store pickup, local partner, or courier details for a seller order." })
  updateDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateDeliveryDto
  ) {
    return this.ordersService.updateDelivery(actor, orderNumber, dto, { sellerOnly: true });
  }
}
