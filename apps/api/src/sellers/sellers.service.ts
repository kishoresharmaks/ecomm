import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalStatus,
  DocumentStatus,
  EmailRecipientType,
  ProductStatus,
  RoleCode,
  SellerStatus,
  SellerSubscriptionStatus,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { LocationsService } from "../locations/locations.service";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { createSlug } from "../common/slug";
import {
  normalizeStorageImageReference,
  safeStorageFolderSegment,
} from "../storage/storage-image";
import { CreateSellerOnboardingDto } from "./dto/create-seller-registration.dto";
import { PublicSellerQueryDto } from "./dto/public-seller-query.dto";
import { UpdateSellerProfileDto } from "./dto/seller-profile.dto";
import { SellerSubscriptionsService } from "./seller-subscriptions.service";

const publicSellerProfileSelect = {
  id: true,
  sellerId: true,
  logoUrl: true,
  bannerUrl: true,
  description: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  createdAt: true,
  updatedAt: true,
};

const publicSellerLocationMatchRanks = {
  NONE: 0,
  COUNTRY: 1,
  STATE: 2,
  CITY: 3,
  LOCAL_AREA: 4,
} as const;

export type PublicSellerLocationMatchLevel = keyof typeof publicSellerLocationMatchRanks;

@Injectable()
export class SellersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocationsService) private readonly locationsService: LocationsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions: SellerSubscriptionsService,
  ) {}

  async registerSeller(actor: RequestUser, dto: CreateSellerOnboardingDto) {
    const location = await this.locationsService.resolveAddressLocation(dto.address);
    const documents = this.normalizeSellerDocuments(actor.id, dto.documents);
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
          description: "Vendor, nearby store, or local shop.",
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

      const slug = await this.createUniqueSlug(dto.storeName);
      const selectedPlan = await this.sellerSubscriptions.resolveRegistrationPlan(
        tx,
        dto.subscriptionPlanId,
      );
      const subscriptionStartedAt = selectedPlan ? new Date() : null;

      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          sellerType: dto.sellerType,
          storeName: dto.storeName,
          slug,
          status: SellerStatus.PENDING_APPROVAL,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          subscriptionPlanId: selectedPlan?.id ?? null,
          subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
          subscriptionStartedAt,
          profile: {
            create: {
              description: dto.businessDescription ?? null,
              businessLegalName: this.emptyToNull(dto.businessLegalName),
              businessType: dto.businessType ?? null,
              gstNumber: this.normalizeGstNumber(dto.gstNumber),
              panNumber: this.normalizePanNumber(dto.panNumber),
              contactName: dto.contactName,
              contactPhone: dto.contactPhone,
              contactEmail: user.email,
            },
          },
          addresses: {
            create: {
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
            },
          },
          ...(documents.length
            ? {
                documents: {
                  create: documents.map((document) => ({
                    documentType: document.documentType,
                    fileUrl: document.fileUrl,
                    status: DocumentStatus.PENDING,
                  })),
                },
              }
            : {}),
        },
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

      return seller;
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

    return seller;
  }

  async getPublicSeller(slug: string) {
    const seller = await this.prisma.client.seller.findFirst({
      where: {
        slug,
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
        profile: {
          select: publicSellerProfileSelect,
        },
        addresses: true,
        subscriptionPlan: true,
      },
    });

    if (!seller) {
      throw new NotFoundException("Store profile not found.");
    }

    const productCount = await this.prisma.client.product.count({
      where: {
        sellerId: seller.id,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
    });

    return {
      ...seller,
      _count: {
        products: productCount,
      },
    };
  }

  async listPublicSellers(query: PublicSellerQueryDto = {}) {
    const limit = query.limit ?? 60;
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      include: {
        profile: {
          select: publicSellerProfileSelect,
        },
        addresses: true,
      },
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

    const hasLocationPreference = Boolean(
      query.countryCode ||
        query.stateCode ||
        query.cityCode ||
        query.localAreaCode ||
        query.pincode,
    );

    const rankedSellers = sellers.map((seller) => ({
      ...seller,
      locationMatchLevel: this.resolvePublicSellerLocationMatchLevel(seller.addresses, query),
      _count: {
        products: productCountBySeller.get(seller.id) ?? 0,
      },
    }));

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
    return this.getSellerForUserOrThrow(actor.id);
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

      if (dto.payoutProfile) {
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
        include: {
          user: true,
          profile: true,
          payoutProfile: true,
          addresses: true,
          documents: true,
          subscriptionPlan: true,
          subscriptions: {
            where: { isCurrent: true },
            include: { plan: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    });

    return seller;
  }

  private async getSellerForUserOrThrow(userId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId },
      include: {
        user: true,
        profile: true,
        payoutProfile: true,
        addresses: true,
        documents: true,
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return seller;
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
    return `indihub/sellers/${safeStorageFolderSegment(userId)}/${suffix}`;
  }

  private sellerDocumentFolder(userId: string) {
    return `indihub/sellers/${safeStorageFolderSegment(userId)}/documents`;
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

    if (!normalized.startsWith(`${requiredFolder}/`)) {
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
}
