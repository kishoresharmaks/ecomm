import { Inject, Injectable } from "@nestjs/common";
import { ApprovalStatus, OrderStatus } from "@indihub/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminDashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary() {
    const [customers, pendingSellers, pendingProducts, orders, b2bEnquiries] =
      await this.prisma.client.$transaction(async (tx) => {
        const customers = await tx.customer.count();
        const pendingSellers = await tx.seller.count({
          where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL }
        });
        const pendingProducts = await tx.product.count({
          where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL }
        });
        const orders = await tx.order.count({
          where: { orderStatus: { not: OrderStatus.CANCELLED } }
        });
        const b2bEnquiries = await tx.b2BEnquiry.count();

        return [customers, pendingSellers, pendingProducts, orders, b2bEnquiries] as const;
      });

    return {
      customers,
      pendingSellers,
      pendingProducts,
      activeOrders: orders,
      b2bEnquiries
    };
  }
}
