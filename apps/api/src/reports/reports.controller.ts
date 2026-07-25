import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { GstReportExportType, ReportExportType, RoleCode } from "@indihub/database";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  AdminCreateGstDebitNoteDto,
  RecordTaxDocumentComplianceDto,
} from "./dto/gst-compliance.dto";
import {
  AdminGstReportQueryDto,
  GstDocumentQueryDto,
} from "./dto/gst-report-query.dto";
import { OrderTaxRegisterQueryDto } from "./dto/order-tax-register-query.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import { OperationalReportQueryDto } from "./dto/operational-report-query.dto";
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
import { orderTaxRegisterCsv } from "./order-tax-register-csv";
import { OrderTaxRegisterService } from "./order-tax-register.service";
import { ReportsService } from "./reports.service";
import { TaxDocumentsService } from "../tax/tax-documents.service";

@ApiTags("Admin Reports")
@Roles(RoleCode.ADMIN)
@Controller("admin/reports")
export class ReportsController {
  constructor(
    @Inject(ReportsService) private readonly reportsService: ReportsService,
    @Inject(GstComplianceService) private readonly gstCompliance: GstComplianceService,
    @Inject(OrderTaxRegisterService) private readonly orderTaxRegister: OrderTaxRegisterService,
    @Inject(TaxDocumentsService) private readonly taxDocuments: TaxDocumentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Read reports overview." })
  overview(@Query() query: ReportQueryDto): Promise<unknown> {
    return this.reportsService.overview(query);
  }

  @Get("sales")
  @ApiOperation({ summary: "Read sales report." })
  async sales(@Query() query: OperationalReportQueryDto): Promise<unknown> {
    const [summary, table] = await Promise.all([
      this.reportsService.sales(query),
      this.reportsService.operationalPage(ReportExportType.ADMIN_SALES, query),
    ]);
    return { ...summary, table };
  }

  @Get("sellers")
  @ApiOperation({ summary: "Read seller report." })
  async sellers(@Query() query: OperationalReportQueryDto): Promise<unknown> {
    const [summary, table] = await Promise.all([
      this.reportsService.sellers(query),
      this.reportsService.operationalPage(ReportExportType.ADMIN_SELLERS, query),
    ]);
    return { ...summary, table };
  }

  @Get("products")
  @ApiOperation({ summary: "Read product report." })
  async products(@Query() query: OperationalReportQueryDto): Promise<unknown> {
    const [summary, table] = await Promise.all([
      this.reportsService.products(query),
      this.reportsService.operationalPage(ReportExportType.ADMIN_PRODUCTS, query),
    ]);
    return { ...summary, table };
  }

  @Get("enquiries")
  @ApiOperation({ summary: "Read enquiry report." })
  async enquiries(@Query() query: OperationalReportQueryDto): Promise<unknown> {
    const [summary, table] = await Promise.all([
      this.reportsService.enquiries(query),
      this.reportsService.operationalPage(ReportExportType.ADMIN_ENQUIRIES, query),
    ]);
    return { ...summary, table };
  }

  @Get("gst")
  @ApiOperation({ summary: "Read marketplace GST register and HSN summary." })
  gst(@Query() query: ReportQueryDto) {
    return this.reportsService.adminGstReport(query);
  }

  @Get("gst/overview")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Read complete marketplace GST summaries for finance oversight." })
  gstOverview(@Query() query: AdminGstReportQueryDto) {
    return this.gstCompliance.adminOverview(query);
  }

  @Get("gst/documents")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "List issued GST documents with server-side pagination and filters." })
  gstDocuments(@Query() query: GstDocumentQueryDto) {
    return this.gstCompliance.documentPage(query);
  }

  @Get("gst/documents/:documentId/download")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Download an issued seller tax document as PDF." })
  async downloadGstDocument(
    @CurrentUser() actor: RequestUser,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    const document = await this.taxDocuments.adminDocumentPdf(actor.id, documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    res.send(document.buffer);
  }

  @Get("order-tax-register")
  @ApiOperation({ summary: "Read the line-level order tax and reconciliation register." })
  orderTaxRegisterReport(@Query() query: OrderTaxRegisterQueryDto) {
    return this.orderTaxRegister.report(query);
  }

  @Get("export/order-tax-register")
  @ApiOperation({ summary: "Export the line-level order tax and reconciliation register." })
  async exportOrderTaxRegister(
    @CurrentUser() actor: RequestUser,
    @Query() query: OrderTaxRegisterQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.orderTaxRegister.report(query, true);
    if (data.truncated) {
      throw new BadRequestException(
        "The export is too large for one file. Narrow the date range or seller filter and try again.",
      );
    }
    const content = orderTaxRegisterCsv(data.items);
    await this.recordExport(
      actor,
      query,
      GstReportExportType.ORDER_TAX_REGISTER,
      "order-tax-reconciliation-register.csv",
      "text/csv",
      content,
      data.items.length,
    );
    this.sendCsv(res, "order-tax-reconciliation-register.csv", content);
  }

  @Get("export/gst-register")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export marketplace GST document register as CSV." })
  async exportGstRegister(
    @CurrentUser() actor: RequestUser,
    @Query() query: AdminGstReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.adminGstReport(query, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.GST_REGISTER, "marketplace-gst-register.csv", gstRegisterCsv(data), res);
  }

  @Get("export/hsn-summary")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export marketplace HSN summary as CSV." })
  async exportHsnSummary(
    @CurrentUser() actor: RequestUser,
    @Query() query: AdminGstReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.adminGstReport(query, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.HSN_SUMMARY, "marketplace-hsn-summary.csv", hsnSummaryCsv(data), res);
  }

  @Get("export/gstr-1")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export marketplace GSTR-1-oriented rows as CSV." })
  async exportGstr1(
    @CurrentUser() actor: RequestUser,
    @Query() query: AdminGstReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.adminGstReport(query, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.GSTR1_CSV, "marketplace-gstr-1-oriented.csv", gstr1OrientedCsv(data), res);
  }

  @Get("export/gstr-1-json")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export the validated GSTR-1 filing package as JSON." })
  async exportGstr1Json(
    @CurrentUser() actor: RequestUser,
    @Query() query: AdminGstReportQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    const content = JSON.stringify(this.gstCompliance.gstr1Json(data), null, 2);
    await this.recordExport(actor, query, GstReportExportType.GSTR1_JSON, "marketplace-gstr-1.json", "application/json", content, data.documents.length);
    this.sendFile(res, "marketplace-gstr-1.json", "application/json", content);
  }

  @Get("export/gstr-3b")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export the GSTR-3B outward-liability summary." })
  async exportGstr3b(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.GSTR3B, "marketplace-gstr-3b.csv", gstr3bSummaryCsv(data), res);
  }

  @Get("export/gstr-8")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export marketplace GSTR-8 and TCS statements." })
  async exportGstr8(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.GSTR8, "marketplace-gstr-8-tcs.csv", gstr8TcsCsv(data), res);
  }

  @Get("export/document-series")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export GST invoice document-series controls." })
  async exportDocumentSeries(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.DOCUMENT_SERIES, "marketplace-gst-document-series.csv", documentSeriesCsv(data), res);
  }

  @Get("export/rate-liability")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export GST rate-wise liability." })
  async exportRateLiability(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.RATE_LIABILITY, "marketplace-gst-rate-liability.csv", rateLiabilityCsv(data), res);
  }

  @Get("export/state-liability")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export place-of-supply state liability." })
  async exportStateLiability(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.STATE_LIABILITY, "marketplace-gst-state-liability.csv", stateLiabilityCsv(data), res);
  }

  @Get("export/gstin-summary")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export GSTIN-wise B2B summary." })
  async exportGstinSummary(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.GSTIN_SUMMARY, "marketplace-gst-gstin-summary.csv", gstinSummaryCsv(data), res);
  }

  @Get("export/reconciliation")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export GST reconciliation findings." })
  async exportReconciliation(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.RECONCILIATION, "marketplace-gst-reconciliation.csv", reconciliationCsv(data), res);
  }

  @Get("export/platform-commission")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export platform commission GST documents." })
  async exportPlatformCommission(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.PLATFORM_COMMISSION, "marketplace-platform-commission-gst.csv", platformCommissionCsv(data), res);
  }

  @Get("export/e-invoice")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export e-invoice status register." })
  async exportEInvoice(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.E_INVOICE, "marketplace-e-invoice-status.csv", eInvoiceStatusCsv(data), res);
  }

  @Get("export/e-way-bill")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Export e-way bill status register." })
  async exportEWayBill(@CurrentUser() actor: RequestUser, @Query() query: AdminGstReportQueryDto, @Res() res: Response) {
    const data = await this.gstCompliance.report(query, query.sellerId, true);
    await this.sendTrackedCsv(actor, query, GstReportExportType.E_WAY_BILL, "marketplace-e-way-bill-status.csv", eWayBillStatusCsv(data), res);
  }

  @Get("gst/provider-readiness")
  @ApiOperation({ summary: "Read GST provider readiness and configuration status." })
  getGstProviderReadiness() {
    return this.gstCompliance.providerReadiness();
  }

  @Get("gst/filing-periods/:sellerId")
  @ApiOperation({ summary: "Read GST filing periods for a seller." })
  async getSellerFilingPeriods(@Param("sellerId") sellerId: string) {
    const data = await this.gstCompliance.report({}, sellerId, false);
    return data.filingPeriods;
  }

  @Post("gst/debit-notes")
  @ApiOperation({ summary: "Issue a seller GST debit note." })
  createDebitNote(@CurrentUser() actor: RequestUser, @Body() dto: AdminCreateGstDebitNoteDto) {
    return this.gstCompliance.createDebitNote(dto.sellerId, actor, dto);
  }

  @Patch("gst/documents/:documentId/compliance")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Record e-invoice and e-way bill status for a GST document." })
  recordCompliance(
    @CurrentUser() actor: RequestUser,
    @Param("documentId") documentId: string,
    @Body() dto: RecordTaxDocumentComplianceDto,
  ) {
    return this.gstCompliance.recordCompliance(documentId, actor, dto);
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

  private async sendTrackedCsv(
    actor: RequestUser,
    query: ReportQueryDto,
    exportType: GstReportExportType,
    filename: string,
    csv: string,
    res: Response,
  ) {
    await this.recordExport(actor, query, exportType, filename, "text/csv", csv, Math.max(0, csv.split("\n").length - 1));
    this.sendCsv(res, filename, csv);
  }

  private recordExport(
    actor: RequestUser,
    query: ReportQueryDto,
    exportType: GstReportExportType,
    fileName: string,
    contentType: string,
    content: string,
    rowCount: number,
  ) {
    return this.gstCompliance.recordExport({
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
