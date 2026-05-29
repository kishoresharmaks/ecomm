import { Body, Controller, Inject, Param, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CodVerificationDto } from "./dto/cod-verification.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Finance Order Payments")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance/order-payments")
export class FinanceOrderPaymentsController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Patch(":orderNumber/cod-verification")
  @ApiOperation({ summary: "Verify or reject delivery partner COD collection from the finance workspace." })
  verifyCodCollection(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CodVerificationDto
  ) {
    return this.ordersService.verifyCodCollection(actor, orderNumber, dto);
  }
}
