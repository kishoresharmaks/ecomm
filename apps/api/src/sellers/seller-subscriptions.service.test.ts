import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import {
  ApprovalStatus,
  PaymentProvider,
  PaymentStatus,
  ProductStatus,
  SellerStatus,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionPlanAudience,
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
  trialDays: number;
  audience: SellerSubscriptionPlanAudience;
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

  it.each([
    SellerSubscriptionStatus.ACTIVE,
    SellerSubscriptionStatus.TRIALING,
  ])("rejects direct reauthorization of an already %s subscription", async (status) => {
    const tx = createTx();
    const plan = makePlan();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({ plan, subscriptionStatus: status }),
    );
    prisma.client.sellerSubscription.findFirst.mockResolvedValue(
      makeSubscription({ plan, status }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(
      service.authorizeSellerSubscription(makeActor()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows an unpaid authorization to be resumed or cancelled", async () => {
    const tx = createTx();
    const plan = makePlan();
    const subscription = {
      ...makeSubscription({
        plan,
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
      }),
      payments: [],
    };
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({
        plan,
        subscriptionStatus: SellerSubscriptionStatus.PENDING_PAYMENT,
        subscriptions: [subscription],
      }),
    );
    prisma.client.sellerSubscription.findFirst.mockResolvedValue(subscription);
    prisma.client.sellerSubscription.findUnique.mockResolvedValue(subscription);
    const service = new SellerSubscriptionsService(prisma as never);

    const result = await service.getSellerSubscription(makeActor());

    expect(result.billing).toMatchObject({
      canAuthorize: true,
      canCancel: true,
      cancelAtPeriodEnd: false,
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
    const signature = createHmac("sha256", "test_secret").update("pay_1|sub_razorpay_1").digest("hex");


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

  it("accepts the Razorpay trial authorization charge and starts the trial period", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900, trialDays: 14 });
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
          id: "pay_trial_auth",
          amount: 500,
          currency: "INR",
          status: "captured",
          subscription_id: "sub_razorpay_1",
        }),
      })),
    );
    const service = new SellerSubscriptionsService(prisma as never);
    vi.spyOn(service, "getSellerSubscription").mockResolvedValue({
      subscriptionStatus: SellerSubscriptionStatus.TRIALING,
    } as never);
    const signature = createHmac("sha256", "test_secret")
      .update("pay_trial_auth|sub_razorpay_1")
      .digest("hex");

    await service.verifySellerRazorpaySubscription(makeActor(), {
      razorpaySubscriptionId: "sub_razorpay_1",
      razorpayPaymentId: "pay_trial_auth",
      razorpaySignature: signature,
    });

    expect(tx.sellerSubscriptionPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountPaise: 500,
        providerPaymentId: "pay_trial_auth",
        status: PaymentStatus.PAID,
      }),
    });
    const update = tx.sellerSubscription.update.mock.calls[0]?.[0];
    expect(update).toEqual({
      where: { id: "seller_sub_1" },
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.TRIALING,
        providerStatus: "authenticated",
      }),
    });
    expect(update?.data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(update?.data.nextBillingAt).toEqual(update?.data.currentPeriodEnd);
  });

  it.each([
    { trialDays: 0, amount: undefined },
    { trialDays: 0, amount: 99800 },
    { trialDays: 14, amount: undefined },
    { trialDays: 14, amount: 499 },
  ])(
    "rejects a missing or mismatched checkout amount for trialDays=$trialDays",
    async ({ trialDays, amount }) => {
      const tx = createTx();
      const plan = makePlan({ pricePaise: 99900, trialDays });
      const subscription = makeSubscription({ plan });
      const prisma = createPrisma(tx);
      prisma.client.setting.findMany.mockResolvedValue([]);
      prisma.client.sellerSubscription.findUnique.mockResolvedValue(subscription);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            id: "pay_invalid_amount",
            ...(amount === undefined ? {} : { amount }),
            currency: "INR",
            status: "captured",
            subscription_id: "sub_razorpay_1",
          }),
        })),
      );
      const service = new SellerSubscriptionsService(prisma as never);
      const signature = createHmac("sha256", "test_secret")
        .update("pay_invalid_amount|sub_razorpay_1")
        .digest("hex");

      await expect(
        service.verifySellerRazorpaySubscription(makeActor(), {
          razorpaySubscriptionId: "sub_razorpay_1",
          razorpayPaymentId: "pay_invalid_amount",
          razorpaySignature: signature,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.sellerSubscriptionPayment.create).not.toHaveBeenCalled();
    },
  );

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

  it("ignores a stale failed webhook after a newer paid provider event", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findUnique.mockResolvedValue(
      makeSubscription({
        plan,
        status: SellerSubscriptionStatus.ACTIVE,
        lastPaymentStatus: PaymentStatus.PAID,
        providerSnapshot: { lastProviderOccurredAt: "2026-07-26T12:00:00.000Z" },
      }),
    );
    prisma.client.sellerSubscriptionProviderEvent.findUnique.mockResolvedValue(null);
    tx.sellerSubscriptionProviderEvent.create.mockResolvedValue({ id: "event_stale" });
    const service = new SellerSubscriptionsService(prisma as never);

    const result = await service.handleRazorpaySubscriptionWebhook(
      {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_old",
              subscription_id: "sub_razorpay_1",
              amount: 99900,
              currency: "INR",
              status: "failed",
              created_at: 1_753_526_400,
            },
          },
        },
      },
      "evt_failed_old",
    );

    expect(result).toMatchObject({
      handled: true,
      received: true,
      ignored: true,
      status: SellerSubscriptionStatus.ACTIVE,
    });
    expect(tx.sellerSubscription.update).not.toHaveBeenCalled();
    expect(tx.sellerSubscriptionPayment.create).not.toHaveBeenCalled();
    expect(tx.sellerSubscriptionProviderEvent.update).toHaveBeenCalledWith({
      where: { id: "event_stale" },
      data: expect.objectContaining({
        status: SellerSubscriptionProviderEventStatus.SKIPPED,
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

  it("blocks the 26th active product when the seller plan allows 25 products", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 0, productLimit: 25 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      ...makeSubscription({ plan, status: SellerSubscriptionStatus.ACTIVE }),
      payments: [],
    });
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({ plan, subscriptionStatus: SellerSubscriptionStatus.ACTIVE }),
    );
    prisma.client.product.count.mockResolvedValue(25);
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(service.ensureCanCreateProduct("seller_1")).rejects.toThrow(
      "Your seller plan allows 25 products. Upgrade the subscription plan to add more products.",
    );
    expect(prisma.client.product.count).toHaveBeenCalledWith({
      where: {
        sellerId: "seller_1",
        deletedAt: null,
        status: { not: ProductStatus.ARCHIVED },
      },
    });
  });

  it("allows product creation below the seller plan product limit", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 0, productLimit: 25 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      ...makeSubscription({ plan, status: SellerSubscriptionStatus.ACTIVE }),
      payments: [],
    });
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({ plan, subscriptionStatus: SellerSubscriptionStatus.ACTIVE }),
    );
    prisma.client.product.count.mockResolvedValue(24);
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(service.ensureCanCreateProduct("seller_1")).resolves.toBeUndefined();
  });

  it("blocks B2B responses when the active plan has no B2B enquiry limit", async () => {
    const tx = createTx();
    const plan = makePlan({ b2bEnquiryLimit: 0 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      ...makeSubscription({ plan, status: SellerSubscriptionStatus.ACTIVE }),
      payments: [],
    });
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({ plan, subscriptionStatus: SellerSubscriptionStatus.ACTIVE }),
    );
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(service.ensureCanUseSellerB2B("seller_1")).rejects.toThrow(
      "Upgrade your subscription plan to respond to B2B enquiries.",
    );
  });

  it("allows B2B responses when the active plan has a positive B2B enquiry limit", async () => {
    const tx = createTx();
    const plan = makePlan({ b2bEnquiryLimit: 10 });
    const prisma = createPrisma(tx);
    prisma.client.sellerSubscription.findFirst.mockResolvedValue({
      ...makeSubscription({ plan, status: SellerSubscriptionStatus.ACTIVE }),
      payments: [],
    });
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({ plan, subscriptionStatus: SellerSubscriptionStatus.ACTIVE }),
    );
    const service = new SellerSubscriptionsService(prisma as never);

    await expect(service.ensureCanUseSellerB2B("seller_1")).resolves.toBeUndefined();
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
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "sub_razorpay_1", status: "active" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "sub_razorpay_1", status: "cancelled", cancel_at_cycle_end: true }),
        }),
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
    expect(tx.sellerSubscription.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "seller_sub_1",
        providerStatus: expect.stringMatching(/^cancellation_pending:/),
      }),
      data: expect.objectContaining({
        cancelAtPeriodEnd: true,
        providerCancelAtCycleEnd: true,
        providerStatus: "cancelled",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "seller.subscription.renewal_cancel_requested",
        entityType: "seller_subscription",
        entityId: "seller_sub_1",
      }),
    });
  });

  it("cancels an unpaid Razorpay authorization immediately", async () => {
    const tx = createTx();
    const plan = makePlan({ pricePaise: 99900 });
    const prisma = createPrisma(tx);
    prisma.client.setting.findMany.mockResolvedValue([]);
    prisma.client.seller.findUnique.mockResolvedValue(
      makeSeller({
        plan,
        subscriptions: [
          makeSubscription({
            plan,
            status: SellerSubscriptionStatus.PENDING_PAYMENT,
          }),
        ],
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "sub_razorpay_1", status: "created" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "sub_razorpay_1",
            status: "cancelled",
            cancel_at_cycle_end: false,
          }),
        }),
    );
    const service = new SellerSubscriptionsService(prisma as never);
    vi.spyOn(service, "getSellerSubscription").mockResolvedValue({
      subscriptionStatus: SellerSubscriptionStatus.CANCELLED,
    } as never);

    await service.cancelSellerSubscription(makeActor());

    expect(fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/subscriptions/sub_razorpay_1/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ cancel_at_cycle_end: 0 }),
      }),
    );
    expect(tx.sellerSubscription.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "seller_sub_1",
        providerStatus: expect.stringMatching(/^cancellation_pending:/),
      }),
      data: expect.objectContaining({
        status: SellerSubscriptionStatus.CANCELLED,
        cancelAtPeriodEnd: false,
        providerCancelAtCycleEnd: false,
      }),
    });
    expect(tx.seller.update).toHaveBeenCalledWith({
      where: { id: "seller_1" },
      data: { subscriptionStatus: SellerSubscriptionStatus.CANCELLED },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "seller.subscription.cancelled",
        entityType: "seller_subscription",
        entityId: "seller_sub_1",
      }),
    });
  });
});

function createTx() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    seller: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sellerSubscription: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    sellerSubscriptionPayment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    sellerSubscriptionProviderEvent: {
      create: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createTx>) {
  const prisma = {
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
  tx.sellerSubscription.findFirst.mockImplementation((...args) =>
    prisma.client.sellerSubscription.findFirst(...args),
  );
  tx.sellerSubscription.findUniqueOrThrow.mockImplementation(async (...args) => {
    const value = await prisma.client.sellerSubscription.findUnique(...args);
    return value ?? prisma.client.sellerSubscription.findUniqueOrThrow(...args);
  });
  return prisma;
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
    trialDays: 0,
    audience: SellerSubscriptionPlanAudience.RETAIL,
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
  lastPaymentStatus = PaymentStatus.PENDING,
  providerSnapshot = null,
}: {
  plan: TestPlan;
  status?: SellerSubscriptionStatus;
  currentPeriodEnd?: Date | null;
  gracePeriodEndsAt?: Date | null;
  paymentFailureCount?: number;
  lastPaymentStatus?: PaymentStatus;
  providerSnapshot?: Record<string, unknown> | null;
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
    lastPaymentStatus,
    paymentFailureCount,
    providerSnapshot,
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
