import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { RoleCode, UserStatus } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "./types/indihub-request";

const impersonationTokenPrefix = "ih_impersonate_";
const defaultTtlMinutes = 30;

export type ImpersonationPayload = {
  sellerId: string;
  targetUserId: string;
  impersonatorAdminId: string;
  impersonatorEmail: string;
  sellerStoreName: string;
  issuedAt: number;
  expiresAt: number;
};

export type ImpersonateSessionResponse = {
  token: string;
  redirectUrl: string;
  expiresAt: string;
  sellerId: string;
  sellerStoreName: string;
  impersonatorEmail: string;
};

@Injectable()
export class AdminImpersonationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createImpersonationSession(
    sellerId: string,
    adminUser: RequestUser,
    meta: { ipAddress?: string | null | undefined; reason?: string | null | undefined } = {},
  ): Promise<ImpersonateSessionResponse> {
    const seller = await this.prisma.client.seller.findFirst({
      where: { id: sellerId, deletedAt: null },
      include: { user: true },
    });

    if (!seller) {
      throw new NotFoundException("Seller was not found or has been removed.");
    }

    if (seller.user.status === UserStatus.DISABLED) {
      throw new BadRequestException("Cannot impersonate a disabled user account.");
    }

    const issuedAt = Date.now();
    const ttlMs = defaultTtlMinutes * 60 * 1000;
    const expiresAt = issuedAt + ttlMs;

    const payload: ImpersonationPayload = {
      sellerId: seller.id,
      targetUserId: seller.userId,
      impersonatorAdminId: adminUser.id,
      impersonatorEmail: adminUser.email,
      sellerStoreName: seller.storeName,
      issuedAt,
      expiresAt,
    };

    const token = this.signPayload(payload);
    const expiresAtDate = new Date(expiresAt);

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: adminUser.id,
        action: "admin.seller.impersonate.start",
        entityType: "seller",
        entityId: seller.id,
        newValue: {
          sellerId: seller.id,
          sellerStoreName: seller.storeName,
          targetUserId: seller.userId,
          impersonatorAdminId: adminUser.id,
          impersonatorEmail: adminUser.email,
          reason: meta.reason ?? "Admin initiated seller impersonation session",
          ipAddress: meta.ipAddress ?? null,
          expiresAt: expiresAtDate.toISOString(),
        },
      },
    });

    return {
      token,
      redirectUrl: `/seller?ih_impersonate=${encodeURIComponent(token)}`,
      expiresAt: expiresAtDate.toISOString(),
      sellerId: seller.id,
      sellerStoreName: seller.storeName,
      impersonatorEmail: adminUser.email,
    };
  }

  async exitImpersonation(
    adminUser: RequestUser,
    sellerId?: string | null | undefined,
    meta: { ipAddress?: string | null | undefined } = {},
  ) {
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: adminUser.id,
        action: "admin.seller.impersonate.end",
        entityType: "seller",
        entityId: sellerId ?? adminUser.id,
        newValue: {
          impersonatorAdminId: adminUser.id,
          impersonatorEmail: adminUser.email,
          ipAddress: meta.ipAddress ?? null,
        },
      },
    });

    return { success: true };
  }

  async resolveRequestHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Promise<RequestUser | null> {
    const token = this.readRequestToken(headers);
    if (!token) {
      return null;
    }

    return this.resolveToken(token);
  }

  readRequestToken(headers: Record<string, string | string[] | undefined>): string | null {
    const directHeader = readHeader(headers, "x-indihub-impersonation-token");
    if (directHeader && directHeader.startsWith(impersonationTokenPrefix)) {
      return directHeader;
    }

    const bearerToken = readBearerToken(readHeader(headers, "authorization"));
    if (bearerToken && bearerToken.startsWith(impersonationTokenPrefix)) {
      return bearerToken;
    }

    return readCookieToken(readHeader(headers, "cookie"));
  }

  async resolveToken(token: string): Promise<RequestUser | null> {
    if (!token.startsWith(impersonationTokenPrefix)) {
      return null;
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    const user = await this.prisma.client.user.findFirst({
      where: { id: payload.targetUserId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status === UserStatus.DISABLED) {
      return null;
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code as RoleCode);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    );

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      roles,
      permissions,
      authProvider: "DEV",
      impersonatedBy: {
        id: payload.impersonatorAdminId,
        email: payload.impersonatorEmail,
      },
    };
  }

  private signPayload(payload: ImpersonationPayload): string {
    const dataString = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.calculateSignature(dataString);
    return `${impersonationTokenPrefix}${dataString}.${signature}`;
  }

  private verifyToken(token: string): ImpersonationPayload | null {
    try {
      const stripped = token.slice(impersonationTokenPrefix.length);
      const dotIndex = stripped.lastIndexOf(".");
      if (dotIndex <= 0) {
        return null;
      }

      const dataString = stripped.slice(0, dotIndex);
      const signature = stripped.slice(dotIndex + 1);

      const expectedSignature = this.calculateSignature(dataString);
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        return null;
      }

      const rawJson = Buffer.from(dataString, "base64url").toString("utf8");
      return JSON.parse(rawJson) as ImpersonationPayload;
    } catch {
      return null;
    }
  }

  private calculateSignature(dataString: string): string {
    const secret =
      process.env.ADMIN_SESSION_SECRET ||
      process.env.CLERK_SECRET_KEY ||
      process.env.DATABASE_URL ||
      "indihub_impersonation_secret_fallback_key_2026";
    return createHmac("sha256", secret).update(dataString).digest("base64url");
  }
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readBearerToken(authorizationHeader: string | undefined): string | null {
  const [scheme, token] = authorizationHeader?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function readCookieToken(cookieHeader: string | undefined): string | null {
  const cookie = cookieHeader
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("indihub_seller_impersonation="));
  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice("indihub_seller_impersonation=".length));
  } catch {
    return null;
  }
}
