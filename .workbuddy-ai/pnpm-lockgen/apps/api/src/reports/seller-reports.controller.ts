import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { GstReportExportType, RoleCode } from "@indihub/database";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CreateGstDebitNoteDto,
  GstFilingPeriodDto,
  GstMarkFiledDto,
  GstPeriodActionDto,
  RecordTaxDocumentComplianceDto,
} from "./dto/gst-compliance.dto";
import { SellerGstDocumentQueryDto } from "./dto/gst-report-query.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import {
  documentSeriesCsv,
  eInvoiceStatusCsv,
  eWayBillStatusCsv,
  gstinSummaryCsv,
  gstRegisterCsv,
  gstr1OrientedCsv,
  gstr3bSummaryCsv,
  gstr8TcsCsv,
  hsnSummaryCsv,
  platformCommissionCsv,
  rateLiabilityCsv,
  reconciliationCsv,
  stateLiabilityCsv,
} from "./gst-report-csv";
import { GstComplianceService } from "./gst-compliance.service";
import { ReportsService } from "./reports.service";
import { TaxDocumentsService } from "../tax/tax-documents.service";

@ApiTags("Seller Reports")
@Roles(RoleCode.SELLER)
@Controller("seller/reports")
export class SellerReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(GstComplianceService) private readonly gstCompliance: GstComplianceService,
    @Inject(TaxDocumentsService) private readonly taxDocuments: TaxDocumentsService,
  ) {}

  @Get("sales")
  @ApiOperation({ summary: "Read sales summary for the authenticated seller." })
  sales(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerSales(actor, query);
  }

  @Get("overview")
  @ApiOperation({ summary: "Read high-level summary stats for the seller reports hub." })
  overview(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerReportsOverview(actor, query);
  }

  @Get("inventory")
  @ApiOperation({ summary: "Read inventory and stock report for the authenticated seller." })
  inventory(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerInventoryReport(actor, query);
  }

  @Get("finance")
  @ApiOperation({ summary: "Read finance and settlements report for the authenticated seller." })
  finance(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerFinanceReport(actor, query);
  }

  @Get("tax")
  @ApiOperation({ summary: "Read tax and compliance report for the authenticated seller." })
  tax(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerTaxReport(actor, query);
  }

  @Get("gst")
  @ApiOperation({ summary: "Read immutable outward-supply GST register and HSN summary." })
  gst(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerGstReport(actor, query);
  }

  @Get("gst/overview")
  @ApiOperation({ summary: "Read complete GST summaries without embedding document rows." })
  async gstOverview(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    return this.gstCompliance.sellerOverview(query, sellerId);
  }

  @Get("gst-documents")
  @ApiOperation({ summary: "List the authenticated seller's issued GST documents." })
  gstDocuments(
    @CurrentUser() actor: RequestUser,
    @Query() query: SellerGstDocumentQueryDto,
  ) {
    return this.gstCompliance.sellerDocumentPage(actor, query);
  }

  @Get("gst-documents/:documentId/download")
  @ApiOperation({ summary: "Download an issued seller tax document as PDF." })
  async downloadGstDocument(
    @CurrentUser() actor: RequestUser,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.taxDocuments.sellerDocumentPdf(actor.id, documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    res.send(document.buffer);
  }

  @Get("returns")
  @ApiOperation({ summary: "Read returns and refunds report for the authenticated seller." })
  returns(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.sellerReturnsReport(actor, query);
  }

  @Get("export/inventory")
  @ApiOperation({ summary: "Export inventory report as CSV." })
  async exportInventory(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    const data = await this.reportsService.sellerInventoryReport(actor, query);
    const rows = [
      ["Product Name", "SKU / Variant", "Stock Quantity", "Status"],
      ...data.variants.map((v) => [
        v.product.name,
        v.variantName ?? v.sku ?? "",
        String(v.stockQuantity),
        v.stockQuantity <= 5 ? "LOW STOCK" : "OK",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=inventory-report.csv");
    res.send(csv);
  }

  @Get("export/finance")
  @ApiOperation({ summary: "Export finance report as CSV." })
  async exportFinance(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    const data = await this.reportsService.sellerFinanceReport(actor, query);
    const currency = data.currency ?? "INR";
    const rows = [
      ["Payout Number", "Period From", "Period To", "Status", `Gross Sales (${currency})`, `Commission (${currency})`, `GST on Fees (${currency})`, `TDS (${currency})`, `TCS (${currency})`, `Seller Settlement Fee (${currency})`, `Refund Adjustment (${currency})`, `Offsets and Adjustments (${currency})`, `Net Payable (${currency})`],
      ...data.recentPayouts.map((p) => [
        p.payoutNumber,
        new Date(p.periodFrom).toLocaleDateString("en-IN"),
        new Date(p.periodTo).toLocaleDateString("en-IN"),
        p.status,
        String((p.grossSalesPaise ?? 0) / 100),
        String((p.commissionPaise ?? 0) / 100),
        String((p.gstOnCommissionPaise ?? 0) / 100),
        String((p.tdsPaise ?? 0) / 100),
        String((p.tcsPaise ?? 0) / 100),
        String((p.platformFeePaise ?? 0) / 100),
        String((p.refundAdjustmentPaise ?? 0) / 100),
        String((p.adjustmentPaise ?? 0) / 100),
        String((p.netPayablePaise ?? 0) / 100),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=finance-report.csv");
    res.send(csv);
  }

  @Get("export/tax")
  @ApiOperation({ summary: "Export tax report as CSV." })
  async exportTax(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    const data = await this.reportsService.sellerTaxReport(actor, query);
    const currency = data.currency ?? "INR";
    const rows = [
      ["Order Number", "Date", `Gross Sale (${currency})`, `GST on Commission (${currency})`, `TDS (${currency})`, `TCS (${currency})`, `Commission (${currency})`, `Net (${currency})`],
      ...data.splits.map((s) => [
        s.order.orderNumber,
        new Date(s.createdAt).toLocaleDateString("en-IN"),
        String((s.sellerSubtotalPaise ?? 0) / 100),
        String((s.gstOnCommissionPaise ?? 0) / 100),
        String((s.tdsPaise ?? 0) / 100),
        String((s.tcsPaise ?? 0) / 100),
        String((s.commissionPaise ?? 0) / 100),
        String((s.netPayablePaise ?? 0) / 100),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=tax-report.csv");
    res.send(csv);
  }

  @Get("export/gst-register")
  @ApiOperation({ summary: "Export the seller GST document register as CSV." })
  async exportGstRegister(
    @CurrentUser() actor: RequestUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.sellerGstReport(actor, query, true);
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const csv = gstRegisterCsv(data);
    await this.recordExport(actor, sellerId, query, GstReportExportType.GST_REGISTER, "gst-register.csv", "text/csv", csv, Math.max(0, csv.split("\n").length - 1));
    this.sendCsv(res, "gst-register.csv", csv);
  }

  @Get("export/hsn-summary")
  @ApiOperation({ summary: "Export the seller HSN summary as CSV." })
  async exportHsnSummary(
    @CurrentUser() actor: RequestUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.sellerGstReport(actor, query, true);
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const csv = hsnSummaryCsv(data);
    await this.recordExport(actor, sellerId, query, GstReportExportType.HSN_SUMMARY, "hsn-summary.csv", "text/csv", csv, Math.max(0, csv.split("\n").length - 1));
    this.sendCsv(res, "hsn-summary.csv", csv);
  }

  @Get("export/gstr-1")
  @ApiOperation({ summary: "Export GSTR-1-oriented outward supply rows as CSV." })
  async exportGstr1(
    @CurrentUser() actor: RequestUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.sellerGstReport(actor, query, true);
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const csv = gstr1OrientedCsv(data);
    await this.recordExport(actor, sellerId, query, GstReportExportType.GSTR1_CSV, "gstr-1-oriented.csv", "text/csv", csv, Math.max(0, csv.split("\n").length - 1));
    this.sendCsv(res, "gstr-1-oriented.csv", csv);
  }

  @Get("export/gstr-1-json")
  @ApiOperation({ summary: "Export the seller GSTR-1 filing package as JSON." })
  async exportGstr1Json(
    @CurrentUser() actor: RequestUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const data = await this.gstCompliance.report(query, sellerId, true);
    const content = JSON.stringify(this.gstCompliance.gstr1Json(data), null, 2);
    await this.recordExport(
      actor,
      sellerId,
      query,
      GstReportExportType.GSTR1_JSON,
      "gstr-1.json",
      "application/json",
      content,
      data.documents.length,
    );
    this.sendFile(res, "gstr-1.json", "application/json", content);
  }

  @Get("export/gstr-3b")
  @ApiOperation({ summary: "Export the seller GSTR-3B outward-liability summary." })
  async exportGstr3b(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.GSTR3B, "gstr-3b.csv", gstr3bSummaryCsv, res);
  }

  @Get("export/gstr-8")
  @ApiOperation({ summary: "Export the seller marketplace TCS statement." })
  async exportGstr8(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.GSTR8, "tcs-credit-statement.csv", gstr8TcsCsv, res);
  }

  @Get("export/document-series")
  @ApiOperation({ summary: "Export the seller GST document series." })
  async exportDocumentSeries(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.DOCUMENT_SERIES, "gst-document-series.csv", documentSeriesCsv, res);
  }

  @Get("export/rate-liability")
  @ApiOperation({ summary: "Export the seller GST rate-wise liability." })
  async exportRateLiability(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.RATE_LIABILITY, "gst-rate-liability.csv", rateLiabilityCsv, res);
  }

  @Get("export/state-liability")
  @ApiOperation({ summary: "Export the seller place-of-supply liability." })
  async exportStateLiability(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.STATE_LIABILITY, "gst-state-liability.csv", stateLiabilityCsv, res);
  }

  @Get("export/gstin-summary")
  @ApiOperation({ summary: "Export the seller GSTIN-wise B2B summary." })
  async exportGstinSummary(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.GSTIN_SUMMARY, "gst-gstin-summary.csv", gstinSummaryCsv, res);
  }

  @Get("export/reconciliation")
  @ApiOperation({ summary: "Export seller GST reconciliation findings." })
  async exportReconciliation(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.RECONCILIATION, "gst-reconciliation.csv", reconciliationCsv, res);
  }

  @Get("export/platform-commission")
  @ApiOperation({ summary: "Export platform commission GST invoices for the seller." })
  async exportPlatformCommission(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.PLATFORM_COMMISSION, "platform-commission-gst.csv", platformCommissionCsv, res);
  }

  @Get("export/e-invoice")
  @ApiOperation({ summary: "Export the seller e-invoice status register." })
  async exportEInvoice(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.E_INVOICE, "e-invoice-status.csv", eInvoiceStatusCsv, res);
  }

  @Get("export/e-way-bill")
  @ApiOperation({ summary: "Export the seller e-way bill status register." })
  async exportEWayBill(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    await this.advancedCsv(actor, query, GstReportExportType.E_WAY_BILL, "e-way-bill-status.csv", eWayBillStatusCsv, res);
  }

  @Get("filing-periods")
  @ApiOperation({ summary: "Read seller GST filing periods." })
  async filingPeriods(@CurrentUser() actor: RequestUser) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const report = await this.gstCompliance.report({}, sellerId, false);
    return report.filingPeriods;
  }

  @Post("filing-periods/lock")
  @ApiOperation({ summary: "Lock a seller GST filing period." })
  async lockFilingPeriod(@CurrentUser() actor: RequestUser, @Body() dto: GstFilingPeriodDto) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    return this.gstCompliance.lockPeriod(sellerId, actor, dto);
  }

  @Post("filing-periods/file")
  @ApiOperation({ summary: "Mark a seller GST filing period filed." })
  async markFilingPeriodFiled(@CurrentUser() actor: RequestUser, @Body() dto: GstMarkFiledDto) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    return this.gstCompliance.markFiled(sellerId, actor, dto);
  }

  @Post("filing-periods/reopen")
  @ApiOperation({ summary: "Reopen an unfixed seller GST filing period." })
  async reopenFilingPeriod(@CurrentUser() actor: RequestUser, @Body() dto: GstPeriodActionDto) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    return this.gstCompliance.reopenPeriod(sellerId, dto.returnPeriod, actor);
  }

  @Post("debit-notes")
  @ApiOperation({ summary: "Issue a seller GST debit note." })
  async createDebitNote(@CurrentUser() actor: RequestUser, @Body() dto: CreateGstDebitNoteDto) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    return this.gstCompliance.createDebitNote(sellerId, actor, dto);
  }

  @Patch("gst-documents/:documentId/compliance")
  @ApiOperation({ summary: "Record e-invoice and e-way bill status for a seller document." })
  async recordCompliance(
    @CurrentUser() actor: RequestUser,
    @Param("documentId") documentId: string,
    @Body() dto: RecordTaxDocumentComplianceDto,
  ) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const report = await this.gstCompliance.report({}, sellerId, true);
    if (!report.documents.some((document) => document.id === documentId)) {
      throw new ForbiddenException("The tax document is not owned by this seller.");
    }
    return this.gstCompliance.recordCompliance(documentId, actor, dto);
  }

  @Get("export/returns")
  @ApiOperation({ summary: "Export returns report as CSV." })
  async exportReturns(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    const data = await this.reportsService.sellerReturnsReport(actor, query);
    const rows = [
      ["Request Number", "Date", "Status", "Resolution", "Reason", "Requested Amount (₹)", "Approved Amount (₹)"],
      ...data.recentReturns.map((r) => [
        r.requestNumber,
        new Date(r.requestedAt).toLocaleDateString("en-IN"),
        r.status,
        r.resolution,
        r.reason,
        String((r.requestedAmountPaise ?? 0) / 100),
        String((r.approvedAmountPaise ?? 0) / 100),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=returns-report.csv");
    res.send(csv);
  }

  @Get("export/sales")
  @ApiOperation({ summary: "Export sales report as CSV." })
  async exportSales(@CurrentUser() actor: RequestUser, @Query() query: ReportQueryDto, @Res() res: Response) {
    const data = await this.reportsService.sellerSales(actor, query);
    const currency = data.currency ?? "INR";
    const rows = [
      ["Order Number", "Date", "Status", `Seller Subtotal (${currency})`, `Commission (${currency})`, `Net (${currency})`],
      ...data.recentOrders.map((s) => [
        s.order.orderNumber,
        new Date(s.createdAt).toLocaleDateString("en-IN"),
        s.sellerStatus,
        String((s.sellerSubtotalPaise ?? 0) / 100),
        String((s.commissionPaise ?? 0) / 100),
        String((s.netPayablePaise ?? 0) / 100),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.csv");
    res.send(csv);
  }

  private sendCsv(res: Response, filename: string, csv: string) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(`\uFEFF${csv}`);
  }

  private sendFile(res: Response, filename: string, contentType: string, content: string) {
    res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(content);
  }

  private async advancedCsv(
    actor: RequestUser,
    query: ReportQueryDto,
    exportType: GstReportExportType,
    filename: string,
    build: (data: Awaited<ReturnType<GstComplianceService["report"]>>) => string,
    res: Response,
  ) {
    const sellerId = await this.gstCompliance.sellerIdForActor(actor);
    const data = await this.gstCompliance.report(query, sellerId, true);
    const csv = build(data);
    await this.recordExport(
      actor,
      sellerId,
      query,
      exportType,
      filename,
      "text/csv",
      csv,
      Math.max(0, csv.split("\n").length - 1),
    );
    this.sendCsv(res, filename, csv);
  }

  private recordExport(
    actor: RequestUser,
    sellerId: string,
    query: ReportQueryDto,
    exportType: GstReportExportType,
    fileName: string,
    contentType: string,
    content: string,
    rowCount: number,
  ) {
    return this.gstCompliance.recordExport({
      sellerId,
      actorUserId: actor.id,
      query,
      exportType,
      fileName,
      contentType,
      content,
      rowCount,
    });
  }
}
