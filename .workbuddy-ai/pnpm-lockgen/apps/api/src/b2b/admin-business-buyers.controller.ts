import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { B2BService } from "./b2b.service";
import { BusinessBuyerQueryDto, UpdateBusinessBuyerStatusDto } from "./dto/business-buyer-query.dto";

@ApiTags("Admin Business Buyers")
@Roles(RoleCode.ADMIN)
@Controller("admin/business-buyers")
export class AdminBusinessBuyersController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List business buyers for admin management." })
  listBusinessBuyers(@Query() query: BusinessBuyerQueryDto) {
    return this.b2bService.listAdminBusinessBuyers(query);
  }

  @Get(":businessBuyerId")
  @ApiOperation({ summary: "Read one business buyer profile for admin management." })
  getBusinessBuyer(@Param("businessBuyerId") businessBuyerId: string) {
    return this.b2bService.getAdminBusinessBuyer(businessBuyerId);
  }

  @Patch(":businessBuyerId/status")
  @ApiOperation({ summary: "Update a business buyer status." })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("businessBuyerId") businessBuyerId: string,
    @Body() dto: UpdateBusinessBuyerStatusDto
  ) {
    return this.b2bService.updateBusinessBuyerStatus(actor, businessBuyerId, dto);
  }
}
