"use client";

import Link from "next/link";
import { BarChart3, Boxes, Building2, FileClock, ReceiptText, Store, UsersRound } from "lucide-react";
import { Button } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { OperationalReportWorkspace, type ReportMetric } from "@/components/reporting/reporting-workspace";
import { ReportExportCenter } from "@/components/reporting/report-export-center";
import type { ReportExportType } from "@/lib/report-exports-api";

const adminReportTypes: Array<{ value: ReportExportType; label: string }> = [
  { value: "ADMIN_SALES", label: "Sales and order lines" },
  { value: "ADMIN_SELLERS", label: "Seller performance" },
  { value: "ADMIN_PRODUCTS", label: "Products and inventory" },
  { value: "ADMIN_ENQUIRIES", label: "Enquiries and support" },
  { value: "GSTR1_REVIEW_SELLER_XLSX", label: "GSTR-1 seller review workbook" },
  { value: "GSTR1_REVIEW_ALL_SELLERS_ZIP", label: "GSTR-1 all-seller workbook ZIP" },
  { value: "GSTR1_REVIEW_PLATFORM_XLSX", label: "GSTR-1 platform review workbook" },
];

const reportConfig = {
  sales: {
    endpoint: "/api/admin/reports/sales",
    exportType: "ADMIN_SALES" as const,
    searchPlaceholder: "Order, customer, seller, product or SKU",
    statuses: ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    metrics: (data: Record<string, unknown>) => {
      const summary = data.summary as Record<string, number> | undefined;
      return [
        metric("Orders", summary?.orderCount ?? 0, "Non-cancelled orders"),
        metric("Order value", money(summary?.totalPaise), "Gross order total"),
        metric("Merchandise", money(summary?.subtotalPaise), "Before shipping and fees"),
        metric("Shipping", money(summary?.shippingPaise), "Buyer shipping charges"),
      ];
    },
  },
  sellers: {
    endpoint: "/api/admin/reports/sellers",
    exportType: "ADMIN_SELLERS" as const,
    searchPlaceholder: "Seller, legal name, email, GSTIN or PAN",
    statuses: ["APPROVED", "PENDING_APPROVAL", "SUSPENDED", "REJECTED"],
    metrics: (data: Record<string, unknown>) => {
      const summary = data.summary as Record<string, number> | undefined;
      return [
        metric("Approved sellers", summary?.approvedSellers ?? 0, "Ready to trade"),
        metric("Pending approval", summary?.pendingSellers ?? 0, "Awaiting marketplace review"),
      ];
    },
  },
  products: {
    endpoint: "/api/admin/reports/products",
    exportType: "ADMIN_PRODUCTS" as const,
    searchPlaceholder: "Product, SKU, seller, category or HSN",
    statuses: ["ACTIVE", "DRAFT", "INACTIVE", "ARCHIVED", "PENDING_APPROVAL", "REJECTED"],
    metrics: (data: Record<string, unknown>) => {
      const summary = data.summary as Record<string, number> | undefined;
      const lowStock = Array.isArray(data.lowStockProducts) ? data.lowStockProducts.length : 0;
      return [
        metric("Active products", summary?.activeProducts ?? 0, "Published catalogue"),
        metric("Pending products", summary?.pendingProducts ?? 0, "Awaiting approval"),
        metric("Low-stock variants", lowStock, "Stock at five units or below"),
      ];
    },
  },
  enquiries: {
    endpoint: "/api/admin/reports/enquiries",
    exportType: "ADMIN_ENQUIRIES" as const,
    searchPlaceholder: "Reference, requester, seller, topic or order",
    statuses: ["OPEN", "IN_PROGRESS", "RESPONDED", "RESOLVED", "CLOSED", "CANCELLED"],
    metrics: (data: Record<string, unknown>) => {
      const b2b = Array.isArray(data.b2bByStatus) ? data.b2bByStatus : [];
      const support = Array.isArray(data.supportByStatus) ? data.supportByStatus : [];
      const sum = (items: unknown[]) => items.reduce<number>((total, item) => total + Number((item as { _count?: number })._count ?? 0), 0);
      return [
        metric("B2B enquiries", sum(b2b), "Procurement requests"),
        metric("Support cases", sum(support), "Customer and marketplace cases"),
      ];
    },
  },
};

export function AdminOperationalReportClient({ report }: { report: keyof typeof reportConfig }) {
  const auth = useAdminAuth();
  const config = reportConfig[report];
  return (
    <OperationalReportWorkspace
      auth={auth.authHeaders}
      endpoint={config.endpoint}
      exportType={config.exportType}
      audience="admin"
      exportsHref="/admin/reports/exports"
      searchPlaceholder={config.searchPlaceholder}
      statusOptions={config.statuses.map((status) => ({ value: status, label: humanize(status) }))}
      metrics={(data) => config.metrics(data)}
    />
  );
}

export function AdminReportExportsClient() {
  const auth = useAdminAuth();
  return <ReportExportCenter auth={auth.authHeaders} audience="admin" reportTypes={adminReportTypes} />;
}

export function AdminReportsOverviewClient() {
  const reports = [
    { title: "Sales and orders", description: "Line-level order, payment, seller, invoice, HSN and GST values.", href: "/admin/reports/sales", icon: BarChart3 },
    { title: "Seller performance", description: "Seller identity, approval, sales, deductions, payouts and GST registration.", href: "/admin/reports/sellers", icon: Store },
    { title: "Products and inventory", description: "Variants, HSN, tax classification, stock, units sold, sales and returns.", href: "/admin/reports/products", icon: Boxes },
    { title: "Enquiries and support", description: "B2B procurement enquiries and support cases in one operational register.", href: "/admin/reports/enquiries", icon: UsersRound },
    { title: "GST reports", description: "GST documents, HSN summaries, filing exports and compliance controls.", href: "/admin/finance/gst-reports", icon: ReceiptText },
    { title: "Order tax register", description: "Issued tax-document truth, fallback snapshots and reconciliation warnings.", href: "/admin/reports/order-tax-register", icon: Building2 },
  ];
  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 border-y border-[#E5E7EB] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-[#1F2933]">Marketplace reporting center</p>
          <p className="text-sm font-semibold text-[#667085]">Open a live register or manage generated CSV files.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/reports/exports"><FileClock className="h-4 w-4" aria-hidden="true" />Export history</Link>
        </Button>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(({ icon: Icon, ...report }) => (
          <Link key={report.href} href={report.href} className="group border-l-4 border-[#163B5C] bg-white p-5 shadow-sm transition hover:border-[#ED3500] hover:shadow-md">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-black text-[#1F2933] group-hover:text-[#C72D00]">{report.title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{report.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

function metric(label: string, value: string | number, note: string): ReportMetric {
  return { label, value, note };
}

function money(value = 0) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value / 100);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
