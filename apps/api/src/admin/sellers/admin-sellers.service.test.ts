import { NotFoundException } from "@nestjs/common";
import {
  ApprovalStatus,
  EmailRecipientType,
  PaymentStatus,
  SellerStatus,
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
    const service = new AdminSellersService(createPrisma(tx), notifications as never);

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
    const service = new AdminSellersService(createPrisma(tx), notifications as never);

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

  it("throws when an approval decision targets a missing seller", async () => {
    const tx = createSellerTx();
    tx.seller.findFirst.mockResolvedValue(null);
    const service = new AdminSellersService(createPrisma(tx), notifications as never);

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
