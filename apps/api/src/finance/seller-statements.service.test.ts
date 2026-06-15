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
});
