import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  ApprovalStatus,
  DocumentStatus,
  EmailRecipientType,
  PaymentStatus,
  Prisma,
  SellerStatus,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionStatus,
} from "@indihub/database";
import { paginationFromQuery } from "../../common/pagination";
import { EMAIL_TRIGGER_EVENTS } from "../../notifications/email-trigger-catalog";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexService } from "../../search/search-index.service";
import { StorageService } from "../../storage/storage.service";
import { RequestUser } from "../../auth/types/indihub-request";
import {
  SellerApprovalDecision,
  SellerApprovalDto,
  SellerDocumentStatusDto,
  SellerQueryDto,
  SellerSuspensionDto,
} from "./dto/seller-approval.dto";

@Injectable()
export class AdminSellersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Optional()
    @Inject(SearchIndexService)
    private readonly searchIndex?: SearchIndexService,
  ) {}

  async listSellers(query: SellerQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.SellerWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.sellerType ? { sellerType: query.sellerType } : {}),
      ...(query.search
        ? {
            OR: [
              { storeName: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { profile: { contactName: { contains: query.search, mode: "insensitive" } } },
              { profile: { businessLegalName: { contains: query.search, mode: "insensitive" } } },
              { profile: { gstNumber: { contains: query.search, mode: "insensitive" } } },
              { profile: { panNumber: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.seller.findMany({
        where,
        include: {
          user: true,
          profile: true,
          addresses: true,
          documents: true,
          subscriptionPlan: true,
          subscriptions: {
            where: { isCurrent: true },
            include: { plan: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              products: true,
              orderSplits: true,
              b2bEnquiries: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      });
      const total = await tx.seller.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async getSeller(sellerId: string) {
    return this.getSellerOrThrow(sellerId);
  }

  async getSellerExport(sellerId: string) {
    const seller = await this.getSellerOrThrow(sellerId, {
      productLimit: null,
      orderSplitLimit: null,
    });
    const documentIds = seller.documents.map((document) => document.id);
    const notes = await this.prisma.client.auditLog.findMany({
      where: {
        OR: [
          { entityType: "seller", entityId: sellerId },
          ...(documentIds.length
            ? [{ entityType: "seller_document", entityId: { in: documentIds } }]
            : []),
        ],
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      ...seller,
      notes,
    };
  }

  async getSellerDocumentAccess(sellerId: string, documentId: string, actor: RequestUser) {
    const document = await this.prisma.client.sellerDocument.findFirst({
      where: {
        id: documentId,
        sellerId,
        seller: {
          deletedAt: null,
        },
      },
    });

    if (!document) {
      throw new NotFoundException("Seller document not found.");
    }

    return this.storageService.privateDocumentAccess(actor, document.fileUrl);
  }

  getPendingSellers() {
    return this.prisma.client.seller.findMany({
      where: {
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      },
      include: {
        user: true,
        profile: true,
        addresses: true,
        documents: true,
        subscriptionPlan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });
  }

  async updateSellerApproval(sellerId: string, dto: SellerApprovalDto, actor?: RequestUser) {
    const updatedSeller = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId },
        include: { user: true, profile: true, subscriptionPlan: true },
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }

      const approved = dto.decision === SellerApprovalDecision.APPROVE;
      const nextSubscriptionStatus =
        approved && seller.subscriptionPlan
          ? this.defaultSubscriptionStatusForPlan(seller.subscriptionPlan)
          : seller.subscriptionStatus;
      const nextSeller = await tx.seller.update({
        where: {
          id: sellerId,
        },
        data: {
          status: approved ? SellerStatus.APPROVED : SellerStatus.REJECTED,
          approvalStatus: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          subscriptionStatus: nextSubscriptionStatus,
        },
        include: {
          user: true,
          profile: true,
          addresses: true,
          documents: true,
          subscriptionPlan: true,
        },
      });

      if (approved) {
        await tx.sellerSubscription.updateMany({
          where: {
            sellerId,
            isCurrent: true,
          },
          data: {
            status: nextSubscriptionStatus,
            lastPaymentStatus:
              nextSubscriptionStatus === SellerSubscriptionStatus.PENDING_PAYMENT
                ? PaymentStatus.PENDING
                : PaymentStatus.NOT_REQUIRED,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: approved ? "seller.approved" : "seller.rejected",
          entityType: "seller",
          entityId: sellerId,
          oldValue: {
            status: seller.status,
            approvalStatus: seller.approvalStatus,
          },
          newValue: {
            status: nextSeller.status,
            approvalStatus: nextSeller.approvalStatus,
            note: dto.note,
          },
          ...(actor?.id ? { actor: { connect: { id: actor.id } } } : {}),
        },
      });

      return nextSeller;
    });

    await this.notifications.notifyEvent({
      eventCode:
        updatedSeller.approvalStatus === ApprovalStatus.APPROVED
          ? EMAIL_TRIGGER_EVENTS.SELLER_APPROVED
          : EMAIL_TRIGGER_EVENTS.SELLER_REJECTED,
      recipientType: EmailRecipientType.SELLER,
      recipient: updatedSeller.user.email,
      userId: updatedSeller.userId,
      variables: {
        sellerName: updatedSeller.storeName,
        note: dto.note ?? "",
      },
    });

    await this.enqueueSellerSearchIndex(
      updatedSeller.id,
      updatedSeller.approvalStatus === ApprovalStatus.APPROVED ? "seller-approved" : "seller-rejected",
    );
    return updatedSeller;
  }

  async updateSellerSuspension(sellerId: string, dto: SellerSuspensionDto, actor: RequestUser) {
    const updatedSeller = await this.prisma.client.$transaction(async (tx) => {
      const seller = await tx.seller.findFirst({
        where: { id: sellerId },
        include: { user: true, profile: true },
      });

      if (!seller) {
        throw new NotFoundException("Seller not found.");
      }

      const nextStatus = dto.suspended
        ? SellerStatus.SUSPENDED
        : seller.approvalStatus === ApprovalStatus.APPROVED
          ? SellerStatus.APPROVED
          : SellerStatus.PENDING_APPROVAL;

      const nextSeller = await tx.seller.update({
        where: { id: sellerId },
        data: {
          status: nextStatus,
        },
        include: {
          user: true,
          profile: true,
          addresses: true,
          documents: true,
          subscriptionPlan: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: dto.suspended ? "seller.suspended" : "seller.unsuspended",
          entityType: "seller",
          entityId: sellerId,
          oldValue: {
            status: seller.status,
            approvalStatus: seller.approvalStatus,
          },
          newValue: {
            status: nextSeller.status,
            approvalStatus: nextSeller.approvalStatus,
            note: dto.note,
          },
        },
      });

      return nextSeller;
    });

    await this.notifications.notifyEvent({
      eventCode: dto.suspended
        ? EMAIL_TRIGGER_EVENTS.SELLER_REJECTED
        : EMAIL_TRIGGER_EVENTS.SELLER_APPROVED,
      recipientType: EmailRecipientType.SELLER,
      recipient: updatedSeller.user.email,
      userId: updatedSeller.userId,
      variables: {
        sellerName: updatedSeller.storeName,
        note: dto.note ?? "",
      },
    });

    await this.enqueueSellerSearchIndex(
      updatedSeller.id,
      dto.suspended ? "seller-suspended" : "seller-unsuspended",
    );
    return updatedSeller;
  }

  async updateSellerDocumentStatus(
    sellerId: string,
    documentId: string,
    dto: SellerDocumentStatusDto,
    actor: RequestUser,
  ) {
    const updatedDocument = await this.prisma.client.$transaction(async (tx) => {
      const document = await tx.sellerDocument.findFirst({
        where: {
          id: documentId,
          sellerId,
          seller: { deletedAt: null },
        },
      });

      if (!document) {
        throw new NotFoundException("Seller document not found.");
      }

      const nextDocument = await tx.sellerDocument.update({
        where: { id: document.id },
        data: { status: dto.status },
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action:
            dto.status === DocumentStatus.APPROVED
              ? "seller.document.verified"
              : "seller.document.status_updated",
          entityType: "seller_document",
          entityId: document.id,
          oldValue: {
            sellerId,
            documentType: document.documentType,
            status: document.status,
          },
          newValue: {
            sellerId,
            documentType: nextDocument.documentType,
            status: nextDocument.status,
            note: dto.note,
          },
        },
      });

      return nextDocument;
    });

    return updatedDocument;
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
      // Search indexing is retryable background work; seller moderation remains the source of truth.
    }
  }

  private async getSellerOrThrow(
    sellerId: string,
    options: { productLimit?: number | null; orderSplitLimit?: number | null } = {},
  ) {
    const productTake = options.productLimit === undefined ? 25 : options.productLimit;
    const orderSplitTake = options.orderSplitLimit === undefined ? 25 : options.orderSplitLimit;
    const seller = await this.prisma.client.seller.findFirst({
      where: { id: sellerId, deletedAt: null },
      include: {
        user: true,
        profile: true,
        addresses: true,
        subscriptionPlan: true,
        subscriptions: {
          where: { isCurrent: true },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        documents: true,
        products: {
          include: {
            category: true,
            variants: true,
            images: true,
          },
          orderBy: { createdAt: "desc" },
          ...(productTake ? { take: productTake } : {}),
        },
        orderSplits: {
          include: {
            order: true,
          },
          orderBy: { createdAt: "desc" },
          ...(orderSplitTake ? { take: orderSplitTake } : {}),
        },
        _count: {
          select: {
            products: true,
            orderSplits: true,
            b2bEnquiries: true,
            documents: true,
            addresses: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException("Seller not found.");
    }

    return seller;
  }

  private defaultSubscriptionStatusForPlan(plan: {
    pricePaise: number;
    billingCycle: SellerSubscriptionBillingCycle;
  }) {
    const recurringPaidPlan =
      plan.pricePaise > 0 &&
      (plan.billingCycle === SellerSubscriptionBillingCycle.MONTHLY ||
        plan.billingCycle === SellerSubscriptionBillingCycle.YEARLY);

    return recurringPaidPlan
      ? SellerSubscriptionStatus.PENDING_PAYMENT
      : SellerSubscriptionStatus.ACTIVE;
  }
}
