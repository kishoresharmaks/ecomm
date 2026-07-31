"use client";

import Link from "next/link";
import { type FormEvent, useDeferredValue, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileCheck2,
  FilePenLine,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
  Settings,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminActionMenu, AdminListbox, type AdminSelectOption, AdminTabs } from "@/components/admin/admin-ux";
import { FinanceMetric, FinancePanel, FinanceState } from "@/components/admin/finance/finance-ui";
import { GstDocumentDetailsDrawer } from "@/components/shared/gst-document-details-drawer";
import { Gstr1ReviewExportPanel } from "@/components/reporting/gstr1-review-export-panel";
import { SideDrawer } from "@/components/shared/side-drawer";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  downloadAdminGstReportCsv,
  downloadAdminGstDocumentPdf,
  getAdminGstDocuments,
  getAdminGstFilingPeriods,
  getAdminGstOverview,
  getAdminGstSellerOptions,
  manualEInvoiceValidationError,
  recordAdminManualEInvoice,
  type ManualEInvoiceInput,
  type GstComplianceStatus,
  type GstCsvExport,
  type GstDocumentFilters,
  type GstDocumentPage,
  type GstFilingPeriod,
  type GstReportOverview,
  type GstReportDocument,
  type GstrSupplySection,
  type ProductTaxClassification,
  type SellerTaxRegistrationStatus,
} from "@/lib/gst-report-api";
import { formatMoney } from "@/lib/storefront-api";

const gstDocumentTypes = [
  { value: "", label: "All document types" },
  { value: "TAX_INVOICE", label: "Tax invoices" },
  { value: "BILL_OF_SUPPLY", label: "Bills of supply" },
  { value: "COMMERCIAL_INVOICE", label: "Commercial invoices" },
  { value: "CREDIT_NOTE", label: "Credit notes" },
  { value: "DEBIT_NOTE", label: "Debit notes" },
] satisfies AdminSelectOption[];

const sellerTaxRegistrationStatuses = [
  { value: "", label: "All registration statuses" },
  { value: "GST_REGISTERED", label: "Regular GST registered" },
  { value: "COMPOSITION", label: "Composition scheme" },
  { value: "NOT_REGISTERED", label: "Not GST registered" },
] satisfies AdminSelectOption[];

const productTaxClassifications = [
  { value: "", label: "All supply classifications" },
  { value: "TAXABLE", label: "Taxable" },
  { value: "NIL_RATED", label: "Nil-rated" },
  { value: "EXEMPT", label: "Exempt" },
  { value: "NON_GST", label: "Non-GST" },
] satisfies AdminSelectOption[];

const gstSections = [
  { value: "", label: "All GSTR sections" },
  { value: "B2B", label: "B2B" },
  { value: "B2CL", label: "B2CL" },
  { value: "B2CS", label: "B2CS" },
  { value: "CDNR", label: "CDNR" },
  { value: "CDNUR", label: "CDNUR" },
  { value: "EXPORT", label: "Export" },
  { value: "SEZ", label: "SEZ" },
  { value: "NIL_EXEMPT_NON_GST", label: "Nil / exempt / non-GST" },
] satisfies AdminSelectOption[];

const complianceStatuses = [
  { value: "", label: "All statuses" },
  { value: "READY", label: "Ready" },
  { value: "PENDING", label: "Pending" },
  { value: "GENERATED", label: "Generated" },
  { value: "FAILED", label: "Failed" },
  { value: "NOT_REQUIRED", label: "Not required" },
] satisfies AdminSelectOption[];

const exports: Array<[string, GstCsvExport, typeof FileSpreadsheet]> = [
  ["GST document register", "gst-register", FileSpreadsheet],
  ["HSN summary", "hsn-summary", FileSpreadsheet],
  ["GSTR-1-oriented CSV", "gstr-1", FileSpreadsheet],
  ["GSTR-1 JSON package", "gstr-1-json", FileCheck2],
  ["GSTR-3B summary", "gstr-3b", FileSpreadsheet],
  ["Marketplace GSTR-8 / TCS", "gstr-8", FileSpreadsheet],
  ["Document series", "document-series", FileSpreadsheet],
  ["Rate liability", "rate-liability", FileSpreadsheet],
  ["State liability", "state-liability", FileSpreadsheet],
  ["GSTIN summary", "gstin-summary", FileSpreadsheet],
  ["Reconciliation", "reconciliation", FileCheck2],
  ["Platform commission GST", "platform-commission", FileSpreadsheet],
  ["E-invoice status", "e-invoice", FileCheck2],
  ["E-way bill status", "e-way-bill", FileCheck2],
];

const manualEInvoiceFieldClass =
  "min-h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70";

export function AdminGstReportsClient() {
  const auth = useAdminAuth();
  const isAdmin = auth.user?.roles.includes("ADMIN") ?? false;
  const [dateFrom, setDateFrom] = useState(defaultMonthStart());
  const [dateTo, setDateTo] = useState(defaultDate());
  const [sellerId, setSellerId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [section, setSection] = useState("");
  const [sellerTaxRegistrationStatus, setSellerTaxRegistrationStatus] = useState("");
  const [taxClassification, setTaxClassification] = useState("");
  const [search, setSearch] = useState("");
  const [eInvoiceStatus, setEInvoiceStatus] = useState("");
  const [eWayBillStatus, setEWayBillStatus] = useState("");
  const [registerPage, setRegisterPage] = useState(1);
  const [compliancePage, setCompliancePage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const overviewQueryString = useMemo(
    () => buildQuery({ dateFrom: startOfDay(dateFrom), dateTo: endOfDay(dateTo), sellerId }),
    [dateFrom, dateTo, sellerId],
  );
  const overview = useQuery({
    queryKey: ["admin-finance-gst-overview", auth.authHeaders, overviewQueryString],
    enabled: auth.isAuthenticated,
    queryFn: () => getAdminGstOverview(auth.authHeaders, overviewQueryString),
  });
  const sellers = useQuery({
    queryKey: ["admin-finance-gst-sellers", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () => getAdminGstSellerOptions(auth.authHeaders),
  });
  const registerFilters = useMemo<GstDocumentFilters>(
    () => ({
      page: registerPage,
      limit: 25,
      dateFrom: startOfDay(dateFrom),
      dateTo: endOfDay(dateTo),
      sellerId: sellerId || undefined,
      documentType: documentType
        ? (documentType as GstDocumentFilters["documentType"])
        : undefined,
      sellerTaxRegistrationStatus: sellerTaxRegistrationStatus
        ? (sellerTaxRegistrationStatus as SellerTaxRegistrationStatus)
        : undefined,
      section: section ? (section as GstrSupplySection) : undefined,
      taxClassification: taxClassification
        ? (taxClassification as ProductTaxClassification)
        : undefined,
      search: deferredSearch || undefined,
    }),
    [
      dateFrom,
      dateTo,
      deferredSearch,
      documentType,
      registerPage,
      section,
      sellerId,
      sellerTaxRegistrationStatus,
      taxClassification,
    ],
  );
  const documents = useQuery({
    queryKey: ["admin-finance-gst-documents", auth.authHeaders, registerFilters],
    enabled: auth.isAuthenticated,
    queryFn: () => getAdminGstDocuments(auth.authHeaders, registerFilters),
  });
  const complianceDocuments = useQuery({
    queryKey: [
      "admin-finance-gst-compliance",
      auth.authHeaders,
      dateFrom,
      dateTo,
      sellerId,
      compliancePage,
      eInvoiceStatus,
      eWayBillStatus,
    ],
    enabled: auth.isAuthenticated,
    queryFn: () =>
      getAdminGstDocuments(auth.authHeaders, {
        page: compliancePage,
        limit: 25,
        dateFrom: startOfDay(dateFrom),
        dateTo: endOfDay(dateTo),
        sellerId: sellerId || undefined,
        eInvoiceStatus: eInvoiceStatus
          ? (eInvoiceStatus as GstComplianceStatus)
          : undefined,
        eWayBillStatus: eWayBillStatus
          ? (eWayBillStatus as GstComplianceStatus)
          : undefined,
      }),
  });
  const gstExport = useMutation({
    mutationFn: (type: GstCsvExport) =>
      downloadAdminGstReportCsv(auth.authHeaders, type, overviewQueryString),
  });
  const [filingSellerId, setFilingSellerId] = useState("");
  const filingPeriods = useQuery({
    queryKey: ["admin-finance-gst-filing-periods", auth.authHeaders, filingSellerId],
    enabled: auth.isAuthenticated && isAdmin && Boolean(filingSellerId),
    queryFn: () => getAdminGstFilingPeriods(auth.authHeaders, filingSellerId),
  });

  const sellerOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "All sellers" },
      ...(sellers.data ?? []).map((seller) => ({
        value: seller.id,
        label: seller.storeName,
      })),
    ],
    [sellers.data],
  );
  const filingSellerOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select seller" },
      ...(sellers.data ?? []).map((seller) => ({
        value: seller.id,
        label: seller.storeName,
      })),
    ],
    [sellers.data],
  );

  function resetFilters() {
    setDateFrom(defaultMonthStart());
    setDateTo(defaultDate());
    setSellerId("");
    setDocumentType("");
    setSection("");
    setSellerTaxRegistrationStatus("");
    setTaxClassification("");
    setSearch("");
    setEInvoiceStatus("");
    setEWayBillStatus("");
    setRegisterPage(1);
    setCompliancePage(1);
  }

  const filterCount = [
    sellerId,
    documentType,
    section,
    sellerTaxRegistrationStatus,
    taxClassification,
    search.trim(),
    eInvoiceStatus,
    eWayBillStatus,
  ].filter(Boolean).length;

  return (
    <div className="grid gap-5">
      <FinancePanel>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <FileCheck2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-black text-[#1F2933]">GST compliance workspace</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  Complete selected-period summaries with a separately paginated document register.
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              Prepare and monitor GST data, returns, GSTR-8 filings, IRNs, and reconciliation.
              e-way bills remain external filing or provider operations until the corresponding
              integration is activated.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetFilters}>
              Reset filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void overview.refetch();
                void documents.refetch();
                void complianceDocuments.refetch();
              }}
              disabled={overview.isFetching}
            >
              <RefreshCw className={overview.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
              Refresh
            </Button>
            <AdminActionMenu
              label="Export"
              items={exports.map(([label, type, Icon]) => ({
                label,
                icon: <Icon className="h-4 w-4" aria-hidden="true" />,
                disabled: gstExport.isPending || !overview.data,
                onSelect: () => gstExport.mutate(type),
              }))}
            />
          </div>
        </div>
        <div
          className="mt-5 grid gap-3 border-t border-[#E5E7EB] pt-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1.4fr_auto]"
        >
          <DateField label="From" value={dateFrom} onChange={(value) => { setDateFrom(value); setRegisterPage(1); setCompliancePage(1); }} />
          <DateField label="To" value={dateTo} onChange={(value) => { setDateTo(value); setRegisterPage(1); setCompliancePage(1); }} />
          <AdminListbox label="Seller" value={sellerId} options={sellerOptions} onChange={(value) => { setSellerId(value); setRegisterPage(1); setCompliancePage(1); }} />
          <label className="space-y-2">
            <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Document search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setRegisterPage(1); }}
                placeholder="Number, order, seller, buyer, GSTIN"
                className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </div>
          </label>
          <div className="flex items-end">
            <StatusBadge tone={filterCount ? "warning" : "info"}>
              {filterCount ? `${filterCount} filters active` : "All sellers"}
            </StatusBadge>
          </div>
        </div>
        {gstExport.error ? (
          <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">
            {gstExport.error instanceof Error ? gstExport.error.message : "GST export failed."}
          </p>
        ) : null}
      </FinancePanel>

      <Gstr1ReviewExportPanel
        auth={auth.authHeaders}
        audience={isAdmin ? "admin" : "finance"}
        sellers={sellers.data ?? []}
        sellersLoading={sellers.isLoading}
      />

      <FinanceState loading={overview.isLoading} error={overview.error} onRetry={() => void overview.refetch()} />
      {overview.data ? (
        <GstWorkspace
          overview={overview.data}
          isAdmin={isAdmin}
          documents={documents.data}
          documentsLoading={documents.isLoading}
          documentsError={documents.error}
          registerPage={registerPage}
          onRegisterPageChange={setRegisterPage}
          documentType={documentType}
          section={section}
          sellerTaxRegistrationStatus={sellerTaxRegistrationStatus}
          taxClassification={taxClassification}
          onDocumentTypeChange={(value) => { setDocumentType(value); setRegisterPage(1); }}
          onSectionChange={(value) => { setSection(value); setRegisterPage(1); }}
          onSellerTaxRegistrationStatusChange={(value) => {
            setSellerTaxRegistrationStatus(value);
            setRegisterPage(1);
          }}
          onTaxClassificationChange={(value) => {
            setTaxClassification(value);
            setRegisterPage(1);
          }}
          complianceDocuments={complianceDocuments.data}
          complianceLoading={complianceDocuments.isLoading}
          complianceError={complianceDocuments.error}
          compliancePage={compliancePage}
          onCompliancePageChange={setCompliancePage}
          eInvoiceStatus={eInvoiceStatus}
          eWayBillStatus={eWayBillStatus}
          onEInvoiceStatusChange={(value) => { setEInvoiceStatus(value); setCompliancePage(1); }}
          onEWayBillStatusChange={(value) => { setEWayBillStatus(value); setCompliancePage(1); }}
          filingSellerId={filingSellerId}
          onFilingSellerChange={setFilingSellerId}
          filingSellerOptions={filingSellerOptions}
          filingPeriods={filingPeriods.data ?? []}
          filingLoading={filingPeriods.isLoading}
          filingError={filingPeriods.error}
        />
      ) : null}
    </div>
  );
}

function GstWorkspace({
  overview,
  isAdmin,
  documents,
  documentsLoading,
  documentsError,
  registerPage,
  onRegisterPageChange,
  documentType,
  section,
  sellerTaxRegistrationStatus,
  taxClassification,
  onDocumentTypeChange,
  onSectionChange,
  onSellerTaxRegistrationStatusChange,
  onTaxClassificationChange,
  complianceDocuments,
  complianceLoading,
  complianceError,
  compliancePage,
  onCompliancePageChange,
  eInvoiceStatus,
  eWayBillStatus,
  onEInvoiceStatusChange,
  onEWayBillStatusChange,
  filingSellerId,
  onFilingSellerChange,
  filingSellerOptions,
  filingPeriods,
  filingLoading,
  filingError,
}: {
  overview: GstReportOverview;
  isAdmin: boolean;
  documents: GstDocumentPage | undefined;
  documentsLoading: boolean;
  documentsError: unknown;
  registerPage: number;
  onRegisterPageChange: (page: number) => void;
  documentType: string;
  section: string;
  sellerTaxRegistrationStatus: string;
  taxClassification: string;
  onDocumentTypeChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onSellerTaxRegistrationStatusChange: (value: string) => void;
  onTaxClassificationChange: (value: string) => void;
  complianceDocuments: GstDocumentPage | undefined;
  complianceLoading: boolean;
  complianceError: unknown;
  compliancePage: number;
  onCompliancePageChange: (page: number) => void;
  eInvoiceStatus: string;
  eWayBillStatus: string;
  onEInvoiceStatusChange: (value: string) => void;
  onEWayBillStatusChange: (value: string) => void;
  filingSellerId: string;
  onFilingSellerChange: (value: string) => void;
  filingSellerOptions: AdminSelectOption[];
  filingPeriods: GstFilingPeriod[];
  filingLoading: boolean;
  filingError: unknown;
}) {
  const creditDebitCount = overview.summary.creditNoteCount + overview.summary.debitNoteCount;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Issued documents" value={overview.summary.documentCount.toLocaleString("en-IN")} note={`${overview.documentTotal.toLocaleString("en-IN")} in selected period`} />
        <FinanceMetric label="Taxable value" value={formatMoney(overview.summary.taxableValuePaise)} note="Net of credit notes" />
        <FinanceMetric label="GST liability" value={formatMoney(overview.summary.totalTaxPaise)} note={`CGST ${formatMoney(overview.summary.cgstPaise)} / IGST ${formatMoney(overview.summary.igstPaise)}`} />
        <FinanceMetric label="Credits and debits" value={creditDebitCount} note={`${overview.summary.creditNoteCount} credit / ${overview.summary.debitNoteCount} debit`} />
        <FinanceMetric label="Marketplace TCS" value={formatMoney(overview.tcs.summary.totalTcsPaise)} note={`${overview.tcs.summary.sellerCount} sellers`} />
        <FinanceMetric label="Platform GST" value={formatMoney(overview.platformCommission.summary.totalTaxPaise)} note={`${overview.platformCommission.summary.documentCount} documents`} />
        <FinanceMetric label="Reconciliation errors" value={overview.reconciliation.errorCount} note={overview.reconciliation.readyToLock ? "Ready to lock" : "Action required"} />
        <FinanceMetric label="Provider readiness" value={overview.providerReadiness.eInvoice.mode === "MANUAL" && overview.providerReadiness.eWayBill.mode === "MANUAL" ? "Manual" : "Configured"} note="No automatic submission implied" />
      </div>

      <AdminTabs
        className="mt-1"
        tabs={[
          {
            key: "summary",
            label: "Summary",
            panel: <SummaryTab overview={overview} canConfigure={isAdmin} />,
          },
          {
            key: "register",
            label: "Document register",
            badge: overview.summary.documentCount,
            panel: (
              <DocumentRegister
                data={documents}
                loading={documentsLoading}
                error={documentsError}
                page={registerPage}
                onPageChange={onRegisterPageChange}
                documentType={documentType}
                section={section}
                sellerTaxRegistrationStatus={sellerTaxRegistrationStatus}
                taxClassification={taxClassification}
                onDocumentTypeChange={onDocumentTypeChange}
                onSectionChange={onSectionChange}
                onSellerTaxRegistrationStatusChange={onSellerTaxRegistrationStatusChange}
                onTaxClassificationChange={onTaxClassificationChange}
              />
            ),
          },
          {
            key: "liability",
            label: "HSN and liability",
            panel: <LiabilityTab overview={overview} />,
          },
          {
            key: "tcs",
            label: "TCS / commission",
            panel: <TcsTab overview={overview} />,
          },
          {
            key: "reconciliation",
            label: "Reconciliation",
            badge: overview.reconciliation.issueCount,
            panel: <ReconciliationTab overview={overview} />,
          },
          {
            key: "compliance",
            label: "E-invoice / e-way",
            panel: (
              <ComplianceTab
                data={complianceDocuments}
                loading={complianceLoading}
                error={complianceError}
                page={compliancePage}
                onPageChange={onCompliancePageChange}
                eInvoiceStatus={eInvoiceStatus}
                eWayBillStatus={eWayBillStatus}
                onEInvoiceStatusChange={onEInvoiceStatusChange}
                onEWayBillStatusChange={onEWayBillStatusChange}
              />
            ),
          },
          ...(isAdmin
            ? [
                {
                  key: "filing",
                  label: "Filing oversight",
                  panel: (
                    <FilingTab
                      options={filingSellerOptions}
                      sellerId={filingSellerId}
                      onSellerChange={onFilingSellerChange}
                      periods={filingPeriods}
                      loading={filingLoading}
                      error={filingError}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

function SummaryTab({
  overview,
  canConfigure,
}: {
  overview: GstReportOverview;
  canConfigure: boolean;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <FinancePanel>
          <PanelHeading title="GSTR section summary" description="Outward-supply classification for the selected period." />
          <SimpleTable
            rows={overview.sections}
            empty="No GSTR sections in this period."
            columns={[
              ["Section", (row) => <StatusBadge tone="info">{row.section}</StatusBadge>],
              ["Documents", (row) => row.documentCount.toLocaleString("en-IN")],
              ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
              ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
            ]}
            getKey={(row) => row.section}
          />
        </FinancePanel>
        <FinancePanel>
          <PanelHeading title="GSTR-3B outward liability" description={overview.gstr3b.sourceNote} />
          <div className="grid gap-2">
            {[
              ["Outward taxable", overview.gstr3b.table3_1.outwardTaxable.totalTaxPaise, overview.gstr3b.table3_1.outwardTaxable.taxableValuePaise],
              ["Zero rated", overview.gstr3b.table3_1.zeroRated.totalTaxPaise, overview.gstr3b.table3_1.zeroRated.taxableValuePaise],
              ["Nil / exempt", overview.gstr3b.table3_1.nilExempt.totalTaxPaise, overview.gstr3b.table3_1.nilExempt.taxableValuePaise],
              ["Reverse charge", overview.gstr3b.table3_1.inwardReverseCharge.totalTaxPaise, overview.gstr3b.table3_1.inwardReverseCharge.taxableValuePaise],
              ["Non-GST", overview.gstr3b.table3_1.nonGst.totalTaxPaise, overview.gstr3b.table3_1.nonGst.taxableValuePaise],
            ].map(([label, tax, taxable]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] py-2 last:border-0">
                <span className="text-sm font-bold text-[#667085]">{label}</span>
                <span className="text-right text-sm font-black text-[#1F2933]">{formatMoney(Number(tax))}<span className="ml-2 text-xs font-semibold text-[#98A2B3]">{formatMoney(Number(taxable))} taxable</span></span>
              </div>
            ))}
          </div>
        </FinancePanel>
      </div>
      <FinancePanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeading title="Provider readiness" description="Configured status only. This does not submit returns or generate government identifiers." />
          {canConfigure ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/settings/tax-gst">
                <Settings className="h-4 w-4" aria-hidden="true" />
                Configure GST
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ReadinessRow label="E-invoice / IRN" enabled={overview.providerReadiness.eInvoice.enabled} mode={overview.providerReadiness.eInvoice.mode} provider={overview.providerReadiness.eInvoice.provider} credentials={overview.providerReadiness.eInvoice.credentialsConfigured} />
          <ReadinessRow label="E-way bill" enabled={overview.providerReadiness.eWayBill.enabled} mode={overview.providerReadiness.eWayBill.mode} provider={overview.providerReadiness.eWayBill.provider} credentials={overview.providerReadiness.eWayBill.credentialsConfigured} />
          <ReadinessRow label="Platform GST identity" enabled={overview.providerReadiness.platformInvoice.configured} mode={overview.providerReadiness.platformInvoice.configured ? "Configured" : "Action required"} provider="Marketplace commission invoices" credentials={overview.providerReadiness.platformInvoice.configured} />
        </div>
      </FinancePanel>
    </div>
  );
}

function LiabilityTab({ overview }: { overview: GstReportOverview }) {
  return (
    <div className="grid gap-5">
      <ClientPagedSection title="HSN summary" rows={overview.hsnSummary} pageSize={10} getKey={(row) => `${row.hsnSacCode}-${row.gstRatePercent}-${row.uqc}`} columns={[
        ["HSN / SAC", (row) => <strong>{row.hsnSacCode}</strong>],
        ["Description", (row) => row.description],
        ["Qty", (row) => `${row.quantity.toLocaleString("en-IN")} ${row.uqc}`],
        ["Rate", (row) => `${row.gstRatePercent}%`],
        ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
        ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
      ]} />
      <div className="grid gap-5 xl:grid-cols-2">
        <ClientPagedSection title="Rate liability" rows={overview.rateLiability} pageSize={8} getKey={(row) => String(row.gstRatePercent)} columns={[
          ["Rate", (row) => `${row.gstRatePercent}%`],
          ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
          ["CGST", (row) => formatMoney(row.cgstPaise)],
          ["SGST", (row) => formatMoney(row.sgstPaise)],
          ["IGST", (row) => formatMoney(row.igstPaise)],
          ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
        ]} />
        <ClientPagedSection title="State liability" rows={overview.stateLiability} pageSize={8} getKey={(row) => row.placeOfSupplyStateCode} columns={[
          ["Place of supply", (row) => row.placeOfSupplyStateCode],
          ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
          ["CGST", (row) => formatMoney(row.cgstPaise)],
          ["SGST", (row) => formatMoney(row.sgstPaise)],
          ["IGST", (row) => formatMoney(row.igstPaise)],
          ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
        ]} />
      </div>
      <ClientPagedSection title="B2B recipient GSTIN summary" rows={overview.gstinSummary} pageSize={8} getKey={(row) => row.buyerGstin} columns={[
        ["Recipient", (row) => <span><strong>{row.buyerGstin}</strong><span className="block text-xs font-semibold text-[#667085]">{row.buyerLegalName}</span></span>],
        ["Documents", (row) => row.documentCount],
        ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
        ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
      ]} />
      <ClientPagedSection title="Document series" rows={overview.documentSeries} pageSize={8} getKey={(row) => `${row.documentType}-${row.financialYear}`} columns={[
        ["Type", (row) => humanize(row.documentType)],
        ["Financial year", (row) => row.financialYear],
        ["Range", (row) => `${row.fromNumber ?? "-"} to ${row.toNumber ?? "-"}`],
        ["Issued", (row) => row.issuedCount],
        ["Cancelled", (row) => row.cancelledCount],
        ["Net", (row) => <strong>{row.netIssuedCount}</strong>],
      ]} />
    </div>
  );
}

function TcsTab({ overview }: { overview: GstReportOverview }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FinanceMetric label="Gross supplies" value={formatMoney(overview.tcs.summary.grossSuppliesPaise)} />
        <FinanceMetric label="Returns" value={formatMoney(overview.tcs.summary.returnsPaise)} />
        <FinanceMetric label="Net supplies" value={formatMoney(overview.tcs.summary.netSuppliesPaise)} />
        <FinanceMetric label="Total TCS" value={formatMoney(overview.tcs.summary.totalTcsPaise)} />
        <FinanceMetric label="Sellers" value={overview.tcs.summary.sellerCount} />
      </div>
      <ClientPagedSection title="Seller TCS credit statement" description="Marketplace TCS is separate from seller outward-supply GST." rows={overview.tcs.statements} pageSize={10} getKey={(row) => row.sellerId} columns={[
        ["Seller", (row) => <span><strong>{row.sellerName}</strong><span className="block text-xs font-semibold text-[#667085]">{row.sellerGstin ?? "Unregistered"}</span></span>],
        ["Transactions", (row) => row.transactionCount],
        ["Net supplies", (row) => formatMoney(row.netSuppliesPaise)],
        ["IGST TCS", (row) => formatMoney(row.igstPaise)],
        ["CGST + SGST", (row) => formatMoney(row.cgstPaise + row.sgstPaise)],
        ["Total TCS", (row) => <strong>{formatMoney(row.totalTcsPaise)}</strong>],
      ]} />
      <ClientPagedSection title="Platform commission GST" description={overview.platformCommission.configured ? "GST documents issued for platform commission and services." : `Configuration required: ${overview.platformCommission.missingConfiguration.join(", ") || "platform GST identity"}.`} rows={overview.platformCommission.documents} pageSize={10} getKey={(row) => row.id} columns={[
        ["Document", (row) => <span><strong>{row.documentNumber}</strong><span className="block text-xs font-semibold text-[#667085]">{formatDate(row.issueDate)}</span></span>],
        ["Recipient", (row) => <span><strong>{row.recipientLegalName}</strong><span className="block text-xs font-semibold text-[#667085]">{row.recipientGstin ?? "Unregistered"}</span></span>],
        ["Taxable", (row) => formatMoney(row.taxableValuePaise)],
        ["GST", (row) => <strong>{formatMoney(row.totalTaxPaise)}</strong>],
        ["Invoice value", (row) => formatMoney(row.invoiceValuePaise)],
      ]} />
    </div>
  );
}

function ReconciliationTab({ overview }: { overview: GstReportOverview }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceMetric label="Findings" value={overview.reconciliation.issueCount} />
        <FinanceMetric label="Errors" value={overview.reconciliation.errorCount} note="Blocks period lock" />
        <FinanceMetric label="Warnings" value={overview.reconciliation.warningCount} note={overview.reconciliation.readyToLock ? "No blocking errors" : "Review before lock"} />
      </div>
      <FinancePanel>
        <PanelHeading title="Reconciliation findings" description="Compare books, filing-oriented output, classifications, and document controls." />
        <ClientPagedSectionContent rows={overview.reconciliation.issues} pageSize={12} getKey={(row, index) => `${row.code}-${row.documentId ?? index}`} columns={[
          ["Severity", (row) => <StatusBadge tone={row.severity === "ERROR" ? "danger" : row.severity === "WARNING" ? "warning" : "info"}>{row.severity}</StatusBadge>],
          ["Code", (row) => <strong>{row.code}</strong>],
          ["Document", (row) => row.documentNumber ?? "Period-level"],
          ["Finding", (row) => row.message],
        ]} />
      </FinancePanel>
    </div>
  );
}

function DocumentRegister({
  data,
  loading,
  error,
  page,
  onPageChange,
  documentType,
  section,
  sellerTaxRegistrationStatus,
  taxClassification,
  onDocumentTypeChange,
  onSectionChange,
  onSellerTaxRegistrationStatusChange,
  onTaxClassificationChange,
}: {
  data: GstDocumentPage | undefined;
  loading: boolean;
  error: unknown;
  page: number;
  onPageChange: (page: number) => void;
  documentType: string;
  section: string;
  sellerTaxRegistrationStatus: string;
  taxClassification: string;
  onDocumentTypeChange: (value: string) => void;
  onSectionChange: (value: string) => void;
  onSellerTaxRegistrationStatusChange: (value: string) => void;
  onTaxClassificationChange: (value: string) => void;
}) {
  return (
    <FinancePanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PanelHeading title="Issued GST document register" description="Server-side pagination keeps this table complete without loading every document into the browser." />
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[min(46rem,100%)]">
          <AdminListbox label="Document type" value={documentType} options={gstDocumentTypes} onChange={onDocumentTypeChange} compact buttonClassName="bg-white" />
          <AdminListbox label="GSTR section" value={section} options={gstSections} onChange={onSectionChange} compact buttonClassName="bg-white" />
          <AdminListbox
            label="Seller registration"
            value={sellerTaxRegistrationStatus}
            options={sellerTaxRegistrationStatuses}
            onChange={onSellerTaxRegistrationStatusChange}
            compact
            buttonClassName="bg-white"
          />
          <AdminListbox
            label="Supply classification"
            value={taxClassification}
            options={productTaxClassifications}
            onChange={onTaxClassificationChange}
            compact
            buttonClassName="bg-white"
          />
        </div>
      </div>
      <div className="mt-5">
        {loading || error ? <FinanceState loading={loading} error={error} /> : null}
        {!loading && !error ? (
          <DocumentTable data={data} page={page} onPageChange={onPageChange} />
        ) : null}
      </div>
    </FinancePanel>
  );
}

function ComplianceTab({
  data,
  loading,
  error,
  page,
  onPageChange,
  eInvoiceStatus,
  eWayBillStatus,
  onEInvoiceStatusChange,
  onEWayBillStatusChange,
}: {
  data: GstDocumentPage | undefined;
  loading: boolean;
  error: unknown;
  page: number;
  onPageChange: (page: number) => void;
  eInvoiceStatus: string;
  eWayBillStatus: string;
  onEInvoiceStatusChange: (value: string) => void;
  onEWayBillStatusChange: (value: string) => void;
}) {
  return (
    <FinancePanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PanelHeading title="E-invoice and e-way bill status register" description="Review readiness, provider results, identifiers, and errors recorded against issued documents." />
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[min(34rem,100%)]">
          <AdminListbox label="E-invoice status" value={eInvoiceStatus} options={complianceStatuses} onChange={onEInvoiceStatusChange} compact buttonClassName="bg-white" />
          <AdminListbox label="E-way status" value={eWayBillStatus} options={complianceStatuses} onChange={onEWayBillStatusChange} compact buttonClassName="bg-white" />
        </div>
      </div>
      <div className="mt-5">
        {loading || error ? <FinanceState loading={loading} error={error} /> : null}
        {!loading && !error ? (
          <DocumentTable data={data} page={page} onPageChange={onPageChange} compliance />
        ) : null}
      </div>
    </FinancePanel>
  );
}

function DocumentTable({ data, page, onPageChange, compliance = false }: { data: GstDocumentPage | undefined; page: number; onPageChange: (page: number) => void; compliance?: boolean }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [selectedDocument, setSelectedDocument] =
    useState<GstReportDocument | null>(null);
  const [manualEInvoiceDocument, setManualEInvoiceDocument] =
    useState<GstReportDocument | null>(null);
  const [complianceNotice, setComplianceNotice] = useState("");
  const downloadMutation = useMutation({
    mutationFn: (document: GstReportDocument) =>
      downloadAdminGstDocumentPdf(auth.authHeaders, document.id),
  });
  const manualEInvoiceMutation = useMutation({
    mutationFn: ({
      documentId,
      input,
    }: {
      documentId: string;
      documentNumber: string;
      input: ManualEInvoiceInput;
    }) => recordAdminManualEInvoice(auth.authHeaders, documentId, input),
    onSuccess: async (_result, variables) => {
      setManualEInvoiceDocument(null);
      setComplianceNotice(`IRN details saved for ${variables.documentNumber}.`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-finance-gst-compliance"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-finance-gst-documents"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin-finance-gst-overview"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-reports-gst"] }),
      ]);
    },
  });

  if (!data || data.items.length === 0) {
    return <EmptyTable title="No issued GST documents match these filters." />;
  }
  return (
    <>
      <div className="grid gap-3">
        {complianceNotice ? (
          <p
            role="status"
            className="rounded-md border border-[#A6E3C8] bg-[#ECFDF3] px-4 py-3 text-sm font-bold text-[#067647]"
          >
            {complianceNotice}
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-[#E5E7EB]" data-testid="admin-gst-register">
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Seller</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3 text-right">Taxable</th>
              <th className="px-4 py-3 text-right">GST</th>
              <th className="px-4 py-3">{compliance ? "Provider status" : "Compliance"}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {data.items.map((item) => (
              <tr key={item.id} className="bg-white align-top hover:bg-[#FFFCFB]">
                <td className="px-4 py-3"><strong className="text-[#1F2933]">{item.documentNumber ?? "Pending number"}</strong><span className="mt-1 block text-xs font-semibold text-[#667085]">{humanize(item.documentType)} / {formatDate(item.issueDate)}</span><span className="mt-1 block text-xs font-semibold text-[#98A2B3]">{item.orderNumber ?? "No order reference"}</span></td>
                <td className="px-4 py-3">
                  <strong>{item.sellerName}</strong>
                  <span className="mt-1 block text-xs font-semibold text-[#667085]">
                    {humanize(item.sellerTaxRegistrationStatus)}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#98A2B3]">
                    {item.sellerGstin ?? "No GSTIN"}
                  </span>
                </td>
                <td className="px-4 py-3"><strong>{item.buyerLegalName}</strong><span className="mt-1 block text-xs font-semibold text-[#667085]">{item.buyerGstin ?? "Consumer sale"}</span></td>
                <td className="px-4 py-3">
                  <StatusBadge tone={item.documentType === "CREDIT_NOTE" ? "warning" : "info"}>
                    {item.gstrSupplySection ?? "Outside regular GSTR"}
                  </StatusBadge>
                  <span className="mt-1 block text-xs font-semibold text-[#667085]">
                    {[...new Set(item.lines.map((line) => humanize(line.taxClassification)))].join(", ")}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-[#98A2B3]">
                    {item.placeOfSupplyStateCode ? `POS ${item.placeOfSupplyStateCode}` : "No POS"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(item.taxableValuePaise)}</td>
                <td className="px-4 py-3 text-right font-black text-[#163B5C]">{formatMoney(item.totalTaxPaise)}</td>
                <td className="px-4 py-3"><div className="grid gap-1 text-xs font-semibold"><span>E-invoice <StatusBadge tone={statusTone(item.compliance.eInvoiceStatus)}>{humanize(item.compliance.eInvoiceStatus)}</StatusBadge></span><span>E-way <StatusBadge tone={statusTone(item.compliance.eWayBillStatus)}>{humanize(item.compliance.eWayBillStatus)}</StatusBadge></span>{item.compliance.irn ? <span className="break-all text-[#667085]">IRN {item.compliance.irn}</span> : null}{item.compliance.eWayBillNumber ? <span className="text-[#667085]">EWB {item.compliance.eWayBillNumber}</span> : null}{item.compliance.eInvoiceError || item.compliance.eWayBillError ? <span className="text-[#B42318]">{item.compliance.eInvoiceError ?? item.compliance.eWayBillError}</span> : null}</div></td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {compliance &&
                    item.compliance.eInvoiceStatus !== "NOT_REQUIRED" ? (
                      <button
                        type="button"
                        onClick={() => {
                          manualEInvoiceMutation.reset();
                          setComplianceNotice("");
                          setManualEInvoiceDocument(item);
                        }}
                        title={
                          item.compliance.eInvoiceStatus === "GENERATED"
                            ? "Edit manual IRN details"
                            : "Record manual IRN details"
                        }
                        aria-label={`${
                          item.compliance.eInvoiceStatus === "GENERATED"
                            ? "Edit"
                            : "Record"
                        } IRN details for ${item.documentNumber ?? "tax document"}`}
                        className="grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                      >
                        <FilePenLine className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedDocument(item)}
                      title="View document details"
                      aria-label={`View ${item.documentNumber ?? "tax document"} details`}
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMutation.mutate(item)}
                      disabled={
                        downloadMutation.isPending &&
                        downloadMutation.variables?.id === item.id
                      }
                      title="Download invoice PDF"
                      aria-label={`Download ${item.documentNumber ?? "tax document"} PDF`}
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500] disabled:cursor-wait disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <Pagination page={page} limit={data.limit} total={data.total} onPageChange={onPageChange} />
        {downloadMutation.error ? (
          <p className="text-sm font-bold text-[#B42318]">
            {downloadMutation.error instanceof Error
              ? downloadMutation.error.message
              : "The tax document could not be downloaded."}
          </p>
        ) : null}
      </div>
      <GstDocumentDetailsDrawer
        document={selectedDocument}
        onClose={() => {
          setSelectedDocument(null);
          downloadMutation.reset();
        }}
        onDownload={(document) => downloadMutation.mutate(document)}
        downloading={downloadMutation.isPending}
        downloadError={
          downloadMutation.error instanceof Error
            ? downloadMutation.error.message
            : downloadMutation.error
              ? "The tax document could not be downloaded."
              : null
        }
      />
      {manualEInvoiceDocument ? (
        <ManualEInvoiceDrawer
          key={manualEInvoiceDocument.id}
          document={manualEInvoiceDocument}
          pending={manualEInvoiceMutation.isPending}
          error={manualEInvoiceMutation.error}
          onClose={() => {
            if (manualEInvoiceMutation.isPending) return;
            setManualEInvoiceDocument(null);
            manualEInvoiceMutation.reset();
          }}
          onSave={(input) =>
            manualEInvoiceMutation.mutate({
              documentId: manualEInvoiceDocument.id,
              documentNumber:
                manualEInvoiceDocument.documentNumber ?? "tax document",
              input,
            })
          }
        />
      ) : null}
    </>
  );
}

function ManualEInvoiceDrawer({
  document,
  pending,
  error,
  onClose,
  onSave,
}: {
  document: GstReportDocument;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (input: ManualEInvoiceInput) => void;
}) {
  const [irn, setIrn] = useState(document.compliance.irn ?? "");
  const [acknowledgementNumber, setAcknowledgementNumber] = useState(
    document.compliance.acknowledgementNumber ?? "",
  );
  const [acknowledgementDate, setAcknowledgementDate] = useState(
    dateTimeLocalValue(document.compliance.acknowledgementDate),
  );
  const [signedQrCode, setSignedQrCode] = useState(
    document.compliance.signedQrCode ?? "",
  );
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDate = new Date(acknowledgementDate);
    const input = {
      irn,
      acknowledgementNumber,
      acknowledgementDate: Number.isNaN(parsedDate.getTime())
        ? ""
        : parsedDate.toISOString(),
      signedQrCode,
    };
    const message = manualEInvoiceValidationError(input);
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError("");
    onSave(input);
  }

  const errorMessage = validationError || (error ? userFacingApiErrorMessage(error) : "");

  return (
    <SideDrawer
      open
      onClose={onClose}
      title={
        document.compliance.eInvoiceStatus === "GENERATED"
          ? "Edit manual IRN"
          : "Record manual IRN"
      }
      description="Record the result generated outside 1HandIndia. This action does not contact the Invoice Registration Portal."
      widthClassName="max-w-2xl"
    >
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-3 border-y border-[#E5E7EB] py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase text-[#667085]">Document</p>
            <p className="mt-1 font-black text-[#1F2933]">
              {document.documentNumber ?? "Pending number"}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              {document.orderNumber ?? "No order reference"}
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#667085]">Seller</p>
            <p className="mt-1 font-black text-[#1F2933]">{document.sellerName}</p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              {document.sellerGstin ?? "GSTIN not recorded"}
            </p>
          </div>
        </div>

        <label className="grid gap-2 text-sm font-black text-[#344054]">
          Invoice Reference Number (IRN)
          <input
            value={irn}
            onChange={(event) => {
              setIrn(event.target.value);
              setValidationError("");
            }}
            maxLength={128}
            required
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
            className={manualEInvoiceFieldClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-black text-[#344054]">
            Acknowledgement number
            <input
              value={acknowledgementNumber}
              onChange={(event) => {
                setAcknowledgementNumber(event.target.value);
                setValidationError("");
              }}
              maxLength={100}
              required
              disabled={pending}
              autoComplete="off"
              spellCheck={false}
              className={manualEInvoiceFieldClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-[#344054]">
            Acknowledgement date and time
            <input
              type="datetime-local"
              value={acknowledgementDate}
              onChange={(event) => {
                setAcknowledgementDate(event.target.value);
                setValidationError("");
              }}
              required
              disabled={pending}
              className={manualEInvoiceFieldClass}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-black text-[#344054]">
          Signed QR payload
          <textarea
            value={signedQrCode}
            onChange={(event) => {
              setSignedQrCode(event.target.value);
              setValidationError("");
            }}
            rows={8}
            maxLength={10_000}
            required
            disabled={pending}
            spellCheck={false}
            className={manualEInvoiceFieldClass}
          />
          <span className="text-xs font-semibold leading-5 text-[#667085]">
            Paste the signed QR payload returned by the IRP or approved external
            filing system.
          </span>
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-4 py-3 text-sm font-bold text-[#8A1F1F]"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-5">
          <div>
            <StatusBadge tone="warning">Manual processing</StatusBadge>
            <p className="mt-2 text-xs font-semibold text-[#667085]">
              Saving marks this e-invoice as generated and records an audit event.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {pending ? "Saving" : "Save IRN details"}
            </Button>
          </div>
        </div>
      </form>
    </SideDrawer>
  );
}

function FilingTab({ options, sellerId, onSellerChange, periods, loading, error }: { options: AdminSelectOption[]; sellerId: string; onSellerChange: (value: string) => void; periods: GstFilingPeriod[]; loading: boolean; error: unknown }) {
  return (
    <FinancePanel>
      <PanelHeading title="Seller filing oversight" description="Admins can monitor filing status and references. Filing actions belong to the seller or an approved external filing service." />
      <div className="mt-5 max-w-md">
        <AdminListbox label="Seller" value={sellerId} options={options} onChange={onSellerChange} />
      </div>
      <div className="mt-5">
        {loading || error ? <FinanceState loading={loading} error={error} /> : null}
        {!loading && !error && sellerId ? (
          <ClientPagedSectionContent rows={periods} pageSize={10} getKey={(row) => row.id} columns={[
            ["Return period", (row) => <strong>{row.returnPeriod}</strong>],
            ["Status", (row) => <StatusBadge tone={row.status === "FILED" ? "success" : row.status === "LOCKED" ? "warning" : "info"}>{row.status}</StatusBadge>],
            ["Filed", (row) => row.filedAt ? formatDate(row.filedAt) : "Not filed"],
            ["ARN / reference", (row) => row.filingReference ?? "Not recorded"],
            ["Activity", (row) => `${row._count?.reconciliationRuns ?? 0} checks / ${row._count?.exports ?? 0} exports`],
          ]} />
        ) : null}
        {!loading && !error && !sellerId ? <EmptyTable title="Select a seller to review filing periods." /> : null}
      </div>
    </FinancePanel>
  );
}

function ClientPagedSection<T>({ title, description, rows, pageSize, getKey, columns }: { title: string; description?: string; rows: T[]; pageSize: number; getKey: (row: T, index: number) => string; columns: Array<[string, (row: T) => React.ReactNode]> }) {
  return (
    <FinancePanel>
      <PanelHeading title={title} {...(description ? { description } : {})} />
      <div className="mt-4"><ClientPagedSectionContent rows={rows} pageSize={pageSize} getKey={getKey} columns={columns} /></div>
    </FinancePanel>
  );
}

function ClientPagedSectionContent<T>({ rows, pageSize, getKey, columns }: { rows: T[]; pageSize: number; getKey: (row: T, index: number) => string; columns: Array<[string, (row: T) => React.ReactNode]> }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <div className="grid gap-3">
      <SimpleTable rows={visible} empty="No records in this period." getKey={getKey} columns={columns} />
      <Pagination page={safePage} limit={pageSize} total={rows.length} onPageChange={setPage} />
    </div>
  );
}

function SimpleTable<T>({ rows, empty, getKey, columns }: { rows: T[]; empty: string; getKey: (row: T, index: number) => string; columns: Array<[string, (row: T) => React.ReactNode]> }) {
  if (!rows.length) return <EmptyTable title={empty} />;
  return (
    <div className="overflow-x-auto rounded-md border border-[#E5E7EB]">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[#F8FAFC] text-xs font-black uppercase tracking-wide text-[#667085]">
          <tr>{columns.map(([header]) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#EEF2F6]">
          {rows.map((row, index) => <tr key={getKey(row, index)} className="bg-white align-top hover:bg-[#FFFCFB]">{columns.map(([header, render]) => <td key={header} className="px-4 py-3 font-semibold text-[#344054]">{render(row)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, limit, total, onPageChange }: { page: number; limit: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  return (
    <div className="flex flex-col gap-3 border-t border-[#EEF2F6] pt-3 text-sm font-semibold text-[#667085] sm:flex-row sm:items-center sm:justify-between">
      <span>{total ? `${((safePage - 1) * limit + 1).toLocaleString("en-IN")}-${Math.min(safePage * limit, total).toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}` : "0 records"}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Previous</Button>
        <span className="min-w-20 text-center text-xs font-black text-[#1F2933]">Page {safePage} / {totalPages}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>Next</Button>
      </div>
    </div>
  );
}

function ReadinessRow({ label, enabled, mode, provider, credentials }: { label: string; enabled: boolean; mode: string; provider: string; credentials: boolean }) {
  const detail = mode === "MANUAL"
    ? "No provider credentials required"
    : credentials
      ? "Configuration complete"
      : "Configuration incomplete";
  return <div className="border-l-2 border-[#ED3500] bg-[#F8FAFC] px-4 py-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#1F2933]">{label}</strong><StatusBadge tone={enabled && credentials ? "success" : enabled ? "warning" : "neutral"}>{enabled ? mode : "Disabled"}</StatusBadge></div><p className="mt-2 text-xs font-semibold text-[#667085]">Provider: {provider}</p><p className="mt-1 text-xs font-semibold text-[#667085]">{detail}</p></div>;
}

function PanelHeading({ title, description }: { title: string; description?: string }) {
  return <div><h3 className="text-lg font-black text-[#1F2933]">{title}</h3>{description ? <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p> : null}</div>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white" /></label>;
}

function EmptyTable({ title }: { title: string }) {
  return <div className="border border-dashed border-[#D8E2EA] bg-[#F8FAFC] px-4 py-10 text-center text-sm font-bold text-[#667085]">{title}</div>;
}

function buildQuery(values: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) query.set(key, value); });
  return query.toString();
}

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function startOfDay(value: string) {
  return value ? `${value}T00:00:00.000Z` : "";
}

function endOfDay(value: string) {
  return value ? `${value}T23:59:59.999Z` : "";
}

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)) : "Not issued";
}

function dateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function humanize(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: GstComplianceStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  if (["GENERATED", "SUBMITTED"].includes(status)) return "success";
  if (["READY", "PENDING"].includes(status)) return "warning";
  if (status === "FAILED") return "danger";
  if (status === "NOT_REQUIRED" || status === "CANCELLED") return "neutral";
  return "info";
}
