import { Body, Controller, Get, Headers, Inject, Post, Req } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { Roles } from "./decorators/roles.decorator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import type { RequestUser } from "./types/indihub-request";

@ApiTags("Admin Auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Sign in to the standalone admin portal." })
  login(@Body() dto: AdminLoginDto, @Req() request: { headers?: Record<string, string | string[] | undefined>; ip?: string }) {
    return this.adminAuthService.login(dto, {
      userAgent: readHeader(request, "user-agent"),
      ipAddress: request.ip ?? readHeader(request, "x-forwarded-for")
    });
  }

  @Post("logout")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiHeader({ name: "Authorization", required: true })
  @ApiOperation({ summary: "Revoke the current standalone admin session." })
  logout(@Headers("authorization") authorizationHeader: string | undefined, @CurrentUser() actor: RequestUser) {
    return this.adminAuthService.logout(authorizationHeader, actor);
  }

  @Get("me")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Read the current standalone admin session user." })
  me(@CurrentUser() actor: RequestUser) {
    return this.adminAuthService.me(actor);
  }
}

function readHeader(request: { headers?: Record<string, string | string[] | undefined> }, name: string) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
