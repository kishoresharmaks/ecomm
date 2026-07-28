import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GstComplianceStatus,
  GstFilingPeriodStatus,
  GstReportExportType,
  GstrSupplySection,
  OrderStatus,
  ProductTaxClassification,
  Prisma,
  SellerStatus,
  SellerTaxRegistrationStatus,
  TaxDocumentLineType,
  TaxDocumentSource,
  TaxDocumentStatus,
  TaxDocumentType,
  TaxSupplyType,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { FinanceCalculatorService } from "../finance/finance-calculator.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  type GstSettings,
  isConfiguredPlatformGst,
  readGstSettings,
} from "../settings/gst-settings";
import {
  CreateGstDebitNoteDto,
  GstFilingPeriodDto,
  GstMarkFiledDto,
  RecordTaxDocumentComplianceDto,
} from "./dto/gst-compliance.dto";
import {
  AdminGstReportQueryDto,
  GstDocumentQueryDto,
  SellerGstDocumentQueryDto,
} from "./dto/gst-report-query.dto";
import { ReportQueryDto } from "./dto/report-query.dto";

type MoneyTotals = {
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  cessPaise: number;
  totalTaxPaise: number;
  invoiceValuePaise: number;
};

type SignedLine = {
  id: string;
  lineType: TaxDocumentLineType;
  description: string;
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
};

type SignedDocument = MoneyTotals & {
  id: string;
  documentNumber: string | null;
  documentType: TaxDocumentType;
  issueDate: Date | null;
  financialYear: string;
  orderNumber: string | null;
  sellerId: string;
  sellerName: string;
  sellerTaxRegistrationStatus: SellerTaxRegistrationStatus;
  sellerGstin: string | null;
  buyerLegalName: string;
  buyerGstin: string | null;
  buyerAddress: {
    line1: string;
    line2: string;
    area: string;
    city: string;
    state: string;
    stateCode: string;
    postalCode: string;
    country: string;
    countryCode: string;
  };
  placeOfSupplyStateCode: string | null;
  supplyType: TaxSupplyType | null;
  gstrSupplySection: GstrSupplySection | null;
  originalDocumentNumber: string | null;
  reason: string | null;
  reverseCharge: boolean;
  currency: string;
  compliance: {
    eInvoiceStatus: GstComplianceStatus;
    irn: string | null;
    acknowledgementNumber: string | null;
    acknowledgementDate: Date | null;
    signedQrCode: string | null;
    eInvoiceProvider: string | null;
    eInvoiceError: string | null;
    eWayBillStatus: GstComplianceStatus;
    eWayBillNumber: string | null;
    eWayBillGeneratedAt: Date | null;
    eWayBillValidUntil: Date | null;
    eWayBillProvider: string | null;
    eWayBillError: string | null;
    lastSyncedAt: Date | null;
  };
  lines: SignedLine[];
};

type DocumentSummary = MoneyTotals & {
  documentCount: number;
  invoiceCount: number;
  creditNoteCount: number;
  debitNoteCount: number;
};

type TaxDocumentWithReportRelations = Prisma.TaxDocumentGetPayload<{
  include: {
    seller: { select: { id: true; storeName: true } };
    originalDocument: { select: { documentNumber: true } };
    order: { select: { orderNumber: true } };
    b2bOrder: { select: { orderNumber: true } };
    serviceBooking: { select: { bookingNumber: true } };
    lines: true;
    compliance: true;
  };
}>;

@Injectable()
export class GstComplianceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly financeCalculator: FinanceCalculatorService,
  ) {}

  async sellerIdForActor(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }
    return seller.id;
  }

  async report(query: ReportQueryDto, sellerId?: string, includeAll = false) {
    const issueDate = this.dateRange(query);
    const db = this.prisma.client as PrismaService["client"] & {
      gstFilingPeriod?: PrismaService["client"]["gstFilingPeriod"];
      marketplaceTaxDocument?: PrismaService["client"]["marketplaceTaxDocument"];
      setting?: PrismaService["client"]["setting"];
    };
    const [documents, filingPeriods, providerReadiness, platformDocuments, draftCount] =
      await Promise.all([
        db.taxDocument.findMany({
          where: {
            status: TaxDocumentStatus.ISSUED,
            ...(sellerId ? { sellerId } : {}),
            ...(issueDate ? { issueDate } : {}),
          },
          include: {
            seller: { select: { id: true, storeName: true } },
            originalDocument: { select: { documentNumber: true } },
            order: { select: { orderNumber: true } },
            b2bOrder: { select: { orderNumber: true } },
            serviceBooking: { select: { bookingNumber: true } },
            lines: true,
            compliance: true,
          },
          orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
          ...(includeAll ? {} : { take: 250 }),
        }),
        sellerId
          ? db.gstFilingPeriod?.findMany({
              where: { sellerId },
              orderBy: { dateFrom: "desc" },
              take: 24,
              include: {
                _count: { select: { reconciliationRuns: true, exports: true } },
              },
            })
          : Promise.resolve([]),
        this.providerReadiness(),
        db.marketplaceTaxDocument
          ? db.marketplaceTaxDocument.findMany({
              where: {
                ...(sellerId ? { sellerId } : {}),
                ...(issueDate ? { issueDate } : {}),
              },
              include: { seller: { select: { storeName: true } } },
              orderBy: { issueDate: "desc" },
              ...(includeAll ? {} : { take: 250 }),
            })
          : Promise.resolve([]),
        db.taxDocument.count
          ? db.taxDocument.count({
              where: {
                status: TaxDocumentStatus.DRAFT,
                ...(sellerId ? { sellerId } : {}),
                ...(issueDate ? { createdAt: issueDate } : {}),
              },
            })
          : Promise.resolve(0),
      ]);

    const signedDocuments = documents.map((document) =>
      this.toSignedDocument(document, providerReadiness),
    );
    const filingDocuments = signedDocuments.filter(
      (document) =>
        document.sellerTaxRegistrationStatus ===
        SellerTaxRegistrationStatus.GST_REGISTERED,
    );

    const hsnSummary = this.hsnSummary(filingDocuments);
    const summary = this.documentSummary(signedDocuments);
    const reconciliation = this.reconcile(signedDocuments, draftCount, summary);
    const tcs = await this.tcsReport(query, sellerId);

    return {
      currency: "INR",
      summary,
      documents: signedDocuments,
      hsnSummary,
      sections: this.sectionSummary(filingDocuments),
      gstr1: this.gstr1Sections(filingDocuments),
      gstr3b: this.gstr3bSummary(filingDocuments),
      documentSeries: this.documentSeries(filingDocuments),
      rateLiability: this.rateLiability(filingDocuments),
      stateLiability: this.stateLiability(filingDocuments),
      gstinSummary: this.gstinSummary(filingDocuments),
      reconciliation,
      tcs,
      platformCommission: {
        configured: providerReadiness.platformInvoice.configured,
        missingConfiguration: providerReadiness.platformInvoice.missingConfiguration,
        summary: this.marketplaceDocumentSummary(platformDocuments ?? []),
        documents: platformDocuments ?? [],
      },
      providerReadiness,
      filingPeriods: filingPeriods ?? [],
      truncated: !includeAll && documents.length === 250,
    };
  }

  async adminOverview(query: AdminGstReportQueryDto) {
    return this.overview(query, query.sellerId);
  }

  async sellerOverview(query: ReportQueryDto, sellerId: string) {
    return this.overview(query, sellerId);
  }

  async sellerDocumentPage(actor: RequestUser, query: SellerGstDocumentQueryDto) {
    const sellerId = await this.sellerIdForActor(actor);
    return this.documentPage({ ...query, sellerId });
  }

  async gstSellerOptions() {
    const sellers = await this.prisma.client.seller.findMany({
      where: {
        status: SellerStatus.APPROVED,
        profile: {
          is: {
            taxRegistrationStatus: SellerTaxRegistrationStatus.GST_REGISTERED,
          },
        },
      },
      select: {
        id: true,
        storeName: true,
        profile: {
          select: {
            businessLegalName: true,
            gstNumber: true,
          },
        },
      },
      orderBy: { storeName: "asc" },
      take: 500,
    });
    return sellers.flatMap((seller) => {
      const gstin = this.validGstin(seller.profile?.gstNumber);
      return gstin
        ? [{
            id: seller.id,
            storeName: seller.storeName,
            businessLegalName: seller.profile?.businessLegalName ?? null,
            gstin,
          }]
        : [];
    });
  }

  private async overview(query: ReportQueryDto, sellerId?: string) {
    const report = await this.report(query, sellerId, true);
    const { documents, gstr1, truncated: _truncated, ...overview } = report;
    return {
      ...overview,
      gstr1Counts: Object.fromEntries(
        Object.entries(gstr1).map(([section, sectionDocuments]) => [
          section,
          sectionDocuments.length,
        ]),
      ),
      documentTotal: documents.length,
      complianceCounts: {
        eInvoiceReady: documents.filter(
          (document) => document.compliance.eInvoiceStatus === GstComplianceStatus.READY,
        ).length,
        eWayBillReady: documents.filter(
          (document) => document.compliance.eWayBillStatus === GstComplianceStatus.READY,
        ).length,
      },
    };
  }

  async documentPage(query: GstDocumentQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, {
      defaultLimit: 25,
      maxLimit: 100,
    });
    const issueDate = this.dateRange(query);
    const search = query.search?.trim();
    const complianceFilter =
      query.eInvoiceStatus || query.eWayBillStatus
        ? {
            is: {
              ...(query.eInvoiceStatus ? { eInvoiceStatus: query.eInvoiceStatus } : {}),
              ...(query.eWayBillStatus ? { eWayBillStatus: query.eWayBillStatus } : {}),
            },
          }
        : undefined;
    const where: Prisma.TaxDocumentWhereInput = {
      status: TaxDocumentStatus.ISSUED,
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.sellerTaxRegistrationStatus
        ? { sellerTaxRegistrationStatus: query.sellerTaxRegistrationStatus }
        : {}),
      ...(issueDate ? { issueDate } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.section ? { gstrSupplySection: query.section } : {}),
      ...(query.taxClassification
        ? { lines: { some: { taxClassification: query.taxClassification } } }
        : {}),
      ...(complianceFilter ? { compliance: complianceFilter } : {}),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: "insensitive" } },
              { sellerLegalName: { contains: search, mode: "insensitive" } },
              { sellerGstin: { contains: search, mode: "insensitive" } },
              { buyerLegalName: { contains: search, mode: "insensitive" } },
              { buyerGstin: { contains: search, mode: "insensitive" } },
              { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              { b2bOrder: { orderNumber: { contains: search, mode: "insensitive" } } },
              { serviceBooking: { bookingNumber: { contains: search, mode: "insensitive" } } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [documents, total, providerReadiness] = await Promise.all([
      this.prisma.client.taxDocument.findMany({
        where,
        include: {
          seller: { select: { id: true, storeName: true } },
          originalDocument: { select: { documentNumber: true } },
          order: { select: { orderNumber: true } },
          b2bOrder: { select: { orderNumber: true } },
          serviceBooking: { select: { bookingNumber: true } },
          lines: true,
          compliance: true,
        },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.prisma.client.taxDocument.count({ where }),
      this.providerReadiness(),
    ]);

    return {
      items: documents.map((document) =>
        this.toSignedDocument(document, providerReadiness),
      ),
      total,
      page,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  async lockPeriod(sellerId: string, actor: RequestUser, dto: GstFilingPeriodDto) {
    await this.ensureRegularGstSeller(sellerId);
    const { dateFrom, dateTo, financialYear } = this.periodDates(dto.returnPeriod);
    await this.generatePlatformCommissionDocuments(sellerId, dateFrom, dateTo, actor.id);
    const report = await this.report(
      { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
      sellerId,
      true,
    );
    if (report.reconciliation.errorCount > 0) {
      throw new ConflictException(
        "Resolve GST reconciliation errors before locking this filing period.",
      );
    }

    const snapshot = this.jsonValue({
      version: 1,
      generatedAt: new Date().toISOString(),
      returnPeriod: dto.returnPeriod,
      financialYear,
      summary: report.summary,
      sections: report.sections,
      hsnSummary: report.hsnSummary,
      gstr1: report.gstr1,
      gstr3b: report.gstr3b,
      tcs: report.tcs,
      documentSeries: report.documentSeries,
      rateLiability: report.rateLiability,
      stateLiability: report.stateLiability,
      gstinSummary: report.gstinSummary,
      platformCommission: report.platformCommission,
      providerReadiness: report.providerReadiness,
      reconciliation: report.reconciliation,
    });
    const snapshotHash = this.sha256(JSON.stringify(snapshot));

    return this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.gstFilingPeriod.findUnique({
        where: { sellerId_returnPeriod: { sellerId, returnPeriod: dto.returnPeriod } },
      });
      if (existing?.status === GstFilingPeriodStatus.FILED) {
        throw new ConflictException("Filed GST periods cannot be changed.");
      }
      if (existing?.status === GstFilingPeriodStatus.LOCKED) {
        return existing;
      }

      const period = await tx.gstFilingPeriod.upsert({
        where: { sellerId_returnPeriod: { sellerId, returnPeriod: dto.returnPeriod } },
        create: {
          sellerId,
          returnPeriod: dto.returnPeriod,
          financialYear,
          dateFrom,
          dateTo,
          status: GstFilingPeriodStatus.LOCKED,
          snapshot,
          snapshotHash,
          lockedAt: new Date(),
          lockedById: actor.id,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        update: {
          financialYear,
          dateFrom,
          dateTo,
          status: GstFilingPeriodStatus.LOCKED,
          snapshot,
          snapshotHash,
          lockedAt: new Date(),
          lockedById: actor.id,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await tx.gstReconciliationRun.create({
        data: {
          filingPeriodId: period.id,
          sellerId,
          dateFrom,
          dateTo,
          issueCount: report.reconciliation.issueCount,
          errorCount: report.reconciliation.errorCount,
          warningCount: report.reconciliation.warningCount,
          bookSnapshot: this.jsonValue(report.reconciliation.books),
          filingSnapshot: this.jsonValue(report.reconciliation.filing),
          issues: this.jsonValue(report.reconciliation.issues),
          runHash: this.sha256(JSON.stringify(report.reconciliation)),
          createdById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "GST_FILING_PERIOD_LOCKED",
          entityType: "GstFilingPeriod",
          entityId: period.id,
          newValue: {
            sellerId,
            returnPeriod: dto.returnPeriod,
            snapshotHash,
            issueCount: report.reconciliation.issueCount,
          },
        },
      });
      return period;
    });
  }

  async reopenPeriod(sellerId: string, returnPeriod: string, actor: RequestUser) {
    await this.ensureRegularGstSeller(sellerId);
    const period = await this.prisma.client.gstFilingPeriod.findUnique({
      where: { sellerId_returnPeriod: { sellerId, returnPeriod } },
    });
    if (!period) {
      throw new NotFoundException("GST filing period not found.");
    }
    if (period.status === GstFilingPeriodStatus.FILED) {
      throw new ConflictException("Filed GST periods cannot be reopened.");
    }
    const updated = await this.prisma.client.gstFilingPeriod.update({
      where: { id: period.id },
      data: { status: GstFilingPeriodStatus.REOPENED },
    });
    await this.audit(actor.id, "GST_FILING_PERIOD_REOPENED", "GstFilingPeriod", period.id, {
      returnPeriod,
    });
    return updated;
  }

  async markFiled(sellerId: string, actor: RequestUser, dto: GstMarkFiledDto) {
    await this.ensureRegularGstSeller(sellerId);
    const period = await this.prisma.client.gstFilingPeriod.findUnique({
      where: { sellerId_returnPeriod: { sellerId, returnPeriod: dto.returnPeriod } },
    });
    if (!period) {
      throw new NotFoundException("Lock the GST filing period before marking it filed.");
    }
    if (period.status !== GstFilingPeriodStatus.LOCKED) {
      throw new ConflictException("Only a locked GST period can be marked filed.");
    }
    const updated = await this.prisma.client.gstFilingPeriod.update({
      where: { id: period.id },
      data: {
        status: GstFilingPeriodStatus.FILED,
        filingReference: dto.filingReference.trim(),
        filedAt: new Date(),
        filedById: actor.id,
      },
    });
    await this.audit(actor.id, "GST_FILING_PERIOD_FILED", "GstFilingPeriod", period.id, {
      filingReference: dto.filingReference.trim(),
    });
    return updated;
  }

  async createDebitNote(
    sellerId: string,
    actor: RequestUser,
    dto: CreateGstDebitNoteDto,
  ) {
    if (!dto.lines.length) {
      throw new BadRequestException("Add at least one debit-note line.");
    }
    return this.prisma.client.$transaction(async (tx) => {
      const original = await tx.taxDocument.findFirst({
        where: {
          id: dto.originalDocumentId,
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
        throw new NotFoundException("The original issued seller invoice was not found.");
      }
      const returnPeriod = this.returnPeriod(original.issueDate ?? new Date());
      const locked = await tx.gstFilingPeriod.findUnique({
        where: { sellerId_returnPeriod: { sellerId, returnPeriod } },
      });
      if (
        locked?.status === GstFilingPeriodStatus.LOCKED ||
        locked?.status === GstFilingPeriodStatus.FILED
      ) {
        throw new ConflictException(
          "This GST period is locked. Reopen it before issuing an adjustment.",
        );
      }

      const lines = dto.lines.map((line) => {
        const taxClassification =
          line.taxClassification ??
          (line.gstRatePercent > 0
            ? ProductTaxClassification.TAXABLE
            : ProductTaxClassification.NIL_RATED);
        const hsnSacCode = line.hsnSacCode?.trim() || null;
        const regularTaxableSupply =
          original.sellerTaxRegistrationStatus ===
            SellerTaxRegistrationStatus.GST_REGISTERED &&
          taxClassification === ProductTaxClassification.TAXABLE;
        if (
          taxClassification !== ProductTaxClassification.TAXABLE &&
          line.gstRatePercent > 0
        ) {
          throw new BadRequestException(
            "Nil-rated, exempt, and non-GST debit-note lines cannot carry a positive GST rate.",
          );
        }
        if (
          taxClassification === ProductTaxClassification.NIL_RATED &&
          !hsnSacCode
        ) {
          throw new BadRequestException(
            "Nil-rated debit-note lines require an HSN/SAC code.",
          );
        }
        if (
          regularTaxableSupply &&
          (!hsnSacCode || line.gstRatePercent <= 0)
        ) {
          throw new BadRequestException(
            "Taxable debit-note lines for a regular GST seller require an HSN/SAC code and a positive GST rate.",
          );
        }
        const appliedGstRate = regularTaxableSupply
          ? line.gstRatePercent
          : 0;
        const tax = this.calculateInclusiveTax(
          line.lineValuePaise,
          appliedGstRate,
          original.supplyType ?? TaxSupplyType.INTER_STATE,
        );
        return {
          lineType: TaxDocumentLineType.ADJUSTMENT,
          description: line.description.trim(),
          hsnSacCode,
          taxClassification,
          quantity: line.quantity,
          unitPricePaise: Math.round(line.lineValuePaise / line.quantity),
          grossValuePaise: line.lineValuePaise,
          taxableValuePaise: tax.taxableValuePaise,
          gstRatePercent: new Prisma.Decimal(appliedGstRate),
          cgstPaise: tax.cgstPaise,
          sgstPaise: tax.sgstPaise,
          igstPaise: tax.igstPaise,
          totalTaxPaise: tax.taxTotalPaise,
          lineValuePaise: line.lineValuePaise,
        };
      });
      const documentNumber = await this.nextSellerDocumentNumber(
        tx,
        sellerId,
        original.financialYear,
        TaxDocumentType.DEBIT_NOTE,
      );
      const taxableValuePaise = lines.reduce((sum, line) => sum + line.taxableValuePaise, 0);
      const cgstPaise = lines.reduce((sum, line) => sum + line.cgstPaise, 0);
      const sgstPaise = lines.reduce((sum, line) => sum + line.sgstPaise, 0);
      const igstPaise = lines.reduce((sum, line) => sum + line.igstPaise, 0);
      const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
      const invoiceValuePaise = lines.reduce((sum, line) => sum + line.lineValuePaise, 0);
      const idempotencyKey = `manual-debit:${sellerId}:${documentNumber}`;
      const document = await tx.taxDocument.create({
        data: {
          documentNumber,
          documentType: TaxDocumentType.DEBIT_NOTE,
          status: TaxDocumentStatus.ISSUED,
          source: TaxDocumentSource.MANUAL_ADJUSTMENT,
          idempotencyKey,
          financialYear: original.financialYear,
          orderId: original.orderId,
          b2bOrderId: original.b2bOrderId,
          orderSellerSplitId: original.orderSellerSplitId,
          sellerId,
          originalDocumentId: original.id,
          issueDate: new Date(),
          supplyDate: original.supplyDate,
          sellerLegalName: original.sellerLegalName,
          sellerTaxRegistrationStatus: original.sellerTaxRegistrationStatus,
          sellerGstin: original.sellerGstin,
          sellerAddressSnapshot: this.requiredJsonObject(original.sellerAddressSnapshot),
          buyerLegalName: original.buyerLegalName,
          buyerGstin: original.buyerGstin,
          buyerAddressSnapshot: this.requiredJsonObject(original.buyerAddressSnapshot),
          placeOfSupplyStateCode: original.placeOfSupplyStateCode,
          supplyType: original.supplyType,
          gstrSupplySection:
            original.sellerTaxRegistrationStatus ===
              SellerTaxRegistrationStatus.GST_REGISTERED &&
            original.gstrSupplySection !== GstrSupplySection.NIL_EXEMPT_NON_GST
              ? original.buyerGstin
                ? GstrSupplySection.CDNR
                : GstrSupplySection.CDNUR
              : original.gstrSupplySection,
          reverseCharge: original.reverseCharge,
          currency: original.currency,
          taxableValuePaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          totalTaxPaise,
          invoiceValuePaise,
          reason: dto.reason.trim(),
          issuedById: actor.id,
          lines: { create: lines },
        },
        include: { lines: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "GST_DEBIT_NOTE_ISSUED",
          entityType: "TaxDocument",
          entityId: document.id,
          newValue: {
            documentNumber,
            originalDocumentId: original.id,
            invoiceValuePaise,
          },
        },
      });
      return document;
    });
  }

  async recordCompliance(
    documentId: string,
    actor: RequestUser,
    dto: RecordTaxDocumentComplianceDto,
  ) {
    const document = await this.prisma.client.taxDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        status: true,
        compliance: {
          select: {
            eInvoiceStatus: true,
            irn: true,
            acknowledgementNumber: true,
            acknowledgementDate: true,
            signedQrCode: true,
            eInvoiceProvider: true,
            eInvoiceProviderRef: true,
            eInvoiceError: true,
          },
        },
      },
    });
    if (!document || document.status !== TaxDocumentStatus.ISSUED) {
      throw new NotFoundException("Issued tax document not found.");
    }
    const current = document.compliance;
    const eInvoiceStatus =
      dto.eInvoiceStatus ??
      current?.eInvoiceStatus ??
      GstComplianceStatus.NOT_REQUIRED;
    const irn =
      dto.irn !== undefined ? dto.irn.trim() || null : current?.irn ?? null;
    const acknowledgementNumber =
      dto.acknowledgementNumber !== undefined
        ? dto.acknowledgementNumber.trim() || null
        : current?.acknowledgementNumber ?? null;
    const acknowledgementDate =
      dto.acknowledgementDate !== undefined
        ? new Date(dto.acknowledgementDate)
        : current?.acknowledgementDate ?? null;
    const signedQrCode =
      dto.signedQrCode !== undefined
        ? dto.signedQrCode.trim() || null
        : current?.signedQrCode ?? null;
    if (
      eInvoiceStatus === GstComplianceStatus.GENERATED &&
      (!irn ||
        !acknowledgementNumber ||
        !acknowledgementDate ||
        !signedQrCode)
    ) {
      throw new BadRequestException(
        "Generated e-invoices require the IRN, acknowledgement number and date, and signed QR payload.",
      );
    }
    const data = {
      eInvoiceStatus,
      irn,
      acknowledgementNumber,
      acknowledgementDate,
      signedQrCode,
      ...(dto.eInvoiceProvider !== undefined
        ? { eInvoiceProvider: dto.eInvoiceProvider.trim() || null }
        : {}),
      ...(dto.eInvoiceProviderRef !== undefined
        ? { eInvoiceProviderRef: dto.eInvoiceProviderRef.trim() || null }
        : {}),
      ...(dto.eInvoiceError !== undefined
        ? { eInvoiceError: dto.eInvoiceError.trim() || null }
        : {}),
      ...(dto.eWayBillStatus ? { eWayBillStatus: dto.eWayBillStatus } : {}),
      ...(dto.eWayBillNumber !== undefined
        ? { eWayBillNumber: dto.eWayBillNumber.trim() || null }
        : {}),
      ...(dto.eWayBillGeneratedAt !== undefined
        ? { eWayBillGeneratedAt: new Date(dto.eWayBillGeneratedAt) }
        : {}),
      ...(dto.eWayBillValidUntil !== undefined
        ? { eWayBillValidUntil: new Date(dto.eWayBillValidUntil) }
        : {}),
      ...(dto.eWayBillProvider !== undefined
        ? { eWayBillProvider: dto.eWayBillProvider.trim() || null }
        : {}),
      ...(dto.eWayBillProviderRef !== undefined
        ? { eWayBillProviderRef: dto.eWayBillProviderRef.trim() || null }
        : {}),
      ...(dto.eWayBillError !== undefined
        ? { eWayBillError: dto.eWayBillError.trim() || null }
        : {}),
      lastSyncedAt: new Date(),
    };
    const compliance = await this.prisma.client.taxDocumentCompliance.upsert({
      where: { taxDocumentId: documentId },
      create: { taxDocumentId: documentId, ...data },
      update: data,
    });
    await this.audit(
      actor.id,
      "GST_DOCUMENT_COMPLIANCE_RECORDED",
      "TaxDocument",
      documentId,
      {
        eInvoiceStatus: compliance.eInvoiceStatus,
        eWayBillStatus: compliance.eWayBillStatus,
      },
    );
    return compliance;
  }

  async recordExport(input: {
    sellerId?: string;
    actorUserId: string;
    query: ReportQueryDto;
    exportType: GstReportExportType;
    fileName: string;
    contentType: string;
    content: string;
    rowCount: number;
  }) {
    let filingPeriodId: string | undefined;
    if (input.sellerId && input.query.dateFrom) {
      const returnPeriod = this.returnPeriod(new Date(input.query.dateFrom));
      const period = await this.prisma.client.gstFilingPeriod.findUnique({
        where: {
          sellerId_returnPeriod: { sellerId: input.sellerId, returnPeriod },
        },
        select: { id: true },
      });
      filingPeriodId = period?.id;
    }
    return this.prisma.client.gstReportExport.create({
      data: {
        ...(filingPeriodId ? { filingPeriodId } : {}),
        ...(input.sellerId ? { sellerId: input.sellerId } : {}),
        exportType: input.exportType,
        fileName: input.fileName,
        contentType: input.contentType,
        sha256: this.sha256(input.content),
        rowCount: input.rowCount,
        generatedById: input.actorUserId,
      },
    });
  }

  gstr1Json(report: Awaited<ReturnType<GstComplianceService["report"]>>) {
    const supplierGstin =
      report.documents.find((document) => document.sellerGstin)?.sellerGstin ?? "";
    const firstDate = report.documents.find((document) => document.issueDate)?.issueDate;
    const fp = firstDate ? this.returnPeriod(new Date(firstDate)) : "";
    const byReceiver = new Map<string, SignedDocument[]>();
    for (const document of report.gstr1.B2B) {
      const receiver = document.buyerGstin ?? "";
      byReceiver.set(receiver, [...(byReceiver.get(receiver) ?? []), document]);
    }
    const invoice = (document: SignedDocument) => ({
      inum: document.documentNumber,
      idt: this.gstDate(document.issueDate),
      val: this.rupees(document.invoiceValuePaise),
      pos: document.placeOfSupplyStateCode ?? "",
      rchrg: document.reverseCharge ? "Y" : "N",
      inv_typ: document.gstrSupplySection === GstrSupplySection.SEZ ? "SEWOP" : "R",
      itms: this.itemsByRate(document),
    });
    const note = (document: SignedDocument) => ({
      nt_num: document.documentNumber,
      nt_dt: this.gstDate(document.issueDate),
      ntty: document.documentType === TaxDocumentType.CREDIT_NOTE ? "C" : "D",
      inum: document.originalDocumentNumber,
      val: this.rupees(Math.abs(document.invoiceValuePaise)),
      pos: document.placeOfSupplyStateCode ?? "",
      itms: this.itemsByRate(document),
    });

    return {
      gstin: supplierGstin,
      fp,
      version: "1HandIndia-GSTR1-2026.1",
      uploadReady: false,
      validationNotes: [
        "Review this filing package against the current GST portal offline-utility schema before upload.",
        "The export preserves immutable invoice, note, HSN, rate, and place-of-supply values.",
      ],
      b2b: [...byReceiver].map(([ctin, documents]) => ({
        ctin,
        inv: documents.map(invoice),
      })),
      b2cl: report.gstr1.B2CL.map(invoice),
      b2cs: this.rateStateRows(report.gstr1.B2CS),
      cdnr: this.groupNotesByReceiver(report.gstr1.CDNR, note),
      cdnur: report.gstr1.CDNUR.map(note),
      exp: report.gstr1.EXPORT.map(invoice),
      sez: report.gstr1.SEZ.map(invoice),
      nil: report.gstr1.NIL_EXEMPT_NON_GST.map(invoice),
      hsn: { data: report.hsnSummary },
      doc_issue: { doc_det: report.documentSeries },
    };
  }

  private async tcsReport(query: ReportQueryDto, sellerId?: string) {
    const createdAt = this.dateRange(query);
    const splits = (await this.prisma.client.orderSellerSplit.findMany({
      where: {
        ...(sellerId ? { sellerId } : {}),
        order: {
          orderStatus: { not: OrderStatus.CANCELLED },
          ...(createdAt ? { createdAt } : {}),
        },
      },
      include: {
        seller: {
          include: {
            profile: true,
            addresses: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
        order: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })) ?? [];
    const sellerMap = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        sellerGstin: string | null;
        grossSuppliesPaise: number;
        returnsPaise: number;
        netSuppliesPaise: number;
        igstPaise: number;
        cgstPaise: number;
        sgstPaise: number;
        totalTcsPaise: number;
        transactionCount: number;
      }
    >();
    for (const split of splits) {
      let tcsPaise = split.tcsPaise;
      if (
        split.sellerSubtotalPaise > 0 &&
        split.commissionPaise === 0 &&
        split.gstOnCommissionPaise === 0 &&
        split.tdsPaise === 0 &&
        split.tcsPaise === 0 &&
        split.platformFeePaise === 0
      ) {
        tcsPaise = (await this.financeCalculator.calculateSplit(split)).tcsPaise;
      }
      const sellerItems = split.order.items.filter((item) => item.sellerId === split.sellerId);
      const intraState =
        sellerItems.length > 0 &&
        sellerItems.every(
          (item) => item.taxSupplyTypeSnapshot === TaxSupplyType.INTRA_STATE,
        );
      const current = sellerMap.get(split.sellerId) ?? {
        sellerId: split.sellerId,
        sellerName: split.seller.storeName,
        sellerGstin: this.validGstin(split.seller.profile?.gstNumber),
        grossSuppliesPaise: 0,
        returnsPaise: 0,
        netSuppliesPaise: 0,
        igstPaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        totalTcsPaise: 0,
        transactionCount: 0,
      };
      const returnsPaise = Math.abs(Math.min(0, split.refundAdjustmentPaise));
      current.grossSuppliesPaise += split.sellerSubtotalPaise;
      current.returnsPaise += returnsPaise;
      current.netSuppliesPaise += Math.max(0, split.sellerSubtotalPaise - returnsPaise);
      current.totalTcsPaise += tcsPaise;
      current.transactionCount += 1;
      if (intraState) {
        const cgst = Math.floor(tcsPaise / 2);
        current.cgstPaise += cgst;
        current.sgstPaise += tcsPaise - cgst;
      } else {
        current.igstPaise += tcsPaise;
      }
      sellerMap.set(split.sellerId, current);
    }
    const statements = [...sellerMap.values()].sort((left, right) =>
      left.sellerName.localeCompare(right.sellerName),
    );
    return {
      summary: statements.reduce(
        (total, statement) => ({
          sellerCount: total.sellerCount + 1,
          transactionCount: total.transactionCount + statement.transactionCount,
          grossSuppliesPaise: total.grossSuppliesPaise + statement.grossSuppliesPaise,
          returnsPaise: total.returnsPaise + statement.returnsPaise,
          netSuppliesPaise: total.netSuppliesPaise + statement.netSuppliesPaise,
          igstPaise: total.igstPaise + statement.igstPaise,
          cgstPaise: total.cgstPaise + statement.cgstPaise,
          sgstPaise: total.sgstPaise + statement.sgstPaise,
          totalTcsPaise: total.totalTcsPaise + statement.totalTcsPaise,
        }),
        {
          sellerCount: 0,
          transactionCount: 0,
          grossSuppliesPaise: 0,
          returnsPaise: 0,
          netSuppliesPaise: 0,
          igstPaise: 0,
          cgstPaise: 0,
          sgstPaise: 0,
          totalTcsPaise: 0,
        },
      ),
      statements,
    };
  }

  private async generatePlatformCommissionDocuments(
    sellerId: string,
    dateFrom: Date,
    dateTo: Date,
    actorUserId: string,
  ) {
    const config = await this.platformConfiguration();
    if (!config.configured) {
      return { generated: 0, skipped: 0, missingConfiguration: config.missingConfiguration };
    }
    const splits = await this.prisma.client.orderSellerSplit.findMany({
      where: {
        sellerId,
        order: {
          orderStatus: { not: OrderStatus.CANCELLED },
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      },
      include: {
        seller: {
          include: {
            profile: true,
            addresses: { orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
        order: { include: { items: { include: { product: true } } } },
      },
    });
    let generated = 0;
    let skipped = 0;
    for (const split of splits) {
      const idempotencyKey = `platform-commission:order-split:${split.id}`;
      if (
        await this.prisma.client.marketplaceTaxDocument.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        })
      ) {
        skipped += 1;
        continue;
      }
      const calculated =
        split.commissionPaise === 0 &&
        split.gstOnCommissionPaise === 0 &&
        split.platformFeePaise === 0
          ? await this.financeCalculator.calculateSplit(split)
          : null;
      const calculation = calculated ?? split;
      const taxableValuePaise =
        calculation.commissionPaise + calculation.platformFeePaise;
      const totalTaxPaise = calculation.gstOnCommissionPaise;
      if (taxableValuePaise <= 0 && totalTaxPaise <= 0) {
        skipped += 1;
        continue;
      }
      const sellerAddress = split.seller.addresses[0];
      const sellerStateCode = sellerAddress?.stateCode?.trim() || null;
      const supplyType =
        sellerStateCode && sellerStateCode === config.stateCode
          ? TaxSupplyType.INTRA_STATE
          : TaxSupplyType.INTER_STATE;
      const cgstPaise =
        supplyType === TaxSupplyType.INTRA_STATE ? Math.floor(totalTaxPaise / 2) : 0;
      const sgstPaise =
        supplyType === TaxSupplyType.INTRA_STATE ? totalTaxPaise - cgstPaise : 0;
      const igstPaise =
        supplyType === TaxSupplyType.INTER_STATE ? totalTaxPaise : 0;
      const issueDate = split.createdAt;
      const financialYear = this.financialYear(issueDate);
      const recipientGstin = this.validGstin(split.seller.profile?.gstNumber);
      const taxLinesSnapshot = this.platformTaxLinesSnapshot(
        calculated?.snapshot ?? split.financeSnapshot,
        config,
        supplyType,
        {
          taxableValuePaise,
          cgstPaise,
          sgstPaise,
          igstPaise,
          totalTaxPaise,
        },
      );

      await this.prisma.client.$transaction(async (tx) => {
        const documentNumber = await this.nextMarketplaceDocumentNumber(
          tx,
          financialYear,
          TaxDocumentType.TAX_INVOICE,
        );
        await tx.marketplaceTaxDocument.create({
          data: {
            documentNumber,
            idempotencyKey,
            financialYear,
            sourceType: "ORDER_SELLER_SPLIT",
            sourceId: split.id,
            sellerId,
            issueDate,
            supplierLegalName: config.legalName,
            supplierGstin: config.gstin,
            supplierAddressSnapshot: config.address,
            recipientLegalName:
              split.seller.profile?.businessLegalName?.trim() || split.seller.storeName,
            recipientGstin,
            recipientAddressSnapshot: this.jsonValue(sellerAddress ?? {}),
            placeOfSupplyStateCode: sellerStateCode,
            supplyType,
            gstrSupplySectionSnapshot: recipientGstin
              ? GstrSupplySection.B2B
              : GstrSupplySection.B2CS,
            taxLinesSnapshot,
            taxableValuePaise,
            cgstPaise,
            sgstPaise,
            igstPaise,
            totalTaxPaise,
            invoiceValuePaise: taxableValuePaise + totalTaxPaise,
            description: config.serviceDescription,
            issuedById: actorUserId,
          },
        });
      });
      generated += 1;
    }
    return { generated, skipped, missingConfiguration: [] };
  }

  async providerReadiness() {
    const settings = await readGstSettings(this.prisma.client);
    return {
      eInvoice: {
        enabled: settings.eInvoice.enabled,
        provider: settings.eInvoice.provider,
        credentialsConfigured: true,
        mode: "MANUAL" as const,
      },
      eWayBill: {
        enabled: settings.eWayBill.enabled,
        provider: settings.eWayBill.provider,
        thresholdPaise: settings.eWayBill.thresholdPaise,
        credentialsConfigured: true,
        mode: "MANUAL" as const,
      },
      platformInvoice: this.platformConfigurationFromSettings(settings),
    };
  }

  private async platformConfiguration() {
    return this.platformConfigurationFromSettings(
      await readGstSettings(this.prisma.client),
    );
  }

  private platformConfigurationFromSettings(settings: GstSettings) {
    const { platform } = settings;
    const gstin = this.validGstin(platform.gstin);
    const missingConfiguration = [
      ...(!platform.legalName ? ["Platform legal name"] : []),
      ...(!gstin ? ["Valid platform GSTIN"] : []),
      ...(!platform.stateCode ? ["Platform GST state code"] : []),
      ...(gstin &&
      platform.stateCode &&
      gstin.slice(0, 2) !== platform.stateCode
        ? ["Platform GST state code matching the GSTIN"]
        : []),
      ...(!platform.address.line1 ||
      !platform.address.city ||
      !platform.address.state ||
      !platform.address.postalCode
        ? ["Platform registered address"]
        : []),
      ...(!/^[0-9]{6}$/.test(platform.serviceSacCode)
        ? ["Valid platform service SAC code"]
        : []),
      ...(!platform.serviceDescription ? ["Platform service description"] : []),
    ];
    return {
      configured: isConfiguredPlatformGst(settings),
      missingConfiguration,
      legalName: platform.legalName,
      gstin: gstin ?? "",
      stateCode: platform.stateCode,
      address: platform.address as Prisma.InputJsonObject,
      serviceSacCode: platform.serviceSacCode,
      serviceDescription: platform.serviceDescription,
    };
  }

  private platformTaxLinesSnapshot(
    value: unknown,
    config: {
      serviceSacCode: string;
      serviceDescription: string;
    },
    supplyType: TaxSupplyType,
    totals: {
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalTaxPaise: number;
    },
  ): Prisma.InputJsonArray {
    const snapshot =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const lines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
    const grouped = new Map<
      number,
      {
        taxableValuePaise: number;
        cgstPaise: number;
        sgstPaise: number;
        igstPaise: number;
        totalTaxPaise: number;
      }
    >();

    for (const value of lines) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const line = value as Record<string, unknown>;
      const gstRateBps = Number(line.gstRateBps);
      const taxableValuePaise =
        Number(line.commissionPaise) + Number(line.platformFeePaise);
      const totalTaxPaise = Number(line.gstOnCommissionPaise);
      if (
        !Number.isFinite(gstRateBps) ||
        !Number.isFinite(taxableValuePaise) ||
        !Number.isFinite(totalTaxPaise) ||
        taxableValuePaise <= 0
      ) {
        continue;
      }
      const current = grouped.get(gstRateBps) ?? {
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
      };
      const cgstPaise =
        supplyType === TaxSupplyType.INTRA_STATE ? Math.floor(totalTaxPaise / 2) : 0;
      const sgstPaise =
        supplyType === TaxSupplyType.INTRA_STATE ? totalTaxPaise - cgstPaise : 0;
      current.taxableValuePaise += taxableValuePaise;
      current.cgstPaise += cgstPaise;
      current.sgstPaise += sgstPaise;
      current.igstPaise +=
        supplyType === TaxSupplyType.INTER_STATE ? totalTaxPaise : 0;
      current.totalTaxPaise += totalTaxPaise;
      grouped.set(gstRateBps, current);
    }

    if (grouped.size) {
      return [...grouped.entries()].map(([gstRateBps, line]) => ({
        description: config.serviceDescription,
        sacCode: config.serviceSacCode,
        gstRatePercent: gstRateBps / 100,
        ...line,
        source: "FINANCE_SNAPSHOT",
      }));
    }

    return [
      {
        description: config.serviceDescription,
        sacCode: config.serviceSacCode,
        gstRatePercent:
          totals.taxableValuePaise > 0
            ? Math.round(
                (totals.totalTaxPaise / totals.taxableValuePaise) * 10_000,
              ) / 100
            : 0,
        ...totals,
        source: "DERIVED_TOTAL",
        warning:
          "Historical platform invoice tax lines were derived from stored document totals.",
      },
    ];
  }

  private documentSummary(documents: SignedDocument[]): DocumentSummary {
    return documents.reduce(
      (total, document) => ({
        documentCount: total.documentCount + 1,
        invoiceCount:
          total.invoiceCount +
          (document.documentType === TaxDocumentType.TAX_INVOICE ||
          document.documentType === TaxDocumentType.BILL_OF_SUPPLY ||
          document.documentType === TaxDocumentType.COMMERCIAL_INVOICE
            ? 1
            : 0),
        creditNoteCount:
          total.creditNoteCount +
          (document.documentType === TaxDocumentType.CREDIT_NOTE ? 1 : 0),
        debitNoteCount:
          total.debitNoteCount +
          (document.documentType === TaxDocumentType.DEBIT_NOTE ? 1 : 0),
        taxableValuePaise: total.taxableValuePaise + document.taxableValuePaise,
        cgstPaise: total.cgstPaise + document.cgstPaise,
        sgstPaise: total.sgstPaise + document.sgstPaise,
        igstPaise: total.igstPaise + document.igstPaise,
        cessPaise: total.cessPaise + document.cessPaise,
        totalTaxPaise: total.totalTaxPaise + document.totalTaxPaise,
        invoiceValuePaise: total.invoiceValuePaise + document.invoiceValuePaise,
      }),
      {
        documentCount: 0,
        invoiceCount: 0,
        creditNoteCount: 0,
        debitNoteCount: 0,
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        cessPaise: 0,
        totalTaxPaise: 0,
        invoiceValuePaise: 0,
      },
    );
  }

  private hsnSummary(documents: SignedDocument[]) {
    return this.groupLines(documents, (line) =>
      line.hsnSacCode ? `${line.hsnSacCode}:${line.gstRatePercent}:${line.uqc}` : null,
    )
      .map((item) => ({
        hsnSacCode: item.line.hsnSacCode!,
        description: item.line.description,
        uqc: item.line.uqc,
        gstRatePercent: item.line.gstRatePercent,
        ...item.totals,
      }))
      .sort(
        (left, right) =>
          left.hsnSacCode.localeCompare(right.hsnSacCode) ||
          left.gstRatePercent - right.gstRatePercent,
      );
  }

  private rateLiability(documents: SignedDocument[]) {
    return this.groupLines(documents, (line) => String(line.gstRatePercent))
      .map((item) => ({
        gstRatePercent: item.line.gstRatePercent,
        ...item.totals,
      }))
      .sort((left, right) => left.gstRatePercent - right.gstRatePercent);
  }

  private stateLiability(documents: SignedDocument[]) {
    const groups = new Map<string, ReturnType<GstComplianceService["emptyTotals"]>>();
    for (const document of documents) {
      const key = document.placeOfSupplyStateCode || "UNSPECIFIED";
      this.addTotals(groups, key, document);
    }
    return [...groups].map(([placeOfSupplyStateCode, totals]) => ({
      placeOfSupplyStateCode,
      ...totals,
    }));
  }

  private gstinSummary(documents: SignedDocument[]) {
    const groups = new Map<
      string,
      ReturnType<GstComplianceService["emptyTotals"]> & {
        buyerLegalName: string;
        documentCount: number;
      }
    >();
    for (const document of documents.filter((item) => item.buyerGstin)) {
      const key = document.buyerGstin!;
      const current = groups.get(key) ?? {
        buyerLegalName: document.buyerLegalName,
        documentCount: 0,
        ...this.emptyTotals(),
      };
      current.documentCount += 1;
      this.incrementTotals(current, document);
      groups.set(key, current);
    }
    return [...groups].map(([buyerGstin, totals]) => ({ buyerGstin, ...totals }));
  }

  private sectionSummary(documents: SignedDocument[]) {
    const groups = new Map<
      string,
      ReturnType<GstComplianceService["emptyTotals"]> & { documentCount: number }
    >();
    for (const document of documents) {
      const key = document.gstrSupplySection ?? "UNCLASSIFIED";
      const current = groups.get(key) ?? { documentCount: 0, ...this.emptyTotals() };
      current.documentCount += 1;
      this.incrementTotals(current, document);
      groups.set(key, current);
    }
    return [...groups].map(([section, totals]) => ({ section, ...totals }));
  }

  private gstr1Sections(documents: SignedDocument[]) {
    const result = Object.fromEntries(
      Object.values(GstrSupplySection).map((section) => [section, [] as SignedDocument[]]),
    ) as Record<GstrSupplySection, SignedDocument[]>;
    for (const document of documents) {
      if (document.gstrSupplySection) {
        result[document.gstrSupplySection].push(document);
      }
    }
    return result;
  }

  private gstr3bSummary(documents: SignedDocument[]) {
    const rows = {
      outwardTaxable: this.emptyTotals(),
      zeroRated: this.emptyTotals(),
      nilExempt: this.emptyTotals(),
      inwardReverseCharge: this.emptyTotals(),
      nonGst: this.emptyTotals(),
    };
    const interstateUnregistered = new Map<
      string,
      { taxableValuePaise: number; igstPaise: number }
    >();
    for (const document of documents) {
      if (
        document.gstrSupplySection === GstrSupplySection.EXPORT ||
        document.gstrSupplySection === GstrSupplySection.SEZ
      ) {
        this.incrementTotals(rows.zeroRated, document);
      } else if (document.gstrSupplySection === GstrSupplySection.NIL_EXEMPT_NON_GST) {
        this.incrementTotals(rows.nilExempt, document);
      } else if (
        document.sellerTaxRegistrationStatus ===
        SellerTaxRegistrationStatus.GST_REGISTERED
      ) {
        this.incrementTotals(rows.outwardTaxable, document);
      }
      if (
        document.sellerTaxRegistrationStatus ===
          SellerTaxRegistrationStatus.GST_REGISTERED &&
        !document.buyerGstin &&
        document.supplyType === TaxSupplyType.INTER_STATE &&
        document.placeOfSupplyStateCode
      ) {
        const current = interstateUnregistered.get(document.placeOfSupplyStateCode) ?? {
          taxableValuePaise: 0,
          igstPaise: 0,
        };
        current.taxableValuePaise += document.taxableValuePaise;
        current.igstPaise += document.igstPaise;
        interstateUnregistered.set(document.placeOfSupplyStateCode, current);
      }
    }
    return {
      table3_1: rows,
      table3_2: {
        unregistered: [...interstateUnregistered].map(([placeOfSupplyStateCode, totals]) => ({
          placeOfSupplyStateCode,
          ...totals,
        })),
        composition: [],
        uin: [],
      },
      sourceNote:
        "Outward-liability summary derived from immutable issued documents. Inward tax credit is outside this marketplace sales ledger.",
    };
  }

  private documentSeries(documents: SignedDocument[]) {
    const groups = new Map<
      string,
      {
        documentType: TaxDocumentType;
        financialYear: string;
        prefix: string;
        numbers: number[];
        documentCount: number;
      }
    >();
    for (const document of documents) {
      if (!document.documentNumber) continue;
      const match = /^(.*?)(\d+)$/.exec(document.documentNumber);
      const prefix = match?.[1] ?? document.documentNumber;
      const number = match ? Number(match[2]) : 0;
      const key = `${document.documentType}:${document.financialYear}:${prefix}`;
      const current = groups.get(key) ?? {
        documentType: document.documentType,
        financialYear: document.financialYear,
        prefix,
        numbers: [],
        documentCount: 0,
      };
      current.documentCount += 1;
      if (number) current.numbers.push(number);
      groups.set(key, current);
    }
    return [...groups.values()].map((group) => ({
      documentType: group.documentType,
      financialYear: group.financialYear,
      prefix: group.prefix,
      fromNumber: group.numbers.length ? Math.min(...group.numbers) : null,
      toNumber: group.numbers.length ? Math.max(...group.numbers) : null,
      issuedCount: group.documentCount,
      cancelledCount: 0,
      netIssuedCount: group.documentCount,
    }));
  }

  private reconcile(
    documents: SignedDocument[],
    draftCount: number,
    summary: ReturnType<GstComplianceService["documentSummary"]>,
  ) {
    const issues: Array<{
      severity: "INFO" | "WARNING" | "ERROR";
      code: string;
      documentId?: string;
      documentNumber?: string | null;
      message: string;
    }> = [];
    const seenNumbers = new Set<string>();
    for (const document of documents) {
      if (!document.documentNumber) {
        issues.push(this.issue("ERROR", "MISSING_DOCUMENT_NUMBER", document, "Issued document has no number."));
      } else if (seenNumbers.has(`${document.sellerId}:${document.documentNumber}`)) {
        issues.push(this.issue("ERROR", "DUPLICATE_DOCUMENT_NUMBER", document, "Duplicate seller document number."));
      } else {
        seenNumbers.add(`${document.sellerId}:${document.documentNumber}`);
      }
      if (document.sellerGstin && !this.validGstin(document.sellerGstin)) {
        issues.push(this.issue("ERROR", "INVALID_SUPPLIER_GSTIN", document, "Supplier GSTIN is invalid."));
      }
      if (
        document.sellerTaxRegistrationStatus ===
          SellerTaxRegistrationStatus.NOT_REGISTERED &&
        document.sellerGstin
      ) {
        issues.push(
          this.issue(
            "ERROR",
            "UNREGISTERED_SELLER_HAS_GSTIN",
            document,
            "A not-registered seller document contains a GSTIN.",
          ),
        );
      }
      if (
        document.sellerTaxRegistrationStatus !==
          SellerTaxRegistrationStatus.NOT_REGISTERED &&
        !document.sellerGstin
      ) {
        issues.push(
          this.issue(
            "ERROR",
            "REGISTERED_SELLER_MISSING_GSTIN",
            document,
            "The selected seller registration status requires a GSTIN.",
          ),
        );
      }
      if (
        document.sellerTaxRegistrationStatus !==
          SellerTaxRegistrationStatus.GST_REGISTERED &&
        document.gstrSupplySection
      ) {
        issues.push(
          this.issue(
            "ERROR",
            "NON_REGULAR_SELLER_IN_GSTR",
            document,
            "Non-regular seller documents must not be included in regular GSTR sections.",
          ),
        );
      }
      if (document.buyerGstin && !this.validGstin(document.buyerGstin)) {
        issues.push(this.issue("ERROR", "INVALID_BUYER_GSTIN", document, "Buyer GSTIN is invalid."));
      }
      if (
        (document.documentType === TaxDocumentType.CREDIT_NOTE ||
          document.documentType === TaxDocumentType.DEBIT_NOTE) &&
        !document.originalDocumentNumber
      ) {
        issues.push(this.issue("ERROR", "MISSING_ORIGINAL_DOCUMENT", document, "Adjustment note is not linked to an original invoice."));
      }
      if (
        document.lines.some(
          (line) =>
            line.taxClassification === ProductTaxClassification.TAXABLE &&
            line.taxableValuePaise !== 0 &&
            line.gstRatePercent > 0 &&
            !line.hsnSacCode,
        )
      ) {
        issues.push(this.issue("WARNING", "MISSING_HSN", document, "A taxable line has no HSN/SAC code."));
      }
      if (
        document.lines.some(
          (line) =>
            line.taxClassification !== ProductTaxClassification.TAXABLE &&
            line.totalTaxPaise !== 0,
        )
      ) {
        issues.push(
          this.issue(
            "ERROR",
            "NON_TAXABLE_LINE_HAS_GST",
            document,
            "Nil-rated, exempt, and non-GST lines must have zero GST.",
          ),
        );
      }
      const lineTotals = document.lines.reduce(
        (total, line) => ({
          taxableValuePaise: total.taxableValuePaise + line.taxableValuePaise,
          cgstPaise: total.cgstPaise + line.cgstPaise,
          sgstPaise: total.sgstPaise + line.sgstPaise,
          igstPaise: total.igstPaise + line.igstPaise,
          cessPaise: total.cessPaise + line.cessPaise,
          totalTaxPaise: total.totalTaxPaise + line.totalTaxPaise,
          invoiceValuePaise: total.invoiceValuePaise + line.lineValuePaise,
        }),
        this.emptyTotals(),
      );
      for (const field of Object.keys(lineTotals) as Array<keyof typeof lineTotals>) {
        if (lineTotals[field] !== document[field]) {
          issues.push(
            this.issue(
              "ERROR",
              "LINE_DOCUMENT_TOTAL_MISMATCH",
              document,
              `Document ${field} does not match its line total.`,
            ),
          );
          break;
        }
      }
      const expectedSection = this.expectedSection(document);
      if (expectedSection !== document.gstrSupplySection) {
        issues.push(
          this.issue(
            "WARNING",
            "GSTR_SECTION_MISMATCH",
            document,
            `Expected ${expectedSection}, found ${document.gstrSupplySection ?? "unclassified"}.`,
          ),
        );
      }
    }
    if (draftCount > 0) {
      issues.push({
        severity: "WARNING",
        code: "DRAFT_DOCUMENTS_PENDING",
        message: `${draftCount} draft tax document(s) are pending issuance in the selected range.`,
      });
    }
    const errorCount = issues.filter((issue) => issue.severity === "ERROR").length;
    const warningCount = issues.filter((issue) => issue.severity === "WARNING").length;
    const lineSummary = this.documentSummary(
      documents.map((document) => ({
        ...document,
        ...document.lines.reduce(
          (total, line) => ({
            taxableValuePaise: total.taxableValuePaise + line.taxableValuePaise,
            cgstPaise: total.cgstPaise + line.cgstPaise,
            sgstPaise: total.sgstPaise + line.sgstPaise,
            igstPaise: total.igstPaise + line.igstPaise,
            cessPaise: total.cessPaise + line.cessPaise,
            totalTaxPaise: total.totalTaxPaise + line.totalTaxPaise,
            invoiceValuePaise: total.invoiceValuePaise + line.lineValuePaise,
          }),
          this.emptyTotals(),
        ),
      })),
    );
    return {
      issueCount: issues.length,
      errorCount,
      warningCount,
      readyToLock: errorCount === 0,
      books: lineSummary,
      filing: summary,
      difference: {
        taxableValuePaise: summary.taxableValuePaise - lineSummary.taxableValuePaise,
        totalTaxPaise: summary.totalTaxPaise - lineSummary.totalTaxPaise,
        invoiceValuePaise: summary.invoiceValuePaise - lineSummary.invoiceValuePaise,
      },
      issues,
    };
  }

  private marketplaceDocumentSummary(
    documents: Array<{
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalTaxPaise: number;
      invoiceValuePaise: number;
    }>,
  ) {
    return documents.reduce<{
      documentCount: number;
      taxableValuePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      totalTaxPaise: number;
      invoiceValuePaise: number;
    }>(
      (total, document) => ({
        documentCount: total.documentCount + 1,
        taxableValuePaise: total.taxableValuePaise + document.taxableValuePaise,
        cgstPaise: total.cgstPaise + document.cgstPaise,
        sgstPaise: total.sgstPaise + document.sgstPaise,
        igstPaise: total.igstPaise + document.igstPaise,
        totalTaxPaise: total.totalTaxPaise + document.totalTaxPaise,
        invoiceValuePaise: total.invoiceValuePaise + document.invoiceValuePaise,
      }),
      {
        documentCount: 0,
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalTaxPaise: 0,
        invoiceValuePaise: 0,
      },
    );
  }

  private defaultCompliance(
    document: {
      documentType: TaxDocumentType;
      sellerGstin: string | null;
      buyerGstin: string | null;
      invoiceValuePaise: number;
    },
    readiness: Awaited<ReturnType<GstComplianceService["providerReadiness"]>>,
  ) {
    const eInvoiceRequired =
      readiness.eInvoice.enabled &&
      document.documentType === TaxDocumentType.TAX_INVOICE &&
      Boolean(document.sellerGstin && document.buyerGstin);
    const eWayBillRequired =
      readiness.eWayBill.enabled &&
      document.invoiceValuePaise >= readiness.eWayBill.thresholdPaise;
    return {
      eInvoiceStatus: eInvoiceRequired
        ? GstComplianceStatus.READY
        : GstComplianceStatus.NOT_REQUIRED,
      irn: null,
      acknowledgementNumber: null,
      acknowledgementDate: null,
      signedQrCode: null,
      eInvoiceProvider: readiness.eInvoice.provider,
      eInvoiceError: null,
      eWayBillStatus: eWayBillRequired
        ? GstComplianceStatus.READY
        : GstComplianceStatus.NOT_REQUIRED,
      eWayBillNumber: null,
      eWayBillGeneratedAt: null,
      eWayBillValidUntil: null,
      eWayBillProvider: readiness.eWayBill.provider,
      eWayBillError: null,
      lastSyncedAt: null,
    };
  }

  private toSignedDocument(
    document: TaxDocumentWithReportRelations,
    readiness: Awaited<ReturnType<GstComplianceService["providerReadiness"]>>,
  ): SignedDocument {
    const sign = document.documentType === TaxDocumentType.CREDIT_NOTE ? -1 : 1;
    return {
      id: document.id,
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      issueDate: document.issueDate,
      financialYear: document.financialYear,
      orderNumber:
        document.order?.orderNumber ??
        document.b2bOrder?.orderNumber ??
        document.serviceBooking?.bookingNumber ??
        null,
      sellerId: document.sellerId,
      sellerName: document.seller.storeName,
      sellerTaxRegistrationStatus: document.sellerTaxRegistrationStatus,
      sellerGstin: document.sellerGstin,
      buyerLegalName: document.buyerLegalName,
      buyerGstin: document.buyerGstin,
      buyerAddress: this.addressSnapshot(document.buyerAddressSnapshot),
      placeOfSupplyStateCode: document.placeOfSupplyStateCode,
      supplyType: document.supplyType,
      gstrSupplySection: document.gstrSupplySection,
      originalDocumentNumber: document.originalDocument?.documentNumber ?? null,
      reason: document.reason,
      reverseCharge: document.reverseCharge,
      currency: document.currency,
      taxableValuePaise: sign * document.taxableValuePaise,
      cgstPaise: sign * document.cgstPaise,
      sgstPaise: sign * document.sgstPaise,
      igstPaise: sign * document.igstPaise,
      cessPaise: sign * document.cessPaise,
      totalTaxPaise: sign * document.totalTaxPaise,
      invoiceValuePaise: sign * document.invoiceValuePaise,
      compliance: document.compliance
        ? {
            eInvoiceStatus: document.compliance.eInvoiceStatus,
            irn: document.compliance.irn,
            acknowledgementNumber: document.compliance.acknowledgementNumber,
            acknowledgementDate: document.compliance.acknowledgementDate,
            signedQrCode: document.compliance.signedQrCode,
            eInvoiceProvider: document.compliance.eInvoiceProvider,
            eInvoiceError: document.compliance.eInvoiceError,
            eWayBillStatus: document.compliance.eWayBillStatus,
            eWayBillNumber: document.compliance.eWayBillNumber,
            eWayBillGeneratedAt: document.compliance.eWayBillGeneratedAt,
            eWayBillValidUntil: document.compliance.eWayBillValidUntil,
            eWayBillProvider: document.compliance.eWayBillProvider,
            eWayBillError: document.compliance.eWayBillError,
            lastSyncedAt: document.compliance.lastSyncedAt,
          }
        : this.defaultCompliance(document, readiness),
      lines: document.lines.map((line) => ({
        id: line.id,
        lineType: line.lineType,
        description: line.description,
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
      })),
    };
  }

  private groupLines(
    documents: SignedDocument[],
    keyForLine: (line: SignedDocument["lines"][number]) => string | null,
  ) {
    const groups = new Map<
      string,
      {
        line: SignedDocument["lines"][number];
        totals: ReturnType<GstComplianceService["emptyLineTotals"]>;
      }
    >();
    for (const document of documents) {
      for (const line of document.lines) {
        const key = keyForLine(line);
        if (!key) continue;
        const current = groups.get(key) ?? { line, totals: this.emptyLineTotals() };
        current.totals.quantity += line.quantity;
        current.totals.taxableValuePaise += line.taxableValuePaise;
        current.totals.cgstPaise += line.cgstPaise;
        current.totals.sgstPaise += line.sgstPaise;
        current.totals.igstPaise += line.igstPaise;
        current.totals.cessPaise += line.cessPaise;
        current.totals.totalTaxPaise += line.totalTaxPaise;
        groups.set(key, current);
      }
    }
    return [...groups.values()];
  }

  private addTotals(
    groups: Map<string, ReturnType<GstComplianceService["emptyTotals"]>>,
    key: string,
    document: SignedDocument,
  ) {
    const current = groups.get(key) ?? this.emptyTotals();
    this.incrementTotals(current, document);
    groups.set(key, current);
  }

  private incrementTotals(
    target: ReturnType<GstComplianceService["emptyTotals"]>,
    source: Pick<
      SignedDocument,
      | "taxableValuePaise"
      | "cgstPaise"
      | "sgstPaise"
      | "igstPaise"
      | "cessPaise"
      | "totalTaxPaise"
      | "invoiceValuePaise"
    >,
  ) {
    target.taxableValuePaise += source.taxableValuePaise;
    target.cgstPaise += source.cgstPaise;
    target.sgstPaise += source.sgstPaise;
    target.igstPaise += source.igstPaise;
    target.cessPaise += source.cessPaise;
    target.totalTaxPaise += source.totalTaxPaise;
    target.invoiceValuePaise += source.invoiceValuePaise;
  }

  private emptyTotals(): MoneyTotals {
    return {
      taxableValuePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      cessPaise: 0,
      totalTaxPaise: 0,
      invoiceValuePaise: 0,
    };
  }

  private emptyLineTotals(): MoneyTotals & { quantity: number } {
    return { quantity: 0, ...this.emptyTotals() };
  }

  private expectedSection(document: SignedDocument) {
    if (
      document.documentType === TaxDocumentType.CREDIT_NOTE ||
      document.documentType === TaxDocumentType.DEBIT_NOTE
    ) {
      if (
        document.gstrSupplySection ===
        GstrSupplySection.NIL_EXEMPT_NON_GST
      ) {
        return GstrSupplySection.NIL_EXEMPT_NON_GST;
      }
      return document.sellerTaxRegistrationStatus ===
        SellerTaxRegistrationStatus.GST_REGISTERED
        ? document.buyerGstin
          ? GstrSupplySection.CDNR
          : GstrSupplySection.CDNUR
        : null;
    }
    if (
      document.sellerTaxRegistrationStatus !==
      SellerTaxRegistrationStatus.GST_REGISTERED
    ) {
      return null;
    }
    if (
      document.lines.length > 0 &&
      document.lines.every(
        (line) => line.taxClassification !== ProductTaxClassification.TAXABLE,
      )
    ) {
      return GstrSupplySection.NIL_EXEMPT_NON_GST;
    }
    if (document.buyerGstin) return GstrSupplySection.B2B;
    if (document.supplyType === TaxSupplyType.OUTSIDE_INDIA) return GstrSupplySection.EXPORT;
    if (
      document.supplyType === TaxSupplyType.INTER_STATE &&
      document.invoiceValuePaise >
        this.positiveIntegerEnv("GST_B2CL_THRESHOLD_PAISE", 10_000_000)
    ) {
      return GstrSupplySection.B2CL;
    }
    return GstrSupplySection.B2CS;
  }

  private async ensureRegularGstSeller(sellerId: string) {
    const profile = await this.prisma.client.sellerProfile.findUnique({
      where: { sellerId },
      select: { taxRegistrationStatus: true },
    });
    if (
      profile?.taxRegistrationStatus !==
      SellerTaxRegistrationStatus.GST_REGISTERED
    ) {
      throw new ForbiddenException(
        "Only regular GST-registered sellers can lock or file a GST return period.",
      );
    }
  }

  private issue(
    severity: "INFO" | "WARNING" | "ERROR",
    code: string,
    document: SignedDocument,
    message: string,
  ) {
    return {
      severity,
      code,
      documentId: document.id,
      documentNumber: document.documentNumber,
      message,
    };
  }

  private itemsByRate(document: SignedDocument) {
    const rateGroups = new Map<
      number,
      {
        taxableValuePaise: number;
        cgstPaise: number;
        sgstPaise: number;
        igstPaise: number;
        cessPaise: number;
      }
    >();
    for (const line of document.lines) {
      const current = rateGroups.get(line.gstRatePercent) ?? {
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        cessPaise: 0,
      };
      current.taxableValuePaise += Math.abs(line.taxableValuePaise);
      current.cgstPaise += Math.abs(line.cgstPaise);
      current.sgstPaise += Math.abs(line.sgstPaise);
      current.igstPaise += Math.abs(line.igstPaise);
      current.cessPaise += Math.abs(line.cessPaise);
      rateGroups.set(line.gstRatePercent, current);
    }
    return [...rateGroups].map(([rate, totals], index) => ({
      num: index + 1,
      itm_det: {
        rt: rate,
        txval: this.rupees(totals.taxableValuePaise),
        camt: this.rupees(totals.cgstPaise),
        samt: this.rupees(totals.sgstPaise),
        iamt: this.rupees(totals.igstPaise),
        csamt: this.rupees(totals.cessPaise),
      },
    }));
  }

  private rateStateRows(documents: SignedDocument[]) {
    const groups = new Map<string, { rate: number; pos: string; taxable: number; cess: number }>();
    for (const document of documents) {
      for (const line of document.lines) {
        const pos = document.placeOfSupplyStateCode ?? "";
        const key = `${line.gstRatePercent}:${pos}`;
        const current = groups.get(key) ?? {
          rate: line.gstRatePercent,
          pos,
          taxable: 0,
          cess: 0,
        };
        current.taxable += line.taxableValuePaise;
        current.cess += line.cessPaise;
        groups.set(key, current);
      }
    }
    return [...groups.values()].map((group) => ({
      sply_ty: "INTER",
      rt: group.rate,
      typ: "OE",
      pos: group.pos,
      txval: this.rupees(group.taxable),
      csamt: this.rupees(group.cess),
    }));
  }

  private groupNotesByReceiver(
    documents: SignedDocument[],
    mapper: (document: SignedDocument) => Record<string, unknown>,
  ) {
    const groups = new Map<string, SignedDocument[]>();
    for (const document of documents) {
      const ctin = document.buyerGstin ?? "";
      groups.set(ctin, [...(groups.get(ctin) ?? []), document]);
    }
    return [...groups].map(([ctin, notes]) => ({ ctin, nt: notes.map(mapper) }));
  }

  private async nextSellerDocumentNumber(
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
    return `DN/${financialYear}/${String(sequence.nextNumber - 1).padStart(6, "0")}`;
  }

  private async nextMarketplaceDocumentNumber(
    tx: Prisma.TransactionClient,
    financialYear: string,
    documentType: TaxDocumentType,
  ) {
    const sequence = await tx.marketplaceTaxDocumentSequence.upsert({
      where: { financialYear_documentType: { financialYear, documentType } },
      create: { financialYear, documentType, nextNumber: 2 },
      update: { nextNumber: { increment: 1 } },
    });
    return `MKT-TI/${financialYear}/${String(sequence.nextNumber - 1).padStart(6, "0")}`;
  }

  private calculateInclusiveTax(
    considerationPaise: number,
    gstRatePercent: number,
    supplyType: TaxSupplyType,
  ) {
    const rateBps = Math.max(0, Math.round(gstRatePercent * 100));
    const taxableValuePaise =
      rateBps > 0
        ? Math.round((considerationPaise * 10_000) / (10_000 + rateBps))
        : considerationPaise;
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

  private dateRange(query: ReportQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.dateFrom && !query.dateTo) return undefined;
    return {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  private periodDates(returnPeriod: string) {
    const month = Number(returnPeriod.slice(0, 2));
    const year = Number(returnPeriod.slice(2));
    const dateFrom = new Date(Date.UTC(year, month - 1, 1));
    const dateTo = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { dateFrom, dateTo, financialYear: this.financialYear(dateFrom) };
  }

  private financialYear(date: Date) {
    const startYear =
      date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
    return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  }

  private returnPeriod(date: Date) {
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}${date.getUTCFullYear()}`;
  }

  private gstDate(value?: Date | string | null) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return `${String(date.getUTCDate()).padStart(2, "0")}-${String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0")}-${date.getUTCFullYear()}`;
  }

  private validGstin(value?: string | null) {
    const normalized = value?.trim().toUpperCase() || null;
    return normalized &&
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized)
      ? normalized
      : null;
  }

  private requiredJsonObject(value: Prisma.JsonValue) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("Tax document address snapshot is invalid.");
    }
    return value as Prisma.InputJsonObject;
  }

  private jsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private rupees(paise: number) {
    return Number((paise / 100).toFixed(2));
  }

  private positiveIntegerEnv(key: string, fallback: number) {
    const value = Number(process.env[key]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private addressSnapshot(value: unknown): SignedDocument["buyerAddress"] {
    const address =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const text = (...keys: string[]) => {
      for (const key of keys) {
        const item = address[key];
        if (typeof item === "string" && item.trim()) {
          return item.trim();
        }
      }
      return "";
    };

    return {
      line1: text("line1", "addressLine1"),
      line2: text("line2", "addressLine2"),
      area: text("area", "localArea"),
      city: text("city"),
      state: text("state"),
      stateCode: text("stateCode", "state_code"),
      postalCode: text("postalCode", "pincode", "postal_code"),
      country: text("country"),
      countryCode: text("countryCode", "country_code"),
    };
  }

  private async audit(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    newValue: Prisma.InputJsonValue,
  ) {
    await this.prisma.client.auditLog.create({
      data: { actorUserId, action, entityType, entityId, newValue },
    });
  }
}
