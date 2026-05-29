import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { AuditQueryDto } from "./dto/audit-query.dto";

type AuditRecordInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput) {
    try {
      await this.prisma.client.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          ...(input.entityId ? { entityId: input.entityId } : {}),
          ...(input.oldValue ? { oldValue: input.oldValue } : {}),
          ...(input.newValue ? { newValue: input.newValue } : {}),
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.actorUserId ? { actor: { connect: { id: input.actorUserId } } } : {})
        }
      });
    } catch (error) {
      this.logger.error("Failed to write audit log", error);
      throw error;
    }
  }

  async list(query: AuditQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 50 });
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip,
        take
      });
      const total = await tx.auditLog.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }
}
