import { Body, Controller, Header, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { Public } from "./decorators/public.decorator";
import { ClerkAuthService } from "./clerk-auth.service";
import { SyncCurrentUserDto } from "./dto/sync-current-user.dto";
import { SyncAuthUserDto } from "./dto/sync-auth-user.dto";
import { AuthUsersService } from "./auth-users.service";
import { encryptForBearerSession } from "../common/encrypted-response";

@ApiTags("Auth")
@Controller("auth")
export class AuthSyncController {
  constructor(
    @Inject(AuthUsersService) private readonly authUsersService: AuthUsersService,
    @Inject(ClerkAuthService) private readonly clerkAuthService: ClerkAuthService
  ) {}

  @Public()
  @Post("sync-user")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Sync a Clerk-authenticated user into 1HandIndia RBAC records." })
  @ApiHeader({ name: "x-indihub-sync-secret", required: true })
  syncUser(@Headers("x-indihub-sync-secret") syncSecret: string | undefined, @Body() dto: SyncAuthUserDto) {
    const expectedSecret = process.env.INDIHUB_AUTH_SYNC_SECRET ?? process.env.CLERK_WEBHOOK_SECRET;

    if (!expectedSecret || syncSecret !== expectedSecret) {
      throw new UnauthorizedException("Valid 1HandIndia auth sync secret is required.");
    }

    return this.authUsersService.syncAuthUser(dto);
  }

  @Public()
  @Post("sync-current-user")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Sync the current Clerk session user into 1HandIndia RBAC records." })
  @ApiHeader({ name: "Authorization", required: true })
  async syncCurrentUser(
    @Headers("authorization") authorizationHeader: string | undefined,
    @Headers("x-indihub-accept-encrypted-response") acceptEncryptedResponse: string | undefined,
    @Body() dto: SyncCurrentUserDto
  ) {
    const profile = await this.clerkAuthService.resolveSessionProfile(authorizationHeader, {
      ...dto,
      defaultRole: RoleCode.CUSTOMER
    });
    const response = await this.authUsersService.syncAuthUser(profile);
    return encryptForBearerSession(authorizationHeader, response, acceptEncryptedResponse);
  }
}
