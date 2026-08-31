import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AdminMfaType, Prisma, RoleCode, UserStatus } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateBase32Secret,
  generateMfaTicket,
  generateRecoveryCodes,
  generateTotpUri,
  hashRecoveryCode,
  verifyMfaTicket,
  verifyRecoveryCode,
  verifyTotpCode,
} from "./admin-mfa";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { AdminChangePasswordDto } from "./dto/admin-change-password.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";
import {
  AdminConfirmMfaDto,
  AdminDisableMfaDto,
  AdminRegenerateMfaCodesDto,
  AdminVerifyMfaDto,
} from "./dto/admin-mfa.dto";
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

    // If MFA is enabled, return ephemeral challenge ticket without creating full session
    if (credential.mfaEnabled && credential.mfaSecretEncrypted) {
      await this.prisma.client.adminCredential.update({
        where: { id: credential.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });

      const mfaTicket = generateMfaTicket(user.id, credential.id, 300);
      return {
        mfaRequired: true as const,
        mfaTicket,
        mfaType: credential.mfaType,
      };
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
      mfaRequired: false as const,
      token,
      expiresAt: expiresAt.toISOString(),
      user: this.toRequestUser(user)
    };
  }

  async verifyMfa(dto: AdminVerifyMfaDto, meta: LoginMeta = {}) {
    const verifiedTicket = verifyMfaTicket(dto.mfaTicket);
    if (!verifiedTicket) {
      throw new UnauthorizedException("MFA session has expired or is invalid. Please sign in again.");
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: verifiedTicket.userId },
      include: {
        adminCredential: {
          include: {
            recoveryCodes: true,
          },
        },
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

    if (!user || user.status === UserStatus.DISABLED || !this.hasBackOfficeRole(user)) {
      throw new UnauthorizedException("Back-office access is not available for this account.");
    }

    const credential = user.adminCredential;
    if (!credential || !credential.mfaEnabled || !credential.mfaSecretEncrypted) {
      throw new UnauthorizedException("MFA is not enabled for this account.");
    }

    if (credential.mfaLockedUntil && credential.mfaLockedUntil > new Date()) {
      throw new UnauthorizedException("Too many failed MFA attempts. Account is temporarily locked. Try again later.");
    }

    let mfaValid = false;
    let matchedRecoveryCodeId: string | null = null;

    if (dto.isRecoveryCode) {
      const unusedCodes = credential.recoveryCodes.filter((rc) => !rc.usedAt);
      for (const rc of unusedCodes) {
        if (verifyRecoveryCode(dto.code, rc.codeHash)) {
          mfaValid = true;
          matchedRecoveryCodeId = rc.id;
          break;
        }
      }
    } else {
      try {
        const secret = decryptMfaSecret(credential.mfaSecretEncrypted);
        mfaValid = verifyTotpCode(dto.code, secret, 1);
      } catch {
        mfaValid = false;
      }
    }

    if (!mfaValid) {
      const nextFailed = credential.failedMfaAttempts + 1;
      const lockedUntil = nextFailed >= maxFailedAttempts ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;
      await this.prisma.client.adminCredential.update({
        where: { id: credential.id },
        data: {
          failedMfaAttempts: nextFailed,
          mfaLockedUntil: lockedUntil,
        },
      });
      throw new UnauthorizedException(
        dto.isRecoveryCode
          ? "Invalid emergency recovery code."
          : "Invalid 6-digit authentication code.",
      );
    }

    const token = `${adminTokenPrefix}${randomBytes(32).toString("base64url")}`;
    const expiresAt = this.sessionExpiry();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminCredential.update({
        where: { id: credential.id },
        data: {
          failedMfaAttempts: 0,
          mfaLockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      if (matchedRecoveryCodeId) {
        await tx.adminMfaRecoveryCode.update({
          where: { id: matchedRecoveryCodeId },
          data: { usedAt: new Date() },
        });
      }

      await tx.adminSession.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt,
          userAgent: meta.userAgent ?? null,
          ipAddress: meta.ipAddress ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "admin.auth.mfa_login",
          entityType: "admin_session",
          entityId: user.id,
          newValue: {
            method: dto.isRecoveryCode ? "recovery_code" : "totp",
            expiresAt: expiresAt.toISOString(),
            ipAddress: meta.ipAddress ?? null,
          },
        },
      });
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: this.toRequestUser(user),
    };
  }

  async setupMfa(actor: RequestUser) {
    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
    });
    if (!credential) {
      throw new BadRequestException("Admin credential not found.");
    }

    const secret = generateBase32Secret(20);
    const otpauthUri = generateTotpUri(actor.email, secret, "1HandIndia");

    return {
      secret,
      otpauthUri,
    };
  }

  async confirmMfaSetup(actor: RequestUser, dto: AdminConfirmMfaDto) {
    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
    });
    if (!credential) {
      throw new BadRequestException("Admin credential not found.");
    }

    const valid = verifyTotpCode(dto.code, dto.secret, 1);
    if (!valid) {
      throw new BadRequestException("Invalid 6-digit verification code. Ensure your device time is synchronized.");
    }

    const encryptedSecret = encryptMfaSecret(dto.secret);
    const rawRecoveryCodes = generateRecoveryCodes(10);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminMfaRecoveryCode.deleteMany({
        where: { credentialId: credential.id },
      });

      for (const rawCode of rawRecoveryCodes) {
        await tx.adminMfaRecoveryCode.create({
          data: {
            credentialId: credential.id,
            codeHash: hashRecoveryCode(rawCode),
          },
        });
      }

      await tx.adminCredential.update({
        where: { id: credential.id },
        data: {
          mfaEnabled: true,
          mfaType: AdminMfaType.TOTP,
          mfaSecretEncrypted: encryptedSecret,
          failedMfaAttempts: 0,
          mfaLockedUntil: null,
          mfaEnforcedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "admin.auth.mfa_enabled",
          entityType: "admin_credential",
          entityId: credential.id,
          newValue: { mfaType: AdminMfaType.TOTP },
        },
      });
    });

    return {
      mfaEnabled: true,
      recoveryCodes: rawRecoveryCodes,
    };
  }

  async disableMfa(actor: RequestUser, dto: AdminDisableMfaDto) {
    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
      include: { recoveryCodes: true },
    });
    if (!credential || !credential.mfaEnabled || !credential.mfaSecretEncrypted) {
      throw new BadRequestException("MFA is not currently enabled for this account.");
    }

    const passwordValid = await verifyAdminPassword(
      dto.password,
      credential.passwordSalt,
      credential.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    let codeValid = false;
    try {
      const secret = decryptMfaSecret(credential.mfaSecretEncrypted);
      codeValid = verifyTotpCode(dto.code, secret, 1);
    } catch {
      codeValid = false;
    }

    if (!codeValid) {
      const unusedCodes = credential.recoveryCodes.filter((rc) => !rc.usedAt);
      for (const rc of unusedCodes) {
        if (verifyRecoveryCode(dto.code, rc.codeHash)) {
          codeValid = true;
          break;
        }
      }
    }

    if (!codeValid) {
      throw new UnauthorizedException("Invalid authentication code or recovery code.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminMfaRecoveryCode.deleteMany({
        where: { credentialId: credential.id },
      });

      await tx.adminCredential.update({
        where: { id: credential.id },
        data: {
          mfaEnabled: false,
          mfaType: AdminMfaType.NONE,
          mfaSecretEncrypted: null,
          failedMfaAttempts: 0,
          mfaLockedUntil: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "admin.auth.mfa_disabled",
          entityType: "admin_credential",
          entityId: credential.id,
        },
      });
    });

    return { mfaEnabled: false };
  }

  async regenerateRecoveryCodes(actor: RequestUser, dto: AdminRegenerateMfaCodesDto) {
    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
    });
    if (!credential || !credential.mfaEnabled || !credential.mfaSecretEncrypted) {
      throw new BadRequestException("MFA must be enabled to regenerate recovery codes.");
    }

    const passwordValid = await verifyAdminPassword(
      dto.password,
      credential.passwordSalt,
      credential.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const secret = decryptMfaSecret(credential.mfaSecretEncrypted);
    const codeValid = verifyTotpCode(dto.code, secret, 1);
    if (!codeValid) {
      throw new UnauthorizedException("Invalid authentication code.");
    }

    const rawCodes = generateRecoveryCodes(10);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminMfaRecoveryCode.deleteMany({
        where: { credentialId: credential.id },
      });

      for (const rawCode of rawCodes) {
        await tx.adminMfaRecoveryCode.create({
          data: {
            credentialId: credential.id,
            codeHash: hashRecoveryCode(rawCode),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "admin.auth.mfa_recovery_codes_regenerated",
          entityType: "admin_credential",
          entityId: credential.id,
        },
      });
    });

    return { recoveryCodes: rawCodes };
  }

  async getMfaStatus(actor: RequestUser) {
    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
      include: {
        recoveryCodes: {
          where: { usedAt: null },
        },
      },
    });

    if (!credential) {
      return {
        mfaEnabled: false,
        mfaType: AdminMfaType.NONE,
        remainingRecoveryCodes: 0,
      };
    }

    return {
      mfaEnabled: credential.mfaEnabled,
      mfaType: credential.mfaType,
      remainingRecoveryCodes: credential.recoveryCodes.length,
    };
  }

  async resolveAuthorizationHeader(authorizationHeader: string | undefined): Promise<RequestUser | null> {
    const token = this.readBearerToken(authorizationHeader);
    return this.resolveToken(token);
  }

  async resolveRequestHeaders(headers: Record<string, string | string[] | undefined>): Promise<RequestUser | null> {
    return this.resolveToken(this.readRequestToken(headers));
  }

  readRequestToken(headers: Record<string, string | string[] | undefined>) {
    const bearerToken = this.readBearerToken(readHeader(headers, "authorization"));
    return bearerToken ? (bearerToken.startsWith(adminTokenPrefix) ? bearerToken : null) : readCookieToken(readHeader(headers, "cookie"));
  }

  private async resolveToken(token: string | null): Promise<RequestUser | null> {
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

  async logout(token: string | null, actor?: RequestUser) {
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

  async changePassword(
    token: string | null,
    actor: RequestUser,
    dto: AdminChangePasswordDto,
  ) {
    if (!token?.startsWith(adminTokenPrefix)) {
      throw new UnauthorizedException("Admin session has expired. Sign in again.");
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException("New password must be different from current password.");
    }

    const credential = await this.prisma.client.adminCredential.findUnique({
      where: { userId: actor.id },
    });
    if (!credential) {
      throw new BadRequestException("Admin password is not configured for this account.");
    }

    const passwordValid = await verifyAdminPassword(
      dto.currentPassword,
      credential.passwordSalt,
      credential.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const hashed = await hashAdminPassword(dto.newPassword);
    const currentTokenHash = this.hashToken(token);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.adminCredential.update({
        where: { id: credential.id },
        data: {
          passwordHash: hashed.hash,
          passwordSalt: hashed.salt,
          passwordAlgorithm: "scrypt",
          passwordUpdatedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.adminSession.updateMany({
        where: {
          userId: actor.id,
          tokenHash: { not: currentTokenHash },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "admin.auth.password_changed",
          entityType: "admin_credential",
          entityId: credential.id,
          newValue: {
            otherSessionsRevoked: true,
          },
        },
      });
    });

    return { updated: true };
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

function readHeader(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readCookieToken(cookieHeader: string | undefined) {
  const cookie = cookieHeader
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("indihub_admin_session="));
  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice("indihub_admin_session=".length));
  } catch {
    return null;
  }
}
