import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SettingsModule } from "../settings/settings.module";
import { AdminEmailController } from "./admin-email.controller";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminPushCampaignsController } from "./admin-push-campaigns.controller";
import { EmailDeliveryService } from "./email-delivery.service";
import { ExpoPushService } from "./expo-push.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationsService } from "./notifications.service";
import { PushCampaignsService } from "./push-campaigns.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [PrismaModule, SettingsModule, StorageModule],
  controllers: [AdminNotificationsController, AdminEmailController, AdminPushCampaignsController],
  providers: [NotificationsService, NotificationQueueService, EmailDeliveryService, ExpoPushService, PushCampaignsService],
  exports: [NotificationsService, ExpoPushService],
})
export class NotificationsModule {}
