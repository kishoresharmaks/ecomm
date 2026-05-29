import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SettingsModule } from "../settings/settings.module";
import { AdminEmailController } from "./admin-email.controller";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { EmailDeliveryService } from "./email-delivery.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [AdminNotificationsController, AdminEmailController],
  providers: [NotificationsService, NotificationQueueService, EmailDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
