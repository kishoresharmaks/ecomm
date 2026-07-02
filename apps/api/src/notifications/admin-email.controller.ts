import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { SettingsService } from "../settings/settings.service";
import { UpsertEmailSettingDto } from "../settings/dto/settings.dto";
import {
  CreateEmailTemplateDto,
  CreateEmailThemeDto,
  EmailTemplateQueryDto,
  UpdateEmailTemplateDto,
  UpdateEmailThemeDto,
} from "./dto/email-template.dto";
import { UpdateEmailTriggerRuleDto } from "./dto/email-trigger.dto";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("Admin Email")
@Roles(RoleCode.ADMIN)
@Controller("admin/email")
export class AdminEmailController {
  constructor(
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  @Get("templates")
  @ApiOperation({ summary: "List transactional email templates." })
  listTemplates(@Query() query: EmailTemplateQueryDto): Promise<unknown> {
    return this.notificationsService.listTemplates(query);
  }

  @Post("templates")
  @ApiOperation({ summary: "Create a transactional email template variant." })
  createTemplate(@CurrentUser() actor: RequestUser, @Body() dto: CreateEmailTemplateDto) {
    return this.notificationsService.createTemplate(actor, dto);
  }

  @Get("templates/:id")
  @ApiOperation({ summary: "Read one transactional email template." })
  getTemplate(@Param("id") id: string) {
    return this.notificationsService.getTemplate(id);
  }

  @Patch("templates/:id")
  @ApiOperation({ summary: "Update editable transactional email template fields." })
  updateTemplate(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(actor, id, dto);
  }

  @Get("triggers")
  @ApiOperation({ summary: "List transactional email trigger rules." })
  listTriggers() {
    return this.notificationsService.listTriggers();
  }

  @Get("overview")
  @ApiOperation({ summary: "Read transactional email workspace health and delivery summary." })
  overview() {
    return this.notificationsService.getEmailOperationsOverview();
  }

  @Patch("triggers/:id")
  @ApiOperation({ summary: "Update a transactional email trigger rule." })
  updateTrigger(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmailTriggerRuleDto,
  ) {
    return this.notificationsService.updateTrigger(actor, id, dto);
  }

  @Get("themes")
  @ApiOperation({ summary: "List reusable transactional email themes." })
  listThemes() {
    return this.notificationsService.listThemes();
  }

  @Post("themes")
  @ApiOperation({ summary: "Create a reusable transactional email theme." })
  createTheme(@CurrentUser() actor: RequestUser, @Body() dto: CreateEmailThemeDto) {
    return this.notificationsService.createTheme(actor, dto);
  }

  @Get("themes/:id")
  @ApiOperation({ summary: "Read one transactional email theme." })
  getTheme(@Param("id") id: string) {
    return this.notificationsService.getTheme(id);
  }

  @Patch("themes/:id")
  @ApiOperation({ summary: "Update editable transactional email theme fields." })
  updateTheme(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmailThemeDto,
  ) {
    return this.notificationsService.updateTheme(actor, id, dto);
  }

  @Get("settings/current")
  @ApiOperation({ summary: "Read current transactional email sender setting." })
  getEmailSetting() {
    return this.settingsService.getEmailSetting();
  }

  @Put("settings/current")
  @ApiOperation({ summary: "Update current transactional email sender setting." })
  upsertEmailSetting(@CurrentUser() actor: RequestUser, @Body() dto: UpsertEmailSettingDto) {
    return this.settingsService.upsertEmailSetting(actor, dto);
  }

  @Get("logs")
  @ApiOperation({ summary: "List transactional email logs." })
  listLogs(@Query() query: NotificationQueryDto) {
    return this.notificationsService.listLogs(query);
  }

  @Post("logs/:logId/retry")
  @ApiOperation({ summary: "Retry a failed or skipped transactional email log." })
  retry(@CurrentUser() actor: RequestUser, @Param("logId") logId: string) {
    return this.notificationsService.retryLog(logId, actor);
  }
}
