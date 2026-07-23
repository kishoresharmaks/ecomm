"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Columns3,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  AdminActionMenu,
  AdminListbox,
  type AdminSelectOption,
} from "@/components/admin/admin-ux";
import { SideDrawer } from "@/components/shared/side-drawer";
import { indihubFetch } from "@/lib/api";
import { humanizeGstValue as humanize } from "@/lib/gst-document-presentation";
import {
  downloadOrderTaxDocument,
  downloadOrderTaxRegister,
  getOrderTaxRegister,
  orderTaxRegisterQuery,
  orderTaxRegisterPeriodRange,
  type OrderTaxReadinessStatus,
  type OrderTaxReconciliationStatus,
  type OrderTaxRegisterFilters,
  type OrderTaxRegisterRow,
  type OrderTaxRegisterSortField,
  type OrderTaxRegisterSource,
} from "@/lib/order-tax-register-api";
import { formatMoney } from "@/lib/storefront-api";

type SellerOption = { id: string; storeName: string };
type SavedView = { id: string; name: string; filters: FilterState };
type FilterState = OrderTaxRegisterFilters & {
  channel: "" | "B2C" | "B2B";
  sellerId: string;
  documentStatus: string;
  documentType: string;
  readinessStatus: string;
  reconciliationStatus: string;
  paymentStatus: string;
  settlementStatus: string;
  taxClassification: string;
  gstrSupplySection: string;
  eInvoiceStatus: string;
  eWayBillStatus: string;
  hsnSacCode: string;
  gstRatePercent: string;
  reverseCharge: "" | "true" | "false";
  warningCodes: string[];
  search: string;
};

type ColumnId =
  | "transaction"
  | "invoice"
  | "date"
  | "parties"
  | "classification"
  | "description"
  | "tax"
  | "payment"
  | "settlement"
  | "readiness"
  | "reconciliation"
  | "actions";

const documentTypes = options("All invoice types", [
  "TAX_INVOICE",
  "BILL_OF_SUPPLY",
  "COMMERCIAL_INVOICE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
]);
const documentStatuses = options("All document statuses", [
  "ISSUED",
  "DRAFT",
  "CANCELLED",
]);
const readinessStatuses = options("All readiness states", [
  "READY",
  "INCOMPLETE_DOCUMENT",
  "MISSING_DOCUMENT",
  "DRAFT_DOCUMENT",
  "CANCELLED_DOCUMENT",
  "NOT_REQUIRED",
]);
const reconciliationStatuses = options("All reconciliation states", [
  "MATCHED",
  "MISMATCH",
  "PARTIAL",
  "NOT_COMPARABLE",
]);
const paymentStatuses = options("All payment states", [
  "PAID",
  "PENDING",
  "PARTIALLY_PAID",
  "REFUNDED",
  "FAILED",
  "NOT_REQUIRED",
]);
const settlementStatuses = options("All settlement states", [
  "NOT_ELIGIBLE",
  "ELIGIBLE",
  "DRAFTED",
  "APPROVED",
  "PAID",
  "CANCELLED",
  "ADJUSTED",
]);
const classifications = options("All classifications", [
  "TAXABLE",
  "NIL_RATED",
  "EXEMPT",
  "NON_GST",
]);
const gstrSections = options("All GSTR sections", [
  "B2B",
  "B2CL",
  "B2CS",
  "CDNR",
  "CDNUR",
  "EXPORT",
  "SEZ",
  "NIL_EXEMPT_NON_GST",
]);
const complianceStatuses = options("All compliance states", [
  "NOT_REQUIRED",
  "READY",
  "PENDING",
  "SUBMITTED",
  "GENERATED",
  "CANCELLED",
  "FAILED",
]);
const warningOptions = [
  "MISSING_DOCUMENT",
  "MISSING_PAYMENT",
  "INVALID_GSTIN",
  "INVALID_BUYER_GSTIN",
  "DATE_FALLBACK",
  "SOURCE_LINK_MISSING",
  "DOCUMENT_ORDER_MISMATCH",
  "PAYMENT_INVOICE_MISMATCH",
  "PAYMENT_SCOPE_MISMATCH",
  "TAX_SNAPSHOT_DOCUMENT_MISMATCH",
];
const defaultColumns: ColumnId[] = [
  "transaction",
  "invoice",
  "date",
  "parties",
  "classification",
  "description",
  "tax",
  "payment",
  "settlement",
  "readiness",
  "reconciliation",
  "actions",
];

export function AdminOrderTaxRegisterClient() {
  const auth = useAdminAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [applied, setApplied] = useState<FilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [draft, setDraft] = useState<FilterState>(() =>
    filtersFromParams(searchParams),
  );
  const [selectedRow, setSelectedRow] =
    useState<OrderTaxRegisterRow | null>(null);
  const [visibleColumns, setVisibleColumns] =
    useState<ColumnId[]>(defaultColumns);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewId, setSavedViewId] = useState("");
  const [savedViewName, setSavedViewName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const storageKey = `indihub.order-tax-register.views.${auth.user?.id ?? "anonymous"}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setSavedViews(stored ? (JSON.parse(stored) as SavedView[]) : []);
    } catch {
      setSavedViews([]);
    }
  }, [storageKey]);

  useEffect(() => {
    const onFullscreen = () =>
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const report = useQuery({
    queryKey: ["admin-order-tax-register", auth.authHeaders, applied],
    enabled: auth.isAuthenticated,
    queryFn: () => getOrderTaxRegister(auth.authHeaders, applied),
  });
  const sellers = useQuery({
    queryKey: ["admin-order-tax-register-sellers", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: async () => {
      const response = await indihubFetch<{ items: SellerOption[] }>(
        "/api/admin/sellers?limit=100",
        undefined,
        auth.authHeaders,
      );
      return response.items;
    },
  });
  const exportCsv = useMutation({
    mutationFn: () => downloadOrderTaxRegister(auth.authHeaders, applied),
  });
  const downloadPdf = useMutation({
    mutationFn: (documentId: string) =>
      downloadOrderTaxDocument(auth.authHeaders, documentId),
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
  const warningGroups = useMemo(() => {
    const scopes = new Set<string>();
    return (report.data?.items ?? []).flatMap((row) => {
      if (!row.warningCodes.length || scopes.has(row.documentScopeKey)) {
        return [];
      }
      scopes.add(row.documentScopeKey);
      return [{ row, codes: row.warningCodes }];
    });
  }, [report.data?.items]);

  function apply(next = draft) {
    const normalized = { ...next, page: 1 };
    setDraft(normalized);
    setApplied(normalized);
    router.replace(
      `/admin/reports/order-tax-register?${orderTaxRegisterQuery(normalized)}`,
      { scroll: false },
    );
  }

  function switchSource(source: OrderTaxRegisterSource) {
    apply({
      ...draft,
      source,
      channel: source === "SERVICE" ? "B2C" : draft.channel,
    });
  }

  function setPage(page: number) {
    const next = { ...applied, page };
    setApplied(next);
    setDraft(next);
    router.replace(
      `/admin/reports/order-tax-register?${orderTaxRegisterQuery(next)}`,
      { scroll: false },
    );
  }

  function saveView() {
    const name = savedViewName.trim();
    if (!name) return;
    const view = {
      id: crypto.randomUUID(),
      name,
      filters: { ...applied, page: 1 },
    };
    const next = [...savedViews, view];
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedViews(next);
    setSavedViewId(view.id);
    setSavedViewName("");
  }

  function loadView(id: string) {
    setSavedViewId(id);
    const view = savedViews.find((candidate) => candidate.id === id);
    if (view) apply(view.filters);
  }

  function deleteView() {
    if (!savedViewId) return;
    const next = savedViews.filter((view) => view.id !== savedViewId);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSavedViews(next);
    setSavedViewId("");
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await workspaceRef.current?.requestFullscreen();
    }
  }

  const summary = report.data?.summary;
  const exceptionCount = summary
    ? Object.entries(summary.readinessCounts).reduce(
        (count, [status, value]) =>
          status === "READY" || status === "NOT_REQUIRED"
            ? count
            : count + value,
        0,
      )
    : 0;

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "grid gap-4 bg-[#FFFCFB]",
        isFullscreen && "h-screen overflow-y-auto p-4",
      )}
    >
      <section className="border-b border-[#D8E2EA] bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div
            className="inline-flex w-fit rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-1"
            role="tablist"
            aria-label="Tax register source"
          >
            {[
              ["PRODUCT", "Product orders"],
              ["SERVICE", "Service bookings"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={draft.source === value}
                onClick={() =>
                  switchSource(value as OrderTaxRegisterSource)
                }
                className={cn(
                  "h-9 rounded px-4 text-sm font-black transition",
                  draft.source === value
                    ? "bg-[#ED3500] text-white"
                    : "text-[#667085] hover:bg-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <AdminListbox
              value={savedViewId}
              options={[
                { value: "", label: "Saved views" },
                ...savedViews.map((view) => ({
                  value: view.id,
                  label: view.name,
                })),
              ]}
              onChange={loadView}
              compact
              className="w-48"
            />
            <input
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="View name"
              aria-label="Saved view name"
              className="h-9 w-40 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={saveView}
              disabled={!savedViewName.trim()}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save view
            </Button>
            {savedViewId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deleteView}
                aria-label="Delete selected saved view"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => exportCsv.mutate()}
              disabled={exportCsv.isPending}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exportCsv.isPending ? "Preparing CSV" : "Export CSV"}
            </Button>
          </div>
        </div>
      </section>

      <FilterWorkspace
        draft={draft}
        setDraft={setDraft}
        sellerOptions={sellerOptions}
        onApply={() => apply()}
        onClear={() => {
          const next = defaultFilters(draft.source);
          setDraft(next);
          apply(next);
        }}
      />

      {exportCsv.error ? (
        <ErrorNotice message={exportCsv.error.message} />
      ) : null}
      {report.data?.truncated ? (
        <ErrorNotice message="This result set reached the report safety limit. Narrow the date range or seller filter for complete totals and export." />
      ) : null}

      <section className="grid grid-cols-2 border border-[#D8E2EA] bg-white sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Tax lines" value={summary?.lineCount ?? 0} />
        <Metric
          label="Taxable value"
          value={formatMoney(summary?.taxableValuePaise ?? 0, "INR")}
        />
        <Metric
          label="Total GST"
          value={formatMoney(summary?.totalTaxPaise ?? 0, "INR")}
        />
        <Metric
          label="Signed invoice value"
          value={formatMoney(summary?.invoiceValuePaise ?? 0, "INR")}
        />
        <Metric
          label="Ready documents"
          value={summary?.readinessCounts.READY ?? 0}
          tone="success"
        />
        <Metric
          label="Exceptions"
          value={exceptionCount}
          tone={exceptionCount ? "warning" : "neutral"}
        />
      </section>

      {warningGroups.length ? (
        <section className="border border-[#F6C7B8] bg-[#FFF7F3] px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[#ED3500]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-[#7A271A]">
                {warningGroups.length} transaction scopes on this page need
                attention
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {warningGroups.slice(0, 8).map(({ row, codes }) => (
                  <button
                    key={row.documentScopeKey}
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="rounded border border-[#F6C7B8] bg-white px-2 py-1 text-xs font-bold text-[#7A271A] hover:border-[#ED3500]"
                  >
                    {row.transactionNumber}: {codes.join(", ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="min-w-0 border border-[#D8E2EA] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#D8E2EA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#1F2933]">
              {report.data?.total ?? 0} matching tax lines
            </p>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              Invoice totals repeat on each line; summary totals count each
              document scope once.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminActionMenu
              label="Columns"
              items={defaultColumns.map((column) => ({
                label: `${visibleColumns.includes(column) ? "Hide" : "Show"} ${humanize(column)}`,
                icon: <Columns3 className="h-4 w-4" aria-hidden="true" />,
                onSelect: () =>
                  setVisibleColumns((current) =>
                    current.includes(column)
                      ? current.filter((item) => item !== column)
                      : [...current, column],
                  ),
              }))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void report.refetch()}
              disabled={report.isFetching}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  report.isFetching && "animate-spin",
                )}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </div>

        {report.isLoading ? (
          <TableState message="Loading tax register..." />
        ) : report.error ? (
          <TableState
            message={report.error.message}
            action={
              <Button type="button" onClick={() => void report.refetch()}>
                Retry
              </Button>
            }
          />
        ) : !report.data?.items.length ? (
          <TableState message="No tax lines match the applied filters." />
        ) : (
          <RegisterTable
            rows={report.data.items}
            visibleColumns={visibleColumns}
            filters={applied}
            onSort={(sortBy) => {
              const next = {
                ...applied,
                sortBy,
                sortDirection:
                  applied.sortBy === sortBy &&
                  applied.sortDirection === "ASC"
                    ? ("DESC" as const)
                    : ("ASC" as const),
                page: 1,
              };
              setApplied(next);
              setDraft(next);
              router.replace(
                `/admin/reports/order-tax-register?${orderTaxRegisterQuery(next)}`,
                { scroll: false },
              );
            }}
            onView={setSelectedRow}
            onDownload={(row) => {
              if (row.documentId) downloadPdf.mutate(row.documentId);
            }}
            downloadingId={
              downloadPdf.isPending ? downloadPdf.variables : null
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t border-[#D8E2EA] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminListbox
            value={String(applied.limit)}
            options={[25, 50, 100].map((value) => ({
              value: String(value),
              label: `${value} rows`,
            }))}
            onChange={(value) =>
              apply({ ...draft, limit: Number(value), page: 1 })
            }
            compact
            className="w-32"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#667085]">
              Page {report.data?.page ?? 1} of{" "}
              {report.data?.totalPages ?? 1}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={(report.data?.page ?? 1) <= 1}
              onClick={() => setPage((report.data?.page ?? 1) - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                (report.data?.page ?? 1) >=
                (report.data?.totalPages ?? 1)
              }
              onClick={() => setPage((report.data?.page ?? 1) + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <RegisterDetailsDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onDownload={(row) => {
          if (row.documentId) downloadPdf.mutate(row.documentId);
        }}
        downloading={downloadPdf.isPending}
        downloadError={downloadPdf.error?.message}
      />
    </div>
  );
}

function FilterWorkspace({
  draft,
  setDraft,
  sellerOptions,
  onApply,
  onClear,
}: {
  draft: FilterState;
  setDraft: React.Dispatch<React.SetStateAction<FilterState>>;
  sellerOptions: AdminSelectOption[];
  onApply: () => void;
  onClear: () => void;
}) {
  const update = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <section className="border border-[#D8E2EA] bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <AdminListbox
          label="Period"
          value=""
          placeholder="Choose preset"
          options={[
            { value: "", label: "Custom dates" },
            { value: "THIS_MONTH", label: "This month" },
            { value: "LAST_7", label: "Last 7 days" },
            { value: "LAST_30", label: "Last 30 days" },
            { value: "LAST_90", label: "Last 90 days" },
            { value: "ALL_TIME", label: "All time" },
          ]}
          onChange={(value) => {
            const range = orderTaxRegisterPeriodRange(value);
            setDraft((current) => ({ ...current, ...range }));
          }}
          compact
        />
        <AdminListbox
          label="Date basis"
          value={draft.dateBasis}
          options={[
            { value: "DOCUMENT_DATE", label: "Invoice date" },
            { value: "TRANSACTION_DATE", label: "Transaction date" },
            { value: "PAYMENT_DATE", label: "Payment date" },
          ]}
          onChange={(value) =>
            update(
              "dateBasis",
              value as FilterState["dateBasis"],
            )
          }
          compact
        />
        <Field label="From">
          <input
            type="date"
            value={draft.dateFrom}
            onChange={(event) => update("dateFrom", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={draft.dateTo}
            onChange={(event) => update("dateTo", event.target.value)}
            className={inputClass}
          />
        </Field>
        <AdminListbox
          label="Channel"
          value={draft.channel}
          options={
            draft.source === "SERVICE"
              ? [{ value: "B2C", label: "Service bookings" }]
              : [
                  { value: "", label: "B2C and B2B" },
                  { value: "B2C", label: "B2C orders" },
                  { value: "B2B", label: "B2B orders" },
                ]
          }
          onChange={(value) =>
            update("channel", value as FilterState["channel"])
          }
          compact
        />
        <AdminListbox
          label="Seller"
          value={draft.sellerId}
          options={sellerOptions}
          onChange={(value) => update("sellerId", value)}
          compact
        />
        <AdminListbox
          label="Invoice status"
          value={draft.documentStatus}
          options={documentStatuses}
          onChange={(value) => update("documentStatus", value)}
          compact
        />
        <AdminListbox
          label="Readiness"
          value={draft.readinessStatus}
          options={readinessStatuses}
          onChange={(value) => update("readinessStatus", value)}
          compact
        />
        <AdminListbox
          label="Reconciliation"
          value={draft.reconciliationStatus}
          options={reconciliationStatuses}
          onChange={(value) => update("reconciliationStatus", value)}
          compact
        />
        <AdminListbox
          label="Payment"
          value={draft.paymentStatus}
          options={paymentStatuses}
          onChange={(value) => update("paymentStatus", value)}
          compact
        />
        <AdminListbox
          label="Settlement"
          value={draft.settlementStatus}
          options={settlementStatuses}
          onChange={(value) => update("settlementStatus", value)}
          compact
        />
        <AdminListbox
          label="Invoice type"
          value={draft.documentType}
          options={documentTypes}
          onChange={(value) => update("documentType", value)}
          compact
        />
        <AdminListbox
          label="Classification"
          value={draft.taxClassification}
          options={classifications}
          onChange={(value) => update("taxClassification", value)}
          compact
        />
        <AdminListbox
          label="GSTR section"
          value={draft.gstrSupplySection}
          options={gstrSections}
          onChange={(value) => update("gstrSupplySection", value)}
          compact
        />
        <Field label="HSN / SAC">
          <input
            value={draft.hsnSacCode}
            onChange={(event) =>
              update("hsnSacCode", event.target.value)
            }
            className={inputClass}
            placeholder="Code"
          />
        </Field>
        <Field label="GST rate">
          <input
            type="number"
            min="0"
            max="100"
            value={draft.gstRatePercent}
            onChange={(event) =>
              update("gstRatePercent", event.target.value)
            }
            className={inputClass}
            placeholder="%"
          />
        </Field>
        <AdminListbox
          label="E-invoice"
          value={draft.eInvoiceStatus}
          options={complianceStatuses}
          onChange={(value) => update("eInvoiceStatus", value)}
          compact
        />
        <AdminListbox
          label="E-way bill"
          value={draft.eWayBillStatus}
          options={complianceStatuses}
          onChange={(value) => update("eWayBillStatus", value)}
          compact
        />
        <AdminListbox
          label="Reverse charge"
          value={draft.reverseCharge}
          options={[
            { value: "", label: "All supplies" },
            { value: "true", label: "Reverse charge" },
            { value: "false", label: "Normal charge" },
          ]}
          onChange={(value) =>
            update(
              "reverseCharge",
              value as FilterState["reverseCharge"],
            )
          }
          compact
        />
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#98A2B3]"
                aria-hidden="true"
              />
              <input
                value={draft.search}
                onChange={(event) =>
                  update("search", event.target.value)
                }
                className={cn(inputClass, "pl-9")}
                placeholder="Order, invoice, payment, GSTIN, seller, buyer or description"
              />
            </div>
          </Field>
        </div>
      </div>
      <div className="mt-4 border-t border-[#EEF2F6] pt-4">
        <p className="text-xs font-black uppercase text-[#667085]">
          Warning filters
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {warningOptions.map((code) => {
            const selected = draft.warningCodes.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  update(
                    "warningCodes",
                    selected
                      ? draft.warningCodes.filter((item) => item !== code)
                      : [...draft.warningCodes, code],
                  )
                }
                className={cn(
                  "rounded border px-2 py-1 text-xs font-bold",
                  selected
                    ? "border-[#ED3500] bg-[#FFF0EC] text-[#B42318]"
                    : "border-[#D8E2EA] bg-white text-[#667085]",
                )}
              >
                {humanize(code)}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear
          </Button>
          <Button type="button" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      </div>
    </section>
  );
}

function RegisterTable({
  rows,
  visibleColumns,
  filters,
  onSort,
  onView,
  onDownload,
  downloadingId,
}: {
  rows: OrderTaxRegisterRow[];
  visibleColumns: ColumnId[];
  filters: FilterState;
  onSort: (field: OrderTaxRegisterSortField) => void;
  onView: (row: OrderTaxRegisterRow) => void;
  onDownload: (row: OrderTaxRegisterRow) => void;
  downloadingId?: string | null | undefined;
}) {
  const columns: Array<{
    id: ColumnId;
    label: string;
    sort?: OrderTaxRegisterSortField;
    className?: string;
    cell: (row: OrderTaxRegisterRow) => ReactNode;
  }> = [
    {
      id: "transaction",
      label: "Transaction",
      sort: "TRANSACTION",
      className: "sticky left-0 z-20 min-w-44 bg-white",
      cell: (row) => (
        <div>
          <Link
            href={row.detailHref}
            className="font-black text-[#163B5C] hover:text-[#ED3500]"
          >
            {row.transactionNumber}
          </Link>
          <p className="mt-1 text-xs font-semibold text-[#667085]">
            {row.channel} · {row.source}
          </p>
          {row.parentOrderNumber ? (
            <p className="mt-1 text-xs text-[#667085]">
              Parent {row.parentOrderNumber}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "invoice",
      label: "Invoice",
      sort: "INVOICE",
      className: "sticky left-44 z-20 min-w-48 bg-white",
      cell: (row) => (
        <div>
          <p className="font-black text-[#1F2933]">
            {row.documentNumber ?? "Not issued"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <StatusBadge
              tone={row.documentId ? "info" : "warning"}
            >
              {humanize(row.documentType ?? row.valueSource)}
            </StatusBadge>
            {row.documentStatus ? (
              <StatusBadge tone={statusTone(row.documentStatus)}>
                {humanize(row.documentStatus)}
              </StatusBadge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: "date",
      label: "Date",
      sort: "DATE",
      className: "min-w-36",
      cell: (row) => (
        <div className="text-sm font-semibold">
          <p>{formatDate(dateForBasis(row, filters.dateBasis))}</p>
          <p className="mt-1 text-xs text-[#667085]">
            {humanize(filters.dateBasis)}
          </p>
        </div>
      ),
    },
    {
      id: "parties",
      label: "Seller / buyer",
      sort: "SELLER",
      className: "min-w-64",
      cell: (row) => (
        <div className="grid gap-2">
          <div>
            <p className="font-black text-[#1F2933]">{row.sellerName}</p>
            <p className="text-xs text-[#667085]">
              {row.sellerGstin ?? "Not GST registered"}
            </p>
          </div>
          <div className="border-t border-[#EEF2F6] pt-2">
            <p className="font-semibold text-[#344054]">{row.buyerName}</p>
            <p className="text-xs text-[#667085]">
              {row.buyerGstin ?? "Consumer sale"} · POS{" "}
              {row.placeOfSupplyStateCode ?? "-"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "classification",
      label: "HSN / SAC",
      className: "min-w-40",
      cell: (row) => (
        <div>
          <p className="font-black text-[#1F2933]">
            {row.hsnSacCode ?? "Missing"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#667085]">
            {humanize(row.taxClassification)} · {row.gstRatePercent}%
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            {row.quantity} {row.uqc}
          </p>
        </div>
      ),
    },
    {
      id: "description",
      label: "Description",
      className: "min-w-64",
      cell: (row) => (
        <div>
          <p className="font-semibold leading-5 text-[#344054]">
            {row.description}
          </p>
          {row.sku ? (
            <p className="mt-1 text-xs text-[#667085]">SKU {row.sku}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "tax",
      label: "Tax values",
      sort: "TAXABLE_VALUE",
      className: "min-w-64",
      cell: (row) => (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <TaxValue label="Taxable" value={row.taxableValuePaise} />
          <TaxValue label="GST" value={row.totalTaxPaise} />
          <TaxValue label="CGST" value={row.cgstPaise} />
          <TaxValue label="SGST" value={row.sgstPaise} />
          <TaxValue label="IGST" value={row.igstPaise} />
          <TaxValue label="Line value" value={row.lineValuePaise} strong />
        </dl>
      ),
    },
    {
      id: "payment",
      label: "Payment",
      className: "min-w-52",
      cell: (row) => (
        <div>
          <StatusBadge tone={statusTone(row.paymentStatus)}>
            {humanize(row.paymentStatus ?? "MISSING")}
          </StatusBadge>
          <p className="mt-2 font-black text-[#1F2933]">
            {formatMoney(row.paidAmountPaise, row.currency)}
          </p>
          <p className="mt-1 break-all text-xs text-[#667085]">
            {row.paymentReference ?? row.paymentId ?? "No payment reference"}
          </p>
        </div>
      ),
    },
    {
      id: "settlement",
      label: "Settlement",
      className: "min-w-48",
      cell: (row) => (
        <div>
          <StatusBadge tone={statusTone(row.settlementStatus)}>
            {humanize(row.settlementStatus ?? "NOT_AVAILABLE")}
          </StatusBadge>
          <p className="mt-2 text-xs font-semibold text-[#667085]">
            Payout {row.payoutId ?? "not assigned"}
          </p>
        </div>
      ),
    },
    {
      id: "readiness",
      label: "Readiness",
      sort: "READINESS",
      className: "min-w-44",
      cell: (row) => (
        <StatusBadge tone={readinessTone(row.readinessStatus)}>
          {humanize(row.readinessStatus)}
        </StatusBadge>
      ),
    },
    {
      id: "reconciliation",
      label: "Reconciliation",
      sort: "RECONCILIATION",
      className: "min-w-48",
      cell: (row) => (
        <div>
          <StatusBadge tone={reconciliationTone(row.reconciliationStatus)}>
            {humanize(row.reconciliationStatus)}
          </StatusBadge>
          {row.warningCodes.length ? (
            <p className="mt-2 text-xs font-semibold text-[#B42318]">
              {row.warningCodes.length} warning
              {row.warningCodes.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      className: "sticky right-0 z-20 min-w-36 bg-white",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onView(row)}
            aria-label={`View ${row.transactionNumber} tax details`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Link
            href={row.detailHref}
            className="grid h-9 w-9 place-items-center rounded-md text-[#163B5C] hover:bg-[#FFF0EC]"
            aria-label={`Open ${row.transactionNumber}`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
          {row.invoiceDownloadable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDownload(row)}
              disabled={downloadingId === row.documentId}
              aria-label={`Download ${row.documentNumber}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  const shown = columns.filter((column) =>
    visibleColumns.includes(column.id),
  );
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-[1900px] w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-30 bg-[#F8FAFC]">
          <tr className="border-b border-[#D8E2EA]">
            {shown.map((column) => (
              <th
                key={column.id}
                className={cn(
                  "px-3 py-3 text-xs font-black uppercase text-[#667085]",
                  column.className,
                  column.id === "transaction" && "bg-[#F8FAFC]",
                  column.id === "invoice" && "bg-[#F8FAFC]",
                  column.id === "actions" && "bg-[#F8FAFC]",
                )}
              >
                {column.sort ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.sort!)}
                    className="inline-flex items-center gap-1 hover:text-[#ED3500]"
                  >
                    {column.label}
                    {filters.sortBy === column.sort ? (
                      filters.sortDirection === "ASC" ? (
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEF2F6]">
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-[#FFFCFB]">
              {shown.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-3 py-3",
                    column.className,
                    (column.id === "transaction" ||
                      column.id === "invoice" ||
                      column.id === "actions") &&
                      "group-hover:bg-[#FFFCFB]",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegisterDetailsDrawer({
  row,
  onClose,
  onDownload,
  downloading,
  downloadError,
}: {
  row: OrderTaxRegisterRow | null;
  onClose: () => void;
  onDownload: (row: OrderTaxRegisterRow) => void;
  downloading: boolean;
  downloadError?: string | undefined;
}) {
  return (
    <SideDrawer
      open={Boolean(row)}
      onClose={onClose}
      title={row?.documentNumber ?? row?.transactionNumber ?? "Tax line"}
      {...(row
        ? {
            description: `${row.description} · ${humanize(row.valueSource)}`,
          }
        : {})}
      widthClassName="max-w-3xl"
    >
      {row ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={readinessTone(row.readinessStatus)}>
                {humanize(row.readinessStatus)}
              </StatusBadge>
              <StatusBadge
                tone={reconciliationTone(row.reconciliationStatus)}
              >
                {humanize(row.reconciliationStatus)}
              </StatusBadge>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={row.detailHref}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open transaction
                </Link>
              </Button>
              {row.invoiceDownloadable ? (
                <Button
                  type="button"
                  onClick={() => onDownload(row)}
                  disabled={downloading}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download PDF
                </Button>
              ) : null}
            </div>
          </div>
          {downloadError ? <ErrorNotice message={downloadError} /> : null}
          {row.warnings.length ? (
            <section className="border border-[#F6C7B8] bg-[#FFF7F3] p-4">
              <h3 className="text-sm font-black text-[#7A271A]">
                Actionable warnings
              </h3>
              <ul className="mt-3 grid gap-2">
                {row.warnings.map((warning) => (
                  <li key={warning.code} className="text-sm text-[#7A271A]">
                    <strong>{humanize(warning.code)}:</strong>{" "}
                    {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <DrawerSection
            title="Transaction and document"
            rows={[
              ["Transaction", row.transactionNumber],
              ["Channel", row.channel],
              ["Invoice", row.documentNumber ?? "Not issued"],
              ["Invoice type", humanize(row.documentType)],
              ["Invoice date", formatDate(row.documentDate)],
              ["Financial year", row.financialYear ?? "-"],
              ["Original invoice", row.originalDocumentNumber ?? "-"],
              ["Adjustment reason", row.adjustmentReason ?? "-"],
            ]}
          />
          <DrawerSection
            title="Parties and place of supply"
            rows={[
              ["Seller", row.sellerName],
              ["Seller GSTIN", row.sellerGstin ?? "Not registered"],
              ["Buyer", row.buyerName],
              ["Buyer GSTIN", row.buyerGstin ?? "Consumer sale"],
              [
                "Place of supply",
                [row.placeOfSupplyStateCode, row.placeOfSupplyState]
                  .filter(Boolean)
                  .join(" · ") || "-",
              ],
              ["Supply type", humanize(row.supplyType)],
            ]}
          />
          <DrawerSection
            title="Tax line"
            rows={[
              ["HSN / SAC", row.hsnSacCode ?? "Missing"],
              ["Classification", humanize(row.taxClassification)],
              ["Quantity", `${row.quantity} ${row.uqc}`],
              ["GST rate", `${row.gstRatePercent}%`],
              [
                "Taxable value",
                formatMoney(row.taxableValuePaise, row.currency),
              ],
              ["CGST", formatMoney(row.cgstPaise, row.currency)],
              ["SGST", formatMoney(row.sgstPaise, row.currency)],
              ["IGST", formatMoney(row.igstPaise, row.currency)],
              ["Total GST", formatMoney(row.totalTaxPaise, row.currency)],
              ["Line value", formatMoney(row.lineValuePaise, row.currency)],
              [
                "Invoice value",
                formatMoney(row.invoiceValuePaise, row.currency),
              ],
            ]}
          />
          <DrawerSection
            title="Payment and settlement"
            rows={[
              ["Payment status", humanize(row.paymentStatus)],
              ["Payment reference", row.paymentReference ?? row.paymentId ?? "-"],
              [
                "Paid amount",
                formatMoney(row.paidAmountPaise, row.currency),
              ],
              ["Payment date", formatDate(row.paymentDate)],
              ["Settlement status", humanize(row.settlementStatus)],
              ["Payout", row.payoutId ?? "Not assigned"],
            ]}
          />
          <DrawerSection
            title="Compliance and audit"
            rows={[
              ["Value source", humanize(row.valueSource)],
              [
                "Source record",
                [row.sourceRecordType, row.sourceRecordId]
                  .filter(Boolean)
                  .join(" · ") || "-",
              ],
              ["GSTR section", row.gstrSupplySection ?? "-"],
              ["IRN", row.irn ?? "-"],
              ["IRN acknowledgement", row.acknowledgementNumber ?? "-"],
              ["E-way bill", row.eWayBillNumber ?? "-"],
              ["Document created", formatDate(row.documentCreatedAt)],
              ["Issued by", row.createdByAdmin ?? "-"],
              ["Cancelled", formatDate(row.documentCancelledAt)],
              ["Cancellation reason", row.documentCancellationReason ?? "-"],
            ]}
          />
        </div>
      ) : null}
    </SideDrawer>
  );
}

function DrawerSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section>
      <h3 className="border-b border-[#D8E2EA] pb-2 text-sm font-black uppercase text-[#344054]">
        {title}
      </h3>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-[#EEF2F6] pb-3">
            <dt className="text-xs font-black uppercase text-[#667085]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-[#1F2933]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className="min-w-0 border-b border-r border-[#EEF2F6] px-4 py-4">
      <p className="text-xs font-black uppercase text-[#667085]">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-xl font-black text-[#1F2933]",
          tone === "success" && "text-[#067647]",
          tone === "warning" && "text-[#B54708]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TaxValue({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <Fragment>
      <dt className="text-[#667085]">{label}</dt>
      <dd
        className={cn(
          "text-right font-semibold text-[#344054]",
          strong && "font-black text-[#1F2933]",
        )}
      >
        {formatMoney(value, "INR")}
      </dd>
    </Fragment>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase text-[#667085]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TableState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-64 place-items-center px-4 py-10 text-center">
      <div>
        <FileSpreadsheet
          className="mx-auto h-8 w-8 text-[#98A2B3]"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-bold text-[#667085]">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <p className="border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm font-bold text-[#B42318]">
      {message}
    </p>
  );
}

function defaultFilters(
  source: OrderTaxRegisterSource = "PRODUCT",
): FilterState {
  const today = isoDate(new Date());
  const start = new Date();
  start.setDate(1);
  return {
    source,
    channel: source === "SERVICE" ? "B2C" : "",
    dateBasis: "DOCUMENT_DATE",
    dateFrom: isoDate(start),
    dateTo: today,
    sellerId: "",
    documentStatus: "",
    documentType: "",
    readinessStatus: "",
    reconciliationStatus: "",
    paymentStatus: "",
    settlementStatus: "",
    taxClassification: "",
    gstrSupplySection: "",
    eInvoiceStatus: "",
    eWayBillStatus: "",
    hsnSacCode: "",
    gstRatePercent: "",
    reverseCharge: "",
    warningCodes: [],
    search: "",
    sortBy: "DATE",
    sortDirection: "DESC",
    page: 1,
    limit: 50,
  };
}

function filtersFromParams(params: URLSearchParams | ReadonlyURLSearchParams) {
  const source =
    params.get("source") === "SERVICE" ? "SERVICE" : "PRODUCT";
  const defaults = defaultFilters(source);
  const value = (key: string) => params.get(key) ?? "";
  return {
    ...defaults,
    channel:
      value("channel") === "B2B"
        ? "B2B"
        : value("channel") === "B2C"
          ? "B2C"
          : defaults.channel,
    dateBasis: (value("dateBasis") ||
      defaults.dateBasis) as FilterState["dateBasis"],
    dateFrom: value("dateFrom") || defaults.dateFrom,
    dateTo: value("dateTo") || defaults.dateTo,
    sellerId: value("sellerId"),
    documentStatus: value("documentStatus"),
    documentType: value("documentType"),
    readinessStatus: value("readinessStatus"),
    reconciliationStatus: value("reconciliationStatus"),
    paymentStatus: value("paymentStatus"),
    settlementStatus: value("settlementStatus"),
    taxClassification: value("taxClassification"),
    gstrSupplySection: value("gstrSupplySection"),
    eInvoiceStatus: value("eInvoiceStatus"),
    eWayBillStatus: value("eWayBillStatus"),
    hsnSacCode: value("hsnSacCode"),
    gstRatePercent: value("gstRatePercent"),
    reverseCharge: value(
      "reverseCharge",
    ) as FilterState["reverseCharge"],
    warningCodes: value("warningCodes").split(",").filter(Boolean),
    search: value("search"),
    sortBy: (value("sortBy") ||
      defaults.sortBy) as FilterState["sortBy"],
    sortDirection: (value("sortDirection") ||
      defaults.sortDirection) as FilterState["sortDirection"],
    page: Math.max(1, Number(value("page")) || 1),
    limit: [25, 50, 100].includes(Number(value("limit")))
      ? Number(value("limit"))
      : defaults.limit,
  } satisfies FilterState;
}

function options(label: string, values: string[]): AdminSelectOption[] {
  return [
    { value: "", label },
    ...values.map((value) => ({ value, label: humanize(value) })),
  ];
}

function dateForBasis(
  row: OrderTaxRegisterRow,
  basis: FilterState["dateBasis"],
) {
  if (basis === "PAYMENT_DATE") return row.paymentDate;
  if (basis === "TRANSACTION_DATE") return row.transactionDate;
  return row.documentDate ?? row.transactionDate;
}

function readinessTone(value: OrderTaxReadinessStatus) {
  if (value === "READY" || value === "NOT_REQUIRED") return "success";
  if (
    value === "MISSING_DOCUMENT" ||
    value === "INCOMPLETE_DOCUMENT"
  ) {
    return "danger";
  }
  return "warning";
}

function reconciliationTone(value: OrderTaxReconciliationStatus) {
  if (value === "MATCHED") return "success";
  if (value === "MISMATCH") return "danger";
  if (value === "PARTIAL") return "warning";
  return "neutral";
}

function statusTone(value?: string | null) {
  if (
    ["PAID", "ISSUED", "READY", "GENERATED", "APPROVED", "ELIGIBLE"].includes(
      value ?? "",
    )
  ) {
    return "success";
  }
  if (
    ["FAILED", "CANCELLED", "REJECTED", "MISMATCH", "MISSING"].includes(
      value ?? "",
    )
  ) {
    return "danger";
  }
  if (
    ["PENDING", "PARTIALLY_PAID", "DRAFT", "DRAFTED"].includes(
      value ?? "",
    )
  ) {
    return "warning";
  }
  return "neutral";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const inputClass =
  "h-9 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white";

type ReadonlyURLSearchParams = ReturnType<typeof useSearchParams>;
