import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CreateSupportRequestDto, SupportRequestQueryDto, UpdateSupportRequestDto } from "./dto/support-request.dto";
import { SupportService } from "./support.service";

@ApiTags("Support")
@Controller("support-requests")
export class SupportController {
  constructor(@Inject(SupportService) private readonly supportService: SupportService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: "Create a public contact/support request." })
  createPublicRequest(@Body() dto: CreateSupportRequestDto) {
    return this.supportService.createPublicRequest(dto);
  }

  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER, RoleCode.SELLER)
  @Post("authenticated")
  @ApiOperation({ summary: "Create a support request linked to the authenticated user." })
  createAuthenticatedRequest(@CurrentUser() actor: RequestUser, @Body() dto: CreateSupportRequestDto) {
    return this.supportService.createPublicRequest(dto, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Get("admin")
  @ApiOperation({ summary: "List support requests for admin." })
  listAdminRequests(@Query() query: SupportRequestQueryDto) {
    return this.supportService.listAdminRequests(query);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/:requestId")
  @ApiOperation({ summary: "Update support request status or admin note." })
  updateRequest(
    @CurrentUser() actor: RequestUser,
    @Param("requestId") requestId: string,
    @Body() dto: UpdateSupportRequestDto
  ) {
    return this.supportService.updateRequest(actor, requestId, dto);
  }
}

