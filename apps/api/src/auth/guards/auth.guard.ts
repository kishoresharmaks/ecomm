import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@indihub/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminAuthService } from "../admin-auth.service";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../auth.constants";
import { ClerkAuthService } from "../clerk-auth.service";
import { IndiHubRequest } from "../types/indihub-request";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService,
    @Inject(ClerkAuthService) private readonly clerkAuthService: ClerkAuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const request = context.switchToHttp().getRequest<IndiHubRequest>();
    const authorizationHeader = this.readHeader(request, "authorization");
    const adminUser = await this.adminAuthService.resolveAuthorizationHeader(authorizationHeader);

    if (adminUser) {
      request.currentUser = adminUser;
      return true;
    }

    if (this.requiresStandaloneBackOffice(requiredRoles)) {
      throw new UnauthorizedException("Standalone back-office sign in is required.");
    }

    const clerkUserId = await this.resolveClerkUserId(request);
    const platformUserId = this.allowDevAuth() ? this.readHeader(request, "x-indihub-user-id") : undefined;

    if (!clerkUserId && !platformUserId) {
      throw new UnauthorizedException("Authentication is required.");
    }

    const userWhere = clerkUserId ? { clerkUserId } : { id: platformUserId as string };
    const user = await this.prisma.client.user.findFirst({
      where: userWhere
    });

    if (!user) {
      throw new UnauthorizedException("Authenticated user is not mapped to 1HandIndia.");
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException("User account is disabled.");
    }

    const userRoles = await this.prisma.client.userRole.findMany({
      where: {
        userId: user.id
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    request.currentUser = {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      roles: userRoles.map((userRole) => userRole.role.code as RoleCode),
      permissions: uniquePermissions(
        userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
        )
      ),
      authProvider: clerkUserId ? "CLERK" : "DEV"
    };

    return true;
  }

  private requiresStandaloneBackOffice(requiredRoles: RoleCode[] | undefined) {
    return Boolean(requiredRoles?.length && requiredRoles.every((role) => this.isBackOfficeRole(role)));
  }

  private isBackOfficeRole(role: RoleCode) {
    return role === RoleCode.ADMIN || role === RoleCode.FINANCE || role === RoleCode.COURIER_MANAGER;
  }

  private async resolveClerkUserId(request: IndiHubRequest) {
    const authorizationHeader = this.readHeader(request, "authorization");
    if (authorizationHeader) {
      return this.clerkAuthService.verifyAuthorizationHeader(authorizationHeader);
    }

    if (!this.allowDevAuth()) {
      return undefined;
    }

    return this.readHeader(request, "x-clerk-user-id") ?? this.readHeader(request, "x-indihub-dev-clerk-id");
  }

  private allowDevAuth() {
    return process.env.NODE_ENV !== "production" || process.env.INDIHUB_ALLOW_DEV_AUTH === "true";
  }

  private readHeader(request: IndiHubRequest, name: string) {
    const value = request.headers[name];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
}

function uniquePermissions(values: string[]) {
  return Array.from(new Set(values));
}
