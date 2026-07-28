import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  DeliveryPartnerPayoutQueryDto,
  MarkPayoutPaidDto,
  PayoutActionDto,
} from "../finance/dto/finance.dto";
import {
  CreateDeliveryAttemptDto,
  DeliveryAssignmentDecisionDto,
  DeliveryPartnerPayoutRequestDto,
  DeliveryPartnerWalletQueryDto,
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

@ApiTags("Delivery Partner Wallet")
@Roles(RoleCode.DELIVERY_PARTNER)
@Controller("delivery/wallet")
export class DeliveryPartnerWalletController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "Read the authenticated delivery partner's local delivery earnings wallet." })
  getWallet(@CurrentUser() actor: RequestUser, @Query() query: DeliveryPartnerWalletQueryDto) {
    return this.ordersService.getDeliveryPartnerWallet(actor, query);
  }

  @Post("payout-requests")
  @ApiOperation({ summary: "Request a manual payout from the authenticated delivery partner wallet." })
  requestPayout(@CurrentUser() actor: RequestUser, @Body() dto: DeliveryPartnerPayoutRequestDto) {
    return this.ordersService.requestDeliveryPartnerWalletPayout(actor, dto);
  }
}

@ApiTags("Admin Finance Delivery Partner Payouts")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance/delivery-partner-payouts")
export class FinanceDeliveryPartnerPayoutsController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List delivery partner payout requests." })
  listPayouts(@Query() query: DeliveryPartnerPayoutQueryDto) {
    return this.ordersService.listDeliveryPartnerPayouts(query);
  }

  @Get(":payoutId")
  @ApiOperation({ summary: "Read a delivery partner payout request." })
  getPayout(@Param("payoutId") payoutId: string) {
    return this.ordersService.getDeliveryPartnerPayout(payoutId);
  }

  @Patch(":payoutId/approve")
  @ApiOperation({ summary: "Approve a requested delivery partner payout." })
  approvePayout(
    @CurrentUser() actor: RequestUser,
    @Param("payoutId") payoutId: string,
    @Body() dto: PayoutActionDto,
  ) {
    return this.ordersService.approveDeliveryPartnerPayout(payoutId, dto, actor);
  }

  @Patch(":payoutId/reject")
  @ApiOperation({ summary: "Reject a requested or approved delivery partner payout." })
  rejectPayout(
    @CurrentUser() actor: RequestUser,
    @Param("payoutId") payoutId: string,
    @Body() dto: PayoutActionDto,
  ) {
    return this.ordersService.rejectDeliveryPartnerPayout(payoutId, dto, actor);
  }

  @Patch(":payoutId/mark-paid")
  @ApiOperation({ summary: "Mark an approved delivery partner payout as manually paid." })
  markPaid(
    @CurrentUser() actor: RequestUser,
    @Param("payoutId") payoutId: string,
    @Body() dto: MarkPayoutPaidDto,
  ) {
    return this.ordersService.markDeliveryPartnerPayoutPaid(payoutId, dto, actor);
  }
}
