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
  DeliveryAssignmentStatus,
  DeliveryStatus,
  InventoryMovementType,
  OrderItemLifecycleStatus,
  OrderStatus,
  OrderShipmentPackageStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RefundMethod,
  RefundRequestStatus,
  RefundTransactionStatus,
  SellerLedgerEntryType,
  SellerOrderStatus,
  SellerSettlementStatus,
  SettingValueType,
  ServiceBookingStatus,
  ServicePaymentCollectionType,
  ServicePaymentSettlementTreatment,
  StatusEventType,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { FinanceCalculatorService } from "../finance/finance-calculator.service";
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
const razorpayWebhookPath = "/api/payments/razorpay/webhook";
const providerOrderStaleLockMs = 2 * 60 * 1000;

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

type RazorpayServicePaymentWithBooking = Prisma.ServicePaymentGetPayload<{
  include: {
    booking: {
      include: {
        customer: {
          include: {
            user: true;
          };
        };
        seller: {
          include: {
            user: true;
          };
        };
        listing: true;
        payments: true;
        settlement: true;
      };
    };
  };
}>;

type RazorpayPayableRecord = {
  provider: PaymentProvider;
  amountPaise: number;
  currency: string;
  providerOrderId: string | null;
};

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

type RazorpayRefundEntity = {
  id: string | null;
  paymentId: string | null;
  status: unknown;
  amount: number | null;
  raw: Record<string, unknown>;
};

type PaymentSettingMap = Map<string, Prisma.JsonValue>;
type PaymentSettingWrite = {
  key: string;
  group: string;
  valueType: SettingValueType;
  value: Prisma.InputJsonValue;
};
type PaymentSettingClient = Prisma.TransactionClient | PrismaService["client"];
type RazorpayUnpaidOrderCancellationReason = "CUSTOMER_DISMISSED" | "PAYMENT_FAILED";

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
    @Optional()
    @Inject(FinanceCalculatorService)
    private readonly financeCalculator?: FinanceCalculatorService,
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
        webhookPath: razorpayWebhookPath,
        webhookUrl: this.absoluteApiUrl(razorpayWebhookPath),
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
    const razorpayAmountAllowed = totalPaise === 0 || totalPaise >= 100;

    return {
      methods: [
        {
          method: "RAZORPAY",
          label: "Razorpay",
          enabled:
            razorpayAmountAllowed &&
            this.booleanSetting(settingMap, PAYMENT_SETTING_KEYS.razorpayEnabled, false) &&
            razorpayKeys.configured,
          note:
            totalPaise < 100 && totalPaise > 0
              ? "Minimum order amount for Razorpay is INR 1.00."
              : razorpayKeys.configured
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

  async b2bBankTransferInstructions(totalPaise = 0, client: PaymentSettingClient = this.prisma.client) {
    const methods = await this.checkoutMethods(totalPaise, client);
    const bankTransfer = methods.methods.find((method) => method.method === "BANK_TRANSFER");

    return {
      enabled: Boolean(bankTransfer?.enabled),
      configured: Boolean(bankTransfer?.bankTransferDetails?.configured),
      label: bankTransfer?.label ?? "Bank transfer",
      note: bankTransfer?.note ?? "Bank transfer details are not configured.",
      instructions: bankTransfer?.instructions ?? "",
      bankTransferDetails: bankTransfer?.bankTransferDetails ?? null,
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

    await this.cancelUnpaidRazorpayOrder(razorpayPayment.id, {
      reason: "CUSTOMER_DISMISSED",
      actorUserId: actor.id,
      eventType: "razorpay.checkout.dismissed",
      payload: {
        orderNumber,
        note: "Razorpay payment cancelled by customer",
      } as Prisma.InputJsonValue,
      providerPaymentId: razorpayPayment.providerPaymentId,
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

  async createServiceRazorpayOrder(actor: RequestUser, bookingNumber: string, paymentId: string) {
    const payment = await this.prisma.client.servicePayment.findFirst({
      where: {
        id: paymentId,
        booking: { bookingNumber },
      },
      include: {
        booking: {
          include: {
            customer: { include: { user: true } },
            seller: { include: { user: true } },
            listing: true,
            payments: true,
            settlement: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Service payment not found for this booking.");
    }

    this.ensureCustomerOwnsServicePayment(actor, payment);
    this.ensureServicePaymentCanUseRazorpay(payment);
    await this.ensureCheckoutMethodAllowed("RAZORPAY", payment.amountPaise);
    const { keyId, keySecret } = await this.getRazorpayKeys();

    if (payment.providerOrderId) {
      return this.serviceRazorpayOrderResponse(keyId, payment);
    }

    const staleCreationLockBefore = new Date(Date.now() - providerOrderStaleLockMs);
    const claimed = await this.prisma.client.servicePayment.updateMany({
      where: {
        id: payment.id,
        providerOrderId: null,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
        OR: [
          { providerOrderCreationInProgress: false },
          {
            providerOrderCreationInProgress: true,
            updatedAt: { lt: staleCreationLockBefore },
          },
        ],
      },
      data: {
        providerOrderCreationInProgress: true,
        status: PaymentStatus.PENDING,
      },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.client.servicePayment.findUnique({
        where: { id: payment.id },
        include: {
          booking: {
            include: {
              customer: { include: { user: true } },
              seller: { include: { user: true } },
              listing: true,
              payments: true,
              settlement: true,
            },
          },
        },
      });
      if (existing?.providerOrderId) {
        return this.serviceRazorpayOrderResponse(keyId, existing);
      }
      throw new Error("Provider order creation already in progress for this service payment.");
    }

    let providerOrderId: string;
    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: payment.amountPaise,
          currency: payment.currency,
          receipt: payment.booking.bookingNumber,
          notes: {
            indihubServiceBookingId: payment.bookingId,
            bookingNumber: payment.booking.bookingNumber,
            servicePaymentId: payment.id,
            sellerId: payment.sellerId,
            purpose: payment.purpose,
          },
        }),
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Razorpay service payment order creation failed with status ${response.status}: ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new ServiceUnavailableException(
          "Razorpay service payment order creation did not return a provider order id.",
        );
      }
      providerOrderId = data.id;
    } catch (error) {
      await this.prisma.client.servicePayment.update({
        where: { id: payment.id },
        data: { providerOrderCreationInProgress: false },
      });
      console.error("Razorpay service payment order creation failed", { servicePaymentId: payment.id });
      throw error;
    }

    const updated = await this.prisma.client.servicePayment.update({
      where: { id: payment.id },
      data: {
        providerOrderId,
        providerOrderCreationInProgress: false,
        status: PaymentStatus.PENDING,
        events: {
          create: {
            eventType: "service_payment.razorpay_order_created",
            oldStatus: payment.status,
            newStatus: PaymentStatus.PENDING,
            payload: {
              bookingNumber: payment.booking.bookingNumber,
              providerOrderId,
              actorUserId: actor.id,
            },
          },
        },
      },
      include: {
        booking: {
          include: {
            customer: { include: { user: true } },
            seller: { include: { user: true } },
            listing: true,
            payments: true,
            settlement: true,
          },
        },
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "service_payment.razorpay_order_created",
        entityType: "service_booking",
        entityId: payment.bookingId,
        newValue: {
          bookingNumber: payment.booking.bookingNumber,
          servicePaymentId: payment.id,
          providerOrderId,
        },
      },
    });

    return this.serviceRazorpayOrderResponse(keyId, updated);
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

  async verifyServiceRazorpayPayment(
    actor: RequestUser,
    bookingNumber: string,
    dto: VerifyRazorpayPaymentDto,
  ) {
    const { keyId, keySecret } = await this.getRazorpayKeys();
    const payment = await this.prisma.client.servicePayment.findFirst({
      where: {
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: dto.razorpayOrderId,
      },
      include: {
        booking: {
          include: {
            customer: { include: { user: true } },
            seller: { include: { user: true } },
            listing: true,
            payments: true,
            settlement: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Razorpay service payment record not found for this provider order.");
    }

    if (payment.booking.bookingNumber !== bookingNumber) {
      throw new BadRequestException("Razorpay payment does not belong to this service booking.");
    }

    this.ensureCustomerOwnsServicePayment(actor, payment);
    this.verifyCheckoutSignature(dto, payment.providerOrderId, keySecret);
    const providerPayment = await this.fetchRazorpayPayment(
      keyId,
      keySecret,
      dto.razorpayPaymentId,
    );
    this.ensureProviderPaymentMatchesRecord(payment, providerPayment, dto.razorpayPaymentId);

    const nextStatus = this.mapRazorpayPaymentStatus(providerPayment.status);
    return this.recordServicePaymentStatus(
      payment,
      nextStatus,
      "service_payment.razorpay_checkout_verified",
      {
        providerPayment,
        checkoutResponse: {
          bookingNumber,
          razorpayOrderId: dto.razorpayOrderId,
          razorpayPaymentId: dto.razorpayPaymentId,
          signatureVerified: true,
        },
      } as Prisma.InputJsonValue,
      dto.razorpayPaymentId,
      actor.id,
    );
  }

  async initiateServiceRefund(
    refundNumber: string,
    actor: RequestUser,
    options: { method?: RefundMethod; note?: string } = {},
  ) {
    const refund = await this.prisma.client.serviceRefundRequest.findUnique({
      where: { refundNumber },
      include: { servicePayment: true },
    });
    if (!refund) {
      throw new NotFoundException("Service refund request not found.");
    }
    const allowedStatuses = new Set<RefundRequestStatus>([
      RefundRequestStatus.PENDING_REVIEW,
      RefundRequestStatus.APPROVED,
      RefundRequestStatus.FAILED,
      RefundRequestStatus.RETRY_PENDING,
    ]);
    if (!allowedStatuses.has(refund.status)) {
      throw new BadRequestException("Service refund is not ready for Razorpay initiation.");
    }
    if (options.method && options.method !== RefundMethod.RAZORPAY) {
      throw new BadRequestException("Use manual-record for offline or manual service refunds.");
    }
    if (!refund.servicePayment?.providerPaymentId || refund.servicePayment.provider !== PaymentProvider.RAZORPAY) {
      throw new BadRequestException("Razorpay service refund requires a captured Razorpay service payment.");
    }

    const transaction = await this.prisma.client.$transaction(async (tx) => {
      await this.lockServiceRefundRequest(tx, refund.id);
      const attemptCount = await tx.serviceRefundTransaction.count({
        where: { serviceRefundRequestId: refund.id },
      });
      const idempotencyKey = this.serviceRefundIdempotencyKey(refund.refundNumber, attemptCount + 1);
      const transaction = await tx.serviceRefundTransaction.create({
        data: {
          serviceRefundRequestId: refund.id,
          servicePaymentId: refund.servicePaymentId,
          provider: PaymentProvider.RAZORPAY,
          method: RefundMethod.RAZORPAY,
          status: RefundTransactionStatus.PROCESSING,
          amountPaise: refund.amountPaise,
          currency: refund.currency,
          idempotencyKey,
          createdById: actor.id,
        },
      });
      await tx.serviceRefundRequest.update({
        where: { id: refund.id },
        data: {
          status: RefundRequestStatus.PROCESSING,
          method: RefundMethod.RAZORPAY,
          approvedAt: refund.approvedAt ?? new Date(),
          reviewedAt: new Date(),
          reviewedById: actor.id,
          note: options.note ?? refund.note,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "service_refund.razorpay_initiated",
          entityType: "service_refund_request",
          entityId: refund.id,
          newValue: { refundNumber, amountPaise: refund.amountPaise, note: options.note ?? null },
        },
      });
      return transaction;
    });

    const { keySecret } = await this.getRazorpayKeys();
    const providerResult = await this.createRazorpayRefund({
      keySecret,
      paymentId: refund.servicePayment.providerPaymentId,
      amountPaise: refund.amountPaise,
      idempotencyKey: transaction.idempotencyKey ?? this.serviceRefundIdempotencyKey(refund.refundNumber, 1),
      refundNumber,
    });

    const nextTransactionStatus = this.razorpayRefundTransactionStatus(providerResult.status);
    const providerRefundId = typeof providerResult.id === "string" ? providerResult.id : null;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceRefundTransaction.update({
        where: { id: transaction.id },
        data: {
          status: nextTransactionStatus,
          providerRefundId,
          providerResponse: providerResult as Prisma.InputJsonValue,
          processedAt: nextTransactionStatus === RefundTransactionStatus.SUCCESS ? new Date() : null,
          failureReason:
            nextTransactionStatus === RefundTransactionStatus.FAILED
              ? this.providerFailureReason(providerResult)
              : null,
        },
      });

      if (nextTransactionStatus === RefundTransactionStatus.SUCCESS) {
        await this.completeServiceRefundInTransaction(tx, refund.id, actor, {
          method: RefundMethod.RAZORPAY,
          note: options.note ?? "Razorpay service refund processed.",
        });
      } else if (nextTransactionStatus === RefundTransactionStatus.FAILED) {
        await tx.serviceRefundRequest.update({
          where: { id: refund.id },
          data: {
            status: RefundRequestStatus.RETRY_PENDING,
            note: this.providerFailureReason(providerResult),
          },
        });
      }
    });

    return this.prisma.client.serviceRefundRequest.findUnique({
      where: { refundNumber },
      include: {
        booking: { include: { customer: { include: { user: true } }, seller: true, listing: true } },
        customer: { include: { user: true } },
        seller: true,
        servicePayment: true,
        transactions: { orderBy: { createdAt: "desc" } },
      },
    });
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

    const serviceRefundResult = await this.handleServiceRazorpayRefundWebhook(payload, eventId);
    if (serviceRefundResult.handled) {
      return { received: true, ...serviceRefundResult };
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
      return this.handleServiceRazorpayWebhook(event, paymentEntity, payload, eventId);
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

  private async handleServiceRazorpayWebhook(
    event: string,
    paymentEntity: RazorpayPaymentEntity,
    payload: Record<string, unknown>,
    eventId?: string,
  ) {
    const nextStatus =
      event === "payment.captured" || event === "order.paid"
        ? PaymentStatus.PAID
        : event === "payment.failed"
          ? PaymentStatus.FAILED
          : undefined;

    if (!nextStatus) {
      return { received: true, ignored: true };
    }

    const paymentLookup: Prisma.ServicePaymentWhereInput[] = [
      ...(paymentEntity.id ? [{ providerPaymentId: paymentEntity.id }] : []),
      ...(paymentEntity.orderId ? [{ providerOrderId: paymentEntity.orderId }] : []),
    ];

    if (!paymentLookup.length) {
      return { received: true, ignored: true };
    }

    const payment = await this.prisma.client.servicePayment.findFirst({
      where: { OR: paymentLookup },
      include: {
        booking: {
          include: {
            customer: { include: { user: true } },
            seller: { include: { user: true } },
            listing: true,
            payments: true,
            settlement: true,
          },
        },
      },
    });

    if (!payment) {
      return { received: true, ignored: true };
    }

    this.ensureRazorpayEntityMatchesRecord(payment, paymentEntity);

    return this.recordServicePaymentStatus(
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

      if (nextStatus === PaymentStatus.FAILED) {
        return this.cancelUnpaidRazorpayOrderInTransaction(tx, currentPayment.id, {
          reason: "PAYMENT_FAILED",
          eventType,
          payload,
          providerPaymentId: nextProviderPaymentId,
        });
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
        await tx.order.updateMany({
          where: {
            id: currentPayment.orderId,
          },
          data: { paymentStatus: nextStatus },
        });
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
        notify: statusChanged && nextStatus === PaymentStatus.PAID,
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
          paymentStatus: result.status,
        },
      });
    }

    if (result.ignored) {
      return {
        received: result.received,
        ignored: result.ignored,
        paymentId: result.paymentId,
        status: result.status,
        reason: "reason" in result ? result.reason : undefined,
      };
    }

    return {
      received: result.received,
      paymentId: result.paymentId,
      status: result.status,
    };
  }

  private async cancelUnpaidRazorpayOrder(
    paymentId: string,
    options: {
      reason: RazorpayUnpaidOrderCancellationReason;
      eventType: string;
      payload: Prisma.InputJsonValue;
      providerPaymentId?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const result = await this.prisma.client.$transaction((tx) =>
      this.cancelUnpaidRazorpayOrderInTransaction(tx, paymentId, options),
    );

    if (options.reason === "PAYMENT_FAILED" && result.notify) {
      await this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.PAYMENT_FAILED,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: result.notificationPayment.order.customer.user.email,
        userId: result.notificationPayment.order.customer.userId,
        variables: {
          orderNumber: result.notificationPayment.order.orderNumber,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
    }

    return result;
  }

  private async cancelUnpaidRazorpayOrderInTransaction(
    tx: Prisma.TransactionClient,
    paymentId: string,
    options: {
      reason: RazorpayUnpaidOrderCancellationReason;
      eventType: string;
      payload: Prisma.InputJsonValue;
      providerPaymentId?: string | null;
      actorUserId?: string | null;
    },
  ) {
    const currentPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            customer: { include: { user: true } },
            items: true,
            deliveryDetail: true,
          },
        },
      },
    });

    if (!currentPayment) {
      throw new NotFoundException("Razorpay payment record no longer exists.");
    }

    if (currentPayment.provider !== PaymentProvider.RAZORPAY) {
      return {
        received: true,
        ignored: true,
        paymentId: currentPayment.id,
        status: currentPayment.status,
        reason: "not_razorpay_payment",
        notify: false,
        notificationPayment: currentPayment,
      };
    }

    if (
      currentPayment.status === PaymentStatus.PAID ||
      currentPayment.order.paymentStatus === PaymentStatus.PAID
    ) {
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

    const orderAlreadyCancelled = currentPayment.order.orderStatus === OrderStatus.CANCELLED;
    const nextProviderPaymentId =
      options.providerPaymentId ?? currentPayment.providerPaymentId ?? null;
    const paymentStatusChanged = currentPayment.status !== PaymentStatus.FAILED;
    const providerPaymentChanged = Boolean(
      nextProviderPaymentId && nextProviderPaymentId !== currentPayment.providerPaymentId,
    );
    const note =
      options.reason === "CUSTOMER_DISMISSED"
        ? "Razorpay checkout was cancelled by the customer."
        : "Razorpay reported payment failure before capture.";

    if (
      !paymentStatusChanged &&
      !providerPaymentChanged &&
      orderAlreadyCancelled &&
      currentPayment.order.paymentStatus === PaymentStatus.NOT_REQUIRED
    ) {
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

    if (paymentStatusChanged || providerPaymentChanged) {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: currentPayment.id,
          status: currentPayment.status,
          providerPaymentId: currentPayment.providerPaymentId,
        },
        data: {
          status: PaymentStatus.FAILED,
          providerPaymentId: nextProviderPaymentId,
          rawResponse: options.payload,
        },
      });

      if (paymentUpdate.count !== 1) {
        const latestPayment = await tx.payment.findUnique({
          where: { id: currentPayment.id },
          include: {
            order: {
              include: {
                customer: { include: { user: true } },
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
          eventType: options.eventType,
          oldStatus: currentPayment.status,
          newStatus: PaymentStatus.FAILED,
          payload: options.payload,
        },
      });
    }

    if (!orderAlreadyCancelled) {
      const restorableItems = currentPayment.order.items
        .map((item) => ({
          ...item,
          restoreQuantity:
            item.activeQuantity > 0 || item.cancelledQuantity > 0
              ? item.activeQuantity
              : item.quantity,
        }))
        .filter((item) => item.restoreQuantity > 0);

      for (const item of restorableItems) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQuantity: { increment: item.restoreQuantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            movementType: InventoryMovementType.RETURN,
            quantity: item.restoreQuantity,
            reason: note,
            referenceType: "order",
            referenceId: currentPayment.orderId,
            createdById: options.actorUserId ?? null,
          },
        });

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            activeQuantity: 0,
            retainedQuantity: 0,
            cancelledQuantity: { increment: item.restoreQuantity },
            cancelledAmountPaise: { increment: item.restoreQuantity * item.unitPricePaise },
            lifecycleStatus: OrderItemLifecycleStatus.CANCELLED,
          },
        });
      }

      await tx.order.update({
        where: { id: currentPayment.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          deliveryStatus: DeliveryStatus.CANCELLED,
          paymentStatus: PaymentStatus.NOT_REQUIRED,
        },
      });

      await tx.orderSellerSplit.updateMany({
        where: { orderId: currentPayment.orderId },
        data: {
          sellerStatus: SellerOrderStatus.CANCELLED,
          settlementStatus: SellerSettlementStatus.CANCELLED,
          settlementEligibleAt: null,
          payoutId: null,
        },
      });

      await tx.orderShipment.updateMany({
        where: { orderId: currentPayment.orderId },
        data: {
          status: DeliveryStatus.CANCELLED,
          assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
          assignmentExpiresAt: null,
        },
      });

      await tx.orderShipmentPackage.updateMany({
        where: {
          orderId: currentPayment.orderId,
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
          cancelledAt: new Date(),
        },
      });

      if (currentPayment.order.deliveryDetail) {
        await tx.deliveryDetail.update({
          where: { orderId: currentPayment.orderId },
          data: {
            status: DeliveryStatus.CANCELLED,
            assignmentStatus: DeliveryAssignmentStatus.CANCELLED,
            assignmentExpiresAt: null,
          },
        });
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: currentPayment.orderId,
          statusType: StatusEventType.ORDER,
          oldStatus: currentPayment.order.orderStatus,
          newStatus: OrderStatus.CANCELLED,
          note,
          createdById: options.actorUserId ?? null,
        },
      });

      if (currentPayment.order.paymentStatus !== PaymentStatus.NOT_REQUIRED) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: currentPayment.orderId,
            statusType: StatusEventType.PAYMENT,
            oldStatus: currentPayment.order.paymentStatus,
            newStatus: PaymentStatus.NOT_REQUIRED,
            note,
            createdById: options.actorUserId ?? null,
          },
        });
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: currentPayment.orderId,
          statusType: StatusEventType.DELIVERY,
          oldStatus: currentPayment.order.deliveryStatus,
          newStatus: DeliveryStatus.CANCELLED,
          note,
          createdById: options.actorUserId ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: options.actorUserId ?? null,
          action:
            options.reason === "CUSTOMER_DISMISSED"
              ? "order.cancelled.razorpay_dismissed"
              : "order.cancelled.razorpay_payment_failed",
          entityType: "order",
          entityId: currentPayment.orderId,
          oldValue: {
            orderStatus: currentPayment.order.orderStatus,
            paymentStatus: currentPayment.order.paymentStatus,
            deliveryStatus: currentPayment.order.deliveryStatus,
            paymentId: currentPayment.id,
          },
          newValue: {
            orderNumber: currentPayment.order.orderNumber,
            orderStatus: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.NOT_REQUIRED,
            paymentAttemptStatus: PaymentStatus.FAILED,
            deliveryStatus: DeliveryStatus.CANCELLED,
            reason: options.reason,
          },
        },
      });
    }

    return {
      received: true,
      ignored: false,
      paymentId: currentPayment.id,
      status: PaymentStatus.FAILED,
      notify: paymentStatusChanged,
      notificationPayment: currentPayment,
    };
  }

  private async recordServicePaymentStatus(
    payment: RazorpayServicePaymentWithBooking,
    nextStatus: PaymentStatus,
    eventType: string,
    payload: Prisma.InputJsonValue,
    providerPaymentId?: string,
    actorUserId?: string,
  ) {
    if (payment.provider !== PaymentProvider.RAZORPAY) {
      return { received: true, ignored: true, reason: "not_razorpay_service_payment" };
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const currentPayment = await tx.servicePayment.findUnique({
        where: { id: payment.id },
        include: {
          booking: {
            include: {
              customer: { include: { user: true } },
              seller: { include: { user: true } },
              listing: true,
              payments: true,
              settlement: true,
            },
          },
        },
      });

      if (!currentPayment) {
        throw new NotFoundException("Razorpay service payment record no longer exists.");
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
          settlement: null,
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
          settlement: null,
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
          settlement: null,
        };
      }

      const paymentUpdate = await tx.servicePayment.updateMany({
        where: {
          id: currentPayment.id,
          status: currentPayment.status,
          providerPaymentId: currentPayment.providerPaymentId,
        },
        data: {
          status: nextStatus,
          providerPaymentId: nextProviderPaymentId,
          rawResponse: payload as Prisma.InputJsonValue,
          paidAt:
            nextStatus === PaymentStatus.PAID
              ? currentPayment.paidAt ?? new Date()
              : nextStatus === PaymentStatus.FAILED
                ? null
                : currentPayment.paidAt,
        },
      });

      if (paymentUpdate.count !== 1) {
        const latestPayment = await tx.servicePayment.findUnique({
          where: { id: currentPayment.id },
          include: {
            booking: {
              include: {
                customer: { include: { user: true } },
                seller: { include: { user: true } },
                listing: true,
                payments: true,
                settlement: true,
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
            latestPayment?.status === PaymentStatus.PAID
              ? "paid_payment_is_terminal"
              : "payment_status_conflict",
          notify: false,
          notificationPayment: latestPayment ?? currentPayment,
          settlement: null,
        };
      }

      await tx.servicePaymentEvent.create({
        data: {
          paymentId: currentPayment.id,
          eventType,
          oldStatus: currentPayment.status,
          newStatus: nextStatus,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      const paidAggregate = await tx.servicePayment.aggregate({
        where: {
          bookingId: currentPayment.bookingId,
          status: PaymentStatus.PAID,
        },
        _sum: { amountPaise: true },
      });
      const paidAmountPaise = paidAggregate._sum.amountPaise ?? 0;
      const updatedBooking = await tx.serviceBooking.update({
        where: { id: currentPayment.bookingId },
        data: { paidAmountPaise },
        include: {
          customer: { include: { user: true } },
          seller: { include: { user: true } },
          listing: true,
          payments: true,
          settlement: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId ?? null,
          action: "service_payment.razorpay_status_updated",
          entityType: "service_booking",
          entityId: currentPayment.bookingId,
          oldValue: {
            paymentId: currentPayment.id,
            status: currentPayment.status,
            providerPaymentId: currentPayment.providerPaymentId,
          },
          newValue: {
            paymentId: currentPayment.id,
            status: nextStatus,
            providerPaymentId: nextProviderPaymentId,
            paidAmountPaise,
            eventType,
          },
        },
      });

      const settlement = await this.createServiceSettlementIfEligible(
        {
          ...currentPayment,
          status: nextStatus,
          providerPaymentId: nextProviderPaymentId,
          booking: updatedBooking,
        },
        tx,
      );

      return {
        received: true,
        ignored: false,
        paymentId: currentPayment.id,
        status: nextStatus,
        notify:
          statusChanged &&
          (nextStatus === PaymentStatus.PAID || nextStatus === PaymentStatus.FAILED),
        notificationPayment: {
          ...currentPayment,
          status: nextStatus,
          booking: updatedBooking,
        },
        settlement,
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
        recipient: result.notificationPayment.booking.customer.user.email,
        userId: result.notificationPayment.booking.customer.userId,
        variables: {
          orderNumber: result.notificationPayment.booking.bookingNumber,
          bookingNumber: result.notificationPayment.booking.bookingNumber,
          serviceTitle: result.notificationPayment.booking.listing.title,
          paymentStatus: nextStatus,
          note: `Service payment for ${result.notificationPayment.booking.listing.title}`,
        },
      });
    }

    if (result.ignored) {
      return {
        received: result.received,
        ignored: result.ignored,
        paymentId: result.paymentId,
        status: result.status,
        reason: "reason" in result ? result.reason : undefined,
      };
    }

    return {
      received: result.received,
      paymentId: result.paymentId,
      status: result.status,
    };
  }

  private async createServiceSettlementIfEligible(
    payment: RazorpayServicePaymentWithBooking,
    tx: Prisma.TransactionClient,
  ) {
    const booking = payment.booking;
    const settlementEligibleStatuses: ServiceBookingStatus[] = [
      ServiceBookingStatus.COMPLETED,
      ServiceBookingStatus.CLOSED_AFTER_INSPECTION,
    ];
    if (!settlementEligibleStatuses.includes(booking.status)) {
      return null;
    }
    if (booking.settlement) {
      return booking.settlement;
    }

    const grossDue =
      booking.status === ServiceBookingStatus.CLOSED_AFTER_INSPECTION
        ? booking.inspectionFeePaise
        : booking.totalPayablePaise;
    const committedRefundPaise = await this.serviceRefundCommittedPaise(tx, booking.id);
    const platformCollectedGross = Math.min(
      grossDue,
      booking.payments
        .filter(
          (item) =>
            (item.status === PaymentStatus.PAID || item.status === PaymentStatus.REFUNDED) &&
            item.settlementTreatment === ServicePaymentSettlementTreatment.PAYOUT_ELIGIBLE &&
            item.collectionType !== ServicePaymentCollectionType.PROVIDER_CASH,
        )
        .reduce((sum, item) => sum + item.amountPaise, 0) - committedRefundPaise,
    );
    if (grossDue <= 0 || platformCollectedGross <= 0) {
      return null;
    }

    const existing = await tx.serviceBookingSettlement.findUnique({
      where: { bookingId: booking.id },
    });
    if (existing) {
      return existing;
    }

    const calculation = await this.calculateServiceSettlement(booking, platformCollectedGross, tx);
    const settlement = await tx.serviceBookingSettlement.create({
      data: {
        bookingId: booking.id,
        sellerId: booking.sellerId,
        grossAmountPaise: calculation.grossAmountPaise,
        inspectionFeeGrossPaise: calculation.inspectionFeeGrossPaise,
        commissionPaise: calculation.commissionPaise,
        gstOnCommissionPaise: calculation.gstOnCommissionPaise,
        tdsPaise: calculation.tdsPaise,
        tcsPaise: calculation.tcsPaise,
        platformFeePaise: calculation.platformFeePaise,
        refundAdjustmentPaise: calculation.refundAdjustmentPaise,
        netPayablePaise: calculation.netPayablePaise,
        status: SellerSettlementStatus.ELIGIBLE,
        currency: booking.currency,
        financeSnapshot: calculation.snapshot,
      },
    });
    await tx.sellerLedgerEntry.create({
      data: {
        sellerId: booking.sellerId,
        serviceBookingId: booking.id,
        serviceSettlementId: settlement.id,
        entryType: SellerLedgerEntryType.SERVICE_EARNING,
        description: `Service earning for ${booking.bookingNumber}`,
        creditPaise: platformCollectedGross,
        currency: booking.currency,
        referenceType: "service_booking",
        referenceId: booking.id,
      },
    });
    await this.createServiceSettlementDeductionEntries(tx, booking, settlement.id, calculation);
    await tx.auditLog.create({
      data: {
        action: "service_settlement.created",
        entityType: "service_booking",
        entityId: booking.id,
        newValue: {
          gross: calculation.grossAmountPaise,
          commission: calculation.commissionPaise,
          net: calculation.netPayablePaise,
          grossDue,
          platformCollectedGross,
          source: "service_payment_razorpay",
        },
      },
    });
    return settlement;
  }

  private async calculateServiceSettlement(
    booking: RazorpayServicePaymentWithBooking["booking"],
    grossAmountPaise: number,
    tx: Prisma.TransactionClient,
  ) {
    if (this.financeCalculator) {
      return this.financeCalculator.calculateServiceBooking(booking, grossAmountPaise, tx);
    }

    const commissionPaise = Math.floor((grossAmountPaise * 500) / 10_000);
    const netPayablePaise = Math.max(0, grossAmountPaise - commissionPaise);
    return {
      grossAmountPaise,
      inspectionFeeGrossPaise: booking.inspectionFeePaise,
      commissionPaise,
      gstOnCommissionPaise: 0,
      tdsPaise: 0,
      tcsPaise: 0,
      platformFeePaise: 0,
      refundAdjustmentPaise: 0,
      netPayablePaise,
      snapshot: {
        calculationVersion: 1,
        source: "service_booking_fallback",
        commissionRateBps: 500,
        bookingStatus: booking.status,
        paymentMode: booking.paymentMode,
        paidAmountPaise: booking.paidAmountPaise,
      } as Prisma.InputJsonValue,
    };
  }

  private async createServiceSettlementDeductionEntries(
    tx: Prisma.TransactionClient,
    booking: RazorpayServicePaymentWithBooking["booking"],
    serviceSettlementId: string,
    calculation: Awaited<ReturnType<PaymentsService["calculateServiceSettlement"]>>,
  ) {
    const deductions: Array<{
      entryType: SellerLedgerEntryType;
      amountPaise: number;
      description: string;
    }> = [
      {
        entryType: SellerLedgerEntryType.SERVICE_COMMISSION,
        amountPaise: calculation.commissionPaise,
        description: `Service commission for ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.GST_ON_COMMISSION,
        amountPaise: calculation.gstOnCommissionPaise,
        description: `GST on service commission for ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.TDS_DEDUCTION,
        amountPaise: calculation.tdsPaise,
        description: `TDS deduction for service ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.TCS_DEDUCTION,
        amountPaise: calculation.tcsPaise,
        description: `TCS deduction for service ${booking.bookingNumber}`,
      },
      {
        entryType: SellerLedgerEntryType.PLATFORM_FEE,
        amountPaise: calculation.platformFeePaise,
        description: `Service settlement fee for ${booking.bookingNumber}`,
      },
    ];

    for (const deduction of deductions) {
      if (deduction.amountPaise <= 0) {
        continue;
      }
      await tx.sellerLedgerEntry.create({
        data: {
          sellerId: booking.sellerId,
          serviceBookingId: booking.id,
          serviceSettlementId,
          entryType: deduction.entryType,
          description: deduction.description,
          debitPaise: deduction.amountPaise,
          currency: booking.currency,
          referenceType: "service_booking",
          referenceId: booking.id,
        },
      });
    }
  }

  private async serviceRefundCommittedPaise(tx: Prisma.TransactionClient, bookingId: string) {
    const aggregate = await tx.serviceRefundRequest.aggregate({
      where: {
        bookingId,
        status: { notIn: [RefundRequestStatus.CANCELLED, RefundRequestStatus.FAILED] },
      },
      _sum: { amountPaise: true },
    });
    return aggregate._sum.amountPaise ?? 0;
  }

  private async handleServiceRazorpayRefundWebhook(payload: Record<string, unknown>, eventId?: string) {
    const refundEntity = this.extractRazorpayRefundEntity(payload);
    if (!refundEntity?.id) {
      return { handled: false };
    }

    const lookup: Prisma.ServiceRefundTransactionWhereInput[] = [
      { provider: PaymentProvider.RAZORPAY, providerRefundId: refundEntity.id },
      ...(refundEntity.paymentId
        ? [
            {
              provider: PaymentProvider.RAZORPAY,
              refundRequest: {
                servicePayment: {
                  providerPaymentId: refundEntity.paymentId,
                },
              },
              status: { in: [RefundTransactionStatus.INITIATED, RefundTransactionStatus.PROCESSING] },
            } satisfies Prisma.ServiceRefundTransactionWhereInput,
          ]
        : []),
    ];
    const transaction = await this.prisma.client.serviceRefundTransaction.findFirst({
      where: { OR: lookup },
      include: { refundRequest: true },
      orderBy: { createdAt: "desc" },
    });
    if (!transaction) {
      return { handled: false };
    }

    if (eventId) {
      try {
        await this.prisma.client.razorpayWebhookEvent.create({
          data: {
            provider: "razorpay",
            providerEventId: `service:${eventId}`,
            eventType: String(payload.event ?? "refund.webhook"),
            status: "PROCESSING",
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { handled: true, received: true, duplicate: true };
        }
        throw error;
      }
    }

    if (refundEntity.amount !== null && refundEntity.amount !== transaction.amountPaise) {
      if (eventId) {
        await this.prisma.client.razorpayWebhookEvent.update({
          where: { provider_providerEventId: { provider: "razorpay", providerEventId: `service:${eventId}` } },
          data: { status: "FAILED", processedAt: new Date() },
        });
      }
      throw new BadRequestException("Service refund amount mismatch in Razorpay webhook.");
    }

    const nextStatus = this.razorpayRefundTransactionStatus(refundEntity.status);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.serviceRefundTransaction.update({
        where: { id: transaction.id },
        data: {
          status: nextStatus,
          providerRefundId: refundEntity.id,
          providerResponse: {
            ...payload,
            ...(eventId ? { razorpayEventId: eventId } : {}),
          } as Prisma.InputJsonValue,
          processedAt:
            nextStatus === RefundTransactionStatus.SUCCESS ? new Date() : transaction.processedAt,
          failureReason:
            nextStatus === RefundTransactionStatus.FAILED
              ? this.providerFailureReason(refundEntity.raw)
              : transaction.failureReason,
        },
      });

      if (nextStatus === RefundTransactionStatus.SUCCESS) {
        await this.completeServiceRefundInTransaction(tx, transaction.serviceRefundRequestId, null, {
          method: RefundMethod.RAZORPAY,
          note: "Razorpay refund webhook confirmed service refund success.",
        });
      } else if (nextStatus === RefundTransactionStatus.FAILED) {
        await tx.serviceRefundRequest.update({
          where: { id: transaction.serviceRefundRequestId },
          data: {
            status: RefundRequestStatus.RETRY_PENDING,
            note: this.providerFailureReason(refundEntity.raw),
          },
        });
      } else {
        await tx.serviceRefundRequest.update({
          where: { id: transaction.serviceRefundRequestId },
          data: { status: RefundRequestStatus.PROCESSING },
        });
      }
    });

    if (eventId) {
      await this.prisma.client.razorpayWebhookEvent.update({
        where: { provider_providerEventId: { provider: "razorpay", providerEventId: `service:${eventId}` } },
        data: { status: "DONE", processedAt: new Date() },
      });
    }

    return { handled: true, received: true, refundTransactionId: transaction.id };
  }

  private async createRazorpayRefund(input: {
    keySecret: string;
    paymentId: string;
    amountPaise: number;
    idempotencyKey: string;
    refundNumber: string;
  }) {
    const { keyId } = await this.getRazorpayKeys();
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${input.keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          "X-Razorpay-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          amount: input.amountPaise,
          speed: "normal",
          notes: {
            serviceRefundNumber: input.refundNumber,
          },
        }),
      },
    );

    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ...body,
        status: "failed",
        errorStatusCode: response.status,
        description:
          typeof body.error === "object" && body.error && "description" in body.error
            ? String((body.error as { description?: unknown }).description ?? "")
            : `Razorpay refund failed with status ${response.status}.`,
      };
    }
    return body;
  }

  private async completeServiceRefundInTransaction(
    tx: Prisma.TransactionClient,
    refundId: string,
    actor: RequestUser | null,
    options: { method: RefundMethod; note: string },
  ) {
    const refund = await tx.serviceRefundRequest.findUnique({
      where: { id: refundId },
      include: {
        booking: { include: { payments: true } },
        servicePayment: true,
      },
    });
    if (!refund) {
      throw new NotFoundException("Service refund request not found.");
    }
    if (refund.status === RefundRequestStatus.SUCCESS) {
      return refund;
    }
    await tx.serviceRefundRequest.update({
      where: { id: refund.id },
      data: {
        status: RefundRequestStatus.SUCCESS,
        method: options.method,
        reviewedAt: new Date(),
        reviewedById: actor?.id ?? null,
        note: options.note,
      },
    });

    if (refund.servicePayment) {
      const totalRefundedForPayment = await tx.serviceRefundRequest.aggregate({
        where: {
          servicePaymentId: refund.servicePayment.id,
          status: RefundRequestStatus.SUCCESS,
        },
        _sum: { amountPaise: true },
      });
      if ((totalRefundedForPayment._sum.amountPaise ?? 0) >= refund.servicePayment.amountPaise) {
        await tx.servicePayment.update({
          where: { id: refund.servicePayment.id },
          data: { status: PaymentStatus.REFUNDED },
        });
      }
    }

    const totalSuccessfulRefunds = await tx.serviceRefundRequest.aggregate({
      where: { bookingId: refund.bookingId, status: RefundRequestStatus.SUCCESS },
      _sum: { amountPaise: true },
    });
    const grossPaid = await tx.servicePayment.aggregate({
      where: {
        bookingId: refund.bookingId,
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
      },
      _sum: { amountPaise: true },
    });
    await tx.serviceBooking.update({
      where: { id: refund.bookingId },
      data: {
        paidAmountPaise: Math.max(0, (grossPaid._sum.amountPaise ?? 0) - (totalSuccessfulRefunds._sum.amountPaise ?? 0)),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor?.id ?? null,
        action: "service_refund.completed",
        entityType: "service_refund_request",
        entityId: refund.id,
        oldValue: { status: refund.status },
        newValue: { status: RefundRequestStatus.SUCCESS, method: options.method },
      },
    });
    return refund;
  }

  private razorpayRefundTransactionStatus(status: unknown) {
    if (status === "processed") {
      return RefundTransactionStatus.SUCCESS;
    }
    if (status === "failed") {
      return RefundTransactionStatus.FAILED;
    }
    return RefundTransactionStatus.PROCESSING;
  }

  private providerFailureReason(payload: Record<string, unknown>) {
    const error = payload.error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const description = (error as Record<string, unknown>).description;
      if (typeof description === "string" && description.trim()) {
        return description.trim();
      }
    }
    const description = payload.description;
    if (typeof description === "string" && description.trim()) {
      return description.trim();
    }
    return "Refund provider did not complete the refund.";
  }

  private extractRazorpayRefundEntity(payload: Record<string, unknown>): RazorpayRefundEntity | null {
    const payloadRecord = payload.payload;
    if (!payloadRecord || typeof payloadRecord !== "object" || Array.isArray(payloadRecord)) {
      return null;
    }
    const refundWrapper = (payloadRecord as Record<string, unknown>).refund;
    if (!refundWrapper || typeof refundWrapper !== "object" || Array.isArray(refundWrapper)) {
      return null;
    }
    const entity = (refundWrapper as Record<string, unknown>).entity;
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
      return null;
    }
    const refund = entity as Record<string, unknown>;
    return {
      id: typeof refund.id === "string" ? refund.id : null,
      paymentId: typeof refund.payment_id === "string" ? refund.payment_id : null,
      status: refund.status,
      amount: typeof refund.amount === "number" ? refund.amount : null,
      raw: refund,
    };
  }

  private serviceRefundIdempotencyKey(refundNumber: string, attempt: number) {
    return `service-refund:${refundNumber}:${attempt}`;
  }

  private async lockServiceRefundRequest(tx: Prisma.TransactionClient, refundRequestId: string) {
    await tx.$queryRaw`SELECT id FROM service_refund_requests WHERE id = ${refundRequestId}::uuid FOR UPDATE`;
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
    payment: RazorpayPayableRecord,
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
    payment: RazorpayPayableRecord,
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

  private serviceRazorpayOrderResponse(keyId: string, payment: RazorpayServicePaymentWithBooking) {
    if (!payment.providerOrderId) {
      throw new ServiceUnavailableException("Razorpay service payment order id is not available yet.");
    }
    return {
      keyId,
      razorpayOrderId: payment.providerOrderId,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      bookingNumber: payment.booking.bookingNumber,
      servicePaymentId: payment.id,
      purpose: payment.purpose,
    };
  }

  private ensureCustomerOwnsServicePayment(
    actor: RequestUser,
    payment: RazorpayServicePaymentWithBooking,
  ) {
    if (payment.booking.customer.userId !== actor.id) {
      throw new ForbiddenException("Service payment does not belong to the authenticated customer.");
    }
  }

  private ensureServicePaymentCanUseRazorpay(payment: RazorpayServicePaymentWithBooking) {
    if (payment.provider !== PaymentProvider.RAZORPAY) {
      throw new BadRequestException("This service payment is not payable through Razorpay.");
    }
    if (payment.amountPaise < 100) {
      throw new BadRequestException("Minimum Razorpay amount is INR 1.00.");
    }
    const terminalPaymentStatuses: PaymentStatus[] = [
      PaymentStatus.PAID,
      PaymentStatus.REFUNDED,
      PaymentStatus.NOT_REQUIRED,
    ];
    if (terminalPaymentStatuses.includes(payment.status)) {
      throw new BadRequestException("This service payment is already closed.");
    }
    const blockedStatuses: ServiceBookingStatus[] = [
      ServiceBookingStatus.CANCELLED,
      ServiceBookingStatus.CANCELLED_AFTER_DISPUTE,
      ServiceBookingStatus.REJECTED,
      ServiceBookingStatus.QUOTE_REJECTED,
      ServiceBookingStatus.QUOTE_EXPIRED,
    ];
    if (blockedStatuses.includes(payment.booking.status)) {
      throw new BadRequestException("This service booking is no longer payable.");
    }
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

  private absoluteApiUrl(path: string) {
    const configuredBase =
      process.env.API_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "";

    if (!configuredBase) {
      return null;
    }

    const base = configuredBase.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (base.toLowerCase().endsWith("/api") && normalizedPath.toLowerCase().startsWith("/api/")) {
      return `${base}${normalizedPath.slice(4)}`;
    }

    return `${base}${normalizedPath}`;
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
