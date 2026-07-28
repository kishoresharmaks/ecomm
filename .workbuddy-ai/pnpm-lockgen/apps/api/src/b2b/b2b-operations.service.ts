import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  B2BCreditDecisionStatus,
  B2BDeliveryAcceptanceStatus,
  B2BDisputeResolutionType,
  B2BErpConnectionStatus,
  B2BErpExportFormat,
  B2BErpExportStatus,
  B2BFinancialReconciliationStatus,
  B2BFulfilmentSource,
  B2BFulfilmentStatus,
  B2BIntegrationOutboxStatus,
  B2BInventoryReservationStatus,
  B2BOrderAmendmentStatus,
  B2BOrderStatus,
  B2BPaymentMethod,
  B2BProofStatus,
  B2BPaymentRecordStatus,
  B2BPaymentScheduleStatus,
  B2BPaymentStatus,
  B2BPaymentTermType,
  B2BPoReviewStatus,
  B2BProcurementStatus,
  B2BProductionStatus,
  B2BQcStatus,
  B2BReceivableStatus,
  B2BShipmentStatus,
  B2BSupportCaseType,
  B2BSupportCaseStatus,
  B2BWarehouseTaskStatus,
  B2BWarehouseTaskType,
  GstComplianceStatus,
  InventoryMovementType,
  Prisma,
  RoleCode,
  SellerSettlementStatus,
  SellerStaffPermission,
  TaxDocumentStatus,
  TaxDocumentType,
} from "@indihub/database";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { usesCurrentProfessionalPdfTemplate } from "../documents/professional-pdf";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { TaxDocumentsService } from "../tax/tax-documents.service";
import { renderB2BReceiptVoucherPdf } from "./b2b-document-pdf";
import {
  AssignB2BShipmentDto,
  B2BControlActionDto,
  B2BOperationsQueryDto,
  B2BReceivableQueryDto,
  CompleteB2BWarehouseTaskDto,
  CreateB2BOrderAmendmentDto,
  CreateB2BCollectionTaskDto,
  CreateB2BErpConnectionDto,
  CreateB2BOnlinePaymentDto,
  CreateB2BPackageDto,
  CreateB2BPaymentRecordDto,
  CreateB2BProcurementDto,
  CreateB2BProductionDto,
  CreateB2BShipmentDto,
  CreateB2BSupportCaseDto,
  CreateB2BWarehouseTaskDto,
  DecideB2BCreditDto,
  DecideB2BOrderAmendmentDto,
  DecideB2BDeliveryDto,
  DispatchB2BShipmentDto,
  RecordB2BPodDto,
  RecordB2BQcDto,
  ReconcileB2BFinanceDto,
  ResolveB2BDisputeDto,
  ReviewB2BPoDto,
  UpdateB2BCollectionTaskDto,
  UpdateB2BErpConnectionDto,
  UpdateB2BProcurementDto,
  UpdateB2BProductionDto,
  UpdateB2BShipmentEventDto,
  UpdateB2BSupportCaseDto,
  UpsertB2BCreditProfileDto,
  UpsertB2BFulfilmentPlansDto,
  VerifyB2BPaymentRecordDto,
  VerifyB2BOnlinePaymentDto,
} from "./dto/b2b-operations.dto";

type OrderAudience = "BUYER" | "SELLER" | "ADMIN" | "FINANCE";

const orderOperationsInclude = {
  businessBuyer: {
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      addresses: { orderBy: { createdAt: "asc" as const } },
      creditProfile: true,
    },
  },
  seller: {
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      profile: true,
      addresses: { orderBy: { createdAt: "asc" as const } },
    },
  },
  lines: {
    include: {
      product: true,
      productVariant: true,
      reservations: { orderBy: { reservedAt: "desc" as const } },
      fulfilmentPlan: {
        include: {
          procurementOrder: true,
          productionJob: true,
        },
      },
    },
    orderBy: { lineNumber: "asc" as const },
  },
  poReview: { include: { reviewedBy: { select: { id: true, fullName: true } } } },
  creditDecisions: { orderBy: { createdAt: "desc" as const } },
  paymentSchedules: { orderBy: { installmentNumber: "asc" as const } },
  warehouseTasks: {
    include: { items: true, assignedTo: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  packages: { orderBy: { sequence: "asc" as const } },
  qcInspections: { orderBy: { createdAt: "desc" as const } },
  shipments: {
    include: {
      packages: true,
      events: { orderBy: { createdAt: "desc" as const } },
      proofOfDelivery: true,
      assignedDeliveryUser: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  taxDocuments: {
    include: { compliance: true, lines: true },
    orderBy: { createdAt: "desc" as const },
  },
  receivable: {
    include: {
      entries: { orderBy: { createdAt: "desc" as const } },
      collectionTasks: { orderBy: { createdAt: "desc" as const } },
    },
  },
  paymentRecords: {
    include: {
      allocations: true,
      receiptVoucher: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  supportCases: { orderBy: { createdAt: "desc" as const } },
  amendments: {
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true } },
      decidedBy: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  disputeResolutions: {
    include: {
      supportCase: { select: { id: true, caseNumber: true, subject: true } },
      creditNote: { select: { id: true, documentNumber: true, status: true } },
      replacementEnquiry: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  financialReconciliations: { orderBy: { createdAt: "desc" as const }, take: 10 },
  events: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.B2BOrderInclude;

@Injectable()
export class B2BOperationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(TaxDocumentsService) private readonly taxDocuments: TaxDocumentsService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async listOrders(actor: RequestUser, audience: OrderAudience, query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const scope = await this.orderScope(actor, audience);
    const { page, take, skip } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const search = query.search?.trim();
    const statuses = Object.values(B2BOrderStatus);
    const status =
      query.status && statuses.includes(query.status as B2BOrderStatus)
        ? (query.status as B2BOrderStatus)
        : undefined;
    const where: Prisma.B2BOrderWhereInput = {
      ...scope,
      ...(status ? { status } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.buyerId ? { businessBuyerId: query.buyerId } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            paymentDueAt: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { purchaseOrderNumber: { contains: search, mode: "insensitive" } },
              { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BOrder.findMany({
        where,
        include: {
          businessBuyer: { select: { id: true, companyName: true } },
          seller: { select: { id: true, storeName: true } },
          lines: { select: { id: true, description: true, quantity: true }, orderBy: { lineNumber: "asc" } },
          receivable: { select: { status: true, outstandingAmountPaise: true, ageingBucket: true, dueAt: true } },
          shipments: { select: { id: true, status: true, acceptanceStatus: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BOrder.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getOrder(actor: RequestUser, audience: OrderAudience, orderNumber: string) {
    this.assertEnabled();
    const order = await this.prisma.client.b2BOrder.findFirst({
      where: {
        orderNumber: this.normalizeOrderNumber(orderNumber),
        ...(await this.orderScope(actor, audience)),
      },
      include: orderOperationsInclude,
    });
    if (!order) {
      throw new NotFoundException("B2B order not found.");
    }
    return this.withDerivedLineProgress(order);
  }

  async receiptVoucherDocumentAccess(
    actor: RequestUser,
    audience: OrderAudience,
    orderNumber: string,
    paymentId: string,
  ) {
    const order = await this.getOrder(actor, audience, orderNumber);
    const payment = order.paymentRecords.find((item) => item.id === paymentId);
    if (!payment?.receiptVoucher) {
      throw new NotFoundException("B2B receipt voucher not found.");
    }
    let fileKey = payment.receiptVoucher.fileKey;
    if (!usesCurrentProfessionalPdfTemplate(fileKey)) {
      const pdf = await renderB2BReceiptVoucherPdf({
        voucherNumber: payment.receiptVoucher.voucherNumber,
        orderNumber: order.orderNumber,
        issuedAt: payment.receiptVoucher.issuedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        buyerName: order.businessBuyer?.companyName ?? "Business buyer",
        sellerName: order.seller?.storeName ?? "Seller",
        paymentMethod: payment.method.replaceAll("_", " "),
        paymentReference: payment.referenceNumber ?? payment.id,
        paymentStatus: payment.status.replaceAll("_", " "),
        amount: `${order.currency} ${(payment.amountPaise / 100).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      });
      const upload = await this.storage.saveB2BReceiptVoucherPdf(
        {
          businessBuyerId: order.businessBuyerId,
          orderNumber: order.orderNumber,
          actorUserId: actor.id,
        },
        { fileName: `${payment.receiptVoucher.voucherNumber}.pdf` },
        pdf,
      );
      await this.prisma.client.b2BReceiptVoucher.updateMany({
        where: { id: payment.receiptVoucher.id, fileKey: fileKey ?? null },
        data: { fileKey: upload.assetKey },
      });
      const voucher = await this.prisma.client.b2BReceiptVoucher.findUnique({
        where: { id: payment.receiptVoucher.id },
        select: { fileKey: true },
      });
      fileKey = voucher?.fileKey ?? upload.assetKey;
    }
    return this.storage.b2bReceiptVoucherDocumentAccess(fileKey ?? undefined);
  }

  async podDocumentAccess(
    actor: RequestUser,
    audience: OrderAudience,
    orderNumber: string,
    shipmentId: string,
    fileReference: string,
  ) {
    const order = await this.getOrder(actor, audience, orderNumber);
    const shipment = order.shipments.find((item) => item.id === shipmentId);
    if (!shipment?.proofOfDelivery) {
      throw new NotFoundException("B2B proof of delivery not found.");
    }
    const fileKey = this.podFileKey(shipment.proofOfDelivery, fileReference);
    return this.storage.b2bPodDocumentAccess(fileKey);
  }

  async listDeliveryPartners(query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      userRoles: { some: { role: { code: RoleCode.DELIVERY_PARTNER } } },
      deliveryProfile: { is: { isAvailable: true } },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          deliveryProfile: {
            select: {
              isAvailable: true,
              serviceCityCode: true,
              vehicleType: true,
            },
          },
        },
        orderBy: [{ fullName: "asc" }, { email: "asc" }, { id: "asc" }],
        skip,
        take,
      }),
      this.prisma.client.user.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async assignShipment(
    actor: RequestUser,
    orderNumber: string,
    shipmentId: string,
    idempotencyKey: string | undefined,
    dto: AssignB2BShipmentDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    const shipment = order.shipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new NotFoundException("B2B shipment not found.");
    this.requireStatus(order.status, [
      B2BOrderStatus.TAX_INVOICE_ISSUED,
      B2BOrderStatus.E_WAY_READY,
      B2BOrderStatus.E_WAY_NOT_REQUIRED,
      B2BOrderStatus.DISPATCHED,
    ]);
    const deliveryUser = await this.prisma.client.user.findFirst({
      where: {
        id: dto.deliveryUserId,
        userRoles: { some: { role: { code: RoleCode.DELIVERY_PARTNER } } },
        deliveryProfile: { is: { isAvailable: true } },
      },
      select: { id: true, fullName: true, email: true },
    });
    if (!deliveryUser) {
      throw new UnprocessableEntityException(
        "Choose an available delivery partner account.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "shipment-assign", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BShipment.update({
        where: { id: shipment.id },
        data: { assignedDeliveryUserId: deliveryUser.id },
      });
      await tx.b2BShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: shipment.status,
          note: `Assigned to ${deliveryUser.fullName ?? deliveryUser.email}.`,
          createdByUserId: actor.id,
        },
      });
      await this.advanceOrder(
        tx,
        order,
        order.status,
        actor.id,
        dto.note || `Shipment ${shipment.shipmentNumber} assigned for delivery.`,
        { shipmentId: shipment.id, deliveryUserId: deliveryUser.id },
      );
      await this.recordMutation(tx, actor.id, order.id, "shipment-assign", key, dto);
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async listExceptions(query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = query.search?.trim();
    const where: Prisma.B2BOrderWhereInput = {
      OR: [
        { legacyMigrationReviewRequired: true },
        {
          status: {
            in: [
              B2BOrderStatus.ON_HOLD,
              B2BOrderStatus.FULFILMENT_REVIEW_REQUIRED,
              B2BOrderStatus.PAYMENT_OVERDUE,
              B2BOrderStatus.DELIVERY_DISPUTED,
            ],
          },
        },
        {
          poReview: {
            is: {
              status: {
                in: [
                  B2BPoReviewStatus.REJECTED,
                  B2BPoReviewStatus.CHANGES_REQUIRED,
                ],
              },
            },
          },
        },
        {
          taxDocuments: {
            some: {
              compliance: {
                is: {
                  OR: [
                    { eInvoiceError: { not: null } },
                    { eWayBillError: { not: null } },
                  ],
                },
              },
            },
          },
        },
      ],
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { orderNumber: { contains: search, mode: "insensitive" } },
                  { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
                  { seller: { storeName: { contains: search, mode: "insensitive" } } },
                ],
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          legacyMigrationReviewRequired: true,
          updatedAt: true,
          businessBuyer: { select: { companyName: true } },
          seller: { select: { storeName: true } },
          poReview: { select: { status: true, exceptionCodes: true, note: true } },
          taxDocuments: {
            where: {
              compliance: {
                is: {
                  OR: [
                    { eInvoiceError: { not: null } },
                    { eWayBillError: { not: null } },
                  ],
                },
              },
            },
            select: {
              documentNumber: true,
              compliance: {
                select: { eInvoiceError: true, eWayBillError: true },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BOrder.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async assignedPodDocumentAccess(
    actor: RequestUser,
    shipmentId: string,
    fileReference: string,
  ) {
    const shipment = await this.prisma.client.b2BShipment.findFirst({
      where: { id: shipmentId, assignedDeliveryUserId: actor.id },
      include: { proofOfDelivery: true },
    });
    if (!shipment?.proofOfDelivery) {
      throw new NotFoundException("Assigned B2B proof of delivery not found.");
    }
    const fileKey = this.podFileKey(shipment.proofOfDelivery, fileReference);
    return this.storage.b2bPodDocumentAccess(fileKey);
  }

  async holdOrder(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: B2BControlActionDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.PROFORMA_ISSUED,
      B2BOrderStatus.PO_SUBMITTED,
      B2BOrderStatus.PO_UNDER_REVIEW,
      B2BOrderStatus.PO_ACCEPTED,
      B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
      B2BOrderStatus.STOCK_READY,
      B2BOrderStatus.PICKING,
      B2BOrderStatus.PACKING,
      B2BOrderStatus.QC_PENDING,
      B2BOrderStatus.PACKED_AND_QC_PASSED,
      B2BOrderStatus.TAX_INVOICE_ISSUED,
      B2BOrderStatus.E_WAY_READY,
      B2BOrderStatus.E_WAY_NOT_REQUIRED,
      B2BOrderStatus.FULFILMENT_REVIEW_REQUIRED,
      B2BOrderStatus.PAYMENT_OVERDUE,
    ]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "order-hold", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    await this.prisma.client.$transaction(async (tx) => {
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.ON_HOLD,
        actor.id,
        dto.reason,
        { previousStatus: order.status },
      );
      await this.recordMutation(tx, actor.id, order.id, "order-hold", key, dto);
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async resumeOrder(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: B2BControlActionDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [B2BOrderStatus.ON_HOLD]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "order-resume", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    const holdEvent = order.events.find((event) => event.status === B2BOrderStatus.ON_HOLD);
    const previousStatus =
      holdEvent?.payload &&
      typeof holdEvent.payload === "object" &&
      !Array.isArray(holdEvent.payload) &&
      typeof holdEvent.payload.previousStatus === "string" &&
      Object.values(B2BOrderStatus).includes(
        holdEvent.payload.previousStatus as B2BOrderStatus,
      )
        ? (holdEvent.payload.previousStatus as B2BOrderStatus)
        : B2BOrderStatus.FULFILMENT_REVIEW_REQUIRED;
    if (
      previousStatus === B2BOrderStatus.ON_HOLD ||
      previousStatus === B2BOrderStatus.CANCELLED ||
      previousStatus === B2BOrderStatus.CLOSED
    ) {
      throw new ConflictException("The saved pre-hold lifecycle state cannot be resumed.");
    }
    await this.prisma.client.$transaction(async (tx) => {
      await this.advanceOrder(
        tx,
        order,
        previousStatus,
        actor.id,
        dto.reason,
        { resumedFrom: B2BOrderStatus.ON_HOLD },
      );
      await this.recordMutation(tx, actor.id, order.id, "order-resume", key, dto);
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async cancelOrder(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: B2BControlActionDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.PROFORMA_ISSUED,
      B2BOrderStatus.PO_SUBMITTED,
      B2BOrderStatus.PO_UNDER_REVIEW,
      B2BOrderStatus.PO_ACCEPTED,
      B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
      B2BOrderStatus.STOCK_READY,
      B2BOrderStatus.ON_HOLD,
      B2BOrderStatus.FULFILMENT_REVIEW_REQUIRED,
    ]);
    if (
      order.paidAmountPaise > 0 ||
      order.paymentRecords.some(
        (payment) =>
          payment.status === B2BPaymentRecordStatus.VERIFIED ||
          payment.status === B2BPaymentRecordStatus.CLEARED,
      )
    ) {
      throw new UnprocessableEntityException(
        "Recorded buyer funds require a finance refund or credit-note workflow before cancellation.",
      );
    }
    if (order.taxDocuments.some((document) => document.status === "ISSUED")) {
      throw new UnprocessableEntityException(
        "An issued tax document requires a credit-note or return workflow instead of cancellation.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "order-cancel", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    await this.prisma.client.$transaction(async (tx) => {
      const reservations = await tx.b2BInventoryReservation.findMany({
        where: {
          b2bOrderLine: { b2bOrderId: order.id },
          status: B2BInventoryReservationStatus.ACTIVE,
        },
      });
      if (reservations.length) {
        await tx.b2BInventoryReservation.updateMany({
          where: { id: { in: reservations.map((reservation) => reservation.id) } },
          data: {
            status: B2BInventoryReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });
        await tx.inventoryMovement.createMany({
          data: reservations.map((reservation) => ({
            productVariantId: reservation.productVariantId,
            movementType: InventoryMovementType.RELEASE,
            quantity: reservation.quantity,
            reason: `B2B order ${order.orderNumber} cancelled before picking.`,
            referenceType: "B2BOrderLine",
            referenceId: reservation.b2bOrderLineId,
            createdById: actor.id,
          })),
        });
      }
      await tx.b2BFulfilmentPlan.updateMany({
        where: { b2bOrderId: order.id },
        data: { status: B2BFulfilmentStatus.CANCELLED },
      });
      await tx.b2BProcurementOrder.updateMany({
        where: { b2bOrderId: order.id },
        data: { status: B2BProcurementStatus.CANCELLED },
      });
      await tx.b2BProductionJob.updateMany({
        where: { b2bOrderId: order.id },
        data: { status: B2BProductionStatus.CANCELLED },
      });
      await tx.b2BWarehouseTask.updateMany({
        where: { b2bOrderId: order.id },
        data: { status: B2BWarehouseTaskStatus.CANCELLED },
      });
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.CANCELLED,
        actor.id,
        dto.reason,
        { releasedReservationCount: reservations.length },
        {
          settlementStatus: SellerSettlementStatus.NOT_ELIGIBLE,
          settlementEligibleAt: null,
        },
      );
      await this.enqueueOutbox(tx, order.id, "order.cancelled", {
        orderNumber: order.orderNumber,
        reason: dto.reason.trim(),
      });
      await this.recordMutation(tx, actor.id, order.id, "order-cancel", key, dto);
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async cancelLegacyOrder(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    reason: string,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    return this.cancelOrder(
      actor,
      orderNumber,
      idempotencyKey ?? `legacy-cancel:${order.id}:${order.version}`,
      { version: order.version, reason },
    );
  }

  async requestOrderAmendment(
    actor: RequestUser,
    orderNumber: string,
    audience: "BUYER" | "SELLER",
    idempotencyKey: string | undefined,
    dto: CreateB2BOrderAmendmentDto,
  ) {
    const order = await this.getOrder(actor, audience, orderNumber);
    if (audience === "SELLER") {
      await this.assertSellerPermission(
        actor,
        order.sellerId,
        SellerStaffPermission.B2B_SALES,
      );
    }
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.PO_ACCEPTED,
      B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
      B2BOrderStatus.STOCK_READY,
      B2BOrderStatus.ON_HOLD,
      B2BOrderStatus.FULFILMENT_REVIEW_REQUIRED,
    ]);
    if (!dto.lines?.length && !dto.deliveryAddressSnapshot && !dto.paymentDueAt) {
      throw new UnprocessableEntityException(
        "Add a line, delivery-address, or payment-due-date change.",
      );
    }
    const lineIds = new Set(order.lines.map((line) => line.id));
    const requestedLineIds = new Set(dto.lines?.map((line) => line.orderLineId) ?? []);
    if (
      requestedLineIds.size !== (dto.lines?.length ?? 0) ||
      [...requestedLineIds].some((lineId) => !lineIds.has(lineId))
    ) {
      throw new UnprocessableEntityException(
        "Amendment lines must be unique and belong to this B2B order.",
      );
    }
    if (
      order.amendments.some(
        (amendment) => amendment.status === B2BOrderAmendmentStatus.REQUESTED,
      )
    ) {
      throw new ConflictException(
        "Review the existing pending amendment before creating another.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "amendment-request", key)) {
      return this.getOrder(actor, audience, orderNumber);
    }
    await this.prisma.client.$transaction(async (tx) => {
      const amendment = await tx.b2BOrderAmendment.create({
        data: {
          amendmentNumber: this.reference("AM"),
          b2bOrderId: order.id,
          baseOrderVersion: order.version,
          reason: dto.reason.trim(),
          ...(dto.lines?.length
            ? {
                lineChanges: dto.lines as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(dto.deliveryAddressSnapshot
            ? {
                deliveryAddressSnapshot:
                  dto.deliveryAddressSnapshot as Prisma.InputJsonValue,
              }
            : {}),
          paymentDueAt: dto.paymentDueAt ? new Date(dto.paymentDueAt) : null,
          beforeSnapshot: this.orderAmendmentSnapshot(order) as Prisma.InputJsonValue,
          requestedByUserId: actor.id,
        },
      });
      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: order.id,
          actorUserId: actor.id,
          status: order.status,
          note: `Amendment ${amendment.amendmentNumber} requested: ${dto.reason.trim()}`,
          payload: { amendmentId: amendment.id },
        },
      });
      await this.enqueueOutbox(tx, order.id, "order.amendment.requested", {
        orderNumber: order.orderNumber,
        amendmentNumber: amendment.amendmentNumber,
      });
      await this.recordMutation(
        tx,
        actor.id,
        order.id,
        "amendment-request",
        key,
        dto,
      );
    });
    return this.getOrder(actor, audience, orderNumber);
  }

  async decideOrderAmendment(
    actor: RequestUser,
    orderNumber: string,
    amendmentId: string,
    idempotencyKey: string | undefined,
    dto: DecideB2BOrderAmendmentDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    const amendment = order.amendments.find((item) => item.id === amendmentId);
    if (!amendment) throw new NotFoundException("B2B order amendment not found.");
    if (amendment.status !== B2BOrderAmendmentStatus.REQUESTED) {
      throw new ConflictException("This B2B amendment already has a final decision.");
    }
    if (amendment.baseOrderVersion !== order.version) {
      throw new ConflictException(
        "The order changed after this amendment was requested. Reject it and create a fresh amendment.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "amendment-decision", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    if (!dto.approved) {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.b2BOrderAmendment.update({
          where: { id: amendment.id },
          data: {
            status: B2BOrderAmendmentStatus.REJECTED,
            decisionReason: dto.reason.trim(),
            decidedByUserId: actor.id,
            decidedAt: new Date(),
          },
        });
        await this.advanceOrder(
          tx,
          order,
          order.status,
          actor.id,
          `Amendment ${amendment.amendmentNumber} rejected: ${dto.reason.trim()}`,
          { amendmentId: amendment.id },
        );
        await this.recordMutation(
          tx,
          actor.id,
          order.id,
          "amendment-decision",
          key,
          dto,
        );
      });
      return this.getOrder(actor, "ADMIN", orderNumber);
    }

    const lineChanges = this.amendmentLineChanges(amendment.lineChanges);
    const commercialChange = lineChanges.length > 0 || Boolean(amendment.paymentDueAt);
    if (
      commercialChange &&
      (order.paidAmountPaise > 0 ||
        order.paymentRecords.some(
          (payment) =>
            payment.status === B2BPaymentRecordStatus.VERIFIED ||
            payment.status === B2BPaymentRecordStatus.CLEARED,
        ))
    ) {
      throw new UnprocessableEntityException(
        "Commercial amendments require finance reversal before recorded buyer funds exist.",
      );
    }
    if (
      order.taxDocuments.some(
        (document) => document.status === TaxDocumentStatus.ISSUED,
      )
    ) {
      throw new UnprocessableEntityException(
        "Issued tax documents require a credit/debit note or return resolution instead of amendment.",
      );
    }
    if (
      lineChanges.length &&
      (order.lines.some(
        (line) =>
          Boolean(line.fulfilmentPlan?.procurementOrder) ||
          Boolean(line.fulfilmentPlan?.productionJob),
      ) ||
        order.warehouseTasks.length > 0 ||
        order.packages.length > 0 ||
        order.shipments.length > 0)
    ) {
      throw new UnprocessableEntityException(
        "Line amendments are blocked after procurement, production, warehouse, or shipment work begins.",
      );
    }

    const changesByLineId = new Map(
      lineChanges.map((change) => [change.orderLineId, change]),
    );
    const updatedLines = order.lines.map((line) => {
      const change = changesByLineId.get(line.id);
      const quantity = change?.quantity ?? line.quantity;
      const unitPricePaise = change?.unitPricePaise ?? line.unitPricePaise;
      const lineValuePaise = quantity * unitPricePaise;
      return { ...line, quantity, unitPricePaise, lineValuePaise };
    });
    const subtotalPaise = updatedLines.reduce(
      (sum, line) => sum + line.lineValuePaise,
      0,
    );
    const quantity = updatedLines.reduce((sum, line) => sum + line.quantity, 0);
    const commissionAmountPaise = Math.floor(
      (subtotalPaise * order.commissionRateBps) / 10_000,
    );
    const buyerPayableAmountPaise = subtotalPaise + order.transportChargePaise;
    const paymentDueAt = amendment.paymentDueAt ?? order.paymentDueAt;

    await this.prisma.client.$transaction(async (tx) => {
      const reservations = await tx.b2BInventoryReservation.findMany({
        where: {
          b2bOrderLine: { b2bOrderId: order.id },
          status: B2BInventoryReservationStatus.ACTIVE,
        },
      });
      if (reservations.length) {
        await tx.b2BInventoryReservation.updateMany({
          where: { id: { in: reservations.map((item) => item.id) } },
          data: {
            status: B2BInventoryReservationStatus.RELEASED,
            releasedAt: new Date(),
            releaseReason: `Order amendment ${amendment.amendmentNumber}`,
          },
        });
        await tx.inventoryMovement.createMany({
          data: reservations.map((reservation) => ({
            productVariantId: reservation.productVariantId,
            movementType: InventoryMovementType.RELEASE,
            quantity: reservation.quantity,
            reason: `B2B amendment ${amendment.amendmentNumber}.`,
            referenceType: "B2BOrderLine",
            referenceId: reservation.b2bOrderLineId,
            createdById: actor.id,
          })),
        });
      }
      for (const line of updatedLines) {
        await tx.b2BOrderLine.update({
          where: { id: line.id },
          data: {
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            grossValuePaise: line.lineValuePaise,
            lineValuePaise: line.lineValuePaise,
            taxableValuePaise: 0,
            cgstPaise: 0,
            sgstPaise: 0,
            igstPaise: 0,
            cessPaise: 0,
            totalTaxPaise: 0,
          },
        });
        await tx.b2BFulfilmentPlan.updateMany({
          where: { b2bOrderLineId: line.id },
          data: {
            plannedQuantity: line.quantity,
            readyQuantity: 0,
            status: B2BFulfilmentStatus.PENDING,
          },
        });
      }
      if (commercialChange) {
        await tx.b2BPaymentSchedule.deleteMany({
          where: { b2bOrderId: order.id },
        });
        await this.ensurePaymentSchedules(
          tx,
          { id: order.id, buyerPayableAmountPaise, paymentDueAt },
          order.paymentTermType,
        );
      }
      await tx.b2BPoReview.updateMany({
        where: { b2bOrderId: order.id },
        data: {
          status: B2BPoReviewStatus.CHANGES_REQUIRED,
          exceptionCodes: ["ORDER_AMENDMENT"],
          note: dto.reason.trim(),
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      const afterSnapshot = {
        lines: updatedLines.map((line) => ({
          id: line.id,
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
          lineValuePaise: line.lineValuePaise,
        })),
        deliveryAddressSnapshot:
          amendment.deliveryAddressSnapshot ?? order.deliveryAddressSnapshot,
        paymentDueAt: paymentDueAt.toISOString(),
        buyerPayableAmountPaise,
      };
      await tx.b2BOrderAmendment.update({
        where: { id: amendment.id },
        data: {
          status: B2BOrderAmendmentStatus.APPLIED,
          decisionReason: dto.reason.trim(),
          afterSnapshot: afterSnapshot as Prisma.InputJsonValue,
          decidedByUserId: actor.id,
          decidedAt: new Date(),
          appliedAt: new Date(),
        },
      });
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.PO_UNDER_REVIEW,
        actor.id,
        `Amendment ${amendment.amendmentNumber} approved: ${dto.reason.trim()}`,
        { amendmentId: amendment.id },
        {
          quantity,
          unitPricePaise: updatedLines[0]?.unitPricePaise ?? null,
          subtotalPaise,
          commissionAmountPaise,
          sellerPayoutAmountPaise: Math.max(
            0,
            subtotalPaise - commissionAmountPaise,
          ),
          buyerPayableAmountPaise,
          paymentDueAt,
          deliveryAddressSnapshot:
            amendment.deliveryAddressSnapshot ??
            order.deliveryAddressSnapshot ??
            Prisma.JsonNull,
          settlementStatus: SellerSettlementStatus.NOT_ELIGIBLE,
          settlementEligibleAt: null,
        },
      );
      await this.enqueueOutbox(tx, order.id, "order.amended", {
        orderNumber: order.orderNumber,
        amendmentNumber: amendment.amendmentNumber,
      });
      await this.recordMutation(
        tx,
        actor.id,
        order.id,
        "amendment-decision",
        key,
        dto,
      );
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async reviewPurchaseOrder(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: ReviewB2BPoDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.PO_SUBMITTED,
      B2BOrderStatus.PO_UNDER_REVIEW,
      B2BOrderStatus.ON_HOLD,
    ]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "po-review", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }
    const checks = [
      dto.documentMatched,
      dto.priceMatched,
      dto.quantityMatched,
      dto.deliveryTermsMatched,
      dto.stockChecked,
      dto.taxDataChecked,
      dto.creditChecked,
    ];
    if (dto.status === B2BPoReviewStatus.APPROVED && checks.some((value) => !value)) {
      throw new UnprocessableEntityException(
        "All PO verification checks must pass before approval.",
      );
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BPoReview.upsert({
        where: { b2bOrderId: order.id },
        create: {
          b2bOrderId: order.id,
          status: dto.status,
          documentMatched: dto.documentMatched,
          priceMatched: dto.priceMatched,
          quantityMatched: dto.quantityMatched,
          deliveryTermsMatched: dto.deliveryTermsMatched,
          stockChecked: dto.stockChecked,
          taxDataChecked: dto.taxDataChecked,
          creditChecked: dto.creditChecked,
          exceptionCodes: dto.exceptionCodes ?? [],
          note: dto.note?.trim() || null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
        update: {
          status: dto.status,
          documentMatched: dto.documentMatched,
          priceMatched: dto.priceMatched,
          quantityMatched: dto.quantityMatched,
          deliveryTermsMatched: dto.deliveryTermsMatched,
          stockChecked: dto.stockChecked,
          taxDataChecked: dto.taxDataChecked,
          creditChecked: dto.creditChecked,
          exceptionCodes: dto.exceptionCodes ?? [],
          note: dto.note?.trim() || null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      const nextStatus =
        dto.status === B2BPoReviewStatus.APPROVED
          ? B2BOrderStatus.CREDIT_CLEARANCE_PENDING
          : dto.status === B2BPoReviewStatus.REJECTED
            ? B2BOrderStatus.ON_HOLD
            : B2BOrderStatus.PO_UNDER_REVIEW;
      await this.advanceOrder(tx, order, nextStatus, actor.id, dto.note, {
        poReviewStatus: dto.status,
        exceptionCodes: dto.exceptionCodes ?? [],
      }, {
        ...(dto.status === B2BPoReviewStatus.APPROVED
          ? { purchaseOrderAcceptedAt: new Date() }
          : {}),
        ...(dto.paymentTermType ? { paymentTermType: dto.paymentTermType } : {}),
      });
      if (dto.status === B2BPoReviewStatus.APPROVED) {
        await this.ensurePaymentSchedules(
          tx,
          order,
          dto.paymentTermType ?? order.paymentTermType,
        );
      }
      await this.recordMutation(tx, actor.id, order.id, "po-review", key, dto);
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async upsertCreditProfile(
    actor: RequestUser,
    businessBuyerId: string,
    dto: UpsertB2BCreditProfileDto,
  ) {
    this.assertEnabled();
    const exposure = await this.creditExposure(businessBuyerId);
    return this.prisma.client.businessBuyerCreditProfile.upsert({
      where: { businessBuyerId },
      create: {
        businessBuyerId,
        creditLimitPaise: dto.creditLimitPaise,
        currentExposurePaise: exposure,
        allowedTerms: dto.allowedTerms,
        isActive: dto.isActive,
        holdReason: dto.holdReason?.trim() || null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
      update: {
        creditLimitPaise: dto.creditLimitPaise,
        currentExposurePaise: exposure,
        allowedTerms: dto.allowedTerms,
        isActive: dto.isActive,
        holdReason: dto.holdReason?.trim() || null,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });
  }

  async decideCredit(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: DecideB2BCreditDto,
  ) {
    const order = await this.getOrder(actor, "FINANCE", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
      B2BOrderStatus.ON_HOLD,
    ]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "credit-decision", key)) {
      return this.getOrder(actor, "FINANCE", orderNumber);
    }
    const profile = order.businessBuyer.creditProfile;
    const exposure = await this.creditExposure(order.businessBuyerId);
    const available = Math.max(0, (profile?.creditLimitPaise ?? 0) - exposure);
    const netTerm = this.netTermDays(dto.paymentTermType);
    const creditApproved =
      dto.status === B2BCreditDecisionStatus.APPROVED ||
      dto.status === B2BCreditDecisionStatus.OVERRIDDEN;
    const approvedAmount =
      creditApproved
        ? dto.approvedAmountPaise ?? order.buyerPayableAmountPaise
        : 0;
    if (netTerm > 0) {
      if (!profile?.isActive || !profile.allowedTerms.includes(dto.paymentTermType)) {
        throw new UnprocessableEntityException(
          "The buyer is not approved for the selected net payment term.",
        );
      }
      if (dto.status === B2BCreditDecisionStatus.APPROVED && approvedAmount > available) {
        throw new UnprocessableEntityException("The order exceeds the buyer's available credit.");
      }
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BCreditDecision.updateMany({
        where: { b2bOrderId: order.id, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.b2BCreditDecision.create({
        data: {
          b2bOrderId: order.id,
          status: dto.status,
          paymentTermType: dto.paymentTermType,
          requestedAmountPaise: order.buyerPayableAmountPaise,
          approvedAmountPaise: approvedAmount,
          exposureBeforePaise: exposure,
          availableCreditPaise: available,
          dueDays: netTerm,
          reason: dto.note?.trim() || null,
          overrideExpiresAt: dto.overrideExpiresAt ? new Date(dto.overrideExpiresAt) : null,
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      });
      await this.ensurePaymentSchedules(tx, order, dto.paymentTermType);
      const canStart = netTerm > 0 && creditApproved;
      await this.advanceOrder(
        tx,
        order,
        canStart ? B2BOrderStatus.IN_FULFILMENT : B2BOrderStatus.CREDIT_CLEARANCE_PENDING,
        actor.id,
        dto.note,
        { creditDecision: dto.status, availableCreditPaise: available },
        { paymentTermType: dto.paymentTermType },
      );
      await this.recordMutation(tx, actor.id, order.id, "credit-decision", key, dto);
    });
    return this.getOrder(actor, "FINANCE", orderNumber);
  }

  async upsertFulfilmentPlans(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: UpsertB2BFulfilmentPlansDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_WAREHOUSE);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
    ]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "fulfilment-plans", key)) {
      return this.getOrder(actor, "SELLER", orderNumber);
    }
    const linesById = new Map(order.lines.map((line) => [line.id, line]));
    if (
      dto.lines.length !== order.lines.length ||
      dto.lines.some((line) => !linesById.has(line.orderLineId))
    ) {
      throw new UnprocessableEntityException(
        "A fulfilment plan is required for every order line.",
      );
    }
    await this.prisma.client.$transaction(async (tx) => {
      for (const input of dto.lines) {
        const line = linesById.get(input.orderLineId)!;
        if (input.plannedQuantity !== line.quantity) {
          throw new UnprocessableEntityException(
            `Planned quantity must match order quantity for line ${line.lineNumber}.`,
          );
        }
        if (
          line.fulfilmentPlan?.procurementOrder &&
          input.source !== B2BFulfilmentSource.PROCURE
        ) {
          throw new UnprocessableEntityException(
            `Line ${line.lineNumber} must remain procurement-sourced because a procurement order already exists.`,
          );
        }
        if (
          line.fulfilmentPlan?.productionJob &&
          input.source !== B2BFulfilmentSource.PRODUCE
        ) {
          throw new UnprocessableEntityException(
            `Line ${line.lineNumber} must remain production-sourced because a production job already exists.`,
          );
        }
        if (input.source === B2BFulfilmentSource.AVAILABLE_STOCK) {
          if (!line.productVariantId) {
            throw new UnprocessableEntityException(
              `Line ${line.lineNumber} needs a variant before stock can be reserved.`,
            );
          }
          await this.reserveInventory(tx, line.id, line.productVariantId, line.quantity);
        }
        await tx.b2BFulfilmentPlan.upsert({
          where: { b2bOrderLineId: line.id },
          create: {
            b2bOrderId: order.id,
            b2bOrderLineId: line.id,
            source: input.source,
            status:
              input.source === B2BFulfilmentSource.AVAILABLE_STOCK
                ? B2BFulfilmentStatus.READY
                : B2BFulfilmentStatus.PENDING,
            plannedQuantity: input.plannedQuantity,
            readyQuantity:
              input.source === B2BFulfilmentSource.AVAILABLE_STOCK
                ? input.plannedQuantity
                : 0,
            expectedReadyAt: input.expectedReadyAt ? new Date(input.expectedReadyAt) : null,
            note: input.note?.trim() || null,
          },
          update: {
            source: input.source,
            status:
              input.source === B2BFulfilmentSource.AVAILABLE_STOCK
                ? B2BFulfilmentStatus.READY
                : B2BFulfilmentStatus.PENDING,
            plannedQuantity: input.plannedQuantity,
            readyQuantity:
              input.source === B2BFulfilmentSource.AVAILABLE_STOCK
                ? input.plannedQuantity
                : 0,
            expectedReadyAt: input.expectedReadyAt ? new Date(input.expectedReadyAt) : null,
            note: input.note?.trim() || null,
          },
        });
      }
      const sources = new Set(dto.lines.map((line) => line.source));
      const nextStatus =
        sources.size === 1 && sources.has(B2BFulfilmentSource.AVAILABLE_STOCK)
          ? B2BOrderStatus.STOCK_READY
          : B2BOrderStatus.IN_FULFILMENT;
      await this.advanceOrder(tx, order, nextStatus, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "fulfilment-plans", key, dto);
    });
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async createProcurement(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BProcurementDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_PROCUREMENT);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
    ]);
    const plan = order.lines
      .map((line) => line.fulfilmentPlan)
      .find((item) => item?.id === dto.fulfilmentPlanId);
    if (!plan || plan.source !== B2BFulfilmentSource.PROCURE || !order.sellerId) {
      throw new UnprocessableEntityException("A procurement fulfilment plan is required.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.client.b2BProcurementOrder.findUnique({
      where: { fulfilmentPlanId: plan.id },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.client.$transaction(async (tx) => {
      const procurement = await tx.b2BProcurementOrder.create({
        data: {
          procurementNumber: this.reference("PR"),
          b2bOrderId: order.id,
          fulfilmentPlanId: plan.id,
          sellerId: order.sellerId!,
          supplierName: dto.supplierName?.trim() || null,
          supplierReference: dto.supplierReference?.trim() || null,
          orderedQuantity: plan.plannedQuantity,
          status: B2BProcurementStatus.ORDERED,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          orderedAt: new Date(),
          note: dto.note?.trim() || null,
        },
      });
      await this.bumpVersion(tx, order, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "procurement-create", key, dto);
      return procurement;
    });
  }

  async updateProcurement(
    actor: RequestUser,
    orderNumber: string,
    procurementId: string,
    idempotencyKey: string | undefined,
    dto: UpdateB2BProcurementDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_PROCUREMENT);
    this.assertVersion(order.version, dto.version);
    const procurement = await this.prisma.client.b2BProcurementOrder.findFirst({
      where: {
        id: procurementId,
        b2bOrderId: order.id,
        ...(order.sellerId ? { sellerId: order.sellerId } : {}),
      },
    });
    if (!procurement) throw new NotFoundException("Procurement order not found.");
    if (dto.receivedQuantity + (dto.rejectedQuantity ?? 0) > procurement.orderedQuantity) {
      throw new UnprocessableEntityException("Received and rejected quantities exceed the order.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BProcurementOrder.update({
        where: { id: procurement.id },
        data: {
          status: dto.status,
          receivedQuantity: dto.receivedQuantity,
          rejectedQuantity: dto.rejectedQuantity ?? procurement.rejectedQuantity,
          receivedAt:
            dto.status === B2BProcurementStatus.RECEIVED ? procurement.receivedAt ?? new Date() : null,
          note: dto.note?.trim() || procurement.note,
        },
      });
      await tx.b2BFulfilmentPlan.update({
        where: { id: procurement.fulfilmentPlanId },
        data: {
          readyQuantity: dto.receivedQuantity,
          status:
            dto.status === B2BProcurementStatus.RECEIVED
              ? B2BFulfilmentStatus.READY
              : B2BFulfilmentStatus.IN_PROGRESS,
        },
      });
      await this.refreshStockReadyState(tx, order, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "procurement-update", key, dto);
    });
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async createProduction(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BProductionDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_PRODUCTION);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.IN_FULFILMENT,
      B2BOrderStatus.PROCUREMENT_IN_PROGRESS,
      B2BOrderStatus.PRODUCTION_IN_PROGRESS,
    ]);
    const plan = order.lines
      .map((line) => line.fulfilmentPlan)
      .find((item) => item?.id === dto.fulfilmentPlanId);
    if (!plan || plan.source !== B2BFulfilmentSource.PRODUCE || !order.sellerId) {
      throw new UnprocessableEntityException("A production fulfilment plan is required.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.client.b2BProductionJob.findUnique({
      where: { fulfilmentPlanId: plan.id },
    });
    if (existing) return existing;
    return this.prisma.client.$transaction(async (tx) => {
      const job = await tx.b2BProductionJob.create({
        data: {
          productionNumber: this.reference("PJ"),
          b2bOrderId: order.id,
          fulfilmentPlanId: plan.id,
          sellerId: order.sellerId!,
          plannedQuantity: plan.plannedQuantity,
          status: B2BProductionStatus.PLANNED,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          materialNotes: dto.materialNotes?.trim() || null,
          note: dto.note?.trim() || null,
        },
      });
      await this.bumpVersion(tx, order, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "production-create", key, dto);
      return job;
    });
  }

  async updateProduction(
    actor: RequestUser,
    orderNumber: string,
    productionId: string,
    idempotencyKey: string | undefined,
    dto: UpdateB2BProductionDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_PRODUCTION);
    this.assertVersion(order.version, dto.version);
    const job = await this.prisma.client.b2BProductionJob.findFirst({
      where: {
        id: productionId,
        b2bOrderId: order.id,
        ...(order.sellerId ? { sellerId: order.sellerId } : {}),
      },
    });
    if (!job) throw new NotFoundException("Production job not found.");
    if (dto.completedQuantity + (dto.rejectedQuantity ?? 0) > job.plannedQuantity) {
      throw new UnprocessableEntityException("Completed and rejected quantities exceed the plan.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BProductionJob.update({
        where: { id: job.id },
        data: {
          status: dto.status,
          completedQuantity: dto.completedQuantity,
          rejectedQuantity: dto.rejectedQuantity ?? job.rejectedQuantity,
          startedAt:
            dto.status === B2BProductionStatus.IN_PROGRESS ? job.startedAt ?? new Date() : job.startedAt,
          completedAt:
            dto.status === B2BProductionStatus.COMPLETED ? job.completedAt ?? new Date() : null,
          note: dto.note?.trim() || job.note,
        },
      });
      await tx.b2BFulfilmentPlan.update({
        where: { id: job.fulfilmentPlanId },
        data: {
          readyQuantity: dto.completedQuantity,
          status:
            dto.status === B2BProductionStatus.COMPLETED
              ? B2BFulfilmentStatus.READY
              : B2BFulfilmentStatus.IN_PROGRESS,
        },
      });
      await this.refreshStockReadyState(tx, order, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "production-update", key, dto);
    });
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async createWarehouseTask(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BWarehouseTaskDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_WAREHOUSE);
    this.assertVersion(order.version, dto.version);
    const expected =
      dto.taskType === B2BWarehouseTaskType.PICK
        ? [B2BOrderStatus.STOCK_READY, B2BOrderStatus.PICKING]
        : [B2BOrderStatus.PICKING, B2BOrderStatus.PACKING];
    this.requireStatus(order.status, expected);
    if (!order.sellerId) throw new UnprocessableEntityException("Order seller is required.");
    const key = this.requireIdempotencyKey(idempotencyKey);
    return this.prisma.client.$transaction(async (tx) => {
      const task = await tx.b2BWarehouseTask.create({
        data: {
          taskNumber: this.reference(dto.taskType === B2BWarehouseTaskType.PICK ? "PK" : "PA"),
          b2bOrderId: order.id,
          sellerId: order.sellerId!,
          taskType: dto.taskType,
          assignedToUserId: actor.id,
          status: B2BWarehouseTaskStatus.IN_PROGRESS,
          startedAt: new Date(),
          note: dto.note?.trim() || null,
          items: {
            create: order.lines.map((line) => ({
              b2bOrderLineId: line.id,
              requestedQuantity: line.quantity,
            })),
          },
        },
        include: { items: true },
      });
      await this.advanceOrder(
        tx,
        order,
        dto.taskType === B2BWarehouseTaskType.PICK
          ? B2BOrderStatus.PICKING
          : B2BOrderStatus.PACKING,
        actor.id,
        dto.note,
      );
      await this.recordMutation(tx, actor.id, order.id, "warehouse-create", key, dto);
      return task;
    });
  }

  async completeWarehouseTask(
    actor: RequestUser,
    orderNumber: string,
    taskId: string,
    idempotencyKey: string | undefined,
    dto: CompleteB2BWarehouseTaskDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_WAREHOUSE);
    this.assertVersion(order.version, dto.version);
    const task = order.warehouseTasks.find((item) => item.id === taskId);
    if (!task) throw new NotFoundException("Warehouse task not found.");
    const results = new Map(dto.items.map((item) => [item.orderLineId, item]));
    if (
      task.items.some(
        (item) =>
          !results.has(item.b2bOrderLineId) ||
          results.get(item.b2bOrderLineId)!.completedQuantity > item.requestedQuantity,
      )
    ) {
      throw new UnprocessableEntityException("Warehouse completion quantities are invalid.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      for (const item of task.items) {
        const result = results.get(item.b2bOrderLineId)!;
        await tx.b2BWarehouseTaskItem.update({
          where: { id: item.id },
          data: {
            completedQuantity: result.completedQuantity,
            exceptionNote: result.exceptionNote?.trim() || null,
          },
        });
        if (
          task.taskType === B2BWarehouseTaskType.PICK &&
          dto.status === B2BWarehouseTaskStatus.COMPLETED
        ) {
          await this.consumeReservation(tx, item.b2bOrderLineId, result.completedQuantity, actor.id);
        }
      }
      await tx.b2BWarehouseTask.update({
        where: { id: task.id },
        data: {
          status: dto.status,
          completedAt:
            dto.status === B2BWarehouseTaskStatus.COMPLETED ? new Date() : task.completedAt,
          note: dto.note?.trim() || task.note,
        },
      });
      const nextStatus =
        dto.status !== B2BWarehouseTaskStatus.COMPLETED
          ? order.status
          : task.taskType === B2BWarehouseTaskType.PICK
            ? B2BOrderStatus.PACKING
            : B2BOrderStatus.QC_PENDING;
      await this.advanceOrder(tx, order, nextStatus, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "warehouse-complete", key, dto);
    });
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async createPackage(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BPackageDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_WAREHOUSE);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [B2BOrderStatus.PACKING, B2BOrderStatus.QC_PENDING]);
    if (!order.sellerId) throw new UnprocessableEntityException("Order seller is required.");
    const lineIds = new Set(order.lines.map((line) => line.id));
    if (Object.keys(dto.itemAllocations).some((lineId) => !lineIds.has(lineId))) {
      throw new UnprocessableEntityException("Package allocations contain an unknown order line.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    return this.prisma.client.$transaction(async (tx) => {
      const sequence = order.packages.length + 1;
      const itemAllocations = dto.itemAllocations as Prisma.InputJsonValue;
      const packageRecord = await tx.b2BPackage.create({
        data: {
          packageNumber: this.reference("BX"),
          b2bOrderId: order.id,
          sellerId: order.sellerId!,
          sequence,
          weightGrams: dto.weightGrams ?? null,
          lengthCm: dto.lengthCm ?? null,
          breadthCm: dto.breadthCm ?? null,
          heightCm: dto.heightCm ?? null,
          declaredValuePaise: order.buyerPayableAmountPaise,
          itemAllocations,
          sealedAt: new Date(),
        },
      });
      await this.advanceOrder(tx, order, B2BOrderStatus.QC_PENDING, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "package-create", key, dto);
      return packageRecord;
    });
  }

  async recordQc(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: RecordB2BQcDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_WAREHOUSE);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [B2BOrderStatus.QC_PENDING, B2BOrderStatus.PACKING]);
    if (!order.packages.length) {
      throw new UnprocessableEntityException("Create and seal at least one package before QC.");
    }
    if (dto.packageId && !order.packages.some((item) => item.id === dto.packageId)) {
      throw new NotFoundException("Package not found for this order.");
    }
    if (dto.status === B2BQcStatus.FAILED && !dto.failureReason?.trim()) {
      throw new UnprocessableEntityException("A QC failure reason is required.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BQcInspection.create({
        data: {
          b2bOrderId: order.id,
          packageId: dto.packageId ?? null,
          status: dto.status,
          checklistSnapshot: dto.checklist as Prisma.InputJsonValue,
          evidenceFileKeys: (dto.evidenceFileKeys ?? []) as Prisma.InputJsonValue,
          failureReason: dto.failureReason?.trim() || null,
          inspectedById: actor.id,
          inspectedAt: new Date(),
          closedAt: dto.status === B2BQcStatus.PENDING ? null : new Date(),
        },
      });
      await this.advanceOrder(
        tx,
        order,
        dto.status === B2BQcStatus.PASSED
          ? B2BOrderStatus.PACKED_AND_QC_PASSED
          : B2BOrderStatus.ON_HOLD,
        actor.id,
        dto.failureReason ?? dto.note,
      );
      await this.recordMutation(tx, actor.id, order.id, "qc-record", key, dto);
    });
    if (dto.status === B2BQcStatus.PASSED) {
      try {
        await this.issueFinalInvoice(
          actor,
          orderNumber,
          `${key}:automatic-invoice`,
          dto.version + 1,
        );
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        await this.prisma.client.b2BOrderEvent.create({
          data: {
            b2bOrderId: order.id,
            actorUserId: actor.id,
            status: B2BOrderStatus.PACKED_AND_QC_PASSED,
            note: `Automatic invoice issue is pending: ${error.message}`,
          },
        });
      }
    }
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async issueFinalInvoice(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    version: number,
  ) {
    const order = await this.getOrder(actor, actor.roles.includes(RoleCode.SELLER) ? "SELLER" : "ADMIN", orderNumber);
    if (actor.roles.includes(RoleCode.SELLER)) {
      await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_SALES);
    }
    this.assertVersion(order.version, version);
    this.requireStatus(order.status, [
      B2BOrderStatus.PACKED_AND_QC_PASSED,
      B2BOrderStatus.TAX_INVOICE_ISSUED,
    ]);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const document = await this.taxDocuments.issueB2bDocument(order.id, actor.id);
    const threshold = await this.eWayThresholdPaise();
    const eInvoiceRequired =
      document.documentType === TaxDocumentType.TAX_INVOICE &&
      Boolean(document.sellerGstin && document.buyerGstin);
    const eWayRequired = document.invoiceValuePaise >= threshold;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.taxDocumentCompliance.upsert({
        where: { taxDocumentId: document.id },
        create: {
          taxDocumentId: document.id,
          eInvoiceStatus: eInvoiceRequired
            ? GstComplianceStatus.READY
            : GstComplianceStatus.NOT_REQUIRED,
          eWayBillStatus: eWayRequired
            ? GstComplianceStatus.READY
            : GstComplianceStatus.NOT_REQUIRED,
        },
        update: {},
      });
      const outstanding = Math.max(0, document.invoiceValuePaise - order.paidAmountPaise);
      const dueAt = this.invoiceDueAt(order.paymentTermType, document.issueDate ?? new Date());
      const receivable = await tx.b2BReceivable.upsert({
        where: { b2bOrderId: order.id },
        create: {
          b2bOrderId: order.id,
          taxDocumentId: document.id,
          originalAmountPaise: document.invoiceValuePaise,
          outstandingAmountPaise: outstanding,
          dueAt,
          status: outstanding === 0 ? B2BReceivableStatus.PAID : B2BReceivableStatus.OPEN,
          closedAt: outstanding === 0 ? new Date() : null,
        },
        update: {
          taxDocumentId: document.id,
          originalAmountPaise: document.invoiceValuePaise,
          outstandingAmountPaise: outstanding,
          dueAt,
          status: outstanding === 0 ? B2BReceivableStatus.PAID : B2BReceivableStatus.OPEN,
          closedAt: outstanding === 0 ? new Date() : null,
        },
      });
      const hasOpeningEntry = await tx.b2BReceivableEntry.findFirst({
        where: { receivableId: receivable.id, entryType: "INVOICE" },
      });
      if (!hasOpeningEntry) {
        await tx.b2BReceivableEntry.create({
          data: {
            receivableId: receivable.id,
            entryType: "INVOICE",
            description: `Invoice ${document.documentNumber ?? order.orderNumber}`,
            debitPaise: document.invoiceValuePaise,
            balanceAfterPaise: outstanding,
            referenceType: "TaxDocument",
            referenceId: document.id,
          },
        });
      }
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.TAX_INVOICE_ISSUED,
        actor.id,
        "Final invoice issued after QC pass.",
        { taxDocumentId: document.id, documentNumber: document.documentNumber },
        {
          taxInvoiceNumber: document.documentNumber,
          taxInvoiceIssuedAt: document.issueDate ?? new Date(),
        },
      );
      await this.enqueueOutbox(tx, order.id, "invoice.issued", {
        orderNumber: order.orderNumber,
        taxDocumentId: document.id,
        documentNumber: document.documentNumber,
      });
      await this.recordMutation(tx, actor.id, order.id, "invoice-issue", key, {
        version,
      });
    });
    return this.getOrder(actor, actor.roles.includes(RoleCode.SELLER) ? "SELLER" : "ADMIN", orderNumber);
  }

  async createShipment(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BShipmentDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_DISPATCH);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.TAX_INVOICE_ISSUED,
      B2BOrderStatus.E_WAY_READY,
      B2BOrderStatus.E_WAY_NOT_REQUIRED,
    ]);
    if (!order.sellerId) throw new UnprocessableEntityException("Order seller is required.");
    const packageIds = dto.packageIds ?? order.packages.map((item) => item.id);
    if (
      !packageIds.length ||
      packageIds.some((id) => !order.packages.some((item) => item.id === id))
    ) {
      throw new UnprocessableEntityException("Shipment packages must belong to this order.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    return this.prisma.client.$transaction(async (tx) => {
      const shipment = await tx.b2BShipment.create({
        data: {
          shipmentNumber: this.reference("SH"),
          b2bOrderId: order.id,
          sellerId: order.sellerId!,
          assignedDeliveryUserId: dto.assignedDeliveryUserId ?? null,
          status: B2BShipmentStatus.READY,
          transporterName: dto.transporterName?.trim() || null,
          transporterGstin: dto.transporterGstin?.trim().toUpperCase() || null,
          lrNumber: dto.lrNumber?.trim() || null,
          awbNumber: dto.awbNumber?.trim() || null,
          vehicleNumber: dto.vehicleNumber?.trim().toUpperCase() || null,
          deliveryAddressSnapshot:
            (order.deliveryAddressSnapshot ??
              dto.deliveryAddressSnapshot) as Prisma.InputJsonValue,
          packages: { connect: packageIds.map((id) => ({ id })) },
        },
      });
      await this.bumpVersion(tx, order, actor.id, dto.note);
      await this.recordMutation(tx, actor.id, order.id, "shipment-create", key, dto);
      return shipment;
    });
  }

  async dispatchShipment(
    actor: RequestUser,
    orderNumber: string,
    shipmentId: string,
    idempotencyKey: string | undefined,
    dto: DispatchB2BShipmentDto,
  ) {
    const order = await this.getOrder(actor, "SELLER", orderNumber);
    await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_DISPATCH);
    this.assertVersion(order.version, dto.version);
    const shipment = order.shipments.find((item) => item.id === shipmentId);
    if (!shipment) throw new NotFoundException("Shipment not found.");
    const document = order.taxDocuments.find((item) => item.status === "ISSUED");
    if (!document?.compliance) {
      throw new UnprocessableEntityException(
        "GST/e-invoice/e-way applicability must be explicitly recorded before dispatch.",
      );
    }
    const eInvoiceReady =
      document.compliance.eInvoiceStatus === GstComplianceStatus.NOT_REQUIRED ||
      (document.compliance.eInvoiceStatus === GstComplianceStatus.GENERATED &&
        Boolean(
          document.compliance.irn &&
            document.compliance.acknowledgementNumber &&
            document.compliance.acknowledgementDate &&
            document.compliance.signedQrCode,
        ));
    const eWayReady =
      document.compliance.eWayBillStatus === GstComplianceStatus.NOT_REQUIRED ||
      (document.compliance.eWayBillStatus === GstComplianceStatus.GENERATED &&
        Boolean(document.compliance.eWayBillNumber));
    if (!eInvoiceReady || !eWayReady) {
      throw new UnprocessableEntityException(
        "Dispatch is blocked until required IRN/QR and e-way bill results are recorded.",
      );
    }
    const unclearedDispatchSchedules = order.paymentSchedules.filter(
      (schedule) =>
        schedule.dispatchGate &&
        schedule.status !== B2BPaymentScheduleStatus.PAID &&
        schedule.status !== B2BPaymentScheduleStatus.WAIVED,
    );
    if (unclearedDispatchSchedules.length) {
      throw new UnprocessableEntityException(
        "Dispatch is blocked until all required payment milestones are cleared.",
      );
    }
    const transporterName = dto.transporterName?.trim() || shipment.transporterName;
    const transportReference =
      dto.lrNumber?.trim() || dto.awbNumber?.trim() || shipment.lrNumber || shipment.awbNumber;
    if (!transporterName || !transportReference) {
      throw new UnprocessableEntityException(
        "Transporter name and LR/AWB reference are required before dispatch.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      await tx.b2BShipment.update({
        where: { id: shipment.id },
        data: {
          status: B2BShipmentStatus.DISPATCHED,
          transporterName,
          lrNumber: dto.lrNumber?.trim() || shipment.lrNumber,
          awbNumber: dto.awbNumber?.trim() || shipment.awbNumber,
          vehicleNumber: dto.vehicleNumber?.trim().toUpperCase() || shipment.vehicleNumber,
          dispatchedAt: shipment.dispatchedAt ?? now,
        },
      });
      await tx.b2BShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: B2BShipmentStatus.DISPATCHED,
          note: dto.note?.trim() || "Shipment dispatched.",
          createdByUserId: actor.id,
        },
      });
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.DISPATCHED,
        actor.id,
        dto.note,
        { shipmentId: shipment.id },
        {
          transportStatus: "DISPATCHED",
          transportDispatchedAt: now,
          transportPartnerName: transporterName,
          transportTrackingRef: transportReference,
        },
      );
      await this.enqueueOutbox(tx, order.id, "shipment.dispatched", {
        orderNumber: order.orderNumber,
        shipmentNumber: shipment.shipmentNumber,
      });
      await this.recordMutation(tx, actor.id, order.id, "shipment-dispatch", key, dto);
    });
    return this.getOrder(actor, "SELLER", orderNumber);
  }

  async recordShipmentEvent(
    actor: RequestUser,
    shipmentId: string,
    dto: UpdateB2BShipmentEventDto,
  ) {
    this.assertEnabled();
    const shipment = await this.prisma.client.b2BShipment.findFirst({
      where: {
        id: shipmentId,
        assignedDeliveryUserId: actor.id,
      },
      include: { order: true },
    });
    if (!shipment) throw new ForbiddenException("Assigned B2B shipment not found.");
    if (dto.status === B2BShipmentStatus.DELIVERED) {
      throw new UnprocessableEntityException("Record POD to complete B2B delivery.");
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.b2BShipment.update({ where: { id: shipment.id }, data: { status: dto.status } });
      await tx.b2BShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: dto.status,
          location: dto.location?.trim() || null,
          note: dto.note?.trim() || null,
          createdByUserId: actor.id,
        },
      });
      if (dto.status === B2BShipmentStatus.IN_TRANSIT) {
        await this.advanceOrder(
          tx,
          shipment.order,
          B2BOrderStatus.IN_TRANSIT,
          actor.id,
          dto.note,
        );
      }
    });
    return this.assignedShipment(actor, shipmentId);
  }

  async recordPod(actor: RequestUser, shipmentId: string, dto: RecordB2BPodDto) {
    const shipment = await this.prisma.client.b2BShipment.findFirst({
      where: { id: shipmentId, assignedDeliveryUserId: actor.id },
      include: { order: true, proofOfDelivery: true },
    });
    if (!shipment) throw new ForbiddenException("Assigned B2B shipment not found.");
    if (shipment.proofOfDelivery) return shipment.proofOfDelivery;
    const deliveredAt = new Date(dto.deliveredAt);
    const acceptanceDays = this.positiveInt(process.env.B2B_POD_ACCEPTANCE_DAYS, 3);
    return this.prisma.client.$transaction(async (tx) => {
      const pod = await tx.b2BProofOfDelivery.create({
        data: {
          shipmentId: shipment.id,
          receiverName: dto.receiverName.trim(),
          receiverPhone: dto.receiverPhone?.trim() || null,
          deliveredAt,
          proofFileKeys: dto.proofFileKeys as Prisma.InputJsonValue,
          signatureFileKey: dto.signatureFileKey?.trim() || null,
          note: dto.note?.trim() || null,
          createdByUserId: actor.id,
        },
      });
      await tx.b2BShipment.update({
        where: { id: shipment.id },
        data: {
          status: B2BShipmentStatus.DELIVERED,
          deliveredAt,
          acceptanceStatus: B2BDeliveryAcceptanceStatus.PENDING,
          acceptanceDueAt: new Date(deliveredAt.getTime() + acceptanceDays * 86_400_000),
        },
      });
      await tx.b2BShipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: B2BShipmentStatus.DELIVERED,
          note: dto.note?.trim() || `Delivered to ${dto.receiverName.trim()}.`,
          createdByUserId: actor.id,
        },
      });
      await this.advanceOrder(
        tx,
        shipment.order,
        B2BOrderStatus.DELIVERED,
        actor.id,
        dto.note,
        { shipmentId: shipment.id, podId: pod.id },
        { transportStatus: "DELIVERED", transportDeliveredAt: deliveredAt },
      );
      await this.enqueueOutbox(tx, shipment.order.id, "shipment.delivered", {
        orderNumber: shipment.order.orderNumber,
        shipmentNumber: shipment.shipmentNumber,
        podId: pod.id,
      });
      return pod;
    });
  }

  async assignedShipments(actor: RequestUser, query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const where: Prisma.B2BShipmentWhereInput = {
      assignedDeliveryUserId: actor.id,
      ...(query.status && Object.values(B2BShipmentStatus).includes(query.status as B2BShipmentStatus)
        ? { status: query.status as B2BShipmentStatus }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BShipment.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, businessBuyer: { select: { companyName: true } } } },
          packages: true,
          events: { orderBy: { createdAt: "desc" } },
          proofOfDelivery: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BShipment.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async assignedShipment(actor: RequestUser, shipmentId: string) {
    const shipment = await this.prisma.client.b2BShipment.findFirst({
      where: { id: shipmentId, assignedDeliveryUserId: actor.id },
      include: {
        order: {
          include: {
            businessBuyer: true,
            lines: true,
          },
        },
        packages: true,
        events: { orderBy: { createdAt: "desc" } },
        proofOfDelivery: true,
      },
    });
    if (!shipment) throw new ForbiddenException("Assigned B2B shipment not found.");
    return shipment;
  }

  async acceptDelivery(
    actor: RequestUser,
    orderNumber: string,
    shipmentId: string,
    idempotencyKey: string | undefined,
    dto: DecideB2BDeliveryDto,
    disputed: boolean,
  ) {
    const order = await this.getOrder(actor, "BUYER", orderNumber);
    this.assertVersion(order.version, dto.version);
    this.requireStatus(order.status, [
      B2BOrderStatus.DELIVERED,
      B2BOrderStatus.DELIVERY_DISPUTED,
    ]);
    const shipment = order.shipments.find((item) => item.id === shipmentId);
    if (!shipment?.proofOfDelivery) {
      throw new UnprocessableEntityException("POD is required before buyer acceptance.");
    }
    if (disputed && !dto.disputeReason?.trim()) {
      throw new UnprocessableEntityException("A delivery dispute reason is required.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      await tx.b2BShipment.update({
        where: { id: shipment.id },
        data: {
          acceptanceStatus: disputed
            ? B2BDeliveryAcceptanceStatus.DISPUTED
            : B2BDeliveryAcceptanceStatus.ACCEPTED,
          acceptedAt: disputed ? null : now,
          disputeReason: disputed ? dto.disputeReason!.trim() : null,
        },
      });
      if (disputed) {
        const existingCase = await tx.b2BSupportCase.findFirst({
          where: {
            b2bOrderId: order.id,
            shipmentId: shipment.id,
            status: {
              in: [
                B2BSupportCaseStatus.OPEN,
                B2BSupportCaseStatus.IN_REVIEW,
                B2BSupportCaseStatus.WAITING_FOR_BUYER,
                B2BSupportCaseStatus.WAITING_FOR_SELLER,
              ],
            },
          },
        });
        if (!existingCase) {
          await tx.b2BSupportCase.create({
            data: {
              caseNumber: this.reference("CS"),
              b2bOrderId: order.id,
              shipmentId: shipment.id,
              receivableId: order.receivable?.id ?? null,
              caseType: B2BSupportCaseType.DELIVERY,
              subject: `Delivery dispute for ${shipment.shipmentNumber}`,
              description: dto.disputeReason!.trim(),
              evidenceFileKeys: [],
              createdByUserId: actor.id,
            },
          });
        }
        if (order.receivable) {
          await tx.b2BReceivable.update({
            where: { id: order.receivable.id },
            data: {
              status: B2BReceivableStatus.DISPUTED,
              disputedAt: now,
              closedAt: null,
            },
          });
        }
        await this.advanceOrder(
          tx,
          order,
          B2BOrderStatus.DELIVERY_DISPUTED,
          actor.id,
          dto.disputeReason,
          { shipmentId: shipment.id },
          {
            settlementStatus: SellerSettlementStatus.NOT_ELIGIBLE,
            settlementEligibleAt: null,
          },
        );
      } else {
        const pendingShipments = await tx.b2BShipment.count({
          where: {
            b2bOrderId: order.id,
            id: { not: shipment.id },
            acceptanceStatus: {
              in: [
                B2BDeliveryAcceptanceStatus.PENDING,
                B2BDeliveryAcceptanceStatus.DISPUTED,
              ],
            },
          },
        });
        const allAccepted = pendingShipments === 0;
        const canClose = allAccepted && order.paymentStatus === B2BPaymentStatus.PAID;
        await this.advanceOrder(
          tx,
          order,
          canClose
            ? B2BOrderStatus.CLOSED
            : allAccepted
              ? B2BOrderStatus.DELIVERY_ACCEPTED
              : order.status,
          actor.id,
          dto.note || `Delivery accepted for shipment ${shipment.shipmentNumber}.`,
          { shipmentId: shipment.id, allShipmentsAccepted: allAccepted },
          canClose
            ? {
                settlementStatus: SellerSettlementStatus.ELIGIBLE,
                settlementEligibleAt: now,
              }
            : {},
        );
        if (canClose) {
          await this.enqueueOutbox(tx, order.id, "order.closed", {
            orderNumber: order.orderNumber,
            reason: "Delivery accepted and buyer payment cleared.",
          });
        }
      }
      await this.recordMutation(
        tx,
        actor.id,
        order.id,
        disputed ? "delivery-dispute" : "delivery-accept",
        key,
        dto,
      );
    });
    return this.getOrder(actor, "BUYER", orderNumber);
  }

  async listReceivables(actor: RequestUser, query: B2BReceivableQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const search = query.search?.trim();
    const where: Prisma.B2BReceivableWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.buyerId ? { order: { businessBuyerId: query.buyerId } } : {}),
      ...(query.sellerId ? { order: { sellerId: query.sellerId } } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueAt: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            order: {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BReceivable.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              seller: { select: { storeName: true } },
              businessBuyer: { select: { companyName: true } },
            },
          },
          collectionTasks: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BReceivable.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async reconcileFinances(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: ReconcileB2BFinanceDto,
  ) {
    const order = await this.getOrder(actor, "FINANCE", orderNumber);
    this.assertVersion(order.version, dto.version);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "finance-reconciliation", key)) {
      return this.getOrder(actor, "FINANCE", orderNumber);
    }
    const [allocations, refunds] = await Promise.all([
      this.prisma.client.b2BPaymentAllocation.findMany({
        where: { paymentRecord: { b2bOrderId: order.id } },
        select: { amountPaise: true },
      }),
      this.prisma.client.b2BPaymentProof.findMany({
        where: {
          b2bOrderId: order.id,
          status: B2BProofStatus.VERIFIED,
          amountPaise: { lt: 0 },
        },
        select: { amountPaise: true },
      }),
    ]);
    const allocatedAmountPaise = allocations.reduce(
      (sum, allocation) => sum + allocation.amountPaise,
      0,
    );
    const refundedAmountPaise = Math.abs(
      refunds.reduce((sum, refund) => sum + refund.amountPaise, 0),
    );
    const expectedPaidAmountPaise = Math.max(
      0,
      Math.min(
        order.buyerPayableAmountPaise,
        allocatedAmountPaise - refundedAmountPaise,
      ),
    );
    const adjustmentPaise =
      order.receivable?.entries
        .filter((entry) =>
          ["DISPUTE_ADJUSTMENT", "CREDIT_NOTE", "WRITE_OFF"].includes(
            entry.entryType,
          ),
        )
        .reduce(
          (sum, entry) => sum + entry.creditPaise - entry.debitPaise,
          0,
        ) ?? 0;
    const expectedOutstandingPaise = order.receivable
      ? Math.max(
          0,
          order.receivable.originalAmountPaise -
            expectedPaidAmountPaise -
            adjustmentPaise,
        )
      : 0;
    const scheduleTargets = new Map<string, number>();
    let remainingPaid = expectedPaidAmountPaise;
    for (const schedule of order.paymentSchedules) {
      const paid = Math.min(schedule.amountPaise, remainingPaid);
      scheduleTargets.set(schedule.id, paid);
      remainingPaid -= paid;
    }
    const scheduleMismatches = order.paymentSchedules
      .filter(
        (schedule) =>
          schedule.paidAmountPaise !== (scheduleTargets.get(schedule.id) ?? 0),
      )
      .map((schedule) => ({
        scheduleId: schedule.id,
        actual: schedule.paidAmountPaise,
        expected: scheduleTargets.get(schedule.id) ?? 0,
      }));
    const discrepancy = {
      paidAmountPaise: {
        actual: order.paidAmountPaise,
        expected: expectedPaidAmountPaise,
      },
      outstandingAmountPaise: {
        actual: order.receivable?.outstandingAmountPaise ?? null,
        expected: expectedOutstandingPaise,
      },
      schedules: scheduleMismatches,
    };
    const hasMismatch =
      order.paidAmountPaise !== expectedPaidAmountPaise ||
      (order.receivable?.outstandingAmountPaise ?? 0) !==
        expectedOutstandingPaise ||
      scheduleMismatches.length > 0;

    await this.prisma.client.$transaction(async (tx) => {
      if (dto.correct && hasMismatch) {
        for (const schedule of order.paymentSchedules) {
          const paidAmountPaise = scheduleTargets.get(schedule.id) ?? 0;
          await tx.b2BPaymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmountPaise,
              status:
                paidAmountPaise >= schedule.amountPaise
                  ? B2BPaymentScheduleStatus.PAID
                  : paidAmountPaise > 0
                    ? B2BPaymentScheduleStatus.PARTIALLY_PAID
                    : B2BPaymentScheduleStatus.PENDING,
            },
          });
        }
        if (order.receivable) {
          await tx.b2BReceivable.update({
            where: { id: order.receivable.id },
            data: {
              outstandingAmountPaise: expectedOutstandingPaise,
              status:
                expectedOutstandingPaise === 0
                  ? B2BReceivableStatus.PAID
                  : expectedPaidAmountPaise > 0
                    ? B2BReceivableStatus.PARTIALLY_PAID
                    : B2BReceivableStatus.OPEN,
              closedAt:
                expectedOutstandingPaise === 0 ? new Date() : null,
            },
          });
        }
        const paymentStatus =
          expectedPaidAmountPaise >= order.buyerPayableAmountPaise
            ? B2BPaymentStatus.PAID
            : expectedPaidAmountPaise > 0
              ? B2BPaymentStatus.PARTIALLY_PAID
              : B2BPaymentStatus.PENDING;
        const closesOrder =
          order.status === B2BOrderStatus.DELIVERY_ACCEPTED &&
          paymentStatus === B2BPaymentStatus.PAID &&
          expectedOutstandingPaise === 0;
        await this.advanceOrder(
          tx,
          order,
          closesOrder ? B2BOrderStatus.CLOSED : order.status,
          actor.id,
          dto.note || "B2B financial balances reconciled from immutable records.",
          { discrepancy },
          {
            paidAmountPaise: expectedPaidAmountPaise,
            paymentStatus,
            paidAt: paymentStatus === B2BPaymentStatus.PAID ? new Date() : null,
            settlementStatus: closesOrder
              ? SellerSettlementStatus.ELIGIBLE
              : order.settlementStatus,
            settlementEligibleAt: closesOrder
              ? new Date()
              : order.settlementEligibleAt,
          },
        );
      }
      await tx.b2BFinancialReconciliation.create({
        data: {
          reconciliationNumber: this.reference("RC"),
          b2bOrderId: order.id,
          status: !hasMismatch
            ? B2BFinancialReconciliationStatus.MATCHED
            : dto.correct
              ? B2BFinancialReconciliationStatus.CORRECTED
              : B2BFinancialReconciliationStatus.EXCEPTION,
          expectedPaidAmountPaise,
          actualPaidAmountPaise: order.paidAmountPaise,
          expectedOutstandingPaise,
          actualOutstandingPaise:
            order.receivable?.outstandingAmountPaise ?? null,
          corrected: dto.correct && hasMismatch,
          discrepancy: discrepancy as Prisma.InputJsonValue,
          note: dto.note?.trim() || null,
          createdByUserId: actor.id,
        },
      });
      await this.recordMutation(
        tx,
        actor.id,
        order.id,
        "finance-reconciliation",
        key,
        dto,
      );
    });
    return this.getOrder(actor, "FINANCE", orderNumber);
  }

  async createPayment(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BPaymentRecordDto,
    audience: "BUYER" | "FINANCE",
  ) {
    const order = await this.getOrder(actor, audience, orderNumber);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.client.b2BPaymentRecord.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) return existing;
    const onlinePaymentMethods = new Set<B2BPaymentMethod>([
      B2BPaymentMethod.RAZORPAY,
      B2BPaymentMethod.UPI,
    ]);
    if (audience === "BUYER" && onlinePaymentMethods.has(dto.method)) {
      throw new UnprocessableEntityException(
        "Buyer Razorpay and UPI payments must use the verified online checkout endpoint.",
      );
    }
    if (
      dto.method === B2BPaymentMethod.CHEQUE &&
      (!dto.chequeNumber || !dto.chequeBankName || !dto.chequeDate)
    ) {
      throw new UnprocessableEntityException(
        "Cheque number, bank, and cheque date are required.",
      );
    }
    return this.prisma.client.b2BPaymentRecord.create({
      data: {
        b2bOrderId: order.id,
        idempotencyKey: key,
        method: dto.method,
        amountPaise: dto.amountPaise,
        referenceNumber: dto.referenceNumber.trim(),
        proofFileKey: dto.proofFileKey?.trim() || null,
        chequeNumber: dto.chequeNumber?.trim() || null,
        chequeBankName: dto.chequeBankName?.trim() || null,
        chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
        status:
          audience === "FINANCE" && dto.method !== B2BPaymentMethod.CHEQUE
            ? B2BPaymentRecordStatus.VERIFIED
            : B2BPaymentRecordStatus.SUBMITTED,
      },
    });
  }

  async createOnlinePayment(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: CreateB2BOnlinePaymentDto,
  ) {
    this.assertEnabled();
    const order = await this.getOrder(actor, "BUYER", orderNumber);
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (
      ![B2BPaymentMethod.RAZORPAY, B2BPaymentMethod.UPI].includes(dto.method)
    ) {
      throw new BadRequestException("Only Razorpay or UPI can use online checkout.");
    }
    const closedPaymentStatuses = new Set<B2BPaymentStatus>([
      B2BPaymentStatus.PAID,
      B2BPaymentStatus.REFUNDED,
      B2BPaymentStatus.NOT_REQUIRED,
    ]);
    if (
      closedPaymentStatuses.has(order.paymentStatus) ||
      order.status === B2BOrderStatus.CANCELLED
    ) {
      throw new ConflictException("This B2B order is not accepting online payments.");
    }

    const outstandingAmountPaise = Math.max(
      0,
      order.buyerPayableAmountPaise - order.paidAmountPaise,
    );
    if (outstandingAmountPaise <= 0) {
      throw new ConflictException("This B2B order has no outstanding balance.");
    }
    if (dto.amountPaise > outstandingAmountPaise) {
      throw new UnprocessableEntityException(
        "Online payment amount cannot exceed the outstanding order balance.",
      );
    }

    const schedule = dto.paymentScheduleId
      ? order.paymentSchedules.find((item) => item.id === dto.paymentScheduleId)
      : undefined;
    if (dto.paymentScheduleId && !schedule) {
      throw new NotFoundException("Payment schedule does not belong to this B2B order.");
    }
    if (schedule) {
      const scheduleOutstanding = Math.max(
        0,
        schedule.amountPaise - schedule.paidAmountPaise,
      );
      if (scheduleOutstanding <= 0) {
        throw new ConflictException("This payment schedule is already settled.");
      }
      if (dto.amountPaise > scheduleOutstanding) {
        throw new UnprocessableEntityException(
          "Online payment amount cannot exceed the selected schedule balance.",
        );
      }
    }

    let payment = await this.prisma.client.b2BPaymentRecord.findUnique({
      where: { idempotencyKey: key },
    });
    if (payment) {
      if (
        payment.b2bOrderId !== order.id ||
        payment.method !== dto.method ||
        payment.amountPaise !== dto.amountPaise ||
        payment.requestedScheduleId !== (dto.paymentScheduleId ?? null)
      ) {
        throw new ConflictException(
          "Idempotency-Key was already used for a different B2B payment request.",
        );
      }
    } else {
      try {
        payment = await this.prisma.client.b2BPaymentRecord.create({
          data: {
            b2bOrderId: order.id,
            idempotencyKey: key,
            requestedScheduleId: dto.paymentScheduleId ?? null,
            method: dto.method,
            amountPaise: dto.amountPaise,
            currency: order.currency,
            status: B2BPaymentRecordStatus.SUBMITTED,
          },
        });
      } catch (error) {
        if (!this.isPrismaUniqueError(error)) throw error;
        payment = await this.prisma.client.b2BPaymentRecord.findUnique({
          where: { idempotencyKey: key },
        });
        if (!payment) throw error;
      }
    }

    if (payment.providerOrderId) {
      const keyId = await this.payments.razorpayCheckoutPublicKey(payment.amountPaise);
      return this.onlinePaymentOrderResponse(keyId, order.orderNumber, payment);
    }

    const staleLockBefore = new Date(Date.now() - 2 * 60 * 1000);
    const claimed = await this.prisma.client.b2BPaymentRecord.updateMany({
      where: {
        id: payment.id,
        providerOrderId: null,
        status: B2BPaymentRecordStatus.SUBMITTED,
        OR: [
          { providerOrderCreationInProgress: false },
          {
            providerOrderCreationInProgress: true,
            updatedAt: { lte: staleLockBefore },
          },
        ],
      },
      data: {
        providerOrderCreationInProgress: true,
        rejectionReason: null,
      },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.client.b2BPaymentRecord.findUnique({
        where: { id: payment.id },
      });
      if (current?.providerOrderId) {
        const keyId = await this.payments.razorpayCheckoutPublicKey(current.amountPaise);
        return this.onlinePaymentOrderResponse(keyId, order.orderNumber, current);
      }
      throw new ServiceUnavailableException(
        "Online payment setup is already in progress. Retry in a few seconds.",
      );
    }

    try {
      const providerOrder = await this.payments.createRazorpayProviderOrder({
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        receipt: order.orderNumber,
        idempotencyKey: `b2b-provider-order:${payment.id}`,
        notes: {
          b2bOrderId: order.id,
          orderNumber: order.orderNumber,
          b2bPaymentRecordId: payment.id,
          paymentMethod: payment.method,
        },
      });
      const stored = await this.prisma.client.b2BPaymentRecord.updateMany({
        where: {
          id: payment.id,
          providerOrderId: null,
          providerOrderCreationInProgress: true,
          status: B2BPaymentRecordStatus.SUBMITTED,
        },
        data: {
          providerOrderId: providerOrder.razorpayOrderId,
          providerOrderCreationInProgress: false,
          providerOrderCreatedAt: new Date(),
          referenceNumber: providerOrder.razorpayOrderId,
          providerPayload: {
            providerOrderId: providerOrder.razorpayOrderId,
            amountPaise: providerOrder.amountPaise,
            currency: providerOrder.currency,
            status: providerOrder.providerStatus,
          },
        },
      });
      if (stored.count !== 1) {
        throw new ConflictException(
          "B2B payment state changed while Razorpay setup was completing.",
        );
      }
      const updated = await this.prisma.client.b2BPaymentRecord.findUniqueOrThrow({
        where: { id: payment.id },
      });
      return this.onlinePaymentOrderResponse(
        providerOrder.keyId,
        order.orderNumber,
        updated,
      );
    } catch (error) {
      await this.prisma.client.b2BPaymentRecord.updateMany({
        where: {
          id: payment.id,
          providerOrderId: null,
          providerOrderCreationInProgress: true,
        },
        data: {
          providerOrderCreationInProgress: false,
          rejectionReason: "Razorpay checkout setup failed. Retry the payment.",
        },
      });
      throw error;
    }
  }

  async verifyOnlinePayment(
    actor: RequestUser,
    orderNumber: string,
    idempotencyKey: string | undefined,
    dto: VerifyB2BOnlinePaymentDto,
  ) {
    this.assertEnabled();
    const order = await this.getOrder(actor, "BUYER", orderNumber);
    const key = this.requireIdempotencyKey(idempotencyKey);
    const payment = await this.prisma.client.b2BPaymentRecord.findFirst({
      where: {
        id: dto.paymentRecordId,
        b2bOrderId: order.id,
        method: { in: [B2BPaymentMethod.RAZORPAY, B2BPaymentMethod.UPI] },
      },
      include: {
        order: {
          include: {
            paymentSchedules: { orderBy: { installmentNumber: "asc" } },
            receivable: true,
          },
        },
        allocations: true,
      },
    });
    if (!payment) throw new NotFoundException("B2B online payment was not found.");
    if (!payment.providerOrderId || payment.providerOrderId !== dto.razorpayOrderId) {
      throw new ConflictException("Razorpay order does not match this B2B payment.");
    }
    const settledRecordStatuses = new Set<B2BPaymentRecordStatus>([
      B2BPaymentRecordStatus.VERIFIED,
      B2BPaymentRecordStatus.CLEARED,
    ]);
    if (settledRecordStatuses.has(payment.status)) {
      if (payment.providerPaymentId === dto.razorpayPaymentId) {
        return this.getOrder(actor, "BUYER", orderNumber);
      }
      throw new ConflictException("This B2B payment is already settled.");
    }

    const verified = await this.payments.verifyRazorpayProviderPayment({
      expectedProviderOrderId: payment.providerOrderId,
      expectedAmountPaise: payment.amountPaise,
      expectedCurrency: payment.currency,
      checkout: dto,
    });
    if (!verified.captured) {
      await this.prisma.client.b2BPaymentRecord.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: verified.providerPaymentId,
          providerMethod: verified.method,
          providerPayload: verified.payload,
          rejectionReason: `Razorpay payment is ${verified.status}.`,
          ...(verified.status === "failed"
            ? { status: B2BPaymentRecordStatus.REJECTED }
            : {}),
        },
      });
      throw new UnprocessableEntityException(
        `Razorpay payment is ${verified.status}; captured payment is required.`,
      );
    }
    if (await this.wasProcessed(actor.id, "online-payment-verify", key)) {
      return this.getOrder(actor, "BUYER", orderNumber);
    }

    await this.prisma.client.$transaction(async (tx) => {
      const current = await tx.b2BPaymentRecord.findUnique({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              paymentSchedules: { orderBy: { installmentNumber: "asc" } },
              receivable: true,
            },
          },
          allocations: true,
        },
      });
      if (!current) throw new NotFoundException("B2B online payment was not found.");
      if (settledRecordStatuses.has(current.status)) {
        return;
      }
      if (current.allocations.length > 0) {
        throw new ConflictException("B2B online payment is already allocated.");
      }
      const settlementMethod =
        current.method === B2BPaymentMethod.UPI && verified.method !== "upi"
          ? B2BPaymentMethod.RAZORPAY
          : current.method;
      const unallocatedAmountPaise = await this.allocatePayment(tx, {
        ...current,
        method: settlementMethod,
      });
      await tx.b2BPaymentRecord.update({
        where: { id: current.id },
        data: {
          status: B2BPaymentRecordStatus.CLEARED,
          method: settlementMethod,
          unallocatedAmountPaise,
          providerPaymentId: verified.providerPaymentId,
          providerMethod: verified.method,
          providerPayload: verified.payload,
          referenceNumber: verified.providerPaymentId,
          rejectionReason: null,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          clearedAt: new Date(),
        },
      });
      await this.recordMutation(
        tx,
        actor.id,
        current.b2bOrderId,
        "online-payment-verify",
        key,
        {
          paymentRecordId: current.id,
          providerOrderId: verified.providerOrderId,
          providerPaymentId: verified.providerPaymentId,
        },
      );
      await this.enqueueOutbox(tx, current.b2bOrderId, "payment.verified", {
        paymentId: current.id,
        amountPaise: current.amountPaise,
        method: settlementMethod,
        providerPaymentId: verified.providerPaymentId,
      });
    });

    return this.getOrder(actor, "BUYER", orderNumber);
  }

  async verifyPayment(
    actor: RequestUser,
    paymentId: string,
    idempotencyKey: string | undefined,
    dto: VerifyB2BPaymentRecordDto,
  ) {
    this.assertEnabled();
    const payment = await this.prisma.client.b2BPaymentRecord.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            paymentSchedules: { orderBy: { installmentNumber: "asc" } },
            receivable: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException("B2B payment not found.");
    const isAcceptedDecision =
      dto.status === B2BPaymentRecordStatus.VERIFIED ||
      dto.status === B2BPaymentRecordStatus.CLEARED ||
      dto.status === B2BPaymentRecordStatus.REJECTED ||
      dto.status === B2BPaymentRecordStatus.BOUNCED;
    if (!isAcceptedDecision) {
      throw new BadRequestException("Unsupported finance payment decision.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "payment-verify", key)) {
      return this.prisma.client.b2BPaymentRecord.findUnique({ where: { id: payment.id } });
    }
    await this.prisma.client.$transaction(async (tx) => {
      const shouldAllocate =
        dto.status === B2BPaymentRecordStatus.CLEARED ||
        (dto.status === B2BPaymentRecordStatus.VERIFIED &&
          payment.method !== B2BPaymentMethod.CHEQUE);
      const unallocatedAmountPaise = shouldAllocate
        ? await this.allocatePayment(tx, payment)
        : payment.unallocatedAmountPaise;
      await tx.b2BPaymentRecord.update({
        where: { id: payment.id },
        data: {
          status: dto.status,
          unallocatedAmountPaise,
          rejectionReason:
            dto.status === B2BPaymentRecordStatus.REJECTED ||
            dto.status === B2BPaymentRecordStatus.BOUNCED
              ? dto.note?.trim() || "Payment rejected by finance."
              : null,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          clearedAt: shouldAllocate ? new Date() : null,
        },
      });
      await this.recordMutation(tx, actor.id, payment.b2bOrderId, "payment-verify", key, dto);
      await this.enqueueOutbox(tx, payment.b2bOrderId, "payment.verified", {
        paymentId: payment.id,
        amountPaise: payment.amountPaise,
        status: dto.status,
      });
    });
    return this.prisma.client.b2BPaymentRecord.findUnique({
      where: { id: payment.id },
      include: { allocations: true, receiptVoucher: true },
    });
  }

  async createCollectionTask(actor: RequestUser, dto: CreateB2BCollectionTaskDto) {
    this.assertEnabled();
    return this.prisma.client.b2BCollectionTask.create({
      data: {
        receivableId: dto.receivableId,
        assignedToUserId: dto.assignedToUserId ?? actor.id,
        dueAt: new Date(dto.dueAt),
        nextReminderAt: new Date(dto.dueAt),
        note: dto.note?.trim() || null,
      },
    });
  }

  async updateCollectionTask(
    actor: RequestUser,
    taskId: string,
    dto: UpdateB2BCollectionTaskDto,
  ) {
    this.assertEnabled();
    return this.prisma.client.b2BCollectionTask.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        promiseToPayAt: dto.promiseToPayAt ? new Date(dto.promiseToPayAt) : null,
        nextReminderAt: dto.nextReminderAt ? new Date(dto.nextReminderAt) : null,
        note: dto.note?.trim() || null,
        assignedToUserId: actor.id,
      },
    });
  }

  async createSupportCase(
    actor: RequestUser,
    orderNumber: string,
    audience: OrderAudience,
    dto: CreateB2BSupportCaseDto,
  ) {
    const order = await this.getOrder(actor, audience, orderNumber);
    if (audience === "SELLER") {
      await this.assertSellerPermission(actor, order.sellerId, SellerStaffPermission.B2B_SALES);
    }
    if (dto.orderLineId && !order.lines.some((line) => line.id === dto.orderLineId)) {
      throw new NotFoundException("B2B order line not found.");
    }
    if (dto.shipmentId && !order.shipments.some((item) => item.id === dto.shipmentId)) {
      throw new NotFoundException("B2B shipment not found.");
    }
    if (dto.taxDocumentId && !order.taxDocuments.some((item) => item.id === dto.taxDocumentId)) {
      throw new NotFoundException("B2B invoice not found.");
    }
    if (
      dto.paymentRecordId &&
      !order.paymentRecords.some((item) => item.id === dto.paymentRecordId)
    ) {
      throw new NotFoundException("B2B payment not found.");
    }
    return this.prisma.client.b2BSupportCase.create({
      data: {
        caseNumber: this.reference("CS"),
        b2bOrderId: order.id,
        b2bOrderLineId: dto.orderLineId ?? null,
        shipmentId: dto.shipmentId ?? null,
        taxDocumentId: dto.taxDocumentId ?? null,
        receivableId: order.receivable?.id ?? null,
        paymentRecordId: dto.paymentRecordId ?? null,
        caseType: dto.caseType,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        evidenceFileKeys: (dto.evidenceFileKeys ?? []) as Prisma.InputJsonValue,
        createdByUserId: actor.id,
      },
    });
  }

  async listSupportCases(query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = query.search?.trim();
    const status =
      query.status &&
      Object.values(B2BSupportCaseStatus).includes(
        query.status as B2BSupportCaseStatus,
      )
        ? (query.status as B2BSupportCaseStatus)
        : undefined;
    const where: Prisma.B2BSupportCaseWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { caseNumber: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              { order: { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BSupportCase.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              businessBuyer: { select: { companyName: true } },
              seller: { select: { storeName: true } },
            },
          },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BSupportCase.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async updateSupportCase(actor: RequestUser, caseId: string, dto: UpdateB2BSupportCaseDto) {
    this.assertEnabled();
    const supportCase = await this.prisma.client.b2BSupportCase.findUnique({
      where: { id: caseId },
      select: {
        caseType: true,
        shipmentId: true,
        disputeResolution: { select: { id: true } },
        order: { select: { status: true } },
      },
    });
    if (!supportCase) throw new NotFoundException("B2B support case not found.");
    const finalStatus =
      dto.status === B2BSupportCaseStatus.RESOLVED ||
      dto.status === B2BSupportCaseStatus.CLOSED;
    if (
      finalStatus &&
      supportCase.caseType === B2BSupportCaseType.DELIVERY &&
      supportCase.shipmentId &&
      supportCase.order.status === B2BOrderStatus.DELIVERY_DISPUTED &&
      !supportCase.disputeResolution
    ) {
      throw new UnprocessableEntityException(
        "Use the structured dispute resolution action before closing a delivery dispute.",
      );
    }
    return this.prisma.client.b2BSupportCase.update({
      where: { id: caseId },
      data: {
        status: dto.status,
        assignedToUserId: dto.assignedToUserId ?? actor.id,
        resolution: dto.resolution?.trim() || null,
        resolvedAt:
          dto.status === B2BSupportCaseStatus.RESOLVED ||
          dto.status === B2BSupportCaseStatus.CLOSED
            ? new Date()
            : null,
      },
    });
  }

  async resolveDispute(
    actor: RequestUser,
    orderNumber: string,
    caseId: string,
    idempotencyKey: string | undefined,
    dto: ResolveB2BDisputeDto,
  ) {
    const order = await this.getOrder(actor, "ADMIN", orderNumber);
    this.assertVersion(order.version, dto.version);
    const supportCase = order.supportCases.find((item) => item.id === caseId);
    if (!supportCase) throw new NotFoundException("B2B support case not found.");
    if (
      supportCase.status === B2BSupportCaseStatus.RESOLVED ||
      supportCase.status === B2BSupportCaseStatus.CLOSED ||
      order.disputeResolutions.some(
        (resolution) => resolution.supportCaseId === supportCase.id,
      )
    ) {
      throw new ConflictException("This B2B dispute already has a final resolution.");
    }
    const line = supportCase.b2bOrderLineId
      ? order.lines.find((item) => item.id === supportCase.b2bOrderLineId)
      : null;
    const acceptedQuantity = dto.acceptedQuantity ?? 0;
    const rejectedQuantity = dto.rejectedQuantity ?? 0;
    const returnQuantity = dto.returnQuantity ?? 0;
    const replacementQuantity = dto.replacementQuantity ?? 0;
    const refundAmountPaise = dto.refundAmountPaise ?? 0;
    const receivableAdjustmentPaise = dto.receivableAdjustmentPaise ?? 0;
    if (
      line &&
      acceptedQuantity + rejectedQuantity > line.quantity
    ) {
      throw new UnprocessableEntityException(
        "Accepted and rejected quantities cannot exceed the disputed order line.",
      );
    }
    if (
      (returnQuantity > 0 || replacementQuantity > 0) &&
      (!line ||
        returnQuantity > line.quantity ||
        replacementQuantity > line.quantity)
    ) {
      throw new UnprocessableEntityException(
        "Return and replacement quantities require a matching order line.",
      );
    }
    if (
      dto.resolutionType === B2BDisputeResolutionType.PARTIAL_ACCEPTANCE &&
      (!line ||
        acceptedQuantity <= 0 ||
        rejectedQuantity <= 0 ||
        acceptedQuantity + rejectedQuantity !== line.quantity)
    ) {
      throw new UnprocessableEntityException(
        "Partial acceptance must allocate the complete disputed line between accepted and rejected quantities.",
      );
    }
    if (
      dto.resolutionType === B2BDisputeResolutionType.REPLACEMENT &&
      replacementQuantity <= 0
    ) {
      throw new UnprocessableEntityException(
        "A replacement resolution requires a replacement quantity.",
      );
    }
    if (
      dto.resolutionType === B2BDisputeResolutionType.RETURN_AND_REFUND &&
      (returnQuantity <= 0 ||
        receivableAdjustmentPaise <= 0 ||
        refundAmountPaise <= 0)
    ) {
      throw new UnprocessableEntityException(
        "Return and refund requires return quantity, receivable adjustment, and refund amount.",
      );
    }
    if (
      dto.resolutionType === B2BDisputeResolutionType.CREDIT_NOTE &&
      receivableAdjustmentPaise <= 0
    ) {
      throw new UnprocessableEntityException(
        "A credit-note resolution requires a positive receivable adjustment.",
      );
    }
    if (refundAmountPaise > order.paidAmountPaise) {
      throw new UnprocessableEntityException(
        "Refund amount cannot exceed cleared buyer funds.",
      );
    }
    if (refundAmountPaise > receivableAdjustmentPaise) {
      throw new UnprocessableEntityException(
        "Refund amount cannot exceed the approved receivable adjustment.",
      );
    }
    if (receivableAdjustmentPaise > order.buyerPayableAmountPaise) {
      throw new UnprocessableEntityException(
        "Receivable adjustment cannot exceed the order value.",
      );
    }
    const originalDocument = order.taxDocuments.find(
      (document) =>
        document.status === TaxDocumentStatus.ISSUED &&
        (document.documentType === TaxDocumentType.TAX_INVOICE ||
          document.documentType === TaxDocumentType.BILL_OF_SUPPLY ||
          document.documentType === TaxDocumentType.COMMERCIAL_INVOICE),
    );
    if (receivableAdjustmentPaise > 0 && !originalDocument) {
      throw new UnprocessableEntityException(
        "An issued original invoice is required before recording a credit adjustment.",
      );
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    if (await this.wasProcessed(actor.id, "dispute-resolution", key)) {
      return this.getOrder(actor, "ADMIN", orderNumber);
    }

    await this.prisma.client.$transaction(async (tx) => {
      const now = new Date();
      const creditNote =
        receivableAdjustmentPaise > 0 && originalDocument
          ? await this.taxDocuments.createB2bCreditNote(tx, {
              b2bOrderId: order.id,
              originalDocumentId: originalDocument.id,
              amountPaise: receivableAdjustmentPaise,
              reason: dto.reason.trim(),
              actorUserId: actor.id,
              idempotencyKey: `b2b-dispute:${supportCase.id}:credit-note`,
              line: line
                ? {
                    description: line.description,
                    hsnSacCode: line.hsnSacCode,
                    taxClassification: line.taxClassification,
                    quantity: Math.max(
                      1,
                      returnQuantity ||
                        rejectedQuantity ||
                        replacementQuantity ||
                        line.quantity,
                    ),
                    gstRatePercent: line.gstRatePercent,
                  }
                : null,
            })
          : null;
      let replacementEnquiryId: string | null = null;
      if (replacementQuantity > 0 && line) {
        const replacement = await tx.b2BEnquiry.create({
          data: {
            businessBuyerId: order.businessBuyerId,
            idempotencyKey: `replacement:${supportCase.id}`,
            sellerId: order.sellerId,
            productId: line.productId,
            quantity: replacementQuantity,
            message: `Replacement requested from dispute ${supportCase.caseNumber}. Commercial, stock, tax, and credit checks must run again.`,
            transportMode: order.transportMode,
            transportNote: dto.reason.trim(),
            lines: {
              create: {
                lineNumber: 1,
                productId: line.productId,
                productVariantId: line.productVariantId,
                description: line.description,
                quantity: replacementQuantity,
                targetPricePaise: 0,
                note: `Replacement for ${order.orderNumber}, case ${supportCase.caseNumber}.`,
              },
            },
          },
        });
        replacementEnquiryId = replacement.id;
      }
      if (refundAmountPaise > 0) {
        await tx.b2BPaymentProof.create({
          data: {
            b2bOrderId: order.id,
            method: order.paymentMethod ?? B2BPaymentMethod.MANUAL,
            amountPaise: -refundAmountPaise,
            currency: order.currency,
            referenceNumber: `B2B-REFUND-${supportCase.caseNumber}`,
            submittedByUserId: actor.id,
            submittedAt: now,
            status: B2BProofStatus.VERIFIED,
            reviewedByUserId: actor.id,
            reviewedAt: now,
            note: dto.reason.trim(),
          },
        });
      }
      let scheduleAmountReduction = receivableAdjustmentPaise;
      let schedulePaidReduction = refundAmountPaise;
      for (const schedule of [...order.paymentSchedules].reverse()) {
        const amountReduction = Math.min(
          schedule.amountPaise,
          scheduleAmountReduction,
        );
        const paidReduction = Math.min(
          schedule.paidAmountPaise,
          schedulePaidReduction,
        );
        const amountPaise = schedule.amountPaise - amountReduction;
        const paidAmountPaise = Math.min(
          amountPaise,
          schedule.paidAmountPaise - paidReduction,
        );
        scheduleAmountReduction -= amountReduction;
        schedulePaidReduction -= paidReduction;
        if (amountReduction > 0 || paidReduction > 0) {
          await tx.b2BPaymentSchedule.update({
            where: { id: schedule.id },
            data: {
              amountPaise,
              paidAmountPaise,
              status:
                paidAmountPaise >= amountPaise
                  ? B2BPaymentScheduleStatus.PAID
                  : paidAmountPaise > 0
                    ? B2BPaymentScheduleStatus.PARTIALLY_PAID
                    : B2BPaymentScheduleStatus.PENDING,
            },
          });
        }
      }
      const buyerPayableAmountPaise = Math.max(
        0,
        order.buyerPayableAmountPaise - receivableAdjustmentPaise,
      );
      const paidAmountPaise = Math.max(
        0,
        order.paidAmountPaise - refundAmountPaise,
      );
      let outstandingAmountPaise =
        order.receivable?.outstandingAmountPaise ?? 0;
      if (order.receivable) {
        if (receivableAdjustmentPaise > 0) {
          outstandingAmountPaise = Math.max(
            0,
            buyerPayableAmountPaise - order.paidAmountPaise,
          );
          await tx.b2BReceivableEntry.create({
            data: {
              receivableId: order.receivable.id,
              entryType: "DISPUTE_ADJUSTMENT",
              description: `Resolution ${supportCase.caseNumber}`,
              creditPaise: receivableAdjustmentPaise,
              balanceAfterPaise: outstandingAmountPaise,
              referenceType: "B2BSupportCase",
              referenceId: supportCase.id,
            },
          });
        }
        if (refundAmountPaise > 0) {
          outstandingAmountPaise = Math.max(
            0,
            buyerPayableAmountPaise - paidAmountPaise,
          );
          await tx.b2BReceivableEntry.create({
            data: {
              receivableId: order.receivable.id,
              entryType: "REFUND",
              description: `Refund for ${supportCase.caseNumber}`,
              debitPaise: refundAmountPaise,
              balanceAfterPaise: outstandingAmountPaise,
              referenceType: "B2BSupportCase",
              referenceId: supportCase.id,
            },
          });
        }
        await tx.b2BReceivable.update({
          where: { id: order.receivable.id },
          data: {
            outstandingAmountPaise,
            status:
              outstandingAmountPaise === 0
                ? B2BReceivableStatus.PAID
                : paidAmountPaise > 0
                  ? B2BReceivableStatus.PARTIALLY_PAID
                  : B2BReceivableStatus.OPEN,
            disputedAt: null,
            closedAt: outstandingAmountPaise === 0 ? now : null,
          },
        });
      }
      if (supportCase.shipmentId) {
        await tx.b2BShipment.update({
          where: { id: supportCase.shipmentId },
          data: {
            acceptanceStatus: B2BDeliveryAcceptanceStatus.ACCEPTED,
            acceptedAt: now,
            disputeReason: null,
          },
        });
      }
      await tx.b2BSupportCase.update({
        where: { id: supportCase.id },
        data: {
          status: B2BSupportCaseStatus.RESOLVED,
          resolution: dto.reason.trim(),
          resolvedAt: now,
          assignedToUserId: actor.id,
        },
      });
      await tx.b2BDisputeResolution.create({
        data: {
          resolutionNumber: this.reference("DR"),
          supportCaseId: supportCase.id,
          b2bOrderId: order.id,
          b2bOrderLineId: supportCase.b2bOrderLineId,
          shipmentId: supportCase.shipmentId,
          resolutionType: dto.resolutionType,
          acceptedQuantity,
          rejectedQuantity,
          returnQuantity,
          replacementQuantity,
          refundAmountPaise,
          receivableAdjustmentPaise,
          creditNoteTaxDocumentId: creditNote?.id ?? null,
          replacementEnquiryId,
          reason: dto.reason.trim(),
          resolvedByUserId: actor.id,
        },
      });

      const pendingShipments = await tx.b2BShipment.count({
        where: {
          b2bOrderId: order.id,
          ...(supportCase.shipmentId
            ? { id: { not: supportCase.shipmentId } }
            : {}),
          acceptanceStatus: {
            in: [
              B2BDeliveryAcceptanceStatus.PENDING,
              B2BDeliveryAcceptanceStatus.DISPUTED,
            ],
          },
        },
      });
      const allAccepted = pendingShipments === 0;
      const paymentStatus =
        paidAmountPaise >= buyerPayableAmountPaise
          ? B2BPaymentStatus.PAID
          : paidAmountPaise > 0
            ? B2BPaymentStatus.PARTIALLY_PAID
            : B2BPaymentStatus.PENDING;
      const closesOrder =
        allAccepted &&
        paymentStatus === B2BPaymentStatus.PAID &&
        outstandingAmountPaise === 0;
      const nextStatus = closesOrder
        ? B2BOrderStatus.CLOSED
        : allAccepted
          ? B2BOrderStatus.DELIVERY_ACCEPTED
          : B2BOrderStatus.DELIVERY_DISPUTED;
      const subtotalPaise = Math.max(
        0,
        (order.subtotalPaise ?? order.buyerPayableAmountPaise) -
          receivableAdjustmentPaise,
      );
      const commissionAmountPaise = Math.floor(
        (subtotalPaise * order.commissionRateBps) / 10_000,
      );
      await this.advanceOrder(
        tx,
        order,
        nextStatus,
        actor.id,
        `Dispute ${supportCase.caseNumber} resolved: ${dto.reason.trim()}`,
        {
          supportCaseId: supportCase.id,
          resolutionType: dto.resolutionType,
          creditNoteId: creditNote?.id,
          replacementEnquiryId,
        },
        {
          subtotalPaise,
          buyerPayableAmountPaise,
          paidAmountPaise,
          paymentStatus,
          commissionAmountPaise,
          sellerPayoutAmountPaise: Math.max(
            0,
            subtotalPaise - commissionAmountPaise,
          ),
          paidAt: paymentStatus === B2BPaymentStatus.PAID ? now : null,
          settlementStatus: closesOrder
            ? SellerSettlementStatus.ELIGIBLE
            : SellerSettlementStatus.NOT_ELIGIBLE,
          settlementEligibleAt: closesOrder ? now : null,
        },
      );
      await this.enqueueOutbox(tx, order.id, "order.dispute.resolved", {
        orderNumber: order.orderNumber,
        caseNumber: supportCase.caseNumber,
        resolutionType: dto.resolutionType,
      });
      await this.recordMutation(
        tx,
        actor.id,
        order.id,
        "dispute-resolution",
        key,
        dto,
      );
    });
    return this.getOrder(actor, "ADMIN", orderNumber);
  }

  async createReorder(actor: RequestUser, orderNumber: string, idempotencyKey: string | undefined) {
    const order = await this.getOrder(actor, "BUYER", orderNumber);
    if (
      order.status !== B2BOrderStatus.DELIVERY_ACCEPTED &&
      order.status !== B2BOrderStatus.CLOSED
    ) {
      throw new UnprocessableEntityException("Only completed B2B orders can be reordered.");
    }
    const key = this.requireIdempotencyKey(idempotencyKey);
    const existing = await this.prisma.client.b2BEnquiry.findFirst({
      where: { businessBuyerId: order.businessBuyerId, idempotencyKey: key },
      include: { lines: true },
    });
    if (existing) return existing;
    return this.prisma.client.b2BEnquiry.create({
      data: {
        businessBuyerId: order.businessBuyerId,
        idempotencyKey: key,
        sellerId: order.sellerId,
        productId: order.productId,
        quantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
        message: `Reorder request based on ${order.orderNumber}. Revalidate price, stock, tax, credit, and seller availability.`,
        transportMode: order.transportMode,
        transportNote: order.transportNote,
        lines: {
          create: order.lines.map((line) => ({
            lineNumber: line.lineNumber,
            productId: line.productId,
            productVariantId: line.productVariantId,
            description: line.description,
            quantity: line.quantity,
            targetPricePaise: line.unitPricePaise,
            note: `Copied from completed order ${order.orderNumber}.`,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async listErpConnections() {
    this.assertEnabled();
    return this.prisma.client.b2BErpConnection.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        baseUrl: true,
        subscribedEvents: true,
        lastVerifiedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async createErpConnection(actor: RequestUser, dto: CreateB2BErpConnectionDto) {
    this.assertEnabled();
    return this.prisma.client.b2BErpConnection.create({
      data: {
        name: dto.name.trim(),
        baseUrl: dto.baseUrl.trim().replace(/\/+$/, ""),
        encryptedAuthConfig: this.encryptErp(JSON.stringify(dto.authConfig)),
        encryptedSigningSecret: this.encryptErp(dto.signingSecret),
        subscribedEvents: dto.subscribedEvents,
        createdById: actor.id,
      },
      select: {
        id: true,
        name: true,
        status: true,
        baseUrl: true,
        subscribedEvents: true,
        createdAt: true,
      },
    });
  }

  async updateErpConnection(
    connectionId: string,
    dto: UpdateB2BErpConnectionDto,
  ) {
    this.assertEnabled();
    return this.prisma.client.b2BErpConnection.update({
      where: { id: connectionId },
      data: {
        status: dto.status,
        ...(dto.baseUrl ? { baseUrl: dto.baseUrl.trim().replace(/\/+$/, "") } : {}),
        ...(dto.authConfig
          ? { encryptedAuthConfig: this.encryptErp(JSON.stringify(dto.authConfig)) }
          : {}),
        ...(dto.signingSecret
          ? { encryptedSigningSecret: this.encryptErp(dto.signingSecret) }
          : {}),
        ...(dto.subscribedEvents ? { subscribedEvents: dto.subscribedEvents } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        baseUrl: true,
        subscribedEvents: true,
        lastVerifiedAt: true,
        lastError: true,
        updatedAt: true,
      },
    });
  }

  async replayOutbox(eventId: string) {
    this.assertEnabled();
    return this.prisma.client.b2BIntegrationOutbox.update({
      where: { id: eventId },
      data: {
        status: B2BIntegrationOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
        claimedAt: null,
        claimedBy: null,
        lastError: null,
      },
    });
  }

  async listOutbox(query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const status =
      query.status &&
      Object.values(B2BIntegrationOutboxStatus).includes(
        query.status as B2BIntegrationOutboxStatus,
      )
        ? (query.status as B2BIntegrationOutboxStatus)
        : undefined;
    const where: Prisma.B2BIntegrationOutboxWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { eventId: { contains: query.search, mode: "insensitive" } },
              { eventType: { contains: query.search, mode: "insensitive" } },
              { aggregateId: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BIntegrationOutbox.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BIntegrationOutbox.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async listErpExportJobs(query: B2BOperationsQueryDto) {
    this.assertEnabled();
    const { page, take, skip } = paginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const status =
      query.status &&
      Object.values(B2BErpExportStatus).includes(
        query.status as B2BErpExportStatus,
      )
        ? (query.status as B2BErpExportStatus)
        : undefined;
    const where: Prisma.B2BErpExportJobWhereInput = {
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            OR: [
              { exportNumber: { contains: query.search, mode: "insensitive" } },
              { fileName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.b2BErpExportJob.findMany({
        where,
        select: {
          id: true,
          exportNumber: true,
          exportType: true,
          format: true,
          status: true,
          filters: true,
          fileName: true,
          contentType: true,
          contentHash: true,
          rowCount: true,
          error: true,
          completedAt: true,
          createdAt: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.b2BErpExportJob.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  async createErpOrderExportJob(
    actor: RequestUser,
    query: B2BOperationsQueryDto,
    formatInput?: string,
  ) {
    this.assertEnabled();
    const format =
      formatInput?.toLowerCase() === "json"
        ? B2BErpExportFormat.JSON
        : B2BErpExportFormat.CSV;
    const job = await this.prisma.client.b2BErpExportJob.create({
      data: {
        exportNumber: this.reference("ERP"),
        exportType: "ORDERS",
        format,
        status: B2BErpExportStatus.PROCESSING,
        filters: {
          ...(query.search ? { search: query.search } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.sellerId ? { sellerId: query.sellerId } : {}),
          ...(query.buyerId ? { buyerId: query.buyerId } : {}),
          ...(query.dueFrom ? { dueFrom: query.dueFrom } : {}),
          ...(query.dueTo ? { dueTo: query.dueTo } : {}),
        },
        createdById: actor.id,
      },
    });
    try {
      const exportFile = await this.erpOrderExport(query, format.toLowerCase());
      const content = Buffer.from(exportFile.content, "utf8");
      const upload = await this.storage.saveB2BErpExport(
        { exportNumber: job.exportNumber, actorUserId: actor.id },
        { fileName: exportFile.fileName, contentType: exportFile.contentType },
        content,
      );
      return await this.prisma.client.b2BErpExportJob.update({
        where: { id: job.id },
        data: {
          status: B2BErpExportStatus.COMPLETED,
          fileName: exportFile.fileName,
          contentType: exportFile.contentType,
          fileKey: upload.assetKey,
          legacyContent: null,
          contentHash: createHash("sha256").update(content).digest("hex"),
          rowCount: exportFile.rowCount,
          completedAt: new Date(),
          error: null,
        },
        select: {
          id: true,
          exportNumber: true,
          exportType: true,
          format: true,
          status: true,
          filters: true,
          fileName: true,
          contentType: true,
          fileKey: true,
          contentHash: true,
          rowCount: true,
          error: true,
          completedAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      await this.prisma.client.b2BErpExportJob.update({
        where: { id: job.id },
        data: {
          status: B2BErpExportStatus.FAILED,
          error: "ERP order export generation failed.",
        },
      });
      throw error;
    }
  }

  async erpExportJobContent(jobId: string) {
    this.assertEnabled();
    const job = await this.prisma.client.b2BErpExportJob.findUnique({
      where: { id: jobId },
      select: {
        status: true,
        fileName: true,
        contentType: true,
        fileKey: true,
        legacyContent: true,
      },
    });
    if (!job) throw new NotFoundException("B2B ERP export job not found.");
    if (
      job.status !== B2BErpExportStatus.COMPLETED ||
      !job.fileName ||
      !job.contentType ||
      (!job.fileKey && !job.legacyContent)
    ) {
      throw new ConflictException("B2B ERP export is not ready for download.");
    }
    if (job.fileKey) {
      return {
        fileName: job.fileName,
        contentType: job.contentType,
        access: await this.storage.b2bErpExportDocumentAccess(job.fileKey),
      };
    }
    return {
      fileName: job.fileName,
      contentType: job.contentType,
      content: Buffer.from(job.legacyContent!),
    };
  }

  async erpOrderExport(query: B2BOperationsQueryDto, formatInput?: string) {
    this.assertEnabled();
    const format = formatInput?.toLowerCase() === "json" ? "json" : "csv";
    const search = query.search?.trim();
    const status =
      query.status && Object.values(B2BOrderStatus).includes(query.status as B2BOrderStatus)
        ? (query.status as B2BOrderStatus)
        : undefined;
    const orders = await this.prisma.client.b2BOrder.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.sellerId ? { sellerId: query.sellerId } : {}),
        ...(query.buyerId ? { businessBuyerId: query.buyerId } : {}),
        ...(query.dueFrom || query.dueTo
          ? {
              paymentDueAt: {
                ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
                ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { businessBuyer: { companyName: { contains: search, mode: "insensitive" } } },
                { seller: { storeName: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        businessBuyer: { select: { companyName: true, gstNumber: true } },
        seller: { select: { storeName: true, gstNumber: true } },
        lines: { orderBy: { lineNumber: "asc" } },
        shipments: { orderBy: { createdAt: "asc" } },
        receivable: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5_000,
    });
    const rows = orders.flatMap((order) =>
      order.lines.map((line) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        buyer: order.businessBuyer.companyName,
        buyerGstin: order.businessBuyer.gstNumber ?? "",
        seller: order.seller?.storeName ?? "",
        sellerGstin: order.seller?.gstNumber ?? "",
        lineNumber: line.lineNumber,
        description: line.description,
        sku: line.sku ?? "",
        hsnSacCode: line.hsnSacCode ?? "",
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        lineValuePaise: line.lineValuePaise,
        paymentStatus: order.paymentStatus,
        paidAmountPaise: order.paidAmountPaise,
        outstandingAmountPaise: order.receivable?.outstandingAmountPaise ?? 0,
        shipmentReferences: order.shipments
          .map((shipment) => shipment.lrNumber ?? shipment.awbNumber)
          .filter(Boolean)
          .join("|"),
        createdAt: order.createdAt.toISOString(),
      })),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      return {
        fileName: `b2b-orders-${stamp}.json`,
        contentType: "application/json; charset=utf-8",
        content: JSON.stringify({ generatedAt: new Date().toISOString(), items: rows }, null, 2),
        rowCount: rows.length,
      };
    }
    const headers = Object.keys(rows[0] ?? {
      orderNumber: "",
      status: "",
      buyer: "",
      buyerGstin: "",
      seller: "",
      sellerGstin: "",
      lineNumber: "",
      description: "",
      sku: "",
      hsnSacCode: "",
      quantity: "",
      unitPricePaise: "",
      lineValuePaise: "",
      paymentStatus: "",
      paidAmountPaise: "",
      outstandingAmountPaise: "",
      shipmentReferences: "",
      createdAt: "",
    });
    const content = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => this.csvCell(row[header as keyof typeof row]))
          .join(","),
      ),
    ].join("\r\n");
    return {
      fileName: `b2b-orders-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      content,
      rowCount: rows.length,
    };
  }

  private async orderScope(
    actor: RequestUser,
    audience: OrderAudience,
  ): Promise<Prisma.B2BOrderWhereInput> {
    if (audience === "ADMIN") {
      if (!actor.roles.includes(RoleCode.ADMIN)) throw new ForbiddenException();
      return {};
    }
    if (audience === "FINANCE") {
      if (
        !actor.roles.includes(RoleCode.ADMIN) &&
        !actor.roles.includes(RoleCode.FINANCE)
      ) {
        throw new ForbiddenException();
      }
      return {};
    }
    if (audience === "BUYER") {
      const buyer = await this.prisma.client.businessBuyer.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      });
      if (!buyer) throw new ForbiddenException("Business buyer profile required.");
      return { businessBuyerId: buyer.id };
    }
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (seller) return { sellerId: seller.id };
    const membership = await this.prisma.client.sellerStaffMembership.findFirst({
      where: { userId: actor.id, isActive: true },
      select: { sellerId: true },
    });
    if (!membership) throw new ForbiddenException("Seller access required.");
    return { sellerId: membership.sellerId };
  }

  private withDerivedLineProgress(
    order: Prisma.B2BOrderGetPayload<{ include: typeof orderOperationsInclude }>,
  ) {
    const quantityForLine = (value: Prisma.JsonValue, lineId: string) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
      const quantity = (value as Record<string, unknown>)[lineId];
      return typeof quantity === "number" && Number.isFinite(quantity)
        ? Math.max(0, Math.floor(quantity))
        : 0;
    };
    const lines = order.lines.map((line) => {
      const taskQuantity = (taskType: B2BWarehouseTaskType) =>
        Math.max(
          0,
          ...order.warehouseTasks
            .filter(
              (task) =>
                task.taskType === taskType &&
                task.status !== B2BWarehouseTaskStatus.CANCELLED,
            )
            .flatMap((task) =>
              task.items
                .filter((item) => item.b2bOrderLineId === line.id)
                .map((item) => item.completedQuantity),
            ),
        );
      const pickedQuantity = Math.min(
        line.quantity,
        taskQuantity(B2BWarehouseTaskType.PICK),
      );
      const packedTaskQuantity = taskQuantity(B2BWarehouseTaskType.PACK);
      const packageQuantity = order.packages.reduce(
        (sum, packageRecord) =>
          sum + quantityForLine(packageRecord.itemAllocations, line.id),
        0,
      );
      const packedQuantity = Math.min(
        line.quantity,
        Math.max(packedTaskQuantity, packageQuantity),
      );
      let shippedQuantity = 0;
      let deliveredQuantity = 0;
      let acceptedQuantity = 0;
      for (const shipment of order.shipments) {
        if (shipment.status === B2BShipmentStatus.CANCELLED) continue;
        const quantity = shipment.packages.reduce(
          (sum, packageRecord) =>
            sum + quantityForLine(packageRecord.itemAllocations, line.id),
          0,
        );
        if (
          shipment.status === B2BShipmentStatus.DISPATCHED ||
          shipment.status === B2BShipmentStatus.IN_TRANSIT ||
          shipment.status === B2BShipmentStatus.DELIVERED
        ) {
          shippedQuantity += quantity;
        }
        if (shipment.status === B2BShipmentStatus.DELIVERED) {
          deliveredQuantity += quantity;
        }
        if (
          shipment.acceptanceStatus === B2BDeliveryAcceptanceStatus.ACCEPTED ||
          shipment.acceptanceStatus ===
            B2BDeliveryAcceptanceStatus.AUTO_ACCEPTED
        ) {
          acceptedQuantity += quantity;
        }
      }
      const plan = line.fulfilmentPlan;
      const readyQuantity = Math.min(
        line.quantity,
        plan?.readyQuantity ?? 0,
      );
      let state = "PLANNING_REQUIRED";
      if (plan?.status === B2BFulfilmentStatus.CANCELLED) {
        state = "CANCELLED";
      } else if (acceptedQuantity >= line.quantity) {
        state = "ACCEPTED";
      } else if (deliveredQuantity > 0) {
        state =
          deliveredQuantity >= line.quantity
            ? "DELIVERED"
            : "PARTIALLY_DELIVERED";
      } else if (shippedQuantity > 0) {
        state =
          shippedQuantity >= line.quantity
            ? "DISPATCHED"
            : "PARTIALLY_DISPATCHED";
      } else if (packedQuantity >= line.quantity) {
        state = "PACKED";
      } else if (pickedQuantity > 0) {
        state =
          pickedQuantity >= line.quantity ? "PICKED" : "PARTIALLY_PICKED";
      } else if (readyQuantity >= line.quantity) {
        state = "STOCK_READY";
      } else if (plan?.source === B2BFulfilmentSource.PROCURE) {
        state = "PROCUREMENT_IN_PROGRESS";
      } else if (plan?.source === B2BFulfilmentSource.PRODUCE) {
        state = "PRODUCTION_IN_PROGRESS";
      } else if (plan) {
        state = "IN_FULFILMENT";
      }
      return {
        ...line,
        progress: {
          state,
          plannedQuantity: plan?.plannedQuantity ?? 0,
          readyQuantity,
          pickedQuantity,
          packedQuantity,
          shippedQuantity: Math.min(line.quantity, shippedQuantity),
          deliveredQuantity: Math.min(line.quantity, deliveredQuantity),
          acceptedQuantity: Math.min(line.quantity, acceptedQuantity),
        },
      };
    });
    return { ...order, lines };
  }

  private orderAmendmentSnapshot(
    order: Prisma.B2BOrderGetPayload<{ include: typeof orderOperationsInclude }>,
  ) {
    return {
      version: order.version,
      lines: order.lines.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        lineValuePaise: line.lineValuePaise,
      })),
      deliveryAddressSnapshot: order.deliveryAddressSnapshot,
      paymentDueAt: order.paymentDueAt.toISOString(),
      buyerPayableAmountPaise: order.buyerPayableAmountPaise,
    };
  }

  private amendmentLineChanges(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      if (typeof record.orderLineId !== "string") return [];
      const quantity =
        typeof record.quantity === "number" &&
        Number.isInteger(record.quantity) &&
        record.quantity > 0
          ? record.quantity
          : undefined;
      const unitPricePaise =
        typeof record.unitPricePaise === "number" &&
        Number.isInteger(record.unitPricePaise) &&
        record.unitPricePaise >= 0
          ? record.unitPricePaise
          : undefined;
      return [{ orderLineId: record.orderLineId, quantity, unitPricePaise }];
    });
  }

  private podFileKey(
    proof: { proofFileKeys: Prisma.JsonValue; signatureFileKey: string | null },
    fileReference: string,
  ) {
    if (fileReference === "signature") {
      if (!proof.signatureFileKey) {
        throw new NotFoundException("POD signature file not found.");
      }
      return proof.signatureFileKey;
    }
    const index = Number(fileReference);
    const keys = Array.isArray(proof.proofFileKeys)
      ? proof.proofFileKeys.filter((item): item is string => typeof item === "string")
      : [];
    if (!Number.isInteger(index) || index < 0 || !keys[index]) {
      throw new NotFoundException("POD evidence file not found.");
    }
    return keys[index];
  }

  private async assertSellerPermission(
    actor: RequestUser,
    sellerId: string | null,
    permission: SellerStaffPermission,
  ) {
    if (!sellerId) throw new ForbiddenException("Seller access required.");
    const owner = await this.prisma.client.seller.findFirst({
      where: { id: sellerId, userId: actor.id },
      select: { id: true },
    });
    if (owner) return;
    const membership = await this.prisma.client.sellerStaffMembership.findFirst({
      where: {
        sellerId,
        userId: actor.id,
        isActive: true,
        permissions: { has: permission },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        `This seller staff account does not have ${permission.replaceAll("_", " ").toLowerCase()} access.`,
      );
    }
  }

  private async advanceOrder(
    tx: Prisma.TransactionClient,
    order: { id: string; version: number; status: B2BOrderStatus },
    nextStatus: B2BOrderStatus,
    actorUserId: string | null,
    note?: string | null,
    payload?: Record<string, unknown>,
    extraData: Prisma.B2BOrderUpdateManyMutationInput = {},
  ) {
    const updated = await tx.b2BOrder.updateMany({
      where: { id: order.id, version: order.version },
      data: {
        ...extraData,
        status: nextStatus,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException("B2B order changed. Refresh and retry with the latest version.");
    }
    await tx.b2BOrderEvent.create({
      data: {
        b2bOrderId: order.id,
        actorUserId,
        status: nextStatus,
        note: note?.trim() || `B2B order moved to ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
        ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private bumpVersion(
    tx: Prisma.TransactionClient,
    order: { id: string; version: number; status: B2BOrderStatus },
    actorUserId: string,
    note?: string,
  ) {
    return this.advanceOrder(tx, order, order.status, actorUserId, note);
  }

  private async ensurePaymentSchedules(
    tx: Prisma.TransactionClient,
    order: { id: string; buyerPayableAmountPaise: number; paymentDueAt: Date },
    term: B2BPaymentTermType,
  ) {
    const count = await tx.b2BPaymentSchedule.count({ where: { b2bOrderId: order.id } });
    if (count) return;
    const amount = order.buyerPayableAmountPaise;
    const now = new Date();
    const dueDays = this.netTermDays(term);
    const create = (
      installmentNumber: number,
      label: string,
      amountPaise: number,
      dueAt: Date,
      fulfilmentGate: boolean,
      dispatchGate: boolean,
    ) => ({
      b2bOrderId: order.id,
      installmentNumber,
      label,
      paymentTermType: term,
      amountPaise,
      dueAt,
      fulfilmentGate,
      dispatchGate,
    });
    if (term === B2BPaymentTermType.ADVANCE_PERCENT) {
      const advance = Math.floor(amount * 0.3);
      await tx.b2BPaymentSchedule.createMany({
        data: [
          create(1, "30% advance", advance, now, true, true),
          create(2, "Balance before dispatch", amount - advance, order.paymentDueAt, false, true),
        ],
      });
      return;
    }
    if (term === B2BPaymentTermType.MILESTONE) {
      const first = Math.floor(amount * 0.3);
      const second = Math.floor(amount * 0.4);
      await tx.b2BPaymentSchedule.createMany({
        data: [
          create(1, "Order advance", first, now, true, false),
          create(2, "Production milestone", second, order.paymentDueAt, false, true),
          create(3, "Delivery balance", amount - first - second, order.paymentDueAt, false, false),
        ],
      });
      return;
    }
    await tx.b2BPaymentSchedule.create({
      data: create(
        1,
        dueDays > 0 ? `Net ${dueDays}` : "Full prepayment",
        amount,
        dueDays > 0 ? new Date(now.getTime() + dueDays * 86_400_000) : now,
        dueDays === 0,
        dueDays === 0,
      ),
    });
  }

  private async reserveInventory(
    tx: Prisma.TransactionClient,
    orderLineId: string,
    productVariantId: string,
    quantity: number,
  ) {
    const existing = await tx.b2BInventoryReservation.findFirst({
      where: {
        b2bOrderLineId: orderLineId,
        productVariantId,
        status: B2BInventoryReservationStatus.ACTIVE,
      },
    });
    if (existing) return;
    const [variant] = await tx.$queryRaw<Array<{ stockQuantity: number }>>`
      SELECT "stock_quantity" AS "stockQuantity"
      FROM "product_variants"
      WHERE "id" = ${productVariantId}::uuid
      FOR UPDATE
    `;
    if (!variant) throw new UnprocessableEntityException("Product variant not found.");
    const reserved = await tx.b2BInventoryReservation.aggregate({
      where: { productVariantId, status: B2BInventoryReservationStatus.ACTIVE },
      _sum: { quantity: true },
    });
    if (variant.stockQuantity - (reserved._sum.quantity ?? 0) < quantity) {
      throw new UnprocessableEntityException("Insufficient available stock for B2B reservation.");
    }
    await tx.b2BInventoryReservation.create({
      data: { b2bOrderLineId: orderLineId, productVariantId, quantity },
    });
    await tx.inventoryMovement.create({
      data: {
        productVariantId,
        movementType: InventoryMovementType.RESERVE,
        quantity,
        reason: "B2B commercial approval reservation.",
        referenceType: "B2BOrderLine",
        referenceId: orderLineId,
      },
    });
  }

  private async consumeReservation(
    tx: Prisma.TransactionClient,
    orderLineId: string,
    quantity: number,
    actorUserId: string,
  ) {
    const reservation = await tx.b2BInventoryReservation.findFirst({
      where: { b2bOrderLineId: orderLineId, status: B2BInventoryReservationStatus.ACTIVE },
    });
    if (!reservation || reservation.quantity < quantity) {
      throw new UnprocessableEntityException("Active B2B stock reservation is insufficient.");
    }
    const decremented = await tx.productVariant.updateMany({
      where: { id: reservation.productVariantId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (decremented.count !== 1) {
      throw new UnprocessableEntityException("Stock changed before picking completed.");
    }
    await tx.b2BInventoryReservation.update({
      where: { id: reservation.id },
      data: { status: B2BInventoryReservationStatus.CONSUMED, consumedAt: new Date() },
    });
    await tx.inventoryMovement.create({
      data: {
        productVariantId: reservation.productVariantId,
        movementType: InventoryMovementType.SALE,
        quantity: -quantity,
        reason: "B2B pick completion.",
        referenceType: "B2BOrderLine",
        referenceId: orderLineId,
        createdById: actorUserId,
      },
    });
  }

  private async refreshStockReadyState(
    tx: Prisma.TransactionClient,
    order: { id: string; version: number; status: B2BOrderStatus },
    actorUserId: string,
    note?: string,
  ) {
    const pending = await tx.b2BFulfilmentPlan.count({
      where: {
        b2bOrderId: order.id,
        status: { notIn: [B2BFulfilmentStatus.READY, B2BFulfilmentStatus.COMPLETED] },
      },
    });
    if (pending === 0 && order.status !== B2BOrderStatus.STOCK_READY) {
      await this.advanceOrder(
        tx,
        order,
        B2BOrderStatus.STOCK_READY,
        actorUserId,
        note,
      );
    }
  }

  private async allocatePayment(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      b2bOrderId: string;
      requestedScheduleId: string | null;
      method: B2BPaymentMethod;
      amountPaise: number;
      referenceNumber: string | null;
      order: {
        paidAmountPaise: number;
        buyerPayableAmountPaise: number;
        paymentStatus: B2BPaymentStatus;
        status: B2BOrderStatus;
        version: number;
        paymentSchedules: Array<{
          id: string;
          amountPaise: number;
          paidAmountPaise: number;
          fulfilmentGate: boolean;
          status: B2BPaymentScheduleStatus;
        }>;
        receivable: {
          id: string;
          outstandingAmountPaise: number;
        } | null;
      };
    },
  ) {
    let remaining = payment.amountPaise;
    const schedules = [...payment.order.paymentSchedules].sort((left, right) => {
      if (left.id === payment.requestedScheduleId) return -1;
      if (right.id === payment.requestedScheduleId) return 1;
      return 0;
    });
    for (const schedule of schedules) {
      if (remaining <= 0) break;
      const outstanding = Math.max(0, schedule.amountPaise - schedule.paidAmountPaise);
      const allocated = Math.min(remaining, outstanding);
      if (!allocated) continue;
      const paidAmountPaise = schedule.paidAmountPaise + allocated;
      await tx.b2BPaymentAllocation.create({
        data: {
          paymentRecordId: payment.id,
          paymentScheduleId: schedule.id,
          receivableId: payment.order.receivable?.id ?? null,
          amountPaise: allocated,
        },
      });
      await tx.b2BPaymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidAmountPaise,
          status:
            paidAmountPaise >= schedule.amountPaise
              ? B2BPaymentScheduleStatus.PAID
              : B2BPaymentScheduleStatus.PARTIALLY_PAID,
        },
      });
      remaining -= allocated;
    }
    const allocatedAmountPaise = payment.amountPaise - remaining;
    const paidAmountPaise = Math.min(
      payment.order.buyerPayableAmountPaise,
      payment.order.paidAmountPaise + allocatedAmountPaise,
    );
    const paymentStatus =
      paidAmountPaise >= payment.order.buyerPayableAmountPaise
        ? B2BPaymentStatus.PAID
        : paidAmountPaise > 0
          ? B2BPaymentStatus.PARTIALLY_PAID
          : payment.order.paymentStatus;
    const closesOrder =
      paymentStatus === B2BPaymentStatus.PAID &&
      payment.order.status === B2BOrderStatus.DELIVERY_ACCEPTED;
    await tx.b2BOrder.update({
      where: { id: payment.b2bOrderId },
      data: {
        paidAmountPaise,
        paidAt: paymentStatus === B2BPaymentStatus.PAID ? new Date() : null,
        paymentStatus,
        paymentMethod: payment.method,
        ...(closesOrder
          ? {
              status: B2BOrderStatus.CLOSED,
              version: { increment: 1 },
              settlementStatus: SellerSettlementStatus.ELIGIBLE,
              settlementEligibleAt: new Date(),
            }
          : {}),
      },
    });
    if (closesOrder) {
      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: payment.b2bOrderId,
          status: B2BOrderStatus.CLOSED,
          note: "Buyer payment cleared after delivery acceptance; order closed.",
          payload: { paymentRecordId: payment.id },
        },
      });
      await this.enqueueOutbox(tx, payment.b2bOrderId, "order.closed", {
        paymentRecordId: payment.id,
        reason: "Delivery accepted and buyer payment cleared.",
      });
    }
    if (payment.order.receivable) {
      const outstanding = Math.max(
        0,
        payment.order.receivable.outstandingAmountPaise - allocatedAmountPaise,
      );
      await tx.b2BReceivable.update({
        where: { id: payment.order.receivable.id },
        data: {
          outstandingAmountPaise: outstanding,
          status:
            outstanding === 0
              ? B2BReceivableStatus.PAID
              : B2BReceivableStatus.PARTIALLY_PAID,
          closedAt: outstanding === 0 ? new Date() : null,
        },
      });
      await tx.b2BReceivableEntry.create({
        data: {
          receivableId: payment.order.receivable.id,
          entryType: "PAYMENT",
          description: `Payment ${payment.referenceNumber ?? payment.id}`,
          creditPaise: allocatedAmountPaise,
          balanceAfterPaise: outstanding,
          referenceType: "B2BPaymentRecord",
          referenceId: payment.id,
        },
      });
    }
    const receipt = await tx.b2BReceiptVoucher.create({
      data: {
        voucherNumber: this.reference("RV"),
        paymentRecordId: payment.id,
        issuedAt: new Date(),
      },
    });
    await this.enqueueOutbox(tx, payment.b2bOrderId, "receipt.issued", {
      paymentId: payment.id,
      voucherNumber: receipt.voucherNumber,
      amountPaise: payment.amountPaise,
      unallocatedAmountPaise: remaining,
    });
    const gateOutstanding = await tx.b2BPaymentSchedule.count({
      where: {
        b2bOrderId: payment.b2bOrderId,
        fulfilmentGate: true,
        status: {
          notIn: [B2BPaymentScheduleStatus.PAID, B2BPaymentScheduleStatus.WAIVED],
        },
      },
    });
    if (
      gateOutstanding === 0 &&
      payment.order.status === B2BOrderStatus.CREDIT_CLEARANCE_PENDING
    ) {
      await tx.b2BOrder.update({
        where: { id: payment.b2bOrderId },
        data: { status: B2BOrderStatus.IN_FULFILMENT, version: { increment: 1 } },
      });
      await tx.b2BOrderEvent.create({
        data: {
          b2bOrderId: payment.b2bOrderId,
          status: B2BOrderStatus.IN_FULFILMENT,
          note: "Required payment schedule cleared; fulfilment unlocked.",
        },
      });
    }
    return remaining;
  }

  private async creditExposure(businessBuyerId: string) {
    const aggregate = await this.prisma.client.b2BReceivable.aggregate({
      where: {
        order: { businessBuyerId },
        status: {
          in: [
            B2BReceivableStatus.OPEN,
            B2BReceivableStatus.PARTIALLY_PAID,
            B2BReceivableStatus.OVERDUE,
            B2BReceivableStatus.DISPUTED,
          ],
        },
      },
      _sum: { outstandingAmountPaise: true },
    });
    return aggregate._sum.outstandingAmountPaise ?? 0;
  }

  private async enqueueOutbox(
    tx: Prisma.TransactionClient,
    b2bOrderId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const connections = await tx.b2BErpConnection.findMany({
      where: {
        status: B2BErpConnectionStatus.ACTIVE,
        subscribedEvents: { has: eventType },
      },
      select: { id: true },
    });
    for (const connection of connections) {
      await tx.b2BIntegrationOutbox.create({
        data: {
          eventId: randomUUID(),
          connectionId: connection.id,
          b2bOrderId,
          eventType,
          aggregateType: "B2BOrder",
          aggregateId: b2bOrderId,
          payload: payload as Prisma.InputJsonValue,
          nextAttemptAt: new Date(),
        },
      });
    }
  }

  private recordMutation(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    b2bOrderId: string | null,
    scope: string,
    idempotencyKey: string,
    request: unknown,
  ) {
    return tx.b2BMutationRecord.create({
      data: {
        actorUserId,
        b2bOrderId,
        scope,
        idempotencyKey,
        requestHash: this.hash(request),
      },
    });
  }

  private wasProcessed(actorUserId: string, scope: string, idempotencyKey: string) {
    return this.prisma.client.b2BMutationRecord.findUnique({
      where: {
        actorUserId_scope_idempotencyKey: { actorUserId, scope, idempotencyKey },
      },
    });
  }

  private requireStatus(current: B2BOrderStatus, allowed: B2BOrderStatus[]) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `B2B order is ${current.replaceAll("_", " ").toLowerCase()} and cannot perform this action.`,
      );
    }
  }

  private assertVersion(current: number, requested: number) {
    if (current !== requested) {
      throw new ConflictException("B2B order changed. Refresh and retry with the latest version.");
    }
  }

  private requireIdempotencyKey(value: string | undefined) {
    const key = value?.trim();
    if (!key || key.length < 8 || key.length > 160) {
      throw new BadRequestException("Idempotency-Key header must contain 8 to 160 characters.");
    }
    return key;
  }

  private onlinePaymentOrderResponse(
    keyId: string,
    orderNumber: string,
    payment: {
      id: string;
      method: B2BPaymentMethod;
      providerOrderId: string | null;
      amountPaise: number;
      currency: string;
    },
  ) {
    if (!payment.providerOrderId) {
      throw new ServiceUnavailableException(
        "Razorpay provider order is not available yet.",
      );
    }
    return {
      keyId,
      razorpayOrderId: payment.providerOrderId,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      orderNumber,
      paymentRecordId: payment.id,
      paymentMethod: payment.method,
    };
  }

  private isPrismaUniqueError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }

  private assertEnabled() {
    if (process.env.B2B_ORDER_TO_CASH_V2_ENABLED !== "true") {
      throw new ServiceUnavailableException(
        "B2B order-to-cash V2 is disabled until migration and pilot verification are complete.",
      );
    }
  }

  private normalizeOrderNumber(value: string) {
    return decodeURIComponent(value).trim().toUpperCase();
  }

  private reference(prefix: string) {
    return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase()}`;
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private csvCell(value: unknown) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  private netTermDays(term: B2BPaymentTermType) {
    switch (term) {
      case B2BPaymentTermType.NET_7:
        return 7;
      case B2BPaymentTermType.NET_15:
        return 15;
      case B2BPaymentTermType.NET_30:
        return 30;
      case B2BPaymentTermType.NET_45:
        return 45;
      default:
        return 0;
    }
  }

  private invoiceDueAt(term: B2BPaymentTermType, issuedAt: Date) {
    return new Date(issuedAt.getTime() + this.netTermDays(term) * 86_400_000);
  }

  private async eWayThresholdPaise() {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: "gst.eway.threshold_paise" },
      select: { value: true },
    });
    const value =
      typeof setting?.value === "number"
        ? setting.value
        : typeof setting?.value === "string"
          ? Number(setting.value)
          : Number.NaN;
    return Number.isInteger(value) && value > 0 ? value : 5_000_000;
  }

  private positiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private erpKey() {
    const value = process.env.B2B_ERP_CREDENTIAL_ENCRYPTION_KEY?.trim();
    if (!value || value.length < 32) {
      throw new ServiceUnavailableException(
        "Set B2B_ERP_CREDENTIAL_ENCRYPTION_KEY before saving ERP credentials.",
      );
    }
    return createHash("sha256").update(value).digest();
  }

  private encryptErp(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.erpKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decryptErp(value: string) {
    const [version, iv, tag, encrypted] = value.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted) {
      throw new ServiceUnavailableException("Stored ERP credential is invalid.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.erpKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
