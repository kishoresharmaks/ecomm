import { Inject, Injectable } from "@nestjs/common";
import {
  B2BOrderStatus,
  GstComplianceStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentStatus,
  TaxDocumentType,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  OrderTaxReadinessStatus,
  OrderTaxReconciliationStatus,
  OrderTaxRegisterChannel,
  OrderTaxRegisterDateBasis,
  OrderTaxRegisterQueryDto,
  OrderTaxRegisterSortField,
  OrderTaxRegisterSource,
  SortDirection,
} from "./dto/order-tax-register-query.dto";

const MAX_PAGE_CANDIDATES = 20_000;
const MAX_EXPORT_CANDIDATES = 100_000;
const MONEY_TOLERANCE_PAISE = 1;

type Warning = { code: string; message: string };

export type OrderTaxRegisterRow = {
  id: string;
  documentScopeKey: string;
  source: OrderTaxRegisterSource;
  channel: OrderTaxRegisterChannel;
  valueSource: "TAX_DOCUMENT" | "TRANSACTION_SNAPSHOT";
  transactionId: string;
  transactionNumber: string;
  parentOrderNumber: string | null;
  sellerScopeId: string | null;
  transactionDate: Date;
  documentId: string | null;
  documentNumber: string | null;
  documentType: TaxDocumentType | null;
  documentStatus: TaxDocumentStatus | null;
  documentDate: Date | null;
  financialYear: string | null;
  originalDocumentId: string | null;
  originalDocumentNumber: string | null;
  adjustmentReason: string | null;
  adjustmentDate: Date | null;
  documentCreatedAt: Date | null;
  documentCancelledAt: Date | null;
  documentCancellationReason: string | null;
  createdByAdmin: string | null;
  sellerId: string;
  sellerName: string;
  sellerGstin: string | null;
  sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
  buyerName: string;
  buyerGstin: string | null;
  buyerTaxRegistrationStatus: "GST_REGISTERED" | "NOT_REGISTERED";
  placeOfSupplyStateCode: string | null;
  placeOfSupplyState: string | null;
  supplyType: string | null;
  currency: string;
  sourceRecordType: string | null;
  sourceRecordId: string | null;
  lineType: string;
  description: string;
  sku: string | null;
  hsnSacCode: string | null;
  taxClassification: ProductTaxClassification;
  quantity: number;
  uqc: string;
  gstRatePercent: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  lineValuePaise: number;
  invoiceValuePaise: number;
  orderValuePaise: number | null;
  refundAmountPaise: number;
  creditNoteAdjustedTaxableValuePaise: number;
  creditNoteAdjustedTaxPaise: number;
  paymentId: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  paymentStatus: string | null;
  paymentDate: Date | null;
  paidAmountPaise: number;
  settlementId: string | null;
  settlementStatus: string | null;
  payoutId: string | null;
  payoutStatus: string | null;
  readinessStatus: OrderTaxReadinessStatus;
  reconciliationStatus: OrderTaxReconciliationStatus;
  documentOrderDifferencePaise: number | null;
  paymentInvoiceDifferencePaise: number | null;
  taxSnapshotDocumentDifferencePaise: number | null;
  warningCodes: string[];
  warnings: Warning[];
  reverseCharge: boolean;
  gstrSupplySection: string | null;
  eInvoiceStatus: GstComplianceStatus | null;
  irn: string | null;
  acknowledgementNumber: string | null;
  acknowledgementDate: Date | null;
  eWayBillStatus: GstComplianceStatus | null;
  eWayBillNumber: string | null;
  eWayBillDate: Date | null;
  eWayBillValidUntil: Date | null;
  detailHref: string;
  invoiceDownloadable: boolean;
};

export type OrderTaxRegisterResponse = {
  items: OrderTaxRegisterRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
  truncated: boolean;
  summary: {
    transactionCount: number;
    documentCount: number;
    lineCount: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
    invoiceValuePaise: number;
    readinessCounts: Record<OrderTaxReadinessStatus, number>;
    reconciliationCounts: Record<OrderTaxReconciliationStatus, number>;
    warningCounts: Record<string, number>;
  };
};

type ReconciliationInput = {
  documentStatus: TaxDocumentStatus | null;
  documentType: TaxDocumentType | null;
  invoiceValuePaise: number;
  orderValuePaise: number | null;
  paidAmountPaise: number | null;
  paymentStatus: string | null;
  paymentComparable: boolean;
};

export function reconcileOrderTaxAmounts(input: ReconciliationInput) {
  const warnings: Warning[] = [];
  if (
    input.documentStatus !== TaxDocumentStatus.ISSUED ||
    !input.documentType ||
    input.documentType === TaxDocumentType.CREDIT_NOTE ||
    input.documentType === TaxDocumentType.DEBIT_NOTE ||
    input.orderValuePaise === null
  ) {
    return {
      status: OrderTaxReconciliationStatus.NOT_COMPARABLE,
      documentOrderDifferencePaise: null,
      paymentInvoiceDifferencePaise: null,
      warnings,
    };
  }

  const documentOrderDifferencePaise =
    input.invoiceValuePaise - input.orderValuePaise;
  if (Math.abs(documentOrderDifferencePaise) > MONEY_TOLERANCE_PAISE) {
    warnings.push({
      code: "DOCUMENT_ORDER_MISMATCH",
      message: "Issued document value does not match the transaction tax scope.",
    });
  }

  if (!input.paymentComparable) {
    warnings.push({
      code: "PAYMENT_SCOPE_MISMATCH",
      message: "Order payment covers a broader scope than this seller document.",
    });
    return {
      status: OrderTaxReconciliationStatus.NOT_COMPARABLE,
      documentOrderDifferencePaise,
      paymentInvoiceDifferencePaise: null,
      warnings,
    };
  }

  if (input.paidAmountPaise === null) {
    if (input.paymentStatus !== PaymentStatus.NOT_REQUIRED) {
      warnings.push({
        code: "MISSING_PAYMENT",
        message: "No comparable payment record is available for this invoice.",
      });
    }
    return {
      status:
        Math.abs(documentOrderDifferencePaise) > MONEY_TOLERANCE_PAISE
          ? OrderTaxReconciliationStatus.MISMATCH
          : OrderTaxReconciliationStatus.PARTIAL,
      documentOrderDifferencePaise,
      paymentInvoiceDifferencePaise: null,
      warnings,
    };
  }

  const paymentInvoiceDifferencePaise =
    input.paidAmountPaise - input.invoiceValuePaise;
  if (Math.abs(paymentInvoiceDifferencePaise) > MONEY_TOLERANCE_PAISE) {
    warnings.push({
      code: "PAYMENT_INVOICE_MISMATCH",
      message: "Comparable paid amount does not match the issued invoice value.",
    });
  }
  const mismatch =
    Math.abs(documentOrderDifferencePaise) > MONEY_TOLERANCE_PAISE ||
    Math.abs(paymentInvoiceDifferencePaise) > MONEY_TOLERANCE_PAISE;
  return {
    status: mismatch
      ? OrderTaxReconciliationStatus.MISMATCH
      : OrderTaxReconciliationStatus.MATCHED,
    documentOrderDifferencePaise,
    paymentInvoiceDifferencePaise,
    warnings,
  };
}

export function taxDocumentReadiness(input: {
  documentStatus: TaxDocumentStatus | null;
  documentNumber: string | null;
  documentDate: Date | null;
  sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
  sellerGstin: string | null;
  taxClassification: ProductTaxClassification;
  hsnSacCode: string | null;
  gstRatePercent: number;
  notRequired: boolean;
}) {
  if (!input.documentStatus) {
    return input.notRequired
      ? OrderTaxReadinessStatus.NOT_REQUIRED
      : OrderTaxReadinessStatus.MISSING_DOCUMENT;
  }
  if (input.documentStatus === TaxDocumentStatus.DRAFT) {
    return OrderTaxReadinessStatus.DRAFT_DOCUMENT;
  }
  if (input.documentStatus === TaxDocumentStatus.CANCELLED) {
    return OrderTaxReadinessStatus.CANCELLED_DOCUMENT;
  }
  const taxableRegistered =
    input.sellerTaxRegistrationStatus ===
      SellerTaxRegistrationStatus.GST_REGISTERED &&
    input.taxClassification === ProductTaxClassification.TAXABLE;
  return !input.documentNumber ||
    !input.documentDate ||
    (taxableRegistered &&
      (!input.sellerGstin || !input.hsnSacCode || input.gstRatePercent <= 0))
    ? OrderTaxReadinessStatus.INCOMPLETE_DOCUMENT
    : OrderTaxReadinessStatus.READY;
}

const documentInclude = {
  seller: { select: { id: true, storeName: true } },
  originalDocument: {
    select: { id: true, documentNumber: true, issueDate: true },
  },
  issuedBy: { select: { fullName: true, email: true } },
  lines: {
    include: {
      orderItem: {
        select: {
          quantity: true,
          activeQuantity: true,
          grossTaxableConsiderationPaise: true,
          taxableValuePaise: true,
          cgstPaise: true,
          sgstPaise: true,
          igstPaise: true,
          cessPaise: true,
          taxTotalPaise: true,
        },
      },
    },
  },
  compliance: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalPaise: true,
      paymentStatus: true,
      parentOrder: { select: { orderNumber: true } },
      sellerSplits: { select: { id: true } },
      payments: {
        select: {
          id: true,
          provider: true,
          providerPaymentId: true,
          amountPaise: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          events: {
            select: { newStatus: true, createdAt: true },
            orderBy: { createdAt: "desc" as const },
          },
        },
        orderBy: { updatedAt: "desc" as const },
      },
    },
  },
  orderSellerSplit: {
    select: {
      id: true,
      sellerSubtotalPaise: true,
      settlementStatus: true,
      payoutId: true,
      shipment: { select: { shippingPaise: true } },
      payout: {
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          transactionReference: true,
          paidAt: true,
        },
      },
    },
  },
  b2bOrder: {
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      buyerPayableAmountPaise: true,
      paidAmountPaise: true,
      paidAt: true,
      paymentStatus: true,
      settlementStatus: true,
      payoutId: true,
      payout: {
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          transactionReference: true,
          paidAt: true,
        },
      },
      paymentRecords: {
        select: {
          id: true,
          method: true,
          status: true,
          amountPaise: true,
          referenceNumber: true,
          providerPaymentId: true,
          verifiedAt: true,
          clearedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
  serviceBooking: {
    select: {
      id: true,
      bookingNumber: true,
      createdAt: true,
      totalPayablePaise: true,
      paidAmountPaise: true,
      status: true,
      payments: {
        select: {
          id: true,
          provider: true,
          providerPaymentId: true,
          referenceNumber: true,
          status: true,
          amountPaise: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" as const },
      },
      settlement: {
        select: {
          id: true,
          status: true,
          payoutId: true,
          payout: {
            select: {
              id: true,
              payoutNumber: true,
              status: true,
              transactionReference: true,
              paidAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TaxDocumentInclude;

type DocumentRecord = Prisma.TaxDocumentGetPayload<{
  include: typeof documentInclude;
}>;

const orderItemInclude = {
  seller: {
    select: {
      id: true,
      storeName: true,
      profile: {
        select: {
          businessLegalName: true,
          gstNumber: true,
          taxRegistrationStatus: true,
        },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      orderStatus: true,
      paymentStatus: true,
      buyerLegalNameSnapshot: true,
      buyerGstinSnapshot: true,
      shippingAddressSnapshot: true,
      parentOrder: { select: { orderNumber: true } },
      customer: {
        select: {
          displayName: true,
          user: { select: { fullName: true, email: true } },
        },
      },
      sellerSplits: {
        select: {
          id: true,
          sellerId: true,
          sellerSubtotalPaise: true,
          settlementStatus: true,
          payoutId: true,
          shipment: { select: { shippingPaise: true } },
          payout: {
            select: {
              id: true,
              payoutNumber: true,
              status: true,
              transactionReference: true,
              paidAt: true,
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          provider: true,
          providerPaymentId: true,
          amountPaise: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          events: {
            select: { newStatus: true, createdAt: true },
            orderBy: { createdAt: "desc" as const },
          },
        },
        orderBy: { updatedAt: "desc" as const },
      },
    },
  },
} satisfies Prisma.OrderItemInclude;

type OrderItemRecord = Prisma.OrderItemGetPayload<{
  include: typeof orderItemInclude;
}>;

const b2bOrderInclude = {
  seller: {
    select: {
      id: true,
      storeName: true,
      profile: {
        select: {
          businessLegalName: true,
          gstNumber: true,
          taxRegistrationStatus: true,
        },
      },
    },
  },
  businessBuyer: {
    select: {
      companyName: true,
      gstNumber: true,
      contactName: true,
    },
  },
  lines: true,
  product: {
    select: {
      name: true,
      hsnCode: true,
      taxClassification: true,
      gstRatePercent: true,
    },
  },
  paymentRecords: {
    select: {
      id: true,
      method: true,
      status: true,
      amountPaise: true,
      referenceNumber: true,
      providerPaymentId: true,
      verifiedAt: true,
      clearedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  payout: {
    select: {
      id: true,
      payoutNumber: true,
      status: true,
      transactionReference: true,
      paidAt: true,
    },
  },
} satisfies Prisma.B2BOrderInclude;

type B2bOrderRecord = Prisma.B2BOrderGetPayload<{
  include: typeof b2bOrderInclude;
}>;

const serviceBookingInclude = {
  seller: {
    select: {
      id: true,
      storeName: true,
      profile: {
        select: {
          businessLegalName: true,
          gstNumber: true,
          taxRegistrationStatus: true,
        },
      },
    },
  },
  listing: { select: { title: true } },
  quotes: {
    where: { status: "ACCEPTED" as const },
    select: {
      id: true,
      acceptedAt: true,
      lineItems: { orderBy: { sortOrder: "asc" as const } },
    },
    orderBy: { acceptedAt: "desc" as const },
    take: 1,
  },
  payments: {
    select: {
      id: true,
      provider: true,
      providerPaymentId: true,
      referenceNumber: true,
      status: true,
      amountPaise: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" as const },
  },
  settlement: {
    select: {
      id: true,
      status: true,
      payoutId: true,
      payout: {
        select: {
          id: true,
          payoutNumber: true,
          status: true,
          transactionReference: true,
          paidAt: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceBookingInclude;

type ServiceBookingRecord = Prisma.ServiceBookingGetPayload<{
  include: typeof serviceBookingInclude;
}>;

@Injectable()
export class OrderTaxRegisterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async report(
    query: OrderTaxRegisterQueryDto,
    includeAll = false,
  ): Promise<OrderTaxRegisterResponse> {
    const source = query.source ?? OrderTaxRegisterSource.PRODUCT;
    const candidateLimit = includeAll
      ? MAX_EXPORT_CANDIDATES
      : MAX_PAGE_CANDIDATES;
    const documentWhere: Prisma.TaxDocumentWhereInput = {
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(source === OrderTaxRegisterSource.SERVICE
        ? { serviceBookingId: { not: null } }
        : { serviceBookingId: null }),
      ...(query.channel === OrderTaxRegisterChannel.B2B
        ? { b2bOrderId: { not: null } }
        : query.channel === OrderTaxRegisterChannel.B2C
          ? { orderId: { not: null } }
          : {}),
    };
    const documents = await this.prisma.client.taxDocument.findMany({
      where: documentWhere,
      include: documentInclude,
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: candidateLimit,
    });
    const coveredSourceRecords = new Set(
      documents.flatMap((document) =>
        document.lines.flatMap((line) =>
          line.sourceRecordId
            ? [line.sourceRecordId]
            : line.orderItemId
              ? [line.orderItemId]
              : [],
        ),
      ),
    );
    const rows = documents.flatMap((document) =>
      this.documentRows(document),
    );
    if (source === OrderTaxRegisterSource.SERVICE) {
      rows.push(
        ...(await this.serviceFallbackRows(
          query,
          coveredSourceRecords,
          candidateLimit,
        )),
      );
    } else {
      if (query.channel !== OrderTaxRegisterChannel.B2B) {
        rows.push(
          ...(await this.b2cFallbackRows(
            query,
            coveredSourceRecords,
            candidateLimit,
          )),
        );
      }
      if (query.channel !== OrderTaxRegisterChannel.B2C) {
        rows.push(
          ...(await this.b2bFallbackRows(
            query,
            coveredSourceRecords,
            candidateLimit,
          )),
        );
      }
    }

    const filtered = this.sortRows(
      rows.filter((row) => this.matches(row, query)),
      query,
    );
    const page = includeAll ? 1 : query.page ?? 1;
    const limit = includeAll ? Math.max(filtered.length, 1) : query.limit ?? 50;
    const start = includeAll ? 0 : (page - 1) * limit;
    return {
      items: includeAll ? filtered : filtered.slice(start, start + limit),
      page,
      limit,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      generatedAt: new Date().toISOString(),
      truncated:
        documents.length === candidateLimit ||
        rows.length >= candidateLimit,
      summary: this.summary(filtered),
    };
  }

  private documentRows(document: DocumentRecord): OrderTaxRegisterRow[] {
    const sign =
      document.documentType === TaxDocumentType.CREDIT_NOTE ? -1 : 1;
    const transaction = this.documentTransaction(document);
    const payment = this.documentPayment(document);
    const settlement = this.documentSettlement(document);
    const buyerAddress = this.address(document.buyerAddressSnapshot);
    return document.lines.map((line) => {
      const taxSnapshotDifferencePaise =
        document.documentType === TaxDocumentType.CREDIT_NOTE ||
        document.documentType === TaxDocumentType.DEBIT_NOTE ||
        !line.orderItem
          ? null
          : line.totalTaxPaise -
            this.prorate(
              line.orderItem.taxTotalPaise,
              line.orderItem.activeQuantity,
              line.orderItem.quantity,
            );
      const readinessStatus = taxDocumentReadiness({
        documentStatus: document.status,
        documentNumber: document.documentNumber,
        documentDate: document.issueDate,
        sellerTaxRegistrationStatus: document.sellerTaxRegistrationStatus,
        sellerGstin: document.sellerGstin,
        taxClassification: line.taxClassification,
        hsnSacCode: line.hsnSacCode,
        gstRatePercent: Number(line.gstRatePercent ?? 0),
        notRequired: false,
      });
      const reconciliation = reconcileOrderTaxAmounts({
        documentStatus: document.status,
        documentType: document.documentType,
        invoiceValuePaise: sign * document.invoiceValuePaise,
        orderValuePaise: transaction.orderValuePaise,
        paidAmountPaise: payment.paidAmountPaise,
        paymentStatus: payment.status,
        paymentComparable: transaction.paymentComparable,
      });
      const warnings = [
        ...this.documentWarnings(
          document,
          line,
          readinessStatus,
          taxSnapshotDifferencePaise,
        ),
        ...reconciliation.warnings,
      ];
      return {
        id: `document-line:${line.id}`,
        documentScopeKey: `tax-document:${document.id}`,
        source: document.serviceBookingId
          ? OrderTaxRegisterSource.SERVICE
          : OrderTaxRegisterSource.PRODUCT,
        channel: document.b2bOrderId
          ? OrderTaxRegisterChannel.B2B
          : OrderTaxRegisterChannel.B2C,
        valueSource: "TAX_DOCUMENT",
        transactionId: transaction.id,
        transactionNumber: transaction.number,
        parentOrderNumber: transaction.parentOrderNumber,
        sellerScopeId: document.orderSellerSplitId,
        transactionDate: transaction.date,
        documentId: document.id,
        documentNumber: document.documentNumber,
        documentType: document.documentType,
        documentStatus: document.status,
        documentDate: document.issueDate,
        financialYear: document.financialYear,
        originalDocumentId: document.originalDocumentId,
        originalDocumentNumber:
          document.originalDocument?.documentNumber ?? null,
        adjustmentReason: document.reason,
        adjustmentDate:
          document.documentType === TaxDocumentType.CREDIT_NOTE ||
          document.documentType === TaxDocumentType.DEBIT_NOTE
            ? document.issueDate
            : null,
        documentCreatedAt: document.createdAt,
        documentCancelledAt: document.voidedAt,
        documentCancellationReason: document.voidReason,
        createdByAdmin:
          document.issuedBy?.fullName ?? document.issuedBy?.email ?? null,
        sellerId: document.sellerId,
        sellerName: document.sellerLegalName || document.seller.storeName,
        sellerGstin: document.sellerGstin,
        sellerTaxRegistrationStatus:
          document.sellerTaxRegistrationStatus,
        buyerName: document.buyerLegalName,
        buyerGstin: document.buyerGstin,
        buyerTaxRegistrationStatus: document.buyerGstin
          ? "GST_REGISTERED"
          : "NOT_REGISTERED",
        placeOfSupplyStateCode: document.placeOfSupplyStateCode,
        placeOfSupplyState: buyerAddress.state,
        supplyType: document.supplyType,
        currency: document.currency,
        sourceRecordType:
          line.sourceRecordType ??
          (line.orderItemId ? "ORDER_ITEM" : null),
        sourceRecordId: line.sourceRecordId ?? line.orderItemId,
        lineType: line.lineType,
        description: line.description,
        sku: line.sku,
        hsnSacCode: line.hsnSacCode,
        taxClassification: line.taxClassification,
        quantity: sign * line.quantity,
        uqc: line.uqc,
        gstRatePercent: Number(line.gstRatePercent ?? 0),
        taxableValuePaise: sign * line.taxableValuePaise,
        cgstPaise: sign * line.cgstPaise,
        sgstPaise: sign * line.sgstPaise,
        igstPaise: sign * line.igstPaise,
        cessPaise: sign * line.cessPaise,
        totalTaxPaise: sign * line.totalTaxPaise,
        lineValuePaise: sign * line.lineValuePaise,
        invoiceValuePaise: sign * document.invoiceValuePaise,
        orderValuePaise: transaction.orderValuePaise,
        refundAmountPaise:
          document.documentType === TaxDocumentType.CREDIT_NOTE
            ? Math.abs(document.invoiceValuePaise)
            : 0,
        creditNoteAdjustedTaxableValuePaise:
          document.documentType === TaxDocumentType.CREDIT_NOTE
            ? -document.taxableValuePaise
            : 0,
        creditNoteAdjustedTaxPaise:
          document.documentType === TaxDocumentType.CREDIT_NOTE
            ? -document.totalTaxPaise
            : 0,
        paymentId: payment.id,
        paymentProvider: payment.provider,
        paymentReference: payment.reference,
        paymentStatus: payment.status,
        paymentDate: payment.date,
        paidAmountPaise: payment.paidAmountPaise ?? 0,
        settlementId: settlement.id,
        settlementStatus: settlement.status,
        payoutId: settlement.payoutId,
        payoutStatus: settlement.payoutStatus,
        readinessStatus,
        reconciliationStatus: reconciliation.status,
        documentOrderDifferencePaise:
          reconciliation.documentOrderDifferencePaise,
        paymentInvoiceDifferencePaise:
          reconciliation.paymentInvoiceDifferencePaise,
        taxSnapshotDocumentDifferencePaise:
          taxSnapshotDifferencePaise,
        warningCodes: warnings.map((warning) => warning.code),
        warnings,
        reverseCharge: document.reverseCharge,
        gstrSupplySection: document.gstrSupplySection,
        eInvoiceStatus: document.compliance?.eInvoiceStatus ?? null,
        irn: document.compliance?.irn ?? null,
        acknowledgementNumber:
          document.compliance?.acknowledgementNumber ?? null,
        acknowledgementDate:
          document.compliance?.acknowledgementDate ?? null,
        eWayBillStatus: document.compliance?.eWayBillStatus ?? null,
        eWayBillNumber: document.compliance?.eWayBillNumber ?? null,
        eWayBillDate: document.compliance?.eWayBillGeneratedAt ?? null,
        eWayBillValidUntil:
          document.compliance?.eWayBillValidUntil ?? null,
        detailHref: transaction.detailHref,
        invoiceDownloadable:
          document.status === TaxDocumentStatus.ISSUED,
      };
    });
  }

  private async b2cFallbackRows(
    query: OrderTaxRegisterQueryDto,
    covered: Set<string>,
    take: number,
  ) {
    const dateRange = this.dateRange(query);
    const items = await this.prisma.client.orderItem.findMany({
      where: {
        ...(query.sellerId ? { sellerId: query.sellerId } : {}),
        ...(query.dateBasis ===
          OrderTaxRegisterDateBasis.TRANSACTION_DATE && dateRange
          ? { order: { createdAt: dateRange } }
          : {}),
      },
      include: orderItemInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
    return items
      .filter((item) => !covered.has(item.id))
      .map((item) => this.b2cFallbackRow(item));
  }

  private b2cFallbackRow(item: OrderItemRecord): OrderTaxRegisterRow {
    const split = item.order.sellerSplits.find(
      (candidate) => candidate.sellerId === item.sellerId,
    );
    const payment = this.orderPayment(item.order.payments);
    const address = this.address(item.order.shippingAddressSnapshot);
    const sellerRegistration =
      item.supplierTaxRegistrationStatusSnapshot ??
      item.seller.profile?.taxRegistrationStatus ??
      SellerTaxRegistrationStatus.NOT_REGISTERED;
    const notRequired =
      item.order.orderStatus === OrderStatus.CANCELLED &&
      item.activeQuantity === 0 &&
      (split?.shipment?.shippingPaise ?? 0) === 0;
    const readinessStatus = taxDocumentReadiness({
      documentStatus: null,
      documentNumber: null,
      documentDate: null,
      sellerTaxRegistrationStatus: sellerRegistration,
      sellerGstin:
        item.supplierGstinSnapshot ?? item.seller.profile?.gstNumber ?? null,
      taxClassification: item.productTaxClassificationSnapshot,
      hsnSacCode: item.hsnCodeSnapshot,
      gstRatePercent: Number(item.gstRatePercentSnapshot ?? 0),
      notRequired,
    });
    const warnings: Warning[] = [
      {
        code: "MASTER_DATA_FALLBACK",
        message:
          "No issued document snapshot exists; current seller and transaction snapshots are shown.",
      },
      ...(notRequired
        ? []
        : [
            {
              code: "MISSING_DOCUMENT",
              message: "This seller transaction scope has no tax document.",
            },
          ]),
    ];
    const orderValuePaise = split
      ? split.sellerSubtotalPaise + (split.shipment?.shippingPaise ?? 0)
      : null;
    if (!split) {
      warnings.push({
        code: "SOURCE_LINK_MISSING",
        message: "Seller split could not be resolved for this order item.",
      });
    }
    return this.fallbackBase({
      id: `order-item:${item.id}`,
      scopeKey: `b2c:${item.order.id}:${item.sellerId}`,
      source: OrderTaxRegisterSource.PRODUCT,
      channel: OrderTaxRegisterChannel.B2C,
      transactionId: item.order.id,
      transactionNumber: item.order.orderNumber,
      parentOrderNumber: item.order.parentOrder?.orderNumber ?? null,
      sellerScopeId: split?.id ?? null,
      transactionDate: item.order.createdAt,
      sellerId: item.sellerId,
      sellerName:
        item.seller.profile?.businessLegalName ?? item.seller.storeName,
      sellerGstin:
        item.supplierGstinSnapshot ?? item.seller.profile?.gstNumber ?? null,
      sellerTaxRegistrationStatus: sellerRegistration,
      buyerName:
        item.order.buyerLegalNameSnapshot ??
        item.order.customer.displayName ??
        item.order.customer.user.fullName ??
        item.order.customer.user.email,
      buyerGstin: item.order.buyerGstinSnapshot,
      placeOfSupplyStateCode:
        item.placeOfSupplyStateCodeSnapshot || address.stateCode,
      placeOfSupplyState: address.state,
      supplyType: item.taxSupplyTypeSnapshot,
      currency: item.currency,
      sourceRecordType: "ORDER_ITEM",
      sourceRecordId: item.id,
      lineType: "PRODUCT",
      description: item.productNameSnapshot,
      sku: this.stringFromJson(item.variantSnapshot, "sku"),
      hsnSacCode: item.hsnCodeSnapshot,
      taxClassification: item.productTaxClassificationSnapshot,
      quantity: item.activeQuantity,
      uqc: "NOS",
      gstRatePercent: Number(item.gstRatePercentSnapshot ?? 0),
      taxableValuePaise: this.prorate(
        item.taxableValuePaise,
        item.activeQuantity,
        item.quantity,
      ),
      cgstPaise: this.prorate(
        item.cgstPaise,
        item.activeQuantity,
        item.quantity,
      ),
      sgstPaise: this.prorate(
        item.sgstPaise,
        item.activeQuantity,
        item.quantity,
      ),
      igstPaise: this.prorate(
        item.igstPaise,
        item.activeQuantity,
        item.quantity,
      ),
      cessPaise: this.prorate(
        item.cessPaise,
        item.activeQuantity,
        item.quantity,
      ),
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
      invoiceValuePaise: orderValuePaise ?? item.grossTaxableConsiderationPaise,
      orderValuePaise,
      payment,
      settlement: {
        id: split?.id ?? null,
        status: split?.settlementStatus ?? null,
        payoutId: split?.payoutId ?? null,
        payoutStatus: split?.payout?.status ?? null,
      },
      readinessStatus,
      warnings,
      detailHref: `/admin/orders/${encodeURIComponent(item.order.orderNumber)}`,
    });
  }

  private async b2bFallbackRows(
    query: OrderTaxRegisterQueryDto,
    covered: Set<string>,
    take: number,
  ) {
    const dateRange = this.dateRange(query);
    const orders = await this.prisma.client.b2BOrder.findMany({
      where: {
        ...(query.sellerId ? { sellerId: query.sellerId } : {}),
        ...(query.dateBasis ===
          OrderTaxRegisterDateBasis.TRANSACTION_DATE && dateRange
          ? { createdAt: dateRange }
          : {}),
      },
      include: b2bOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
    return orders.flatMap((order) => {
      const lines =
        order.lines.length > 0
          ? order.lines
          : [
              {
                id: order.id,
                description: order.product?.name ?? "B2B procurement",
                sku: null,
                hsnSacCode: order.product?.hsnCode ?? null,
                taxClassification:
                  order.product?.taxClassification ??
                  ProductTaxClassification.TAXABLE,
                quantity: order.quantity,
                uqc: "NOS",
                gstRatePercent: order.product?.gstRatePercent ?? null,
                taxableValuePaise: order.subtotalPaise ?? 0,
                cgstPaise: 0,
                sgstPaise: 0,
                igstPaise: 0,
                cessPaise: 0,
                totalTaxPaise: 0,
                lineValuePaise: order.subtotalPaise ?? 0,
              },
            ];
      return lines
        .filter((line) => !covered.has(line.id))
        .map((line) => this.b2bFallbackRow(order, line));
    });
  }

  private b2bFallbackRow(
    order: B2bOrderRecord,
    line: B2bOrderRecord["lines"][number] | {
      id: string;
      description: string;
      sku: string | null;
      hsnSacCode: string | null;
      taxClassification: ProductTaxClassification;
      quantity: number;
      uqc: string;
      gstRatePercent: Prisma.Decimal | null;
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      cessPaise: number;
      totalTaxPaise: number;
      lineValuePaise: number;
    },
  ) {
    const payment = this.b2bPayment(order);
    const sellerRegistration =
      order.seller?.profile?.taxRegistrationStatus ??
      SellerTaxRegistrationStatus.NOT_REGISTERED;
    const notRequired =
      order.status === B2BOrderStatus.CANCELLED &&
      order.buyerPayableAmountPaise === 0 &&
      order.paidAmountPaise === 0;
    const readinessStatus = taxDocumentReadiness({
      documentStatus: null,
      documentNumber: null,
      documentDate: null,
      sellerTaxRegistrationStatus: sellerRegistration,
      sellerGstin: order.seller?.profile?.gstNumber ?? null,
      taxClassification: line.taxClassification,
      hsnSacCode: line.hsnSacCode,
      gstRatePercent: Number(line.gstRatePercent ?? 0),
      notRequired,
    });
    const warnings: Warning[] = notRequired
      ? []
      : [
          {
            code: "MISSING_DOCUMENT",
            message: "This B2B order line has no final tax document.",
          },
          {
            code: "MASTER_DATA_FALLBACK",
            message:
              "No issued document snapshot exists; current seller and buyer master data is shown.",
          },
        ];
    return this.fallbackBase({
      id: `b2b-line:${line.id}`,
      scopeKey: `b2b:${order.id}`,
      source: OrderTaxRegisterSource.PRODUCT,
      channel: OrderTaxRegisterChannel.B2B,
      transactionId: order.id,
      transactionNumber: order.orderNumber,
      parentOrderNumber: null,
      sellerScopeId: order.id,
      transactionDate: order.createdAt,
      sellerId: order.sellerId ?? "",
      sellerName:
        order.seller?.profile?.businessLegalName ??
        order.seller?.storeName ??
        "Seller unavailable",
      sellerGstin: order.seller?.profile?.gstNumber ?? null,
      sellerTaxRegistrationStatus: sellerRegistration,
      buyerName: order.businessBuyer.companyName,
      buyerGstin: order.businessBuyer.gstNumber,
      placeOfSupplyStateCode: this.address(
        order.deliveryAddressSnapshot,
      ).stateCode,
      placeOfSupplyState: this.address(order.deliveryAddressSnapshot).state,
      supplyType: null,
      currency: order.currency,
      sourceRecordType:
        order.lines.length > 0 ? "B2B_ORDER_LINE" : "B2B_ORDER",
      sourceRecordId: line.id,
      lineType: "PRODUCT",
      description: line.description,
      sku: line.sku,
      hsnSacCode: line.hsnSacCode,
      taxClassification: line.taxClassification,
      quantity: line.quantity,
      uqc: line.uqc,
      gstRatePercent: Number(line.gstRatePercent ?? 0),
      taxableValuePaise: line.taxableValuePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      cessPaise: line.cessPaise,
      totalTaxPaise: line.totalTaxPaise,
      lineValuePaise: line.lineValuePaise,
      invoiceValuePaise: order.buyerPayableAmountPaise,
      orderValuePaise: order.buyerPayableAmountPaise,
      payment,
      settlement: {
        id: order.id,
        status: order.settlementStatus,
        payoutId: order.payoutId,
        payoutStatus: order.payout?.status ?? null,
      },
      readinessStatus,
      warnings,
      detailHref: `/admin/b2b-orders/${encodeURIComponent(order.orderNumber)}`,
    });
  }

  private async serviceFallbackRows(
    query: OrderTaxRegisterQueryDto,
    covered: Set<string>,
    take: number,
  ) {
    const dateRange = this.dateRange(query);
    const bookings = await this.prisma.client.serviceBooking.findMany({
      where: {
        ...(query.sellerId ? { sellerId: query.sellerId } : {}),
        ...(query.dateBasis ===
          OrderTaxRegisterDateBasis.TRANSACTION_DATE && dateRange
          ? { createdAt: dateRange }
          : {}),
      },
      include: serviceBookingInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
    return bookings.flatMap((booking) => {
      const quoteLines = booking.quotes[0]?.lineItems ?? [];
      const lines =
        quoteLines.length > 0
          ? quoteLines
          : [
              {
                id: booking.id,
                lineType: "SERVICE" as const,
                description: booking.listing.title,
                hsnSacCode: booking.sacCodeSnapshot,
                taxClassification:
                  booking.serviceTaxClassificationSnapshot,
                quantity: 1,
                uqc: "NOS",
                gstRatePercent: booking.gstRatePercentSnapshot,
                taxableValuePaise: booking.taxableValuePaise,
                cgstPaise: booking.cgstPaise,
                sgstPaise: booking.sgstPaise,
                igstPaise: booking.igstPaise,
                cessPaise: booking.cessPaise,
                taxTotalPaise: booking.taxTotalPaise,
                totalPaise: booking.totalPayablePaise,
              },
            ];
      return lines
        .filter((line) => !covered.has(line.id))
        .map((line) => this.serviceFallbackRow(booking, line));
    });
  }

  private serviceFallbackRow(
    booking: ServiceBookingRecord,
    line: ServiceBookingRecord["quotes"][number]["lineItems"][number] | {
      id: string;
      lineType: "SERVICE";
      description: string;
      hsnSacCode: string | null;
      taxClassification: ProductTaxClassification;
      quantity: number;
      uqc: string;
      gstRatePercent: Prisma.Decimal;
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      cessPaise: number;
      taxTotalPaise: number;
      totalPaise: number;
    },
  ) {
    const payment = this.servicePayment(booking);
    const notRequired =
      ["CANCELLED", "REJECTED", "QUOTE_REJECTED", "QUOTE_EXPIRED"].includes(
        booking.status,
      ) &&
      booking.totalPayablePaise === 0 &&
      booking.inspectionFeePaise === 0 &&
      booking.cancellationFeePaise === 0 &&
      booking.paidAmountPaise === 0;
    const readinessStatus = taxDocumentReadiness({
      documentStatus: null,
      documentNumber: null,
      documentDate: null,
      sellerTaxRegistrationStatus:
        booking.sellerTaxRegistrationStatusSnapshot,
      sellerGstin: booking.sellerGstinSnapshot,
      taxClassification: line.taxClassification,
      hsnSacCode: line.hsnSacCode,
      gstRatePercent: Number(line.gstRatePercent ?? 0),
      notRequired,
    });
    const warnings: Warning[] = notRequired
      ? []
      : [
          {
            code: "MISSING_DOCUMENT",
            message: "This service line has no final tax document.",
          },
          {
            code: "TRANSACTION_SNAPSHOT_FALLBACK",
            message:
              "Values are from the booking or accepted quote snapshot.",
          },
        ];
    return this.fallbackBase({
      id: `service-line:${line.id}`,
      scopeKey: `service:${booking.id}`,
      source: OrderTaxRegisterSource.SERVICE,
      channel: OrderTaxRegisterChannel.B2C,
      transactionId: booking.id,
      transactionNumber: booking.bookingNumber,
      parentOrderNumber: null,
      sellerScopeId: booking.id,
      transactionDate: booking.createdAt,
      sellerId: booking.sellerId,
      sellerName:
        booking.sellerLegalNameSnapshot ||
        booking.seller.profile?.businessLegalName ||
        booking.seller.storeName,
      sellerGstin: booking.sellerGstinSnapshot,
      sellerTaxRegistrationStatus:
        booking.sellerTaxRegistrationStatusSnapshot,
      buyerName: booking.buyerLegalNameSnapshot,
      buyerGstin: booking.buyerGstinSnapshot,
      placeOfSupplyStateCode:
        booking.placeOfSupplyStateCodeSnapshot,
      placeOfSupplyState: this.address(
        booking.buyerAddressSnapshot,
      ).state,
      supplyType: booking.taxSupplyTypeSnapshot,
      currency: booking.currency,
      sourceRecordType:
        booking.quotes[0]?.lineItems.length
          ? "SERVICE_QUOTE_LINE"
          : "SERVICE_BOOKING",
      sourceRecordId: line.id,
      lineType: line.lineType,
      description: line.description,
      sku: null,
      hsnSacCode: line.hsnSacCode,
      taxClassification: line.taxClassification,
      quantity: line.quantity,
      uqc: line.uqc,
      gstRatePercent: Number(line.gstRatePercent ?? 0),
      taxableValuePaise: line.taxableValuePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      cessPaise: line.cessPaise,
      totalTaxPaise: line.taxTotalPaise,
      lineValuePaise: line.totalPaise,
      invoiceValuePaise: booking.totalPayablePaise,
      orderValuePaise: booking.totalPayablePaise,
      payment,
      settlement: {
        id: booking.settlement?.id ?? null,
        status: booking.settlement?.status ?? null,
        payoutId: booking.settlement?.payoutId ?? null,
        payoutStatus: booking.settlement?.payout?.status ?? null,
      },
      readinessStatus,
      warnings,
      detailHref: `/admin/service-bookings/${encodeURIComponent(booking.bookingNumber)}`,
    });
  }

  private fallbackBase(input: {
    id: string;
    scopeKey: string;
    source: OrderTaxRegisterSource;
    channel: OrderTaxRegisterChannel;
    transactionId: string;
    transactionNumber: string;
    parentOrderNumber: string | null;
    sellerScopeId: string | null;
    transactionDate: Date;
    sellerId: string;
    sellerName: string;
    sellerGstin: string | null;
    sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
    buyerName: string;
    buyerGstin: string | null;
    placeOfSupplyStateCode: string | null;
    placeOfSupplyState: string | null;
    supplyType: string | null;
    currency: string;
    sourceRecordType: string;
    sourceRecordId: string;
    lineType: string;
    description: string;
    sku: string | null;
    hsnSacCode: string | null;
    taxClassification: ProductTaxClassification;
    quantity: number;
    uqc: string;
    gstRatePercent: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    cessPaise: number;
    totalTaxPaise: number;
    lineValuePaise: number;
    invoiceValuePaise: number;
    orderValuePaise: number | null;
    payment: ReturnType<OrderTaxRegisterService["emptyPayment"]>;
    settlement: {
      id: string | null;
      status: string | null;
      payoutId: string | null;
      payoutStatus: string | null;
    };
    readinessStatus: OrderTaxReadinessStatus;
    warnings: Warning[];
    detailHref: string;
  }): OrderTaxRegisterRow {
    return {
      id: input.id,
      documentScopeKey: input.scopeKey,
      source: input.source,
      channel: input.channel,
      valueSource: "TRANSACTION_SNAPSHOT",
      transactionId: input.transactionId,
      transactionNumber: input.transactionNumber,
      parentOrderNumber: input.parentOrderNumber,
      sellerScopeId: input.sellerScopeId,
      transactionDate: input.transactionDate,
      documentId: null,
      documentNumber: null,
      documentType: null,
      documentStatus: null,
      documentDate: null,
      financialYear: this.financialYear(input.transactionDate),
      originalDocumentId: null,
      originalDocumentNumber: null,
      adjustmentReason: null,
      adjustmentDate: null,
      documentCreatedAt: null,
      documentCancelledAt: null,
      documentCancellationReason: null,
      createdByAdmin: null,
      sellerId: input.sellerId,
      sellerName: input.sellerName,
      sellerGstin: input.sellerGstin,
      sellerTaxRegistrationStatus:
        input.sellerTaxRegistrationStatus,
      buyerName: input.buyerName,
      buyerGstin: input.buyerGstin,
      buyerTaxRegistrationStatus: input.buyerGstin
        ? "GST_REGISTERED"
        : "NOT_REGISTERED",
      placeOfSupplyStateCode: input.placeOfSupplyStateCode,
      placeOfSupplyState: input.placeOfSupplyState,
      supplyType: input.supplyType,
      currency: input.currency,
      sourceRecordType: input.sourceRecordType,
      sourceRecordId: input.sourceRecordId,
      lineType: input.lineType,
      description: input.description,
      sku: input.sku,
      hsnSacCode: input.hsnSacCode,
      taxClassification: input.taxClassification,
      quantity: input.quantity,
      uqc: input.uqc,
      gstRatePercent: input.gstRatePercent,
      taxableValuePaise: input.taxableValuePaise,
      cgstPaise: input.cgstPaise,
      sgstPaise: input.sgstPaise,
      igstPaise: input.igstPaise,
      cessPaise: input.cessPaise,
      totalTaxPaise: input.totalTaxPaise,
      lineValuePaise: input.lineValuePaise,
      invoiceValuePaise: input.invoiceValuePaise,
      orderValuePaise: input.orderValuePaise,
      refundAmountPaise: 0,
      creditNoteAdjustedTaxableValuePaise: 0,
      creditNoteAdjustedTaxPaise: 0,
      paymentId: input.payment.id,
      paymentProvider: input.payment.provider,
      paymentReference: input.payment.reference,
      paymentStatus: input.payment.status,
      paymentDate: input.payment.date,
      paidAmountPaise: input.payment.paidAmountPaise ?? 0,
      settlementId: input.settlement.id,
      settlementStatus: input.settlement.status,
      payoutId: input.settlement.payoutId,
      payoutStatus: input.settlement.payoutStatus,
      readinessStatus: input.readinessStatus,
      reconciliationStatus:
        OrderTaxReconciliationStatus.NOT_COMPARABLE,
      documentOrderDifferencePaise: null,
      paymentInvoiceDifferencePaise: null,
      taxSnapshotDocumentDifferencePaise: null,
      warningCodes: input.warnings.map((warning) => warning.code),
      warnings: input.warnings,
      reverseCharge: false,
      gstrSupplySection: null,
      eInvoiceStatus: null,
      irn: null,
      acknowledgementNumber: null,
      acknowledgementDate: null,
      eWayBillStatus: null,
      eWayBillNumber: null,
      eWayBillDate: null,
      eWayBillValidUntil: null,
      detailHref: input.detailHref,
      invoiceDownloadable: false,
    };
  }

  private documentTransaction(document: DocumentRecord) {
    if (document.serviceBooking) {
      return {
        id: document.serviceBooking.id,
        number: document.serviceBooking.bookingNumber,
        parentOrderNumber: null,
        date: document.serviceBooking.createdAt,
        orderValuePaise: document.serviceBooking.totalPayablePaise,
        paymentComparable: true,
        detailHref: `/admin/service-bookings/${encodeURIComponent(document.serviceBooking.bookingNumber)}`,
      };
    }
    if (document.b2bOrder) {
      return {
        id: document.b2bOrder.id,
        number: document.b2bOrder.orderNumber,
        parentOrderNumber: null,
        date: document.b2bOrder.createdAt,
        orderValuePaise: document.b2bOrder.buyerPayableAmountPaise,
        paymentComparable: true,
        detailHref: `/admin/b2b-orders/${encodeURIComponent(document.b2bOrder.orderNumber)}`,
      };
    }
    if (document.order) {
      const split = document.orderSellerSplit;
      const linkedItemValuePaise = document.lines.reduce(
        (sum, line) =>
          sum +
          (line.orderItem
            ? this.prorate(
                line.orderItem.grossTaxableConsiderationPaise,
                line.orderItem.activeQuantity,
                line.orderItem.quantity,
              )
            : 0),
        0,
      );
      return {
        id: document.order.id,
        number: document.order.orderNumber,
        parentOrderNumber:
          document.order.parentOrder?.orderNumber ?? null,
        date: document.order.createdAt,
        orderValuePaise: split
          ? (linkedItemValuePaise || split.sellerSubtotalPaise) +
            (split.shipment?.shippingPaise ?? 0)
          : null,
        paymentComparable: document.order.sellerSplits.length === 1,
        detailHref: `/admin/orders/${encodeURIComponent(document.order.orderNumber)}`,
      };
    }
    return {
      id: document.id,
      number: document.documentNumber ?? document.id,
      parentOrderNumber: null,
      date: document.supplyDate ?? document.createdAt,
      orderValuePaise: null,
      paymentComparable: false,
      detailHref: "/admin/reports/order-tax-register",
    };
  }

  private documentPayment(document: DocumentRecord) {
    if (document.serviceBooking) {
      return this.servicePayment(document.serviceBooking);
    }
    if (document.b2bOrder) {
      return this.b2bPayment(document.b2bOrder);
    }
    return this.orderPayment(document.order?.payments ?? []);
  }

  private documentSettlement(document: DocumentRecord) {
    const value = document.serviceBooking?.settlement;
    if (value) {
      return {
        id: value.id,
        status: value.status,
        payoutId: value.payoutId,
        payoutStatus: value.payout?.status ?? null,
      };
    }
    if (document.b2bOrder) {
      return {
        id: document.b2bOrder.id,
        status: document.b2bOrder.settlementStatus,
        payoutId: document.b2bOrder.payoutId,
        payoutStatus: document.b2bOrder.payout?.status ?? null,
      };
    }
    return {
      id: document.orderSellerSplit?.id ?? null,
      status: document.orderSellerSplit?.settlementStatus ?? null,
      payoutId: document.orderSellerSplit?.payoutId ?? null,
      payoutStatus:
        document.orderSellerSplit?.payout?.status ?? null,
    };
  }

  private orderPayment(
    payments: Array<{
      id: string;
      provider: string;
      providerPaymentId: string | null;
      amountPaise: number;
      status: PaymentStatus;
      createdAt: Date;
      updatedAt: Date;
      events: Array<{ newStatus: PaymentStatus | null; createdAt: Date }>;
    }>,
  ) {
    const payment =
      payments.find((candidate) => candidate.status === PaymentStatus.PAID) ??
      payments[0];
    if (!payment) return this.emptyPayment();
    const paidEvent = payment.events.find(
      (event) => event.newStatus === PaymentStatus.PAID,
    );
    return {
      id: payment.id,
      provider: payment.provider,
      reference: payment.providerPaymentId,
      status: payment.status,
      date: paidEvent?.createdAt ?? payment.updatedAt,
      paidAmountPaise:
        payment.status === PaymentStatus.PAID
          ? payment.amountPaise
          : null,
    };
  }

  private b2bPayment(
    order: Pick<
      B2bOrderRecord,
      | "paymentRecords"
      | "paidAmountPaise"
      | "paidAt"
      | "paymentStatus"
    >,
  ) {
    const payment =
      order.paymentRecords.find((candidate) =>
        ["VERIFIED", "CLEARED"].includes(candidate.status),
      ) ?? order.paymentRecords[0];
    return {
      id: payment?.id ?? null,
      provider: payment?.method ?? null,
      reference:
        payment?.providerPaymentId ??
        payment?.referenceNumber ??
        null,
      status: order.paymentStatus,
      date:
        order.paidAt ??
        payment?.clearedAt ??
        payment?.verifiedAt ??
        payment?.createdAt ??
        null,
      paidAmountPaise:
        order.paidAmountPaise > 0 ? order.paidAmountPaise : null,
    };
  }

  private servicePayment(
    booking: Pick<
      ServiceBookingRecord,
      "payments" | "paidAmountPaise"
    >,
  ) {
    const payment =
      booking.payments.find(
        (candidate) => candidate.status === PaymentStatus.PAID,
      ) ?? booking.payments[0];
    return {
      id: payment?.id ?? null,
      provider: payment?.provider ?? null,
      reference:
        payment?.providerPaymentId ??
        payment?.referenceNumber ??
        null,
      status: payment?.status ?? null,
      date:
        payment?.paidAt ??
        payment?.updatedAt ??
        payment?.createdAt ??
        null,
      paidAmountPaise:
        booking.paidAmountPaise > 0
          ? booking.paidAmountPaise
          : null,
    };
  }

  private emptyPayment() {
    return {
      id: null as string | null,
      provider: null as string | null,
      reference: null as string | null,
      status: null as string | null,
      date: null as Date | null,
      paidAmountPaise: null as number | null,
    };
  }

  private documentWarnings(
    document: DocumentRecord,
    line: DocumentRecord["lines"][number],
    readiness: OrderTaxReadinessStatus,
    taxSnapshotDifferencePaise: number | null,
  ) {
    const warnings: Warning[] = [];
    if (!line.sourceRecordId && !line.orderItemId) {
      warnings.push({
        code: "SOURCE_LINK_MISSING",
        message: "Document line is not linked to its originating transaction record.",
      });
    }
    if (readiness === OrderTaxReadinessStatus.INCOMPLETE_DOCUMENT) {
      warnings.push({
        code: "INCOMPLETE_DOCUMENT",
        message: "Issued document is missing required tax identity or classification data.",
      });
    }
    if (document.sellerGstin && !this.validGstin(document.sellerGstin)) {
      warnings.push({
        code: "INVALID_GSTIN",
        message: "Seller GSTIN snapshot does not match the 15-character GSTIN format.",
      });
    }
    if (document.buyerGstin && !this.validGstin(document.buyerGstin)) {
      warnings.push({
        code: "INVALID_BUYER_GSTIN",
        message: "Buyer GSTIN snapshot does not match the 15-character GSTIN format.",
      });
    }
    if (!document.issueDate) {
      warnings.push({
        code: "DATE_FALLBACK",
        message: "Document date is unavailable; transaction date is used for display.",
      });
    }
    if (
      taxSnapshotDifferencePaise !== null &&
      Math.abs(taxSnapshotDifferencePaise) > MONEY_TOLERANCE_PAISE
    ) {
      warnings.push({
        code: "TAX_SNAPSHOT_DOCUMENT_MISMATCH",
        message:
          "Issued line tax does not match the linked order-item tax snapshot.",
      });
    }
    return warnings;
  }

  private matches(row: OrderTaxRegisterRow, query: OrderTaxRegisterQueryDto) {
    if (row.source !== (query.source ?? OrderTaxRegisterSource.PRODUCT)) {
      return false;
    }
    if (query.channel && row.channel !== query.channel) return false;
    if (query.sellerId && row.sellerId !== query.sellerId) return false;
    if (
      query.documentStatus &&
      row.documentStatus !== query.documentStatus
    ) {
      return false;
    }
    if (query.documentType && row.documentType !== query.documentType) {
      return false;
    }
    if (
      query.readinessStatus &&
      row.readinessStatus !== query.readinessStatus
    ) {
      return false;
    }
    if (
      query.reconciliationStatus &&
      row.reconciliationStatus !== query.reconciliationStatus
    ) {
      return false;
    }
    if (
      query.paymentStatus &&
      row.paymentStatus !== query.paymentStatus
    ) {
      return false;
    }
    if (
      query.settlementStatus &&
      row.settlementStatus !== query.settlementStatus
    ) {
      return false;
    }
    if (
      query.taxClassification &&
      row.taxClassification !== query.taxClassification
    ) {
      return false;
    }
    if (
      query.gstrSupplySection &&
      row.gstrSupplySection !== query.gstrSupplySection
    ) {
      return false;
    }
    if (
      query.eInvoiceStatus &&
      row.eInvoiceStatus !== query.eInvoiceStatus
    ) {
      return false;
    }
    if (
      query.eWayBillStatus &&
      row.eWayBillStatus !== query.eWayBillStatus
    ) {
      return false;
    }
    if (
      query.hsnSacCode &&
      !row.hsnSacCode
        ?.toLowerCase()
        .includes(query.hsnSacCode.toLowerCase())
    ) {
      return false;
    }
    if (
      query.gstRatePercent !== undefined &&
      row.gstRatePercent !== query.gstRatePercent
    ) {
      return false;
    }
    if (
      query.reverseCharge !== undefined &&
      row.reverseCharge !== query.reverseCharge
    ) {
      return false;
    }
    if (
      query.warningCodes?.length &&
      !query.warningCodes.every((code) =>
        row.warningCodes.includes(code),
      )
    ) {
      return false;
    }
    const date = this.rowDate(
      row,
      query.dateBasis ?? OrderTaxRegisterDateBasis.DOCUMENT_DATE,
    );
    if (!this.inDateRange(date, query)) return false;
    const search = query.search?.trim().toLowerCase();
    if (
      search &&
      ![
        row.transactionNumber,
        row.parentOrderNumber,
        row.documentNumber,
        row.paymentId,
        row.paymentReference,
        row.sellerName,
        row.sellerGstin,
        row.buyerName,
        row.buyerGstin,
        row.hsnSacCode,
        row.description,
        row.sku,
      ].some((value) => value?.toLowerCase().includes(search))
    ) {
      return false;
    }
    return true;
  }

  private sortRows(
    rows: OrderTaxRegisterRow[],
    query: OrderTaxRegisterQueryDto,
  ) {
    const direction =
      query.sortDirection === SortDirection.ASC ? 1 : -1;
    const field = query.sortBy ?? OrderTaxRegisterSortField.DATE;
    return rows.sort((left, right) => {
      const values: Record<
        OrderTaxRegisterSortField,
        [string | number, string | number]
      > = {
        DATE: [
          this.rowDate(
            left,
            query.dateBasis ??
              OrderTaxRegisterDateBasis.DOCUMENT_DATE,
          )?.getTime() ?? 0,
          this.rowDate(
            right,
            query.dateBasis ??
              OrderTaxRegisterDateBasis.DOCUMENT_DATE,
          )?.getTime() ?? 0,
        ],
        TRANSACTION: [left.transactionNumber, right.transactionNumber],
        INVOICE: [
          left.documentNumber ?? "",
          right.documentNumber ?? "",
        ],
        SELLER: [left.sellerName, right.sellerName],
        TAXABLE_VALUE: [
          left.taxableValuePaise,
          right.taxableValuePaise,
        ],
        TOTAL_TAX: [left.totalTaxPaise, right.totalTaxPaise],
        INVOICE_VALUE: [
          left.invoiceValuePaise,
          right.invoiceValuePaise,
        ],
        READINESS: [left.readinessStatus, right.readinessStatus],
        RECONCILIATION: [
          left.reconciliationStatus,
          right.reconciliationStatus,
        ],
      };
      const [a, b] = values[field];
      return (
        direction *
        (typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b)))
      );
    });
  }

  private summary(rows: OrderTaxRegisterRow[]) {
    const transactionIds = new Set<string>();
    const documentIds = new Set<string>();
    const invoiceScopes = new Map<string, number>();
    const readinessScopes = new Map<
      string,
      OrderTaxReadinessStatus
    >();
    const reconciliationScopes = new Map<
      string,
      OrderTaxReconciliationStatus
    >();
    const warningScopes = new Map<string, Set<string>>();
    let taxableValuePaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let cessPaise = 0;
    let totalTaxPaise = 0;
    for (const row of rows) {
      transactionIds.add(row.transactionId);
      if (row.documentId) documentIds.add(row.documentId);
      invoiceScopes.set(row.documentScopeKey, row.invoiceValuePaise);
      readinessScopes.set(
        row.documentScopeKey,
        this.worseReadiness(
          readinessScopes.get(row.documentScopeKey),
          row.readinessStatus,
        ),
      );
      reconciliationScopes.set(
        row.documentScopeKey,
        row.reconciliationStatus,
      );
      warningScopes.set(
        row.documentScopeKey,
        new Set([
          ...(warningScopes.get(row.documentScopeKey) ?? []),
          ...row.warningCodes,
        ]),
      );
      taxableValuePaise += row.taxableValuePaise;
      cgstPaise += row.cgstPaise;
      sgstPaise += row.sgstPaise;
      igstPaise += row.igstPaise;
      cessPaise += row.cessPaise;
      totalTaxPaise += row.totalTaxPaise;
    }
    return {
      transactionCount: transactionIds.size,
      documentCount: documentIds.size,
      lineCount: rows.length,
      taxableValuePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      cessPaise,
      totalTaxPaise,
      invoiceValuePaise: [...invoiceScopes.values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
      readinessCounts: this.countValues(
        Object.values(OrderTaxReadinessStatus),
        readinessScopes.values(),
      ),
      reconciliationCounts: this.countValues(
        Object.values(OrderTaxReconciliationStatus),
        reconciliationScopes.values(),
      ),
      warningCounts: [...warningScopes.values()].reduce<Record<string, number>>(
        (counts, codes) => {
          codes.forEach((code) => {
            counts[code] = (counts[code] ?? 0) + 1;
          });
          return counts;
        },
        {},
      ),
    };
  }

  private countValues<T extends string>(
    values: T[],
    selected: IterableIterator<T>,
  ) {
    const counts = Object.fromEntries(
      values.map((value) => [value, 0]),
    ) as Record<T, number>;
    for (const value of selected) counts[value] += 1;
    return counts;
  }

  private worseReadiness(
    current: OrderTaxReadinessStatus | undefined,
    next: OrderTaxReadinessStatus,
  ) {
    if (!current) return next;
    const priority: Record<OrderTaxReadinessStatus, number> = {
      MISSING_DOCUMENT: 6,
      INCOMPLETE_DOCUMENT: 5,
      DRAFT_DOCUMENT: 4,
      CANCELLED_DOCUMENT: 3,
      READY: 2,
      NOT_REQUIRED: 1,
    };
    return priority[next] > priority[current] ? next : current;
  }

  private rowDate(
    row: OrderTaxRegisterRow,
    basis: OrderTaxRegisterDateBasis,
  ) {
    if (basis === OrderTaxRegisterDateBasis.PAYMENT_DATE) {
      return row.paymentDate;
    }
    if (basis === OrderTaxRegisterDateBasis.TRANSACTION_DATE) {
      return row.transactionDate;
    }
    return row.documentDate ?? row.transactionDate;
  }

  private inDateRange(
    date: Date | null,
    query: OrderTaxRegisterQueryDto,
  ) {
    if (!query.dateFrom && !query.dateTo) return true;
    if (!date) return false;
    const from = query.dateFrom
      ? new Date(`${query.dateFrom}T00:00:00.000Z`)
      : null;
    const to = query.dateTo
      ? new Date(`${query.dateTo}T23:59:59.999Z`)
      : null;
    return (!from || date >= from) && (!to || date <= to);
  }

  private dateRange(query: OrderTaxRegisterQueryDto) {
    if (!query.dateFrom && !query.dateTo) return undefined;
    return {
      ...(query.dateFrom
        ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
        : {}),
      ...(query.dateTo
        ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
        : {}),
    };
  }

  private address(value: Prisma.JsonValue | null) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const text = (key: string) => {
      const found = object[key];
      return typeof found === "string" ? found : "";
    };
    return {
      state: text("state"),
      stateCode: text("stateCode"),
    };
  }

  private stringFromJson(value: Prisma.JsonValue | null, key: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return typeof value[key] === "string" ? value[key] : null;
  }

  private validGstin(value: string) {
    return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
      value.trim().toUpperCase(),
    );
  }

  private financialYear(date: Date) {
    const year = date.getUTCFullYear();
    const start = date.getUTCMonth() >= 3 ? year : year - 1;
    return `${start}-${String(start + 1).slice(-2)}`;
  }

  private prorate(value: number, quantity: number, originalQuantity: number) {
    if (originalQuantity <= 0 || quantity <= 0) return 0;
    if (quantity >= originalQuantity) return value;
    return Math.round((value * quantity) / originalQuantity);
  }
}
