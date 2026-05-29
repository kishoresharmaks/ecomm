import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Seller Reports")
@Roles(RoleCode.SELLER)
@Controller("seller/reports")
export class SellerReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("sales")
  @ApiOperation({ summary: "Read sales summary for the authenticated seller." })
  sales(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerSales(actor, query);
  }
}
