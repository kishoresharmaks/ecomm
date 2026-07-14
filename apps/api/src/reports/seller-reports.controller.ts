import { Controller, Get, Inject, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Seller Reports")
@Roles(RoleCode.SELLER)
@Controller("seller/reports")
export class SellerReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

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
      ["Payout Number", "Period From", "Period To", "Status", `Gross Sales (${currency})`, `Net Payable (${currency})`],
      ...data.recentPayouts.map((p) => [
        p.payoutNumber,
        new Date(p.periodFrom).toLocaleDateString("en-IN"),
        new Date(p.periodTo).toLocaleDateString("en-IN"),
        p.status,
        String((p.grossSalesPaise ?? 0) / 100),
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
}
