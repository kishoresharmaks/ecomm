import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CreatePushCampaignDto,
  PushCampaignQueryDto,
  UpdatePushCampaignDto,
} from "./dto/push-campaign.dto";
import { PushCampaignsService } from "./push-campaigns.service";

@ApiTags("Admin Push Campaigns")
@Roles(RoleCode.ADMIN)
@Permissions("notifications.manage")
@Controller("admin/push-campaigns")
export class AdminPushCampaignsController {
  constructor(@Inject(PushCampaignsService) private readonly campaigns: PushCampaignsService) {}

  @Get()
  @ApiOperation({ summary: "List push campaigns." })
  list(@Query() query: PushCampaignQueryDto) {
    return this.campaigns.listCampaigns(query);
  }

  @Post()
  @ApiOperation({ summary: "Create a push campaign draft." })
  create(@CurrentUser() actor: RequestUser, @Body() dto: CreatePushCampaignDto) {
    return this.campaigns.createCampaign(actor, dto);
  }

  @Post("preview")
  @ApiOperation({ summary: "Preview approximate push campaign recipients." })
  preview(@Body() dto: CreatePushCampaignDto) {
    return this.campaigns.previewCampaign(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Read a push campaign." })
  get(@Param("id") id: string) {
    return this.campaigns.getCampaign(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a push campaign draft." })
  update(@CurrentUser() actor: RequestUser, @Param("id") id: string, @Body() dto: UpdatePushCampaignDto) {
    return this.campaigns.updateCampaign(actor, id, dto);
  }

  @Post(":id/send-now")
  @ApiOperation({ summary: "Send a push campaign now." })
  sendNow(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.campaigns.sendNow(actor, id);
  }

  @Post(":id/schedule")
  @ApiOperation({ summary: "Schedule a push campaign." })
  schedule(@CurrentUser() actor: RequestUser, @Param("id") id: string, @Body("scheduledAt") scheduledAt: string) {
    return this.campaigns.schedule(actor, id, scheduledAt);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a push campaign." })
  cancel(@CurrentUser() actor: RequestUser, @Param("id") id: string) {
    return this.campaigns.cancel(actor, id);
  }

  @Get(":id/audit-log")
  @ApiOperation({ summary: "Read push campaign audit log entries." })
  auditLog(@Param("id") id: string) {
    return this.campaigns.auditLog(id);
  }
}
