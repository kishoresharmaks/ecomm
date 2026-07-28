import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./dto/audit-query.dto";

@ApiTags("Admin Audit Logs")
@Roles(RoleCode.ADMIN)
@Controller("admin/audit-logs")
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "List audit log records for admin review." })
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query);
  }
}

