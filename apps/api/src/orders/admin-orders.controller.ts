import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CodVerificationDto } from "./dto/cod-verification.dto";
import { UpdateDeliveryDto } from "./dto/delivery-update.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { UpdateOrderStatusDto } from "./dto/order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Admin Orders")
@Roles(RoleCode.ADMIN)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List all platform orders for admin." })
  listOrders(@Query() query: OrderQueryDto) {
    return this.ordersService.listAdminOrders(query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read admin order detail." })
  getOrder(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.getAdminOrder(orderNumber);
  }

  @Patch(":orderNumber/status")
  @ApiOperation({ summary: "Update order or payment status manually." })
  updateOrderStatus(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateAdminOrderStatus(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/delivery")
  @ApiOperation({ summary: "Update store pickup, local partner, or courier delivery details for an order." })
  updateDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateDeliveryDto
  ) {
    return this.ordersService.updateDelivery(actor, orderNumber, dto, { sellerOnly: false });
  }

  @Patch(":orderNumber/shipments/:shipmentNumber/delivery")
  @ApiOperation({ summary: "Override delivery mode and routing fields for one seller shipment." })
  updateShipmentDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentNumber") shipmentNumber: string,
    @Body() dto: UpdateDeliveryDto
  ) {
    return this.ordersService.updateAdminShipmentDelivery(actor, orderNumber, shipmentNumber, dto);
  }

  @Patch(":orderNumber/cod-verification")
  @ApiOperation({ summary: "Verify or reject delivery partner COD collection for an order." })
  verifyCodCollection(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CodVerificationDto
  ) {
    return this.ordersService.verifyCodCollection(actor, orderNumber, dto);
  }
}
