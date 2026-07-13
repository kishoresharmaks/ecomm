import { describe, expect, it, vi } from "vitest";
import {
  ApprovalStatus,
  OrderStatus,
  PaymentStatus,
  RoleCode,
  SellerCashReceivableStatus,
  SellerLedgerEntryType,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerSettlementStatus,
  SellerStatus,
} from "@indihub/database";
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
      b2BOrder: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { sellerPayoutAmountPaise: 0 }
        })
      },
      serviceBookingSettlement: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { netPayablePaise: 0 }
        })
      },
      serviceSellerReceivable: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        })
      },
      sellerCashReceivable: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        })
      },
      sellerLedgerEntry: {
        findMany: vi.fn().mockResolvedValue([])
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
      where: {
        id: "split-1",
        sellerId: "seller-1",
        payoutId: null,
        sellerStatus: { not: SellerOrderStatus.CANCELLED },
        settlementStatus: {
          in: [SellerSettlementStatus.NOT_ELIGIBLE, SellerSettlementStatus.ELIGIBLE]
        },
        order: {
          orderStatus: OrderStatus.DELIVERED,
          paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] }
        },
        sellerCashReceivables: {
          none: {
            status: { not: "CANCELLED" }
          }
        }
      },
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

  it("blocks duplicate payout approval when the status changed concurrently", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payout-1",
          status: SellerPayoutStatus.PENDING_APPROVAL,
          netPayablePaise: 43_600,
          note: null,
          seller: { payoutProfile: { isVerified: true } }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      orderSellerSplit: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { netPayablePaise: 43_600 }
        })
      },
      b2BOrder: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { sellerPayoutAmountPaise: 0 }
        })
      },
      serviceBookingSettlement: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { netPayablePaise: 0 }
        }),
        updateMany: vi.fn()
      },
      serviceSellerReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        }),
        findMany: vi.fn().mockResolvedValue([])
      },
      sellerCashReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        }),
        findMany: vi.fn().mockResolvedValue([])
      },
      sellerLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { creditPaise: 0, debitPaise: 0 }
        })
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
    const ledger = {
      postPayoutApprovalEntries: vi.fn()
    } as unknown as SellerLedgerService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, ledger);

    await expect(
      service.approvePayout(
        "payout-1",
        { note: "Approve once." },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
      )
    ).rejects.toThrow("Payout status changed");

    expect(ledger.postPayoutApprovalEntries).not.toHaveBeenCalled();
  });

  it("blocks payout approval until seller payout details are verified", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payout-1",
          status: SellerPayoutStatus.PENDING_APPROVAL,
          netPayablePaise: 43_600,
          note: null,
          seller: { payoutProfile: { isVerified: false } }
        }),
        updateMany: vi.fn()
      },
      orderSellerSplit: {
        aggregate: vi.fn()
      },
      b2BOrder: {
        aggregate: vi.fn()
      },
      serviceBookingSettlement: {
        aggregate: vi.fn()
      },
      serviceSellerReceivable: {
        aggregate: vi.fn()
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
    const ledger = {
      postPayoutApprovalEntries: vi.fn()
    } as unknown as SellerLedgerService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, ledger);

    await expect(
      service.approvePayout(
        "payout-1",
        { note: "Approve after verification." },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
      )
    ).rejects.toThrow("Seller payout details must be verified");

    expect(tx.orderSellerSplit.aggregate).not.toHaveBeenCalled();
    expect(tx.sellerPayout.updateMany).not.toHaveBeenCalled();
    expect(ledger.postPayoutApprovalEntries).not.toHaveBeenCalled();
  });

  it("restores a previously partial seller-cash receivable when a scheduled payout is rejected", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payout-1",
          status: SellerPayoutStatus.PENDING_APPROVAL,
          note: null,
          settlementRunId: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderSellerSplit: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      b2BOrder: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      serviceBookingSettlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      serviceSellerReceivable: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      sellerCashReceivable: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      sellerLedgerEntry: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      sellerPayoutEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
        sellerPayout: {
          findFirst: vi.fn().mockResolvedValue({ id: "payout-1", sellerId: "seller-1" }),
        },
      },
    } as unknown as PrismaService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, {} as SellerLedgerService);

    await service.rejectPayout(
      "payout-1",
      { note: "Reject scheduled offset." },
      { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
    );

    expect(tx.sellerCashReceivable.updateMany).toHaveBeenCalledWith({
      where: {
        payoutOffsetId: "payout-1",
        status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
        OR: [
          { settledPaise: { gt: 0 } },
          { waivedPaise: { gt: 0 } },
          { offsetAppliedAt: { not: null } },
          { ledgerEntries: { some: { entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET } } },
        ],
      },
      data: {
        payoutOffsetId: null,
        offsetPaise: 0,
        offsetScheduledAt: null,
        offsetAppliedAt: null,
        status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
      },
    });
    expect(tx.sellerCashReceivable.updateMany).toHaveBeenCalledWith({
      where: {
        payoutOffsetId: "payout-1",
        status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
      },
      data: {
        payoutOffsetId: null,
        offsetPaise: 0,
        offsetScheduledAt: null,
        offsetAppliedAt: null,
        status: SellerCashReceivableStatus.OPEN,
      },
    });
  });

  it("keeps payout link after a partial seller-cash receivable offset until the payout is paid", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({
            id: "payout-1",
            payoutNumber: "PO-1",
            status: SellerPayoutStatus.PENDING_APPROVAL,
            netPayablePaise: 0,
            note: null,
            settlementRunId: null,
            seller: { payoutProfile: { isVerified: true } }
          })
          .mockResolvedValueOnce({
            id: "payout-1",
            sellerId: "seller-1",
            payoutNumber: "PO-1"
          })
          .mockResolvedValueOnce({
            id: "payout-1",
            sellerId: "seller-1",
            payoutNumber: "PO-1"
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      orderSellerSplit: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { netPayablePaise: 500 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      b2BOrder: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { sellerPayoutAmountPaise: 0 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      serviceBookingSettlement: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { netPayablePaise: 0 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      serviceSellerReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        }),
        findMany: vi.fn().mockResolvedValue([])
      },
      sellerCashReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { offsetPaise: 500 }
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "scr-1",
            sellerId: "seller-1",
            orderId: "order-1",
            orderSellerSplitId: "split-1",
            receivableNumber: "SCR-1",
            status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
            outstandingPaise: 1_000,
            offsetPaise: 500,
            currency: "INR"
          }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      sellerLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { creditPaise: 0, debitPaise: 0 }
        }),
        findFirst: vi.fn().mockResolvedValue(null)
      },
      sellerCashReceivableEvent: {
        create: vi.fn().mockResolvedValue({})
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
    const ledger = {
      postPayoutApprovalEntries: vi.fn(),
      createEntry: vi.fn().mockResolvedValue({})
    } as unknown as SellerLedgerService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, ledger);

    await service.approvePayout(
      "payout-1",
      { note: "Approve offset." },
      { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
    );

    expect(tx.sellerCashReceivable.updateMany).toHaveBeenCalledWith({
      where: {
        id: "scr-1",
        payoutOffsetId: "payout-1",
        status: SellerCashReceivableStatus.OFFSET_SCHEDULED,
      },
      data: expect.objectContaining({
        status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
        outstandingPaise: 500,
      }),
    });
    expect(tx.sellerCashReceivable.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ payoutOffsetId: null }),
      }),
    );
  });

  it("releases partially offset seller-cash receivables after payout is marked paid", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payout-1",
          status: SellerPayoutStatus.APPROVED,
          netPayablePaise: 0,
          note: null,
          settlementRunId: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      orderSellerSplit: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { netPayablePaise: 500 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      b2BOrder: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { sellerPayoutAmountPaise: 0 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      serviceBookingSettlement: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { netPayablePaise: 0 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      serviceSellerReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        })
      },
      sellerCashReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { offsetPaise: 500 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      sellerLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { creditPaise: 0, debitPaise: 0 }
        })
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
    const ledger = {
      postPayoutPaidEntry: vi.fn().mockResolvedValue({})
    } as unknown as SellerLedgerService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, ledger);

    await service.markPaid(
      "payout-1",
      { paymentMode: "BANK_TRANSFER", transactionReference: "UTR-1" },
      { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
    );

    expect(tx.sellerCashReceivable.updateMany).toHaveBeenCalledWith({
      where: {
        payoutOffsetId: "payout-1",
        status: SellerCashReceivableStatus.PARTIALLY_OFFSET,
        outstandingPaise: { gt: 0 },
      },
      data: {
        payoutOffsetId: null,
        offsetPaise: 0,
        offsetScheduledAt: null,
      },
    });
  });

  it("blocks marking a payout paid when linked split state changed concurrently", async () => {
    const tx = {
      sellerPayout: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payout-1",
          status: SellerPayoutStatus.APPROVED,
          netPayablePaise: 43_600,
          note: null
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      orderSellerSplit: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { netPayablePaise: 43_600 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      b2BOrder: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { sellerPayoutAmountPaise: 0 }
        }),
        updateMany: vi.fn()
      },
      serviceBookingSettlement: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { netPayablePaise: 0 }
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      },
      serviceSellerReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        })
      },
      sellerCashReceivable: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 0 },
          _sum: { offsetPaise: 0 }
        })
      },
      sellerLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { creditPaise: 0, debitPaise: 0 }
        })
      }
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
        sellerPayout: {
          findFirst: vi.fn()
        }
      }
    } as unknown as PrismaService;
    const ledger = {
      postPayoutPaidEntry: vi.fn()
    } as unknown as SellerLedgerService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, ledger);

    await expect(
      service.markPaid(
        "payout-1",
        { paymentMode: "BANK_TRANSFER", transactionReference: "UTR-1" },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] }
      )
    ).rejects.toThrow("Payout splits changed");

    expect(ledger.postPayoutPaidEntry).not.toHaveBeenCalled();
  });

  it("verifies a configured seller payout profile and writes audit log", async () => {
    const tx = {
      seller: {
        findFirst: vi.fn().mockResolvedValue({
          id: "seller-1",
          deletedAt: null,
          payoutProfile: {
            sellerId: "seller-1",
            accountHolderName: "Seller One",
            bankName: null,
            accountNumber: null,
            ifscCode: null,
            upiId: "seller@upi",
            isVerified: false
          }
        })
      },
      sellerPayoutProfile: {
        update: vi.fn().mockResolvedValue({
          sellerId: "seller-1",
          accountHolderName: "Seller One",
          bankName: null,
          accountNumber: null,
          ifscCode: null,
          upiId: "seller@upi",
          isVerified: true
        })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const prisma = {
      client: {
        $transaction: vi.fn((callback) => callback(tx))
      }
    } as unknown as PrismaService;
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, {} as SellerLedgerService);

    const result = await service.updateSellerPayoutProfileVerification(
      "seller-1",
      { verified: true, note: "Matched bank proof." },
      { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.FINANCE] }
    );

    expect(result.isVerified).toBe(true);
    expect(tx.sellerPayoutProfile.update).toHaveBeenCalledWith({
      where: { sellerId: "seller-1" },
      data: { isVerified: true }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "seller.payout_profile.verified",
        entityType: "seller_payout_profile",
        entityId: "seller-1",
        actor: { connect: { id: "admin-1" } },
        oldValue: { sellerId: "seller-1", isVerified: false },
        newValue: { sellerId: "seller-1", isVerified: true, note: "Matched bank proof." }
      })
    });
  });

  it("blocks verification when payout profile details are incomplete", async () => {
    const tx = {
      seller: {
        findFirst: vi.fn().mockResolvedValue({
          id: "seller-1",
          deletedAt: null,
          payoutProfile: {
            accountHolderName: "Seller One",
            bankName: null,
            accountNumber: null,
            ifscCode: null,
            upiId: null,
            isVerified: false
          }
        })
      },
      sellerPayoutProfile: {
        update: vi.fn()
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
    const service = new SellerPayoutsService(prisma, {} as FinanceCalculatorService, {} as SellerLedgerService);

    await expect(
      service.updateSellerPayoutProfileVerification(
        "seller-1",
        { verified: true },
        { id: "admin-1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.FINANCE] }
      )
    ).rejects.toThrow("Seller payout profile is incomplete");

    expect(tx.sellerPayoutProfile.update).not.toHaveBeenCalled();
  });
});
