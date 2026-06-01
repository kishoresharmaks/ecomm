import {
  ContentStatus,
  EmailRecipientType,
  EmailTemplateCategory,
  NotificationChannel,
  NotificationStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailDeliveryService } from "./email-delivery.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const prisma = {
    client: {
      notificationTemplate: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      emailTriggerRule: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      emailTheme: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      emailSetting: {
        findFirst: vi.fn(),
      },
      notificationLog: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
  const queue = {
    enqueueEmail: vi.fn(),
    isAvailable: vi.fn(),
  };
  const emailDelivery = {
    deliver: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.client.emailSetting.findFirst.mockResolvedValue({
      provider: "smtp",
      senderName: "1HandIndia",
      senderEmail: "no-reply@1handindia.test",
      isEnabled: true,
    });
    prisma.client.emailTheme.upsert.mockResolvedValue({
      status: ContentStatus.PUBLISHED,
      tokens: {
        brandColor: "#ED3500",
        accentColor: "#163B5C",
        backgroundColor: "#FFFCFB",
        surfaceColor: "#FFFFFF",
        textColor: "#1F2933",
        mutedTextColor: "#667085",
        buttonBackgroundColor: "#ED3500",
        buttonTextColor: "#FFFFFF",
        buttonStyle: "SOLID",
        footerText: "Default footer",
        borderRadius: 8,
        fontFamily: "Arial",
      },
    });
    prisma.client.emailTriggerRule.findUnique.mockReset();
    prisma.client.emailTriggerRule.create.mockReset();
    queue.enqueueEmail.mockResolvedValue(false);
    queue.isAvailable.mockReturnValue(false);
    emailDelivery.deliver.mockResolvedValue({ providerMessageId: "smtp-dev-log_1" });
    prisma.client.notificationLog.updateMany.mockResolvedValue({ count: 1 });
  });

  it("stores rendered subject, body, and variables before sending an email", async () => {
    prisma.client.notificationTemplate.findUnique.mockResolvedValue({
      code: "ORDER_PLACED_CUSTOMER",
      channel: NotificationChannel.EMAIL,
      subject: "Order {{ orderNumber }} placed",
      body: "Total amount {{ totalPaise }}",
      status: ContentStatus.PUBLISHED,
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_1" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({
      id: "log_1",
      status: NotificationStatus.SENT,
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notify({
      templateCode: "ORDER_PLACED_CUSTOMER",
      recipient: "customer@example.com",
      userId: "user_1",
      variables: {
        orderNumber: "1HI202605260001",
        totalPaise: 125000,
        note: undefined,
      },
    });

    expect(prisma.client.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        templateCode: "ORDER_PLACED_CUSTOMER",
        recipient: "customer@example.com",
        subject: "Order 1HI202605260001 placed",
        body: expect.stringContaining("Total amount 125000"),
        variables: {
          orderNumber: "1HI202605260001",
          totalPaise: 125000,
        },
        status: NotificationStatus.PENDING,
        user: { connect: { id: "user_1" } },
      }),
    });
    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationLogId: "log_1",
        recipient: "customer@example.com",
        subject: "Order 1HI202605260001 placed",
        body: expect.stringContaining("Total amount 125000"),
        templateCode: "ORDER_PLACED_CUSTOMER",
      }),
    );
    expect(prisma.client.notificationLog.updateMany).toHaveBeenCalledWith({
      where: {
        id: "log_1",
        status: NotificationStatus.PENDING,
        providerMessageId: expect.stringContaining("delivery-lock:log_1"),
      },
      data: {
        status: NotificationStatus.SENT,
        providerMessageId: "smtp-dev-log_1",
        errorMessage: null,
        sentAt: expect.any(Date),
      },
    });
  });

  it("does not deliver when another sender already claimed the email log", async () => {
    prisma.client.notificationTemplate.findUnique.mockResolvedValue({
      code: "ORDER_PLACED_CUSTOMER",
      channel: NotificationChannel.EMAIL,
      subject: "Order placed",
      body: "Your order is placed.",
      status: ContentStatus.PUBLISHED,
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_claimed" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({
      id: "log_claimed",
      status: NotificationStatus.PENDING,
    });
    prisma.client.notificationLog.updateMany.mockResolvedValueOnce({ count: 0 });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notify({
      templateCode: "ORDER_PLACED_CUSTOMER",
      recipient: "customer@example.com",
    });

    expect(emailDelivery.deliver).not.toHaveBeenCalled();
    expect(prisma.client.notificationLog.updateMany).toHaveBeenCalledWith({
      where: {
        id: "log_claimed",
        status: NotificationStatus.PENDING,
        providerMessageId: null,
        sentAt: null,
      },
      data: {
        providerMessageId: expect.stringContaining("delivery-lock:log_claimed"),
        errorMessage:
          "Email delivery in progress. Duplicate sends are blocked by a delivery lock.",
      },
    });
  });

  it("retries a skipped log using the original stored variables", async () => {
    prisma.client.notificationLog.findUnique
      .mockResolvedValueOnce({
        id: "log_retry",
        templateCode: "PAYMENT_SUCCESS",
        recipient: "customer@example.com",
        status: NotificationStatus.SKIPPED,
        errorMessage: "Provider settings were missing.",
        createdAt: new Date(),
        scheduledFor: null,
        variables: {
          orderNumber: "1HI202605260002",
          paymentStatus: "PAID",
        },
      })
      .mockResolvedValueOnce({
        id: "log_retry",
        status: NotificationStatus.SENT,
      });
    prisma.client.notificationTemplate.findUnique.mockResolvedValue({
      code: "PAYMENT_SUCCESS",
      channel: NotificationChannel.EMAIL,
      subject: "Payment {{ paymentStatus }}",
      body: "Order {{ orderNumber }} is paid",
      status: ContentStatus.PUBLISHED,
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.retryLog("log_retry");

    expect(prisma.client.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_retry" },
      data: {
        subject: "Payment PAID",
        body: expect.stringContaining("Order 1HI202605260002 is paid"),
      },
    });
    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationLogId: "log_retry",
        recipient: "customer@example.com",
        subject: "Payment PAID",
        body: expect.stringContaining("Order 1HI202605260002 is paid"),
        templateCode: "PAYMENT_SUCCESS",
      }),
    );
  });

  it("does not resend historical logs skipped while email sending was disabled", async () => {
    prisma.client.notificationLog.findUnique.mockResolvedValueOnce({
      id: "log_disabled",
      templateCode: "ORDER_PLACED_CUSTOMER",
      recipient: "customer@example.com",
      status: NotificationStatus.SKIPPED,
      errorMessage: "Email sending is disabled in email settings.",
      createdAt: new Date(),
      scheduledFor: null,
      variables: {
        orderNumber: "1HI202605260003",
      },
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.retryLog("log_disabled");

    expect(prisma.client.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_disabled" },
      data: {
        status: NotificationStatus.SKIPPED,
        errorMessage: expect.stringContaining("will not be resent later"),
      },
    });
    expect(queue.enqueueEmail).not.toHaveBeenCalled();
    expect(emailDelivery.deliver).not.toHaveBeenCalled();
  });

  it("renders standalone http links as themed email buttons and escapes unsafe body text", async () => {
    prisma.client.notificationTemplate.findUnique.mockResolvedValue({
      code: "SUPPORT_CREATED",
      channel: NotificationChannel.EMAIL,
      subject: "Support {{ ticketNumber }}",
      body: "Hello {{ customerName }}\nhttps://1handindia.test/support/tickets/123\n<script>alert(1)</script>",
      status: ContentStatus.PUBLISHED,
      styleOverrides: {
        buttonStyle: "OUTLINE",
        buttonBackgroundColor: "#163B5C",
        surfaceColor: "#FFFFFF",
        borderRadius: 10,
      },
      theme: {
        status: ContentStatus.PUBLISHED,
        tokens: {
          brandColor: "#ED3500",
          accentColor: "#163B5C",
          backgroundColor: "#FFFCFB",
          surfaceColor: "#FFFFFF",
          textColor: "#1F2933",
          mutedTextColor: "#667085",
          buttonBackgroundColor: "#ED3500",
          buttonTextColor: "#FFFFFF",
          buttonStyle: "SOLID",
          footerText: "Theme footer",
          borderRadius: 8,
          fontFamily: "Arial",
        },
      },
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_button" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({
      id: "log_button",
      status: NotificationStatus.SENT,
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notify({
      templateCode: "SUPPORT_CREATED",
      recipient: "customer@example.com",
      variables: {
        customerName: "Support Customer",
        ticketNumber: "SUP-123",
      },
    });

    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Support SUP-123",
        body: expect.stringContaining('href="https://1handindia.test/support/tickets/123"'),
      }),
    );
    const payload = emailDelivery.deliver.mock.calls[0]?.[0];
    expect(payload?.body).toContain("Open link");
    expect(payload?.body).toContain("background:#FFFFFF");
    expect(payload?.body).toContain("color:#163B5C");
    expect(payload?.body).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(payload?.body).not.toContain("<script>alert(1)</script>");
  });

  it("uses the current published default theme when a template has no selected theme", async () => {
    prisma.client.emailTheme.upsert.mockResolvedValueOnce({
      status: ContentStatus.PUBLISHED,
      tokens: {
        brandColor: "#0F8A5F",
        accentColor: "#163B5C",
        backgroundColor: "#FAF7F0",
        surfaceColor: "#FFFFFF",
        textColor: "#1F2933",
        mutedTextColor: "#667085",
        buttonBackgroundColor: "#0F8A5F",
        buttonTextColor: "#FFFFFF",
        buttonStyle: "SOLID",
        footerText: "Edited default footer",
        borderRadius: 12,
        fontFamily: "Verdana",
      },
    });
    prisma.client.notificationTemplate.findUnique.mockResolvedValue({
      code: "ORDER_DELIVERED_CUSTOMER",
      channel: NotificationChannel.EMAIL,
      subject: "Delivered",
      body: "Your order is delivered.",
      status: ContentStatus.PUBLISHED,
      theme: null,
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_default_theme" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({
      id: "log_default_theme",
      status: NotificationStatus.SENT,
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notify({
      templateCode: "ORDER_DELIVERED_CUSTOMER",
      recipient: "customer@example.com",
    });

    const payload = emailDelivery.deliver.mock.calls[0]?.[0];
    expect(payload?.body).toContain("#0F8A5F");
    expect(payload?.body).toContain("Edited default footer");
    expect(payload?.body).toContain("border-radius:12px");
  });

  it("sends customer registration through the trigger mapping and stores trigger metadata", async () => {
    prisma.client.emailTriggerRule.findUnique.mockResolvedValue({
      id: "trigger_customer_registered",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: true,
      delayMinutes: 0,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{ customerName }}",
        body: "Hello {{ customerName }}",
        status: ContentStatus.PUBLISHED,
        theme: null,
      },
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_trigger" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({
      id: "log_trigger",
      status: NotificationStatus.SENT,
    });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notifyEvent({
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_customer",
      variables: { customerName: "Priya" },
    });

    expect(prisma.client.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateCode: "CUSTOMER_ACCOUNT_CREATED",
        eventCode: "CUSTOMER_REGISTERED",
        recipientType: EmailRecipientType.CUSTOMER,
        triggerRule: { connect: { id: "trigger_customer_registered" } },
        subject: "Welcome Priya",
        status: NotificationStatus.PENDING,
      }),
    });
    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: "CUSTOMER_ACCOUNT_CREATED",
        subject: "Welcome Priya",
      }),
    );
  });

  it("creates a skipped log when a trigger is disabled", async () => {
    prisma.client.emailTriggerRule.findUnique.mockResolvedValue({
      id: "trigger_disabled",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: false,
      delayMinutes: 0,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome",
        body: "Hello",
        status: ContentStatus.PUBLISHED,
      },
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_skipped" });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notifyEvent({
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
    });

    expect(prisma.client.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateCode: "CUSTOMER_ACCOUNT_CREATED",
        status: NotificationStatus.SKIPPED,
        errorMessage: "Email trigger is disabled.",
      }),
    });
    expect(queue.enqueueEmail).not.toHaveBeenCalled();
  });

  it("sends trigger email immediately even when a legacy delay is configured", async () => {
    queue.isAvailable.mockReturnValue(true);
    queue.enqueueEmail.mockResolvedValue(true);
    prisma.client.emailTriggerRule.findUnique.mockResolvedValue({
      id: "trigger_delayed",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: true,
      delayMinutes: 30,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{ customerName }}",
        body: "Hello {{ customerName }}",
        status: ContentStatus.PUBLISHED,
        theme: null,
      },
    });
    prisma.client.emailTriggerRule.update.mockResolvedValue({
      id: "trigger_delayed",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: true,
      delayMinutes: 0,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{ customerName }}",
        body: "Hello {{ customerName }}",
        status: ContentStatus.PUBLISHED,
        theme: null,
      },
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_delayed" });
    prisma.client.notificationLog.findUnique.mockResolvedValue({ id: "log_delayed" });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notifyEvent({
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      variables: { customerName: "Priya" },
    });

    const createdLogData = prisma.client.notificationLog.create.mock.calls[0]?.[0]?.data;
    expect(createdLogData).toEqual(
      expect.objectContaining({
        status: NotificationStatus.PENDING,
      }),
    );
    expect(createdLogData?.scheduledFor).toBeUndefined();
    expect(prisma.client.emailTriggerRule.update).toHaveBeenCalledWith({
      where: { id: "trigger_delayed" },
      data: { delayMinutes: 0 },
      include: { template: { include: { theme: true } } },
    });
    expect(queue.enqueueEmail).not.toHaveBeenCalled();
    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationLogId: "log_delayed",
        templateCode: "CUSTOMER_ACCOUNT_CREATED",
        subject: "Welcome Priya",
      }),
    );
  });

  it("still sends legacy delayed trigger email immediately when queue is unavailable", async () => {
    queue.isAvailable.mockReturnValue(false);
    prisma.client.emailTriggerRule.findUnique.mockResolvedValue({
      id: "trigger_delayed_unavailable",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: true,
      delayMinutes: 15,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{ customerName }}",
        body: "Hello {{ customerName }}",
        status: ContentStatus.PUBLISHED,
        theme: null,
      },
    });
    prisma.client.emailTriggerRule.update.mockResolvedValue({
      id: "trigger_delayed_unavailable",
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      category: EmailTemplateCategory.CUSTOMER,
      isEnabled: true,
      delayMinutes: 0,
      templateId: "template_customer",
      template: {
        code: "CUSTOMER_ACCOUNT_CREATED",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{ customerName }}",
        body: "Hello {{ customerName }}",
        status: ContentStatus.PUBLISHED,
        theme: null,
      },
    });
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_delay_skip" });

    const service = new NotificationsService(
      prisma as never,
      queue as unknown as NotificationQueueService,
      emailDelivery as unknown as EmailDeliveryService,
    );

    await service.notifyEvent({
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      variables: { customerName: "Priya" },
    });

    const createdLogData = prisma.client.notificationLog.create.mock.calls[0]?.[0]?.data;
    expect(createdLogData).toEqual(
      expect.objectContaining({
        status: NotificationStatus.PENDING,
      }),
    );
    expect(createdLogData?.scheduledFor).toBeUndefined();
    expect(prisma.client.emailTriggerRule.update).toHaveBeenCalledWith({
      where: { id: "trigger_delayed_unavailable" },
      data: { delayMinutes: 0 },
      include: { template: { include: { theme: true } } },
    });
    expect(queue.enqueueEmail).not.toHaveBeenCalled();
    expect(emailDelivery.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationLogId: "log_delay_skip",
        templateCode: "CUSTOMER_ACCOUNT_CREATED",
        subject: "Welcome Priya",
      }),
    );
  });
});
