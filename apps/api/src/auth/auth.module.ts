import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AuthSyncController } from "./auth-sync.controller";
import { AuthUsersService } from "./auth-users.service";
import { ClerkAuthService } from "./clerk-auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [NotificationsModule],
  controllers: [AuthSyncController, AdminAuthController],
  providers: [
    AdminAuthService,
    ClerkAuthService,
    AuthUsersService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ],
  exports: [AuthUsersService, ClerkAuthService, AdminAuthService]
})
export class AuthModule {}
