import { Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("Admin Notifications")
@Roles(RoleCode.ADMIN)
@Controller("admin/notifications")
export class AdminNotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List notification logs." })
  listLogs(@Query() query: NotificationQueryDto) {
    return this.notificationsService.listLogs(query);
  }

  @Post(":logId/retry")
  @ApiOperation({ summary: "Retry a failed or skipped notification log." })
  retry(@CurrentUser() actor: RequestUser, @Param("logId") logId: string) {
    return this.notificationsService.retryLog(logId, actor);
  }
}
