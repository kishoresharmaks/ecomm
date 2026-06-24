import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode } from "@indihub/database";
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from "../auth.constants";
import { IndiHubRequest } from "../types/indihub-request";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<IndiHubRequest>();
    const matchedRoles = request.currentUser?.roles.filter((role: RoleCode) => requiredRoles.includes(role)) ?? [];
    const hasRole = !requiredRoles?.length || matchedRoles.length > 0;

    if (!hasRole) {
      throw new ForbiddenException("You do not have permission to access this resource.");
    }

    const backOfficeMatches = matchedRoles.filter((role) => this.isBackOfficeRole(role));
    const nonBackOfficeMatches = matchedRoles.filter((role) => !this.isBackOfficeRole(role));
    if (backOfficeMatches.length && !nonBackOfficeMatches.length && request.currentUser?.authProvider !== "ADMIN_SESSION") {
      throw new ForbiddenException("Standalone back-office sign in is required.");
    }

    if (requiredPermissions?.length) {
      const permissions = new Set(request.currentUser?.permissions ?? []);
      const hasPermission = requiredPermissions.every((permission) => permissions.has(permission));
      if (!hasPermission) {
        throw new ForbiddenException("You do not have permission to access this resource.");
      }
    }

    return true;
  }

  private isBackOfficeRole(role: RoleCode) {
    return role === RoleCode.ADMIN || role === RoleCode.FINANCE || role === RoleCode.COURIER_MANAGER || role === RoleCode.CHAT_SUPPORT;
  }
}
