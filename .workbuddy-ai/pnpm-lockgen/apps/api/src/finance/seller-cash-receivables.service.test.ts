import { describe, expect, it, vi } from "vitest";
import { RoleCode, SellerCashReceivableStatus } from "@indihub/database";
import type { PrismaService } from "../prisma/prisma.service";
import type { FinanceCalculatorService } from "./finance-calculator.service";
import type { SellerLedgerService } from "./seller-ledger.service";
import { SellerCashReceivablesService } from "./seller-cash-receivables.service";

describe("SellerCashReceivablesService", () => {
  it("allocates buyer platform fee across seller splits without paise drift", () => {
    const service = new SellerCashReceivablesService(
      {} as PrismaService,
      {} as FinanceCalculatorService,
      {} as SellerLedgerService,
    );
    const order = {
      subtotalPaise: 3,
      platformFeePaise: 1,
      sellerSplits: [
        { id: "split-1", sellerSubtotalPaise: 1 },
        { id: "split-2", sellerSubtotalPaise: 1 },
        { id: "split-3", sellerSubtotalPaise: 1 },
      ],
    };

    const expected = order.sellerSplits.map((split) =>
      service.expectedSellerCashPaise(order, split, null),
    );

    expect(expected).toEqual([2, 1, 1]);
    expect(expected.reduce((sum, amount) => sum + amount, 0)).toBe(4);
  });

  it("blocks manual settlement while a receivable is already scheduled against a payout", async () => {
    const tx = {
      sellerCashReceivable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "scr-1",
          receivableNumber: "SCR-1",
          status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
          outstandingPaise: 500,
        }),
      },
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
      },
    } as unknown as PrismaService;
    const service = new SellerCashReceivablesService(
      prisma,
      {} as FinanceCalculatorService,
      {} as SellerLedgerService,
    );

    await expect(
      service.settleReceivable(
        "SCR-1",
        { amountPaise: 500 },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      ),
    ).rejects.toThrow("already scheduled against a payout");
  });

  it("blocks waiver while a receivable is already scheduled against a payout", async () => {
    const tx = {
      sellerCashReceivable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "scr-1",
          receivableNumber: "SCR-1",
          status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
          outstandingPaise: 500,
        }),
      },
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
      },
    } as unknown as PrismaService;
    const service = new SellerCashReceivablesService(
      prisma,
      {} as FinanceCalculatorService,
      {} as SellerLedgerService,
    );

    await expect(
      service.waiveReceivable(
        "SCR-1",
        { amountPaise: 500, note: "Already scheduled." },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      ),
    ).rejects.toThrow("already scheduled against a payout");
  });

  it("blocks manual settlement while a partially offset receivable is still linked to a payout", async () => {
    const tx = {
      sellerCashReceivable: {
        findUnique: vi.fn().mockResolvedValue({
          id: "scr-1",
          receivableNumber: "SCR-1",
          status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
          payoutOffsetId: "payout-1",
          outstandingPaise: 500,
        }),
      },
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
      },
    } as unknown as PrismaService;
    const service = new SellerCashReceivablesService(
      prisma,
      {} as FinanceCalculatorService,
      {} as SellerLedgerService,
    );

    await expect(
      service.settleReceivable(
        "SCR-1",
        { amountPaise: 500 },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      ),
    ).rejects.toThrow("already linked to a payout");
  });
});
