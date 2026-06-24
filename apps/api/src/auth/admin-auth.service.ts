import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, RoleCode, UserStatus } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { AdminLoginDto } from "./dto/admin-login.dto";
import type { RequestUser } from "./types/indihub-request";

const adminTokenPrefix = "ih_admin_";
const maxFailedAttempts = 5;
const lockMinutes = 15;

type LoginMeta = {
  userAgent?: string | null | undefined;
  ipAddress?: string | null | undefined;
};

type UserWithRoles = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

const backOfficeRoleCodes = new Set<RoleCode>([
  RoleCode.ADMIN,
  RoleCode.FINANCE,
  RoleCode.COURIER_MANAGER,
  RoleCode.CHAT_SUPPORT,
]);

@Injectable()
export class AdminAuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(dto: AdminLoginDto, meta: LoginMeta = {}) {
    const email = dto.email.trim().toLowerCase();
    let user = await this.findUserByEmail(email);

    if (!user) {
      user = await this.bootstrapFirstAdminFromEnv(email, dto.password);
    }

    if (!user || user.status === UserStatus.DISABLED || !this.hasBackOfficeRole(user)) {
      throw new UnauthorizedException("Invalid admin email or password.");
    }

    let credential = user.adminCredential;
    if (!credential) {
      credential = await this.createCredentialFromEnvIfAllowed(user.id, email, dto.password);
    }

    if (!credential) {
      throw new UnauthorizedException("Admin password is not configured for this account.");
    }

    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new UnauthorizedException("Admin account is temporarily locked. Try again later.");
    }

    const passwordValid = await verifyAdminPassword(dto.password, credential.passwordSalt, credential.passwordHash);

    if (!passwordValid) {
      await this.recordFailedLogin(credential.id, user.id, meta);
      throw new UnauthorizedException("Invalid admin email or password.");
    }

    const token = `${adminTokenPrefix}${randomBytes(32).toString("base64url")}`;
    const expiresAt = this.sessionExpiry();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminCredential.update({
        where: { id: credential.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      });
      await tx.adminSession.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt,
          userAgent: meta.userAgent ?? null,
          ipAddress: meta.ipAddress ?? null
        }
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "admin.auth.login",
          entityType: "admin_session",
          entityId: user.id,
          newValue: {
            expiresAt: expiresAt.toISOString(),
            ipAddress: meta.ipAddress ?? null
          }
        }
      });
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: this.toRequestUser(user)
    };
  }

  async resolveAuthorizationHeader(authorizationHeader: string | undefined): Promise<RequestUser | null> {
    const token = this.readBearerToken(authorizationHeader);
    if (!token) {
      return null;
    }

    if (!token.startsWith(adminTokenPrefix)) {
      return null;
    }

    const session = await this.prisma.client.adminSession.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: {
          include: {
            userRoles: {
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
            }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Admin session has expired. Sign in again.");
    }

    if (session.user.status === UserStatus.DISABLED || !this.hasBackOfficeRole(session.user)) {
      throw new UnauthorizedException("Back-office access is not available for this account.");
    }

    await this.prisma.client.adminSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    });

    return this.toRequestUser(session.user);
  }

  async logout(authorizationHeader: string | undefined, actor?: RequestUser) {
    const token = this.readBearerToken(authorizationHeader);

    if (!token?.startsWith(adminTokenPrefix)) {
      return { loggedOut: false };
    }

    const session = await this.prisma.client.adminSession.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    if (actor?.id) {
      await this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "admin.auth.logout",
          entityType: "admin_session",
          entityId: actor.id
        }
      });
    }

    return { loggedOut: session.count > 0 };
  }

  async me(actor: RequestUser) {
    return actor;
  }

  private async findUserByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email },
      include: {
        adminCredential: true,
        userRoles: {
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
        }
      }
    });
  }

  private async bootstrapFirstAdminFromEnv(email: string, password: string) {
    const firstAdminEmail = process.env.INDIHUB_FIRST_ADMIN_EMAIL?.trim().toLowerCase();
    const firstAdminPassword = process.env.INDIHUB_FIRST_ADMIN_PASSWORD;

    if (!firstAdminEmail || !firstAdminPassword || email !== firstAdminEmail || password !== firstAdminPassword) {
      return null;
    }

    const hashed = await hashAdminPassword(password);
    const adminRole = await this.prisma.client.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: {
        code: RoleCode.ADMIN,
        name: "Admin",
        description: "Platform admin and operations team."
      }
    });

    const user = await this.prisma.client.user.upsert({
      where: { email },
      update: {
        fullName: process.env.INDIHUB_FIRST_ADMIN_NAME ?? "1HandIndia Admin",
        status: UserStatus.ACTIVE
      },
      create: {
        email,
        fullName: process.env.INDIHUB_FIRST_ADMIN_NAME ?? "1HandIndia Admin",
        status: UserStatus.ACTIVE
      }
    });

    await this.prisma.client.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: adminRole.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: adminRole.id
      }
    });

    await this.prisma.client.adminCredential.upsert({
      where: { userId: user.id },
      update: {
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt",
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      },
      create: {
        userId: user.id,
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt"
      }
    });

    return this.findUserByEmail(email);
  }

  private async createCredentialFromEnvIfAllowed(userId: string, email: string, password: string) {
    const firstAdminEmail = process.env.INDIHUB_FIRST_ADMIN_EMAIL?.trim().toLowerCase();
    const firstAdminPassword = process.env.INDIHUB_FIRST_ADMIN_PASSWORD;

    if (!firstAdminEmail || !firstAdminPassword || email !== firstAdminEmail || password !== firstAdminPassword) {
      return null;
    }

    const hashed = await hashAdminPassword(password);
    return this.prisma.client.adminCredential.create({
      data: {
        userId,
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt"
      }
    });
  }

  private async recordFailedLogin(credentialId: string, userId: string, meta: LoginMeta) {
    const credential = await this.prisma.client.adminCredential.update({
      where: { id: credentialId },
      data: {
        failedLoginCount: {
          increment: 1
        }
      }
    });

    if (credential.failedLoginCount >= maxFailedAttempts) {
      await this.prisma.client.adminCredential.update({
        where: { id: credentialId },
        data: {
          lockedUntil: new Date(Date.now() + lockMinutes * 60_000)
        }
      });
    }

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: userId,
        action: "admin.auth.login_failed",
        entityType: "admin_credential",
        entityId: userId,
        newValue: {
          failedLoginCount: credential.failedLoginCount,
          ipAddress: meta.ipAddress ?? null
        }
      }
    });
  }

  private readBearerToken(authorizationHeader: string | undefined) {
    const [scheme, token] = authorizationHeader?.split(" ") ?? [];
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private sessionExpiry() {
    const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 8);
    const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 8;
    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private hasBackOfficeRole(user: UserWithRoles) {
    return user.userRoles.some((userRole) =>
      backOfficeRoleCodes.has(userRole.role.code),
    );
  }

  private toRequestUser(user: UserWithRoles): RequestUser {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.code as RoleCode),
      permissions: uniquePermissions(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
        )
      ),
      authProvider: "ADMIN_SESSION"
    };
  }
}

function uniquePermissions(values: string[]) {
  return Array.from(new Set(values));
}
