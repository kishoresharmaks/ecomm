"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import {
  getReportTable,
  reportPresetRange,
  type ReportExportAudience,
  type ReportExportType,
  type ReportFilters,
  type ReportPeriodPreset,
  type ReportTablePage,
} from "@/lib/report-exports-api";
import { ReportExportButton } from "./report-export-button";

export type ReportMetric = {
  label: string;
  value: string | number;
  note?: string;
};

type ReportResponse = {
  table: ReportTablePage;
  [key: string]: unknown;
};

const presets = [
  ["THIS_MONTH", "This month"],
  ["LAST_7_DAYS", "Last 7 days"],
  ["LAST_30_DAYS", "Last 30 days"],
  ["LAST_90_DAYS", "Last 90 days"],
  ["ALL_TIME", "All time"],
] as const satisfies ReadonlyArray<readonly [ReportPeriodPreset, string]>;

export function OperationalReportWorkspace({
  auth,
  endpoint,
  exportType,
  audience,
  exportsHref,
  searchPlaceholder = "Search report records",
  statusOptions = [],
  metrics,
}: {
  auth: IndihubAuthHeaders;
  endpoint: string;
  exportType: ReportExportType;
  audience: ReportExportAudience;
  exportsHref: string;
  searchPlaceholder?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  metrics?: (data: ReportResponse) => ReportMetric[];
}) {
  const [draft, setDraft] = useState<ReportFilters>({ page: 1, limit: 50 });
  const [filters, setFilters] = useState<ReportFilters>({ page: 1, limit: 50 });
  const [activePreset, setActivePreset] = useState<string>("ALL_TIME");
  const query = useQuery({
    queryKey: ["operational-report", endpoint, filters],
    queryFn: () => getReportTable<ReportResponse>(auth, endpoint, filters),
  });
  const table = query.data?.table;
  const summary = useMemo(() => (query.data && metrics ? metrics(query.data) : []), [metrics, query.data]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...draft, page: 1 });
  }

  function usePreset(preset: ReportPeriodPreset) {
    const range = reportPresetRange(preset);
    const next = { ...draft, ...range, page: 1 };
    setActivePreset(preset);
    setDraft(next);
    setFilters(next);
  }

  return (
    <div className="grid gap-4">
      <section className="border-y border-[#E5E7EB] bg-white px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {presets.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => usePreset(value)}
              className={`h-9 rounded-md border px-3 text-sm font-semibold transition ${
                activePreset === value
                  ? "border-[#ED3500] bg-[#FFF0EC] text-[#C72D00]"
                  : "border-[#D8E2EA] bg-white text-[#475467] hover:border-[#ED3500]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={apply} className="mt-3 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_170px_170px_190px_auto]">
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
            <input
              value={draft.search ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            />
          </label>
          <input
            type="date"
            value={draft.dateFrom ?? ""}
            onChange={(event) => {
              setActivePreset("CUSTOM");
              setDraft((current) => ({ ...current, dateFrom: event.target.value }));
            }}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            aria-label="Date from"
          />
          <input
            type="date"
            value={draft.dateTo ?? ""}
            onChange={(event) => {
              setActivePreset("CUSTOM");
              setDraft((current) => ({ ...current, dateTo: event.target.value }));
            }}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            aria-label="Date to"
          />
          <select
            value={draft.status ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
            className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Button type="submit">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Apply
          </Button>
        </form>
      </section>

      {summary.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <article key={item.label} className="border-l-4 border-[#ED3500] bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#667085]">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-[#1F2933]">{item.value}</p>
              {item.note ? <p className="mt-1 text-xs font-semibold text-[#667085]">{item.note}</p> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-[#1F2933]">Complete report register</p>
            <p className="text-xs font-semibold text-[#667085]">
              {table ? `${table.pageInfo.total.toLocaleString("en-IN")} records` : "Loading records"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <ReportExportButton auth={auth} audience={audience} exportType={exportType} filters={filters} />
            <Button asChild variant="secondary">
              <Link href={exportsHref}>Export history</Link>
            </Button>
          </div>
        </div>

        {query.isError ? (
          <div className="p-6 text-center">
            <p className="text-sm font-bold text-[#B42318]">{userFacingApiErrorMessage(query.error)}</p>
            <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Try again</Button>
          </div>
        ) : query.isLoading ? (
          <div className="grid min-h-56 place-items-center text-sm font-semibold text-[#667085]">Loading report records...</div>
        ) : table && table.items.length ? (
          <>
            <div className="max-h-[64vh] overflow-auto">
              <table className="min-w-max w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#163B5C] text-white">
                  <tr>
                    {table.headers.map((header) => (
                      <th key={header} className="whitespace-nowrap border-r border-white/10 px-3 py-3 font-bold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {table.items.map((row, index) => (
                    <tr key={`${table.pageInfo.page}-${index}`} className="hover:bg-[#FFFCFB]">
                      {table.headers.map((header) => (
                        <td key={header} className="max-w-72 whitespace-nowrap px-3 py-2.5 font-medium text-[#344054]">
                          <ReportCell
                            header={header}
                            value={row[header]}
                            money={table.moneyHeaders.includes(header)}
                            currency={typeof row.Currency === "string" ? row.Currency : "INR"}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={table.pageInfo.page}
              totalPages={table.pageInfo.totalPages}
              onPage={(page) => setFilters((current) => ({ ...current, page }))}
            />
          </>
        ) : (
          <div className="grid min-h-56 place-items-center px-4 text-center">
            <div>
              <p className="font-black text-[#1F2933]">No matching records</p>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Adjust the filters or select a wider period.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ReportCell({ header, value, money, currency }: { header: string; value: unknown; money: boolean; currency: string }) {
  if (value === null || value === undefined || value === "") return <span className="text-[#98A2B3]">-</span>;
  if (money) {
    const amount = Number(value);
    return <span className="font-bold text-[#163B5C]">{Number.isFinite(amount) ? formatMoney(amount, currency) : String(value)}</span>;
  }
  if (/status|classification|provider|type|mode/i.test(header)) {
    return <StatusBadge tone={statusTone(String(value))}>{humanize(String(value))}</StatusBadge>;
  }
  if (/date| at$/i.test(header) && !Number.isNaN(Date.parse(String(value)))) {
    return <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)))}</span>;
  }
  return <span className="block max-w-72 truncate" title={String(value)}>{String(value)}</span>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
      <p className="text-xs font-semibold text-[#667085]">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function statusTone(value: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (/paid|complete|approved|active|delivered|verified|settled|issued/i.test(value)) return "success";
  if (/fail|reject|cancel|expired|suspend/i.test(value)) return "danger";
  if (/pending|processing|review|eligible|open/i.test(value)) return "warning";
  return "info";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(amount: number, currency: string) {
  try {
    return amount.toLocaleString("en-IN", { style: "currency", currency });
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
}
