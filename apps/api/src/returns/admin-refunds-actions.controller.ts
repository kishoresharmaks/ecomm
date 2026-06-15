import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ApproveRefundDto, InitiateRefundDto, ManualRefundDto } from "./dto/returns.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("Admin Refunds")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/refunds")
export class AdminRefundActionsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Post(":refundNumber/approve")
  @ApiOperation({ summary: "Approve a refund request for payment processing." })
  approve(
    @CurrentUser() actor: RequestUser,
    @Param("refundNumber") refundNumber: string,
    @Body() dto: ApproveRefundDto,
  ) {
    return this.returnsService.approveRefund(actor, refundNumber, dto);
  }

  @Post(":refundNumber/initiate")
  @ApiOperation({ summary: "Initiate a Razorpay refund using an idempotent provider call." })
  initiate(
    @CurrentUser() actor: RequestUser,
    @Param("refundNumber") refundNumber: string,
    @Body() dto: InitiateRefundDto,
  ) {
    return this.returnsService.initiateRefund(actor, refundNumber, dto);
  }

  @Post(":refundNumber/manual-record")
  @ApiOperation({ summary: "Record a completed manual refund with reference and paid date." })
  manualRecord(
    @CurrentUser() actor: RequestUser,
    @Param("refundNumber") refundNumber: string,
    @Body() dto: ManualRefundDto,
  ) {
    return this.returnsService.recordManualRefund(actor, refundNumber, dto);
  }

  @Post(":refundNumber/retry")
  @ApiOperation({ summary: "Retry a failed or retry-pending Razorpay refund." })
  retry(
    @CurrentUser() actor: RequestUser,
    @Param("refundNumber") refundNumber: string,
    @Body() dto: InitiateRefundDto,
  ) {
    return this.returnsService.retryRefund(actor, refundNumber, dto);
  }
}
