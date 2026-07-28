import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
} from "../common/pagination";
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

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query, { defaultLimit: 50 });
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.AuditLogWhereInput | undefined;
      const items = await this.prisma.client.auditLog.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              phone: true,
              fullName: true,
              status: true
            }
          }
        },
        orderBy: createdAtCursorOrderBy(),
        take: take + 1
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 50 });
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              phone: true,
              fullName: true,
              status: true
            }
          }
        },
        orderBy: createdAtCursorOrderBy(),
        skip,
        take
      });
      const total = await tx.auditLog.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }
}
