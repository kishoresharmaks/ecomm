import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SellerPayoutStatus, SellerStatementStatus } from "@indihub/database";
import {
  cursorPageFromTimestampItems,
  cursorPaginationFromQuery,
  paginationFromQuery,
  timestampCursorOrderBy,
  timestampCursorWhere,
} from "../common/pagination";
import { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { FinanceListQueryDto, GenerateStatementDto } from "./dto/finance.dto";

type StatementExport = Prisma.SellerStatementGetPayload<{
  include: {
    seller: { include: { profile: true } };
    payout: { include: { orderSplits: { include: { order: true } } } };
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
      const items = await this.prisma.client.sellerStatement.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: this.statementListInclude(),
        orderBy: timestampCursorOrderBy("generatedAt"),
        take: take + 1
      });
      const pageResult = cursorPageFromTimestampItems(items, take, "generatedAt");

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.sellerStatement.findMany({
        where,
        include: this.statementListInclude(),
        orderBy: timestampCursorOrderBy("generatedAt"),
        skip,
        take
      });
      const total = await tx.sellerStatement.count({ where });
      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  private statementListInclude() {
    return {
      seller: { select: { id: true, storeName: true, slug: true } },
      payout: { select: { id: true, payoutNumber: true, status: true } }
    } satisfies Prisma.SellerStatementInclude;
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

    const pdf = this.statementPdf(statement);
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
      ["Manual adjustment", statement.adjustmentPaise],
      ["Net payable", statement.netPayablePaise],
      [],
      ["Order number", "Gross", "Commission", "GST", "TDS", "TCS", "Seller settlement fee", "Net payable"]
    ];

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

    return rows.map((row) => row.map((cell) => this.csvCell(String(cell ?? ""))).join(",")).join("\n");
  }

  private statementPdf(statement: StatementExport) {
    const lines = [
      "1HandIndia Seller Statement",
      `Statement: ${statement.statementNumber}`,
      `Seller: ${statement.seller.storeName}`,
      `Period: ${this.shortDate(statement.periodFrom)} to ${this.shortDate(statement.periodTo)}`,
      `Payout: ${statement.payout?.payoutNumber ?? "Not linked"}`,
      "",
      `Gross sales: ${this.rupees(statement.grossSalesPaise)}`,
      `Commission: ${this.rupees(statement.commissionPaise)}`,
      `GST on commission: ${this.rupees(statement.gstOnCommissionPaise)}`,
      `TDS: ${this.rupees(statement.tdsPaise)}`,
      `TCS: ${this.rupees(statement.tcsPaise)}`,
      `Seller settlement fee: ${this.rupees(statement.platformFeePaise)}`,
      `Refund adjustment: ${this.rupees(statement.refundAdjustmentPaise)}`,
      `Manual adjustment: ${this.rupees(statement.adjustmentPaise)}`,
      `Net payable: ${this.rupees(statement.netPayablePaise)}`,
      "",
      "This statement is generated from 1HandIndia seller finance ledger records."
    ];

    return this.simplePdf(lines);
  }

  private simplePdf(lines: string[]) {
    const content = lines
      .map((line, index) => `BT /F1 12 Tf 50 ${780 - index * 22} Td (${this.pdfText(line)}) Tj ET`)
      .join("\n");
    const objects = [
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
      "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
      `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`
    ];
    let body = "%PDF-1.4\n";
    const offsets = [0];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(body));
      body += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(body);
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) {
      body += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(body, "utf8");
  }

  private csvCell(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private pdfText(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  private rupees(paise: number) {
    return `INR ${(paise / 100).toFixed(2)}`;
  }

  private shortDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private makeStatementNumber() {
    return `ST-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
}
