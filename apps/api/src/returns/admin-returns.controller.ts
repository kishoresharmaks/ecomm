import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  RefundListQueryDto,
  ReversePickupAssignmentDto,
  ReversePickupListQueryDto,
  ReversePickupReleaseDto,
  ReturnListQueryDto,
  ReturnQcDto,
  UpdateReturnStatusDto,
} from "./dto/returns.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("Admin Returns")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/returns")
export class AdminReturnsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: "List return requests with cursor pagination." })
  listReturns(@Query() query: ReturnListQueryDto) {
    return this.returnsService.listAdminReturns(query);
  }

  @Get("pickups")
  @ApiOperation({ summary: "List return pickups needing delivery partner assignment or progress." })
  listReturnPickups(@Query() query: ReversePickupListQueryDto) {
    return this.returnsService.listAdminReversePickups(query);
  }

  @Get(":requestNumber")
  @ApiOperation({ summary: "Read admin return request detail." })
  getReturn(@Param("requestNumber") requestNumber: string) {
    return this.returnsService.getAdminReturn(requestNumber);
  }

  @Patch(":requestNumber/status")
  @ApiOperation({ summary: "Approve, reject, cancel, or advance a return request." })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: UpdateReturnStatusDto,
  ) {
    return this.returnsService.updateReturnStatus(actor, requestNumber, dto);
  }

  @Post(":requestNumber/qc")
  @ApiOperation({ summary: "Record return quality-check result." })
  recordQc(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReturnQcDto,
  ) {
    return this.returnsService.recordReturnQc(actor, requestNumber, dto);
  }

  @Post(":requestNumber/reverse-pickup/auto-assign")
  @ApiOperation({ summary: "Auto assign one delivery partner for all seller return packages." })
  autoAssignReversePickup(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
  ) {
    return this.returnsService.autoAssignReversePickup(actor, requestNumber);
  }

  @Patch(":requestNumber/reverse-pickup/assignment")
  @ApiOperation({ summary: "Assign, reassign, or unassign the delivery partner for a return pickup." })
  updateReversePickupAssignment(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupAssignmentDto,
  ) {
    return this.returnsService.updateAdminReversePickupAssignment(actor, requestNumber, dto);
  }

  @Post(":requestNumber/reverse-pickup/release")
  @ApiOperation({ summary: "Release a pending return pickup assignment back to the admin queue." })
  releaseReversePickupAssignment(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupReleaseDto,
  ) {
    return this.returnsService.releaseReversePickupAssignment(actor, requestNumber, dto);
  }
}

@ApiTags("Admin Refunds")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/refunds")
export class AdminRefundsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: "List refund requests with cursor pagination." })
  listRefunds(@Query() query: RefundListQueryDto) {
    return this.returnsService.listAdminRefunds(query);
  }

  @Get(":refundNumber")
  @ApiOperation({ summary: "Read refund request detail." })
  getRefund(@Param("refundNumber") refundNumber: string) {
    return this.returnsService.getAdminRefund(refundNumber);
  }
}
