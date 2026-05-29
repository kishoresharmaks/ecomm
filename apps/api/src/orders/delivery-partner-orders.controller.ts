import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CreateDeliveryAttemptDto,
  DeliveryAssignmentDecisionDto,
} from "./dto/delivery-operations.dto";
import { UpdateDeliveryDto } from "./dto/delivery-update.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Delivery Partner Orders")
@Roles(RoleCode.DELIVERY_PARTNER)
@Controller("delivery/orders")
export class DeliveryPartnerOrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List orders assigned to the authenticated delivery partner." })
  listOrders(@CurrentUser() actor: RequestUser, @Query() query: OrderQueryDto) {
    return this.ordersService.listDeliveryPartnerOrders(actor, query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read an assigned delivery order." })
  getOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.ordersService.getDeliveryPartnerOrder(actor, orderNumber);
  }

  @Patch(":orderNumber/delivery")
  @ApiOperation({ summary: "Update delivery progress for an assigned order." })
  updateDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateDeliveryDto
  ) {
    return this.ordersService.updateDeliveryPartnerDelivery(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/assignment")
  @ApiOperation({ summary: "Accept or reject a delivery assignment." })
  respondAssignment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: DeliveryAssignmentDecisionDto,
  ) {
    return this.ordersService.respondDeliveryAssignment(actor, orderNumber, dto);
  }

  @Post(":orderNumber/attempts")
  @ApiOperation({ summary: "Record a failed or rescheduled delivery attempt." })
  createAttempt(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateDeliveryAttemptDto,
  ) {
    return this.ordersService.createDeliveryAttempt(actor, orderNumber, dto);
  }
}
