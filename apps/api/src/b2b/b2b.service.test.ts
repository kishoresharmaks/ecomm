import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  ApprovalStatus,
  B2BEnquiryStatus,
  RoleCode,
  SellerStatus,
  UserStatus,
} from "@indihub/database";
import type { PrismaService } from "../prisma/prisma.service";
import { B2BService } from "./b2b.service";

const actor = {
  id: "buyer-user-1",
  clerkUserId: null,
  email: "buyer@example.com",
  roles: [RoleCode.BUSINESS_BUYER],
};

describe("B2BService negotiation chat", () => {
  it("creates a buyer message and moves responded enquiries into negotiation", async () => {
    const tx = {
      b2BEnquiryMessage: {
        create: vi.fn().mockResolvedValue(messageRecord({ message: "Can you improve delivery?" })),
      },
      b2BEnquiry: {
        update: vi.fn().mockResolvedValue({ id: "enquiry-1", status: B2BEnquiryStatus.NEGOTIATING }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = createPrisma({
      businessBuyer: { findUnique: vi.fn().mockResolvedValue(buyerRecord()) },
      b2BEnquiry: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(enquiryRecord({ status: B2BEnquiryStatus.RESPONDED }))
          .mockResolvedValueOnce(enquiryRecord({ status: B2BEnquiryStatus.NEGOTIATING })),
      },
      $transaction: vi.fn((callback) => callback(tx)),
      notificationLog: { findMany: vi.fn().mockResolvedValue([]) },
      customer: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = createService(prisma);

    const result = await service.sendMessageAsBuyer(actor, "enquiry-1", {
      message: " Can you improve delivery? ",
    });

    expect(result.message).toBe("Can you improve delivery?");
    expect(tx.b2BEnquiry.update).toHaveBeenCalledWith({
      where: { id: "enquiry-1" },
      data: { status: B2BEnquiryStatus.NEGOTIATING },
    });
    expect(tx.b2BEnquiryMessage.create).toHaveBeenCalledWith({
      data: {
        enquiryId: "enquiry-1",
        senderUserId: "buyer-user-1",
        message: "Can you improve delivery?",
      },
      include: { sender: true },
    });
  });

  it("rejects messages on terminal enquiries", async () => {
    const prisma = createPrisma({
      businessBuyer: { findUnique: vi.fn().mockResolvedValue(buyerRecord()) },
      b2BEnquiry: {
        findFirst: vi.fn().mockResolvedValue(enquiryRecord({ status: B2BEnquiryStatus.CANCELLED })),
      },
    });
    const service = createService(prisma);

    await expect(
      service.sendMessageAsBuyer(actor, "enquiry-1", { message: "Any update?" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects confirmation when the buyer selects a superseded quotation", async () => {
    const prisma = createPrisma({
      businessBuyer: { findUnique: vi.fn().mockResolvedValue(buyerRecord()) },
      b2BEnquiry: {
        findFirst: vi.fn().mockResolvedValue(
          enquiryRecord({
            status: B2BEnquiryStatus.NEGOTIATING,
            responses: [
              responseRecord("old-response", "2026-06-27T10:00:00.000Z"),
              responseRecord("new-response", "2026-06-27T11:00:00.000Z"),
            ],
          }),
        ),
      },
    });
    const service = createService(prisma);

    await expect(
      service.confirmMyEnquiry(actor, "enquiry-1", "old-response"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("B2BService analytics", () => {
  it("calculates conversion, commission, message average, and off-platform risk", async () => {
    const prisma = createPrisma({
      b2BEnquiry: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2),
        groupBy: vi.fn().mockResolvedValue([
          { status: B2BEnquiryStatus.NEGOTIATING, _count: { id: 3 } },
          { status: B2BEnquiryStatus.CANCELLED, _count: { id: 2 } },
        ]),
      },
      b2BOrder: {
        count: vi.fn().mockResolvedValue(4),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { subtotalPaise: 200_000 },
          _sum: { commissionAmountPaise: 8_000, subtotalPaise: 800_000 },
        }),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ businessBuyerId: "buyer-1", _sum: { subtotalPaise: 500_000 }, _count: { id: 2 } }])
          .mockResolvedValueOnce([{ sellerId: "seller-1", _sum: { subtotalPaise: 500_000 }, _count: { id: 2 } }]),
      },
      b2BEnquiryMessage: {
        groupBy: vi.fn().mockResolvedValue([
          { enquiryId: "enquiry-1", _count: { id: 4 } },
          { enquiryId: "enquiry-2", _count: { id: 8 } },
        ]),
      },
      businessBuyer: {
        findMany: vi.fn().mockResolvedValue([{ id: "buyer-1", companyName: "Acme", user: { email: "buyer@example.com" } }]),
      },
      seller: {
        findMany: vi.fn().mockResolvedValue([{ id: "seller-1", storeName: "Seller One", user: { email: "seller@example.com" } }]),
      },
    });
    const service = createService(prisma);

    const result = await service.getAdminB2BAnalytics({});

    expect(result.conversionRate).toBe(0.4);
    expect(result.averageNegotiationMessages).toBe(6);
    expect(result.offPlatformRiskCount).toBe(2);
    expect(result.totalCommissionEarnedPaise).toBe(8_000);
    expect(result.topBuyers[0]).toMatchObject({ companyName: "Acme", confirmedOrderValuePaise: 500_000 });
  });

  it("rejects invalid analytics date filters", async () => {
    const service = createService(createPrisma({}));

    await expect(service.getAdminB2BAnalytics({ from: "not-a-date" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function createService(prisma: PrismaService) {
  return new B2BService(
    prisma,
    {} as never,
    { notifyEvent: vi.fn(), notifyAdminEvent: vi.fn() } as never,
    { notifyCustomer: vi.fn(), notifySeller: vi.fn() } as never,
    {} as never,
    { b2bBankTransferInstructions: vi.fn().mockResolvedValue({ enabled: false, configured: false, bankTransferDetails: null }) } as never,
    { ensureCanUseSellerB2B: vi.fn() } as never,
  );
}

function createPrisma(client: Record<string, unknown>) {
  return { client } as unknown as PrismaService;
}

function buyerRecord() {
  return {
    id: "business-buyer-1",
    userId: "buyer-user-1",
    companyName: "Acme",
    gstNumber: null,
    contactName: "Buyer",
    contactPhone: "9999999999",
    status: UserStatus.ACTIVE,
    user: { id: "buyer-user-1", email: "buyer@example.com" },
    addresses: [],
  };
}

function enquiryRecord(input: {
  status: B2BEnquiryStatus;
  responses?: ReturnType<typeof responseRecord>[];
}) {
  return {
    id: "enquiry-1",
    businessBuyerId: "business-buyer-1",
    productId: "product-1",
    sellerId: "seller-1",
    quantity: 10,
    message: "Need bulk pricing",
    status: input.status,
    createdAt: new Date("2026-06-27T09:00:00.000Z"),
    updatedAt: new Date("2026-06-27T09:00:00.000Z"),
    businessBuyer: buyerRecord(),
    product: null,
    seller: {
      id: "seller-1",
      userId: "seller-user-1",
      storeName: "Seller One",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      commissionValue: 200,
      user: { id: "seller-user-1", email: "seller@example.com" },
      profile: null,
      addresses: [],
    },
    responses: input.responses ?? [responseRecord("response-1", "2026-06-27T10:00:00.000Z")],
    b2bOrder: null,
    chatConversations: [],
  };
}

function responseRecord(id: string, createdAt: string) {
  return {
    id,
    enquiryId: "enquiry-1",
    responderUserId: "seller-user-1",
    responseMessage: "We can supply this.",
    quotedPricePaise: 20_000,
    createdAt: new Date(createdAt),
    responder: { id: "seller-user-1", email: "seller@example.com", fullName: "Seller" },
  };
}

function messageRecord(input: { message: string }) {
  return {
    id: "message-1",
    enquiryId: "enquiry-1",
    senderUserId: "buyer-user-1",
    message: input.message,
    createdAt: new Date("2026-06-27T10:30:00.000Z"),
    updatedAt: new Date("2026-06-27T10:30:00.000Z"),
    sender: { id: "buyer-user-1", email: "buyer@example.com", fullName: "Buyer" },
  };
}
