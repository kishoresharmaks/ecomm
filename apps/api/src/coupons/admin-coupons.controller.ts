import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CouponsService } from "./coupons.service";
import { CouponQueryDto, CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto";

@ApiTags("Admin Coupons")
@Roles(RoleCode.ADMIN)
@Controller("admin/coupons")
export class AdminCouponsController {
  constructor(@Inject(CouponsService) private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: "List coupon campaigns." })
  listCoupons(@Query() query: CouponQueryDto) {
    return this.couponsService.listAdminCoupons(query);
  }

  @Post()
  @ApiOperation({ summary: "Create an admin-managed coupon campaign." })
  createCoupon(@CurrentUser() actor: RequestUser, @Body() dto: CreateCouponDto) {
    return this.couponsService.createCoupon(actor, dto);
  }

  @Get(":couponId")
  @ApiOperation({ summary: "Read coupon campaign details." })
  getCoupon(@Param("couponId") couponId: string) {
    return this.couponsService.getAdminCoupon(couponId);
  }

  @Patch(":couponId")
  @ApiOperation({ summary: "Update coupon campaign configuration." })
  updateCoupon(
    @CurrentUser() actor: RequestUser,
    @Param("couponId") couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.updateCoupon(actor, couponId, dto);
  }

  @Post(":couponId/activate")
  @ApiOperation({ summary: "Activate a coupon campaign." })
  activateCoupon(@CurrentUser() actor: RequestUser, @Param("couponId") couponId: string) {
    return this.couponsService.activateCoupon(actor, couponId);
  }

  @Post(":couponId/pause")
  @ApiOperation({ summary: "Pause an active coupon campaign." })
  pauseCoupon(@CurrentUser() actor: RequestUser, @Param("couponId") couponId: string) {
    return this.couponsService.pauseCoupon(actor, couponId);
  }

  @Post(":couponId/archive")
  @ApiOperation({ summary: "Archive a coupon campaign." })
  archiveCoupon(@CurrentUser() actor: RequestUser, @Param("couponId") couponId: string) {
    return this.couponsService.archiveCoupon(actor, couponId);
  }

  @Get(":couponId/redemptions")
  @ApiOperation({ summary: "List coupon redemption history." })
  listRedemptions(@Param("couponId") couponId: string, @Query() query: CouponQueryDto) {
    return this.couponsService.listRedemptions(couponId, query);
  }
}
