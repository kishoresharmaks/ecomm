import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AdminCouponsController } from "./admin-coupons.controller";
import { CouponsService } from "./coupons.service";
import { SellerCouponsController } from "./seller-coupons.controller";

@Module({
  imports: [AuditModule],
  controllers: [AdminCouponsController, SellerCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
