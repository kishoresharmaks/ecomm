import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ApprovalStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  SellerCapability,
  SellerStatus,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionPlanAudience,
  SellerSubscriptionProviderEventStatus,
  SellerSubscriptionStatus,
} from "@indihub/database";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { readBooleanSetting } from "../settings/setting-value-utils";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  AssignSellerSubscriptionDto,
  CreateSellerSubscriptionPlanDto,
  SellerSubscriptionPlanQueryDto,
  UpdateSellerSubscriptionPlanDto,
  VerifySellerRazorpaySubscriptionDto,
} from "./dto/seller-subscription.dto";

type SellerPlanWriteDto = CreateSellerSubscriptionPlanDto | UpdateSellerSubscriptionPlanDto;
type PaymentSettingMap = Map<string, Prisma.JsonValue>;
type PaymentSettingClient = Prisma.TransactionClient | PrismaService["client"];

type SellerSubscriptionPlanForBilling = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  pricePaise: number;
  currency: string;
  billingCycle: SellerSubscriptionBillingCycle;
  audience: SellerSubscriptionPlanAudience;
  productLimit?: number | null;
  providerPlanId?: string | null;
  providerPlanVersion?: number | null;
};

type RazorpayFetchedPayment = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  subscription_id?: string;
  [key: string]: unknown;
};

type RazorpaySubscriptionWebhookResult =
  | { handled: false }
  | {
      handled: true;
      received: true;
      ignored?: boolean;
      status?: SellerSubscriptionStatus;
      reason?: string;
    };

const PAYMENT_SETTING_KEYS = {
  razorpayEnabled: "payments.razorpay.enabled",
  razorpayKeyId: "payments.razorpay.key_id",
  razorpayKeySecret: "payments.razorpay.key_secret",
} as const;

const paymentConfigKeys = Object.values(PAYMENT_SETTING_KEYS);
const recurringBillingCycles = new Set<SellerSubscriptionBillingCycle>([
  SellerSubscriptionBillingCycle.MONTHLY,
  SellerSubscriptionBillingCycle.YEARLY,
]);
const sellerSubscriptionGraceDays = 7;

@Injectable()
export class SellerSubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublicPlans(audience: SellerSubscriptionPlanAudience = SellerSubscriptionPlanAudience.RETAIL) {
    const scopedAudience = this.normalizePlanAudience(audience);
    const items = await this.prisma.client.sellerSubscriptionPlan.findMany({
      where: {
        isActive: true,
        audience: { in: this.audienceMatch(scopedAudience) },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return {
      items,
      defaultPlanId:
        items.find((plan) => plan.isDefault && plan.audience === scopedAudience)?.id ??
        items.find((plan) => plan.isDefault && plan.audience === SellerSubscriptionPlanAudience.ALL)?.id ??
        items[0]?.id ??
        null,
    };
  }

  async listAdminPlans(query: SellerSubscriptionPlanQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.SellerSubscriptionPlanWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.audience ? { audience: query.audience } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerSubscriptionPlan.findMany({
        where,
        include: {
          _count: {
            select: {
              currentSellers: true,
              subscriptions: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip,
        take,
      });
      const total = await tx.sellerSubscriptionPlan.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async createPlan(dto: CreateSellerSubscriptionPlanDto, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      this.assertDefaultAllowed(dto);

      if (dto.isDefault) {
        await tx.sellerSubscriptionPlan.updateMany({
          where: { audience: this.normalizePlanAudience(dto.audience) },
          data: { isDefault: false },
        });
      }

      const plan = await tx.sellerSubscriptionPlan.create({
        data: this.createPlanData(dto),
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.created",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          newValue: this.auditPlanValue(plan),
        },
      });

      return plan;
    });

    return plan;
  }

  async updatePlan(planId: string, dto: UpdateSellerSubscriptionPlanDto, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.sellerSubscriptionPlan.findUnique({ where: { id: planId } });

      if (!existing) {
        throw new NotFoundException("Seller subscription plan not found.");
      }

      this.assertDefaultAllowed(dto, existing);

      const nextAudience = this.normalizePlanAudience(dto.audience ?? existing.audience);

      if (dto.isDefault) {
        await tx.sellerSubscriptionPlan.updateMany({
          where: { id: { not: planId }, audience: nextAudience },
          data: { isDefault: false },
        });
      }

      const plan = await tx.sellerSubscriptionPlan.update({
        where: { id: planId },
        data: this.planData(dto, existing),
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.updated",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          oldValue: this.auditPlanValue(existing),
          newValue: this.auditPlanValue(plan),
        },
      });

      return plan;
    });

    return plan;
  }

  async setDefaultPlan(planId: string, actor: RequestUser) {
    const plan = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.sellerSubscriptionPlan.findUnique({ where: { id: planId } });

      if (!existing) {
        throw new NotFoundException("Seller subscription plan not found.");
      }

      if (!existing.isActive) {
        throw new BadRequestException("Only active seller subscription plans can be set as default.");
      }

      await tx.sellerSubscriptionPlan.updateMany({
        where: { id: { not: planId }, audience: existing.audience },
        data: { isDefault: false },
      });

      const plan = await tx.sellerSubscriptionPlan.update({
        where: { id: planId },
        data: { isDefault: true },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription_plan.default_set",
          entityType: "seller_subscription_plan",
          entityId: plan.id,
          oldValue: this.auditPlanValue(existing),
          newValue: this.auditPlanValue(plan),
        },
      });

      return plan;
    });

    return plan;
  }

  async assignSellerPlan(sellerId: string, dto: AssignSellerSubscriptionDto, actor: RequestUser) {
    const updatedSeller = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId, deletedAt: null },
        include: { subscriptionPlan: true },
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }

      const plan = await tx.sellerSubscriptionPlan.findFirst({
        where: {
          id: dto.planId,
          isActive: true,
        },
      });

      if (!plan) {
        throw new BadRequestException("Select an active seller subscription plan.");
      }

      this.assertPlanMatchesSellerCapabilities(plan, seller.enabledCapabilities);

      const status = dto.status ?? this.defaultStatusForPlan(plan);
      const currentPeriodEnd = dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null;
      await tx.sellerSubscription.updateMany({
        where: {
          sellerId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      await tx.sellerSubscription.create({
        data: {
          sellerId,
          planId: plan.id,
          status,
          isCurrent: true,
          currentPeriodEnd,
          lastPaymentStatus: this.isRecurringPaidPlan(plan) ? PaymentStatus.PENDING : PaymentStatus.NOT_REQUIRED,
          note: dto.note ?? null,
          createdById: actor.id,
        },
      });

      const updatedSeller = await tx.seller.update({
        where: { id: sellerId },
        data: {
          subscriptionPlanId: plan.id,
          subscriptionStatus: status,
          subscriptionStartedAt: new Date(),
          subscriptionCurrentPeriodEnd: currentPeriodEnd,
        },
        include: {
          user: true,
          profile: true,
          addresses: true,
          subscriptionPlan: true,
          subscriptions: {
            where: { isCurrent: true },
            include: { plan: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.subscription.assigned",
          entityType: "seller",
          entityId: sellerId,
          oldValue: {
            planId: seller.subscriptionPlanId,
            planName: seller.subscriptionPlan?.name,
            status: seller.subscriptionStatus,
          },
          newValue: {
            planId: plan.id,
            planName: plan.name,
            status,
            note: dto.note,
          },
        },
      });

      return updatedSeller;
    });

    return updatedSeller;
  }

  async getSellerSubscription(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      include: {
        user: true,
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: {
            plan: true,
            payments: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    const currentSubscription = await this.expirePastGracePeriodForSeller(seller.id);
    const refreshedSubscription = currentSubscription
      ? await this.prisma.client.sellerSubscription.findUnique({
          where: { id: currentSubscription.id },
          include: {
            plan: true,
            payments: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        })
      : seller.subscriptions[0] ?? null;

    const status = refreshedSubscription?.status ?? seller.subscriptionStatus;
    const plan = refreshedSubscription?.plan ?? seller.subscriptionPlan;

    return {
      sellerId: seller.id,
      subscriptionStatus: status,
      subscriptionStartedAt: seller.subscriptionStartedAt,
      subscriptionCurrentPeriodEnd: refreshedSubscription?.currentPeriodEnd ?? seller.subscriptionCurrentPeriodEnd,
      plan,
      currentSubscription: refreshedSubscription,
      payments: refreshedSubscription?.payments ?? [],
      billing: {
        requiresPayment: plan ? this.isRecurringPaidPlan(plan) : false,
        canAuthorize:
          seller.status === SellerStatus.APPROVED &&
          seller.approvalStatus === ApprovalStatus.APPROVED &&
          Boolean(plan && this.isRecurringPaidPlan(plan)) &&
          status !== SellerSubscriptionStatus.ACTIVE,
        canCancel:
          Boolean(refreshedSubscription?.providerSubscriptionId) &&
          status === SellerSubscriptionStatus.ACTIVE &&
          !refreshedSubscription?.cancelAtPeriodEnd,
        gracePeriodEndsAt: refreshedSubscription?.gracePeriodEndsAt ?? null,
        cancelAtPeriodEnd: refreshedSubscription?.cancelAtPeriodEnd ?? false,
        providerStatus: refreshedSubscription?.providerStatus ?? null,
        lastPaymentStatus: refreshedSubscription?.lastPaymentStatus ?? null,
        paymentFailureCount: refreshedSubscription?.paymentFailureCount ?? 0,
      },
    };
  }

  async authorizeSellerSubscription(actor: RequestUser) {
    const seller = await this.getSellerForBilling(actor.id);
    this.assertSellerApprovedForBilling(seller);

    const plan = seller.subscriptionPlan;
    if (!plan) {
      throw new BadRequestException("No seller subscription plan is assigned.");
    }

    const currentSubscription = await this.ensureCurrentSubscriptionRecord(seller.id, plan, actor.id);

    if (!this.isRecurringPaidPlan(plan)) {
      await this.activateNonRecurringSubscription(seller.id, currentSubscription.id, plan);
      return {
        requiresPayment: false,
        status: SellerSubscriptionStatus.ACTIVE,
        sellerId: seller.id,
        plan,
      };
    }

    const { keyId, keySecret } = await this.getRazorpayKeys();
    const providerPlanId = await this.ensureRazorpayProviderPlan(plan, keyId, keySecret);
    const refreshedSubscription = await this.prisma.client.sellerSubscription.findUniqueOrThrow({
      where: { id: currentSubscription.id },
    });

    if (refreshedSubscription.providerSubscriptionId) {
      return this.sellerAuthorizationResponse(
        keyId,
        seller,
        plan,
        refreshedSubscription.providerSubscriptionId,
        refreshedSubscription.id,
      );
    }

    const providerSubscription = await this.createRazorpaySubscription(
      keyId,
      keySecret,
      providerPlanId,
      seller,
      plan,
      refreshedSubscription.id,
    );
    const providerSubscriptionId = this.stringFromRecord(providerSubscription, "id");
    if (!providerSubscriptionId) {
      throw new ServiceUnavailableException(
        "Razorpay subscription creation did not return a provider subscription id.",
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.sellerSubscription.update({
        where: { id: refreshedSubscription.id },
        data: {
          status: SellerSubscriptionStatus.PENDING_PAYMENT,
          provider: PaymentProvider.RAZORPAY,
          providerSubscriptionId,
          providerPlanId,
          providerStatus: this.stringFromRecord(providerSubscription, "status") ?? "created",
          providerCustomerId: this.stringFromRecord(providerSubscription, "customer_id") ?? null,
          providerSnapshot: providerSubscription as Prisma.InputJsonValue,
          lastPaymentStatus: PaymentStatus.PENDING,
          cancelAtPeriodEnd: false,
          providerCancelAtCycleEnd: false,
        },
      });
      await tx.seller.update({
        where: { id: seller.id },
        data: {
          subscriptionStatus: SellerSubscriptionStatus.PENDING_PAYMENT,
          subscriptionCurrentPeriodEnd: null,
        },
      });
    });

    return this.sellerAuthorizationResponse(
      keyId,
      seller,
      plan,
      providerSubscriptionId,
      refreshedSubscription.id,
    );
  }

  async verifySellerRazorpaySubscription(
    actor: RequestUser,
    dto: VerifySellerRazorpaySubscriptionDto,
  ) {
    const { keyId, keySecret } = await this.getRazorpayKeys(false);
    const subscription = await this.prisma.client.sellerSubscription.findUnique({
      where: { providerSubscriptionId: dto.razorpaySubscriptionId },
      include: {
        seller: { include: { user: true } },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException("Seller subscription was not found for this Razorpay subscription.");
    }

    if (subscription.seller.userId !== actor.id) {
      throw new ForbiddenException("Subscription does not belong to the authenticated seller.");
    }

    this.verifyRazorpaySubscriptionSignature(dto, keySecret);
    const providerPayment = await this.fetchRazorpayPayment(keyId, keySecret, dto.razorpayPaymentId);
    this.ensureProviderPaymentMatchesSubscription(subscription, providerPayment, dto.razorpayPaymentId);

    const nextStatus =
      providerPayment.status === "captured"
        ? SellerSubscriptionStatus.ACTIVE
        : providerPayment.status === "failed"
          ? SellerSubscriptionStatus.PENDING_PAYMENT
          : subscription.status;
    const nextPaymentStatus = this.mapRazorpayPaymentStatus(providerPayment.status);
    const periodEnd =
      nextStatus === SellerSubscriptionStatus.ACTIVE
        ? this.periodEndFromPlan(subscription.plan, new Date())
        : subscription.currentPeriodEnd;

    await this.prisma.client.$transaction(async (tx) => {
      await this.recordSubscriptionPayment(tx, subscription, {
        providerPaymentId: dto.razorpayPaymentId,
        amountPaise: providerPayment.amount ?? subscription.plan.pricePaise,
        currency: providerPayment.currency ?? subscription.plan.currency,
        status: nextPaymentStatus,
        billingPeriodStart: new Date(),
        billingPeriodEnd: periodEnd,
        rawResponse: {
          providerPayment,
          checkoutResponse: {
            razorpaySubscriptionId: dto.razorpaySubscriptionId,
            razorpayPaymentId: dto.razorpayPaymentId,
            signatureVerified: true,
          },
        },
      });

      await tx.sellerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: nextStatus,
          providerStatus:
            nextStatus === SellerSubscriptionStatus.ACTIVE
              ? "authenticated"
              : providerPayment.status ?? subscription.providerStatus,
          authorizedAt:
            nextStatus === SellerSubscriptionStatus.ACTIVE
              ? (subscription.authorizedAt ?? new Date())
              : subscription.authorizedAt,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
          gracePeriodEndsAt: null,
          lastPaymentStatus: nextPaymentStatus,
          paymentFailureCount:
            nextPaymentStatus === PaymentStatus.PAID ? 0 : subscription.paymentFailureCount,
        },
      });

      await tx.seller.update({
        where: { id: subscription.sellerId },
        data: {
          subscriptionStatus: nextStatus,
          subscriptionStartedAt:
            nextStatus === SellerSubscriptionStatus.ACTIVE
              ? (subscription.seller.subscriptionStartedAt ?? new Date())
              : subscription.seller.subscriptionStartedAt,
          subscriptionCurrentPeriodEnd: periodEnd,
        },
      });
    });

    return this.getSellerSubscription(actor);
  }

  async cancelSellerSubscription(actor: RequestUser) {
    const seller = await this.getSellerForBilling(actor.id);
    const subscription = seller.subscriptions[0];

    if (!subscription) {
      throw new BadRequestException("No active seller subscription assignment was found.");
    }

    if (!subscription.providerSubscriptionId) {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.sellerSubscription.update({
          where: { id: subscription.id },
          data: {
            status: SellerSubscriptionStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelAtPeriodEnd: false,
          },
        });
        await tx.seller.update({
          where: { id: seller.id },
          data: { subscriptionStatus: SellerSubscriptionStatus.CANCELLED },
        });
      });
      return this.getSellerSubscription(actor);
    }

    const { keyId, keySecret } = await this.getRazorpayKeys(false);
    const providerResponse = await this.cancelRazorpaySubscription(
      keyId,
      keySecret,
      subscription.providerSubscriptionId,
    );

    await this.prisma.client.sellerSubscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        providerCancelAtCycleEnd: true,
        providerStatus: this.stringFromRecord(providerResponse, "status") ?? subscription.providerStatus,
        providerSnapshot: providerResponse as Prisma.InputJsonValue,
      },
    });

    return this.getSellerSubscription(actor);
  }

  async handleRazorpaySubscriptionWebhook(
    payload: Record<string, unknown>,
    eventId?: string,
  ): Promise<RazorpaySubscriptionWebhookResult> {
    const eventType = String(payload.event ?? "");
    const subscriptionEntity = this.extractRazorpayEntity(payload, "subscription");
    const paymentEntity = this.extractRazorpayEntity(payload, "payment");
    const invoiceEntity = this.extractRazorpayEntity(payload, "invoice");
    const providerSubscriptionId =
      this.stringFromRecord(subscriptionEntity, "id") ??
      this.stringFromRecord(paymentEntity, "subscription_id") ??
      this.stringFromRecord(invoiceEntity, "subscription_id");

    if (!providerSubscriptionId) {
      return { handled: false };
    }

    const subscription = await this.prisma.client.sellerSubscription.findUnique({
      where: { providerSubscriptionId },
      include: {
        seller: true,
        plan: true,
      },
    });

    if (!subscription) {
      return { handled: false };
    }

    const providerEventId =
      eventId?.trim() ||
      [
        eventType || "razorpay.subscription_event",
        providerSubscriptionId,
        this.stringFromRecord(paymentEntity, "id") ??
          this.stringFromRecord(invoiceEntity, "id") ??
          this.stringFromRecord(subscriptionEntity, "status") ??
          "unknown",
      ].join(":");
    const existingEvent = await this.prisma.client.sellerSubscriptionProviderEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: PaymentProvider.RAZORPAY,
          providerEventId,
        },
      },
    });

    if (existingEvent) {
      return { handled: true, received: true, ignored: true, reason: "duplicate_event" };
    }

    const now = new Date();
    const next = this.subscriptionStateFromWebhook(eventType, subscription, subscriptionEntity, now);
    const paymentStatus = this.paymentStatusFromWebhook(eventType, paymentEntity, invoiceEntity);
    const providerStatus =
      this.stringFromRecord(subscriptionEntity, "status") ??
      this.stringFromRecord(invoiceEntity, "status") ??
      this.stringFromRecord(paymentEntity, "status") ??
      subscription.providerStatus;

    await this.prisma.client.$transaction(async (tx) => {
      const providerEvent = await tx.sellerSubscriptionProviderEvent.create({
        data: {
          sellerSubscriptionId: subscription.id,
          provider: PaymentProvider.RAZORPAY,
          providerEventId,
          eventType: eventType || "unknown",
          status: SellerSubscriptionProviderEventStatus.RECEIVED,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      if (paymentStatus) {
        await this.recordSubscriptionPayment(tx, subscription, {
          providerSubscriptionId,
          providerInvoiceId: this.stringFromRecord(invoiceEntity, "id") ?? null,
          providerPaymentId: this.stringFromRecord(paymentEntity, "id") ?? null,
          amountPaise:
            this.numberFromRecord(paymentEntity, "amount") ??
            this.numberFromRecord(invoiceEntity, "amount") ??
            subscription.plan.pricePaise,
          currency:
            this.stringFromRecord(paymentEntity, "currency") ??
            this.stringFromRecord(invoiceEntity, "currency") ??
            subscription.plan.currency,
          status: paymentStatus,
          billingPeriodStart:
            this.dateFromUnixRecord(invoiceEntity, "billing_start") ??
            this.dateFromUnixRecord(invoiceEntity, "period_start") ??
            now,
          billingPeriodEnd:
            this.dateFromUnixRecord(invoiceEntity, "billing_end") ??
            this.dateFromUnixRecord(invoiceEntity, "period_end") ??
            next.currentPeriodEnd,
          rawResponse: payload,
        });
      }

      await tx.sellerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: next.status,
          providerStatus,
          authorizedAt: next.authorizedAt,
          currentPeriodEnd: next.currentPeriodEnd,
          nextBillingAt: next.nextBillingAt,
          gracePeriodEndsAt: next.gracePeriodEndsAt,
          cancelAtPeriodEnd: next.cancelAtPeriodEnd,
          cancelledAt: next.cancelledAt,
          lastPaymentStatus: paymentStatus ?? subscription.lastPaymentStatus,
          paymentFailureCount: next.paymentFailureCount,
          providerSnapshot: {
            subscription: subscriptionEntity,
            invoice: invoiceEntity,
            payment: paymentEntity,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.seller.update({
        where: { id: subscription.sellerId },
        data: {
          subscriptionStatus: next.status,
          subscriptionStartedAt:
            next.status === SellerSubscriptionStatus.ACTIVE
              ? (subscription.seller.subscriptionStartedAt ?? now)
              : subscription.seller.subscriptionStartedAt,
          subscriptionCurrentPeriodEnd: next.currentPeriodEnd,
        },
      });

      await tx.sellerSubscriptionProviderEvent.update({
        where: { id: providerEvent.id },
        data: {
          status: next.handled
            ? SellerSubscriptionProviderEventStatus.PROCESSED
            : SellerSubscriptionProviderEventStatus.SKIPPED,
          processedAt: now,
          message: next.message,
        },
      });
    });

    return {
      handled: true,
      received: true,
      ignored: !next.handled,
      status: next.status,
      ...(next.message ? { reason: next.message } : {}),
    };
  }

  async ensureCanCreateProduct(sellerId: string) {
    const { plan } = await this.ensureSellerSubscriptionAllowsOperation(sellerId, "create new products");
    if (plan?.productLimit === null || plan?.productLimit === undefined) {
      return;
    }

    const productCount = await this.prisma.client.product.count({
      where: {
        sellerId,
        deletedAt: null,
        status: { not: ProductStatus.ARCHIVED },
      },
    });

    if (productCount >= plan.productLimit) {
      throw new ForbiddenException(
        `Your seller plan allows ${plan.productLimit} products. Upgrade the subscription plan to add more products.`,
      );
    }
  }

  async ensureCanUseSellerB2B(sellerId: string) {
    const { plan } = await this.ensureSellerSubscriptionAllowsOperation(
      sellerId,
      "respond to B2B enquiries",
    );
    if (!plan?.b2bEnquiryLimit || plan.b2bEnquiryLimit <= 0) {
      throw new ForbiddenException("Upgrade your subscription plan to respond to B2B enquiries.");
    }
  }

  async expirePastGracePeriods() {
    const now = new Date();
    const expired = await this.prisma.client.sellerSubscription.findMany({
      where: {
        isCurrent: true,
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
        gracePeriodEndsAt: { lte: now },
      },
      select: { id: true, sellerId: true },
    });

    if (!expired.length) {
      return { expired: 0 };
    }

    const subscriptionIds = expired.map((subscription) => subscription.id);
    const sellerIds = expired.map((subscription) => subscription.sellerId);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.sellerSubscription.updateMany({
        where: { id: { in: subscriptionIds } },
        data: { status: SellerSubscriptionStatus.EXPIRED },
      });
      await tx.seller.updateMany({
        where: { id: { in: sellerIds } },
        data: { subscriptionStatus: SellerSubscriptionStatus.EXPIRED },
      });
    });

    return { expired: expired.length };
  }

  async resolveRegistrationPlan(
    tx: Prisma.TransactionClient,
    planId: string | undefined,
    primaryCapability: SellerCapability = SellerCapability.RETAIL,
  ) {
    const audience = this.audienceFromCapability(primaryCapability);

    if (planId) {
      const selectedPlan = await tx.sellerSubscriptionPlan.findFirst({
        where: {
          id: planId,
          isActive: true,
          audience: { in: this.audienceMatch(audience) },
        },
      });

      if (!selectedPlan) {
        throw new BadRequestException("Select an active subscription plan for this onboarding type.");
      }

      return selectedPlan;
    }

    const defaultPlan = await tx.sellerSubscriptionPlan.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        audience,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    if (defaultPlan) {
      return defaultPlan;
    }

    const sharedDefaultPlan = await tx.sellerSubscriptionPlan.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        audience: SellerSubscriptionPlanAudience.ALL,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    if (sharedDefaultPlan) {
      return sharedDefaultPlan;
    }

    return tx.sellerSubscriptionPlan.findFirst({
      where: {
        isActive: true,
        audience: { in: this.audienceMatch(audience) },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  initialRegistrationStatus(plan: SellerSubscriptionPlanForBilling | null) {
    return plan ? this.defaultStatusForPlan(plan) : SellerSubscriptionStatus.ACTIVE;
  }

  async recordRegistrationAssignment(
    tx: Prisma.TransactionClient,
    sellerId: string,
    plan: SellerSubscriptionPlanForBilling | null,
    actorId: string,
  ) {
    if (!plan) {
      return;
    }

    await tx.sellerSubscription.create({
      data: {
        sellerId,
        planId: plan.id,
        status: this.defaultStatusForPlan(plan),
        isCurrent: true,
        createdById: actorId,
        lastPaymentStatus: this.isRecurringPaidPlan(plan) ? PaymentStatus.PENDING : PaymentStatus.NOT_REQUIRED,
        note: "Assigned during seller onboarding.",
      },
    });
  }

  defaultStatusForPlan(plan: SellerSubscriptionPlanForBilling) {
    return this.isRecurringPaidPlan(plan)
      ? SellerSubscriptionStatus.PENDING_PAYMENT
      : SellerSubscriptionStatus.ACTIVE;
  }

  private async ensureSellerSubscriptionAllowsOperation(sellerId: string, operation: string) {
    const refreshed = await this.expirePastGracePeriodForSeller(sellerId);
    const seller = await this.prisma.client.seller.findUnique({
      where: { id: sellerId },
      include: {
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }

    const subscription = refreshed ?? seller.subscriptions[0] ?? null;
    const plan = subscription?.plan ?? seller.subscriptionPlan;

    if (!plan || !this.isRecurringPaidPlan(plan)) {
      return { seller, subscription, plan };
    }

    if (subscription?.status === SellerSubscriptionStatus.ACTIVE || subscription?.status === SellerSubscriptionStatus.TRIALING) {
      return { seller, subscription, plan };
    }

    const inGrace =
      subscription?.status === SellerSubscriptionStatus.PENDING_PAYMENT &&
      subscription.gracePeriodEndsAt &&
      subscription.gracePeriodEndsAt > new Date();

    if (inGrace) {
      return { seller, subscription, plan };
    }

    throw new ForbiddenException(
      `Seller subscription payment is required before you can ${operation}.`,
    );
  }

  private async expirePastGracePeriodForSeller(sellerId: string) {
    const subscription = await this.prisma.client.sellerSubscription.findFirst({
      where: {
        sellerId,
        isCurrent: true,
      },
      include: { plan: true, payments: { orderBy: { createdAt: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
    });

    if (
      !subscription ||
      subscription.status !== SellerSubscriptionStatus.PENDING_PAYMENT ||
      !subscription.gracePeriodEndsAt ||
      subscription.gracePeriodEndsAt > new Date()
    ) {
      return subscription;
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.sellerSubscription.update({
        where: { id: subscription.id },
        data: { status: SellerSubscriptionStatus.EXPIRED },
      });
      await tx.seller.update({
        where: { id: sellerId },
        data: { subscriptionStatus: SellerSubscriptionStatus.EXPIRED },
      });
    });

    return {
      ...subscription,
      status: SellerSubscriptionStatus.EXPIRED,
    };
  }

  private async getSellerForBilling(userId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId },
      include: {
        user: true,
        profile: true,
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: {
            plan: true,
            payments: { orderBy: { createdAt: "desc" }, take: 10 },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return seller;
  }

  private assertSellerApprovedForBilling(seller: {
    status: SellerStatus;
    approvalStatus: ApprovalStatus;
  }) {
    if (
      seller.status !== SellerStatus.APPROVED ||
      seller.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new ForbiddenException("Seller approval is required before recurring payment authorization.");
    }
  }

  private async ensureCurrentSubscriptionRecord(
    sellerId: string,
    plan: SellerSubscriptionPlanForBilling,
    actorId: string,
  ) {
    const existing = await this.prisma.client.sellerSubscription.findFirst({
      where: { sellerId, isCurrent: true },
      orderBy: { createdAt: "desc" },
    });

    if (existing && existing.planId === plan.id) {
      return existing;
    }

    return this.prisma.client.$transaction(async (tx) => {
      await tx.sellerSubscription.updateMany({
        where: { sellerId, isCurrent: true },
        data: { isCurrent: false },
      });

      return tx.sellerSubscription.create({
        data: {
          sellerId,
          planId: plan.id,
          status: this.defaultStatusForPlan(plan),
          isCurrent: true,
          createdById: actorId,
          lastPaymentStatus: this.isRecurringPaidPlan(plan) ? PaymentStatus.PENDING : PaymentStatus.NOT_REQUIRED,
          note: "Created for seller recurring payment authorization.",
        },
      });
    });
  }

  private async activateNonRecurringSubscription(
    sellerId: string,
    subscriptionId: string,
    plan: SellerSubscriptionPlanForBilling,
  ) {
    await this.prisma.client.$transaction(async (tx) => {
      await tx.sellerSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SellerSubscriptionStatus.ACTIVE,
          currentPeriodEnd:
            plan.billingCycle === SellerSubscriptionBillingCycle.LIFETIME
              ? null
              : this.periodEndFromPlan(plan, new Date()),
          lastPaymentStatus: PaymentStatus.NOT_REQUIRED,
          gracePeriodEndsAt: null,
        },
      });
      await tx.seller.update({
        where: { id: sellerId },
        data: {
          subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
          subscriptionStartedAt: new Date(),
          subscriptionCurrentPeriodEnd:
            plan.billingCycle === SellerSubscriptionBillingCycle.LIFETIME
              ? null
              : this.periodEndFromPlan(plan, new Date()),
        },
      });
    });
  }

  private async ensureRazorpayProviderPlan(
    plan: SellerSubscriptionPlanForBilling,
    keyId: string,
    keySecret: string,
  ) {
    const current = await this.prisma.client.sellerSubscriptionPlan.findUniqueOrThrow({
      where: { id: plan.id },
    });

    if (current.providerPlanId) {
      return current.providerPlanId;
    }

    const providerPlan = await this.createRazorpayPlan(keyId, keySecret, current);
    const providerPlanId = this.stringFromRecord(providerPlan, "id");
    if (!providerPlanId) {
      throw new ServiceUnavailableException(
        "Razorpay plan creation did not return a provider plan id.",
      );
    }

    const updated = await this.prisma.client.sellerSubscriptionPlan.update({
      where: { id: current.id },
      data: {
        providerPlanId,
        providerPlanSyncedAt: new Date(),
        providerPlanSnapshot: providerPlan as Prisma.InputJsonValue,
      },
    });

    return updated.providerPlanId ?? providerPlanId;
  }

  private async createRazorpayPlan(
    keyId: string,
    keySecret: string,
    plan: SellerSubscriptionPlanForBilling,
  ) {
    const response = await fetch("https://api.razorpay.com/v1/plans", {
      method: "POST",
      headers: this.razorpayHeaders(keyId, keySecret),
      body: JSON.stringify({
        period: plan.billingCycle === SellerSubscriptionBillingCycle.YEARLY ? "yearly" : "monthly",
        interval: 1,
        item: {
          name: plan.name,
          description: plan.description ?? `1HandIndia seller plan ${plan.code}`,
          amount: plan.pricePaise,
          currency: plan.currency,
        },
        notes: {
          indihubPlanId: plan.id,
          planCode: plan.code,
          planVersion: String(plan.providerPlanVersion ?? 1),
        },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay plan creation failed with status ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private async createRazorpaySubscription(
    keyId: string,
    keySecret: string,
    providerPlanId: string,
    seller: Awaited<ReturnType<SellerSubscriptionsService["getSellerForBilling"]>>,
    plan: SellerSubscriptionPlanForBilling,
    subscriptionId: string,
  ) {
    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: this.razorpayHeaders(keyId, keySecret),
      body: JSON.stringify({
        plan_id: providerPlanId,
        total_count: plan.billingCycle === SellerSubscriptionBillingCycle.YEARLY ? 10 : 120,
        quantity: 1,
        customer_notify: 1,
        notes: {
          indihubSellerId: seller.id,
          indihubSubscriptionId: subscriptionId,
          sellerEmail: seller.user.email,
          planCode: plan.code,
        },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay subscription creation failed with status ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private async cancelRazorpaySubscription(
    keyId: string,
    keySecret: string,
    providerSubscriptionId: string,
  ) {
    const response = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}/cancel`,
      {
        method: "POST",
        headers: this.razorpayHeaders(keyId, keySecret),
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay subscription cancellation failed with status ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private sellerAuthorizationResponse(
    keyId: string,
    seller: Awaited<ReturnType<SellerSubscriptionsService["getSellerForBilling"]>>,
    plan: SellerSubscriptionPlanForBilling,
    providerSubscriptionId: string,
    subscriptionId: string,
  ) {
    return {
      requiresPayment: true,
      keyId,
      sellerId: seller.id,
      subscriptionId,
      razorpaySubscriptionId: providerSubscriptionId,
      amountPaise: plan.pricePaise,
      currency: plan.currency,
      plan,
      checkout: {
        key: keyId,
        subscription_id: providerSubscriptionId,
        name: "1HandIndia",
        description: `${plan.name} seller subscription`,
        prefill: {
          name: seller.profile?.contactName ?? seller.storeName,
          email: seller.user.email,
          contact: seller.profile?.contactPhone ?? seller.user.phone ?? undefined,
        },
        theme: {
          color: "#ED3500",
        },
      },
    };
  }

  private verifyRazorpaySubscriptionSignature(
    dto: VerifySellerRazorpaySubscriptionDto,
    keySecret: string,
  ) {
    const expected = createHmac("sha256", keySecret)
      .update(`${dto.razorpaySubscriptionId}|${dto.razorpayPaymentId}`)
      .digest("hex");

    if (!this.safeCompare(dto.razorpaySignature, expected)) {
      throw new UnauthorizedException("Invalid Razorpay subscription checkout signature.");
    }
  }

  private ensureProviderPaymentMatchesSubscription(
    subscription: {
      providerSubscriptionId?: string | null;
      plan: SellerSubscriptionPlanForBilling;
    },
    providerPayment: RazorpayFetchedPayment,
    razorpayPaymentId: string,
  ) {
    if (providerPayment.id && providerPayment.id !== razorpayPaymentId) {
      throw new BadRequestException("Fetched Razorpay payment id does not match checkout response.");
    }

    if (
      providerPayment.subscription_id &&
      providerPayment.subscription_id !== subscription.providerSubscriptionId
    ) {
      throw new BadRequestException("Fetched Razorpay payment does not match seller subscription.");
    }

    if (providerPayment.amount !== undefined && providerPayment.amount !== subscription.plan.pricePaise) {
      throw new BadRequestException("Razorpay payment amount does not match the seller plan price.");
    }

    if (providerPayment.currency && providerPayment.currency !== subscription.plan.currency) {
      throw new BadRequestException("Razorpay payment currency does not match the seller plan currency.");
    }
  }

  private async fetchRazorpayPayment(keyId: string, keySecret: string, paymentId: string) {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: this.razorpayHeaders(keyId, keySecret),
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay payment fetch failed with status ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as RazorpayFetchedPayment;
  }

  private async recordSubscriptionPayment(
    tx: Prisma.TransactionClient,
    subscription: {
      id: string;
      sellerId: string;
      providerSubscriptionId?: string | null;
    },
    payment: {
      providerSubscriptionId?: string | null;
      providerInvoiceId?: string | null;
      providerPaymentId?: string | null;
      amountPaise: number;
      currency: string;
      status: PaymentStatus;
      billingPeriodStart?: Date | null;
      billingPeriodEnd?: Date | null;
      rawResponse: unknown;
    },
  ) {
    const lookup: Prisma.SellerSubscriptionPaymentWhereInput[] = [
      ...(payment.providerInvoiceId
        ? [{ provider: PaymentProvider.RAZORPAY, providerInvoiceId: payment.providerInvoiceId }]
        : []),
      ...(payment.providerPaymentId
        ? [{ provider: PaymentProvider.RAZORPAY, providerPaymentId: payment.providerPaymentId }]
        : []),
    ];

    const existing = lookup.length
      ? await tx.sellerSubscriptionPayment.findFirst({ where: { OR: lookup } })
      : null;
    const data = {
      sellerId: subscription.sellerId,
      sellerSubscriptionId: subscription.id,
      provider: PaymentProvider.RAZORPAY,
      providerSubscriptionId:
        payment.providerSubscriptionId ?? subscription.providerSubscriptionId ?? null,
      providerInvoiceId: payment.providerInvoiceId ?? null,
      providerPaymentId: payment.providerPaymentId ?? null,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      billingPeriodStart: payment.billingPeriodStart ?? null,
      billingPeriodEnd: payment.billingPeriodEnd ?? null,
      paidAt: payment.status === PaymentStatus.PAID ? new Date() : null,
      failedAt: payment.status === PaymentStatus.FAILED ? new Date() : null,
      rawResponse: payment.rawResponse as Prisma.InputJsonValue,
    };

    if (existing) {
      await tx.sellerSubscriptionPayment.update({
        where: { id: existing.id },
        data,
      });
      return;
    }

    await tx.sellerSubscriptionPayment.create({ data });
  }

  private subscriptionStateFromWebhook(
    eventType: string,
    subscription: {
      status: SellerSubscriptionStatus;
      currentPeriodEnd?: Date | null;
      authorizedAt?: Date | null;
      paymentFailureCount: number;
      cancelAtPeriodEnd: boolean;
      plan: SellerSubscriptionPlanForBilling;
    },
    subscriptionEntity: Record<string, unknown> | null,
    now: Date,
  ) {
    const providerCurrentEnd =
      this.dateFromUnixRecord(subscriptionEntity, "current_end") ??
      this.dateFromUnixRecord(subscriptionEntity, "charge_at");
    const currentPeriodEnd =
      providerCurrentEnd ??
      (eventType === "subscription.charged" || eventType === "invoice.paid"
        ? this.periodEndFromPlan(subscription.plan, now)
        : subscription.currentPeriodEnd ?? null);
    const providerEnded = currentPeriodEnd ? currentPeriodEnd <= now : true;

    if (["subscription.authenticated", "subscription.charged", "invoice.paid"].includes(eventType)) {
      return {
        handled: true,
        status: SellerSubscriptionStatus.ACTIVE,
        authorizedAt: subscription.authorizedAt ?? now,
        currentPeriodEnd,
        nextBillingAt: currentPeriodEnd,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: null,
        paymentFailureCount: 0,
        message: "Seller recurring subscription is active.",
      };
    }

    if (["payment.failed", "invoice.payment_failed", "subscription.halted"].includes(eventType)) {
      return {
        handled: true,
        status: SellerSubscriptionStatus.PENDING_PAYMENT,
        authorizedAt: subscription.authorizedAt ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd ?? currentPeriodEnd,
        nextBillingAt: subscription.currentPeriodEnd ?? currentPeriodEnd,
        gracePeriodEndsAt: new Date(now.getTime() + sellerSubscriptionGraceDays * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: null,
        paymentFailureCount: subscription.paymentFailureCount + 1,
        message: "Seller recurring subscription payment failed; grace period started.",
      };
    }

    if (["subscription.cancelled", "subscription.completed"].includes(eventType)) {
      return {
        handled: true,
        status: providerEnded ? SellerSubscriptionStatus.CANCELLED : SellerSubscriptionStatus.ACTIVE,
        authorizedAt: subscription.authorizedAt ?? null,
        currentPeriodEnd,
        nextBillingAt: null,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: !providerEnded,
        cancelledAt: providerEnded ? now : null,
        paymentFailureCount: subscription.paymentFailureCount,
        message: providerEnded
          ? "Seller recurring subscription cancelled."
          : "Seller recurring subscription will cancel at period end.",
      };
    }

    return {
      handled: false,
      status: subscription.status,
      authorizedAt: subscription.authorizedAt ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd ?? null,
      nextBillingAt: subscription.currentPeriodEnd ?? null,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: null,
      paymentFailureCount: subscription.paymentFailureCount,
      message: "Razorpay subscription event did not require a state change.",
    };
  }

  private paymentStatusFromWebhook(
    eventType: string,
    paymentEntity: Record<string, unknown> | null,
    invoiceEntity: Record<string, unknown> | null,
  ) {
    const paymentStatus = this.stringFromRecord(paymentEntity, "status");
    const invoiceStatus = this.stringFromRecord(invoiceEntity, "status");

    if (
      eventType === "subscription.charged" ||
      eventType === "invoice.paid" ||
      paymentStatus === "captured" ||
      invoiceStatus === "paid"
    ) {
      return PaymentStatus.PAID;
    }

    if (eventType === "payment.failed" || eventType === "invoice.payment_failed" || paymentStatus === "failed") {
      return PaymentStatus.FAILED;
    }

    return undefined;
  }

  private createPlanData(dto: CreateSellerSubscriptionPlanDto): Prisma.SellerSubscriptionPlanCreateInput {
    return {
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      pricePaise: dto.pricePaise ?? 0,
      currency: dto.currency?.trim().toUpperCase() ?? "INR",
      billingCycle: dto.billingCycle ?? SellerSubscriptionBillingCycle.MONTHLY,
      audience: this.normalizePlanAudience(dto.audience),
      productLimit: dto.productLimit ?? null,
      featuredProductLimit: dto.featuredProductLimit ?? null,
      b2bEnquiryLimit: dto.b2bEnquiryLimit ?? null,
      commissionDiscountBps: dto.commissionDiscountBps ?? 0,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
  }

  private planData(
    dto: SellerPlanWriteDto,
    existing: SellerSubscriptionPlanForBilling,
  ): Prisma.SellerSubscriptionPlanUpdateInput {
    const billingChanged =
      (dto.pricePaise !== undefined && dto.pricePaise !== existing.pricePaise) ||
      (dto.currency !== undefined && dto.currency.trim().toUpperCase() !== existing.currency) ||
      (dto.billingCycle !== undefined && dto.billingCycle !== existing.billingCycle);

    return {
      ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.pricePaise !== undefined ? { pricePaise: dto.pricePaise } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() } : {}),
      ...(dto.billingCycle !== undefined ? { billingCycle: dto.billingCycle } : {}),
      ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
      ...(dto.productLimit !== undefined ? { productLimit: dto.productLimit } : {}),
      ...(dto.featuredProductLimit !== undefined ? { featuredProductLimit: dto.featuredProductLimit } : {}),
      ...(dto.b2bEnquiryLimit !== undefined ? { b2bEnquiryLimit: dto.b2bEnquiryLimit } : {}),
      ...(dto.commissionDiscountBps !== undefined ? { commissionDiscountBps: dto.commissionDiscountBps } : {}),
      ...(billingChanged
        ? {
            providerPlanId: null,
            providerPlanSyncedAt: null,
            providerPlanSnapshot: Prisma.JsonNull,
            providerPlanVersion: { increment: 1 },
          }
        : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
  }

  private assertDefaultAllowed(
    dto: SellerPlanWriteDto,
    existing?: { isDefault: boolean; isActive: boolean; audience?: SellerSubscriptionPlanAudience },
  ) {
    const nextIsDefault = dto.isDefault ?? existing?.isDefault ?? false;
    const nextIsActive = dto.isActive ?? existing?.isActive ?? true;

    if (nextIsDefault && !nextIsActive) {
      throw new BadRequestException("Default seller subscription plan must be active.");
    }

    if (existing?.isDefault && dto.isActive === false && dto.isDefault !== false) {
      throw new BadRequestException("Set another active default plan before disabling the current default.");
    }
  }

  private isRecurringPaidPlan(plan: SellerSubscriptionPlanForBilling) {
    return plan.pricePaise > 0 && recurringBillingCycles.has(plan.billingCycle);
  }

  private periodEndFromPlan(plan: SellerSubscriptionPlanForBilling, from: Date) {
    if (plan.billingCycle === SellerSubscriptionBillingCycle.LIFETIME) {
      return null;
    }

    const end = new Date(from);
    if (plan.billingCycle === SellerSubscriptionBillingCycle.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
      return end;
    }

    end.setMonth(end.getMonth() + 1);
    return end;
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

  private async getRazorpayKeys(requireEnabled = true) {
    const settingMap = await this.paymentSettingMap();
    const enabled = readBooleanSetting(settingMap.get(PAYMENT_SETTING_KEYS.razorpayEnabled), false);
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

    if (requireEnabled && !enabled) {
      throw new ServiceUnavailableException(
        "Razorpay payments must be enabled in admin payment settings before seller recurring billing can be used.",
      );
    }

    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(
        "Razorpay keys are required before seller recurring billing can be used.",
      );
    }

    return { keyId, keySecret };
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

  private stringSetting(settingMap: PaymentSettingMap, key: string, fallback: string) {
    const value = settingMap.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private razorpayHeaders(keyId: string, keySecret: string) {
    return {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    };
  }

  private safeCompare(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }

  private extractRazorpayEntity(payload: Record<string, unknown>, key: string) {
    const rootPayload = payload.payload as Record<string, unknown> | undefined;
    const entityPayload = rootPayload?.[key] as Record<string, unknown> | undefined;
    const entity = entityPayload?.entity as Record<string, unknown> | undefined;

    return entity ?? null;
  }

  private stringFromRecord(record: Record<string, unknown> | null | undefined, key: string) {
    const value = record?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private numberFromRecord(record: Record<string, unknown> | null | undefined, key: string) {
    const value = record?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private dateFromUnixRecord(record: Record<string, unknown> | null | undefined, key: string) {
    const value = this.numberFromRecord(record, key);
    return value && value > 0 ? new Date(value * 1000) : null;
  }

  private auditPlanValue(plan: {
    code: string;
    name: string;
    audience?: SellerSubscriptionPlanAudience;
    pricePaise: number;
    currency: string;
    billingCycle: string;
    isDefault: boolean;
    isActive: boolean;
    productLimit?: number | null;
    b2bEnquiryLimit?: number | null;
    providerPlanId?: string | null;
    providerPlanVersion?: number | null;
  }) {
    return {
      code: plan.code,
      name: plan.name,
      audience: plan.audience ?? SellerSubscriptionPlanAudience.RETAIL,
      pricePaise: plan.pricePaise,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      productLimit: plan.productLimit,
      b2bEnquiryLimit: plan.b2bEnquiryLimit,
      providerPlanId: plan.providerPlanId ?? null,
      providerPlanVersion: plan.providerPlanVersion ?? null,
    };
  }

  private audienceFromCapability(capability: SellerCapability) {
    return capability === SellerCapability.SERVICE
      ? SellerSubscriptionPlanAudience.SERVICE
      : SellerSubscriptionPlanAudience.RETAIL;
  }

  private audienceMatch(audience: SellerSubscriptionPlanAudience) {
    return audience === SellerSubscriptionPlanAudience.ALL
      ? [SellerSubscriptionPlanAudience.ALL]
      : [audience, SellerSubscriptionPlanAudience.ALL];
  }

  private normalizePlanAudience(audience?: SellerSubscriptionPlanAudience) {
    return audience ?? SellerSubscriptionPlanAudience.RETAIL;
  }

  private assertPlanMatchesSellerCapabilities(
    plan: { audience: SellerSubscriptionPlanAudience },
    enabledCapabilities: SellerCapability[],
  ) {
    if (plan.audience === SellerSubscriptionPlanAudience.ALL) {
      return;
    }

    const requiredCapability =
      plan.audience === SellerSubscriptionPlanAudience.SERVICE
        ? SellerCapability.SERVICE
        : SellerCapability.RETAIL;

    if (!enabledCapabilities.includes(requiredCapability)) {
      throw new BadRequestException(
        `Selected plan requires ${plan.audience.toLowerCase()} seller capability.`,
      );
    }
  }
}
