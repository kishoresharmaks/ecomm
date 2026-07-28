import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { RoleCode, UserStatus } from "@indihub/database";
import { hashAdminPassword } from "../../auth/admin-password";
import { PrismaService } from "../../prisma/prisma.service";
import { FirstAdminDto } from "./dto/first-admin.dto";

@Injectable()
export class AdminBootstrapService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createFirstAdmin(dto: FirstAdminDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const adminRole = await tx.role.upsert({
        where: { code: RoleCode.ADMIN },
        update: {
          name: "Admin",
          description: "Platform admin and operations team."
        },
        create: {
          code: RoleCode.ADMIN,
          name: "Admin",
          description: "Platform admin and operations team."
        }
      });

      const existingUser = await tx.user.findFirst({
        where: {
          email: dto.email
        }
      });

      const existingAdminCount = await tx.userRole.count({
        where: {
          roleId: adminRole.id,
          ...(existingUser ? { userId: { not: existingUser.id } } : {})
        }
      });

      if (existingAdminCount > 0) {
        throw new ConflictException("First admin is already configured. Add more admins from the admin users module.");
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              email: dto.email,
              phone: dto.phone ?? null,
              fullName: dto.fullName ?? "1HandIndia Admin",
              status: UserStatus.ACTIVE
            }
          })
        : await tx.user.create({
            data: {
              email: dto.email,
              phone: dto.phone ?? null,
              fullName: dto.fullName ?? "1HandIndia Admin",
              status: UserStatus.ACTIVE
            }
          });

      await tx.userRole.upsert({
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

      const hashed = await hashAdminPassword(dto.password);
      await tx.adminCredential.upsert({
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

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: user.id } },
          action: "admin.first_admin_bootstrapped",
          entityType: "user",
          entityId: user.id,
          newValue: {
            email: user.email,
            roleCode: RoleCode.ADMIN
          }
        }
      });

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: RoleCode.ADMIN
      };
    });
  }
}
