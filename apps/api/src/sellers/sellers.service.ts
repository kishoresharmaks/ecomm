import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CourierProviderMode,
  DocumentStatus,
  EmailRecipientType,
  ProductStatus,
  ProductReviewStatus,
  Prisma,
  RoleCode,
  SellerCapability,
  SellerStatus,
  SellerType,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { LocationsService } from "../locations/locations.service";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { CourierAdapterRegistry } from "../orders/courier-adapters/courier-adapter.registry";
import type {
  CourierBookingAddress,
  CourierProviderAdapterSnapshot,
} from "../orders/courier-adapters/courier-adapter.types";
import { PrismaService } from "../prisma/prisma.service";
import { SearchIndexService } from "../search/search-index.service";
import { StorefrontService } from "../storefront/storefront.service";
import { createSlug } from "../common/slug";
import {
  normalizeStorageImageReference,
  safeStorageFolderSegment,
} from "../storage/storage-image";
import { CreateSellerOnboardingDto } from "./dto/create-seller-registration.dto";
import { PublicSellerQueryDto } from "./dto/public-seller-query.dto";
import { UpdateMySellerCapabilitiesDto, UpdateSellerProfileDto } from "./dto/seller-profile.dto";
import { RegisterSellerPushTokenDto, RevokeSellerPushTokenDto } from "./dto/seller-push-token.dto";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";

const publicSellerProfileSelect = {
  logoUrl: true,
  bannerUrl: true,
  description: true,
  createdAt: true,
};

const publicSellerAddressSelect = {
  area: true,
  city: true,
  state: true,
  country: true,
  countryCode: true,
  stateCode: true,
  cityCode: true,
  localAreaCode: true,
  pincode: true,
};

const publicSellerSelect = {
  id: true,
  storeName: true,
  slug: true,
  sellerType: true,
  createdAt: true,
  profile: {
    select: publicSellerProfileSelect,
  },
  addresses: {
    select: publicSellerAddressSelect,
  },
} satisfies Prisma.SellerSelect;

const publicSellerLocationMatchRanks = {
  NONE: 0,
  COUNTRY: 1,
  STATE: 2,
  CITY: 3,
  LOCAL_AREA: 4,
} as const;

export type PublicSellerLocationMatchLevel = keyof typeof publicSellerLocationMatchRanks;
type PublicSellerRecord = Prisma.SellerGetPayload<{ select: typeof publicSellerSelect }>;

type PublicReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

const sellerProfileInclude = {
  user: true,
  profile: true,
  payoutProfile: true,
  addresses: true,
  courierProviderSettings: {
    orderBy: { providerCode: "asc" },
  },
  documents: true,
  subscriptionPlan: true,
  subscriptions: {
    where: { isCurrent: true },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SellerInclude;

type SellerProfileRecord = Prisma.SellerGetPayload<{ include: typeof sellerProfileInclude }>;

@Injectable()
export class SellersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions: SellerSubscriptionsService,
    @Inject(CourierAdapterRegistry) private readonly courierAdapters: CourierAdapterRegistry,
    @Optional()
    @Inject(SearchIndexService)
    private readonly searchIndex?: SearchIndexService,
    @Optional()
    @Inject(StorefrontService)
    private readonly storefrontService?: StorefrontService,
  ) {}

  async registerSeller(actor: RequestUser, dto: CreateSellerOnboardingDto) {
    const location = await this.locationsService.resolveAddressLocation(dto.address);
    const documents = this.normalizeSellerDocuments(actor.id, dto.documents);
    const slug = await this.createUniqueSlug(dto.storeName);
    const capabilities = this.resolveRegistrationCapabilities(dto);
    const seller = await this.prisma.client.$transaction(async (tx) => {
      const existingSeller = await tx.seller.findUnique({ where: { userId: actor.id } });

      if (existingSeller) {
        throw new ConflictException("Seller onboarding already exists for this account.");
      }

      const user = await tx.user.update({
        where: {
          id: actor.id,
        },
        data: {
          phone: dto.contactPhone,
          fullName: dto.contactName,
          status: UserStatus.ACTIVE,
        },
      });

      const role = await tx.role.upsert({
        where: { code: RoleCode.SELLER },
        update: {},
        create: {
          code: RoleCode.SELLER,
          name: "Seller",
          description: "Marketplace seller, hyperlocal store, or wholesale distributor.",
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });

      const selectedPlan = await this.sellerSubscriptions.resolveRegistrationPlan(
        tx,
        dto.subscriptionPlanId,
        capabilities.primaryCapability,
      );
      const subscriptionStartedAt = selectedPlan ? new Date() : null;
      const subscriptionStatus = this.sellerSubscriptions.initialRegistrationStatus(selectedPlan);

      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          sellerType: dto.sellerType,
          primaryCapability: capabilities.primaryCapability,
          enabledCapabilities: capabilities.enabledCapabilities,
          storeName: dto.storeName,
          slug,
          status: SellerStatus.PENDING_APPROVAL,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          subscriptionPlanId: selectedPlan?.id ?? null,
          subscriptionStatus,
          subscriptionStartedAt,
        },
      });

      await tx.sellerProfile.create({
        data: {
          sellerId: seller.id,
          description: dto.businessDescription ?? null,
          businessLegalName: this.emptyToNull(dto.businessLegalName),
          businessType: dto.businessType ?? null,
          gstNumber: this.normalizeGstNumber(dto.gstNumber),
          panNumber: this.normalizePanNumber(dto.panNumber),
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          contactEmail: user.email,
        },
      });

      await tx.sellerAddress.create({
        data: {
          sellerId: seller.id,
          line1: dto.address.line1,
          line2: dto.address.line2 ?? null,
          area: location.area,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: location.country,
          countryCode: location.countryCode,
          stateCode: location.stateCode,
          cityCode: location.cityCode,
          localAreaCode: location.localAreaCode,
          latitude: dto.address.latitude ?? null,
          longitude: dto.address.longitude ?? null,
          locationSource: dto.address.locationSource ?? null,
          accuracyMeters: dto.address.accuracyMeters ?? null,
          locationConfidenceScore: dto.address.locationConfidenceScore ?? null,
        },
      });

      for (const document of documents) {
        await tx.sellerDocument.create({
          data: {
            sellerId: seller.id,
            documentType: document.documentType,
            fileUrl: document.fileUrl,
            status: DocumentStatus.PENDING,
          },
        });
      }

      await this.sellerSubscriptions.recordRegistrationAssignment(
        tx,
        seller.id,
        selectedPlan,
        actor.id,
      );

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.registration.submitted",
          entityType: "seller",
          entityId: seller.id,
          newValue: {
            sellerType: seller.sellerType,
            primaryCapability: seller.primaryCapability,
            enabledCapabilities: seller.enabledCapabilities,
            storeName: seller.storeName,
            approvalStatus: seller.approvalStatus,
            subscriptionPlanId: selectedPlan?.id,
            subscriptionPlanName: selectedPlan?.name,
            verification: {
              businessLegalName: dto.businessLegalName,
              businessType: dto.businessType,
              gstNumber: this.normalizeGstNumber(dto.gstNumber),
              panNumber: this.normalizePanNumber(dto.panNumber),
              documentCount: documents.length,
            },
          },
        },
      });

      return this.getSellerByIdOrThrow(tx, seller.id);
    });

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.SELLER_REGISTRATION_SUBMITTED_SELLER,
        recipientType: EmailRecipientType.SELLER,
        recipient: seller.user.email,
        userId: seller.userId,
        variables: {
          sellerName: seller.storeName,
          contactName: seller.profile?.contactName ?? seller.storeName,
        },
      }),
      this.notifications.notifyAdminEvent(
        EMAIL_TRIGGER_EVENTS.SELLER_REGISTRATION_SUBMITTED_ADMIN,
        {
          sellerName: seller.storeName,
          sellerType: seller.sellerType,
          contactEmail: seller.user.email,
        },
      ),
    ]);

    await this.enqueueSellerSearchIndex(seller.id, "seller-registration-submitted");
    return seller;
  }

  private resolveRegistrationCapabilities(dto: CreateSellerOnboardingDto) {
    const defaultPrimary =
      dto.sellerType === SellerType.SERVICE_PROVIDER ? SellerCapability.SERVICE : SellerCapability.RETAIL;
    const primaryCapability = dto.primaryCapability ?? defaultPrimary;
    const enabledCapabilities = [
      ...new Set(dto.enabledCapabilities?.length ? dto.enabledCapabilities : [primaryCapability]),
    ];

    if (!enabledCapabilities.includes(primaryCapability)) {
      enabledCapabilities.push(primaryCapability);
    }

    return { primaryCapability, enabledCapabilities };
  }

  private getSellerByIdOrThrow(tx: Prisma.TransactionClient, sellerId: string) {
    return tx.seller.findUniqueOrThrow({
      where: { id: sellerId },
      include: {
        profile: true,
        addresses: true,
        documents: true,
        user: true,
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async getPublicSeller(slug: string) {
    const seller = await this.prisma.client.seller.findFirst({
      where: {
        slug,
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      select: publicSellerSelect,
    });

    if (!seller) {
      throw new NotFoundException("Store profile not found.");
    }

    const [productCount, reviewSummaries] = await Promise.all([
      this.prisma.client.product.count({
        where: {
          sellerId: seller.id,
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          deletedAt: null,
        },
      }),
      this.reviewSummariesForSellers([seller.id]),
    ]);

    return this.toPublicSellerResponse(seller, productCount, "NONE", reviewSummaries.get(seller.id));
  }

  async listPublicSellers(query: PublicSellerQueryDto = {}) {
    const limit = query.limit ?? 60;
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      select: publicSellerSelect,
      orderBy: { storeName: "asc" },
    });
    const sellerIds = sellers.map((seller) => seller.id);
    const productCounts = sellerIds.length
      ? await this.prisma.client.product.groupBy({
          by: ["sellerId"],
          where: {
            sellerId: { in: sellerIds },
            status: ProductStatus.ACTIVE,
            approvalStatus: ApprovalStatus.APPROVED,
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const productCountBySeller = new Map(
      productCounts.map((count) => [count.sellerId, count._count._all]),
    );
    const reviewSummaries = await this.reviewSummariesForSellers(sellerIds);

    const hasLocationPreference = Boolean(
      query.countryCode ||
        query.stateCode ||
        query.cityCode ||
        query.localAreaCode ||
        query.pincode,
    );

    const rankedSellers = sellers.map((seller) =>
      this.toPublicSellerResponse(
        seller,
        productCountBySeller.get(seller.id) ?? 0,
        this.resolvePublicSellerLocationMatchLevel(seller.addresses, query),
        reviewSummaries.get(seller.id),
      ),
    );

    if (hasLocationPreference) {
      rankedSellers.sort((left, right) => {
        const rankDelta =
          publicSellerLocationMatchRanks[right.locationMatchLevel] -
          publicSellerLocationMatchRanks[left.locationMatchLevel];
        if (rankDelta !== 0) {
          return rankDelta;
        }

        return left.storeName.localeCompare(right.storeName, undefined, {
          sensitivity: "base",
        });
      });
    }

    return rankedSellers.slice(0, limit);
  }

  private toPublicSellerResponse(
    seller: PublicSellerRecord,
    productCount: number,
    locationMatchLevel: PublicSellerLocationMatchLevel = "NONE",
    reviewSummary: PublicReviewSummary = this.emptyReviewSummary(),
  ) {
    return {
      id: seller.id,
      storeName: seller.storeName,
      slug: seller.slug,
      sellerType: seller.sellerType,
      createdAt: seller.createdAt,
      profile: seller.profile
        ? {
            logoUrl: seller.profile.logoUrl,
            bannerUrl: seller.profile.bannerUrl,
            description: seller.profile.description,
            createdAt: seller.profile.createdAt,
          }
        : null,
      addresses: seller.addresses.map((address) => ({
        area: address.area,
        city: address.city,
        state: address.state,
        country: address.country,
        countryCode: address.countryCode,
      })),
      locationMatchLevel,
      _count: {
        products: productCount,
      },
      reviewSummary,
    };
  }

  private async reviewSummariesForSellers(sellerIds: string[]) {
    const summaries = new Map<string, PublicReviewSummary>();
    if (!sellerIds.length) {
      return summaries;
    }

    const where = {
      sellerId: { in: sellerIds },
      status: ProductReviewStatus.APPROVED,
    };
    const [aggregates, distributionRows] = await Promise.all([
      this.prisma.client.productReview.groupBy({
        by: ["sellerId"],
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.client.productReview.groupBy({
        by: ["sellerId", "rating"],
        where,
        _count: { _all: true },
      }),
    ]);

    for (const aggregate of aggregates) {
      summaries.set(aggregate.sellerId, {
        ...this.emptyReviewSummary(),
        averageRating:
          aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
        reviewCount: aggregate._count._all,
      });
    }

    for (const row of distributionRows) {
      const summary = summaries.get(row.sellerId) ?? this.emptyReviewSummary();
      if (row.rating >= 1 && row.rating <= 5) {
        summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
      }
      summaries.set(row.sellerId, summary);
    }

    return summaries;
  }

  private emptyReviewSummary(): PublicReviewSummary {
    return {
      averageRating: null,
      reviewCount: 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };
  }

  private resolvePublicSellerLocationMatchLevel(
    addresses: Array<{
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      localAreaCode?: string | null;
      pincode?: string | null;
    }>,
    query: PublicSellerQueryDto,
  ): PublicSellerLocationMatchLevel {
    let bestMatch: PublicSellerLocationMatchLevel = "NONE";

    for (const address of addresses) {
      const level = this.resolveAddressLocationMatchLevel(address, query);
      if (publicSellerLocationMatchRanks[level] > publicSellerLocationMatchRanks[bestMatch]) {
        bestMatch = level;
      }

      if (bestMatch === "LOCAL_AREA") {
        return bestMatch;
      }
    }

    return bestMatch;
  }

  private resolveAddressLocationMatchLevel(
    address: {
      countryCode?: string | null;
      stateCode?: string | null;
      cityCode?: string | null;
      localAreaCode?: string | null;
      pincode?: string | null;
    },
    query: PublicSellerQueryDto,
  ): PublicSellerLocationMatchLevel {
    const countryCode = query.countryCode?.trim().toUpperCase();
    const stateCode = query.stateCode?.trim().toUpperCase();
    const cityCode = query.cityCode?.trim().toUpperCase();
    const localAreaCode = query.localAreaCode?.trim().toUpperCase();
    const pincode = query.pincode?.trim().toUpperCase();

    const addressCountry = address.countryCode?.trim().toUpperCase();
    const addressState = address.stateCode?.trim().toUpperCase();
    const addressCity = address.cityCode?.trim().toUpperCase();
    const addressLocalArea = address.localAreaCode?.trim().toUpperCase();
    const addressPincode = address.pincode?.trim().toUpperCase();

    if (
      (localAreaCode && addressLocalArea === localAreaCode) ||
      (pincode && addressPincode === pincode)
    ) {
      return "LOCAL_AREA";
    }

    if (cityCode && addressCity === cityCode) {
      return "CITY";
    }

    if (stateCode && addressState === stateCode) {
      return "STATE";
    }

    if (countryCode && addressCountry === countryCode) {
      return "COUNTRY";
    }

    return "NONE";
  }

  async getMySellerProfile(actor: RequestUser) {
    const seller = await this.getSellerForUserOrThrow(actor.id);
    return this.toSellerProfileResponse(seller);
  }

  async updateMySellerCapabilities(actor: RequestUser, dto: UpdateMySellerCapabilitiesDto) {
    const existing = await this.getSellerForUserOrThrow(actor.id);
    const enabledCapabilities = [...new Set(dto.enabledCapabilities)];

    if (!enabledCapabilities.length) {
      throw new BadRequestException("At least one seller capability is required.");
    }

    const primaryCapability = dto.primaryCapability ?? existing.primaryCapability;
    if (!enabledCapabilities.includes(primaryCapability)) {
      throw new BadRequestException("Primary capability must be enabled.");
    }

    const removedCapabilities = existing.enabledCapabilities.filter(
      (capability) => !enabledCapabilities.includes(capability),
    );
    if (removedCapabilities.length) {
      throw new BadRequestException("Seller capabilities can be added here, but not removed.");
    }

    const sellerType =
      primaryCapability === SellerCapability.SERVICE &&
      existing.sellerType === SellerType.MARKETPLACE_SELLER
        ? SellerType.SERVICE_PROVIDER
        : primaryCapability === SellerCapability.RETAIL &&
            existing.sellerType === SellerType.SERVICE_PROVIDER
          ? SellerType.MARKETPLACE_SELLER
          : existing.sellerType;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.update({
        where: { id: existing.id },
        data: {
          primaryCapability,
          enabledCapabilities,
          sellerType,
        },
        include: sellerProfileInclude,
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.capabilities.updated",
          entityType: "seller",
          entityId: existing.id,
          oldValue: {
            sellerType: existing.sellerType,
            primaryCapability: existing.primaryCapability,
            enabledCapabilities: existing.enabledCapabilities,
          },
          newValue: {
            sellerType: seller.sellerType,
            primaryCapability: seller.primaryCapability,
            enabledCapabilities: seller.enabledCapabilities,
            reason: dto.reason ?? "Seller capability added from seller workspace.",
          },
        },
      });

      return seller;
    });

    await this.enqueueSellerSearchIndex(updated.id, "seller-capabilities-updated");
    this.storefrontService?.clearHomeCache();
    return this.toSellerProfileResponse(updated);
  }

  async updateMySellerProfile(actor: RequestUser, dto: UpdateSellerProfileDto) {
    const existing = await this.getSellerForUserOrThrow(actor.id);
    const existingAddress = existing.addresses[0];
    const location = dto.address
      ? await this.locationsService.resolveAddressLocation({
          countryCode: dto.address.countryCode ?? existingAddress?.countryCode,
          stateCode: dto.address.stateCode ?? existingAddress?.stateCode,
          cityCode: dto.address.cityCode ?? existingAddress?.cityCode,
          localAreaCode: dto.address.localAreaCode ?? existingAddress?.localAreaCode,
          country: existingAddress?.country,
          state: dto.address.state ?? existingAddress?.state,
          city: dto.address.city ?? existingAddress?.city,
          area: dto.address.area ?? existingAddress?.area,
          pincode: dto.address.pincode ?? existingAddress?.pincode,
        })
      : null;
    const logoUrl = normalizeStorageImageReference(
      dto.logoUrl,
      "Store logo",
      this.sellerUploadFolder(actor.id, "profile/logo"),
    );
    const bannerUrl = normalizeStorageImageReference(
      dto.bannerUrl,
      "Store banner",
      this.sellerUploadFolder(actor.id, "profile/banner"),
    );
    const documents = this.normalizeSellerDocuments(actor.id, dto.documents);

    if (existing.status === SellerStatus.SUSPENDED) {
      throw new ForbiddenException("Suspended sellers cannot update their store profile.");
    }

    const slug =
      dto.storeName && dto.storeName !== existing.storeName
        ? await this.createUniqueSlug(dto.storeName, existing.id)
        : undefined;

    if (dto.contactEmail && dto.contactEmail !== existing.user.email) {
      const emailOwner = await this.prisma.client.user.findUnique({
        where: { email: dto.contactEmail },
      });

      if (emailOwner && emailOwner.id !== existing.userId) {
        throw new ConflictException(
          "This seller contact email is already used by another account.",
        );
      }
    }

    const courierSettings = this.normalizeCourierProviderSettings(dto.courierSettings);
    if (dto.courierSettings !== undefined && courierSettings.length) {
      const configuredProviders = await this.prisma.client.courierProviderSetting.findMany({
        where: { providerCode: { in: courierSettings.map((setting) => setting.providerCode) } },
        select: { providerCode: true },
      });
      const configuredCodes = new Set(configuredProviders.map((provider) => provider.providerCode));
      const missingCodes = courierSettings
        .map((setting) => setting.providerCode)
        .filter((providerCode) => !configuredCodes.has(providerCode));
      if (missingCodes.length) {
        throw new BadRequestException(
          `Courier provider setting is not configured yet: ${missingCodes.join(", ")}.`,
        );
      }
    }

    const seller = await this.prisma.client.$transaction(async (tx) => {
      const updatedSeller = await tx.seller.update({
        where: { id: existing.id },
        data: {
          ...(dto.storeName !== undefined ? { storeName: dto.storeName } : {}),
          ...(slug ? { slug } : {}),
        },
      });

      if (
        dto.logoUrl !== undefined ||
        dto.bannerUrl !== undefined ||
        dto.description !== undefined ||
        dto.businessLegalName !== undefined ||
        dto.businessType !== undefined ||
        dto.gstNumber !== undefined ||
        dto.panNumber !== undefined ||
        dto.contactName !== undefined ||
        dto.contactPhone !== undefined ||
        dto.contactEmail !== undefined
      ) {
        await tx.sellerProfile.upsert({
          where: { sellerId: existing.id },
          update: {
            ...(dto.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
            ...(dto.bannerUrl !== undefined ? { bannerUrl: bannerUrl || null } : {}),
            ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
            ...(dto.businessLegalName !== undefined
              ? { businessLegalName: this.emptyToNull(dto.businessLegalName) }
              : {}),
            ...(dto.businessType !== undefined ? { businessType: dto.businessType ?? null } : {}),
            ...(dto.gstNumber !== undefined
              ? { gstNumber: this.normalizeGstNumber(dto.gstNumber) }
              : {}),
            ...(dto.panNumber !== undefined
              ? { panNumber: this.normalizePanNumber(dto.panNumber) }
              : {}),
            ...(dto.contactName !== undefined ? { contactName: dto.contactName } : {}),
            ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
            ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail } : {}),
          },
          create: {
            sellerId: existing.id,
            logoUrl: logoUrl || null,
            bannerUrl: bannerUrl || null,
            description: dto.description ?? null,
            businessLegalName: this.emptyToNull(dto.businessLegalName),
            businessType: dto.businessType ?? null,
            gstNumber: this.normalizeGstNumber(dto.gstNumber),
            panNumber: this.normalizePanNumber(dto.panNumber),
            contactName:
              dto.contactName ??
              existing.profile?.contactName ??
              existing.user.fullName ??
              existing.storeName,
            contactPhone:
              dto.contactPhone ?? existing.profile?.contactPhone ?? existing.user.phone ?? "",
            contactEmail: dto.contactEmail ?? existing.profile?.contactEmail ?? existing.user.email,
          },
        });
      }

      if (dto.payoutProfile && this.hasPayoutProfileUpdate(dto.payoutProfile)) {
        await tx.sellerPayoutProfile.upsert({
          where: { sellerId: existing.id },
          update: {
            ...(dto.payoutProfile.accountHolderName !== undefined
              ? { accountHolderName: this.emptyToNull(dto.payoutProfile.accountHolderName) }
              : {}),
            ...(dto.payoutProfile.bankName !== undefined
              ? { bankName: this.emptyToNull(dto.payoutProfile.bankName) }
              : {}),
            ...(dto.payoutProfile.accountNumber !== undefined
              ? { accountNumber: this.emptyToNull(dto.payoutProfile.accountNumber) }
              : {}),
            ...(dto.payoutProfile.ifscCode !== undefined
              ? { ifscCode: this.emptyToNull(dto.payoutProfile.ifscCode?.toUpperCase()) }
              : {}),
            ...(dto.payoutProfile.upiId !== undefined
              ? { upiId: this.emptyToNull(dto.payoutProfile.upiId) }
              : {}),
            isVerified: false,
          },
          create: {
            sellerId: existing.id,
            accountHolderName: this.emptyToNull(dto.payoutProfile.accountHolderName),
            bankName: this.emptyToNull(dto.payoutProfile.bankName),
            accountNumber: this.emptyToNull(dto.payoutProfile.accountNumber),
            ifscCode: this.emptyToNull(dto.payoutProfile.ifscCode?.toUpperCase()),
            upiId: this.emptyToNull(dto.payoutProfile.upiId),
            isVerified: false,
          },
        });
      }

      if (dto.courierSettings !== undefined) {
        for (const setting of courierSettings) {
          await tx.sellerCourierProviderSetting.upsert({
            where: {
              sellerId_providerCode: {
                sellerId: existing.id,
                providerCode: setting.providerCode,
              },
            },
            update: {
              pickupLocationName: setting.pickupLocationName,
              isActive: setting.isActive,
              settingsSnapshot: {
                source: "SELLER_PROFILE",
                updatedByUserId: actor.id,
              },
            },
            create: {
              sellerId: existing.id,
              providerCode: setting.providerCode,
              pickupLocationName: setting.pickupLocationName,
              isActive: setting.isActive,
              settingsSnapshot: {
                source: "SELLER_PROFILE",
                updatedByUserId: actor.id,
              },
            },
          });
        }
      }

      if (
        dto.contactName !== undefined ||
        dto.contactPhone !== undefined ||
        dto.contactEmail !== undefined
      ) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(dto.contactName !== undefined ? { fullName: dto.contactName } : {}),
            ...(dto.contactPhone !== undefined ? { phone: dto.contactPhone } : {}),
            ...(dto.contactEmail !== undefined ? { email: dto.contactEmail } : {}),
          },
        });
      }

      if (dto.address) {
        const address = existing.addresses[0];
        const addressData = {
          ...(dto.address.line1 !== undefined ? { line1: dto.address.line1 } : {}),
          ...(dto.address.line2 !== undefined ? { line2: dto.address.line2 ?? null } : {}),
          ...(location
            ? {
                area: location.area,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: location.country,
                countryCode: location.countryCode,
                stateCode: location.stateCode,
                cityCode: location.cityCode,
                localAreaCode: location.localAreaCode,
              }
            : {}),
          ...(dto.address.latitude !== undefined ? { latitude: dto.address.latitude ?? null } : {}),
          ...(dto.address.longitude !== undefined ? { longitude: dto.address.longitude ?? null } : {}),
          ...(dto.address.locationSource !== undefined
            ? { locationSource: dto.address.locationSource ?? null }
            : {}),
          ...(dto.address.accuracyMeters !== undefined
            ? { accuracyMeters: dto.address.accuracyMeters ?? null }
            : {}),
          ...(dto.address.locationConfidenceScore !== undefined
            ? { locationConfidenceScore: dto.address.locationConfidenceScore ?? null }
            : {}),
        };

        if (address) {
          await tx.sellerAddress.update({
            where: { id: address.id },
            data: addressData,
          });
        } else {
          if (
            !dto.address.line1 ||
            !dto.address.city ||
            !dto.address.state ||
            !dto.address.pincode
          ) {
            throw new NotFoundException(
              "Seller address does not exist. Full address is required to create one.",
            );
          }

          await tx.sellerAddress.create({
            data: {
              sellerId: existing.id,
              line1: dto.address.line1,
              line2: dto.address.line2 ?? null,
              area: location?.area ?? dto.address.area ?? null,
              city: location?.city ?? dto.address.city,
              state: location?.state ?? dto.address.state,
              pincode: location?.pincode ?? dto.address.pincode,
              country: location?.country ?? "India",
              countryCode: location?.countryCode ?? "IN",
              stateCode: location?.stateCode ?? null,
              cityCode: location?.cityCode ?? null,
              localAreaCode: location?.localAreaCode ?? null,
              latitude: dto.address.latitude ?? null,
              longitude: dto.address.longitude ?? null,
              locationSource: dto.address.locationSource ?? null,
              accuracyMeters: dto.address.accuracyMeters ?? null,
              locationConfidenceScore: dto.address.locationConfidenceScore ?? null,
            },
          });
        }
      }

      if (dto.documents !== undefined) {
        for (const document of documents) {
          await tx.sellerDocument.upsert({
            where: {
              sellerId_documentType: {
                sellerId: existing.id,
                documentType: document.documentType,
              },
            },
            update: {
              fileUrl: document.fileUrl,
              status: DocumentStatus.PENDING,
            },
            create: {
              sellerId: existing.id,
              documentType: document.documentType,
              fileUrl: document.fileUrl,
              status: DocumentStatus.PENDING,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "seller.profile.updated",
          entityType: "seller",
          entityId: existing.id,
          oldValue: {
            storeName: existing.storeName,
            slug: existing.slug,
          },
          newValue: {
            storeName: updatedSeller.storeName,
            slug: updatedSeller.slug,
          },
        },
      });

      return tx.seller.findUniqueOrThrow({
        where: { id: existing.id },
        include: sellerProfileInclude,
      });
    });

    await this.enqueueSellerSearchIndex(seller.id, "seller-profile-updated");
    this.storefrontService?.clearHomeCache();
    return this.toSellerProfileResponse(seller);
  }

  async registerPushToken(actor: RequestUser, dto: RegisterSellerPushTokenDto) {
    const seller = await this.getSellerForUserOrThrow(actor.id);
    const token = dto.token.trim();

    const pushToken = await this.prisma.client.sellerPushToken.upsert({
      where: { token },
      update: {
        sellerId: seller.id,
        userId: actor.id,
        platform: dto.platform,
        deviceId: this.emptyToNull(dto.deviceId),
        appVersion: this.emptyToNull(dto.appVersion),
        enabled: true,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
      create: {
        sellerId: seller.id,
        userId: actor.id,
        token,
        platform: dto.platform,
        deviceId: this.emptyToNull(dto.deviceId),
        appVersion: this.emptyToNull(dto.appVersion),
      },
    });

    return { registered: true, tokenId: pushToken.id };
  }

  async revokePushToken(actor: RequestUser, dto: RevokeSellerPushTokenDto) {
    await this.prisma.client.sellerPushToken.updateMany({
      where: { token: dto.token.trim(), userId: actor.id },
      data: {
        enabled: false,
        revokedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    return { revoked: true };
  }

  private async enqueueSellerSearchIndex(sellerId: string, reason: string) {
    try {
      await this.searchIndex?.enqueueSeller(sellerId, { reason });
      const products = await this.prisma.client.product.findMany({
        where: { sellerId },
        select: { id: true, categoryId: true },
      });
      await Promise.all(
        products.flatMap((product) => [
          this.searchIndex?.enqueueProduct(product.id, { reason: `${reason}:product-rollup` }),
          this.searchIndex?.enqueueCategory(product.categoryId, { reason: `${reason}:category-rollup` }),
        ]),
      );
    } catch {
      // Search indexing is retryable background work; seller writes remain the source of truth.
    }
  }

  async syncMyCourierPickup(actor: RequestUser, providerCodeParam: string) {
    const providerCode = this.normalizeProviderCode(providerCodeParam);
    const seller = await this.getSellerForUserOrThrow(actor.id);
    const provider = await this.prisma.client.courierProviderSetting.findUnique({
      where: { providerCode },
    });
    if (!provider || !provider.isActive) {
      throw new BadRequestException(`Courier provider ${providerCode} is not active.`);
    }
    if (provider.mode === CourierProviderMode.MANUAL) {
      throw new BadRequestException(`Courier provider ${providerCode} is configured for manual entry.`);
    }
    if (!provider.credentialsConfigured) {
      throw new BadRequestException(`Courier provider ${providerCode} credentials are not configured.`);
    }

    const snapshot = this.providerSnapshot(provider.settingsSnapshot);
    const adapter = this.courierAdapters.getAdapter(snapshot.adapterCode, provider.providerCode);
    if (!adapter?.syncPickupLocation) {
      throw new BadRequestException(`Courier provider ${providerCode} does not support pickup sync.`);
    }

    const sellerAddress = seller.addresses[0];
    if (!sellerAddress) {
      throw new BadRequestException("Seller pickup address is required before courier pickup sync.");
    }

    const sellerEmail = this.emptyToNull(seller.profile?.contactEmail) ?? seller.user.email;
    const sellerPhone = this.emptyToNull(seller.profile?.contactPhone) ?? this.emptyToNull(seller.user.phone);
    if (!sellerEmail) {
      throw new BadRequestException("Seller pickup email is required before courier pickup sync.");
    }
    if (!sellerPhone) {
      throw new BadRequestException("Seller pickup phone is required before courier pickup sync.");
    }

    const existingSetting = seller.courierProviderSettings.find(
      (setting) => setting.providerCode === providerCode,
    );
    const pickupLocationName =
      this.emptyToNull(existingSetting?.pickupLocationName) ??
      this.generatePickupLocationName(seller, sellerAddress);
    const pickupResult = await adapter.syncPickupLocation({
      providerCode,
      pickupLocationName,
      sellerName:
        this.emptyToNull(seller.profile?.contactName) ??
        this.emptyToNull(seller.user.fullName) ??
        seller.storeName,
      sellerEmail,
      sellerPhone,
      sellerAddress: this.toCourierPickupAddress(sellerAddress),
      settings: snapshot,
    });

    const updatedSeller = await this.prisma.client.$transaction(async (tx) => {
      const setting = await tx.sellerCourierProviderSetting.upsert({
        where: {
          sellerId_providerCode: {
            sellerId: seller.id,
            providerCode,
          },
        },
        update: {
          pickupLocationName: pickupResult.pickupLocationName,
          isActive: true,
          settingsSnapshot: {
            source: "SELLER_PROFILE_PICKUP_SYNC",
            syncedAt: new Date().toISOString(),
            providerPickupId: pickupResult.providerPickupId ?? null,
            statusLabel: pickupResult.statusLabel ?? null,
            updatedByUserId: actor.id,
          },
        },
        create: {
          sellerId: seller.id,
          providerCode,
          pickupLocationName: pickupResult.pickupLocationName,
          isActive: true,
          settingsSnapshot: {
            source: "SELLER_PROFILE_PICKUP_SYNC",
            syncedAt: new Date().toISOString(),
            providerPickupId: pickupResult.providerPickupId ?? null,
            statusLabel: pickupResult.statusLabel ?? null,
            updatedByUserId: actor.id,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "seller.courier_pickup.synced",
          entityType: "seller_courier_provider_setting",
          entityId: setting.id,
          newValue: {
            sellerId: seller.id,
            providerCode,
            pickupLocationName: pickupResult.pickupLocationName,
            providerPickupId: pickupResult.providerPickupId ?? null,
            statusLabel: pickupResult.statusLabel ?? null,
          },
        },
      });

      return tx.seller.findUniqueOrThrow({
        where: { id: seller.id },
        include: sellerProfileInclude,
      });
    });

    return {
      providerCode,
      pickupLocationName: pickupResult.pickupLocationName,
      providerPickupId: pickupResult.providerPickupId ?? null,
      statusLabel: pickupResult.statusLabel ?? "Courier pickup location synced.",
      seller: this.toSellerProfileResponse(updatedSeller),
    };
  }

  private async getSellerForUserOrThrow(userId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId },
      include: sellerProfileInclude,
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return seller;
  }

  private toSellerProfileResponse(seller: SellerProfileRecord) {
    return {
      id: seller.id,
      storeName: seller.storeName,
      slug: seller.slug,
      sellerType: seller.sellerType,
      primaryCapability: seller.primaryCapability,
      enabledCapabilities: seller.enabledCapabilities,
      status: seller.status,
      approvalStatus: seller.approvalStatus,
      subscriptionStatus: seller.subscriptionStatus,
      subscriptionStartedAt: seller.subscriptionStartedAt,
      subscriptionCurrentPeriodEnd: seller.subscriptionCurrentPeriodEnd,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt,
      user: {
        email: seller.user.email,
        phone: seller.user.phone,
        fullName: seller.user.fullName,
        status: seller.user.status,
      },
      profile: seller.profile
        ? {
            logoUrl: seller.profile.logoUrl,
            bannerUrl: seller.profile.bannerUrl,
            description: seller.profile.description,
            businessLegalName: seller.profile.businessLegalName,
            businessType: seller.profile.businessType,
            gstNumber: seller.profile.gstNumber,
            panNumber: seller.profile.panNumber,
            contactName: seller.profile.contactName,
            contactPhone: seller.profile.contactPhone,
            contactEmail: seller.profile.contactEmail,
            createdAt: seller.profile.createdAt,
            updatedAt: seller.profile.updatedAt,
          }
        : null,
      payoutProfile: seller.payoutProfile
        ? {
            accountHolderName: seller.payoutProfile.accountHolderName,
            bankName: seller.payoutProfile.bankName,
            maskedAccountNumber: this.maskAccountNumber(seller.payoutProfile.accountNumber),
            ifscCode: seller.payoutProfile.ifscCode,
            maskedUpiId: this.maskUpiId(seller.payoutProfile.upiId),
            isVerified: seller.payoutProfile.isVerified,
          }
        : null,
      addresses: seller.addresses.map((address) => ({
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
      })),
      courierProviderSettings: seller.courierProviderSettings.map((setting) => ({
        providerCode: setting.providerCode,
        pickupLocationName: setting.pickupLocationName,
        isActive: setting.isActive,
      })),
      documents: seller.documents.map((document) => ({
        documentType: document.documentType,
        status: document.status,
        fileName: this.privateFileName(document.fileUrl),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
      subscriptionPlan: this.toSellerSubscriptionPlanResponse(seller.subscriptionPlan),
      subscriptions: seller.subscriptions.map((subscription) => ({
        status: subscription.status,
        isCurrent: subscription.isCurrent,
        startedAt: subscription.startedAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        lastPaymentStatus: subscription.lastPaymentStatus,
        paymentFailureCount: subscription.paymentFailureCount,
        plan: this.toSellerSubscriptionPlanResponse(subscription.plan),
      })),
    };
  }

  private toSellerSubscriptionPlanResponse(
    plan: SellerProfileRecord["subscriptionPlan"] | SellerProfileRecord["subscriptions"][number]["plan"],
  ) {
    return plan
      ? {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          pricePaise: plan.pricePaise,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          productLimit: plan.productLimit,
          featuredProductLimit: plan.featuredProductLimit,
          b2bEnquiryLimit: plan.b2bEnquiryLimit,
          commissionDiscountBps: plan.commissionDiscountBps,
          isDefault: plan.isDefault,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
        }
      : null;
  }

  private maskAccountNumber(value?: string | null) {
    if (!value) {
      return null;
    }

    const digits = value.replace(/\D/g, "");
    const suffix = digits.slice(-4) || value.slice(-4);
    return `****${suffix}`;
  }

  private maskUpiId(value?: string | null) {
    if (!value) {
      return null;
    }

    const [name, provider] = value.split("@");
    if (!name || !provider) {
      return "****";
    }

    return `${name.slice(0, 2)}****@${provider}`;
  }

  private privateFileName(value?: string | null) {
    return value?.split("/").at(-1) ?? "Uploaded document";
  }

  private async createUniqueSlug(storeName: string, excludeSellerId?: string) {
    const baseSlug = createSlug(storeName) || "seller";
    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.client.seller.findFirst({
        where: {
          slug: candidate,
          ...(excludeSellerId ? { id: { not: excludeSellerId } } : {}),
        },
      })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private sellerUploadFolder(userId: string, suffix: string) {
    return `1handindia/sellers/${safeStorageFolderSegment(userId)}/${suffix}`;
  }

  private sellerDocumentFolder(userId: string) {
    return `1handindia/sellers/${safeStorageFolderSegment(userId)}/documents`;
  }

  private normalizeSellerDocuments(
    userId: string,
    documents: CreateSellerOnboardingDto["documents"] | UpdateSellerProfileDto["documents"],
  ) {
    const folder = this.sellerDocumentFolder(userId);
    const seenTypes = new Set<string>();

    return (documents ?? []).map((document) => {
      const documentType = document.documentType.trim().toUpperCase();
      if (seenTypes.has(documentType)) {
        throw new BadRequestException(
          `Only one ${documentType.replaceAll("_", " ").toLowerCase()} document can be submitted at a time.`,
        );
      }
      seenTypes.add(documentType);

      return {
        documentType,
        fileUrl: this.normalizePrivateDocumentReference(document.fileUrl, documentType, folder),
      };
    });
  }

  private hasPayoutProfileUpdate(payoutProfile: UpdateSellerProfileDto["payoutProfile"]) {
    if (!payoutProfile) {
      return false;
    }

    return [
      payoutProfile.accountHolderName,
      payoutProfile.bankName,
      payoutProfile.accountNumber,
      payoutProfile.ifscCode,
      payoutProfile.upiId,
    ].some((value) => value !== undefined);
  }

  private normalizePrivateDocumentReference(
    value: string | undefined,
    documentType: string,
    requiredFolder: string,
  ) {
    const normalized = value?.trim().replaceAll("\\", "/").replace(/^\/+/, "") ?? "";

    if (
      !normalized ||
      normalized.includes("..") ||
      normalized.includes("://") ||
      normalized.split("/").some((part) => !part || !/^[a-zA-Z0-9._-]+$/.test(part))
    ) {
      throw new BadRequestException(
        `${documentType.replaceAll("_", " ")} document must be a valid private storage key.`,
      );
    }

    const legacyFolder = requiredFolder.replace(/^1handindia\//, "indihub/");
    if (!normalized.startsWith(`${requiredFolder}/`) && !normalized.startsWith(`${legacyFolder}/`)) {
      throw new BadRequestException(
        `${documentType.replaceAll("_", " ")} document must be uploaded through the signed seller document flow.`,
      );
    }

    return normalized;
  }

  private normalizeGstNumber(value?: string | null) {
    const normalized = this.emptyToNull(value)?.toUpperCase() ?? null;
    if (normalized && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized)) {
      throw new BadRequestException("GST number must be a valid GSTIN.");
    }

    return normalized;
  }

  private normalizePanNumber(value?: string | null) {
    const normalized = this.emptyToNull(value)?.toUpperCase() ?? null;
    if (normalized && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
      throw new BadRequestException("PAN number must be a valid PAN.");
    }

    return normalized;
  }

  private emptyToNull(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private providerSnapshot(value: Prisma.JsonValue | null): CourierProviderAdapterSnapshot {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as CourierProviderAdapterSnapshot)
      : {};
  }

  private normalizeProviderCode(value: string) {
    const providerCode = value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
    if (!providerCode) {
      throw new BadRequestException("Courier provider code is required.");
    }

    return providerCode;
  }

  private toCourierPickupAddress(address: SellerProfileRecord["addresses"][number]): CourierBookingAddress {
    return {
      line1: address.line1,
      line2: address.line2,
      area: address.area,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      countryCode: address.countryCode,
    };
  }

  private generatePickupLocationName(
    seller: Pick<SellerProfileRecord, "id" | "storeName" | "slug">,
    address: SellerProfileRecord["addresses"][number],
  ) {
    const storeSegment =
      this.pickupLocationSegment(seller.slug, 14) ||
      this.pickupLocationSegment(seller.storeName, 14) ||
      "SELLER";
    const locationSegment =
      this.pickupLocationSegment(address.pincode, 8) ||
      this.pickupLocationSegment(address.city, 8) ||
      "PICKUP";
    const sellerSegment = seller.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    const value = `1HI${storeSegment}${locationSegment}${sellerSegment}`;

    return value.slice(0, 36);
  }

  private pickupLocationSegment(value: string | null | undefined, maxLength: number) {
    return createSlug(value ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, maxLength);
  }

  private normalizeCourierProviderSettings(
    settings: UpdateSellerProfileDto["courierSettings"],
  ) {
    const seen = new Set<string>();

    return (settings ?? []).map((setting) => {
      const providerCode = this.normalizeProviderCode(setting.providerCode);
      if (seen.has(providerCode)) {
        throw new BadRequestException(`Courier provider ${providerCode} is duplicated.`);
      }
      seen.add(providerCode);

      return {
        providerCode,
        pickupLocationName: this.emptyToNull(setting.pickupLocationName),
        isActive: setting.isActive ?? true,
      };
    });
  }
}
