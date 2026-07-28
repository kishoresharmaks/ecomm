import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { DealsService } from "./deals.service";
import { CreateDealDto, DealQueryDto, UpdateDealDto } from "./dto/deal.dto";

@ApiTags("Admin Deals")
@Roles(RoleCode.ADMIN)
@Controller("admin/deals")
export class AdminDealsController {
  constructor(@Inject(DealsService) private readonly dealsService: DealsService) {}

  @Get()
  @ApiOperation({ summary: "List deal campaigns." })
  listDeals(@Query() query: DealQueryDto) {
    return this.dealsService.listAdminDeals(query);
  }

  @Post()
  @ApiOperation({ summary: "Create a category-based seller opt-in deal campaign." })
  createDeal(@CurrentUser() actor: RequestUser, @Body() dto: CreateDealDto) {
    return this.dealsService.createDeal(actor, dto);
  }

  @Get(":dealId")
  @ApiOperation({ summary: "Read deal campaign detail." })
  getDeal(@Param("dealId") dealId: string) {
    return this.dealsService.getAdminDeal(dealId);
  }

  @Patch(":dealId")
  @ApiOperation({ summary: "Update deal campaign settings." })
  updateDeal(
    @CurrentUser() actor: RequestUser,
    @Param("dealId") dealId: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.updateDeal(actor, dealId, dto);
  }

  @Post(":dealId/publish")
  @ApiOperation({ summary: "Publish a deal campaign and notify eligible sellers." })
  publishDeal(@CurrentUser() actor: RequestUser, @Param("dealId") dealId: string) {
    return this.dealsService.publishDeal(actor, dealId);
  }

  @Post(":dealId/cancel")
  @ApiOperation({ summary: "Cancel a deal campaign immediately." })
  cancelDeal(@CurrentUser() actor: RequestUser, @Param("dealId") dealId: string) {
    return this.dealsService.cancelDeal(actor, dealId);
  }

  @Get(":dealId/dashboard")
  @ApiOperation({ summary: "Read deal seller, product, and order dashboard." })
  dashboard(@Param("dealId") dealId: string) {
    return this.dealsService.getAdminDealDashboard(dealId);
  }
}
