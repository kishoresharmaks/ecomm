import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RoleCode, SellerPayoutStatus, SellerStatementStatus } from "@indihub/database";
import type { PrismaService } from "../prisma/prisma.service";
import { SellerStatementsService } from "./seller-statements.service";

const actor = {
  id: "admin-1",
  clerkUserId: null,
  email: "admin@example.com",
  roles: [RoleCode.ADMIN]
};

describe("SellerStatementsService", () => {
  it("blocks statement generation before payout approval", async () => {
    const prisma = {
      client: {
        sellerPayout: {
          findUnique: vi.fn().mockResolvedValue({
            id: "payout-1",
            status: SellerPayoutStatus.PENDING_APPROVAL
          })
        },
        sellerStatement: {
          findFirst: vi.fn(),
          create: vi.fn()
        }
      }
    } as unknown as PrismaService;
    const service = new SellerStatementsService(prisma);

    await expect(service.generateStatement({ payoutId: "payout-1" }, actor)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.client.sellerStatement.findFirst).not.toHaveBeenCalled();
    expect(prisma.client.sellerStatement.create).not.toHaveBeenCalled();
  });

  it("creates a statement for an approved payout", async () => {
    const payout = {
      id: "payout-1",
      status: SellerPayoutStatus.APPROVED,
      sellerId: "seller-1",
      periodFrom: new Date("2026-06-01T00:00:00.000Z"),
      periodTo: new Date("2026-06-09T00:00:00.000Z"),
      grossSalesPaise: 10_000,
      commissionPaise: 1_000,
      gstOnCommissionPaise: 180,
      tdsPaise: 100,
      tcsPaise: 0,
      platformFeePaise: 0,
      refundAdjustmentPaise: 0,
      adjustmentPaise: 0,
      netPayablePaise: 8_720,
      currency: "INR",
      seller: { id: "seller-1" }
    };
    const created = {
      id: "statement-1",
      statementNumber: "ST-TEST",
      payoutId: payout.id,
      sellerId: payout.sellerId,
      status: SellerStatementStatus.GENERATED
    };
    const prisma = {
      client: {
        sellerPayout: {
          findUnique: vi.fn().mockResolvedValue(payout)
        },
        sellerStatement: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(created)
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({})
        }
      }
    } as unknown as PrismaService;
    const service = new SellerStatementsService(prisma);

    await expect(service.generateStatement({ payoutId: "payout-1" }, actor)).resolves.toEqual(created);
    expect(prisma.client.sellerStatement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: "seller-1",
        payoutId: "payout-1",
        netPayablePaise: 8_720,
        generatedById: "admin-1"
      }),
      include: {
        seller: true,
        payout: true
      }
    });
  });

  it("exports service settlements and service receivable offsets in seller statement CSV", async () => {
    const statement = {
      id: "statement-1",
      statementNumber: "ST-SERVICE",
      sellerId: "seller-1",
      payoutId: "payout-1",
      periodFrom: new Date("2026-06-01T00:00:00.000Z"),
      periodTo: new Date("2026-06-09T00:00:00.000Z"),
      grossSalesPaise: 50_000,
      commissionPaise: 5_000,
      gstOnCommissionPaise: 900,
      tdsPaise: 500,
      tcsPaise: 0,
      platformFeePaise: 250,
      refundAdjustmentPaise: 0,
      adjustmentPaise: -300,
      netPayablePaise: 43_050,
      currency: "INR",
      seller: {
        id: "seller-1",
        storeName: "Service Hub",
        profile: null
      },
      payout: {
        id: "payout-1",
        payoutNumber: "PO-SERVICE",
        orderSplits: [],
        b2bOrders: [],
        serviceSettlements: [
          {
            id: "service-settlement-1",
            bookingId: "booking-1",
            sellerId: "seller-1",
            payoutId: "payout-1",
            grossAmountPaise: 50_000,
            inspectionFeeGrossPaise: 0,
            commissionPaise: 5_000,
            gstOnCommissionPaise: 900,
            tdsPaise: 500,
            tcsPaise: 0,
            platformFeePaise: 250,
            refundAdjustmentPaise: 0,
            netPayablePaise: 43_350,
            status: "APPROVED",
            currency: "INR",
            financeSnapshot: null,
            createdAt: new Date("2026-06-02T00:00:00.000Z"),
            updatedAt: new Date("2026-06-02T00:00:00.000Z"),
            booking: {
              id: "booking-1",
              bookingNumber: "SRV-1001",
              createdAt: new Date("2026-06-02T00:00:00.000Z"),
              updatedAt: new Date("2026-06-02T00:00:00.000Z")
            }
          }
        ],
        serviceReceivableOffsets: [
          {
            id: "receivable-1",
            receivableNumber: "SRC-1001",
            sellerId: "seller-1",
            bookingId: "booking-2",
            servicePaymentId: "service-payment-1",
            payoutOffsetId: "payout-1",
            source: "PROVIDER_CASH_COLLECTION",
            status: "PARTIALLY_SETTLED",
            offsetPolicy: "AUTO_OFFSET_NEXT_PAYOUT",
            taxAccrualStatus: "ACCRUED",
            waiverApprovalStatus: "NOT_REQUESTED",
            grossCashCollectedPaise: 10_000,
            commissionPaise: 1_000,
            gstOnCommissionPaise: 180,
            tdsPaise: 100,
            tcsPaise: 0,
            platformFeePaise: 50,
            reversalPaise: 0,
            waivedPaise: 0,
            settledPaise: 0,
            offsetPaise: 300,
            amountDueToPlatformPaise: 1_330,
            currency: "INR",
            idempotencyKey: "cash-key-1",
            cashCollectionEventId: "cash-event-1",
            provisionalUntil: null,
            verifiedById: null,
            verifiedAt: null,
            taxAccruedAt: null,
            taxReversedAt: null,
            disputedById: null,
            disputedAt: null,
            disputeReason: null,
            resolution: null,
            resolvedById: null,
            resolvedAt: null,
            resolutionNote: null,
            waiverRequestedById: null,
            waiverRequestedAt: null,
            waiverRequestedPaise: 0,
            waiverApprovedById: null,
            waiverApprovedAt: null,
            waiverLimitPaise: null,
            waiverReason: null,
            waivedAt: null,
            offsetScheduledAt: null,
            offsetAppliedAt: new Date("2026-06-09T00:00:00.000Z"),
            note: null,
            financeSnapshot: null,
            createdAt: new Date("2026-06-03T00:00:00.000Z"),
            updatedAt: new Date("2026-06-09T00:00:00.000Z"),
            booking: {
              id: "booking-2",
              bookingNumber: "SRV-CASH-1002",
              createdAt: new Date("2026-06-03T00:00:00.000Z"),
              updatedAt: new Date("2026-06-03T00:00:00.000Z")
            }
          }
        ],
        ledgerEntries: [
          {
            id: "ledger-scr-offset-1",
            sellerId: "seller-1",
            orderId: "order-1",
            orderSellerSplitId: "split-1",
            serviceBookingId: null,
            serviceSettlementId: null,
            sellerCashReceivableId: "scr-1",
            payoutId: "payout-1",
            entryType: "SELLER_CASH_RECEIVABLE_OFFSET",
            description: "Seller-collected COD offset against payout PO-SERVICE",
            debitPaise: 700,
            creditPaise: 0,
            balanceAfterPaise: -700,
            currency: "INR",
            referenceType: "seller_cash_receivable",
            referenceId: "scr-1",
            metadata: null,
            createdById: "admin-1",
            createdAt: new Date("2026-06-09T00:00:00.000Z"),
            sellerCashReceivable: {
              id: "scr-1",
              receivableNumber: "SCR-1001",
              sellerId: "seller-1",
              orderId: "order-1",
              orderSellerSplitId: "split-1",
              orderShipmentId: "shipment-1",
              paymentId: "payment-1",
              payoutOffsetId: null,
              source: "MANUAL_TRANSPORT_COD",
              status: "PARTIALLY_OFFSET",
              grossCashCollectedPaise: 20_000,
              platformDuePaise: 1_200,
              offsetPaise: 0,
              settledPaise: 0,
              waivedPaise: 0,
              outstandingPaise: 500,
              commissionPaise: 800,
              gstOnCommissionPaise: 144,
              tdsPaise: 80,
              tcsPaise: 0,
              sellerPlatformFeePaise: 50,
              buyerPlatformFeePaise: 126,
              currency: "INR",
              idempotencyKey: "MANUAL_TRANSPORT_COD:split-1",
              note: null,
              financeSnapshot: null,
              openedAt: new Date("2026-06-08T00:00:00.000Z"),
              offsetScheduledAt: null,
              offsetAppliedAt: new Date("2026-06-09T00:00:00.000Z"),
              settledAt: null,
              settledById: null,
              waivedAt: null,
              waivedById: null,
              createdAt: new Date("2026-06-08T00:00:00.000Z"),
              updatedAt: new Date("2026-06-09T00:00:00.000Z"),
              order: { orderNumber: "ORD-COD-1" },
              orderShipment: {
                shipmentNumber: "SHIP-COD-1",
                deliveryMode: "MANUAL_TRANSPORT"
              }
            }
          }
        ]
      }
    };
    const prisma = {
      client: {
        sellerStatement: {
          findFirst: vi.fn().mockResolvedValue(statement)
        }
      }
    } as unknown as PrismaService;
    const service = new SellerStatementsService(prisma);

    const result = await service.exportStatement("statement-1", "csv");
    const csv = Buffer.from(result.base64, "base64").toString("utf8");

    expect(prisma.client.sellerStatement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          payout: expect.objectContaining({
            include: expect.objectContaining({
              serviceSettlements: expect.any(Object),
              serviceReceivableOffsets: expect.any(Object),
              ledgerEntries: expect.any(Object)
            })
          })
        })
      })
    );
    expect(csv).toContain('"Service booking payouts"');
    expect(csv).toContain('"SRV-1001"');
    expect(csv).toContain('"Service cash receivable offsets"');
    expect(csv).toContain('"SRC-1001"');
    expect(csv).toContain('"SRV-CASH-1002"');
    expect(csv).toContain('"1030"');
    expect(csv).toContain('"Seller-collected COD offsets"');
    expect(csv).toContain('"SCR-1001"');
    expect(csv).toContain('"ORD-COD-1"');
    expect(csv).toContain('"700"');
  });
});
