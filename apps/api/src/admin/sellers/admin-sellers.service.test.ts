import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  ApprovalStatus,
  DocumentStatus,
  EmailRecipientType,
  PaymentStatus,
  SellerStatus,
  SellerTaxRegistrationStatus,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSellersService } from "./admin-sellers.service";
import { SellerApprovalDecision } from "./dto/seller-approval.dto";

describe("AdminSellersService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
  };
  const storage = {
    privateDocumentAccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves a pending seller, writes an audit log, and notifies the seller", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue({
      id: "seller_1",
      userId: "user_seller",
      storeName: "Indi Local",
      status: SellerStatus.PENDING_APPROVAL,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      subscriptionPlan: {
        pricePaise: 0,
        billingCycle: SellerSubscriptionBillingCycle.MONTHLY,
      },
      user: { email: "seller@example.com" },
      profile: null,
      documents: approvedSellerDocuments(),
    });
    tx.seller.update.mockResolvedValue({
      id: "seller_1",
      userId: "user_seller",
      storeName: "Indi Local",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      user: { email: "seller@example.com" },
      profile: null,
      addresses: [],
    });
    const service = new AdminSellersService(createPrisma(tx), notifications as never, storage as never);

    const result = await service.updateSellerApproval(
      "seller_1",
      { decision: SellerApprovalDecision.APPROVE, note: "Verified" },
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [] },
    );

    expect(result).toMatchObject({
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    expect(tx.sellerSubscription.updateMany).toHaveBeenCalledWith({
      where: {
        sellerId: "seller_1",
        isCurrent: true,
      },
      data: {
        status: SellerSubscriptionStatus.ACTIVE,
        lastPaymentStatus: "NOT_REQUIRED",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "seller.approved",
        entityType: "seller",
        entityId: "seller_1",
        oldValue: {
          status: SellerStatus.PENDING_APPROVAL,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        },
        newValue: {
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
          note: "Verified",
        },
        actor: { connect: { id: "admin_1" } },
      },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "SELLER_APPROVED",
      recipientType: EmailRecipientType.SELLER,
      recipient: "seller@example.com",
      userId: "user_seller",
      variables: {
        sellerName: "Indi Local",
        note: "Verified",
      },
    });
  });

  it("keeps a paid recurring seller subscription pending until payment authorization", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue({
      id: "seller_paid",
      userId: "user_seller_paid",
      storeName: "Indi Paid Store",
      status: SellerStatus.PENDING_APPROVAL,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      subscriptionPlan: {
        pricePaise: 99900,
        billingCycle: SellerSubscriptionBillingCycle.MONTHLY,
      },
      user: { email: "paid-seller@example.com" },
      profile: null,
      documents: approvedSellerDocuments(),
    });
    tx.seller.update.mockResolvedValue({
      id: "seller_paid",
      userId: "user_seller_paid",
      storeName: "Indi Paid Store",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
      subscriptionStatus: SellerSubscriptionStatus.PENDING_PAYMENT,
      user: { email: "paid-seller@example.com" },
      profile: null,
      addresses: [],
    });
    const service = new AdminSellersService(createPrisma(tx), notifications as never, storage as never);

    await service.updateSellerApproval("seller_paid", { decision: SellerApprovalDecision.APPROVE });

    expect(tx.seller.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionStatus: SellerSubscriptionStatus.PENDING_PAYMENT,
        }),
      }),
    );
    expect(tx.sellerSubscription.updateMany).toHaveBeenCalledWith({
      where: {
        sellerId: "seller_paid",
        isCurrent: true,
      },
      data: {
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
        lastPaymentStatus: PaymentStatus.PENDING,
      },
    });
  });

  it("requires a GST certificate before approving a regular GST seller", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue({
      id: "seller_gst",
      userId: "user_seller_gst",
      storeName: "GST Store",
      status: SellerStatus.PENDING_APPROVAL,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      subscriptionPlan: null,
      user: { email: "gst@example.com" },
      profile: {
        taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
        gstNumber: "29ABCDE1234F1Z5",
      },
      documents: approvedSellerDocuments(false),
    });
    const service = new AdminSellersService(
      createPrisma(tx),
      notifications as never,
      storage as never,
    );

    await expect(
      service.updateSellerApproval("seller_gst", {
        decision: SellerApprovalDecision.APPROVE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.seller.update).not.toHaveBeenCalled();
  });

  it("blocks approval when a mandatory seller document is still pending", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue({
      id: "seller_pending_doc",
      userId: "user_seller_pending_doc",
      storeName: "Pending Document Store",
      status: SellerStatus.PENDING_APPROVAL,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      subscriptionPlan: null,
      user: { email: "pending@example.com" },
      profile: null,
      documents: approvedSellerDocuments().map((document) =>
        document.documentType === "BANK_PROOF"
          ? { ...document, status: DocumentStatus.PENDING }
          : document,
      ),
    });
    const service = new AdminSellersService(
      createPrisma(tx),
      notifications as never,
      storage as never,
    );

    await expect(
      service.updateSellerApproval("seller_pending_doc", {
        decision: SellerApprovalDecision.APPROVE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.seller.update).not.toHaveBeenCalled();
  });

  it("throws when an approval decision targets a missing seller", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue(null);
    const service = new AdminSellersService(createPrisma(tx), notifications as never, storage as never);

    await expect(
      service.updateSellerApproval("missing_seller", { decision: SellerApprovalDecision.REJECT }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.seller.update).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });
});

function createSellerTx() {
  return {
    seller: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sellerSubscription: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createSellerTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as never;
}

function approvedSellerDocuments(includeGstCertificate = true) {
  return [
    "ID_PROOF",
    "SIGNATURE_PROOF",
    "ADDRESS_PROOF",
    "BANK_PROOF",
    ...(includeGstCertificate ? ["GST_CERTIFICATE"] : []),
  ].map((documentType) => ({
    documentType,
    status: DocumentStatus.APPROVED,
  }));
}
