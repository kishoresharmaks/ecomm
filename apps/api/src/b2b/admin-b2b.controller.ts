import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { B2BService } from "./b2b.service";
import { B2BEnquiryQueryDto } from "./dto/b2b-query.dto";
import { CreateB2BResponseDto } from "./dto/b2b-response.dto";
import { UpdateB2BEnquiryStatusDto } from "./dto/b2b-status.dto";

@ApiTags("Admin B2B Enquiries")
@Roles(RoleCode.ADMIN)
@Controller("admin/b2b-enquiries")
export class AdminB2BController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List all B2B enquiries for admin operations." })
  listEnquiries(@Query() query: B2BEnquiryQueryDto) {
    return this.b2bService.listAdminEnquiries(query);
  }

  @Get(":enquiryId")
  @ApiOperation({ summary: "Read admin B2B enquiry detail." })
  getEnquiry(@Param("enquiryId") enquiryId: string) {
    return this.b2bService.getAdminEnquiry(enquiryId);
  }

  @Post(":enquiryId/responses")
  @ApiOperation({ summary: "Add a manual admin response to a B2B enquiry." })
  respond(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string, @Body() dto: CreateB2BResponseDto) {
    return this.b2bService.respondAsAdmin(actor, enquiryId, dto);
  }

  @Patch(":enquiryId/status")
  @ApiOperation({ summary: "Update B2B enquiry status." })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: UpdateB2BEnquiryStatusDto
  ) {
    return this.b2bService.updateStatusAsAdmin(actor, enquiryId, dto);
  }

  @Patch(":enquiryId/approve")
  @ApiOperation({ summary: "Approve a buyer-confirmed B2B enquiry." })
  approve(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.approveConfirmedEnquiry(actor, enquiryId);
  }

  @Patch(":enquiryId/finalise")
  @ApiOperation({ summary: "Finalise an admin-approved B2B enquiry." })
  finalise(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.finaliseEnquiry(actor, enquiryId);
  }
}
