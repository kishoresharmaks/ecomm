import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CartStatus,
  CodCollectionStatus,
  CourierProviderMode,
  DeliveryAssignmentStatus,
  DeliveryMode,
  DeliveryRoutingFailureReason,
  DeliveryStatus,
  Prisma,
  RoleCode,
  ShippingCodSurchargeType,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { CustomersService } from "../customers/customers.service";
import { LocationsService } from "../locations/locations.service";
import { PrismaService } from "../prisma/prisma.service";
import { readNumberSetting } from "../settings/setting-value-utils";
import {
  CheckoutDeliveryPreference,
  CheckoutRoutingAddressDto,
  CheckoutRoutingPaymentMethod,
  ResolveCheckoutDeliveryDto,
  RoutingSimulatorDto,
  UpdateCourierProviderActiveDto,
  UpdateRateCardActiveDto,
  UpsertCourierProviderSettingDto,
  UpsertShippingRateCardDto,
} from "./dto/delivery-routing.dto";

const defaultShippingChargeSettingKey = "shipping.default_charge_paise";
const defaultCodCashLimitSettingKey = "delivery.defaultCodCashLimitPaise";
const defaultCodCashLimitPaise = 500000;

type RoutingClient = Prisma.TransactionClient | PrismaService["client"];

type CourierProviderCredentialsSnapshot = {
  apiKey?: string | null;
  apiSecret?: string | null;
  password?: string | null;
};

type CourierProviderSettingsSnapshot = {
  providerCode?: string | null;
  serviceableCountryCodes?: string[];
  adapterCode?: string | null;
  apiBaseUrl?: string | null;
  bookingEndpointPath?: string | null;
  trackingEndpointPath?: string | null;
  labelEndpointPath?: string | null;
  cancellationEndpointPath?: string | null;
  accountCode?: string | null;
  username?: string | null;
  credentials?: CourierProviderCredentialsSnapshot | null;
  webhookSecret?: string | null;
  liveApiCallsEnabled?: boolean;
  supportedPhase?: string;
};

export type DeliveryRoutingAddress = {
  fullName?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  localAreaCode?: string | null;
};

export type ResolveDeliveryRoutingInput = {
  deliveryPreference?: CheckoutDeliveryPreference | undefined;
  requestedDeliveryMode?: DeliveryMode | undefined;
  address?: DeliveryRoutingAddress | null | undefined;
  subtotalPaise: number;
  paymentMethod?: string | null | undefined;
  orderId?: string | undefined;
};

export type DeliveryRoutingQuote = {
  deliveryPreference: CheckoutDeliveryPreference;
  deliveryMode: DeliveryMode;
  recommendedPartnerUserId: string | null;
  recommendedPartnerName: string | null;
  partnerMatchLabel: string | null;
  partnerSpecificityScore: number;
  courierProviderCode: string | null;
  matchedRateCardId: string | null;
  matchedRateCardName: string | null;
  rateCardSpecificityScore: number;
  shippingChargePaise: number;
  codSurchargePaise: number;
  totalDeliveryChargePaise: number;
  freeShippingApplied: boolean;
  routingFailed: boolean;
  routingFailureReason: DeliveryRoutingFailureReason | null;
  routingFailureNote: string | null;
  fallbackReason: string | null;
  warnings: string[];
  diagnostics: {
    localPartnersChecked: number;
    localEligiblePartners: number;
    rejectedPartnersSkipped: number;
    codLimitSkipped: number;
    rateCardsChecked: number;
    providerChecked: string | null;
  };
  shippingSnapshot: Prisma.InputJsonObject;
  codSurchargeSnapshot: Prisma.InputJsonObject;
  routingSnapshot: Prisma.InputJsonObject;
};

type PartnerCandidateUser = Prisma.UserGetPayload<{
  include: {
    deliveryProfile: {
      include: {
        serviceAreas: true;
      };
    };
  };
}>;

type PartnerCandidate = {
  user: PartnerCandidateUser;
  matchLabel: string;
  specificityScore: number;
  priority: number;
  workload: number;
  codExposurePaise: number;
  codLimitPaise: number;
  lastAssignmentAt: Date | null;
};

type PartnerSelection = {
  candidate: PartnerCandidate | null;
  diagnostics: {
    partnersChecked: number;
    eligiblePartners: number;
    rejectedPartnersSkipped: number;
    codLimitSkipped: number;
  };
};

type RateCardMatch = {
  card: Prisma.ShippingRateCardGetPayload<Record<string, never>>;
  specificityScore: number;
  configuredLocationCount: number;
};

type LocationMatch = {
  specificityScore: number;
  matchLabel: string;
  priority: number;
};

@Injectable()
export class DeliveryRoutingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomersService) private readonly customersService: CustomersService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
  ) {}

  async resolveCustomerCheckoutDelivery(actor: RequestUser, dto: ResolveCheckoutDeliveryDto) {
    const customer = await this.customersService.ensureCustomerForUser(actor);
    const cart = await this.prisma.client.cart.findFirst({
      where: {
        customerId: customer.id,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: true,
      },
    });

    if (!cart?.items.length) {
      throw new BadRequestException("Cart is empty.");
    }

    const subtotalPaise = cart.items.reduce(
      (total, item) => total + item.quantity * item.unitPricePaise,
      0,
    );
    const address = await this.resolveCustomerAddress(customer.id, {
      deliveryPreference: dto.deliveryPreference,
      ...(dto.addressId !== undefined ? { addressId: dto.addressId } : {}),
      ...(dto.shippingAddress !== undefined ? { shippingAddress: dto.shippingAddress } : {}),
    });

    return this.resolveDelivery(
      {
        deliveryPreference: dto.deliveryPreference,
        address,
        subtotalPaise,
        paymentMethod: dto.paymentMethod ?? CheckoutRoutingPaymentMethod.COD,
      },
      this.prisma.client,
    );
  }

  async resolveDelivery(
    input: ResolveDeliveryRoutingInput,
    client: RoutingClient = this.prisma.client,
  ): Promise<DeliveryRoutingQuote> {
    const normalizedSubtotal = this.nonNegativeInt(input.subtotalPaise);
    const address = this.normalizeAddress(input.address);
    const forcedMode =
      input.requestedDeliveryMode && !input.deliveryPreference ? input.requestedDeliveryMode : null;
    const deliveryPreference =
      input.deliveryPreference ??
      (forcedMode === DeliveryMode.STORE_PICKUP
        ? CheckoutDeliveryPreference.STORE_PICKUP
        : CheckoutDeliveryPreference.DELIVER_TO_ADDRESS);

    if (
      deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP ||
      forcedMode === DeliveryMode.STORE_PICKUP
    ) {
      return this.quoteForMode({
        deliveryPreference: CheckoutDeliveryPreference.STORE_PICKUP,
        deliveryMode: DeliveryMode.STORE_PICKUP,
        address,
        subtotalPaise: normalizedSubtotal,
        paymentMethod: input.paymentMethod,
        client,
        partnerSelection: null,
        providerCode: null,
        routingFailed: false,
        routingFailureReason: null,
        routingFailureNote: null,
        fallbackReason: null,
        warnings: [],
        providerChecked: null,
      });
    }

    if (forcedMode === DeliveryMode.THIRD_PARTY_COURIER) {
      const provider = await this.findActiveProviderForCountry(address?.countryCode, client);
      return this.quoteForMode({
        deliveryPreference,
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        address,
        subtotalPaise: normalizedSubtotal,
        paymentMethod: input.paymentMethod,
        client,
        partnerSelection: null,
        providerCode: provider?.providerCode ?? null,
        routingFailed: false,
        routingFailureReason: null,
        routingFailureNote: null,
        fallbackReason: null,
        warnings: provider ? [] : ["No active courier provider matched this address yet."],
        providerChecked: provider?.providerCode ?? null,
      });
    }

    const partnerSelection = await this.chooseBestLocalPartner(
      {
        address,
        subtotalPaise: normalizedSubtotal,
        paymentMethod: input.paymentMethod,
        orderId: input.orderId,
      },
      client,
    );

    const localRateMatch = partnerSelection.candidate
      ? null
      : await this.matchRateCard(
          DeliveryMode.LOCAL_DELIVERY_PARTNER,
          address,
          normalizedSubtotal,
          client,
        );

    if (
      forcedMode === DeliveryMode.LOCAL_DELIVERY_PARTNER ||
      partnerSelection.candidate ||
      localRateMatch
    ) {
      const warnings = partnerSelection.candidate
        ? []
        : [
            "No eligible local partner is currently available; order will stay in local delivery operations queue.",
          ];
      return this.quoteForMode({
        deliveryPreference,
        deliveryMode: DeliveryMode.LOCAL_DELIVERY_PARTNER,
        address,
        subtotalPaise: normalizedSubtotal,
        paymentMethod: input.paymentMethod,
        client,
        partnerSelection,
        providerCode: null,
        routingFailed: false,
        routingFailureReason: null,
        routingFailureNote: null,
        fallbackReason: partnerSelection.candidate
          ? null
          : localRateMatch
            ? "Matched a local delivery shipping rate card for this address."
            : "Legacy local delivery mode requested.",
        warnings,
        providerChecked: null,
      });
    }

    const provider = await this.findActiveProviderForCountry(address?.countryCode, client);
    if (provider) {
      return this.quoteForMode({
        deliveryPreference,
        deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
        address,
        subtotalPaise: normalizedSubtotal,
        paymentMethod: input.paymentMethod,
        client,
        partnerSelection,
        providerCode: provider.providerCode,
        routingFailed: false,
        routingFailureReason: null,
        routingFailureNote: null,
        fallbackReason: "No eligible local partner matched; routed to courier fallback.",
        warnings: [],
        providerChecked: provider.providerCode,
      });
    }

    const failureReason = (await this.anyActiveCourierProvider(client))
      ? DeliveryRoutingFailureReason.COURIER_COUNTRY_UNSERVICEABLE
      : DeliveryRoutingFailureReason.COURIER_PROVIDER_INACTIVE;
    const failureNote =
      failureReason === DeliveryRoutingFailureReason.COURIER_COUNTRY_UNSERVICEABLE
        ? "No local partner matched and no active courier provider serves this country."
        : "No local partner matched and courier fallback is not active.";

    return this.quoteForMode({
      deliveryPreference,
      deliveryMode: DeliveryMode.THIRD_PARTY_COURIER,
      address,
      subtotalPaise: normalizedSubtotal,
      paymentMethod: input.paymentMethod,
      client,
      partnerSelection,
      providerCode: null,
      routingFailed: true,
      routingFailureReason: failureReason,
      routingFailureNote: failureNote,
      fallbackReason: "No local partner matched.",
      warnings: [failureNote],
      providerChecked: null,
    });
  }

  async listRateCards() {
    const items = await this.prisma.client.shippingRateCard.findMany({
      orderBy: [{ deliveryMode: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    });

    return { items };
  }

  async createRateCard(actor: RequestUser, dto: UpsertShippingRateCardDto) {
    const data = this.rateCardData(dto);
    await this.ensureNoDuplicateActiveRateCard(data);
    const card = await this.prisma.client.shippingRateCard.create({ data });
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "shipping.rate_card.created",
        entityType: "shipping_rate_card",
        entityId: card.id,
        newValue: this.rateCardAuditValue(card),
      },
    });

    return {
      item: card,
      warnings: await this.rateCardOverlapWarnings(card),
    };
  }

  async updateRateCard(actor: RequestUser, rateCardId: string, dto: UpsertShippingRateCardDto) {
    const existing = await this.prisma.client.shippingRateCard.findUnique({
      where: { id: rateCardId },
    });
    if (!existing) {
      throw new NotFoundException("Shipping rate card not found.");
    }

    const data = this.rateCardData(dto);
    await this.ensureNoDuplicateActiveRateCard(data, rateCardId);
    const card = await this.prisma.client.shippingRateCard.update({
      where: { id: rateCardId },
      data,
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "shipping.rate_card.updated",
        entityType: "shipping_rate_card",
        entityId: card.id,
        oldValue: this.rateCardAuditValue(existing),
        newValue: this.rateCardAuditValue(card),
      },
    });

    return {
      item: card,
      warnings: await this.rateCardOverlapWarnings(card),
    };
  }

  async updateRateCardActive(actor: RequestUser, rateCardId: string, dto: UpdateRateCardActiveDto) {
    const existing = await this.prisma.client.shippingRateCard.findUnique({
      where: { id: rateCardId },
    });
    if (!existing) {
      throw new NotFoundException("Shipping rate card not found.");
    }

    if (dto.isActive) {
      await this.ensureNoDuplicateActiveRateCard(
        this.rateCardDataFromRecord(existing, { isActive: true }),
        rateCardId,
      );
    }

    const card = await this.prisma.client.shippingRateCard.update({
      where: { id: rateCardId },
      data: { isActive: dto.isActive },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: dto.isActive ? "shipping.rate_card.activated" : "shipping.rate_card.deactivated",
        entityType: "shipping_rate_card",
        entityId: card.id,
        oldValue: this.rateCardAuditValue(existing),
        newValue: this.rateCardAuditValue(card),
      },
    });

    return card;
  }

  async deleteRateCard(actor: RequestUser, rateCardId: string) {
    const existing = await this.prisma.client.shippingRateCard.findUnique({
      where: { id: rateCardId },
    });
    if (!existing) {
      throw new NotFoundException("Shipping rate card not found.");
    }

    const card = await this.prisma.client.shippingRateCard.delete({
      where: { id: rateCardId },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "shipping.rate_card.deleted",
        entityType: "shipping_rate_card",
        entityId: card.id,
        oldValue: this.rateCardAuditValue(existing),
      },
    });

    return { item: card, deleted: true };
  }

  async listCourierProviders() {
    const items = await this.prisma.client.courierProviderSetting.findMany({
      orderBy: [{ providerCode: "asc" }],
    });
    return { items: items.map((item) => this.courierProviderReadback(item)) };
  }

  async upsertCourierProvider(actor: RequestUser, dto: UpsertCourierProviderSettingDto) {
    const providerCode = this.normalizeProviderCode(dto.providerCode);
    const existing = await this.prisma.client.courierProviderSetting.findUnique({
      where: { providerCode },
    });
    const data = this.courierProviderData(dto, existing);
    const provider = await this.prisma.client.courierProviderSetting.upsert({
      where: { providerCode },
      update: data,
      create: {
        providerCode,
        ...data,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: existing ? "courier.provider.updated" : "courier.provider.created",
        entityType: "courier_provider",
        entityId: provider.id,
        ...(existing ? { oldValue: this.courierProviderAuditValue(existing) } : {}),
        newValue: this.courierProviderAuditValue(provider),
      },
    });

    return this.courierProviderReadback(provider);
  }

  async updateCourierProviderActive(
    actor: RequestUser,
    providerCode: string,
    dto: UpdateCourierProviderActiveDto,
  ) {
    const normalized = this.normalizeProviderCode(providerCode);
    const existing = await this.prisma.client.courierProviderSetting.findUnique({
      where: { providerCode: normalized },
    });
    if (!existing) {
      throw new NotFoundException("Courier provider not found.");
    }

    const provider = await this.prisma.client.courierProviderSetting.update({
      where: { providerCode: normalized },
      data: { isActive: dto.isActive },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: dto.isActive ? "courier.provider.activated" : "courier.provider.deactivated",
        entityType: "courier_provider",
        entityId: provider.id,
        oldValue: this.courierProviderAuditValue(existing),
        newValue: this.courierProviderAuditValue(provider),
      },
    });

    return this.courierProviderReadback(provider);
  }

  async simulateRouting(dto: RoutingSimulatorDto) {
    const address = dto.shippingAddress
      ? await this.createAddressSnapshot(dto.shippingAddress)
      : null;

    return this.resolveDelivery({
      deliveryPreference: dto.deliveryPreference,
      address,
      subtotalPaise: dto.subtotalPaise ?? 0,
      paymentMethod: dto.paymentMethod ?? CheckoutRoutingPaymentMethod.COD,
    });
  }

  private async quoteForMode(input: {
    deliveryPreference: CheckoutDeliveryPreference;
    deliveryMode: DeliveryMode;
    address: DeliveryRoutingAddress | null;
    subtotalPaise: number;
    paymentMethod?: string | null | undefined;
    client: RoutingClient;
    partnerSelection: PartnerSelection | null;
    providerCode: string | null;
    routingFailed: boolean;
    routingFailureReason: DeliveryRoutingFailureReason | null;
    routingFailureNote: string | null;
    fallbackReason: string | null;
    warnings: string[];
    providerChecked: string | null;
  }): Promise<DeliveryRoutingQuote> {
    const rateMatch =
      input.deliveryMode === DeliveryMode.STORE_PICKUP
        ? null
        : await this.matchRateCard(
            input.deliveryMode,
            input.address,
            input.subtotalPaise,
            input.client,
          );
    const defaultShippingPaise = await this.defaultShippingChargePaise(input.client);
    const baseShippingPaise =
      input.deliveryMode === DeliveryMode.STORE_PICKUP
        ? 0
        : (rateMatch?.card.shippingChargePaise ?? defaultShippingPaise);
    const freeShippingApplied =
      Boolean(
        rateMatch?.card.freeAbovePaise !== null && rateMatch?.card.freeAbovePaise !== undefined,
      ) && input.subtotalPaise >= (rateMatch?.card.freeAbovePaise ?? 0);
    const shippingChargePaise =
      input.deliveryMode === DeliveryMode.STORE_PICKUP || freeShippingApplied
        ? 0
        : this.nonNegativeInt(baseShippingPaise);
    const codSurchargePaise =
      input.paymentMethod === CheckoutRoutingPaymentMethod.COD && rateMatch
        ? this.calculateCodSurcharge(input.subtotalPaise, rateMatch.card)
        : 0;
    const partner = input.partnerSelection?.candidate ?? null;
    const warnings = [...input.warnings];

    if (!rateMatch && input.deliveryMode !== DeliveryMode.STORE_PICKUP) {
      warnings.push("No active shipping rate card matched; fallback shipping setting was used.");
    }

    const shippingSnapshot: Prisma.InputJsonObject = {
      source: rateMatch ? "RATE_CARD" : "SETTING_FALLBACK",
      rateCardId: rateMatch?.card.id ?? null,
      rateCardName: rateMatch?.card.name ?? null,
      specificityScore: rateMatch?.specificityScore ?? 0,
      chargePaise: shippingChargePaise,
      baseChargePaise: baseShippingPaise,
      freeAbovePaise: rateMatch?.card.freeAbovePaise ?? null,
      freeShippingApplied,
      fallbackSettingKey: rateMatch ? null : defaultShippingChargeSettingKey,
    };
    const codSurchargeSnapshot: Prisma.InputJsonObject = {
      source: rateMatch ? "RATE_CARD" : "NONE",
      rateCardId: rateMatch?.card.id ?? null,
      type: rateMatch?.card.codSurchargeType ?? ShippingCodSurchargeType.NONE,
      flatPaise: rateMatch?.card.codSurchargeFlatPaise ?? 0,
      valueBps: rateMatch?.card.codSurchargeBps ?? 0,
      amountPaise: codSurchargePaise,
      paymentMethod: input.paymentMethod ?? null,
    };
    const routingSnapshot: Prisma.InputJsonObject = {
      deliveryPreference: input.deliveryPreference,
      deliveryMode: input.deliveryMode,
      recommendedPartnerUserId: partner?.user.id ?? null,
      recommendedPartnerName: partner ? this.partnerName(partner.user) : null,
      partnerMatchLabel: partner?.matchLabel ?? null,
      partnerSpecificityScore: partner?.specificityScore ?? 0,
      courierProviderCode: input.providerCode,
      routingFailed: input.routingFailed,
      routingFailureReason: input.routingFailureReason,
      routingFailureNote: input.routingFailureNote,
      fallbackReason: input.fallbackReason,
      warnings,
      resolvedAt: new Date().toISOString(),
    };

    return {
      deliveryPreference: input.deliveryPreference,
      deliveryMode: input.deliveryMode,
      recommendedPartnerUserId: partner?.user.id ?? null,
      recommendedPartnerName: partner ? this.partnerName(partner.user) : null,
      partnerMatchLabel: partner?.matchLabel ?? null,
      partnerSpecificityScore: partner?.specificityScore ?? 0,
      courierProviderCode: input.providerCode,
      matchedRateCardId: rateMatch?.card.id ?? null,
      matchedRateCardName: rateMatch?.card.name ?? null,
      rateCardSpecificityScore: rateMatch?.specificityScore ?? 0,
      shippingChargePaise,
      codSurchargePaise,
      totalDeliveryChargePaise: shippingChargePaise + codSurchargePaise,
      freeShippingApplied,
      routingFailed: input.routingFailed,
      routingFailureReason: input.routingFailureReason,
      routingFailureNote: input.routingFailureNote,
      fallbackReason: input.fallbackReason,
      warnings,
      diagnostics: {
        localPartnersChecked: input.partnerSelection?.diagnostics.partnersChecked ?? 0,
        localEligiblePartners: input.partnerSelection?.diagnostics.eligiblePartners ?? 0,
        rejectedPartnersSkipped: input.partnerSelection?.diagnostics.rejectedPartnersSkipped ?? 0,
        codLimitSkipped: input.partnerSelection?.diagnostics.codLimitSkipped ?? 0,
        rateCardsChecked: rateMatch ? 1 : 0,
        providerChecked: input.providerChecked,
      },
      shippingSnapshot,
      codSurchargeSnapshot,
      routingSnapshot,
    };
  }

  private async chooseBestLocalPartner(
    input: {
      address: DeliveryRoutingAddress | null;
      subtotalPaise: number;
      paymentMethod?: string | null | undefined;
      orderId?: string | undefined;
    },
    client: RoutingClient,
  ): Promise<PartnerSelection> {
    const rejectedPartnerIds = input.orderId
      ? await this.rejectedPartnerIds(input.orderId, client)
      : new Set<string>();
    const partners = await client.user.findMany({
      where: this.partnerCandidateWhere(input.address, rejectedPartnerIds),
      include: {
        deliveryProfile: {
          include: {
            serviceAreas: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });
    const metrics = await this.partnerMetrics(
      partners.map((partner) => partner.id),
      client,
    );
    const defaultCodLimit = await this.defaultPartnerCodLimitPaise(client);
    const codAmountPaise =
      input.paymentMethod === CheckoutRoutingPaymentMethod.COD ? input.subtotalPaise : 0;
    let codLimitSkipped = 0;

    const candidates = partners
      .map((user) => {
        if (!user.deliveryProfile) {
          return null;
        }
        const area = this.bestPartnerServiceAreaMatch(user, input.address);
        if (!area) {
          return null;
        }
        const codExposurePaise = metrics.codExposurePaise.get(user.id) ?? 0;
        const codLimitPaise = user.deliveryProfile.codCashLimitPaise ?? defaultCodLimit;
        if (codAmountPaise > 0 && codExposurePaise + codAmountPaise > codLimitPaise) {
          codLimitSkipped += 1;
          return null;
        }

        return {
          user,
          matchLabel: area.matchLabel,
          specificityScore: area.specificityScore,
          priority: area.priority,
          workload: metrics.workload.get(user.id) ?? 0,
          codExposurePaise,
          codLimitPaise,
          lastAssignmentAt: metrics.lastAssignmentAt.get(user.id) ?? null,
        } satisfies PartnerCandidate;
      })
      .filter((candidate): candidate is PartnerCandidate => Boolean(candidate));

    const candidate =
      candidates.sort((left, right) => {
        if (right.specificityScore !== left.specificityScore) {
          return right.specificityScore - left.specificityScore;
        }
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        if (left.workload !== right.workload) {
          return left.workload - right.workload;
        }
        if (left.codExposurePaise !== right.codExposurePaise) {
          return left.codExposurePaise - right.codExposurePaise;
        }
        const leftLast = left.lastAssignmentAt?.getTime() ?? 0;
        const rightLast = right.lastAssignmentAt?.getTime() ?? 0;
        if (leftLast !== rightLast) {
          return leftLast - rightLast;
        }
        return left.user.createdAt.getTime() - right.user.createdAt.getTime();
      })[0] ?? null;

    return {
      candidate,
      diagnostics: {
        partnersChecked: partners.length,
        eligiblePartners: candidates.length,
        rejectedPartnersSkipped: rejectedPartnerIds.size,
        codLimitSkipped,
      },
    };
  }

  private partnerCandidateWhere(
    address: DeliveryRoutingAddress | null,
    rejectedPartnerIds: Set<string>,
  ): Prisma.UserWhereInput {
    const legacyAreaOr: Prisma.DeliveryPartnerProfileWhereInput[] = [];
    if (address?.localAreaCode) {
      legacyAreaOr.push({ serviceLocalAreaCodes: { has: address.localAreaCode } });
    }
    if (address?.pincode) {
      legacyAreaOr.push({ servicePincodes: { has: address.pincode } });
    }
    if (address?.cityCode) {
      legacyAreaOr.push({ serviceCityCode: address.cityCode });
    }
    if (address?.stateCode) {
      legacyAreaOr.push({ serviceStateCode: address.stateCode });
    }
    if (address?.countryCode) {
      legacyAreaOr.push({ serviceCountryCode: address.countryCode });
    }
    legacyAreaOr.push({
      serviceCityCode: null,
      servicePincodes: { isEmpty: true },
      serviceLocalAreaCodes: { isEmpty: true },
    });

    return {
      ...(rejectedPartnerIds.size > 0 ? { id: { notIn: Array.from(rejectedPartnerIds) } } : {}),
      status: UserStatus.ACTIVE,
      userRoles: {
        some: {
          role: {
            code: RoleCode.DELIVERY_PARTNER,
          },
        },
      },
      deliveryProfile: {
        is: {
          isAvailable: true,
          OR: [{ serviceAreas: { some: this.serviceAreaWhere(address) } }, { OR: legacyAreaOr }],
        },
      },
    };
  }

  private serviceAreaWhere(
    address: DeliveryRoutingAddress | null,
  ): Prisma.DeliveryPartnerServiceAreaWhereInput {
    return {
      isActive: true,
      AND: [
        {
          OR: [
            { countryCode: null },
            ...(address?.countryCode ? [{ countryCode: address.countryCode }] : []),
          ],
        },
        {
          OR: [
            { stateCode: null },
            ...(address?.stateCode ? [{ stateCode: address.stateCode }] : []),
          ],
        },
        {
          OR: [{ cityCode: null }, ...(address?.cityCode ? [{ cityCode: address.cityCode }] : [])],
        },
        { OR: [{ pincode: null }, ...(address?.pincode ? [{ pincode: address.pincode }] : [])] },
        {
          OR: [
            { localAreaCode: null },
            ...(address?.localAreaCode ? [{ localAreaCode: address.localAreaCode }] : []),
          ],
        },
      ],
    };
  }

  private bestPartnerServiceAreaMatch(
    user: PartnerCandidateUser,
    address: DeliveryRoutingAddress | null,
  ) {
    const profile = user.deliveryProfile;
    if (!profile) {
      return null;
    }

    const matches = [
      ...profile.serviceAreas
        .map((area) => this.matchLocationScope(area, address, area.priority))
        .filter((match): match is LocationMatch => Boolean(match)),
      this.matchLocationScope(
        {
          countryCode: profile.serviceCountryCode,
          stateCode: profile.serviceStateCode,
          cityCode: profile.serviceCityCode,
          pincode: null,
          localAreaCode: null,
        },
        address,
        profile.priority,
      ),
      ...profile.servicePincodes.map((pincode) =>
        this.matchLocationScope(
          {
            countryCode: profile.serviceCountryCode,
            stateCode: profile.serviceStateCode,
            cityCode: profile.serviceCityCode,
            pincode,
            localAreaCode: null,
          },
          address,
          profile.priority,
        ),
      ),
      ...profile.serviceLocalAreaCodes.map((localAreaCode) =>
        this.matchLocationScope(
          {
            countryCode: profile.serviceCountryCode,
            stateCode: profile.serviceStateCode,
            cityCode: profile.serviceCityCode,
            pincode: null,
            localAreaCode,
          },
          address,
          profile.priority,
        ),
      ),
    ].filter((match): match is LocationMatch => Boolean(match));

    return (
      matches.sort((left, right) => {
        if (right.specificityScore !== left.specificityScore) {
          return right.specificityScore - left.specificityScore;
        }
        return left.priority - right.priority;
      })[0] ?? null
    );
  }

  private matchLocationScope(
    scope: {
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      pincode?: string | null;
      localAreaCode?: string | null;
    },
    address: DeliveryRoutingAddress | null,
    priority: number,
  ) {
    if (scope.pincode) {
      if (!this.scopeFieldMatches(scope.pincode, address?.pincode)) {
        return null;
      }
      if (this.scopeFieldConflicts(scope.countryCode, address?.countryCode)) {
        return null;
      }
      if (!this.scopeFieldMatches(scope.localAreaCode, address?.localAreaCode)) {
        return null;
      }

      const specificityScore = this.locationSpecificityScore(scope);
      return {
        specificityScore,
        matchLabel: this.locationMatchLabel(scope, specificityScore),
        priority,
      };
    }

    if (!this.scopeFieldMatches(scope.countryCode, address?.countryCode)) {
      return null;
    }
    if (!this.scopeFieldMatches(scope.stateCode, address?.stateCode)) {
      return null;
    }
    if (!this.scopeFieldMatches(scope.cityCode, address?.cityCode)) {
      return null;
    }
    if (!this.scopeFieldMatches(scope.pincode, address?.pincode)) {
      return null;
    }
    if (!this.scopeFieldMatches(scope.localAreaCode, address?.localAreaCode)) {
      return null;
    }

    const specificityScore = this.locationSpecificityScore(scope);
    return {
      specificityScore,
      matchLabel: this.locationMatchLabel(scope, specificityScore),
      priority,
    };
  }

  private async partnerMetrics(partnerIds: string[], client: RoutingClient) {
    const workload = new Map<string, number>();
    const codExposurePaise = new Map<string, number>();
    const lastAssignmentAt = new Map<string, Date>();
    if (partnerIds.length === 0) {
      return { workload, codExposurePaise, lastAssignmentAt };
    }

    const workloadRows = await client.orderShipment.groupBy({
      by: ["deliveryPartnerUserId"],
      where: {
        deliveryPartnerUserId: { in: partnerIds },
        assignmentStatus: {
          in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED],
        },
        status: {
          notIn: [DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED],
        },
      },
      _count: { id: true },
    });
    const codCollectedByRows = await client.deliveryDetail.groupBy({
      by: ["codCollectedById"],
      where: {
        codCollectedById: { in: partnerIds },
        codCollectionStatus: CodCollectionStatus.COLLECTED,
      },
      _sum: { codCollectedAmountPaise: true },
    });
    const codAssignedRows = await client.deliveryDetail.groupBy({
      by: ["deliveryPartnerUserId"],
      where: {
        deliveryPartnerUserId: { in: partnerIds },
        codCollectedById: null,
        codCollectionStatus: CodCollectionStatus.COLLECTED,
      },
      _sum: { codCollectedAmountPaise: true },
    });
    const lastAssignmentRows = await client.deliveryAssignmentAttempt.groupBy({
      by: ["partnerUserId"],
      where: {
        partnerUserId: { in: partnerIds },
        status: {
          in: [DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.ACCEPTED],
        },
      },
      _max: { createdAt: true },
    });

    workloadRows.forEach((row) => {
      if (row.deliveryPartnerUserId) {
        workload.set(row.deliveryPartnerUserId, row._count.id);
      }
    });
    codCollectedByRows.forEach((row) => {
      if (row.codCollectedById) {
        codExposurePaise.set(
          row.codCollectedById,
          (codExposurePaise.get(row.codCollectedById) ?? 0) +
            (row._sum.codCollectedAmountPaise ?? 0),
        );
      }
    });
    codAssignedRows.forEach((row) => {
      if (row.deliveryPartnerUserId) {
        codExposurePaise.set(
          row.deliveryPartnerUserId,
          (codExposurePaise.get(row.deliveryPartnerUserId) ?? 0) +
            (row._sum.codCollectedAmountPaise ?? 0),
        );
      }
    });
    lastAssignmentRows.forEach((row) => {
      if (row._max.createdAt) {
        lastAssignmentAt.set(row.partnerUserId, row._max.createdAt);
      }
    });

    return { workload, codExposurePaise, lastAssignmentAt };
  }

  private async rejectedPartnerIds(orderId: string, client: RoutingClient) {
    const attempts = await client.deliveryAssignmentAttempt.findMany({
      where: {
        orderId,
        status: DeliveryAssignmentStatus.REJECTED,
      },
      select: { partnerUserId: true },
      distinct: ["partnerUserId"],
    });

    return new Set(attempts.map((attempt) => attempt.partnerUserId));
  }

  private async matchRateCard(
    deliveryMode: DeliveryMode,
    address: DeliveryRoutingAddress | null,
    subtotalPaise: number,
    client: RoutingClient,
  ) {
    const cards = await client.shippingRateCard.findMany({
      where: {
        deliveryMode,
        isActive: true,
        AND: [
          { OR: [{ minSubtotalPaise: null }, { minSubtotalPaise: { lte: subtotalPaise } }] },
          { OR: [{ maxSubtotalPaise: null }, { maxSubtotalPaise: { gte: subtotalPaise } }] },
          {
            OR: [
              { countryCode: null },
              ...(address?.countryCode ? [{ countryCode: address.countryCode }] : []),
            ],
          },
          { OR: [{ pincode: null }, ...(address?.pincode ? [{ pincode: address.pincode }] : [])] },
          {
            OR: [
              { localAreaCode: null },
              ...(address?.localAreaCode ? [{ localAreaCode: address.localAreaCode }] : []),
            ],
          },
        ],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    const matches = cards
      .map((card) => {
        const match = this.matchLocationScope(card, address, card.priority);
        return match
          ? ({
              card,
              specificityScore: match.specificityScore,
              configuredLocationCount: this.configuredLocationCount(card),
            } satisfies RateCardMatch)
          : null;
      })
      .filter((match): match is RateCardMatch => Boolean(match));

    return (
      matches.sort((left, right) => {
        if (right.specificityScore !== left.specificityScore) {
          return right.specificityScore - left.specificityScore;
        }
        if (right.configuredLocationCount !== left.configuredLocationCount) {
          return right.configuredLocationCount - left.configuredLocationCount;
        }
        if (left.card.priority !== right.card.priority) {
          return left.card.priority - right.card.priority;
        }
        return right.card.createdAt.getTime() - left.card.createdAt.getTime();
      })[0] ?? null
    );
  }

  private async findActiveProviderForCountry(
    countryCode: string | null | undefined,
    client: RoutingClient,
  ) {
    const normalizedCountry = countryCode?.trim().toUpperCase() ?? null;
    if (!normalizedCountry) {
      return null;
    }

    const providers = await client.courierProviderSetting.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ providerCode: "asc" }],
    });

    const serviceableProviders = providers.filter((provider) =>
      provider.serviceableCountryCodes.some(
        (code) => code.trim().toUpperCase() === normalizedCountry,
      ),
    );

    return serviceableProviders[0] ?? null;
  }

  private async anyActiveCourierProvider(client: RoutingClient) {
    const count = await client.courierProviderSetting.count({
      where: { isActive: true },
    });
    return count > 0;
  }

  private async defaultShippingChargePaise(client: RoutingClient) {
    const setting = await client.setting.findUnique({
      where: { key: defaultShippingChargeSettingKey },
    });

    return this.nonNegativeInt(readNumberSetting(setting?.value, 0));
  }

  private async defaultPartnerCodLimitPaise(client: RoutingClient) {
    const setting = await client.setting.findUnique({
      where: { key: defaultCodCashLimitSettingKey },
    });

    return this.nonNegativeInt(readNumberSetting(setting?.value, defaultCodCashLimitPaise));
  }

  private calculateCodSurcharge(
    subtotalPaise: number,
    card: Prisma.ShippingRateCardGetPayload<Record<string, never>>,
  ) {
    if (card.codSurchargeType === ShippingCodSurchargeType.FLAT) {
      return this.nonNegativeInt(card.codSurchargeFlatPaise);
    }
    if (card.codSurchargeType === ShippingCodSurchargeType.PERCENTAGE) {
      return this.nonNegativeInt((subtotalPaise * card.codSurchargeBps) / 10000);
    }

    return 0;
  }

  private async resolveCustomerAddress(
    customerId: string,
    input: {
      deliveryPreference: CheckoutDeliveryPreference;
      addressId?: string | undefined;
      shippingAddress?: CheckoutRoutingAddressDto | undefined;
    },
  ): Promise<DeliveryRoutingAddress | null> {
    if (
      input.deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP &&
      !input.addressId &&
      !input.shippingAddress
    ) {
      return null;
    }

    if (input.addressId) {
      const address = await this.customersService.getAddressForCustomerOrThrow(
        customerId,
        input.addressId,
      );
      return {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
        countryCode: address.countryCode,
        stateCode: address.stateCode,
        cityCode: address.cityCode,
        localAreaCode: address.localAreaCode,
      };
    }

    if (input.shippingAddress) {
      return this.createAddressSnapshot(input.shippingAddress);
    }

    throw new BadRequestException("Delivery address is required.");
  }

  private async createAddressSnapshot(
    address: CheckoutRoutingAddressDto,
  ): Promise<DeliveryRoutingAddress> {
    const location = await this.locationsService.resolveAddressLocation(address);

    return {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      area: location.area,
      city: location.city,
      state: location.state,
      pincode: location.pincode,
      country: location.country,
      countryCode: location.countryCode,
      stateCode: location.stateCode,
      cityCode: location.cityCode,
      localAreaCode: location.localAreaCode,
    };
  }

  private rateCardData(
    dto: UpsertShippingRateCardDto,
  ): Prisma.ShippingRateCardUncheckedCreateInput {
    const minSubtotalPaise = dto.minSubtotalPaise ?? null;
    const maxSubtotalPaise = dto.maxSubtotalPaise ?? null;
    if (
      minSubtotalPaise !== null &&
      maxSubtotalPaise !== null &&
      minSubtotalPaise > maxSubtotalPaise
    ) {
      throw new BadRequestException("Minimum subtotal cannot be greater than maximum subtotal.");
    }

    return {
      name: dto.name.trim(),
      deliveryMode: dto.deliveryMode,
      countryCode: this.normalizeOptionalCode(dto.countryCode),
      stateCode: this.normalizeOptionalCode(dto.stateCode),
      cityCode: this.normalizeOptionalCode(dto.cityCode),
      pincode: this.normalizeOptionalCode(dto.pincode),
      localAreaCode: this.normalizeOptionalCode(dto.localAreaCode),
      minSubtotalPaise,
      maxSubtotalPaise,
      shippingChargePaise: this.nonNegativeInt(dto.shippingChargePaise ?? 0),
      freeAbovePaise: dto.freeAbovePaise ?? null,
      codSurchargeType: dto.codSurchargeType ?? ShippingCodSurchargeType.NONE,
      codSurchargeFlatPaise: this.nonNegativeInt(dto.codSurchargeFlatPaise ?? 0),
      codSurchargeBps: this.nonNegativeInt(dto.codSurchargeBps ?? 0),
      priority: this.nonNegativeInt(dto.priority ?? 100) || 100,
      isActive: dto.isActive ?? true,
      notes: dto.notes?.trim() || null,
    };
  }

  private rateCardDataFromRecord(
    card: Prisma.ShippingRateCardGetPayload<Record<string, never>>,
    overrides: Partial<Pick<Prisma.ShippingRateCardUncheckedCreateInput, "isActive">> = {},
  ): Prisma.ShippingRateCardUncheckedCreateInput {
    return {
      name: card.name,
      deliveryMode: card.deliveryMode,
      countryCode: card.countryCode,
      stateCode: card.stateCode,
      cityCode: card.cityCode,
      pincode: card.pincode,
      localAreaCode: card.localAreaCode,
      minSubtotalPaise: card.minSubtotalPaise,
      maxSubtotalPaise: card.maxSubtotalPaise,
      shippingChargePaise: card.shippingChargePaise,
      freeAbovePaise: card.freeAbovePaise,
      codSurchargeType: card.codSurchargeType,
      codSurchargeFlatPaise: card.codSurchargeFlatPaise,
      codSurchargeBps: card.codSurchargeBps,
      priority: card.priority,
      isActive: overrides.isActive ?? card.isActive,
      notes: card.notes,
    };
  }

  private courierProviderData(
    dto: UpsertCourierProviderSettingDto,
    existing?: Prisma.CourierProviderSettingGetPayload<Record<string, never>> | null,
  ): Omit<Prisma.CourierProviderSettingUncheckedCreateInput, "providerCode"> {
    const providerCode = this.normalizeProviderCode(dto.providerCode);
    const currentSnapshot = this.courierProviderSnapshot(existing?.settingsSnapshot);
    const currentCredentials = currentSnapshot.credentials ?? {};
    const serviceableCountryCodes = dto.serviceableCountryCodes
      ? this.normalizeCountryCodes(dto.serviceableCountryCodes)
      : (existing?.serviceableCountryCodes ?? []);
    const mode = dto.mode ?? existing?.mode ?? CourierProviderMode.MANUAL;
    const adapterCode = this.optionalSnapshotText(dto.adapterCode, currentSnapshot.adapterCode);
    const apiBaseUrl = this.optionalSnapshotText(dto.apiBaseUrl, currentSnapshot.apiBaseUrl);
    const bookingEndpointPath = this.optionalSnapshotText(
      dto.bookingEndpointPath,
      currentSnapshot.bookingEndpointPath,
    );
    const trackingEndpointPath = this.optionalSnapshotText(
      dto.trackingEndpointPath,
      currentSnapshot.trackingEndpointPath,
    );
    const labelEndpointPath = this.optionalSnapshotText(
      dto.labelEndpointPath,
      currentSnapshot.labelEndpointPath,
    );
    const cancellationEndpointPath = this.optionalSnapshotText(
      dto.cancellationEndpointPath,
      currentSnapshot.cancellationEndpointPath,
    );
    const accountCode = this.optionalSnapshotText(dto.accountCode, currentSnapshot.accountCode);
    const username = this.optionalSnapshotText(dto.username, currentSnapshot.username);
    const apiKey = this.secretSnapshotText(dto.apiKey, currentCredentials.apiKey);
    const apiSecret = this.secretSnapshotText(dto.apiSecret, currentCredentials.apiSecret);
    const password = this.secretSnapshotText(dto.password, currentCredentials.password);
    const webhookSecret = this.secretSnapshotText(dto.webhookSecret, currentSnapshot.webhookSecret);
    const credentialsConfigured =
      (dto.credentialsConfigured ?? existing?.credentialsConfigured ?? false) ||
      Boolean(apiKey || apiSecret || password || accountCode || username);
    const webhookSecretConfigured =
      (dto.webhookSecretConfigured ?? existing?.webhookSecretConfigured ?? false) ||
      Boolean(webhookSecret);
    const settingsSnapshot: CourierProviderSettingsSnapshot = {
      providerCode,
      serviceableCountryCodes,
      adapterCode,
      apiBaseUrl,
      bookingEndpointPath,
      trackingEndpointPath,
      labelEndpointPath,
      cancellationEndpointPath,
      accountCode,
      username,
      credentials: {
        apiKey,
        apiSecret,
        password,
      },
      webhookSecret,
      liveApiCallsEnabled: mode === CourierProviderMode.LIVE && credentialsConfigured,
      supportedPhase: "provider_adapter_ready",
    };

    return {
      displayName: dto.displayName.trim(),
      mode,
      isActive: dto.isActive ?? existing?.isActive ?? false,
      serviceableCountryCodes,
      credentialsConfigured,
      webhookSecretConfigured,
      settingsSnapshot: settingsSnapshot as Prisma.InputJsonValue,
      notes: dto.notes?.trim() || null,
    };
  }

  private async rateCardOverlapWarnings(
    card: Prisma.ShippingRateCardGetPayload<Record<string, never>>,
  ) {
    if (!card.isActive) {
      return [];
    }

    const overlapping = await this.prisma.client.shippingRateCard.findMany({
      where: {
        id: { not: card.id },
        isActive: true,
        deliveryMode: card.deliveryMode,
      },
    });
    const count = overlapping.filter((other) => this.rateCardsMayOverlap(card, other)).length;

    return count > 0
      ? [
          `${count} active rate card(s) may overlap this rule. Lower priority number wins after specificity.`,
        ]
      : [];
  }

  private async ensureNoDuplicateActiveRateCard(
    data: Prisma.ShippingRateCardUncheckedCreateInput,
    excludeRateCardId?: string,
  ) {
    if (!data.isActive) {
      return;
    }

    const minSubtotalPaise = data.minSubtotalPaise ?? null;
    const maxSubtotalPaise = data.maxSubtotalPaise ?? null;
    const duplicate = await this.prisma.client.shippingRateCard.findFirst({
      where: {
        ...(excludeRateCardId ? { id: { not: excludeRateCardId } } : {}),
        isActive: true,
        deliveryMode: data.deliveryMode,
        countryCode: data.countryCode ?? null,
        stateCode: data.stateCode ?? null,
        cityCode: data.cityCode ?? null,
        pincode: data.pincode ?? null,
        localAreaCode: data.localAreaCode ?? null,
        AND: [
          ...(maxSubtotalPaise === null
            ? []
            : [
                {
                  OR: [{ minSubtotalPaise: null }, { minSubtotalPaise: { lte: maxSubtotalPaise } }],
                },
              ]),
          {
            OR: [{ maxSubtotalPaise: null }, { maxSubtotalPaise: { gte: minSubtotalPaise ?? 0 } }],
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    if (duplicate) {
      throw new BadRequestException(
        `An active rate card already covers this same delivery mode, location, and subtotal range: "${duplicate.name}". Edit or deactivate that rule before adding another.`,
      );
    }
  }

  private rateCardsMayOverlap(
    left: Prisma.ShippingRateCardGetPayload<Record<string, never>>,
    right: Prisma.ShippingRateCardGetPayload<Record<string, never>>,
  ) {
    const sameScope = ["countryCode", "stateCode", "cityCode", "pincode", "localAreaCode"].every(
      (key) => {
        const field = key as "countryCode" | "stateCode" | "cityCode" | "pincode" | "localAreaCode";
        return !left[field] || !right[field] || left[field] === right[field];
      },
    );
    if (!sameScope) {
      return false;
    }

    const leftMin = left.minSubtotalPaise ?? 0;
    const leftMax = left.maxSubtotalPaise ?? Number.MAX_SAFE_INTEGER;
    const rightMin = right.minSubtotalPaise ?? 0;
    const rightMax = right.maxSubtotalPaise ?? Number.MAX_SAFE_INTEGER;

    return leftMin <= rightMax && rightMin <= leftMax;
  }

  private rateCardAuditValue(card: Prisma.ShippingRateCardGetPayload<Record<string, never>>) {
    return {
      id: card.id,
      name: card.name,
      deliveryMode: card.deliveryMode,
      countryCode: card.countryCode,
      stateCode: card.stateCode,
      cityCode: card.cityCode,
      pincode: card.pincode,
      localAreaCode: card.localAreaCode,
      minSubtotalPaise: card.minSubtotalPaise,
      maxSubtotalPaise: card.maxSubtotalPaise,
      shippingChargePaise: card.shippingChargePaise,
      freeAbovePaise: card.freeAbovePaise,
      codSurchargeType: card.codSurchargeType,
      codSurchargeFlatPaise: card.codSurchargeFlatPaise,
      codSurchargeBps: card.codSurchargeBps,
      priority: card.priority,
      isActive: card.isActive,
    };
  }

  private courierProviderAuditValue(
    provider: Prisma.CourierProviderSettingGetPayload<Record<string, never>>,
  ) {
    const snapshot = this.courierProviderSnapshot(provider.settingsSnapshot);
    const credentials = snapshot.credentials ?? {};

    return {
      providerCode: provider.providerCode,
      displayName: provider.displayName,
      mode: provider.mode,
      isActive: provider.isActive,
      serviceableCountryCodes: provider.serviceableCountryCodes,
      credentialsConfigured: provider.credentialsConfigured,
      webhookSecretConfigured: provider.webhookSecretConfigured,
      adapterCode: snapshot.adapterCode ?? null,
      apiBaseUrl: snapshot.apiBaseUrl ?? null,
      bookingEndpointPath: snapshot.bookingEndpointPath ?? null,
      trackingEndpointPath: snapshot.trackingEndpointPath ?? null,
      labelEndpointPath: snapshot.labelEndpointPath ?? null,
      cancellationEndpointPath: snapshot.cancellationEndpointPath ?? null,
      accountCode: snapshot.accountCode ?? null,
      username: snapshot.username ?? null,
      apiKeyConfigured: Boolean(credentials.apiKey),
      apiSecretConfigured: Boolean(credentials.apiSecret),
      passwordConfigured: Boolean(credentials.password),
      liveApiCallsEnabled: Boolean(snapshot.liveApiCallsEnabled),
    };
  }

  private courierProviderReadback(
    provider: Prisma.CourierProviderSettingGetPayload<Record<string, never>>,
  ) {
    return {
      ...this.courierProviderAuditValue(provider),
      id: provider.id,
      notes: provider.notes,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private courierProviderSnapshot(
    value: Prisma.JsonValue | null | undefined,
  ): CourierProviderSettingsSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as CourierProviderSettingsSnapshot;
  }

  private optionalSnapshotText(value: string | undefined, current?: string | null) {
    if (typeof value === "undefined") {
      return current ?? null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private secretSnapshotText(value: string | undefined, current?: string | null) {
    if (typeof value === "undefined") {
      return current ?? null;
    }

    const trimmed = value.trim();
    if (!trimmed || /^\*+$/.test(trimmed)) {
      return current ?? null;
    }

    return trimmed;
  }

  private locationSpecificityScore(scope: {
    countryCode?: string | null;
    stateCode?: string | null;
    cityCode?: string | null;
    pincode?: string | null;
    localAreaCode?: string | null;
  }) {
    if (scope.localAreaCode) {
      return 5;
    }
    if (scope.pincode) {
      return 4;
    }
    if (scope.cityCode) {
      return 2;
    }
    if (scope.stateCode) {
      return 1;
    }
    if (scope.countryCode) {
      return 0;
    }

    return 0;
  }

  private configuredLocationCount(scope: {
    countryCode?: string | null;
    stateCode?: string | null;
    cityCode?: string | null;
    pincode?: string | null;
    localAreaCode?: string | null;
  }) {
    return [
      scope.countryCode,
      scope.stateCode,
      scope.cityCode,
      scope.pincode,
      scope.localAreaCode,
    ].filter(Boolean).length;
  }

  private locationMatchLabel(
    scope: {
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      pincode?: string | null;
      localAreaCode?: string | null;
    },
    specificityScore: number,
  ) {
    if (scope.localAreaCode || specificityScore === 5) {
      return "local area";
    }
    if (scope.pincode || specificityScore === 4) {
      return "pincode";
    }
    if (scope.cityCode || specificityScore === 2) {
      return "city";
    }
    if (scope.stateCode || specificityScore === 1) {
      return "state";
    }
    if (scope.countryCode) {
      return "country";
    }

    return "global fallback";
  }

  private scopeFieldMatches(configured?: string | null, actual?: string | null) {
    if (!configured) {
      return true;
    }

    return Boolean(actual && configured.trim().toUpperCase() === actual.trim().toUpperCase());
  }

  private scopeFieldConflicts(configured?: string | null, actual?: string | null) {
    return Boolean(
      configured && actual && configured.trim().toUpperCase() !== actual.trim().toUpperCase(),
    );
  }

  private partnerName(user: Pick<PartnerCandidateUser, "fullName" | "email" | "phone">) {
    return user.fullName ?? user.email ?? user.phone ?? "Delivery partner";
  }

  private normalizeAddress(address?: DeliveryRoutingAddress | null): DeliveryRoutingAddress | null {
    if (!address) {
      return null;
    }

    return {
      fullName: this.cleanString(address.fullName),
      phone: this.cleanString(address.phone),
      line1: this.cleanString(address.line1),
      line2: this.cleanString(address.line2),
      area: this.cleanString(address.area),
      city: this.cleanString(address.city),
      state: this.cleanString(address.state),
      pincode: this.cleanString(address.pincode),
      country: this.cleanString(address.country),
      countryCode: this.normalizeOptionalCode(address.countryCode),
      stateCode: this.normalizeOptionalCode(address.stateCode),
      cityCode: this.normalizeOptionalCode(address.cityCode),
      localAreaCode: this.normalizeOptionalCode(address.localAreaCode),
    };
  }

  private cleanString(value?: string | null) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private normalizeOptionalCode(value?: string | null) {
    return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
  }

  private normalizeProviderCode(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");
  }

  private normalizeCountryCodes(values: string[]) {
    return Array.from(
      new Set(
        values
          .map((value) => value.trim().toUpperCase())
          .filter((value) => /^[A-Z]{2}$/.test(value)),
      ),
    );
  }

  private nonNegativeInt(value: number) {
    return Math.max(0, Math.round(value));
  }
}
