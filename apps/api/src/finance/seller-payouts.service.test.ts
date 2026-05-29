import { describe, expect, it, vi } from "vitest";
import { ApprovalStatus, RoleCode, SellerOrderStatus, SellerPayoutStatus, SellerSettlementStatus, SellerStatus } from "@indihub/database";
import type { PrismaService } from "../prisma/prisma.service";
import type { FinanceCalculatorService } from "./finance-calculator.service";
import type { SellerLedgerService } from "./seller-ledger.service";
import { SellerPayoutsService } from "./seller-payouts.service";

describe("SellerPayoutsService seller requests", () => {
  it("creates a pending manual payout and locks eligible splits", async () => {
    const orderCreatedAt = new Date("2026-05-20T10:00:00.000Z");
    const split = {
      id: "split-1",
      sellerId: "seller-1",
      orderId: "order-1",
      sellerSubtotalPaise: 50_000,
      settlementEligibleAt: null,
      sellerStatus: SellerOrderStatus.PENDING,
      order: {
        id: "order-1",
        createdAt: orderCreatedAt,
        items: []
      }
    };
    const tx = {
      seller: {
        findUnique: vi.fn().mockResolvedValue({
          id: "seller-1",
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
          deletedAt: null,
          payoutProfile: {
            accountHolderName: "Seller One",
            bankName: null,
            accountNumber: null,
            ifscCode: null,
            upiId: "seller@upi"
          }
        })
      },
      setting: {
        findMany: vi.fn().mockResolvedValue([])
      },
      orderSellerSplit: {
        findMany: vi.fn().mockResolvedValue([split]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      sellerPayout: {
        create: vi.fn().mockResolvedValue({ id: "payout-1", payoutNumber: "PO-TEST" })
      },
      sellerPayoutEvent: {
        create: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
        sellerPayout: {
          findFirst: vi.fn().mockResolvedValue({ id: "payout-1", sellerId: "seller-1" })
        }
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
    const service = new SellerPayoutsService(prisma, calculator, {} as SellerLedgerService);

    await service.requestSellerPayout(
      "seller-1",
      { note: "Please pay manually." },
      { id: "user-1", clerkUserId: null, email: "seller@example.com", roles: [RoleCode.SELLER] }
    );

    expect(tx.sellerPayout.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: "seller-1",
        status: SellerPayoutStatus.PENDING_APPROVAL,
        grossSalesPaise: 50_000,
        commissionPaise: 5_000,
        netPayablePaise: 43_600,
        note: "Please pay manually."
      })
    });
    expect(tx.orderSellerSplit.updateMany).toHaveBeenCalledWith({
      where: { id: "split-1", payoutId: null },
      data: expect.objectContaining({
        payoutId: "payout-1",
        settlementStatus: SellerSettlementStatus.DRAFTED,
        netPayablePaise: 43_600
      })
    });
    expect(tx.sellerPayoutEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payoutId: "payout-1",
        eventType: "payout.requested_by_seller",
        newStatus: SellerPayoutStatus.PENDING_APPROVAL
      })
    });
  });
});
