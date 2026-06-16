import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  AssignSellerSubscriptionDto,
  CreateSellerSubscriptionPlanDto,
  SellerSubscriptionPlanQueryDto,
  UpdateSellerSubscriptionPlanDto,
  VerifySellerRazorpaySubscriptionDto
} from "./dto/seller-subscription.dto";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";

@ApiTags("seller subscriptions")
@Controller()
export class SellerSubscriptionsController {
  constructor(@Inject(SellerSubscriptionsService) private readonly subscriptions: SellerSubscriptionsService) {}

  @Public()
  @Get("seller/subscription-plans")
  @ApiOperation({ summary: "List public seller subscription plans." })
  @ApiOkResponse({ description: "Active seller subscription plans for onboarding." })
  listPublicPlans() {
    return this.subscriptions.listPublicPlans();
  }

  @Roles(RoleCode.SELLER)
  @Get("seller/subscription")
  @ApiOperation({ summary: "Read authenticated seller subscription." })
  @ApiOkResponse({ description: "Current seller subscription." })
  getSellerSubscription(@CurrentUser() actor: RequestUser) {
    return this.subscriptions.getSellerSubscription(actor);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/subscription/authorize")
  @ApiOperation({ summary: "Authorize Razorpay checkout for seller subscription." })
  @ApiOkResponse({ description: "Create or reuse a Razorpay seller subscription checkout session." })
  authorizeSellerSubscription(@CurrentUser() actor: RequestUser) {
    return this.subscriptions.authorizeSellerSubscription(actor);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/subscription/verify")
  @ApiOperation({ summary: "Verify seller subscription checkout response." })
  @ApiOkResponse({ description: "Verify Razorpay seller subscription checkout response." })
  verifySellerSubscription(
    @CurrentUser() actor: RequestUser,
    @Body() dto: VerifySellerRazorpaySubscriptionDto
  ) {
    return this.subscriptions.verifySellerRazorpaySubscription(actor, dto);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/subscription/cancel")
  @ApiOperation({ summary: "Cancel seller recurring subscription at period end." })
  @ApiOkResponse({ description: "Cancel seller recurring subscription at period end." })
  cancelSellerSubscription(@CurrentUser() actor: RequestUser) {
    return this.subscriptions.cancelSellerSubscription(actor);
  }

  @Roles(RoleCode.ADMIN)
  @Get("admin/seller-subscriptions/plans")
  @ApiOperation({ summary: "List seller subscription plans for admin." })
  @ApiOkResponse({ description: "Admin seller subscription plan list." })
  listAdminPlans(@Query() query: SellerSubscriptionPlanQueryDto) {
    return this.subscriptions.listAdminPlans(query);
  }

  @Roles(RoleCode.ADMIN)
  @Post("admin/seller-subscriptions/plans")
  @ApiOperation({ summary: "Create a seller subscription plan." })
  @ApiOkResponse({ description: "Seller subscription plan created." })
  createPlan(@Body() dto: CreateSellerSubscriptionPlanDto, @CurrentUser() actor: RequestUser) {
    return this.subscriptions.createPlan(dto, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/seller-subscriptions/plans/:planId")
  @ApiOperation({ summary: "Update a seller subscription plan." })
  @ApiOkResponse({ description: "Seller subscription plan updated." })
  updatePlan(@Param("planId") planId: string, @Body() dto: UpdateSellerSubscriptionPlanDto, @CurrentUser() actor: RequestUser) {
    return this.subscriptions.updatePlan(planId, dto, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/seller-subscriptions/plans/:planId/default")
  @ApiOperation({ summary: "Set the default seller subscription plan." })
  @ApiOkResponse({ description: "Seller subscription default plan updated." })
  setDefaultPlan(@Param("planId") planId: string, @CurrentUser() actor: RequestUser) {
    return this.subscriptions.setDefaultPlan(planId, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/sellers/:sellerId/subscription")
  @ApiOperation({ summary: "Assign or update a seller subscription plan." })
  @ApiOkResponse({ description: "Seller current subscription updated." })
  assignSellerPlan(
    @Param("sellerId") sellerId: string,
    @Body() dto: AssignSellerSubscriptionDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.subscriptions.assignSellerPlan(sellerId, dto, actor);
  }
}
