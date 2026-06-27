import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { EmailRecipientType, PaymentProvider, PaymentStatus } from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
  };
  const prisma = {
    client: {
      payment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      paymentEvent: {
        create: vi.fn(),
      },
      order: {
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      orderStatusEvent: {
        create: vi.fn(),
      },
      setting: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(
        async (callback: (transactionClient: typeof prisma.client) => Promise<unknown>) =>
          callback(prisma.client),
      ),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.client.setting.findMany.mockResolvedValue([]);
    prisma.client.payment.findUnique.mockImplementation(async () => prisma.client.payment.findFirst());
    prisma.client.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.order.updateMany.mockResolvedValue({ count: 1 });
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret";
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "key_secret";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.unstubAllGlobals();
  });

  it("rejects Razorpay webhook payloads with invalid signatures", async () => {
    const service = new PaymentsService(prisma as never, notifications as never);

    await expect(
      service.handleRazorpayWebhook(
        "bad_signature",
        createRazorpayPayload("payment.captured", "pay_1", "order_1"),
        Buffer.from("{}"),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.client.payment.findFirst).not.toHaveBeenCalled();
  });

  it("rejects Razorpay webhooks when the raw body is unavailable", async () => {
    const payload = createRazorpayPayload("payment.captured", "pay_1", "order_1");
    const signature = createHmac("sha256", "webhook_secret")
      .update(Buffer.from(JSON.stringify(payload)))
      .digest("hex");
    const service = new PaymentsService(prisma as never, notifications as never);

    await expect(service.handleRazorpayWebhook(signature, payload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.client.payment.findFirst).not.toHaveBeenCalled();
  });

  it("updates payment and order state for a valid captured-payment webhook", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.captured", "pay_1", "order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue({
      id: "payment_1",
      orderId: "order_internal_1",
      provider: PaymentProvider.RAZORPAY,
      method: "RAZORPAY",
      amountPaise: 100,
      currency: "INR",
      status: PaymentStatus.PENDING,
      providerPaymentId: null,
      providerOrderId: "order_1",
      order: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.PENDING,
        customer: {
          userId: "user_customer",
          user: {
            email: "customer@example.com",
          },
        },
      },
    });
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      paymentId: "payment_1",
      status: PaymentStatus.PAID,
    });
    expect(prisma.client.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment_1", status: PaymentStatus.PENDING, providerPaymentId: null },
      data: {
        status: PaymentStatus.PAID,
        providerPaymentId: "pay_1",
        rawResponse: JSON.parse(rawBody.toString()),
      },
    });
    expect(prisma.client.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order_internal_1" },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PAYMENT_SUCCESS",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_customer",
      variables: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.PAID,
      },
    });
  });

  it("does not downgrade a paid order when a late failed webhook arrives", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.failed", "pay_failed", "order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue({
      id: "payment_1",
      orderId: "order_internal_1",
      provider: PaymentProvider.RAZORPAY,
      method: "RAZORPAY",
      amountPaise: 100,
      currency: "INR",
      status: PaymentStatus.PAID,
      providerPaymentId: "pay_paid",
      providerOrderId: "order_1",
      order: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.PAID,
        customer: {
          userId: "user_customer",
          user: {
            email: "customer@example.com",
          },
        },
      },
    });
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      ignored: true,
      paymentId: "payment_1",
      status: PaymentStatus.PAID,
      reason: "paid_payment_is_terminal",
    });
    expect(prisma.client.payment.update).not.toHaveBeenCalled();
    expect(prisma.client.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.client.order.update).not.toHaveBeenCalled();
    expect(prisma.client.order.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("does not downgrade a payment that became paid before a late failed event commits", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.failed", "pay_failed", "order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue(createPaymentRecord());
    prisma.client.payment.findUnique.mockResolvedValue(
      createPaymentRecord({
        status: PaymentStatus.PAID,
        providerPaymentId: "pay_paid",
        order: {
          paymentStatus: PaymentStatus.PAID,
        },
      }),
    );
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      ignored: true,
      paymentId: "payment_1",
      status: PaymentStatus.PAID,
      reason: "paid_payment_is_terminal",
    });
    expect(prisma.client.payment.update).not.toHaveBeenCalled();
    expect(prisma.client.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.client.order.update).not.toHaveBeenCalled();
    expect(prisma.client.order.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("treats a guarded late failed update as terminal when payment wins the race", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.failed", "pay_failed", "order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue(createPaymentRecord());
    prisma.client.payment.findUnique
      .mockResolvedValueOnce(createPaymentRecord())
      .mockResolvedValueOnce(
        createPaymentRecord({
          status: PaymentStatus.PAID,
          providerPaymentId: "pay_paid",
          order: {
            paymentStatus: PaymentStatus.PAID,
          },
        }),
      );
    prisma.client.payment.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      ignored: true,
      paymentId: "payment_1",
      status: PaymentStatus.PAID,
      reason: "paid_payment_is_terminal",
    });
    expect(prisma.client.paymentEvent.create).not.toHaveBeenCalled();
    expect(prisma.client.order.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("verifies Razorpay Checkout signatures before refreshing payment state", async () => {
    const signature = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "pay_1",
          order_id: "order_1",
          amount: 100,
          currency: "INR",
          status: "captured",
        }),
      }),
    );
    prisma.client.payment.findFirst.mockResolvedValue({
      id: "payment_1",
      orderId: "order_internal_1",
      provider: PaymentProvider.RAZORPAY,
      method: "RAZORPAY",
      amountPaise: 100,
      currency: "INR",
      status: PaymentStatus.PENDING,
      providerPaymentId: null,
      providerOrderId: "order_1",
      order: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.PENDING,
        customer: {
          userId: "user_customer",
          user: {
            email: "customer@example.com",
          },
        },
      },
    });
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.verifyRazorpayPayment({ id: "user_customer" } as never, {
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      razorpaySignature: signature,
    });

    expect(result).toEqual({
      received: true,
      paymentId: "payment_1",
      status: PaymentStatus.PAID,
    });
    expect(prisma.client.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment_1", status: PaymentStatus.PENDING, providerPaymentId: null },
      data: {
        status: PaymentStatus.PAID,
        providerPaymentId: "pay_1",
        rawResponse: expect.objectContaining({
          checkoutResponse: expect.objectContaining({
            razorpayOrderId: "order_1",
            razorpayPaymentId: "pay_1",
            signatureVerified: true,
          }),
          providerPayment: expect.objectContaining({
            amount: 100,
            currency: "INR",
            id: "pay_1",
            order_id: "order_1",
            status: "captured",
          }),
        }),
      },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PAYMENT_SUCCESS",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_customer",
      variables: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.PAID,
      },
    });
  });

  it("rejects Razorpay Checkout verification before provider refresh when signature is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    prisma.client.payment.findFirst.mockResolvedValue(createPaymentRecord());
    const service = new PaymentsService(prisma as never, notifications as never);

    await expect(
      service.verifyRazorpayPayment({ id: "user_customer" } as never, {
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "bad_signature_value",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.client.payment.update).not.toHaveBeenCalled();
    expect(prisma.client.payment.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("rejects Razorpay Checkout verification when provider amount differs from the order", async () => {
    const signature = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "pay_1",
          order_id: "order_1",
          amount: 101,
          currency: "INR",
          status: "captured",
        }),
      }),
    );
    prisma.client.payment.findFirst.mockResolvedValue(createPaymentRecord());
    const service = new PaymentsService(prisma as never, notifications as never);

    await expect(
      service.verifyRazorpayPayment({ id: "user_customer" } as never, {
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: signature,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.client.payment.update).not.toHaveBeenCalled();
    expect(prisma.client.payment.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });
});

function createPaymentRecord(overrides: Record<string, unknown> = {}) {
  const orderOverrides = (overrides.order as Record<string, unknown> | undefined) ?? {};
  return {
    id: "payment_1",
    orderId: "order_internal_1",
    provider: PaymentProvider.RAZORPAY,
    method: "RAZORPAY",
    amountPaise: 100,
    currency: "INR",
    status: PaymentStatus.PENDING,
    providerPaymentId: null,
    providerOrderId: "order_1",
    ...overrides,
    order: {
      orderNumber: "1HI202605230001",
      paymentStatus: PaymentStatus.PENDING,
      customer: {
        userId: "user_customer",
        user: {
          email: "customer@example.com",
        },
      },
      ...orderOverrides,
    },
  };
}

function createRazorpayPayload(event: string, paymentId: string, orderId: string) {
  return {
    event,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
        },
      },
    },
  };
}
