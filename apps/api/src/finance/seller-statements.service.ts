import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SellerLedgerEntryType, SellerPayoutStatus, SellerStatementStatus } from "@indihub/database";
import {
  cursorPageFromTimestampItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
  timestampCursorOrderBy,
  timestampCursorWhere,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { renderProfessionalPdf } from "../documents/professional-pdf";
import { FinanceListQueryDto, GenerateStatementDto } from "./dto/finance.dto";

type StatementExport = Prisma.SellerStatementGetPayload<{
  include: {
    seller: { include: { profile: true } };
    payout: {
      include: {
        orderSplits: { include: { order: true } };
        b2bOrders: true;
        serviceSettlements: { include: { booking: true } };
        serviceReceivableOffsets: { include: { booking: true } };
        ledgerEntries: {
          include: {
            sellerCashReceivable: {
              include: {
                order: { select: { orderNumber: true } };
                orderShipment: { select: { shipmentNumber: true; deliveryMode: true } };
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class SellerStatementsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listStatements(query: FinanceListQueryDto, sellerIdFromAuth?: string) {
    const search = query.search?.trim();
    const where: Prisma.SellerStatementWhereInput = {
      ...(sellerIdFromAuth ? { sellerId: sellerIdFromAuth } : {}),
      ...(search
        ? {
            OR: [
              { statementNumber: { contains: search, mode: "insensitive" } },
              { seller: { storeName: { contains: search, mode: "insensitive" } } },
              { payout: { payoutNumber: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query, {
        defaultLimit: 20,
        maxLimit: 100
      });
      const cursorWhere = timestampCursorWhere("generatedAt", cursor) as
        | Prisma.SellerStatementWhereInput
        | undefined;
      const [items, summary] = await Promise.all([
        this.prisma.client.sellerStatement.findMany({
          where: cursorWhere ? { AND: [where, cursorWhere] } : where,
          include: this.statementListInclude(),
          orderBy: timestampCursorOrderBy("generatedAt"),
          take: take + 1
        }),
        this.statementSummary(where)
      ]);
      const pageResult = cursorPageFromTimestampItems(items, take, "generatedAt");

      return { ...pageResult, limit: take, summary };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const [items, summary] = await Promise.all([
      this.prisma.client.sellerStatement.findMany({
        where,
        include: this.statementListInclude(),
        orderBy: timestampCursorOrderBy("generatedAt"),
        skip,
        take
      }),
      this.statementSummary(where)
    ]);

    return { items, total: summary.statementCount, page, limit: take, summary };
  }

  private statementListInclude() {
    return {
      seller: { select: { id: true, storeName: true, slug: true } },
      payout: { select: { id: true, payoutNumber: true, status: true } }
    } satisfies Prisma.SellerStatementInclude;
  }

  private async statementSummary(where: Prisma.SellerStatementWhereInput) {
    const [statementCount, totals] = await Promise.all([
      this.prisma.client.sellerStatement.count({ where }),
      this.prisma.client.sellerStatement.groupBy({
        by: ["currency"],
        where,
        _sum: { netPayablePaise: true },
        orderBy: { currency: "asc" }
      })
    ]);

    return {
      statementCount,
      totalsByCurrency: totals.map((total) => ({
        currency: total.currency,
        netPayablePaise: total._sum.netPayablePaise ?? 0
      }))
    };
  }

  async generateStatement(dto: GenerateStatementDto, actor: RequestUser) {
    const payout = await this.prisma.client.sellerPayout.findUnique({
      where: { id: dto.payoutId },
      include: { seller: true }
    });

    if (!payout) {
      throw new NotFoundException("Seller payout not found.");
    }

    if (payout.status !== SellerPayoutStatus.APPROVED && payout.status !== SellerPayoutStatus.PAID) {
      throw new BadRequestException("Statements can be generated only after payout approval.");
    }

    const existing = await this.prisma.client.sellerStatement.findFirst({
      where: {
        payoutId: dto.payoutId,
        status: SellerStatementStatus.GENERATED
      },
      include: {
        seller: true,
        payout: true
      }
    });

    if (existing) {
      return existing;
    }

    const statement = await this.prisma.client.sellerStatement.create({
      data: {
        statementNumber: this.makeStatementNumber(),
        sellerId: payout.sellerId,
        payoutId: payout.id,
        periodFrom: payout.periodFrom,
        periodTo: payout.periodTo,
        grossSalesPaise: payout.grossSalesPaise,
        commissionPaise: payout.commissionPaise,
        gstOnCommissionPaise: payout.gstOnCommissionPaise,
        tdsPaise: payout.tdsPaise,
        tcsPaise: payout.tcsPaise,
        platformFeePaise: payout.platformFeePaise,
        refundAdjustmentPaise: payout.refundAdjustmentPaise,
        adjustmentPaise: payout.adjustmentPaise,
        netPayablePaise: payout.netPayablePaise,
        currency: payout.currency,
        generatedById: actor.id
      },
      include: {
        seller: true,
        payout: true
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "finance.statement.generated",
        entityType: "seller_statement",
        entityId: statement.id,
        newValue: {
          statementNumber: statement.statementNumber,
          payoutId: payout.id,
          sellerId: payout.sellerId
        }
      }
    });

    return statement;
  }

  async exportStatement(statementId: string, format: "csv" | "pdf", sellerIdFromAuth?: string) {
    const statement = await this.prisma.client.sellerStatement.findFirst({
      where: {
        id: statementId,
        ...(sellerIdFromAuth ? { sellerId: sellerIdFromAuth } : {})
      },
      include: {
        seller: { include: { profile: true } },
        payout: {
          include: {
            orderSplits: {
              include: {
                order: true
              },
              orderBy: { createdAt: "asc" }
            },
            b2bOrders: {
              orderBy: { createdAt: "asc" }
            },
            serviceSettlements: {
              include: {
                booking: true
              },
              orderBy: { createdAt: "asc" }
            },
            serviceReceivableOffsets: {
              include: {
                booking: true
              },
              orderBy: { createdAt: "asc" }
            },
            ledgerEntries: {
              where: { entryType: SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET },
              include: {
                sellerCashReceivable: {
                  include: {
                    order: { select: { orderNumber: true } },
                    orderShipment: { select: { shipmentNumber: true, deliveryMode: true } }
                  }
                }
              },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!statement) {
      throw new NotFoundException("Seller statement not found.");
    }

    if (!statement.payout) {
      throw new BadRequestException("Statement is not linked to a payout.");
    }

    const fileBase = `${statement.statementNumber}-${statement.seller.storeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

    if (format === "csv") {
      const csv = this.statementCsv(statement);
      return {
        fileName: `${fileBase}.csv`,
        contentType: "text/csv",
        base64: Buffer.from(csv, "utf8").toString("base64")
      };
    }

    const pdf = await this.statementPdf(statement);
    return {
      fileName: `${fileBase}.pdf`,
      contentType: "application/pdf",
      base64: pdf.toString("base64")
    };
  }

  private statementCsv(statement: StatementExport) {
    const rows = [
      ["Statement", statement.statementNumber],
      ["Seller", statement.seller.storeName],
      ["Period", `${statement.periodFrom.toISOString()} to ${statement.periodTo.toISOString()}`],
      ["Payout", statement.payout?.payoutNumber ?? ""],
      [],
      ["Metric", "Amount paise"],
      ["Gross sales", statement.grossSalesPaise],
      ["Commission", statement.commissionPaise],
      ["GST on commission", statement.gstOnCommissionPaise],
      ["TDS", statement.tdsPaise],
      ["TCS", statement.tcsPaise],
      ["Seller settlement fee", statement.platformFeePaise],
      ["Refund adjustment", statement.refundAdjustmentPaise],
      ["Offsets and adjustments", statement.adjustmentPaise],
      ["Net payable", statement.netPayablePaise],
      []
    ];

    rows.push(["Product order payouts"]);
    rows.push(["Order number", "Gross", "Commission", "GST", "TDS", "TCS", "Seller settlement fee", "Net payable"]);
    for (const split of statement.payout?.orderSplits ?? []) {
      rows.push([
        split.order.orderNumber,
        split.sellerSubtotalPaise,
        split.commissionPaise,
        split.gstOnCommissionPaise,
        split.tdsPaise,
        split.tcsPaise,
        split.platformFeePaise,
        split.netPayablePaise
      ]);
    }

    rows.push([]);
    rows.push(["B2B order payouts"]);
    rows.push(["Order number", "Buyer payable", "Commission", "Seller payout", "Settlement status"]);
    for (const order of statement.payout?.b2bOrders ?? []) {
      rows.push([
        order.orderNumber,
        order.buyerPayableAmountPaise,
        order.commissionAmountPaise,
        order.sellerPayoutAmountPaise,
        order.settlementStatus
      ]);
    }

    rows.push([]);
    rows.push(["Service booking payouts"]);
    rows.push([
      "Booking number",
      "Gross",
      "Inspection fee gross",
      "Commission",
      "GST",
      "TDS",
      "TCS",
      "Seller settlement fee",
      "Refund adjustment",
      "Net payable",
      "Settlement status"
    ]);
    for (const settlement of statement.payout?.serviceSettlements ?? []) {
      rows.push([
        settlement.booking.bookingNumber,
        settlement.grossAmountPaise,
        settlement.inspectionFeeGrossPaise,
        settlement.commissionPaise,
        settlement.gstOnCommissionPaise,
        settlement.tdsPaise,
        settlement.tcsPaise,
        settlement.platformFeePaise,
        settlement.refundAdjustmentPaise,
        settlement.netPayablePaise,
        settlement.status
      ]);
    }

    rows.push([]);
    rows.push(["Service cash receivable offsets"]);
    rows.push([
      "Receivable number",
      "Booking number",
      "Gross cash collected",
      "Amount due to platform",
      "Settled",
      "Waived",
      "Reversed",
      "Offset in payout",
      "Outstanding after offset",
      "Status",
      "Offset policy"
    ]);
    for (const receivable of statement.payout?.serviceReceivableOffsets ?? []) {
      rows.push([
        receivable.receivableNumber,
        receivable.booking.bookingNumber,
        receivable.grossCashCollectedPaise,
        receivable.amountDueToPlatformPaise,
        receivable.settledPaise,
        receivable.waivedPaise,
        receivable.reversalPaise,
        receivable.offsetPaise,
        this.serviceReceivableOutstanding(receivable),
        receivable.status,
        receivable.offsetPolicy
      ]);
    }

    rows.push([]);
    rows.push(["Seller-collected COD offsets"]);
    rows.push([
      "Receivable number",
      "Order number",
      "Shipment number",
      "Delivery mode",
      "Gross cash collected",
      "Platform due",
      "Offset in payout",
      "Outstanding after offset",
      "Status"
    ]);
    for (const entry of this.sellerCashOffsetEntries(statement)) {
      const receivable = entry.sellerCashReceivable;
      rows.push([
        receivable?.receivableNumber ?? entry.referenceId ?? "",
        receivable?.order.orderNumber ?? "",
        receivable?.orderShipment?.shipmentNumber ?? "",
        receivable?.orderShipment?.deliveryMode ?? "",
        receivable?.grossCashCollectedPaise ?? "",
        receivable?.platformDuePaise ?? "",
        entry.debitPaise,
        receivable?.outstandingPaise ?? "",
        receivable?.status ?? ""
      ]);
    }

    return rows.map((row) => row.map((cell) => this.csvCell(String(cell ?? ""))).join(",")).join("\n");
  }

  private statementPdf(statement: StatementExport) {
    const payout = statement.payout;
    return renderProfessionalPdf({
      title: "Seller Settlement Statement",
      documentNumber: statement.statementNumber,
      status: statement.status.replaceAll("_", " "),
      subtitle: "Detailed settlement, deductions, offsets, and payout reconciliation.",
      issuedBy: "1HandIndia Seller Finance",
      issuerCaption: "Marketplace settlement and ledger document",
      metadata: [
        { label: "Statement number", value: statement.statementNumber },
        { label: "Payout number", value: payout?.payoutNumber ?? "Not linked" },
        { label: "Period from", value: this.shortDate(statement.periodFrom) },
        { label: "Period to", value: this.shortDate(statement.periodTo) },
      ],
      parties: [
        {
          label: "Statement issued to",
          name: statement.seller.profile?.businessLegalName ?? statement.seller.storeName,
          lines: [
            `Store: ${statement.seller.storeName}`,
            `GSTIN: ${statement.seller.profile?.gstNumber ?? "Not provided"}`,
          ],
        },
        {
          label: "Issued by",
          name: "1HandIndia Seller Finance",
          lines: ["Settlement support and payout reconciliation", "Amounts are shown in INR unless stated otherwise."],
        },
      ],
      sections: [
        {
          type: "totals",
          title: "Settlement summary",
          emphasizedLabel: "Net payable",
          rows: [
            { label: "Gross sales", value: this.rupees(statement.grossSalesPaise) },
            { label: "Commission", value: this.rupees(statement.commissionPaise) },
            { label: "GST on commission", value: this.rupees(statement.gstOnCommissionPaise) },
            { label: "TDS", value: this.rupees(statement.tdsPaise) },
            { label: "TCS", value: this.rupees(statement.tcsPaise) },
            { label: "Seller settlement fee", value: this.rupees(statement.platformFeePaise) },
            { label: "Refund adjustment", value: this.rupees(statement.refundAdjustmentPaise) },
            { label: "Offsets and adjustments", value: this.rupees(statement.adjustmentPaise) },
            { label: "Net payable", value: this.rupees(statement.netPayablePaise) },
          ],
        },
        {
          type: "table",
          title: "Product order payouts",
          columns: [
            { key: "reference", label: "Order", width: 120 },
            { key: "gross", label: "Gross", width: 95, align: "right" },
            { key: "deductions", label: "Commission / Tax", width: 135, align: "right" },
            { key: "fees", label: "TDS / TCS / Fee", width: 120, align: "right" },
            { key: "net", label: "Net", width: 95, align: "right" },
          ],
          rows: (payout?.orderSplits ?? []).map((split) => ({
            reference: split.order.orderNumber,
            gross: this.rupees(split.sellerSubtotalPaise),
            deductions: `${this.rupees(split.commissionPaise)}\nGST ${this.rupees(split.gstOnCommissionPaise)}`,
            fees: `TDS ${this.rupees(split.tdsPaise)}\nTCS ${this.rupees(split.tcsPaise)}\nFee ${this.rupees(split.platformFeePaise)}`,
            net: this.rupees(split.netPayablePaise),
          })),
          emptyText: "No product order payouts are linked to this statement.",
        },
        {
          type: "table",
          title: "B2B order payouts",
          columns: [
            { key: "reference", label: "Order", width: 130 },
            { key: "buyer", label: "Buyer payable", width: 115, align: "right" },
            { key: "commission", label: "Commission", width: 105, align: "right" },
            { key: "seller", label: "Seller payout", width: 115, align: "right" },
            { key: "status", label: "Status", width: 95 },
          ],
          rows: (payout?.b2bOrders ?? []).map((order) => ({
            reference: order.orderNumber,
            buyer: this.rupees(order.buyerPayableAmountPaise),
            commission: this.rupees(order.commissionAmountPaise),
            seller: this.rupees(order.sellerPayoutAmountPaise),
            status: order.settlementStatus.replaceAll("_", " "),
          })),
          emptyText: "No B2B payouts are linked to this statement.",
        },
        {
          type: "table",
          title: "Service booking payouts",
          columns: [
            { key: "reference", label: "Booking", width: 120 },
            { key: "gross", label: "Gross", width: 100, align: "right" },
            { key: "deductions", label: "Deductions", width: 155, align: "right" },
            { key: "net", label: "Net payable", width: 110, align: "right" },
            { key: "status", label: "Status", width: 90 },
          ],
          rows: (payout?.serviceSettlements ?? []).map((settlement) => ({
            reference: settlement.booking.bookingNumber,
            gross: `${this.rupees(settlement.grossAmountPaise)}\nInspection ${this.rupees(settlement.inspectionFeeGrossPaise)}`,
            deductions: `Commission ${this.rupees(settlement.commissionPaise)}\nGST ${this.rupees(settlement.gstOnCommissionPaise)}\nTDS/TCS ${this.rupees(settlement.tdsPaise + settlement.tcsPaise)}\nFee ${this.rupees(settlement.platformFeePaise)}\nRefund ${this.rupees(settlement.refundAdjustmentPaise)}`,
            net: this.rupees(settlement.netPayablePaise),
            status: settlement.status.replaceAll("_", " "),
          })),
          emptyText: "No service payouts are linked to this statement.",
        },
        {
          type: "fields",
          title: "Cash collection offsets",
          fields: [
            { label: "Service cash offsets", value: this.rupees(this.serviceReceivableOffsetTotal(statement)) },
            { label: "Seller-collected COD offsets", value: this.rupees(this.sellerCashReceivableOffsetTotal(statement)) },
          ],
        },
      ],
      footerLines: [
        "This statement is generated from append-only 1HandIndia seller finance ledger records.",
        "For reconciliation questions, quote the statement and payout numbers shown above.",
      ],
      fileTitle: `Seller statement ${statement.statementNumber}`,
    });
  }

  private csvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private rupees(paise: number) {
    return `INR ${(paise / 100).toFixed(2)}`;
  }

  private serviceReceivableOffsetTotal(statement: StatementExport) {
    return (statement.payout?.serviceReceivableOffsets ?? []).reduce((sum, receivable) => sum + receivable.offsetPaise, 0);
  }

  private sellerCashReceivableOffsetTotal(statement: StatementExport) {
    return this.sellerCashOffsetEntries(statement).reduce((sum, entry) => sum + entry.debitPaise, 0);
  }

  private sellerCashOffsetEntries(statement: StatementExport) {
    return (statement.payout?.ledgerEntries ?? []).filter(
      (entry) => entry.entryType === SellerLedgerEntryType.SELLER_CASH_RECEIVABLE_OFFSET,
    );
  }

  private serviceReceivableOutstanding(
    receivable: Pick<
      NonNullable<StatementExport["payout"]>["serviceReceivableOffsets"][number],
      "amountDueToPlatformPaise" | "settledPaise" | "waivedPaise" | "reversalPaise" | "offsetPaise"
    >
  ) {
    return Math.max(
      0,
      receivable.amountDueToPlatformPaise -
        receivable.settledPaise -
        receivable.waivedPaise -
        receivable.reversalPaise -
        receivable.offsetPaise
    );
  }

  private shortDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private makeStatementNumber() {
    return `ST-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
}
