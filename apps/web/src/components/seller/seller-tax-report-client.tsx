"use client";

import Link from "next/link";
import {
  type FormEvent,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  ReceiptText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import {
  downloadSellerGstReportCsv,
  downloadSellerGstDocumentPdf,
  downloadSellerReportCsv,
  getSellerGstDocuments,
  getSellerGstOverview,
  getSellerProfile,
  getSellerTaxReport,
  lockSellerGstFilingPeriod,
  markSellerGstFilingPeriodFiled,
  reopenSellerGstFilingPeriod,
  type SellerTaxReport,
} from "@/lib/seller-api";
import type {
  GstCsvExport,
  GstDocumentFilters,
  GstReportDocument,
  GstHsnSummaryRow,
} from "@/lib/gst-report-api";
import { sellerTaxRegime } from "@/lib/tax-report-presentation";
import { GstDocumentDetailsDrawer } from "@/components/shared/gst-document-details-drawer";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerMetric,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";

type ReportRange = {
  dateFrom: string;
  dateTo: string;
};

export function SellerTaxReportClient({
  initialDateFrom = "",
  initialDateTo = "",
}: {
  initialDateFrom?: string;
  initialDateTo?: string;
}) {
  const sellerAuth = useSellerAuth();
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [submittedRange, setSubmittedRange] = useState<ReportRange>({
    dateFrom: initialDateFrom,
    dateTo: initialDateTo,
  });
  const [returnPeriod, setReturnPeriod] = useState(
    `${String(new Date().getMonth() + 1).padStart(2, "0")}${new Date().getFullYear()}`,
  );
  const [filingReference, setFilingReference] = useState("");
  const [registerPage, setRegisterPage] = useState(1);
  const [creditNotePage, setCreditNotePage] = useState(1);
  const [documentType, setDocumentType] = useState("");
  const [section, setSection] = useState("");
  const [taxClassification, setTaxClassification] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDocument, setSelectedDocument] =
    useState<GstReportDocument | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });
  const taxRegime = sellerTaxRegime(profileQuery.data?.addresses[0]?.countryCode);
  const isIndiaGst = taxRegime === "INDIA_GST";
  const sellerTaxRegistrationStatus =
    profileQuery.data?.profile?.taxRegistrationStatus ??
    (profileQuery.data?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED");
  const isRegularGstSeller = sellerTaxRegistrationStatus === "GST_REGISTERED";

  const gstQuery = useQuery({
    queryKey: [
      "seller-gst-overview",
      sellerAuth.authKey,
      submittedRange.dateFrom,
      submittedRange.dateTo,
    ],
    queryFn: () => getSellerGstOverview(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled && Boolean(profileQuery.data) && isIndiaGst,
    retry: false,
  });
  const registerFilters = useMemo<Omit<GstDocumentFilters, "sellerId">>(
    () => ({
      page: registerPage,
      limit: 25,
      dateFrom: submittedRange.dateFrom || undefined,
      dateTo: submittedRange.dateTo || undefined,
      documentType: documentType
        ? (documentType as GstDocumentFilters["documentType"])
        : undefined,
      section: section ? (section as GstDocumentFilters["section"]) : undefined,
      taxClassification: taxClassification
        ? (taxClassification as GstDocumentFilters["taxClassification"])
        : undefined,
      search: deferredSearch || undefined,
    }),
    [
      deferredSearch,
      documentType,
      registerPage,
      section,
      submittedRange.dateFrom,
      submittedRange.dateTo,
      taxClassification,
    ],
  );
  const registerQuery = useQuery({
    queryKey: ["seller-gst-documents", sellerAuth.authKey, registerFilters],
    queryFn: () => getSellerGstDocuments(sellerAuth.authHeaders, registerFilters),
    enabled: sellerAuth.enabled && Boolean(profileQuery.data) && isIndiaGst,
    retry: false,
  });
  const creditNotesQuery = useQuery({
    queryKey: [
      "seller-gst-credit-notes",
      sellerAuth.authKey,
      submittedRange.dateFrom,
      submittedRange.dateTo,
      creditNotePage,
    ],
    queryFn: () =>
      getSellerGstDocuments(sellerAuth.authHeaders, {
        page: creditNotePage,
        limit: 10,
        dateFrom: submittedRange.dateFrom || undefined,
        dateTo: submittedRange.dateTo || undefined,
        documentType: "CREDIT_NOTE",
      }),
    enabled: sellerAuth.enabled && Boolean(profileQuery.data) && isIndiaGst,
    retry: false,
  });
  const deductionsQuery = useQuery({
    queryKey: [
      "seller-tax-deductions",
      sellerAuth.authKey,
      submittedRange.dateFrom,
      submittedRange.dateTo,
    ],
    queryFn: () => getSellerTaxReport(sellerAuth.authHeaders, submittedRange),
    enabled: sellerAuth.enabled && Boolean(profileQuery.data),
    retry: false,
  });
  const exportMutation = useMutation({
    mutationFn: (type: GstCsvExport) =>
      downloadSellerGstReportCsv(sellerAuth.authHeaders, type, submittedRange),
  });
  const genericExportMutation = useMutation({
    mutationFn: (type: "sales" | "finance" | "tax" | "returns") =>
      downloadSellerReportCsv(sellerAuth.authHeaders, type, submittedRange),
  });
  const documentDownloadMutation = useMutation({
    mutationFn: (document: GstReportDocument) =>
      downloadSellerGstDocumentPdf(sellerAuth.authHeaders, document.id),
  });
  const lockMutation = useMutation({
    mutationFn: () =>
      lockSellerGstFilingPeriod(sellerAuth.authHeaders, { returnPeriod }),
    onSuccess: () => void gstQuery.refetch(),
  });
  const fileMutation = useMutation({
    mutationFn: () =>
      markSellerGstFilingPeriodFiled(sellerAuth.authHeaders, {
        returnPeriod,
        filingReference,
      }),
    onSuccess: () => void gstQuery.refetch(),
  });
  const reopenMutation = useMutation({
    mutationFn: () =>
      reopenSellerGstFilingPeriod(sellerAuth.authHeaders, { returnPeriod }),
    onSuccess: () => void gstQuery.refetch(),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedRange({ dateFrom, dateTo });
    setRegisterPage(1);
    setCreditNotePage(1);
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }
  if (profileQuery.isLoading) {
    return <SellerSkeleton />;
  }
  if (
    (profileQuery.error && isSellerOnboardingRequiredError(profileQuery.error)) ||
    (gstQuery.error && isSellerOnboardingRequiredError(gstQuery.error)) ||
    (deductionsQuery.error && isSellerOnboardingRequiredError(deductionsQuery.error))
  ) {
    return (
      <SellerOnboardingRequired message="Complete seller onboarding before viewing GST reports." />
    );
  }
  if (profileQuery.error) {
    return (
      <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
    );
  }

  const report = gstQuery.data;
  const deductions = deductionsQuery.data;
  const currency =
    report?.currency ?? deductions?.currency ?? profileQuery.data?.operatingCurrency ?? "INR";
  const creditNotes = creditNotesQuery.data?.items ?? [];
  const gstExportDisabled = !report || exportMutation.isPending;

  if (!profileQuery.isLoading && profileQuery.data && !isIndiaGst) {
    return (
      <GenericTaxReportView
        countryCode={profileQuery.data.addresses[0]?.countryCode ?? "International"}
        currency={currency}
        dateFrom={dateFrom}
        dateTo={dateTo}
        deductions={deductions}
        isLoading={deductionsQuery.isLoading}
        error={deductionsQuery.error}
        exportError={genericExportMutation.error}
        exportPending={genericExportMutation.isPending}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSubmit={submit}
        onRetry={() => void deductionsQuery.refetch()}
        onExport={(type) => genericExportMutation.mutate(type)}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="GST reporting"
              description="Review Indian GST sales, filing data, TCS credits, and marketplace fees."
            />
          </div>

          <form
            onSubmit={submit}
            className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto] xl:max-w-2xl"
          >
            <SellerField
              label="Date from"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={setDateFrom}
            />
            <SellerField
              label="Date to"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={setDateTo}
            />
            <Button type="submit" className="self-end">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Apply
            </Button>
          </form>
        </div>

        <div className="mt-5 border-t border-[#E5E7EB] pt-5">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#667085]">
            Primary reports
          </p>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              label="GST sales register"
              disabled={gstExportDisabled}
              onClick={() => exportMutation.mutate("gst-register")}
            />
            <ExportButton
              label="HSN summary"
              disabled={gstExportDisabled}
              onClick={() => exportMutation.mutate("hsn-summary")}
            />
            <Gstr1ExportMenu
              disabled={gstExportDisabled || !isRegularGstSeller}
              onExport={(type) => exportMutation.mutate(type)}
            />
            <ExportButton
              label="TCS credit statement"
              disabled={gstExportDisabled}
              onClick={() => exportMutation.mutate("gstr-8")}
            />
            <ExportButton
              label="GST reconciliation"
              disabled={gstExportDisabled}
              onClick={() => exportMutation.mutate("reconciliation")}
            />
            <ExportButton
              label="Commission & fees"
              disabled={gstExportDisabled}
              onClick={() => exportMutation.mutate("platform-commission")}
            />
          </div>
          <details className="group mt-4">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-black text-[#344054] hover:text-[#ED3500]">
              Advanced GST reports
              <ChevronDown
                className="h-4 w-4 transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <ExportButton
                label="GSTR-3B summary"
                disabled={gstExportDisabled || !isRegularGstSeller}
                onClick={() => exportMutation.mutate("gstr-3b")}
              />
              <ExportButton
                label="Document series"
                disabled={gstExportDisabled}
                onClick={() => exportMutation.mutate("document-series")}
              />
              <ExportButton
                label="Rate liability"
                disabled={gstExportDisabled}
                onClick={() => exportMutation.mutate("rate-liability")}
              />
              <ExportButton
                label="State-wise liability"
                disabled={gstExportDisabled}
                onClick={() => exportMutation.mutate("state-liability")}
              />
              {report?.gstinSummary.length ? (
                <ExportButton
                  label="B2B GSTIN summary"
                  disabled={gstExportDisabled}
                  onClick={() => exportMutation.mutate("gstin-summary")}
                />
              ) : null}
              {report?.providerReadiness.eInvoice.enabled ? (
                <ExportButton
                  label="E-invoice status"
                  disabled={gstExportDisabled}
                  onClick={() => exportMutation.mutate("e-invoice")}
                />
              ) : null}
              {report?.providerReadiness.eWayBill.enabled ? (
                <ExportButton
                  label="E-way bill status"
                  disabled={gstExportDisabled}
                  onClick={() => exportMutation.mutate("e-way-bill")}
                />
              ) : null}
            </div>
          </details>
        </div>
        {!isRegularGstSeller ? (
          <p className="mt-4 rounded-md border border-[#FEC84B] bg-[#FFFAEB] px-4 py-3 text-sm font-semibold leading-6 text-[#7A2E0E]">
            {sellerTaxRegistrationStatus === "COMPOSITION"
              ? "Your store is recorded under the composition scheme. Bills of supply and commercial records remain available, but regular GSTR-1 and GSTR-3B filing controls are not enabled."
              : "Your store is recorded as not GST registered. GST is not collected, commercial invoices remain available, and regular seller GSTR filing controls are not enabled."}
          </p>
        ) : null}
      </SellerPanel>

      {profileQuery.isLoading ||
      gstQuery.isLoading ||
      registerQuery.isLoading ||
      creditNotesQuery.isLoading ||
      deductionsQuery.isLoading ? (
        <SellerSkeleton />
      ) : null}
      {gstQuery.error ? (
        <SellerErrorPanel error={gstQuery.error} onRetry={() => void gstQuery.refetch()} />
      ) : null}
      {deductionsQuery.error ? (
        <SellerErrorPanel
          error={deductionsQuery.error}
          onRetry={() => void deductionsQuery.refetch()}
        />
      ) : null}
      {registerQuery.error ? (
        <SellerErrorPanel
          error={registerQuery.error}
          onRetry={() => void registerQuery.refetch()}
        />
      ) : null}
      {creditNotesQuery.error ? (
        <SellerErrorPanel
          error={creditNotesQuery.error}
          onRetry={() => void creditNotesQuery.refetch()}
        />
      ) : null}
      {exportMutation.error ? (
        <SellerErrorPanel error={exportMutation.error} onRetry={() => exportMutation.reset()} />
      ) : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric
              label="Issued documents"
              value={report.summary.documentCount.toLocaleString("en-IN")}
              note={`${report.summary.invoiceCount} invoices and bills`}
            />
            <SellerMetric
              label="Credit notes"
              value={report.summary.creditNoteCount.toLocaleString("en-IN")}
              note="Refund-linked tax adjustments"
            />
            <SellerMetric
              label="Taxable value"
              value={formatMoney(report.summary.taxableValuePaise, currency)}
              note="Invoices less credit notes"
            />
            <SellerMetric
              label="Net GST"
              value={formatMoney(report.summary.totalTaxPaise, currency)}
              note="CGST + SGST + IGST + cess"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SellerMetric
              label="TCS credit"
              value={formatMoney(report.tcs.summary.totalTcsPaise, currency)}
              note={`${report.tcs.summary.transactionCount} marketplace transactions`}
            />
            <SellerMetric
              label="Reconciliation"
              value={`${report.reconciliation.errorCount} errors`}
              note={`${report.reconciliation.warningCount} warnings`}
            />
            {report.providerReadiness.eInvoice.enabled ? (
              <SellerMetric
                label="E-invoice queue"
                value={report.complianceCounts.eInvoiceReady.toLocaleString("en-IN")}
                note="Ready for submission"
              />
            ) : null}
          </div>

          <SellerPanel>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                title="GST filing record"
                description="Preserve a reviewed filing snapshot and record the ARN after filing outside 1HandIndia."
              />
            </div>
            <p className="mt-4 rounded-md border border-[#FEC84B] bg-[#FFFAEB] px-4 py-3 text-sm font-semibold leading-6 text-[#7A2E0E]">
              1HandIndia Seller Hub does not submit GST returns. File through the GST Portal or
              your approved filing software, then record the ARN/reference here.
            </p>
            <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr]">
              <SellerField
                label="Return period"
                name="returnPeriod"
                value={returnPeriod}
                onChange={setReturnPeriod}
              />
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  disabled={
                    !isRegularGstSeller ||
                    lockMutation.isPending ||
                    !report.reconciliation.readyToLock
                  }
                  onClick={() => lockMutation.mutate()}
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Lock reviewed period
                </Button>
                <input
                  disabled={!isRegularGstSeller}
                  value={filingReference}
                  onChange={(event) => setFilingReference(event.target.value)}
                  placeholder="GST filing ARN/reference"
                  className="h-10 min-w-56 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold"
                  aria-label="GST filing ARN/reference"
                />
                <Button
                  type="button"
                  disabled={
                    !isRegularGstSeller ||
                    fileMutation.isPending ||
                    !filingReference.trim()
                  }
                  onClick={() => fileMutation.mutate()}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Record as filed
                </Button>
                <Button
                  type="button"
                  disabled={!isRegularGstSeller || reopenMutation.isPending}
                  onClick={() => reopenMutation.mutate()}
                >
                  Reopen
                </Button>
              </div>
            </div>
            {lockMutation.error || fileMutation.error || reopenMutation.error ? (
              <p className="mt-3 text-sm font-bold text-[#B42318]">
                {mutationMessage(
                  lockMutation.error || fileMutation.error || reopenMutation.error,
                )}
              </p>
            ) : null}
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Period</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Snapshot</th>
                    <th className="pb-3">Filing reference</th>
                  </tr>
                </thead>
                <tbody>
                  {report.filingPeriods.map((period) => (
                    <tr key={period.id} className="border-b border-[#E5E7EB]">
                      <td className="py-3 pr-4 font-black">{period.returnPeriod}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge tone={period.status === "FILED" ? "success" : "info"}>
                          {period.status}
                        </StatusBadge>
                      </td>
                      <td className="py-3 pr-4 text-xs font-semibold text-[#667085]">
                        {period.snapshotHash ? `${period.snapshotHash.slice(0, 12)}...` : "Not locked"}
                      </td>
                      <td className="py-3 font-semibold">{period.filingReference ?? "Not filed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.filingPeriods.length ? (
                <p className="py-4 text-sm font-semibold text-[#667085]">
                  No filing periods have been locked.
                </p>
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <SectionHeading
                title="GST document register"
                description="Complete issued-document history with server-side pagination and secure invoice access."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[min(46rem,100%)] xl:grid-cols-4">
                <label className="space-y-2 sm:col-span-2">
                  <span className="block text-xs font-black uppercase text-[#667085]">
                    Search documents
                  </span>
                  <span className="relative block">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
                      aria-hidden="true"
                    />
                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setRegisterPage(1);
                      }}
                      placeholder="Number, order, buyer, GSTIN"
                      className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </span>
                </label>
                <ReportSelect
                  label="Document type"
                  value={documentType}
                  onChange={(value) => {
                    setDocumentType(value);
                    setRegisterPage(1);
                  }}
                  options={[
                    ["", "All types"],
                    ["TAX_INVOICE", "Tax invoices"],
                    ["BILL_OF_SUPPLY", "Bills of supply"],
                    ["COMMERCIAL_INVOICE", "Commercial invoices"],
                    ["CREDIT_NOTE", "Credit notes"],
                    ["DEBIT_NOTE", "Debit notes"],
                  ]}
                />
                <ReportSelect
                  label="GSTR section"
                  value={section}
                  onChange={(value) => {
                    setSection(value);
                    setRegisterPage(1);
                  }}
                  options={[
                    ["", "All sections"],
                    ["B2B", "B2B"],
                    ["B2CL", "B2CL"],
                    ["B2CS", "B2CS"],
                    ["CDNR", "CDNR"],
                    ["CDNUR", "CDNUR"],
                    ["EXPORT", "Export"],
                    ["SEZ", "SEZ"],
                    ["NIL_EXEMPT_NON_GST", "Nil / exempt / non-GST"],
                  ]}
                />
                <ReportSelect
                  label="Supply class"
                  value={taxClassification}
                  onChange={(value) => {
                    setTaxClassification(value);
                    setRegisterPage(1);
                  }}
                  options={[
                    ["", "All classifications"],
                    ["TAXABLE", "Taxable"],
                    ["NIL_RATED", "Nil-rated"],
                    ["EXEMPT", "Exempt"],
                    ["NON_GST", "Non-GST"],
                  ]}
                />
              </div>
            </div>
            <div className="mt-5 overflow-x-auto" data-testid="seller-gst-register">
              <table className="min-w-[1040px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Document</th>
                    <th className="pb-3 pr-4">Order</th>
                    <th className="pb-3 pr-4">Buyer</th>
                    <th className="pb-3 pr-4">GSTR section</th>
                    <th className="pb-3 pr-4 text-right">Taxable</th>
                    <th className="pb-3 pr-4 text-right">GST</th>
                    <th className="pb-3 pr-4 text-right">Value</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(registerQuery.data?.items ?? []).map((document) => (
                    <GstDocumentRow
                      key={document.id}
                      document={document}
                      currency={currency}
                      onView={() => setSelectedDocument(document)}
                      onDownload={() => documentDownloadMutation.mutate(document)}
                      downloading={
                        documentDownloadMutation.isPending &&
                        documentDownloadMutation.variables?.id === document.id
                      }
                    />
                  ))}
                </tbody>
              </table>
              {!registerQuery.data?.items.length ? (
                <SellerEmptyState
                  title="No issued GST documents"
                  message="Invoices appear here after fulfilment reaches dispatch or delivery."
                />
              ) : null}
            </div>
            {registerQuery.data ? (
              <SellerPagination
                page={registerQuery.data.page}
                limit={registerQuery.data.limit}
                total={registerQuery.data.total}
                totalPages={registerQuery.data.totalPages}
                onPageChange={setRegisterPage}
              />
            ) : null}
            {documentDownloadMutation.error ? (
              <p className="mt-3 text-sm font-bold text-[#B42318]">
                {mutationMessage(documentDownloadMutation.error)}
              </p>
            ) : null}
          </SellerPanel>

          <SellerPanel>
            <SectionHeading
              title="HSN summary"
              description="Net quantity, taxable value, and GST grouped by HSN, rate, and unit."
            />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">HSN</th>
                    <th className="pb-3 pr-4">Description</th>
                    <th className="pb-3 pr-4 text-right">Quantity</th>
                    <th className="pb-3 pr-4 text-right">Rate</th>
                    <th className="pb-3 pr-4 text-right">Taxable</th>
                    <th className="pb-3 text-right">GST</th>
                  </tr>
                </thead>
                <tbody>
                  {report.hsnSummary.map((row) => (
                    <HsnSummaryRow
                      key={`${row.hsnSacCode}-${row.gstRatePercent}-${row.uqc}`}
                      row={row}
                      currency={currency}
                    />
                  ))}
                </tbody>
              </table>
              {!report.hsnSummary.length ? (
                <SellerEmptyState
                  title="No HSN totals"
                  message="HSN totals appear when issued documents contain approved product tax data."
                />
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel>
            <SectionHeading
              title="GSTR section summary"
              description="Outward documents grouped into filing sections for review."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {report.sections.map((section) => (
                <div key={section.section} className="rounded-md border border-[#E5E7EB] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                    {section.section}
                  </p>
                  <p className="mt-2 text-xl font-black text-[#1F2933]">
                    {section.documentCount}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#667085]">
                    {formatMoney(section.totalTaxPaise, currency)} GST
                  </p>
                </div>
              ))}
            </div>
          </SellerPanel>

          <SellerPanel>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                {report.reconciliation.readyToLock ? (
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <SectionHeading
                title="GST reconciliation"
                description="Document totals, line totals, classification, and compliance readiness checks."
              />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Severity</th>
                    <th className="pb-3 pr-4">Code</th>
                    <th className="pb-3 pr-4">Document</th>
                    <th className="pb-3">Finding</th>
                  </tr>
                </thead>
                <tbody>
                  {report.reconciliation.issues.map((issue, index) => (
                    <tr
                      key={`${issue.code}-${issue.documentId ?? index}`}
                      className="border-b border-[#E5E7EB]"
                    >
                      <td className="py-3 pr-4">
                        <StatusBadge tone={issue.severity === "ERROR" ? "danger" : "warning"}>
                          {issue.severity}
                        </StatusBadge>
                      </td>
                      <td className="py-3 pr-4 font-black">{issue.code}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {issue.documentNumber ?? "Period-level"}
                      </td>
                      <td className="py-3 font-semibold text-[#667085]">{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.reconciliation.issues.length ? (
                <p className="py-4 text-sm font-bold text-[#087443]">
                  No reconciliation findings for this range.
                </p>
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel>
            <SectionHeading
              title="TCS credit statement"
              description="Marketplace TCS amounts shown for seller reconciliation and credit review."
            />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Seller</th>
                    <th className="pb-3 pr-4">GSTIN</th>
                    <th className="pb-3 pr-4 text-right">Net supplies</th>
                    <th className="pb-3 pr-4 text-right">IGST TCS</th>
                    <th className="pb-3 pr-4 text-right">CGST + SGST</th>
                    <th className="pb-3 text-right">Total TCS</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tcs.statements.map((statement) => (
                    <tr key={statement.sellerId} className="border-b border-[#E5E7EB]">
                      <td className="py-3 pr-4 font-black">{statement.sellerName}</td>
                      <td className="py-3 pr-4 font-semibold">
                        {statement.sellerGstin ?? "Unregistered"}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(statement.netSuppliesPaise, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(statement.igstPaise, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(statement.cgstPaise + statement.sgstPaise, currency)}
                      </td>
                      <td className="py-3 text-right font-black">
                        {formatMoney(statement.totalTcsPaise, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.tcs.statements.length ? (
                <SellerEmptyState
                  title="No TCS transactions"
                  message="TCS statements appear when seller transactions carry an active TCS rule."
                />
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel>
            <SectionHeading
              title="Credit notes"
              description="Refund-linked adjustments with the original invoice reference and filing section."
            />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Credit note</th>
                    <th className="pb-3 pr-4">Original invoice</th>
                    <th className="pb-3 pr-4">Reason</th>
                    <th className="pb-3 pr-4">Section</th>
                    <th className="pb-3 pr-4 text-right">Adjustment</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNotes.map((document) => (
                    <tr key={document.id} className="border-b border-[#E5E7EB]">
                      <td className="py-3 pr-4">
                        <p className="font-black text-[#1F2933]">
                          {document.documentNumber ?? "Pending number"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#667085]">
                          {formatReportDate(document.issueDate)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-[#344054]">
                        {document.originalDocumentNumber ?? "Not linked"}
                      </td>
                      <td className="max-w-xs py-3 pr-4 text-sm font-semibold text-[#667085]">
                        {document.reason ?? "Refund adjustment"}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge tone="warning">
                          {document.gstrSupplySection ?? "Unclassified"}
                        </StatusBadge>
                      </td>
                      <td className="py-3 text-right font-black text-[#B42318]">
                        {formatMoney(document.invoiceValuePaise, currency)}
                      </td>
                      <td className="py-3 text-right">
                        <DocumentActions
                          document={document}
                          onView={() => setSelectedDocument(document)}
                          onDownload={() => documentDownloadMutation.mutate(document)}
                          downloading={
                            documentDownloadMutation.isPending &&
                            documentDownloadMutation.variables?.id === document.id
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!creditNotes.length ? (
                <SellerEmptyState
                  title="No credit notes"
                  message="Completed refund adjustments will appear here automatically."
                />
              ) : null}
            </div>
            {creditNotesQuery.data ? (
              <SellerPagination
                page={creditNotesQuery.data.page}
                limit={creditNotesQuery.data.limit}
                total={creditNotesQuery.data.total}
                totalPages={creditNotesQuery.data.totalPages}
                onPageChange={setCreditNotePage}
              />
            ) : null}
          </SellerPanel>
        </>
      ) : null}

      {deductions ? (
        <SellerPanel>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading
              title="Marketplace deductions"
              description="Settlement taxes and fees are separate from outward-supply GST."
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric
              label="Commission"
              value={formatMoney(deductions.summary.commissionPaise, deductions.currency)}
              note="Marketplace service fee"
            />
            <SellerMetric
              label="GST on commission"
              value={formatMoney(deductions.summary.gstOnCommissionPaise, deductions.currency)}
              note="GST charged on marketplace commission"
            />
            <SellerMetric
              label="TDS and TCS credits"
              value={formatMoney(
                deductions.summary.tdsPaise + deductions.summary.tcsPaise,
                deductions.currency,
              )}
              note="Tax deducted and collected at source"
            />
            <SellerMetric
              label="Net payable"
              value={formatMoney(deductions.summary.netPayablePaise, deductions.currency)}
              note={`${deductions.summary.orderCount} orders`}
            />
          </div>
          <p className="mt-5 text-xs font-semibold leading-6 text-[#667085]">
            Net payable = Gross sales - Commission - GST on commission - TDS - TCS -
            Platform fee - Seller-funded coupon discount + Coupon adjustment + Refund adjustment.
          </p>
        </SellerPanel>
      ) : null}
      <GstDocumentDetailsDrawer
        document={selectedDocument}
        onClose={() => {
          setSelectedDocument(null);
          documentDownloadMutation.reset();
        }}
        onDownload={(document) => documentDownloadMutation.mutate(document)}
        downloading={documentDownloadMutation.isPending}
        downloadError={
          documentDownloadMutation.error
            ? mutationMessage(documentDownloadMutation.error)
            : null
        }
      />
    </div>
  );
}

function GenericTaxReportView({
  countryCode,
  currency,
  dateFrom,
  dateTo,
  deductions,
  isLoading,
  error,
  exportError,
  exportPending,
  onDateFromChange,
  onDateToChange,
  onSubmit,
  onRetry,
  onExport,
}: {
  countryCode: string;
  currency: string;
  dateFrom: string;
  dateTo: string;
  deductions: SellerTaxReport | undefined;
  isLoading: boolean;
  error: Error | null;
  exportError: Error | null;
  exportPending: boolean;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  onExport: (type: "sales" | "finance" | "tax" | "returns") => void;
}) {
  return (
    <div className="grid gap-5">
      <SellerPanel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <SectionHeading
                title="Tax and financial reporting"
                description="Sales, marketplace fees, settlements, withholding, returns, and credit adjustments."
              />
              <p className="mt-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                Registered country: {countryCode}
              </p>
            </div>
          </div>
          <form
            onSubmit={onSubmit}
            className="grid w-full gap-3 md:grid-cols-[1fr_1fr_auto] xl:max-w-2xl"
          >
            <SellerField
              label="Date from"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={onDateFromChange}
            />
            <SellerField
              label="Date to"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={onDateToChange}
            />
            <Button type="submit" className="self-end">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Apply
            </Button>
          </form>
        </div>
        <div className="mt-5 border-t border-[#E5E7EB] pt-5">
          <p className="mb-3 text-xs font-black uppercase tracking-wide text-[#667085]">
            Available exports
          </p>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              label="Sales transactions"
              disabled={exportPending}
              onClick={() => onExport("sales")}
            />
            <ExportButton
              label="Tax & fee summary"
              disabled={exportPending}
              onClick={() => onExport("tax")}
            />
            <ExportButton
              label="Payout statement"
              disabled={exportPending}
              onClick={() => onExport("finance")}
            />
            <ExportButton
              label="Returns & refunds"
              disabled={exportPending}
              onClick={() => onExport("returns")}
            />
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#667085]">
            Country-specific return packages appear only when a local tax module is configured
            for the seller's registered country.
          </p>
        </div>
      </SellerPanel>

      {isLoading ? <SellerSkeleton /> : null}
      {error ? <SellerErrorPanel error={error} onRetry={onRetry} /> : null}
      {exportError ? (
        <p className="text-sm font-bold text-[#B42318]">
          {exportError instanceof Error
            ? exportError.message
            : "The report could not be downloaded."}
        </p>
      ) : null}

      {deductions ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SellerMetric
              label="Gross sales"
              value={formatMoney(deductions.summary.grossSalesPaise, currency)}
              note={`${deductions.summary.orderCount} orders`}
            />
            <SellerMetric
              label="Marketplace fees"
              value={formatMoney(
                deductions.summary.commissionPaise + deductions.summary.platformFeePaise,
                currency,
              )}
              note="Commission and platform charges"
            />
            <SellerMetric
              label="Tax and withholding"
              value={formatMoney(
                deductions.summary.gstOnCommissionPaise +
                  deductions.summary.tdsPaise +
                  deductions.summary.tcsPaise,
                currency,
              )}
              note="Configured marketplace tax deductions"
            />
            <SellerMetric
              label="Net payable"
              value={formatMoney(deductions.summary.netPayablePaise, currency)}
              note="After fees, taxes, and adjustments"
            />
          </div>

          <SellerPanel>
            <SectionHeading
              title="Transaction deductions"
              description="Order-level sales, marketplace charges, withholding, and net settlement values."
            />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-left text-xs font-bold uppercase tracking-wide text-[#667085]">
                    <th className="pb-3 pr-4">Order</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4 text-right">Gross sales</th>
                    <th className="pb-3 pr-4 text-right">Fees</th>
                    <th className="pb-3 pr-4 text-right">Tax / withholding</th>
                    <th className="pb-3 text-right">Net payable</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.splits.map((split) => (
                    <tr key={split.id} className="border-b border-[#E5E7EB]">
                      <td className="py-3 pr-4 font-black">{split.order.orderNumber}</td>
                      <td className="py-3 pr-4 font-semibold text-[#667085]">
                        {formatReportDate(split.order.createdAt)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(split.sellerSubtotalPaise, split.order.currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(
                          split.commissionPaise + split.platformFeePaise,
                          split.order.currency,
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">
                        {formatMoney(
                          split.gstOnCommissionPaise + split.tdsPaise + split.tcsPaise,
                          split.order.currency,
                        )}
                      </td>
                      <td className="py-3 text-right font-black">
                        {formatMoney(split.netPayablePaise, split.order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!deductions.splits.length ? (
                <SellerEmptyState
                  title="No reportable transactions"
                  message="Sales and settlement deductions will appear for the selected period."
                />
              ) : null}
            </div>
          </SellerPanel>
        </>
      ) : null}
    </div>
  );
}

function Gstr1ExportMenu({
  disabled,
  onExport,
}: {
  disabled: boolean;
  onExport: (type: "gstr-1" | "gstr-1-json") => void;
}) {
  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton
            type="button"
            disabled={disabled}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500] hover:bg-[#FFFCFB] hover:text-[#ED3500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            GSTR-1 export
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </PopoverButton>
          <PopoverPanel
            anchor="bottom start"
            className="z-30 mt-2 w-56 rounded-md border border-[#D8E2EA] bg-white p-1 shadow-lg"
          >
            <ExportMenuItem
              label="CSV workbook data"
              onClick={() => {
                onExport("gstr-1");
                close();
              }}
            />
            <ExportMenuItem
              label="JSON filing package"
              onClick={() => {
                onExport("gstr-1-json");
                close();
              }}
            />
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}

function ExportMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold text-[#344054] hover:bg-[#FFF0EC] hover:text-[#ED3500]"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function ExportButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] transition hover:border-[#ED3500] hover:bg-[#FFFCFB] hover:text-[#ED3500] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label.toLowerCase().includes("gstr-1") ? (
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function GstDocumentRow({
  document,
  currency,
  onView,
  onDownload,
  downloading,
}: {
  document: GstReportDocument;
  currency: string;
  onView: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const isCreditNote = document.documentType === "CREDIT_NOTE";

  return (
    <tr className="border-b border-[#E5E7EB] hover:bg-[#FFFCFB]">
      <td className="py-3 pr-4">
        <p className="font-black text-[#1F2933]">{document.documentNumber ?? "Pending number"}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          {documentTypeLabel(document.documentType)} - {formatReportDate(document.issueDate)}
        </p>
      </td>
      <td className="py-3 pr-4">
        {document.orderNumber ? (
          <Link
            href={`/seller/orders/${document.orderNumber}`}
            className="font-black text-[#ED3500] hover:underline"
          >
            {document.orderNumber}
          </Link>
        ) : (
          <span className="font-semibold text-[#667085]">No order reference</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <p className="font-semibold text-[#1F2933]">{document.buyerLegalName}</p>
        <p className="mt-1 text-xs font-semibold text-[#667085]">
          {document.buyerGstin ?? "Consumer sale"}
        </p>
      </td>
      <td className="py-3 pr-4">
        <StatusBadge tone={isCreditNote ? "warning" : "info"}>
          {document.gstrSupplySection ?? "Unclassified"}
        </StatusBadge>
      </td>
      <td className="py-3 pr-4 text-right font-semibold">
        {formatMoney(document.taxableValuePaise, currency)}
      </td>
      <td className="py-3 pr-4 text-right font-semibold">
        {formatMoney(document.totalTaxPaise, currency)}
      </td>
      <td
        className={`py-3 pr-4 text-right font-black ${
          isCreditNote ? "text-[#B42318]" : "text-[#1F2933]"
        }`}
      >
        {formatMoney(document.invoiceValuePaise, currency)}
      </td>
      <td className="py-3 text-right">
        <DocumentActions
          document={document}
          onView={onView}
          onDownload={onDownload}
          downloading={downloading}
        />
      </td>
    </tr>
  );
}

function DocumentActions({
  document,
  onView,
  onDownload,
  downloading,
}: {
  document: GstReportDocument;
  onView: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onView}
        title="View document details"
        aria-label={`View ${document.documentNumber ?? "tax document"} details`}
        className="grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        title="Download invoice PDF"
        aria-label={`Download ${document.documentNumber ?? "tax document"} PDF`}
        className="grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500] disabled:cursor-wait disabled:opacity-50"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ReportSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase text-[#667085]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SellerPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-[#EEF2F6] pt-4 text-sm font-semibold text-[#667085] sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total
          ? `${((page - 1) * limit + 1).toLocaleString("en-IN")}-${Math.min(
              page * limit,
              total,
            ).toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}`
          : "0 records"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="min-w-20 text-center text-xs font-black text-[#1F2933]">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function HsnSummaryRow({ row, currency }: { row: GstHsnSummaryRow; currency: string }) {
  return (
    <tr className="border-b border-[#E5E7EB]">
      <td className="py-3 pr-4 font-black text-[#1F2933]">{row.hsnSacCode}</td>
      <td className="max-w-sm py-3 pr-4 font-semibold text-[#667085]">{row.description}</td>
      <td className="py-3 pr-4 text-right font-semibold">
        {row.quantity.toLocaleString("en-IN")} {row.uqc}
      </td>
      <td className="py-3 pr-4 text-right font-semibold">{row.gstRatePercent}%</td>
      <td className="py-3 pr-4 text-right font-semibold">
        {formatMoney(row.taxableValuePaise, currency)}
      </td>
      <td className="py-3 text-right font-black text-[#1F2933]">
        {formatMoney(row.totalTaxPaise, currency)}
      </td>
    </tr>
  );
}

function documentTypeLabel(value: GstReportDocument["documentType"]) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatReportDate(value?: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function mutationMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The filing period action could not be completed.";
}
