import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import {
  ApprovalStatus,
  PaymentProvider,
  PaymentStatus,
  SellerStatus,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionProviderEventStatus,
  SellerSubscriptionStatus,
} from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";

type TestPlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  pricePaise: number;
  currency: string;
  billingCycle: SellerSubscriptionBillingCycle;
  productLimit: number;
  featuredProductLimit: number;
  b2bEnquiryLimit: number;
  commissionDiscountBps: number;
  providerPlanId: string;
  providerPlanVersion: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

describe("SellerSubscriptionsService recurring billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.unstubAllGlobals();
  });

  it("marks paid recurring plans as pending payment and free/lifetime plans as active", () => {
    const service = new SellerSubscriptionsService(createPrisma(createTx()) as never);

    expect(service.defaultStatusForPlan(makePlan({ pricePaise: 99900 }))).toBe(
      SellerSubscriptionStatus.PENDING_PAYMENT,
    );
    expect(service.defaultStatusForPlan(makePlan({ pricePaise: 0 }))).toBe(
      SellerSubscriptionStatus.ACTIVE,
    );
    expect(
      service.defaultStatusForPlan(
        makePlan({ pricePaise: 499900, billingCycle: SellerSubscriptionBillingCycle.LIFETIME }),
      ),
    ).toBe(SellerSubscriptionStatus.ACTIVE);
  });

  it("activates a free plan without creating a Razorpay subscription", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 0 });
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue(makeSeller({ plan }));
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      id: "seller_sub_1",
      planId: plan.id,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new SellerSubscriptionsService(prisma as never);

    const result = await service.authorizeSellerSubscription(makeActor());

    expect(result).toMatchObject({
      requiresPayment: false,
      status: SellerSubscriptionStatus.ACTIVE,
      sellerId: "seller_1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(tx.sellerSubscription.update).toHaveBeenCalledWith({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.ACTIVE,
        lastPaymentStatus: PaymentStatus.NOT_REQUIRED,
        gracePeriodEndsAt: null,
      }),
    });
  });

  it("verifies a Razorpay subscription checkout payment and activates the seller plan", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const subscription = makeSubscription({ plan });
    const prisma = createPrisma(tx);
    prisma.client.setting.findMany.mockResolvedValue([]);
    prisma.client.sellerSubscription.findUnique.mockResolvedValue(subscription);
    tx.sellerSubscriptionPayment.findFirst.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: "pay_1",
          amount: 99900,
          currency: "INR",
          status: "captured",
          subscription_id: "sub_razorpay_1",
        }),
      })),
    );
    const service = new SellerSubscriptionsService(prisma as never);
    vi.spyOn(service, "getSellerSubscription").mockResolvedValue({
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
    } as never);
    const signature = createHmac("sha256", "test_secret").update("sub_razorpay_1|pay_1").digest("hex");

    await service.verifySellerRazorpaySubscription(makeActor(), {
      razorpaySubscriptionId: "sub_razorpay_1",
      razorpayPaymentId: "pay_1",
      razorpaySignature: signature,
    });

    expect(tx.sellerSubscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: "seller_1",
        providerPaymentId: "pay_1",
        status: PaymentStatus.PAID,
      }),
    });
    expect(tx.sellerSubscription.update).toHaveBeenCalledWith({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.ACTIVE,
        providerStatus: "authenticated",
        gracePeriodEndsAt: null,
        paymentFailureCount: 0,
      }),
    });
    expect(tx.seller.update).toHaveBeenCalledWith({
      where: { id: "seller_1" },
      data: expect.objectContaining({
        subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
      }),
    });
  });

  it("records Razorpay renewal success webhooks idempotently", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findUnique.mockResolvedValue(makeSubscription({ plan }));
    prisma.client.sellerSubscriptionProviderEvent.findUnique.mockResolvedValue(null);
    tx.sellerSubscriptionProviderEvent.create.mockResolvedValue({ id: "event_1" });
    tx.sellerSubscriptionPayment.findFirst.mockResolvedValue(null);
    const service = new SellerSubscriptionsService(prisma as never);

    const result = await service.handleRazorpaySubscriptionWebhook(
      {
        event: "invoice.paid",
        payload: {
          subscription: {
            entity: {
              id: "sub_razorpay_1",
              status: "active",
              current_end: 1_800_000_000,
            },
          },
          invoice: {
            entity: {
              id: "inv_1",
              subscription_id: "sub_razorpay_1",
              amount: 99900,
              currency: "INR",
              status: "paid",
            },
          },
          payment: {
            entity: {
              id: "pay_renewal_1",
              subscription_id: "sub_razorpay_1",
              amount: 99900,
              currency: "INR",
              status: "captured",
            },
          },
        },
      },
      "evt_paid_1",
    );

    expect(result).toMatchObject({
      handled: true,
      received: true,
      status: SellerSubscriptionStatus.ACTIVE,
    });
    expect(tx.sellerSubscriptionProviderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerEventId: "evt_paid_1",
        status: SellerSubscriptionProviderEventStatus.RECEIVED,
      }),
    });
    expect(tx.sellerSubscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerInvoiceId: "inv_1",
        providerPaymentId: "pay_renewal_1",
        status: PaymentStatus.PAID,
      }),
    });
    expect(tx.sellerSubscription.update).toHaveBeenCalledWith({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.ACTIVE,
        paymentFailureCount: 0,
      }),
    });
  });

  it("starts a seven-day grace period after a failed recurring payment webhook", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const currentPeriodEnd = new Date("2026-06-30T00:00:00.000Z");
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findUnique.mockResolvedValue(
      makeSubscription({ plan, currentPeriodEnd, paymentFailureCount: 2 }),
    );
    prisma.client.sellerSubscriptionProviderEvent.findUnique.mockResolvedValue(null);
    tx.sellerSubscriptionProviderEvent.create.mockResolvedValue({ id: "event_failed" });
    tx.sellerSubscriptionPayment.findFirst.mockResolvedValue(null);
    const service = new SellerSubscriptionsService(prisma as never);

    await service.handleRazorpaySubscriptionWebhook(
      {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_1",
              subscription_id: "sub_razorpay_1",
              amount: 99900,
              currency: "INR",
              status: "failed",
            },
          },
        },
      },
      "evt_failed_1",
    );

    const updateCall = tx.sellerSubscription.update.mock.calls[0]?.[0];
    expect(updateCall).toEqual({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
        lastPaymentStatus: PaymentStatus.FAILED,
        paymentFailureCount: 3,
      }),
    });
    expect(updateCall?.data.gracePeriodEndsAt).toBeInstanceOf(Date);
    expect(tx.sellerSubscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerPaymentId: "pay_failed_1",
        status: PaymentStatus.FAILED,
      }),
    });
  });

  it("blocks new seller growth actions after grace expiry", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      ...makeSubscription({
        plan,
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
        gracePeriodEndsAt: new Date("2026-05-01T00:00:00.000Z"),
      }),
      payments: [],
    });
    prisma.client.seller.findUnique.mockResolvedValue({
      ...makeSeller({ plan, subscriptionStatus: SellerSubscriptionStatus.EXPIRED }),
      subscriptions: [],
    });
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(service.ensureCanCreateProduct("seller_1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.ensureCanUseSellerB2B("seller_1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.sellerSubscription.update).toHaveBeenCalledWith({
      where: { id: "seller_sub_1" },
      data: { status: SellerSubscriptionStatus.EXPIRED },
    });
    expect(tx.seller.update).toHaveBeenCalledWith({
      where: { id: "seller_1" },
      data: { subscriptionStatus: SellerSubscriptionStatus.EXPIRED },
    });
  });

  it("cancels Razorpay subscriptions at period end", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const prisma = createPrisma(tx);
    prisma.client.setting.findMany.mockResolvedValue([]);
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({
        plan,
        subscriptions: [makeSubscription({ plan, status: SellerSubscriptionStatus.ACTIVE })],
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "sub_razorpay_1", status: "cancelled", cancel_at_cycle_end: true }),
      })),
    );
    const service = new SellerSubscriptionsService(prisma as never);
    vi.spyOn(service, "getSellerSubscription").mockResolvedValue({
      subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
    } as never);

    await service.cancelSellerSubscription(makeActor());

    expect(fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/subscriptions/sub_razorpay_1/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      }),
    );
    expect(prisma.client.sellerSubscription.update).toHaveBeenCalledWith({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        cancelAtPeriodEnd: true,
        providerCancelAtCycleEnd: true,
        providerStatus: "cancelled",
      }),
    });
  });
});

function createTx() {
  return {
    seller: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sellerSubscription: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sellerSubscriptionPayment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sellerSubscriptionProviderEvent: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      setting: {
        findMany: vi.fn(),
      },
      seller: {
        findUnique: vi.fn(),
      },
      sellerSubscription: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      sellerSubscriptionPlan: {
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      sellerSubscriptionProviderEvent: {
        findUnique: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    },
  };
}

function makeActor() {
  return { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] };
}

function makePlan(overrides: Partial<TestPlan> = {}): TestPlan {
  return {
    id: "plan_1",
    code: "PRO",
    name: "Pro",
    description: "Paid seller plan",
    pricePaise: 99900,
    currency: "INR",
    billingCycle: SellerSubscriptionBillingCycle.MONTHLY,
    productLimit: 100,
    featuredProductLimit: 5,
    b2bEnquiryLimit: 50,
    commissionDiscountBps: 0,
    providerPlanId: "plan_razorpay_1",
    providerPlanVersion: 1,
    isDefault: false,
    isActive: true,
    sortOrder: 10,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSeller({
  plan,
  subscriptionStatus = SellerSubscriptionStatus.PENDING_PAYMENT,
  subscriptions,
}: {
  plan: TestPlan;
  subscriptionStatus?: SellerSubscriptionStatus;
  subscriptions?: unknown[];
}) {
  return {
    id: "seller_1",
    userId: "user_seller",
    storeName: "Indi Seller",
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
    subscriptionStatus,
    subscriptionStartedAt: null,
    subscriptionCurrentPeriodEnd: null,
    user: { id: "user_seller", email: "seller@example.com", phone: "9876543210" },
    profile: { contactName: "Seller Contact", contactPhone: "9876543210" },
    subscriptionPlan: plan,
    subscriptions: subscriptions ?? [makeSubscription({ plan, status: subscriptionStatus })],
  };
}

function makeSubscription({
  plan,
  status = SellerSubscriptionStatus.PENDING_PAYMENT,
  currentPeriodEnd = new Date("2026-06-30T00:00:00.000Z"),
  gracePeriodEndsAt = null,
  paymentFailureCount = 0,
}: {
  plan: TestPlan;
  status?: SellerSubscriptionStatus;
  currentPeriodEnd?: Date | null;
  gracePeriodEndsAt?: Date | null;
  paymentFailureCount?: number;
}) {
  return {
    id: "seller_sub_1",
    sellerId: "seller_1",
    planId: plan.id,
    status,
    isCurrent: true,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    currentPeriodEnd,
    cancelledAt: null,
    provider: PaymentProvider.RAZORPAY,
    providerSubscriptionId: "sub_razorpay_1",
    providerPlanId: plan.providerPlanId,
    providerStatus: "active",
    providerCustomerId: null,
    authorizedAt: new Date("2026-01-01T00:00:00.000Z"),
    nextBillingAt: currentPeriodEnd,
    gracePeriodEndsAt,
    cancelAtPeriodEnd: false,
    providerCancelAtCycleEnd: false,
    lastPaymentStatus: PaymentStatus.PENDING,
    paymentFailureCount,
    providerSnapshot: null,
    note: null,
    createdById: "admin_1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    seller: {
      id: "seller_1",
      userId: "user_seller",
      subscriptionStartedAt: null,
      subscriptionCurrentPeriodEnd: null,
    },
    plan,
  };
}
