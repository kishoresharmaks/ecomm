import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  B2BOrderStatus,
  GstrSupplySection,
  ProductTaxClassification,
  Prisma,
  ServiceBookingStatus,
  ServiceQuoteLineType,
  ServiceQuoteStatus,
  SellerTaxRegistrationStatus,
  TaxDocumentLineType,
  TaxDocumentSource,
  TaxDocumentStatus,
  TaxDocumentType,
  TaxPriceMode,
  TaxSupplyType,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  renderTaxDocumentPdf,
  taxDocumentDownloadFileName,
  taxDocumentLabel,
} from "./tax-document-pdf";

type TaxDb = Prisma.TransactionClient | PrismaService["client"];

type TaxAddress = {
  fullName?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  countryCode?: string | null;
  stateCode?: string | null;
};

export type SellerTaxContext = {
  sellerId: string;
  storeName: string;
  legalName: string;
  registrationStatus: SellerTaxRegistrationStatus;
  gstin: string | null;
  address: TaxAddress;
};

export type OrderItemTaxSnapshot = {
  hsnCodeSnapshot: string | null;
  gstRatePercentSnapshot: Prisma.Decimal;
  supplierTaxRegistrationStatusSnapshot: SellerTaxRegistrationStatus;
  productTaxClassificationSnapshot: ProductTaxClassification;
  taxPriceModeSnapshot: TaxPriceMode;
  taxSupplyTypeSnapshot: TaxSupplyType;
  placeOfSupplyStateCodeSnapshot: string | null;
  supplierGstinSnapshot: string | null;
  buyerGstinSnapshot: string | null;
  grossTaxableConsiderationPaise: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  taxTotalPaise: number;
  taxSnapshotSource: TaxDocumentSource;
  taxSnapshot: Prisma.InputJsonValue;
};

@Injectable()
export class TaxDocumentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCustomerOrderDocuments(actorUserId: string, orderNumber: string) {
    const documents = await this.prisma.client.taxDocument.findMany({
      where: {
        status: TaxDocumentStatus.ISSUED,
        order: {
          orderNumber,
          customer: { userId: actorUserId },
        },
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        issueDate: true,
        supplyDate: true,
        sellerLegalName: true,
        sellerGstin: true,
        currency: true,
        invoiceValuePaise: true,
        totalTaxPaise: true,
        originalDocument: { select: { documentNumber: true } },
      },
    });

    return documents.map((document) => ({
      id: document.id,
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      label: taxDocumentLabel(document.documentType),
      status: document.status,
      issueDate: document.issueDate,
      supplyDate: document.supplyDate,
      sellerLegalName: document.sellerLegalName,
      sellerGstin: document.sellerGstin,
      currency: document.currency,
      invoiceValuePaise: document.invoiceValuePaise,
      totalTaxPaise: document.totalTaxPaise,
      originalDocumentNumber: document.originalDocument?.documentNumber ?? null,
      downloadFileName: taxDocumentDownloadFileName(document),
    }));
  }

  async customerOrderDocumentPdf(
    actorUserId: string,
    orderNumber: string,
    documentId: string,
  ) {
    return this.taxDocumentPdf(
      {
        id: documentId,
        status: TaxDocumentStatus.ISSUED,
        order: {
          orderNumber,
          customer: { userId: actorUserId },
        },
      },
      "Purchase document not found.",
    );
  }

  async sellerDocumentPdf(actorUserId: string, documentId: string) {
    return this.taxDocumentPdf(
      {
        id: documentId,
        status: TaxDocumentStatus.ISSUED,
        seller: { userId: actorUserId },
      },
      "Tax document not found.",
      actorUserId,
      "SELLER",
    );
  }

  async adminDocumentPdf(actorUserId: string, documentId: string) {
    return this.taxDocumentPdf(
      {
        id: documentId,
        status: TaxDocumentStatus.ISSUED,
      },
      "Tax document not found.",
      actorUserId,
      "ADMIN",
    );
  }

  private async taxDocumentPdf(
    where: Prisma.TaxDocumentWhereInput,
    notFoundMessage: string,
    actorUserId?: string,
    accessRole?: "SELLER" | "ADMIN",
  ) {
    const document = await this.prisma.client.taxDocument.findFirst({
      where,
      include: {
        originalDocument: { select: { documentNumber: true } },
        order: { select: { orderNumber: true } },
        b2bOrder: { select: { orderNumber: true } },
        serviceBooking: { select: { bookingNumber: true } },
        lines: true,
        compliance: true,
      },
    });

    const orderNumber =
      document?.order?.orderNumber ??
      document?.b2bOrder?.orderNumber ??
      document?.serviceBooking?.bookingNumber ??
      null;
    if (!document || !orderNumber) {
      throw new NotFoundException(notFoundMessage);
    }

    const buffer = renderTaxDocumentPdf({
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      issueDate: document.issueDate,
      supplyDate: document.supplyDate,
      orderNumber,
      originalDocumentNumber: document.originalDocument?.documentNumber ?? null,
      reason: document.reason,
      sellerLegalName: document.sellerLegalName,
      sellerTaxRegistrationStatus: document.sellerTaxRegistrationStatus,
      sellerGstin: document.sellerGstin,
      sellerAddressSnapshot: document.sellerAddressSnapshot,
      buyerLegalName: document.buyerLegalName,
      buyerGstin: document.buyerGstin,
      buyerAddressSnapshot: document.buyerAddressSnapshot,
      placeOfSupplyStateCode: document.placeOfSupplyStateCode,
      supplyType: document.supplyType,
      reverseCharge: document.reverseCharge,
      currency: document.currency,
      taxableValuePaise: document.taxableValuePaise,
      cgstPaise: document.cgstPaise,
      sgstPaise: document.sgstPaise,
      igstPaise: document.igstPaise,
      cessPaise: document.cessPaise,
      totalTaxPaise: document.totalTaxPaise,
      invoiceValuePaise: document.invoiceValuePaise,
      lines: document.lines,
      compliance: document.compliance,
    });

    if (actorUserId && accessRole) {
      await this.prisma.client.auditLog.create({
        data: {
          actorUserId,
          action: "GST_TAX_DOCUMENT_PDF_DOWNLOADED",
          entityType: "TaxDocument",
          entityId: document.id,
          newValue: {
            accessRole,
            sellerId: document.sellerId,
          },
        },
      });
    }

    return {
      buffer,
      fileName: taxDocumentDownloadFileName(document),
    };
  }

  customerServiceDocumentPdf(actorUserId: string, bookingNumber: string) {
    return this.taxDocumentPdf(
      {
        status: TaxDocumentStatus.ISSUED,
        source: TaxDocumentSource.SERVICE_BOOKING,
        serviceBooking: {
          bookingNumber,
          customer: { userId: actorUserId },
        },
      },
      "Service tax document not found.",
    );
  }

  sellerServiceDocumentPdf(actorUserId: string, bookingNumber: string) {
    return this.taxDocumentPdf(
      {
        status: TaxDocumentStatus.ISSUED,
        source: TaxDocumentSource.SERVICE_BOOKING,
        serviceBooking: {
          bookingNumber,
          seller: { userId: actorUserId },
        },
      },
      "Service tax document not found.",
      actorUserId,
      "SELLER",
    );
  }

  async sellerTaxContexts(db: TaxDb, sellerIds: string[]) {
    const uniqueSellerIds = [...new Set(sellerIds)];
    const sellers = await db.seller.findMany({
      where: { id: { in: uniqueSellerIds } },
      include: {
        profile: true,
        addresses: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    return new Map(
      sellers.map((seller) => {
        const address = seller.addresses[0];
        return [
          seller.id,
          {
            sellerId: seller.id,
            storeName: seller.storeName,
            legalName: seller.profile?.businessLegalName?.trim() || seller.storeName,
            registrationStatus:
              seller.profile?.taxRegistrationStatus ??
              (seller.profile?.gstNumber
                ? SellerTaxRegistrationStatus.GST_REGISTERED
                : SellerTaxRegistrationStatus.NOT_REGISTERED),
            gstin: this.normalizeGstin(seller.profile?.gstNumber),
            address: address
              ? {
                  line1: address.line1,
                  line2: address.line2,
                  area: address.area,
                  city: address.city,
                  state: address.state,
                  pincode: address.pincode,
                  country: address.country,
                  countryCode: address.countryCode,
                  stateCode: address.stateCode,
                }
              : {},
          } satisfies SellerTaxContext,
        ] as const;
      }),
    );
  }

  orderItemSnapshot(input: {
    lineTotalPaise: number;
    discountPaise: number;
    hsnCode?: string | null;
    gstRatePercent?: Prisma.Decimal | number | string | null;
    taxClassification?: ProductTaxClassification;
    seller: SellerTaxContext;
    buyerAddress: unknown;
    buyerGstin?: string | null;
    source?: TaxDocumentSource;
  }): OrderItemTaxSnapshot {
    const buyerAddress = this.addressFromJson(input.buyerAddress);
    const sellerCountry = input.seller.address.countryCode?.toUpperCase() || "IN";
    const buyerCountry = buyerAddress.countryCode?.toUpperCase() || "IN";
    const sellerStateCode = this.normalizeStateCode(input.seller.address.stateCode);
    const buyerStateCode = this.normalizeStateCode(buyerAddress.stateCode) || sellerStateCode;
    const supplyType =
      sellerCountry !== "IN" || buyerCountry !== "IN"
        ? TaxSupplyType.OUTSIDE_INDIA
        : sellerStateCode && buyerStateCode && sellerStateCode === buyerStateCode
          ? TaxSupplyType.INTRA_STATE
          : TaxSupplyType.INTER_STATE;
    const gstin = this.normalizeGstin(input.seller.gstin);
    const registrationStatus = input.seller.registrationStatus;
    const taxClassification =
      input.taxClassification ?? ProductTaxClassification.TAXABLE;
    const hsnCode = input.hsnCode?.trim() || null;
    const gstRatePercent = this.normalizedRate(input.gstRatePercent);

    if (
      registrationStatus === SellerTaxRegistrationStatus.NOT_REGISTERED &&
      gstin
    ) {
      throw new BadRequestException(
        `${input.seller.storeName} is marked as not GST registered but still has a GSTIN.`,
      );
    }
    if (
      registrationStatus !== SellerTaxRegistrationStatus.NOT_REGISTERED &&
      !gstin
    ) {
      throw new BadRequestException(
        `${input.seller.storeName} must add a valid GSTIN for its selected tax registration status.`,
      );
    }
    if (
      registrationStatus !== SellerTaxRegistrationStatus.NOT_REGISTERED &&
      sellerCountry === "IN"
    ) {
      if (!sellerStateCode) {
        throw new BadRequestException(
          `${input.seller.storeName} must add a GST state code before orders can be placed.`,
        );
      }
    }
    if (
      registrationStatus === SellerTaxRegistrationStatus.GST_REGISTERED &&
      taxClassification === ProductTaxClassification.TAXABLE &&
      (!hsnCode || gstRatePercent === null || gstRatePercent <= 0)
    ) {
      throw new BadRequestException(
        `${input.seller.storeName} has a GST registration, but this taxable product is missing approved HSN/GST data.`,
      );
    }
    if (
      taxClassification !== ProductTaxClassification.TAXABLE &&
      gstRatePercent !== null &&
      gstRatePercent > 0
    ) {
      throw new BadRequestException(
        `${taxClassification.replaceAll("_", " ").toLowerCase()} supplies cannot carry a positive GST rate.`,
      );
    }
    if (
      taxClassification === ProductTaxClassification.NIL_RATED &&
      !hsnCode
    ) {
      throw new BadRequestException(
        "Nil-rated products require an HSN code.",
      );
    }

    const considerationPaise = Math.max(
      0,
      input.lineTotalPaise - Math.max(0, input.discountPaise),
    );
    const appliedRate =
      registrationStatus === SellerTaxRegistrationStatus.GST_REGISTERED &&
      taxClassification === ProductTaxClassification.TAXABLE
        ? (gstRatePercent ?? 0)
        : 0;
    const calculated = this.calculateInclusiveTax(
      considerationPaise,
      appliedRate,
      supplyType,
    );
    const source = input.source ?? TaxDocumentSource.CHECKOUT;
    const buyerGstin = this.normalizeGstin(input.buyerGstin);

    return {
      hsnCodeSnapshot: hsnCode,
      gstRatePercentSnapshot: new Prisma.Decimal(appliedRate),
      supplierTaxRegistrationStatusSnapshot: registrationStatus,
      productTaxClassificationSnapshot: taxClassification,
      taxPriceModeSnapshot: TaxPriceMode.INCLUSIVE,
      taxSupplyTypeSnapshot: supplyType,
      placeOfSupplyStateCodeSnapshot: buyerStateCode,
      supplierGstinSnapshot: gstin,
      buyerGstinSnapshot: buyerGstin,
      grossTaxableConsiderationPaise: considerationPaise,
      taxableValuePaise: calculated.taxableValuePaise,
      cgstPaise: calculated.cgstPaise,
      sgstPaise: calculated.sgstPaise,
      igstPaise: calculated.igstPaise,
      cessPaise: 0,
      taxTotalPaise: calculated.taxTotalPaise,
      taxSnapshotSource: source,
      taxSnapshot: {
        version: 2,
        source,
        priceMode: TaxPriceMode.INCLUSIVE,
        sellerStateCode,
        placeOfSupplyStateCode: buyerStateCode,
        supplyType,
        sellerTaxRegistrationStatus: registrationStatus,
        productTaxClassification: taxClassification,
        grossLineValuePaise: input.lineTotalPaise,
        discountPaise: Math.max(0, input.discountPaise),
        considerationPaise,
        hsnCode,
        gstRatePercent: appliedRate,
        taxableValuePaise: calculated.taxableValuePaise,
        cgstPaise: calculated.cgstPaise,
        sgstPaise: calculated.sgstPaise,
        igstPaise: calculated.igstPaise,
        cessPaise: 0,
        taxTotalPaise: calculated.taxTotalPaise,
      },
    };
  }

  async createDraftOrderDocuments(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { user: true } },
        items: true,
        sellerSplits: {
          include: {
            seller: {
              include: {
                profile: true,
                addresses: { orderBy: { createdAt: "asc" }, take: 1 },
              },
            },
            shipment: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException("Order not found while preparing tax documents.");
    }

    const buyerAddress = this.addressFromJson(order.shippingAddressSnapshot);
    const buyerLegalName =
      order.buyerLegalNameSnapshot?.trim() ||
      buyerAddress.fullName?.trim() ||
      order.customer.user.fullName?.trim() ||
      order.customer.user.email;

    for (const split of order.sellerSplits) {
      const idempotencyKey = `order:${order.id}:seller:${split.sellerId}:outward-supply`;
      const existing = await tx.taxDocument.findUnique({ where: { idempotencyKey } });
      if (existing) {
        continue;
      }
      const sellerAddress = split.seller.addresses[0];
      const sellerGstin = this.normalizeGstin(split.seller.profile?.gstNumber);
      const registrationStatus =
        split.seller.profile?.taxRegistrationStatus ??
        (sellerGstin
          ? SellerTaxRegistrationStatus.GST_REGISTERED
          : SellerTaxRegistrationStatus.NOT_REGISTERED);
      const items = order.items.filter(
        (item) => item.sellerId === split.sellerId && item.activeQuantity > 0,
      );
      if (items.length === 0) {
        continue;
      }
      const principalItem = items.reduce<(typeof items)[number] | null>(
        (selected, item) =>
          !selected ||
          this.prorate(
            item.grossTaxableConsiderationPaise,
            item.activeQuantity,
            item.quantity,
          ) >
            this.prorate(
              selected.grossTaxableConsiderationPaise,
              selected.activeQuantity,
              selected.quantity,
            )
            ? item
            : selected,
        null,
      );
      const shippingTax = this.calculateInclusiveTax(
        split.shipment?.shippingPaise ?? 0,
        registrationStatus === SellerTaxRegistrationStatus.GST_REGISTERED &&
          principalItem?.productTaxClassificationSnapshot ===
            ProductTaxClassification.TAXABLE
          ? Number(principalItem.gstRatePercentSnapshot ?? 0)
          : 0,
        principalItem?.taxSupplyTypeSnapshot ?? TaxSupplyType.INTER_STATE,
      );
      const itemTaxable = items.reduce(
        (sum, item) =>
          sum + this.prorate(item.taxableValuePaise, item.activeQuantity, item.quantity),
        0,
      );
      const itemCgst = items.reduce(
        (sum, item) => sum + this.prorate(item.cgstPaise, item.activeQuantity, item.quantity),
        0,
      );
      const itemSgst = items.reduce(
        (sum, item) => sum + this.prorate(item.sgstPaise, item.activeQuantity, item.quantity),
        0,
      );
      const itemIgst = items.reduce(
        (sum, item) => sum + this.prorate(item.igstPaise, item.activeQuantity, item.quantity),
        0,
      );
      const itemCess = items.reduce(
        (sum, item) => sum + this.prorate(item.cessPaise, item.activeQuantity, item.quantity),
        0,
      );
      const taxableValuePaise = itemTaxable + shippingTax.taxableValuePaise;
      const cgstPaise = itemCgst + shippingTax.cgstPaise;
      const sgstPaise = itemSgst + shippingTax.sgstPaise;
      const igstPaise = itemIgst + shippingTax.igstPaise;
      const cessPaise = itemCess;
      const totalTaxPaise = cgstPaise + sgstPaise + igstPaise + cessPaise;
      const invoiceValuePaise =
        items.reduce(
          (sum, item) =>
            sum +
            this.prorate(
              item.grossTaxableConsiderationPaise,
              item.activeQuantity,
              item.quantity,
            ),
          0,
        ) +
        (split.shipment?.shippingPaise ?? 0);
      const supplyType =
        principalItem?.taxSupplyTypeSnapshot ??
        (buyerAddress.countryCode?.toUpperCase() === "IN"
          ? TaxSupplyType.INTER_STATE
          : TaxSupplyType.OUTSIDE_INDIA);

      await tx.taxDocument.create({
        data: {
          documentType: this.outwardDocumentType(
            registrationStatus,
            items.map((item) => item.productTaxClassificationSnapshot),
          ),
          status: TaxDocumentStatus.DRAFT,
          source: TaxDocumentSource.CHECKOUT,
          idempotencyKey,
          financialYear: this.financialYear(order.createdAt),
          orderId: order.id,
          orderSellerSplitId: split.id,
          sellerId: split.sellerId,
          supplyDate: order.createdAt,
          sellerLegalName:
            split.seller.profile?.businessLegalName?.trim() || split.seller.storeName,
          sellerTaxRegistrationStatus: registrationStatus,
          sellerGstin,
          sellerAddressSnapshot: this.jsonAddress(
            sellerAddress
              ? {
                  line1: sellerAddress.line1,
                  line2: sellerAddress.line2,
                  area: sellerAddress.area,
                  city: sellerAddress.city,
                  state: sellerAddress.state,
                  pincode: sellerAddress.pincode,
                  country: sellerAddress.country,
                  countryCode: sellerAddress.countryCode,
                  stateCode: sellerAddress.stateCode,
                }
              : {},
          ),
          buyerLegalName,
          buyerGstin: this.normalizeGstin(order.buyerGstinSnapshot),
          buyerAddressSnapshot: this.jsonAddress(buyerAddress),
          placeOfSupplyStateCode: this.normalizeStateCode(buyerAddress.stateCode),
          supplyType,
          gstrSupplySection: this.gstrSection({
            registrationStatus,
            buyerGstin: order.buyerGstinSnapshot,
            supplyType,
            invoiceValuePaise,
            classifications: items.map(
              (item) => item.productTaxClassificationSnapshot,
            ),
          }),
          currency: order.currency,
          taxableValuePaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          cessPaise,
          totalTaxPaise,
          invoiceValuePaise,
          lines: {
            create: [
              ...items.map((item) => ({
                orderItemId: item.id,
                lineType: TaxDocumentLineType.PRODUCT,
                description: item.productNameSnapshot,
                sku: this.stringFromJson(item.variantSnapshot, "sku"),
                hsnSacCode: item.hsnCodeSnapshot,
                taxClassification: item.productTaxClassificationSnapshot,
                quantity: item.activeQuantity,
                unitPricePaise: item.unitPricePaise,
                grossValuePaise: this.prorate(
                  item.lineTotalPaise,
                  item.activeQuantity,
                  item.quantity,
                ),
                discountPaise: this.prorate(
                  item.couponDiscountPaise,
                  item.activeQuantity,
                  item.quantity,
                ),
                taxableValuePaise: this.prorate(
                  item.taxableValuePaise,
                  item.activeQuantity,
                  item.quantity,
                ),
                gstRatePercent: item.gstRatePercentSnapshot,
                cgstPaise: this.prorate(item.cgstPaise, item.activeQuantity, item.quantity),
                sgstPaise: this.prorate(item.sgstPaise, item.activeQuantity, item.quantity),
                igstPaise: this.prorate(item.igstPaise, item.activeQuantity, item.quantity),
                cessPaise: this.prorate(item.cessPaise, item.activeQuantity, item.quantity),
                totalTaxPaise: this.prorate(
                  item.taxTotalPaise,
                  item.activeQuantity,
                  item.quantity,
                ),
                lineValuePaise: this.prorate(
                  item.grossTaxableConsiderationPaise,
                  item.activeQuantity,
                  item.quantity,
                ),
              })),
              ...((split.shipment?.shippingPaise ?? 0) > 0
                ? [
                    {
                      lineType: TaxDocumentLineType.SHIPPING,
                      description: "Shipping and handling",
                      taxClassification:
                        principalItem?.productTaxClassificationSnapshot ??
                        ProductTaxClassification.NON_GST,
                      quantity: 1,
                      unitPricePaise: split.shipment!.shippingPaise,
                      grossValuePaise: split.shipment!.shippingPaise,
                      taxableValuePaise: shippingTax.taxableValuePaise,
                      gstRatePercent: principalItem?.gstRatePercentSnapshot ?? new Prisma.Decimal(0),
                      cgstPaise: shippingTax.cgstPaise,
                      sgstPaise: shippingTax.sgstPaise,
                      igstPaise: shippingTax.igstPaise,
                      totalTaxPaise: shippingTax.taxTotalPaise,
                      lineValuePaise: split.shipment!.shippingPaise,
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }
  }

  async issueOrderSellerDocument(
    tx: Prisma.TransactionClient,
    orderId: string,
    sellerId: string,
    actorUserId?: string | null,
  ) {
    let document = await tx.taxDocument.findFirst({
      where: {
        orderId,
        sellerId,
        source: TaxDocumentSource.CHECKOUT,
      },
    });
    if (!document) {
      await this.createDraftOrderDocuments(tx, orderId);
      document = await tx.taxDocument.findFirst({
        where: {
          orderId,
          sellerId,
          source: TaxDocumentSource.CHECKOUT,
        },
      });
    }
    if (!document || document.status === TaxDocumentStatus.ISSUED) {
      return document;
    }
    if (document.status === TaxDocumentStatus.CANCELLED) {
      throw new BadRequestException("Cancelled tax documents cannot be issued.");
    }
    const documentNumber = await this.nextDocumentNumber(
      tx,
      sellerId,
      document.financialYear,
      document.documentType,
    );
    return tx.taxDocument.update({
      where: { id: document.id },
      data: {
        documentNumber,
        status: TaxDocumentStatus.ISSUED,
        issueDate: new Date(),
        issuedById: actorUserId ?? null,
      },
    });
  }

  async issueServiceBookingDocument(
    serviceBookingId: string,
    actorUserId?: string | null,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const booking = await tx.serviceBooking.findUnique({
        where: { id: serviceBookingId },
        include: {
          listing: true,
          quotes: {
            where: { status: ServiceQuoteStatus.ACCEPTED },
            include: { lineItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
            orderBy: { acceptedAt: "desc" },
            take: 1,
          },
          taxDocuments: {
            where: { source: TaxDocumentSource.SERVICE_BOOKING },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (!booking) {
        throw new NotFoundException("Service booking not found while issuing tax document.");
      }
      if (
        booking.status !== ServiceBookingStatus.COMPLETED &&
        booking.status !== ServiceBookingStatus.CLOSED_AFTER_INSPECTION
      ) {
        throw new BadRequestException(
          "Service tax documents can be issued only after completion or a paid inspection closes.",
        );
      }
      const existing = booking.taxDocuments[0];
      if (existing?.status === TaxDocumentStatus.ISSUED) {
        return existing;
      }

      const issueDate = booking.completionConfirmedAt ?? new Date();
      const acceptedQuote = booking.quotes?.[0];
      const classifications =
        acceptedQuote?.lineItems.map((line) => line.taxClassification) ??
        [booking.serviceTaxClassificationSnapshot];
      const documentType = this.outwardDocumentType(
        booking.sellerTaxRegistrationStatusSnapshot,
        classifications,
      );
      const financialYear = this.financialYear(issueDate);
      const documentNumber = await this.nextDocumentNumber(
        tx,
        booking.sellerId,
        financialYear,
        documentType,
      );
      const data: Prisma.TaxDocumentCreateInput = {
        documentNumber,
        documentType,
        status: TaxDocumentStatus.ISSUED,
        source: TaxDocumentSource.SERVICE_BOOKING,
        idempotencyKey: `service-booking:${booking.id}:outward-supply`,
        financialYear,
        serviceBooking: { connect: { id: booking.id } },
        seller: { connect: { id: booking.sellerId } },
        issueDate,
        supplyDate: issueDate,
        sellerLegalName: booking.sellerLegalNameSnapshot,
        sellerTaxRegistrationStatus: booking.sellerTaxRegistrationStatusSnapshot,
        sellerGstin: booking.sellerGstinSnapshot,
        sellerAddressSnapshot: this.requiredJsonObject(
          booking.sellerAddressSnapshot,
          "seller address",
        ),
        buyerLegalName: booking.buyerLegalNameSnapshot,
        buyerGstin: booking.buyerGstinSnapshot,
        buyerAddressSnapshot: this.requiredJsonObject(
          booking.buyerAddressSnapshot,
          "buyer address",
        ),
        placeOfSupplyStateCode: booking.placeOfSupplyStateCodeSnapshot,
        supplyType: booking.taxSupplyTypeSnapshot,
        gstrSupplySection: this.gstrSection({
          registrationStatus: booking.sellerTaxRegistrationStatusSnapshot,
          buyerGstin: booking.buyerGstinSnapshot,
          supplyType: booking.taxSupplyTypeSnapshot,
          invoiceValuePaise: booking.totalPayablePaise,
          classifications,
        }),
        currency: booking.currency,
        taxableValuePaise: booking.taxableValuePaise,
        cgstPaise: booking.cgstPaise,
        sgstPaise: booking.sgstPaise,
        igstPaise: booking.igstPaise,
        cessPaise: booking.cessPaise,
        totalTaxPaise: booking.taxTotalPaise,
        invoiceValuePaise: booking.totalPayablePaise,
        ...(actorUserId ? { issuedBy: { connect: { id: actorUserId } } } : {}),
        lines: {
          create: acceptedQuote?.lineItems.length
            ? acceptedQuote.lineItems.map((line) => ({
                lineType:
                  line.lineType === ServiceQuoteLineType.PRODUCT
                    ? TaxDocumentLineType.PRODUCT
                    : TaxDocumentLineType.SERVICE,
                description: line.description,
                hsnSacCode: line.hsnSacCode,
                classificationDescriptionSnapshot:
                  line.classificationDescriptionSnapshot,
                classificationSourceSnapshot: line.classificationSourceSnapshot,
                taxSnapshotVersion: line.taxSnapshotVersion,
                taxClassification: line.taxClassification,
                quantity: line.quantity,
                uqc: line.uqc,
                unitPricePaise: line.unitPaise,
                grossValuePaise: line.totalPaise,
                taxableValuePaise: line.taxableValuePaise,
                gstRatePercent: line.gstRatePercent,
                cgstPaise: line.cgstPaise,
                sgstPaise: line.sgstPaise,
                igstPaise: line.igstPaise,
                cessPaise: line.cessPaise,
                totalTaxPaise: line.taxTotalPaise,
                lineValuePaise: line.totalPaise,
              }))
            : {
                lineType: TaxDocumentLineType.SERVICE,
                description: booking.listing.title,
                hsnSacCode: booking.sacCodeSnapshot,
                classificationDescriptionSnapshot: booking.sacDescriptionSnapshot,
                classificationSourceSnapshot: booking.sacSourceReferenceSnapshot,
                taxSnapshotVersion: booking.taxSnapshotVersion,
                taxClassification: booking.serviceTaxClassificationSnapshot,
                quantity: 1,
                unitPricePaise: booking.totalPayablePaise,
                grossValuePaise: booking.totalPayablePaise,
                taxableValuePaise: booking.taxableValuePaise,
                gstRatePercent: booking.gstRatePercentSnapshot,
                cgstPaise: booking.cgstPaise,
                sgstPaise: booking.sgstPaise,
                igstPaise: booking.igstPaise,
                cessPaise: booking.cessPaise,
                totalTaxPaise: booking.taxTotalPaise,
                lineValuePaise: booking.totalPayablePaise,
              },
        },
        compliance: { create: {} },
      };

      return existing
        ? tx.taxDocument.update({
            where: { id: existing.id },
            data: {
              documentNumber,
              documentType,
              status: TaxDocumentStatus.ISSUED,
              issueDate,
              issuedById: actorUserId ?? null,
            },
          })
        : tx.taxDocument.create({ data });
    });
  }

  async cancelDraftOrderDocuments(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
  ) {
    await tx.taxDocument.updateMany({
      where: { orderId, status: TaxDocumentStatus.DRAFT },
      data: {
        status: TaxDocumentStatus.CANCELLED,
        voidedAt: new Date(),
        voidReason: reason,
      },
    });
  }

  async refreshDraftOrderDocuments(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    await tx.taxDocument.deleteMany({
      where: { orderId, status: TaxDocumentStatus.DRAFT },
    });
    await this.createDraftOrderDocuments(tx, orderId);
  }

  async createCreditNotesForRefund(
    tx: Prisma.TransactionClient,
    refundId: string,
    actorUserId?: string | null,
  ) {
    const refund = await tx.refundRequest.findUnique({
      where: { id: refundId },
      include: {
        items: {
          include: {
            orderItem: true,
            returnRequestItem: true,
          },
        },
      },
    });
    if (!refund) {
      throw new NotFoundException("Refund request not found while creating credit notes.");
    }
    const sellerIds = [...new Set(refund.items.map((item) => item.sellerId))];
    const contexts = await this.sellerTaxContexts(tx, sellerIds);

    for (const sellerId of sellerIds) {
      const idempotencyKey = `refund:${refund.id}:seller:${sellerId}:credit-note`;
      if (await tx.taxDocument.findUnique({ where: { idempotencyKey } })) {
        continue;
      }
      const original = await tx.taxDocument.findFirst({
        where: {
          orderId: refund.orderId,
          sellerId,
          status: TaxDocumentStatus.ISSUED,
          documentType: {
            in: [
              TaxDocumentType.TAX_INVOICE,
              TaxDocumentType.BILL_OF_SUPPLY,
              TaxDocumentType.COMMERCIAL_INVOICE,
            ],
          },
        },
      });
      if (!original) {
        continue;
      }
      const sellerItems = refund.items.filter((item) => item.sellerId === sellerId);
      const lines = sellerItems.map((item) => {
        const considerationCap = this.prorate(
          item.orderItem.grossTaxableConsiderationPaise,
          item.quantity,
          item.orderItem.quantity,
        );
        const considerationPaise = Math.min(
          considerationCap,
          Math.max(0, item.amountPaise + item.platformFundedCouponAdjustmentPaise),
        );
        const tax = this.calculateInclusiveTax(
          considerationPaise,
          Number(item.orderItem.gstRatePercentSnapshot ?? 0),
          item.orderItem.taxSupplyTypeSnapshot ?? TaxSupplyType.INTER_STATE,
        );
        return {
          refundRequestItemId: item.id,
          returnRequestItemId: item.returnRequestItemId,
          orderItemId: item.orderItemId,
          lineType: TaxDocumentLineType.ADJUSTMENT,
          description: `Credit for ${item.orderItem.productNameSnapshot}`,
          sku: this.stringFromJson(item.orderItem.variantSnapshot, "sku"),
          hsnSacCode: item.orderItem.hsnCodeSnapshot,
          taxClassification: item.orderItem.productTaxClassificationSnapshot,
          quantity: item.quantity,
          unitPricePaise: item.quantity > 0 ? Math.round(considerationPaise / item.quantity) : 0,
          grossValuePaise: considerationPaise,
          taxableValuePaise: tax.taxableValuePaise,
          gstRatePercent: item.orderItem.gstRatePercentSnapshot,
          cgstPaise: tax.cgstPaise,
          sgstPaise: tax.sgstPaise,
          igstPaise: tax.igstPaise,
          cessPaise: 0,
          totalTaxPaise: tax.taxTotalPaise,
          lineValuePaise: considerationPaise,
        };
      });
      const context = contexts.get(sellerId);
      if (!context) {
        throw new BadRequestException("Seller tax profile is unavailable.");
      }
      const taxableValuePaise = lines.reduce((sum, line) => sum + line.taxableValuePaise, 0);
      const cgstPaise = lines.reduce((sum, line) => sum + line.cgstPaise, 0);
      const sgstPaise = lines.reduce((sum, line) => sum + line.sgstPaise, 0);
      const igstPaise = lines.reduce((sum, line) => sum + line.igstPaise, 0);
      const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
      const invoiceValuePaise = lines.reduce((sum, line) => sum + line.lineValuePaise, 0);
      const documentType = TaxDocumentType.CREDIT_NOTE;
      const documentNumber = await this.nextDocumentNumber(
        tx,
        sellerId,
        original.financialYear,
        documentType,
      );
      const issueDate = new Date();
      const creditNote = await tx.taxDocument.create({
        data: {
          documentNumber,
          documentType,
          status: TaxDocumentStatus.DRAFT,
          source: TaxDocumentSource.RETURN_REFUND,
          idempotencyKey,
          financialYear: original.financialYear,
          orderId: refund.orderId,
          orderSellerSplitId: original.orderSellerSplitId,
          sellerId,
          returnRequestId: refund.returnRequestId,
          refundRequestId: refund.id,
          originalDocumentId: original.id,
          supplyDate: original.supplyDate,
          sellerLegalName: original.sellerLegalName,
          sellerTaxRegistrationStatus: original.sellerTaxRegistrationStatus,
          sellerGstin: original.sellerGstin,
          sellerAddressSnapshot: this.requiredJsonObject(
            original.sellerAddressSnapshot,
            "seller address",
          ),
          buyerLegalName: original.buyerLegalName,
          buyerGstin: original.buyerGstin,
          buyerAddressSnapshot: this.requiredJsonObject(
            original.buyerAddressSnapshot,
            "buyer address",
          ),
          placeOfSupplyStateCode: original.placeOfSupplyStateCode,
          supplyType: original.supplyType,
          gstrSupplySection: this.creditNoteGstrSection({
            originalSection: original.gstrSupplySection,
            buyerGstin: original.buyerGstin,
          }),
          reverseCharge: original.reverseCharge,
          currency: refund.currency,
          taxableValuePaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          totalTaxPaise,
          invoiceValuePaise,
          reason: refund.note || `Refund ${refund.refundNumber}`,
          lines: { create: lines },
        },
      });
      await tx.taxDocument.update({
        where: { id: creditNote.id },
        data: {
          status: TaxDocumentStatus.ISSUED,
          issueDate,
          issuedById: actorUserId ?? null,
        },
      });
    }
  }

  async createB2bCreditNote(
    tx: Prisma.TransactionClient,
    input: {
      b2bOrderId: string;
      originalDocumentId: string;
      amountPaise: number;
      reason: string;
      actorUserId: string;
      idempotencyKey: string;
      line?: {
        description: string;
        hsnSacCode?: string | null;
        taxClassification: ProductTaxClassification;
        quantity: number;
        gstRatePercent?: Prisma.Decimal | number | string | null;
      } | null;
    },
  ) {
    const existing = await tx.taxDocument.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { lines: true },
    });
    if (existing) return existing;
    const original = await tx.taxDocument.findFirst({
      where: {
        id: input.originalDocumentId,
        b2bOrderId: input.b2bOrderId,
        status: TaxDocumentStatus.ISSUED,
        documentType: {
          in: [
            TaxDocumentType.TAX_INVOICE,
            TaxDocumentType.BILL_OF_SUPPLY,
            TaxDocumentType.COMMERCIAL_INVOICE,
          ],
        },
      },
      include: { lines: { orderBy: { createdAt: "asc" } } },
    });
    if (!original) {
      throw new NotFoundException("The original issued B2B invoice was not found.");
    }
    const previousCredits = await tx.taxDocument.aggregate({
      where: {
        originalDocumentId: original.id,
        documentType: TaxDocumentType.CREDIT_NOTE,
        status: TaxDocumentStatus.ISSUED,
      },
      _sum: { invoiceValuePaise: true },
    });
    const availableAmountPaise = Math.max(
      0,
      original.invoiceValuePaise -
        (previousCredits._sum.invoiceValuePaise ?? 0),
    );
    if (input.amountPaise <= 0 || input.amountPaise > availableAmountPaise) {
      throw new BadRequestException(
        "B2B credit-note amount exceeds the remaining original invoice value.",
      );
    }
    const originalLine = original.lines[0];
    const taxClassification =
      input.line?.taxClassification ??
      originalLine?.taxClassification ??
      ProductTaxClassification.NON_GST;
    const gstRatePercent =
      original.sellerTaxRegistrationStatus ===
        SellerTaxRegistrationStatus.GST_REGISTERED &&
      taxClassification === ProductTaxClassification.TAXABLE
        ? Number(
            input.line?.gstRatePercent ??
              originalLine?.gstRatePercent ??
              0,
          )
        : 0;
    const tax = this.calculateInclusiveTax(
      input.amountPaise,
      gstRatePercent,
      original.supplyType ?? TaxSupplyType.INTER_STATE,
    );
    const issueDate = new Date();
    const documentNumber = await this.nextDocumentNumber(
      tx,
      original.sellerId,
      original.financialYear,
      TaxDocumentType.CREDIT_NOTE,
    );
    const quantity = Math.max(1, input.line?.quantity ?? 1);
    return tx.taxDocument.create({
      data: {
        documentNumber,
        documentType: TaxDocumentType.CREDIT_NOTE,
        status: TaxDocumentStatus.ISSUED,
        source: TaxDocumentSource.MANUAL_ADJUSTMENT,
        idempotencyKey: input.idempotencyKey,
        financialYear: original.financialYear,
        b2bOrderId: input.b2bOrderId,
        sellerId: original.sellerId,
        originalDocumentId: original.id,
        issueDate,
        supplyDate: original.supplyDate,
        sellerLegalName: original.sellerLegalName,
        sellerTaxRegistrationStatus: original.sellerTaxRegistrationStatus,
        sellerGstin: original.sellerGstin,
        sellerAddressSnapshot: this.requiredJsonObject(
          original.sellerAddressSnapshot,
          "seller address",
        ),
        buyerLegalName: original.buyerLegalName,
        buyerGstin: original.buyerGstin,
        buyerAddressSnapshot: this.requiredJsonObject(
          original.buyerAddressSnapshot,
          "buyer address",
        ),
        placeOfSupplyStateCode: original.placeOfSupplyStateCode,
        supplyType: original.supplyType,
        gstrSupplySection: this.creditNoteGstrSection({
          originalSection: original.gstrSupplySection,
          buyerGstin: original.buyerGstin,
        }),
        reverseCharge: original.reverseCharge,
        currency: original.currency,
        taxableValuePaise: tax.taxableValuePaise,
        cgstPaise: tax.cgstPaise,
        sgstPaise: tax.sgstPaise,
        igstPaise: tax.igstPaise,
        totalTaxPaise: tax.taxTotalPaise,
        invoiceValuePaise: input.amountPaise,
        reason: input.reason,
        issuedById: input.actorUserId,
        lines: {
          create: {
            lineType: TaxDocumentLineType.ADJUSTMENT,
            description:
              input.line?.description ??
              `Adjustment against ${original.documentNumber ?? original.id}`,
            hsnSacCode:
              input.line?.hsnSacCode ?? originalLine?.hsnSacCode ?? null,
            taxClassification,
            quantity,
            unitPricePaise: Math.round(input.amountPaise / quantity),
            grossValuePaise: input.amountPaise,
            taxableValuePaise: tax.taxableValuePaise,
            gstRatePercent: new Prisma.Decimal(gstRatePercent),
            cgstPaise: tax.cgstPaise,
            sgstPaise: tax.sgstPaise,
            igstPaise: tax.igstPaise,
            totalTaxPaise: tax.taxTotalPaise,
            lineValuePaise: input.amountPaise,
          },
        },
      },
      include: { lines: true },
    });
  }

  async issueB2bDocument(b2bOrderId: string, actorUserId?: string | null) {
    return this.prisma.client.$transaction(async (tx) => {
      const idempotencyKey = `b2b-order:${b2bOrderId}:outward-supply`;
      const existing = await tx.taxDocument.findUnique({
        where: { idempotencyKey },
        include: { lines: true },
      });
      if (existing) {
        return existing;
      }
      const order = await tx.b2BOrder.findUnique({
        where: { id: b2bOrderId },
        include: {
          product: true,
          lines: {
            include: {
              product: true,
              productVariant: true,
            },
            orderBy: { lineNumber: "asc" },
          },
          seller: {
            include: {
              profile: true,
              addresses: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          },
          businessBuyer: {
            include: {
              addresses: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          },
        },
      });
      const invoiceEligibleStatuses = new Set<B2BOrderStatus>([
        B2BOrderStatus.PACKED_AND_QC_PASSED,
        B2BOrderStatus.TAX_INVOICE_ISSUED,
        B2BOrderStatus.E_WAY_READY,
        B2BOrderStatus.E_WAY_NOT_REQUIRED,
        B2BOrderStatus.DISPATCHED,
        B2BOrderStatus.IN_TRANSIT,
        B2BOrderStatus.DELIVERED,
        B2BOrderStatus.DELIVERY_ACCEPTED,
        B2BOrderStatus.CLOSED,
        B2BOrderStatus.FULFILLED,
      ]);
      if (!order || !invoiceEligibleStatuses.has(order.status)) {
        throw new BadRequestException("B2B final invoice is available after packing and QC pass.");
      }
      if (!order.seller || !order.sellerId) {
        throw new BadRequestException("B2B order seller is required for tax invoicing.");
      }
      const sellerAddress = order.seller.addresses[0];
      const buyerAddress = order.deliveryAddressSnapshot
        ? this.addressFromJson(order.deliveryAddressSnapshot)
        : order.businessBuyer.addresses[0];
      const sellerGstin = this.normalizeGstin(order.seller.profile?.gstNumber);
      const registrationStatus =
        order.seller.profile?.taxRegistrationStatus ??
        (sellerGstin
          ? SellerTaxRegistrationStatus.GST_REGISTERED
          : SellerTaxRegistrationStatus.NOT_REGISTERED);
      const buyerGstin = this.normalizeGstin(order.businessBuyer.gstNumber);
      const sellerStateCode = this.normalizeStateCode(sellerAddress?.stateCode);
      const buyerStateCode = this.normalizeStateCode(buyerAddress?.stateCode);
      const supplyType =
        sellerStateCode && buyerStateCode && sellerStateCode === buyerStateCode
          ? TaxSupplyType.INTRA_STATE
          : TaxSupplyType.INTER_STATE;
      const orderLines = order.lines ?? [];
      const sourceLines =
        orderLines.length > 0
          ? orderLines.map((line) => ({
              description: line.description,
              sku: line.sku ?? line.productVariant?.sku ?? null,
              hsnSacCode: line.hsnSacCode ?? line.product?.hsnCode ?? null,
              taxClassification:
                line.taxClassification ??
                line.product?.taxClassification ??
                ProductTaxClassification.TAXABLE,
              quantity: line.quantity,
              uqc: line.uqc,
              unitPricePaise: line.unitPricePaise,
              grossValuePaise: line.lineValuePaise,
              gstRatePercent:
                this.normalizedRate(line.gstRatePercent) ??
                this.normalizedRate(line.product?.gstRatePercent) ??
                0,
            }))
          : [
              {
                description: order.product?.name || "B2B procurement",
                sku: null,
                hsnSacCode: order.product?.hsnCode ?? null,
                taxClassification:
                  order.product?.taxClassification ?? ProductTaxClassification.TAXABLE,
                quantity: order.quantity,
                uqc: "NOS",
                unitPricePaise: order.unitPricePaise ?? 0,
                grossValuePaise: order.subtotalPaise ?? 0,
                gstRatePercent: this.normalizedRate(order.product?.gstRatePercent) ?? 0,
              },
            ];
      if (!sellerStateCode || !buyerStateCode) {
        throw new BadRequestException(
          "B2B final invoice requires seller and buyer state codes.",
        );
      }
      for (const line of sourceLines) {
        if (
          registrationStatus === SellerTaxRegistrationStatus.GST_REGISTERED &&
          line.taxClassification === ProductTaxClassification.TAXABLE &&
          (!line.hsnSacCode || line.gstRatePercent <= 0)
        ) {
          throw new BadRequestException(
            `B2B GST invoice line "${line.description}" requires approved HSN and GST-rate data.`,
          );
        }
      }
      const calculatedLines = sourceLines.map((line) => {
        const gstRate =
          registrationStatus === SellerTaxRegistrationStatus.GST_REGISTERED &&
          line.taxClassification === ProductTaxClassification.TAXABLE
            ? line.gstRatePercent
            : 0;
        const tax = this.calculateInclusiveTax(line.grossValuePaise, gstRate, supplyType);
        return { ...line, gstRatePercent: gstRate, tax };
      });
      const merchandiseValuePaise = calculatedLines.reduce(
        (sum, line) => sum + line.grossValuePaise,
        0,
      );
      const principalGstRate =
        calculatedLines.find((line) => line.gstRatePercent > 0)?.gstRatePercent ?? 0;
      const principalTaxClassification =
        calculatedLines.find(
          (line) => line.taxClassification === ProductTaxClassification.TAXABLE,
        )?.taxClassification ?? ProductTaxClassification.NON_GST;
      const transportValuePaise = order.transportChargePaise ?? 0;
      const transportTax = this.calculateInclusiveTax(
        transportValuePaise,
        principalGstRate,
        supplyType,
      );
      const taxableValuePaise =
        calculatedLines.reduce((sum, line) => sum + line.tax.taxableValuePaise, 0) +
        transportTax.taxableValuePaise;
      const cgstPaise =
        calculatedLines.reduce((sum, line) => sum + line.tax.cgstPaise, 0) +
        transportTax.cgstPaise;
      const sgstPaise =
        calculatedLines.reduce((sum, line) => sum + line.tax.sgstPaise, 0) +
        transportTax.sgstPaise;
      const igstPaise =
        calculatedLines.reduce((sum, line) => sum + line.tax.igstPaise, 0) +
        transportTax.igstPaise;
      const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
      const invoiceValuePaise = merchandiseValuePaise + transportValuePaise;
      const documentType = this.outwardDocumentType(
        registrationStatus,
        calculatedLines.map((line) => line.taxClassification),
      );
      const issueDate = new Date();
      const financialYear = this.financialYear(issueDate);
      const documentNumber = await this.nextDocumentNumber(
        tx,
        order.sellerId,
        financialYear,
        documentType,
      );

      const taxDocument = await tx.taxDocument.create({
        data: {
          documentNumber,
          documentType,
          status: TaxDocumentStatus.DRAFT,
          source: TaxDocumentSource.B2B_FULFILMENT,
          idempotencyKey,
          financialYear,
          b2bOrderId: order.id,
          sellerId: order.sellerId,
          supplyDate: order.fulfilledAt ?? issueDate,
          sellerLegalName:
            order.seller.profile?.businessLegalName?.trim() || order.seller.storeName,
          sellerTaxRegistrationStatus: registrationStatus,
          sellerGstin,
          sellerAddressSnapshot: this.jsonAddress(
            sellerAddress
              ? {
                  line1: sellerAddress.line1,
                  line2: sellerAddress.line2,
                  area: sellerAddress.area,
                  city: sellerAddress.city,
                  state: sellerAddress.state,
                  pincode: sellerAddress.pincode,
                  country: sellerAddress.country,
                  countryCode: sellerAddress.countryCode,
                  stateCode: sellerAddress.stateCode,
                }
              : {},
          ),
          buyerLegalName: order.businessBuyer.companyName,
          buyerGstin,
          buyerAddressSnapshot: this.jsonAddress(buyerAddress ?? {}),
          placeOfSupplyStateCode: buyerStateCode,
          supplyType,
          gstrSupplySection: this.gstrSection({
            registrationStatus,
            buyerGstin,
            supplyType,
            invoiceValuePaise,
            classifications: calculatedLines.map((line) => line.taxClassification),
          }),
          currency: order.currency,
          taxableValuePaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          totalTaxPaise,
          invoiceValuePaise,
          lines: {
            create: [
              ...calculatedLines.map((line) => ({
                lineType: TaxDocumentLineType.PRODUCT,
                description: line.description,
                sku: line.sku,
                hsnSacCode: line.hsnSacCode,
                taxClassification: line.taxClassification,
                quantity: line.quantity,
                uqc: line.uqc,
                unitPricePaise: line.unitPricePaise,
                grossValuePaise: line.grossValuePaise,
                taxableValuePaise: line.tax.taxableValuePaise,
                gstRatePercent: new Prisma.Decimal(line.gstRatePercent),
                cgstPaise: line.tax.cgstPaise,
                sgstPaise: line.tax.sgstPaise,
                igstPaise: line.tax.igstPaise,
                totalTaxPaise: line.tax.taxTotalPaise,
                lineValuePaise: line.grossValuePaise,
              })),
              ...(transportValuePaise > 0
                ? [
                    {
                      lineType: TaxDocumentLineType.SHIPPING,
                      description: "Seller-arranged transport",
                      taxClassification: principalTaxClassification,
                      quantity: 1,
                      unitPricePaise: transportValuePaise,
                      grossValuePaise: transportValuePaise,
                      taxableValuePaise: transportTax.taxableValuePaise,
                      gstRatePercent: new Prisma.Decimal(principalGstRate),
                      cgstPaise: transportTax.cgstPaise,
                      sgstPaise: transportTax.sgstPaise,
                      igstPaise: transportTax.igstPaise,
                      totalTaxPaise: transportTax.taxTotalPaise,
                      lineValuePaise: transportValuePaise,
                    },
                  ]
                : []),
            ],
          },
        },
        include: { lines: true },
      });
      return tx.taxDocument.update({
        where: { id: taxDocument.id },
        data: {
          status: TaxDocumentStatus.ISSUED,
          issueDate,
          issuedById: actorUserId ?? null,
        },
        include: { lines: true },
      });
    });
  }

  private calculateInclusiveTax(
    considerationPaise: number,
    gstRatePercent: number,
    supplyType: TaxSupplyType,
  ) {
    const rateBps = Math.max(0, Math.round(gstRatePercent * 100));
    if (considerationPaise <= 0 || rateBps <= 0) {
      return {
        taxableValuePaise: Math.max(0, considerationPaise),
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        taxTotalPaise: 0,
      };
    }
    const divisor = 10_000 + rateBps;
    const taxableValuePaise = Math.floor(
      (considerationPaise * 10_000 + Math.floor(divisor / 2)) / divisor,
    );
    const taxTotalPaise = Math.max(0, considerationPaise - taxableValuePaise);
    if (supplyType === TaxSupplyType.INTRA_STATE) {
      const cgstPaise = Math.floor(taxTotalPaise / 2);
      return {
        taxableValuePaise,
        cgstPaise,
        sgstPaise: taxTotalPaise - cgstPaise,
        igstPaise: 0,
        taxTotalPaise,
      };
    }
    return {
      taxableValuePaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: taxTotalPaise,
      taxTotalPaise,
    };
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    sellerId: string,
    financialYear: string,
    documentType: TaxDocumentType,
  ) {
    const sequence = await tx.taxDocumentSequence.upsert({
      where: {
        sellerId_financialYear_documentType: { sellerId, financialYear, documentType },
      },
      create: { sellerId, financialYear, documentType, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    const allocated = sequence.nextNumber - 1;
    const prefix =
      documentType === TaxDocumentType.CREDIT_NOTE
        ? "CN"
        : documentType === TaxDocumentType.DEBIT_NOTE
          ? "DN"
          : documentType === TaxDocumentType.BILL_OF_SUPPLY
            ? "BS"
            : documentType === TaxDocumentType.COMMERCIAL_INVOICE
              ? "CI"
              : "TI";
    return `${prefix}/${financialYear}/${String(allocated).padStart(6, "0")}`;
  }

  private financialYear(date: Date) {
    const startYear = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
    return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  }

  private gstrSection(input: {
    registrationStatus: SellerTaxRegistrationStatus;
    buyerGstin?: string | null;
    supplyType: TaxSupplyType;
    invoiceValuePaise: number;
    classifications: ProductTaxClassification[];
  }) {
    if (input.registrationStatus !== SellerTaxRegistrationStatus.GST_REGISTERED) {
      return null;
    }
    if (
      input.classifications.length > 0 &&
      input.classifications.every(
        (classification) => classification !== ProductTaxClassification.TAXABLE,
      )
    ) {
      return GstrSupplySection.NIL_EXEMPT_NON_GST;
    }
    if (this.normalizeGstin(input.buyerGstin)) {
      return GstrSupplySection.B2B;
    }
    if (input.supplyType === TaxSupplyType.OUTSIDE_INDIA) {
      return GstrSupplySection.EXPORT;
    }
    const threshold = this.positiveIntegerEnv("GST_B2CL_THRESHOLD_PAISE", 10_000_000);
    if (
      input.supplyType === TaxSupplyType.INTER_STATE &&
      input.invoiceValuePaise > threshold
    ) {
      return GstrSupplySection.B2CL;
    }
    return GstrSupplySection.B2CS;
  }

  private creditNoteGstrSection(input: {
    originalSection?: GstrSupplySection | null;
    buyerGstin?: string | null;
  }) {
    if (!input.originalSection) {
      return null;
    }
    if (input.originalSection === GstrSupplySection.NIL_EXEMPT_NON_GST) {
      return GstrSupplySection.NIL_EXEMPT_NON_GST;
    }

    return this.normalizeGstin(input.buyerGstin)
      ? GstrSupplySection.CDNR
      : GstrSupplySection.CDNUR;
  }

  private outwardDocumentType(
    registrationStatus: SellerTaxRegistrationStatus,
    classifications: ProductTaxClassification[],
  ) {
    if (registrationStatus === SellerTaxRegistrationStatus.NOT_REGISTERED) {
      return TaxDocumentType.COMMERCIAL_INVOICE;
    }
    if (registrationStatus === SellerTaxRegistrationStatus.COMPOSITION) {
      return TaxDocumentType.BILL_OF_SUPPLY;
    }
    return classifications.some(
      (classification) => classification === ProductTaxClassification.TAXABLE,
    )
      ? TaxDocumentType.TAX_INVOICE
      : TaxDocumentType.BILL_OF_SUPPLY;
  }

  private normalizedRate(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new BadRequestException("GST rate must be between 0 and 100.");
    }
    return Math.round(rate * 100) / 100;
  }

  private normalizeGstin(value?: string | null) {
    const normalized = value?.trim().toUpperCase() || null;
    return normalized && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized)
      ? normalized
      : null;
  }

  private normalizeStateCode(value?: string | null) {
    const normalized = value?.trim().toUpperCase() || null;
    return normalized;
  }

  private addressFromJson(value: unknown): TaxAddress {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const record = value as Record<string, unknown>;
    const read = (key: keyof TaxAddress) =>
      typeof record[key] === "string" ? String(record[key]).trim() || null : null;
    return {
      fullName: read("fullName"),
      line1: read("line1"),
      line2: read("line2"),
      area: read("area"),
      city: read("city"),
      state: read("state"),
      pincode: read("pincode"),
      country: read("country"),
      countryCode: read("countryCode"),
      stateCode: read("stateCode"),
    };
  }

  private jsonAddress(value: TaxAddress): Prisma.InputJsonValue {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
    ) as Prisma.InputJsonObject;
  }

  private requiredJsonObject(value: Prisma.JsonValue, label: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException(`The original tax document ${label} snapshot is invalid.`);
    }

    return value as Prisma.InputJsonObject;
  }

  private stringFromJson(value: unknown, key: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const item = (value as Record<string, unknown>)[key];
    return typeof item === "string" && item.trim() ? item.trim() : null;
  }

  private prorate(amountPaise: number, quantity: number, totalQuantity: number) {
    return totalQuantity > 0 ? Math.round((amountPaise * quantity) / totalQuantity) : 0;
  }

  private positiveIntegerEnv(key: string, fallback: number) {
    const value = Number(process.env[key]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
