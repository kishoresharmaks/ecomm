import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Admin Reports")
@Roles(RoleCode.ADMIN)
@Controller("admin/reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: "Read reports overview." })
  overview(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.overview(query);
  }

  @Get("sales")
  @ApiOperation({ summary: "Read sales report." })
  sales(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.sales(query);
  }

  @Get("sellers")
  @ApiOperation({ summary: "Read seller report." })
  sellers(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.sellers(query);
  }

  @Get("products")
  @ApiOperation({ summary: "Read product report." })
  products(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.products(query);
  }

  @Get("enquiries")
  @ApiOperation({ summary: "Read enquiry report." })
  enquiries(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.enquiries(query);
  }
}
