import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import {
  DeliveryAssignmentStatus,
  DeliveryStatus,
  EmailRecipientType,
  InventoryMovementType,
  OrderItemLifecycleStatus,
  OrderStatus,
  OrderShipmentPackageStatus,
  PaymentProvider,
  PaymentStatus,
  SellerOrderStatus,
  SellerSettlementStatus,
  ServiceBookingStatus,
  ServicePaymentSettlementTreatment,
  StatusEventType,
} from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
  };
  const financeCalculator = {
    calculateServiceBooking: vi.fn(),
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
      servicePayment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
      },
      servicePaymentEvent: {
        create: vi.fn(),
      },
      serviceBooking: {
        update: vi.fn(),
      },
      serviceBookingSettlement: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      sellerLedgerEntry: {
        create: vi.fn(),
      },
      order: {
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
      productVariant: {
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      orderItem: {
        update: vi.fn(),
      },
      orderSellerSplit: {
        updateMany: vi.fn(),
      },
      orderShipment: {
        updateMany: vi.fn(),
      },
      orderShipmentPackage: {
        updateMany: vi.fn(),
      },
      deliveryDetail: {
        update: vi.fn(),
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
    vi.resetAllMocks();
    prisma.client.$transaction.mockImplementation(
      async (callback: (transactionClient: typeof prisma.client) => Promise<unknown>) =>
        callback(prisma.client),
    );
    prisma.client.setting.findMany.mockResolvedValue([]);
    prisma.client.payment.findUnique.mockImplementation(async () => prisma.client.payment.findFirst());
    prisma.client.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.servicePayment.findUnique.mockImplementation(async () => prisma.client.servicePayment.findFirst());
    prisma.client.servicePayment.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.servicePayment.aggregate.mockResolvedValue({ _sum: { amountPaise: 500 } });
    prisma.client.serviceBooking.update.mockResolvedValue(createServiceBookingRecord({ paidAmountPaise: 500 }));
    prisma.client.serviceBookingSettlement.findUnique.mockResolvedValue(null);
    prisma.client.serviceBookingSettlement.create.mockResolvedValue({ id: "service_settlement_1" });
    prisma.client.sellerLedgerEntry.create.mockResolvedValue({});
    financeCalculator.calculateServiceBooking.mockResolvedValue(createServiceFinanceCalculation());
    prisma.client.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.order.update.mockResolvedValue({});
    prisma.client.productVariant.update.mockResolvedValue({});
    prisma.client.inventoryMovement.create.mockResolvedValue({});
    prisma.client.orderItem.update.mockResolvedValue({});
    prisma.client.orderSellerSplit.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.orderShipment.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.orderShipmentPackage.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.deliveryDetail.update.mockResolvedValue({});
    prisma.client.orderStatusEvent.create.mockResolvedValue({});
    prisma.client.paymentEvent.create.mockResolvedValue({});
    prisma.client.auditLog.create.mockResolvedValue({});
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret";
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "key_secret";
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.API_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.unstubAllGlobals();
  });

  it("returns an absolute Razorpay webhook URL from the public API base", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.1handindia.com/api/";
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.adminPaymentConfiguration();

    expect(result.razorpay.webhookPath).toBe("/api/payments/razorpay/webhook");
    expect(result.razorpay.webhookUrl).toBe(
      "https://api.1handindia.com/api/payments/razorpay/webhook",
    );
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

  it("cancels an unpaid order and restores stock when Razorpay reports payment failure", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.failed", "pay_failed", "order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue(createPaymentRecord());
    prisma.client.payment.findUnique.mockResolvedValue(createPaymentRecord());
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      paymentId: "payment_1",
      status: PaymentStatus.FAILED,
    });
    expect(prisma.client.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment_1", status: PaymentStatus.PENDING, providerPaymentId: null },
      data: {
        status: PaymentStatus.FAILED,
        providerPaymentId: "pay_failed",
        rawResponse: JSON.parse(rawBody.toString()),
      },
    });
    expect(prisma.client.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant_1" },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(prisma.client.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        productVariantId: "variant_1",
        movementType: InventoryMovementType.RETURN,
        quantity: 2,
        reason: "Razorpay reported payment failure before capture.",
        referenceType: "order",
        referenceId: "order_internal_1",
        createdById: null,
      },
    });
    expect(prisma.client.orderItem.update).toHaveBeenCalledWith({
      where: { id: "order_item_1" },
      data: {
        activeQuantity: 0,
        retainedQuantity: 0,
        cancelledQuantity: { increment: 2 },
        cancelledAmountPaise: { increment: 200 },
        lifecycleStatus: OrderItemLifecycleStatus.CANCELLED,
      },
    });
    expect(prisma.client.order.update).toHaveBeenCalledWith({
      where: { id: "order_internal_1" },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        deliveryStatus: DeliveryStatus.CANCELLED,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
      },
    });
    expect(prisma.client.orderSellerSplit.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order_internal_1" },
      data: {
        sellerStatus: SellerOrderStatus.CANCELLED,
        settlementStatus: SellerSettlementStatus.CANCELLED,
        settlementEligibleAt: null,
        payoutId: null,
      },
    });
    expect(prisma.client.orderShipment.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order_internal_1" },
      data: {
        status: DeliveryStatus.CANCELLED,
        assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
        assignmentExpiresAt: null,
      },
    });
    expect(prisma.client.orderShipmentPackage.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order_internal_1",
        status: {
          notIn: [
            OrderShipmentPackageStatus.DELIVERED,
            OrderShipmentPackageStatus.CANCELLED,
            OrderShipmentPackageStatus.FAILED,
            OrderShipmentPackageStatus.RTO_DELIVERED,
          ],
        },
      },
      data: {
        status: OrderShipmentPackageStatus.CANCELLED,
        cancelledAt: expect.any(Date),
      },
    });
    expect(prisma.client.deliveryDetail.update).toHaveBeenCalledWith({
      where: { orderId: "order_internal_1" },
      data: {
        status: DeliveryStatus.CANCELLED,
        assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
        assignmentExpiresAt: null,
      },
    });
    expect(prisma.client.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: "order_internal_1",
        statusType: StatusEventType.ORDER,
        oldStatus: OrderStatus.PLACED,
        newStatus: OrderStatus.CANCELLED,
        note: "Razorpay reported payment failure before capture.",
        createdById: null,
      },
    });
    expect(prisma.client.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: "order_internal_1",
        statusType: StatusEventType.PAYMENT,
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.NOT_REQUIRED,
        note: "Razorpay reported payment failure before capture.",
        createdById: null,
      },
    });
    expect(prisma.client.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: "order_internal_1",
        statusType: StatusEventType.DELIVERY,
        oldStatus: DeliveryStatus.PENDING,
        newStatus: DeliveryStatus.CANCELLED,
        note: "Razorpay reported payment failure before capture.",
        createdById: null,
      },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PAYMENT_FAILED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_customer",
      variables: {
        orderNumber: "1HI202605230001",
        paymentStatus: PaymentStatus.FAILED,
      },
    });
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

  it("verifies Razorpay Checkout for a customer-owned service booking payment", async () => {
    const signature = createHmac("sha256", "key_secret")
      .update("service_order_1|service_pay_1")
      .digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "service_pay_1",
          order_id: "service_order_1",
          amount: 500,
          currency: "INR",
          status: "captured",
        }),
      }),
    );
    prisma.client.servicePayment.findFirst.mockResolvedValue(createServicePaymentRecord());
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.verifyServiceRazorpayPayment(
      { id: "user_customer" } as never,
      "SRV-2026-ABCDEF",
      {
        razorpayOrderId: "service_order_1",
        razorpayPaymentId: "service_pay_1",
        razorpaySignature: signature,
      },
    );

    expect(result).toEqual({
      received: true,
      paymentId: "service_payment_1",
      status: PaymentStatus.PAID,
    });
    expect(prisma.client.servicePayment.updateMany).toHaveBeenCalledWith({
      where: { id: "service_payment_1", status: PaymentStatus.PENDING, providerPaymentId: null },
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        providerPaymentId: "service_pay_1",
        rawResponse: expect.objectContaining({
          checkoutResponse: expect.objectContaining({
            bookingNumber: "SRV-2026-ABCDEF",
            razorpayOrderId: "service_order_1",
            razorpayPaymentId: "service_pay_1",
            signatureVerified: true,
          }),
        }),
        paidAt: expect.any(Date),
      }),
    });
    expect(prisma.client.serviceBooking.update).toHaveBeenCalledWith({
      where: { id: "service_booking_1" },
      data: { paidAmountPaise: 500 },
      include: expect.any(Object),
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "PAYMENT_SUCCESS",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_customer",
      variables: expect.objectContaining({
        orderNumber: "SRV-2026-ABCDEF",
        bookingNumber: "SRV-2026-ABCDEF",
        serviceTitle: "AC repair",
        paymentStatus: PaymentStatus.PAID,
      }),
    });
  });

  it("creates service settlement with finance rule deductions after a completed Razorpay service payment", async () => {
    const signature = createHmac("sha256", "key_secret")
      .update("service_order_1|service_pay_1")
      .digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "service_pay_1",
          order_id: "service_order_1",
          amount: 500,
          currency: "INR",
          status: "captured",
        }),
      }),
    );
    const completedBooking = createServiceBookingRecord({
      status: ServiceBookingStatus.COMPLETED,
      paidAmountPaise: 500,
      payments: [
        {
          id: "service_payment_1",
          amountPaise: 500,
          status: PaymentStatus.PAID,
          settlementTreatment: ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE,
        },
      ],
      listing: {
        categoryId: "category_1",
        title: "AC repair",
      },
    });
    prisma.client.servicePayment.findFirst.mockResolvedValue(
      createServicePaymentRecord({ booking: completedBooking }),
    );
    prisma.client.serviceBooking.update.mockResolvedValue(completedBooking);
    const service = new PaymentsService(
      prisma as never,
      notifications as never,
      undefined,
      undefined,
      financeCalculator as never,
    );

    await service.verifyServiceRazorpayPayment(
      { id: "user_customer" } as never,
      "SRV-2026-ABCDEF",
      {
        razorpayOrderId: "service_order_1",
        razorpayPaymentId: "service_pay_1",
        razorpaySignature: signature,
      },
    );

    expect(financeCalculator.calculateServiceBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "service_booking_1",
        bookingNumber: "SRV-2026-ABCDEF",
        status: ServiceBookingStatus.COMPLETED,
      }),
      500,
      prisma.client,
    );
    expect(prisma.client.serviceBookingSettlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: "service_booking_1",
        sellerId: "seller_1",
        grossAmountPaise: 500,
        commissionPaise: 40,
        gstOnCommissionPaise: 7,
        tdsPaise: 5,
        tcsPaise: 1,
        platformFeePaise: 10,
        netPayablePaise: 437,
        financeSnapshot: expect.objectContaining({ source: "service_booking_test" }),
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "SERVICE_EARNING",
        creditPaise: 500,
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "SERVICE_COMMISSION",
        debitPaise: 40,
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "GST_ON_COMMISSION",
        debitPaise: 7,
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "TDS_DEDUCTION",
        debitPaise: 5,
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "TCS_DEDUCTION",
        debitPaise: 1,
      }),
    });
    expect(prisma.client.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: "PLATFORM_FEE",
        debitPaise: 10,
      }),
    });
  });

  it("blocks service Razorpay verification when the payment belongs to another customer", async () => {
    vi.stubGlobal("fetch", vi.fn());
    prisma.client.servicePayment.findFirst.mockResolvedValue(
      createServicePaymentRecord({
        booking: createServiceBookingRecord({
          customer: {
            userId: "user_other",
            user: { email: "other@example.com" },
          },
        }),
      }),
    );
    const service = new PaymentsService(prisma as never, notifications as never);

    await expect(
      service.verifyServiceRazorpayPayment(
        { id: "user_customer" } as never,
        "SRV-2026-ABCDEF",
        {
          razorpayOrderId: "service_order_1",
          razorpayPaymentId: "service_pay_1",
          razorpaySignature: "bad_signature_value",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.client.servicePayment.updateMany).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("updates service payment state when a Razorpay webhook has no matching order payment", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.captured", "service_pay_1", "service_order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue(null);
    prisma.client.servicePayment.findFirst.mockResolvedValue(createServicePaymentRecord());
    const service = new PaymentsService(prisma as never, notifications as never);

    const result = await service.handleRazorpayWebhook(
      signature,
      JSON.parse(rawBody.toString()),
      rawBody,
    );

    expect(result).toEqual({
      received: true,
      paymentId: "service_payment_1",
      status: PaymentStatus.PAID,
    });
    expect(prisma.client.servicePayment.updateMany).toHaveBeenCalledWith({
      where: { id: "service_payment_1", status: PaymentStatus.PENDING, providerPaymentId: null },
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        providerPaymentId: "service_pay_1",
      }),
    });
    expect(prisma.client.order.updateMany).not.toHaveBeenCalled();
  });

  it("does not downgrade a paid service payment when a late failed webhook arrives", async () => {
    const rawBody = Buffer.from(
      JSON.stringify(createRazorpayPayload("payment.failed", "service_pay_failed", "service_order_1")),
    );
    const signature = createHmac("sha256", "webhook_secret").update(rawBody).digest("hex");
    prisma.client.payment.findFirst.mockResolvedValue(null);
    prisma.client.servicePayment.findFirst.mockResolvedValue(
      createServicePaymentRecord({
        status: PaymentStatus.PAID,
        providerPaymentId: "service_pay_paid",
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
      paymentId: "service_payment_1",
      status: PaymentStatus.PAID,
      reason: "paid_payment_is_terminal",
    });
    expect(prisma.client.servicePayment.updateMany).not.toHaveBeenCalled();
    expect(prisma.client.serviceBooking.update).not.toHaveBeenCalled();
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
      id: "order_internal_1",
      orderNumber: "1HI202605230001",
      orderStatus: OrderStatus.PLACED,
      paymentStatus: PaymentStatus.PENDING,
      deliveryStatus: DeliveryStatus.PENDING,
      items: [
        {
          id: "order_item_1",
          productVariantId: "variant_1",
          quantity: 2,
          activeQuantity: 2,
          cancelledQuantity: 0,
          retainedQuantity: 2,
          unitPricePaise: 100,
        },
      ],
      deliveryDetail: {
        id: "delivery_detail_1",
        orderId: "order_internal_1",
        status: DeliveryStatus.PENDING,
        assignmentStatus: DeliveryAssignmentStatus.UNASSIGNED,
      },
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

function createServiceBookingRecord(overrides: Record<string, unknown> = {}) {
  const customerOverrides = (overrides.customer as Record<string, unknown> | undefined) ?? {};
  const listingOverrides = (overrides.listing as Record<string, unknown> | undefined) ?? {};
  return {
    id: "service_booking_1",
    bookingNumber: "SRV-2026-ABCDEF",
    customerId: "customer_1",
    sellerId: "seller_1",
    serviceListingId: "service_listing_1",
    status: ServiceBookingStatus.REQUESTED,
    paymentMode: "FULL_PAYMENT",
    inspectionFeePaise: 0,
    totalPayablePaise: 500,
    paidAmountPaise: 0,
    currency: "INR",
    settlement: null,
    seller: {
      userId: "user_seller",
      user: { email: "seller@example.com" },
    },
    listing: {
      id: "service_listing_1",
      title: "AC repair",
      categoryId: "category_1",
      ...listingOverrides,
    },
    customer: {
      userId: "user_customer",
      user: {
        email: "customer@example.com",
      },
      ...customerOverrides,
    },
    ...overrides,
  };
}

function createServicePaymentRecord(overrides: Record<string, unknown> = {}) {
  const booking = (overrides.booking as Record<string, unknown> | undefined) ?? createServiceBookingRecord();
  return {
    id: "service_payment_1",
    bookingId: "service_booking_1",
    sellerId: "seller_1",
    provider: PaymentProvider.RAZORPAY,
    purpose: "FULL_PAYMENT",
    amountPaise: 500,
    currency: "INR",
    status: PaymentStatus.PENDING,
    providerPaymentId: null,
    providerOrderId: "service_order_1",
    paidAt: null,
    booking,
    ...overrides,
  };
}

function createServiceFinanceCalculation(overrides: Record<string, unknown> = {}) {
  return {
    grossAmountPaise: 500,
    inspectionFeeGrossPaise: 0,
    commissionPaise: 40,
    gstOnCommissionPaise: 7,
    tdsPaise: 5,
    tcsPaise: 1,
    platformFeePaise: 10,
    refundAdjustmentPaise: 0,
    netPayablePaise: 437,
    snapshot: {
      source: "service_booking_test",
    },
    ...overrides,
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
