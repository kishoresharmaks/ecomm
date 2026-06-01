import { describe, expect, it, vi } from "vitest";
import {
  OrderStatus,
  PaymentStatus,
  RoleCode,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus
} from "@indihub/database";
import type { PrismaService } from "../prisma/prisma.service";
import type { FinanceCalculatorService } from "./finance-calculator.service";
import { SellerSettlementsService } from "./seller-settlements.service";

describe("SellerSettlementsService concurrency guards", () => {
  it("blocks draft creation when an eligible split is claimed concurrently", async () => {
    const split = {
      id: "split-1",
      sellerId: "seller-1",
      orderId: "order-1",
      sellerSubtotalPaise: 50_000,
      settlementEligibleAt: null,
      sellerStatus: SellerOrderStatus.PENDING,
      order: {
        id: "order-1",
        createdAt: new Date("2026-05-20T10:00:00.000Z"),
        items: []
      }
    };
    const tx = {
      orderSellerSplit: {
        findMany: vi.fn().mockResolvedValue([split]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      sellerSettlementRun: {
        create: vi.fn().mockResolvedValue({ id: "run-1", runNumber: "SET-TEST" }),
        update: vi.fn()
      },
      sellerPayout: {
        create: vi.fn().mockResolvedValue({ id: "payout-1" })
      },
      auditLog: {
        create: vi.fn()
      }
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx))
      }
    } as unknown as PrismaService;
    const calculator = {
      calculateSplit: vi.fn().mockResolvedValue({
        grossSalesPaise: 50_000,
        commissionPaise: 5_000,
        gstOnCommissionPaise: 900,
        tdsPaise: 500,
        tcsPaise: 0,
        platformFeePaise: 0,
        refundAdjustmentPaise: 0,
        netPayablePaise: 43_600,
        snapshot: { calculationVersion: 1 }
      })
    } as unknown as FinanceCalculatorService;
    const service = new SellerSettlementsService(prisma, calculator);

    await expect(
      service.createDraft(
        { dateFrom: "2026-05-01", dateTo: "2026-05-31" },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
      )
    ).rejects.toThrow("Settlement eligibility changed");

    expect(tx.orderSellerSplit.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "split-1",
        payoutId: null,
        sellerStatus: { not: SellerOrderStatus.CANCELLED },
        settlementStatus: {
          in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE]
        },
        order: expect.objectContaining({
          orderStatus: OrderStatus.DELIVERED,
          paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] }
        })
      }),
      data: expect.objectContaining({
        payoutId: "payout-1",
        settlementStatus: SellerSettlementStatus.DRAFTED
      })
    });
  });

  it("blocks submit when one payout is no longer draft", async () => {
    const tx = {
      sellerSettlementRun: {
        findUnique: vi.fn().mockResolvedValue({
          id: "run-1",
          status: SellerPayoutStatus.DRAFT,
          payouts: [{ id: "payout-1" }, { id: "payout-2" }]
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      sellerPayout: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
        sellerSettlementRun: {
          findUnique: vi.fn()
        }
      }
    } as unknown as PrismaService;
    const service = new SellerSettlementsService(prisma, {} as FinanceCalculatorService);

    await expect(
      service.submitRun("run-1", {
        id: "admin-1",
        clerkUserId: null,
        email: "admin@example.com",
        roles: [RoleCode.ADMIN]
      })
    ).rejects.toThrow("Settlement payouts changed");
  });
});
