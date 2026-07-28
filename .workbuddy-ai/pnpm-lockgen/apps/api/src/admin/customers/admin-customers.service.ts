import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import type { RequestUser } from "../../auth/types/indihub-request";
import { paginationFromQuery } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminCustomerQueryDto, UpdateCustomerStatusDto } from "./dto/admin-customer.dto";

const customerInclude = {
  user: true,
  addresses: true,
  wishlist: {
    include: {
      items: {
        include: { product: true }
      }
    }
  },
  orders: {
    orderBy: { createdAt: "desc" as const },
    take: 25
  }
};

@Injectable()
export class AdminCustomersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCustomers(query: AdminCustomerQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.CustomerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { user: { phone: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.customer.findMany({
        where,
        include: {
          user: true,
          _count: {
            select: {
              addresses: true,
              orders: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      });
      const total = await tx.customer.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async getCustomer(customerId: string) {
    return this.getCustomerOrThrow(customerId);
  }

  async updateCustomerStatus(actor: RequestUser, customerId: string, dto: UpdateCustomerStatusDto) {
    const existing = await this.getCustomerOrThrow(customerId);
    const customer = await this.prisma.client.customer.update({
      where: { id: customerId },
      data: {
        status: dto.status,
        user: {
          update: {
            status: dto.status
          }
        }
      },
      include: customerInclude
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.customer.status_updated",
        entityType: "customer",
        entityId: customer.id,
        oldValue: {
          status: existing.status
        },
        newValue: {
          status: customer.status,
          note: dto.note
        }
      }
    });

    return customer;
  }

  private async getCustomerOrThrow(customerId: string) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id: customerId },
      include: customerInclude
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    return customer;
  }
}
