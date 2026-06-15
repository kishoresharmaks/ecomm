import { Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CouponsService } from "./coupons.service";
import { SellerCouponQueryDto } from "./dto/coupon.dto";

@ApiTags("Seller Coupons")
@Roles(RoleCode.SELLER)
@Controller("seller/coupons")
export class SellerCouponsController {
  constructor(@Inject(CouponsService) private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: "List coupons connected to this seller." })
  listCoupons(@CurrentUser() actor: RequestUser, @Query() query: SellerCouponQueryDto) {
    return this.couponsService.listSellerCoupons(actor, query);
  }

  @Post(":couponId/accept")
  @ApiOperation({ summary: "Accept seller-funded coupon participation." })
  acceptCoupon(@CurrentUser() actor: RequestUser, @Param("couponId") couponId: string) {
    return this.couponsService.acceptSellerCoupon(actor, couponId);
  }

  @Post(":couponId/decline")
  @ApiOperation({ summary: "Decline seller-funded coupon participation." })
  declineCoupon(@CurrentUser() actor: RequestUser, @Param("couponId") couponId: string) {
    return this.couponsService.declineSellerCoupon(actor, couponId);
  }
}
