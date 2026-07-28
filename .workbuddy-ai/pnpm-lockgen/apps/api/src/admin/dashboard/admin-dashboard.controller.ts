import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AdminDashboardService } from "./admin-dashboard.service";

@ApiTags("admin dashboard")
@Roles(RoleCode.ADMIN)
@Controller("admin/dashboard")
export class AdminDashboardController {
  constructor(@Inject(AdminDashboardService) private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: "Read admin operations dashboard metrics." })
  @ApiOkResponse({ description: "Admin dashboard summary." })
  getSummary() {
    return this.adminDashboardService.getSummary();
  }
}
