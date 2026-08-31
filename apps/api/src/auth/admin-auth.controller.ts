import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import type { Response } from "express";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { Roles } from "./decorators/roles.decorator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminChangePasswordDto } from "./dto/admin-change-password.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import type { RequestUser } from "./types/indihub-request";

type AdminAuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
};

@ApiTags("Admin Auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Sign in to the standalone admin portal." })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() request: AdminAuthRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, ...session } = await this.adminAuthService.login(dto, {
      userAgent: readHeader(request, "user-agent"),
      ipAddress: request.ip ?? readHeader(request, "x-forwarded-for"),
    });
    response.cookie("indihub_admin_session", token, {
      ...adminSessionCookieOptions(),
      expires: new Date(session.expiresAt),
    });
    return session;
  }

  @Post("logout")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE, RoleCode.COURIER_MANAGER, RoleCode.CHAT_SUPPORT)
  @ApiOperation({ summary: "Revoke the current standalone admin session." })
  async logout(
    @Req() request: AdminAuthRequest,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() actor: RequestUser,
  ) {
    const result = await this.adminAuthService.logout(this.adminAuthService.readRequestToken(request.headers), actor);
    response.clearCookie("indihub_admin_session", adminSessionCookieOptions());
    response.clearCookie("indihub_seller_impersonation", { path: "/" });
    return result;
  }

  @Get("me")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE, RoleCode.COURIER_MANAGER, RoleCode.CHAT_SUPPORT)
  @ApiOperation({ summary: "Read the current standalone admin session user." })
  me(@CurrentUser() actor: RequestUser) {
    return this.adminAuthService.me(actor);
  }

  @Post("change-password")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE, RoleCode.COURIER_MANAGER, RoleCode.CHAT_SUPPORT)
  @ApiOperation({ summary: "Change the current standalone back-office password." })
  changePassword(
    @Req() request: AdminAuthRequest,
    @CurrentUser() actor: RequestUser,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.adminAuthService.changePassword(this.adminAuthService.readRequestToken(request.headers), actor, dto);
  }
}

function readHeader(request: AdminAuthRequest, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function adminSessionCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.INDIHUB_PRODUCTION === "true" ||
    process.env.INDIHUB_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
}
