import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { SupportRequestQueryDto, UpdateSupportRequestDto } from "./dto/support-request.dto";
import { SupportService } from "./support.service";

@ApiTags("Admin Support")
@Roles(RoleCode.ADMIN)
@Controller("admin/support-requests")
export class AdminSupportController {
  constructor(@Inject(SupportService) private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: "List support requests for admin." })
  listAdminRequests(@Query() query: SupportRequestQueryDto) {
    return this.supportService.listAdminRequests(query);
  }

  @Patch(":requestId")
  @ApiOperation({ summary: "Update support request status or admin note." })
  updateRequest(
    @CurrentUser() actor: RequestUser,
    @Param("requestId") requestId: string,
    @Body() dto: UpdateSupportRequestDto
  ) {
    return this.supportService.updateRequest(actor, requestId, dto);
  }
}
