import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  DeliveryOperationsQueryDto,
  DeliveryPartnerQueryDto,
  UpdateDeliveryAssignmentDto,
} from "./dto/delivery-operations.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Admin Delivery Operations")
@Roles(RoleCode.ADMIN)
@Controller("admin/delivery")
export class AdminDeliveryController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get("partners")
  @ApiOperation({ summary: "List delivery partners with workload and COD exposure." })
  listPartners(@Query() query: DeliveryPartnerQueryDto) {
    return this.ordersService.listDeliveryPartners(query);
  }

  @Get("unassigned-orders")
  @ApiOperation({ summary: "List packed deliveries waiting for assignment or reassignment." })
  listUnassignedOrders(@Query() query: DeliveryOperationsQueryDto) {
    return this.ordersService.listUnassignedDeliveryOrders(query);
  }

  @Get("cod-handover-report")
  @ApiOperation({ summary: "Read partner-wise COD collection handover summary." })
  codHandoverReport() {
    return this.ordersService.getDeliveryCodHandoverReport();
  }

  @Post("orders/:orderNumber/auto-assign")
  @ApiOperation({ summary: "Auto assign the best eligible delivery partner for a packed order." })
  autoAssign(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.ordersService.autoAssignDeliveryPartner(actor, orderNumber);
  }

  @Patch("orders/:orderNumber/assignment")
  @ApiOperation({ summary: "Assign, reassign, or unassign a delivery partner." })
  updateAssignment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateDeliveryAssignmentDto,
  ) {
    return this.ordersService.updateAdminDeliveryAssignment(actor, orderNumber, dto);
  }
}
