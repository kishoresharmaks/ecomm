import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  EmailRecipientType,
  DeliveryStatus,
  InventoryMovementType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SellerOrderStatus,
  SellerSettlementStatus,
  SettingValueType,
  StatusEventType,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReturnsService } from "../returns/returns.service";
import { SellerSubscriptionsService } from "../sellers/seller-subscriptions.service";
import { readBooleanSetting, readNumberSetting } from "../settings/setting-value-utils";
import { UpsertPaymentConfigurationDto } from "./dto/payment-config.dto";
import { VerifyRazorpayPaymentDto } from "./dto/razorpay-payment.dto";

const PAYMENT_SETTING_KEYS = {
  razorpayEnabled: "payments.razorpay.enabled",
  razorpayMode: "payments.razorpay.mode",
  razorpayKeyId: "payments.razorpay.key_id",
  razorpayKeySecret: "payments.razorpay.key_secret",
  razorpayWebhookSecret: "payments.razorpay.webhook_secret",
  codEnabled: "checkout.cod.enabled",
  codInstructions: "payments.cod.instructions",
  codMaxOrderPaise: "payments.cod.max_order_paise",
  bankTransferEnabled: "payments.bank_transfer.enabled",
  bankTransferAccountHolderName: "payments.bank_transfer.account_holder_name",
  bankTransferBankName: "payments.bank_transfer.bank_name",
  bankTransferAccountNumber: "payments.bank_transfer.account_number",
  bankTransferIfscCode: "payments.bank_transfer.ifsc_code",
  bankTransferBranch: "payments.bank_transfer.branch",
  bankTransferUpiId: "payments.bank_transfer.upi_id",
  bankTransferInstructions: "payments.bank_transfer.instructions",
  bankTransferReferenceRequired: "payments.bank_transfer.reference_required",
  manualEnabled: "payments.manual.enabled",
} as const;

const paymentConfigKeys = Object.values(PAYMENT_SETTING_KEYS);
const defaultCodInstructions = "Pay cash to the delivery partner when the order is delivered.";
const defaultBankTransferInstructions =
  "Transfer the order amount to the platform bank or UPI account and enter the UTR/reference for finance verification.";

type RazorpayPaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: {
      include: {
        customer: {
          include: {
            user: true;
          };
        };
      };
    };
  };
}>;

type RazorpayPaymentEntity = {
  id?: string | undefined;
  orderId?: string | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
  status?: string | undefined;
};

type RazorpayFetchedPayment = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  [key: string]: unknown;
};

type PaymentSettingMap = Map<string, Prisma.JsonValue>;
type PaymentSettingWrite = {
  key: string;
  group: string;
  valueType: SettingValueType;
  value: Prisma.InputJsonValue;
};
type PaymentSettingClient = Prisma.TransactionClient | PrismaService["client"];

type CheckoutPaymentMethodSnapshot = Awaited<
  ReturnType<PaymentsService["checkoutMethods"]>
>["methods"][number];

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Optional()
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions?: SellerSubscriptionsService,
    @Optional()
    @Inject(ReturnsService)
    private readonly returnsService?: ReturnsService,
  ) {}

  async readiness() {
    const settingMap = await this.paymentSettingMap();
    const razorpayKeys = this.razorpayKeysFromSettings(settingMap);
    const bankTransferDetails = this.bankTransferDetailsFromSettings(settingMap);

    return {
      razorpay: {
        configured: razorpayKeys.configured,
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayEnabled, false),
        mode: this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayMode, "TEST"),
        keyIdPreview: this.maskValue(razorpayKeys.keyId),
      },
      cod: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.codEnabled, false),
        maxOrderPaise: this.numberSetting(settingMap, PAYMENT_SETTING_KEYS.codMaxOrderPaise, 0),
      },
      bankTransfer: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferEnabled, false),
        configured: bankTransferDetails.configured,
        destinationPreview:
          bankTransferDetails.upiId || this.maskValue(bankTransferDetails.accountNumber),
      },
      manual: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.manualEnabled, false),
      },
      webhook: {
        configured: Boolean(this.razorpayWebhookSecretFromSettings(settingMap)),
      },
    };
  }

  async adminPaymentConfiguration() {
    const settingMap = await this.paymentSettingMap();
    const razorpayKeys = this.razorpayKeysFromSettings(settingMap);
    const webhookSecret = this.razorpayWebhookSecretFromSettings(settingMap);
    const bankTransferDetails = this.bankTransferDetailsFromSettings(settingMap);

    return {
      razorpay: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayEnabled, false),
        mode: this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayMode, "TEST"),
        configured: razorpayKeys.configured,
        keyIdConfigured: Boolean(razorpayKeys.keyId),
        keyIdPreview: this.maskValue(razorpayKeys.keyId),
        keySecretConfigured: Boolean(razorpayKeys.keySecret),
        webhookSecretConfigured: Boolean(webhookSecret),
        webhookPath: "/api/payments/razorpay/webhook",
      },
      cod: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.codEnabled, false),
        instructions: this.stringSetting(
          settingMap,
          PAYMENT_SETTING_KEYS.codInstructions,
          defaultCodInstructions,
        ),
        maxOrderPaise: this.numberSetting(settingMap, PAYMENT_SETTING_KEYS.codMaxOrderPaise, 0),
      },
      bankTransfer: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferEnabled, false),
        configured: bankTransferDetails.configured,
        accountHolderName: bankTransferDetails.accountHolderName,
        bankName: bankTransferDetails.bankName,
        accountNumber: bankTransferDetails.accountNumber,
        ifscCode: bankTransferDetails.ifscCode,
        branch: bankTransferDetails.branch,
        upiId: bankTransferDetails.upiId,
        instructions: bankTransferDetails.instructions,
        referenceRequired: bankTransferDetails.referenceRequired,
      },
      manual: {
        enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.manualEnabled, false),
      },
    };
  }

  async updatePaymentConfiguration(actor: RequestUser, dto: UpsertPaymentConfigurationDto) {
    const before = await this.adminPaymentConfiguration();
    const writes: PaymentSettingWrite[] = [];

    if (dto.razorpay) {
      if (dto.razorpay.enabled !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayEnabled,
            "payments",
            SettingValueType.BOOLEAN,
            dto.razorpay.enabled,
          ),
        );
      }
      if (dto.razorpay.mode) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayMode,
            "payments",
            SettingValueType.STRING,
            dto.razorpay.mode,
          ),
        );
      }
      if (dto.razorpay.keyId !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayKeyId,
            "payments",
            SettingValueType.STRING,
            dto.razorpay.keyId.trim(),
          ),
        );
      }
      if (dto.razorpay.clearKeySecret) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayKeySecret,
            "payments",
            SettingValueType.STRING,
            "",
          ),
        );
      } else if (dto.razorpay.keySecret?.trim()) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayKeySecret,
            "payments",
            SettingValueType.STRING,
            dto.razorpay.keySecret.trim(),
          ),
        );
      }
      if (dto.razorpay.clearWebhookSecret) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayWebhookSecret,
            "payments",
            SettingValueType.STRING,
            "",
          ),
        );
      } else if (dto.razorpay.webhookSecret?.trim()) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.razorpayWebhookSecret,
            "payments",
            SettingValueType.STRING,
            dto.razorpay.webhookSecret.trim(),
          ),
        );
      }
    }

    if (dto.cod) {
      if (dto.cod.enabled !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.codEnabled,
            "checkout",
            SettingValueType.BOOLEAN,
            dto.cod.enabled,
          ),
        );
      }
      if (dto.cod.instructions !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.codInstructions,
            "payments",
            SettingValueType.STRING,
            dto.cod.instructions.trim(),
          ),
        );
      }
      if (dto.cod.maxOrderPaise !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.codMaxOrderPaise,
            "payments",
            SettingValueType.NUMBER,
            dto.cod.maxOrderPaise,
          ),
        );
      }
    }

    if (dto.bankTransfer) {
      if (dto.bankTransfer.enabled !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferEnabled,
            "payments",
            SettingValueType.BOOLEAN,
            dto.bankTransfer.enabled,
          ),
        );
      }
      if (dto.bankTransfer.accountHolderName !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferAccountHolderName,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.accountHolderName.trim(),
          ),
        );
      }
      if (dto.bankTransfer.bankName !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferBankName,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.bankName.trim(),
          ),
        );
      }
      if (dto.bankTransfer.accountNumber !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferAccountNumber,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.accountNumber.trim(),
          ),
        );
      }
      if (dto.bankTransfer.ifscCode !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferIfscCode,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.ifscCode.trim(),
          ),
        );
      }
      if (dto.bankTransfer.branch !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferBranch,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.branch.trim(),
          ),
        );
      }
      if (dto.bankTransfer.upiId !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferUpiId,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.upiId.trim(),
          ),
        );
      }
      if (dto.bankTransfer.instructions !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferInstructions,
            "payments",
            SettingValueType.STRING,
            dto.bankTransfer.instructions.trim(),
          ),
        );
      }
      if (dto.bankTransfer.referenceRequired !== undefined) {
        writes.push(
          this.paymentSettingWrite(
            PAYMENT_SETTING_KEYS.bankTransferReferenceRequired,
            "payments",
            SettingValueType.BOOLEAN,
            dto.bankTransfer.referenceRequired,
          ),
        );
      }
    }

    if (dto.manual?.enabled !== undefined) {
      writes.push(
        this.paymentSettingWrite(
          PAYMENT_SETTING_KEYS.manualEnabled,
          "payments",
          SettingValueType.BOOLEAN,
          dto.manual.enabled,
        ),
      );
    }

    if (writes.length) {
      await this.prisma.client.$transaction(async (tx) => {
        for (const write of writes) {
          await tx.setting.upsert({
            where: { key: write.key },
            update: {
              value: write.value,
              valueType: write.valueType,
              group: write.group,
            },
            create: write,
          });
        }
      });
      const after = await this.adminPaymentConfiguration();
      await this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "payments.configuration.updated",
          entityType: "payment_configuration",
          oldValue: before as Prisma.InputJsonValue,
          newValue: after as Prisma.InputJsonValue,
        },
      });
    }

    return this.adminPaymentConfiguration();
  }

  async checkoutMethods(totalPaise = 0, client: PaymentSettingClient = this.prisma.client) {
    const settingMap = await this.paymentSettingMap(client);
    const razorpayKeys = this.razorpayKeysFromSettings(settingMap);
    const codEnabled = this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.codEnabled, false);
    const codMaxOrderPaise = this.numberSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.codMaxOrderPaise,
      0,
    );
    const codAllowed = codEnabled && (codMaxOrderPaise <= 0 || totalPaise <= codMaxOrderPaise);
    const bankTransferDetails = this.bankTransferDetailsFromSettings(settingMap);
    const bankTransferEnabled = this.booleanSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.bankTransferEnabled,
      false,
    );

    return {
      methods: [
        {
          method: "RAZORPAY",
          label: "Razorpay",
          enabled:
            this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayEnabled, false) &&
            razorpayKeys.configured,
          note: razorpayKeys.configured
            ? "Pay online using Razorpay Checkout."
            : "Razorpay keys are not configured.",
        },
        {
          method: "COD",
          label: "Cash on delivery",
          enabled: codAllowed,
          note:
            codMaxOrderPaise > 0
              ? `Available up to INR ${(codMaxOrderPaise / 100).toLocaleString("en-IN")}.`
              : "Pay when the order is delivered.",
          instructions: this.stringSetting(
            settingMap,
            PAYMENT_SETTING_KEYS.codInstructions,
            defaultCodInstructions,
          ),
          maxOrderPaise: codMaxOrderPaise,
        },
        {
          method: "BANK_TRANSFER",
          label: "Bank transfer",
          enabled: bankTransferEnabled && bankTransferDetails.configured,
          note: bankTransferDetails.configured
            ? "Transfer to the platform bank or UPI account. Finance verifies the reference before marking paid."
            : "Bank transfer details are not configured.",
          instructions: bankTransferDetails.instructions,
          bankTransferDetails,
        },
        {
          method: "MANUAL",
          label: "Manual payment",
          enabled: this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.manualEnabled, false),
          note: "Admin-confirmed offline payment.",
        },
      ],
    };
  }

  async checkoutMethodSnapshot(
    paymentMethod: string,
    totalPaise = 0,
    client: PaymentSettingClient = this.prisma.client,
  ): Promise<CheckoutPaymentMethodSnapshot> {
    const methods = await this.checkoutMethods(totalPaise, client);
    const method = methods.methods.find((item) => item.method === paymentMethod);

    if (!method) {
      throw new BadRequestException("Unsupported payment method.");
    }

    return method;
  }

  async ensureCheckoutMethodAllowed(
    paymentMethod: string,
    totalPaise = 0,
    client: PaymentSettingClient = this.prisma.client,
  ) {
    const methods = await this.checkoutMethods(totalPaise, client);
    const method = methods.methods.find((item) => item.method === paymentMethod);

    if (!method) {
      throw new BadRequestException("Unsupported payment method.");
    }

    if (!method.enabled) {
      throw new BadRequestException(
        `${method.label} is not available for checkout. ${method.note}`,
      );
    }
  }

  async cancelRazorpayOrder(actor: RequestUser, orderNumber: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { orderNumber },
      include: {
        customer: true,
        items: true,
        payments: true,
        deliveryDetail: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found.");
    }

    if (order.customer.userId !== actor.id) {
      throw new ForbiddenException("Order does not belong to the authenticated customer.");
    }

    if (order.orderStatus === OrderStatus.CANCELLED) {
      return { orderNumber, cancelled: true };
    }

    const razorpayPayment = order.payments.find(
      (p) => p.provider === PaymentProvider.RAZORPAY && p.status === PaymentStatus.PENDING,
    );

    if (!razorpayPayment) {
      throw new BadRequestException("This order cannot be cancelled: no pending Razorpay payment found.");
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Restore stock for all items
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            movementType: InventoryMovementType.RETURN,
            quantity: item.quantity,
            reason: "Razorpay payment cancelled by customer",
            referenceType: "order",
            referenceId: order.id,
            createdById: actor.id,
          },
        });
      }

      // Cancel the order
      await tx.order.update({
        where: { id: order.id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          deliveryStatus: DeliveryStatus.CANCELLED,
          paymentStatus: PaymentStatus.NOT_REQUIRED,
        },
      });

      // Cancel the pending Razorpay payment
      await tx.payment.update({
        where: { id: razorpayPayment.id },
        data: { status: PaymentStatus.FAILED },
      });

      // Cancel seller splits and shipments
      await tx.orderSellerSplit.updateMany({
        where: { orderId: order.id },
        data: {
          sellerStatus: SellerOrderStatus.CANCELLED,
          settlementStatus: SellerSettlementStatus.CANCELLED,
          payoutId: null,
        },
      });
      await tx.orderShipment.updateMany({
        where: { orderId: order.id },
        data: { status: DeliveryStatus.CANCELLED },
      });
      if (order.deliveryDetail) {
        await tx.deliveryDetail.update({
          where: { orderId: order.id },
          data: { status: DeliveryStatus.CANCELLED },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "order.cancelled.razorpay_dismissed",
          entityType: "order",
          entityId: order.id,
          newValue: { orderNumber, reason: "Razorpay payment cancelled by customer" },
        },
      });
    });

    return { orderNumber, cancelled: true };
  }

  async createRazorpayOrder(actor: RequestUser, orderNumber: string) {
    const { keyId, keySecret } = await this.getRazorpayKeys();

    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found for payment creation.");
    }

    if (order.customer.userId !== actor.id) {
      throw new ForbiddenException("Order does not belong to the authenticated customer.");
    }

    const payment = order.payments.find(
      (item) => item.provider === PaymentProvider.RAZORPAY && item.method === "RAZORPAY",
    );

    if (!payment) {
      throw new BadRequestException("This order was not placed with Razorpay payment.");
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException("Payment is already completed for this order.");
    }

    if (payment.providerOrderId) {
      return {
        keyId,
        razorpayOrderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        orderNumber: order.orderNumber,
      };
    }

    const paymentId = payment.id;
    const amountPaise = payment.amountPaise;

    // Step 1: Atomically claim this payment for order creation
    const claimed = await this.prisma.client.payment.updateMany({
      where: {
        id: paymentId,
        providerOrderId: null,
        providerOrderCreationInProgress: false,
      },
      data: { providerOrderCreationInProgress: true },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.client.payment.findUnique({
        where: { id: paymentId },
      });
      if (existing?.providerOrderId) {
        return {
          keyId,
          razorpayOrderId: existing.providerOrderId,
          amountPaise: existing.amountPaise,
          currency: existing.currency,
          orderNumber: order.orderNumber,
        };
      }
      throw new Error('Provider order creation already in progress for this payment');
    }

    // Step 2: Create provider order — release lock on failure
    let providerOrderId: string;
    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: payment.currency,
          receipt: order.orderNumber,
          notes: {
            indihubOrderId: order.id,
            orderNumber: order.orderNumber,
          },
        }),
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Razorpay order creation failed with status ${response.status}: ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new ServiceUnavailableException(
          "Razorpay order creation did not return a provider order id.",
        );
      }
      providerOrderId = data.id;
    } catch (err) {
      await this.prisma.client.payment.update({
        where: { id: paymentId },
        data: { providerOrderCreationInProgress: false },
      });
      console.error('Razorpay order creation failed', { paymentId });
      throw err;
    }

    // Step 3: Store providerOrderId and release lock atomically
    await this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        provider: PaymentProvider.RAZORPAY,
        providerOrderId,
        providerOrderCreationInProgress: false,
      },
    });

    return {
      keyId,
      razorpayOrderId: providerOrderId,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      orderNumber: order.orderNumber,
    };
  }

  async verifyRazorpayPayment(actor: RequestUser, dto: VerifyRazorpayPaymentDto) {
    const { keyId, keySecret } = await this.getRazorpayKeys();
    const payment = await this.prisma.client.payment.findFirst({
      where: {
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: dto.razorpayOrderId,
      },
      include: {
        order: {
          include: {
            customer: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Razorpay payment record not found for this provider order.");
    }

    if (payment.order.customer.userId !== actor.id) {
      throw new ForbiddenException("Payment does not belong to the authenticated customer.");
    }

    this.verifyCheckoutSignature(dto, payment.providerOrderId, keySecret);
    const providerPayment = await this.fetchRazorpayPayment(
      keyId,
      keySecret,
      dto.razorpayPaymentId,
    );
    this.ensureProviderPaymentMatchesRecord(payment, providerPayment, dto.razorpayPaymentId);

    const nextStatus = this.mapRazorpayPaymentStatus(providerPayment.status);
    return this.recordPaymentStatus(
      payment,
      nextStatus,
      "razorpay.checkout.verified",
      {
        providerPayment,
        checkoutResponse: {
          razorpayOrderId: dto.razorpayOrderId,
          razorpayPaymentId: dto.razorpayPaymentId,
          signatureVerified: true,
        },
      } as Prisma.InputJsonValue,
      dto.razorpayPaymentId,
    );
  }

  async handleRazorpayWebhook(
    signature: string | undefined,
    payload: Record<string, unknown>,
    rawBody?: Buffer,
    eventId?: string,
  ) {
    await this.verifyWebhookSignature(signature, payload, rawBody);

    const sellerSubscriptionResult =
      await this.sellerSubscriptions?.handleRazorpaySubscriptionWebhook(payload, eventId);
    if (sellerSubscriptionResult?.handled) {
      return sellerSubscriptionResult;
    }

    const refundResult = await this.returnsService?.handleRazorpayRefundWebhook(payload, eventId);
    if (refundResult?.handled) {
      return { received: true, ...refundResult };
    }

    const event = String(payload.event ?? "");
    const paymentEntity = this.extractRazorpayPaymentEntity(payload);
    if (!paymentEntity) {
      return { received: true, ignored: true };
    }

    const nextStatus =
      event === "payment.captured" || event === "order.paid"
        ? PaymentStatus.PAID
        : event === "payment.failed"
          ? PaymentStatus.FAILED
          : undefined;

    if (!nextStatus) {
      return { received: true, ignored: true };
    }

    const paymentLookup: Prisma.PaymentWhereInput[] = [
      ...(paymentEntity.id ? [{ providerPaymentId: paymentEntity.id }] : []),
      ...(paymentEntity.orderId ? [{ providerOrderId: paymentEntity.orderId }] : []),
    ];

    if (!paymentLookup.length) {
      return { received: true, ignored: true };
    }

    const payment = await this.prisma.client.payment.findFirst({
      where: { OR: paymentLookup },
      include: {
        order: {
          include: {
            customer: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { received: true, ignored: true };
    }

    this.ensureRazorpayEntityMatchesRecord(payment, paymentEntity);

    return this.recordPaymentStatus(
      payment,
      nextStatus,
      event,
      {
        ...payload,
        ...(eventId ? { razorpayEventId: eventId } : {}),
      } as Prisma.InputJsonValue,
      paymentEntity.id,
    );
  }

  private async recordPaymentStatus(
    payment: RazorpayPaymentWithOrder,
    nextStatus: PaymentStatus,
    eventType: string,
    payload: Prisma.InputJsonValue,
    providerPaymentId?: string,
  ) {
    if (payment.provider !== PaymentProvider.RAZORPAY) {
      return { received: true, ignored: true, reason: "not_razorpay_payment" };
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              customer: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      if (!currentPayment) {
        throw new NotFoundException("Razorpay payment record no longer exists.");
      }

      if (currentPayment.status === PaymentStatus.PAID && nextStatus !== PaymentStatus.PAID) {
        return {
          received: true,
          ignored: true,
          paymentId: currentPayment.id,
          status: currentPayment.status,
          reason: "paid_payment_is_terminal",
          notify: false,
          notificationPayment: currentPayment,
        };
      }

      const nextProviderPaymentId = providerPaymentId ?? currentPayment.providerPaymentId ?? null;
      const statusChanged = currentPayment.status !== nextStatus;
      const providerPaymentChanged = Boolean(
        nextProviderPaymentId && nextProviderPaymentId !== currentPayment.providerPaymentId,
      );

      if (
        currentPayment.status === PaymentStatus.PAID &&
        nextStatus === PaymentStatus.PAID &&
        currentPayment.providerPaymentId &&
        providerPaymentChanged
      ) {
        return {
          received: true,
          ignored: true,
          paymentId: currentPayment.id,
          status: currentPayment.status,
          reason: "paid_payment_is_terminal",
          notify: false,
          notificationPayment: currentPayment,
        };
      }

      if (!statusChanged && !providerPaymentChanged) {
        return {
          received: true,
          ignored: true,
          paymentId: currentPayment.id,
          status: currentPayment.status,
          reason: "duplicate_event",
          notify: false,
          notificationPayment: currentPayment,
        };
      }

      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: currentPayment.id,
          status: currentPayment.status,
          providerPaymentId: currentPayment.providerPaymentId,
        },
        data: {
          status: nextStatus,
          providerPaymentId: nextProviderPaymentId,
          rawResponse: payload as Prisma.InputJsonValue,
        },
      });
      if (paymentUpdate.count !== 1) {
        const latestPayment = await tx.payment.findUnique({
          where: { id: currentPayment.id },
          include: {
            order: {
              include: {
                customer: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        });
        return {
          received: true,
          ignored: true,
          paymentId: currentPayment.id,
          status: latestPayment?.status ?? currentPayment.status,
          reason:
            latestPayment?.status === PaymentStatus.PAID ||
            latestPayment?.order.paymentStatus === PaymentStatus.PAID
              ? "paid_payment_is_terminal"
              : "payment_status_conflict",
          notify: false,
          notificationPayment: latestPayment ?? currentPayment,
        };
      }

      await tx.paymentEvent.create({
        data: {
          paymentId: currentPayment.id,
          eventType,
          oldStatus: currentPayment.status,
          newStatus: nextStatus,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      if (statusChanged) {
        const orderUpdate = await tx.order.updateMany({
          where: {
            id: currentPayment.orderId,
            ...(nextStatus === PaymentStatus.FAILED
              ? { paymentStatus: { not: PaymentStatus.PAID } }
              : {}),
          },
          data: { paymentStatus: nextStatus },
        });
        if (orderUpdate.count !== 1 && nextStatus === PaymentStatus.FAILED) {
          return {
            received: true,
            ignored: true,
            paymentId: currentPayment.id,
            status: PaymentStatus.PAID,
            reason: "paid_payment_is_terminal",
            notify: false,
            notificationPayment: currentPayment,
          };
        }
        await tx.orderStatusEvent.create({
          data: {
            orderId: currentPayment.orderId,
            statusType: StatusEventType.PAYMENT,
            oldStatus: currentPayment.order.paymentStatus,
            newStatus: nextStatus,
            note: `Razorpay payment event: ${eventType}`,
          },
        });
      }

      return {
        received: true,
        ignored: false,
        paymentId: currentPayment.id,
        status: nextStatus,
        notify:
          statusChanged &&
          (nextStatus === PaymentStatus.PAID || nextStatus === PaymentStatus.FAILED),
        notificationPayment: currentPayment,
      };
    });

    if (
      result.notify &&
      (nextStatus === PaymentStatus.PAID || nextStatus === PaymentStatus.FAILED)
    ) {
      await this.notifications.notifyEvent({
        eventCode:
          nextStatus === PaymentStatus.PAID
            ? EMAIL_TRIGGER_EVENTS.PAYMENT_SUCCESS
            : EMAIL_TRIGGER_EVENTS.PAYMENT_FAILED,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: result.notificationPayment.order.customer.user.email,
        userId: result.notificationPayment.order.customer.userId,
        variables: {
          orderNumber: result.notificationPayment.order.orderNumber,
          paymentStatus: nextStatus,
        },
      });
    }

    if (result.ignored) {
      return {
        received: result.received,
        ignored: result.ignored,
        paymentId: result.paymentId,
        status: result.status,
        reason: result.reason,
      };
    }

    return {
      received: result.received,
      paymentId: result.paymentId,
      status: result.status,
    };
  }

  private async verifyWebhookSignature(
    signature: string | undefined,
    payload: Record<string, unknown>,
    rawBody?: Buffer,
  ) {
    const secret = await this.getRazorpayWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException(
        "RAZORPAY_WEBHOOK_SECRET is required before Razorpay webhooks can be used.",
      );
    }

    if (!signature) {
      throw new UnauthorizedException("Razorpay signature is required.");
    }

    if (!rawBody?.length) {
      throw new BadRequestException(
        "Raw Razorpay webhook body is required for signature verification.",
      );
    }

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!this.safeCompare(signature, expected)) {
      throw new UnauthorizedException("Invalid Razorpay webhook signature.");
    }
  }

  private verifyCheckoutSignature(
    dto: VerifyRazorpayPaymentDto,
    providerOrderId: string | null,
    keySecret: string,
  ) {
    if (!providerOrderId || providerOrderId !== dto.razorpayOrderId) {
      throw new UnauthorizedException(
        "Razorpay order id does not match the stored payment record.",
      );
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${dto.razorpayPaymentId}`)
      .digest("hex");

    if (!this.safeCompare(dto.razorpaySignature, expected)) {
      throw new UnauthorizedException("Invalid Razorpay checkout signature.");
    }
  }

  private safeCompare(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }

  private extractRazorpayPaymentEntity(payload: Record<string, unknown>) {
    const rootPayload = payload.payload as Record<string, unknown> | undefined;
    const paymentPayload = rootPayload?.payment as Record<string, unknown> | undefined;
    const entity = paymentPayload?.entity as Record<string, unknown> | undefined;

    if (!entity) {
      return null;
    }

    return {
      id: typeof entity.id === "string" ? entity.id : undefined,
      orderId: typeof entity.order_id === "string" ? entity.order_id : undefined,
      amount: typeof entity.amount === "number" ? entity.amount : undefined,
      currency: typeof entity.currency === "string" ? entity.currency : undefined,
      status: typeof entity.status === "string" ? entity.status : undefined,
    };
  }

  private ensureRazorpayEntityMatchesRecord(
    payment: RazorpayPaymentWithOrder,
    paymentEntity: RazorpayPaymentEntity,
  ) {
    if (paymentEntity.amount !== undefined && paymentEntity.amount !== payment.amountPaise) {
      throw new BadRequestException(
        "Razorpay payment amount does not match the order payment amount.",
      );
    }

    if (paymentEntity.currency && paymentEntity.currency !== payment.currency) {
      throw new BadRequestException(
        "Razorpay payment currency does not match the order payment currency.",
      );
    }
  }

  private ensureProviderPaymentMatchesRecord(
    payment: RazorpayPaymentWithOrder,
    providerPayment: RazorpayFetchedPayment,
    razorpayPaymentId: string,
  ) {
    if (providerPayment.id && providerPayment.id !== razorpayPaymentId) {
      throw new BadRequestException(
        "Fetched Razorpay payment id does not match checkout response.",
      );
    }

    if (providerPayment.order_id && providerPayment.order_id !== payment.providerOrderId) {
      throw new BadRequestException(
        "Fetched Razorpay payment order id does not match stored provider order.",
      );
    }

    this.ensureRazorpayEntityMatchesRecord(payment, {
      amount: providerPayment.amount,
      currency: providerPayment.currency,
    });
  }

  private mapRazorpayPaymentStatus(status: string | undefined) {
    if (status === "captured") {
      return PaymentStatus.PAID;
    }

    if (status === "failed") {
      return PaymentStatus.FAILED;
    }

    return PaymentStatus.PENDING;
  }

  private async fetchRazorpayPayment(keyId: string, keySecret: string, paymentId: string) {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payment fetch failed with status ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as RazorpayFetchedPayment;
  }

  private async getRazorpayKeys() {
    const settingMap = await this.paymentSettingMap();
    const { keyId, keySecret } = this.razorpayKeysFromSettings(settingMap);

    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(
        "Razorpay keys are required before online payment can be used.",
      );
    }

    return { keyId, keySecret };
  }

  private async getRazorpayWebhookSecret() {
    const settingMap = await this.paymentSettingMap();
    return this.razorpayWebhookSecretFromSettings(settingMap);
  }

  private async paymentSettingMap(client: PaymentSettingClient = this.prisma.client) {
    const settings = await client.setting.findMany({
      where: {
        key: {
          in: paymentConfigKeys,
        },
      },
    });

    return new Map(settings.map((setting) => [setting.key, setting.value]));
  }

  private paymentSettingWrite(
    key: string,
    group: string,
    valueType: SettingValueType,
    value: Prisma.InputJsonValue,
  ): PaymentSettingWrite {
    return { key, group, valueType, value };
  }

  private razorpayKeysFromSettings(settingMap: PaymentSettingMap) {
    const keyId = this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.razorpayKeyId,
      process.env.RAZORPAY_KEY_ID ?? "",
    );
    const keySecret = this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.razorpayKeySecret,
      process.env.RAZORPAY_KEY_SECRET ?? "",
    );

    return {
      keyId,
      keySecret,
      configured: Boolean(keyId && keySecret),
    };
  }

  private razorpayWebhookSecretFromSettings(settingMap: PaymentSettingMap) {
    return this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.razorpayWebhookSecret,
      process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    );
  }

  private bankTransferDetailsFromSettings(settingMap: PaymentSettingMap) {
    const accountHolderName = this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.bankTransferAccountHolderName,
      "",
    );
    const bankName = this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferBankName, "");
    const accountNumber = this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.bankTransferAccountNumber,
      "",
    );
    const ifscCode = this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferIfscCode, "");
    const branch = this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferBranch, "");
    const upiId = this.stringSetting(settingMap, PAYMENT_SETTING_KEYS.bankTransferUpiId, "");
    const instructions = this.stringSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.bankTransferInstructions,
      defaultBankTransferInstructions,
    );
    const referenceRequired = this.booleanSetting(
      settingMap,
      PAYMENT_SETTING_KEYS.bankTransferReferenceRequired,
      true,
    );
    const configured = Boolean(upiId || (accountNumber && ifscCode));

    return {
      configured,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      branch,
      upiId,
      instructions,
      referenceRequired,
    };
  }

  private booleanSetting(settingMap: PaymentSettingMap, key: string, fallback: boolean) {
    return readBooleanSetting(settingMap.get(key), fallback);
  }

  private stringSetting(settingMap: PaymentSettingMap, key: string, fallback: string) {
    const value = settingMap.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private numberSetting(settingMap: PaymentSettingMap, key: string, fallback: number) {
    return readNumberSetting(settingMap.get(key), fallback);
  }

  private maskValue(value: string | undefined) {
    if (!value) {
      return null;
    }

    if (value.length <= 8) {
      return `${value.slice(0, 2)}****`;
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
}
