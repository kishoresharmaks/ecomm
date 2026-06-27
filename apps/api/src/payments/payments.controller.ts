import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, RawBody } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { UpsertPaymentConfigurationDto } from "./dto/payment-config.dto";
import { VerifyRazorpayPaymentDto } from "./dto/razorpay-payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  @Get("admin/payments/readiness")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Read payment provider readiness." })
  readiness() {
    return this.paymentsService.readiness();
  }

  @Get("admin/payments/config")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Read admin payment configuration without exposing secrets." })
  paymentConfiguration() {
    return this.paymentsService.adminPaymentConfiguration();
  }

  @Patch("admin/payments/config")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Update payment provider and method configuration." })
  updatePaymentConfiguration(@CurrentUser() actor: RequestUser, @Body() dto: UpsertPaymentConfigurationDto) {
    return this.paymentsService.updatePaymentConfiguration(actor, dto);
  }

  @Get("payments/checkout-methods")
  @Roles(RoleCode.CUSTOMER)
  @ApiOperation({ summary: "Read checkout-safe payment method availability." })
  checkoutMethods() {
    return this.paymentsService.checkoutMethods();
  }

  @Post("payments/razorpay/orders/:orderNumber")
  @Roles(RoleCode.CUSTOMER)
  @ApiOperation({ summary: "Create a Razorpay provider order for an existing 1HandIndia order." })
  createRazorpayOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.paymentsService.createRazorpayOrder(actor, orderNumber);
  }

  @Post("payments/razorpay/verify")
  @Roles(RoleCode.CUSTOMER)
  @ApiOperation({ summary: "Verify Razorpay Checkout payment signature and refresh payment state." })
  verifyRazorpayPayment(@CurrentUser() actor: RequestUser, @Body() dto: VerifyRazorpayPaymentDto) {
    return this.paymentsService.verifyRazorpayPayment(actor, dto);
  }

  @Patch("payments/razorpay/orders/:orderNumber/cancel")
  @Roles(RoleCode.CUSTOMER)
  @ApiOperation({ summary: "Cancel an unpaid Razorpay order when the user dismisses or payment fails." })
  cancelRazorpayOrder(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.paymentsService.cancelRazorpayOrder(actor, orderNumber);
  }

  @Public()
  @Post("payments/razorpay/webhook")
  @ApiOperation({ summary: "Receive Razorpay payment webhook events." })
  handleRazorpayWebhook(
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Headers("x-razorpay-event-id") eventId: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
    @Body() payload: Record<string, unknown>
  ) {
    return this.paymentsService.handleRazorpayWebhook(signature, payload, rawBody, eventId);
  }
}
