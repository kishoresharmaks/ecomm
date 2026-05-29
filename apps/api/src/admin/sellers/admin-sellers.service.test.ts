import { NotFoundException } from "@nestjs/common";
import { ApprovalStatus, EmailRecipientType, SellerStatus } from "@indihub/database";
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
      user: { email: "seller@example.com" },
      profile: null,
    });
    tx.seller.update.mockResolvedValue({
      id: "seller_1",
      userId: "user_seller",
      storeName: "Indi Local",
      status: SellerStatus.APPROVED,
      approvalStatus: ApprovalStatus.APPROVED,
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
