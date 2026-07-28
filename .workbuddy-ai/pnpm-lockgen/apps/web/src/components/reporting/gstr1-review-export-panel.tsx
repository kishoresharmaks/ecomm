"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Building2, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@indihub/ui";
import { userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";
import type { GstReviewSellerOption } from "@/lib/gst-report-api";
import {
  createReportExport,
  gstr1ReviewMonthRange,
  gstr1ReviewQuarterRange,
  type ReportExportAudience,
  type ReportExportType,
} from "@/lib/report-exports-api";

export function Gstr1ReviewExportPanel({
  auth,
  audience,
  sellers,
  sellersLoading,
}: {
  auth: IndihubAuthHeaders;
  audience: Extract<ReportExportAudience, "admin" | "finance">;
  sellers: GstReviewSellerOption[];
  sellersLoading: boolean;
}) {
  const [periodKind, setPeriodKind] = useState<"MONTH" | "QUARTER">("MONTH");
  const [month, setMonth] = useState(previousMonth());
  const [quarter, setQuarter] = useState(previousQuarter().quarter);
  const [quarterYear, setQuarterYear] = useState(previousQuarter().year);
  const [sellerId, setSellerId] = useState("");
  const [message, setMessage] = useState("");
  const period = useMemo(() => {
    try {
      return {
        range:
          periodKind === "MONTH"
            ? gstr1ReviewMonthRange(month)
            : gstr1ReviewQuarterRange(quarterYear, quarter),
        error: "",
      };
    } catch (error) {
      return {
        range: null,
        error: error instanceof Error ? error.message : "Select a valid review period.",
      };
    }
  }, [month, periodKind, quarter, quarterYear]);
  const create = useMutation({
    mutationFn: ({
      exportType,
      selectedSellerId,
    }: {
      exportType: ReportExportType;
      selectedSellerId?: string;
    }) => {
      if (!period.range) throw new Error(period.error);
      return createReportExport(auth, audience, exportType, {
        ...period.range,
        ...(selectedSellerId ? { sellerId: selectedSellerId } : {}),
      });
    },
    onSuccess: () => setMessage("Export queued. It will appear in report export history."),
    onMutate: () => setMessage(""),
  });

  const queue = (exportType: ReportExportType, selectedSellerId?: string) =>
    create.mutate({
      exportType,
      ...(selectedSellerId ? { selectedSellerId } : {}),
    });

  return (
    <section className="border-y border-[#D8E2EA] bg-white px-4 py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">
            GSTR-1 accountant review workbooks
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
            Generate the 16-sheet review format for a complete calendar month or GST
            quarter. These files support accountant review and are not GST portal upload files.
          </p>
        </div>
        <div
          className="inline-flex w-fit rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-1"
          aria-label="GSTR-1 period type"
        >
          {(["MONTH", "QUARTER"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={periodKind === kind}
              onClick={() => setPeriodKind(kind)}
              className={`h-9 rounded px-3 text-xs font-black ${
                periodKind === kind
                  ? "bg-[#ED3500] text-white"
                  : "text-[#475467] hover:bg-white"
              }`}
            >
              {kind === "MONTH" ? "Month" : "Quarter"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(260px,1fr)]">
        {periodKind === "MONTH" ? (
          <Field label="Calendar month">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={inputClass}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input
                type="number"
                min="2000"
                max="2100"
                value={quarterYear}
                onChange={(event) => setQuarterYear(Number(event.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Quarter">
              <select
                value={quarter}
                onChange={(event) => setQuarter(Number(event.target.value))}
                className={inputClass}
              >
                <option value={1}>Jan-Mar</option>
                <option value={2}>Apr-Jun</option>
                <option value={3}>Jul-Sep</option>
                <option value={4}>Oct-Dec</option>
              </select>
            </Field>
          </div>
        )}

        <Field label="GST-registered seller">
          <select
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            className={inputClass}
            disabled={sellersLoading}
          >
            <option value="">
              {sellersLoading ? "Loading sellers..." : "Select seller for individual workbook"}
            </option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.storeName} - {seller.gstin}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mt-3 text-xs font-bold text-[#667085]">
        {period.range
          ? `Selected period: ${period.range.dateFrom} to ${period.range.dateTo}`
          : period.error}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => queue("GSTR1_REVIEW_SELLER_XLSX", sellerId)}
          disabled={!sellerId || !period.range || create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          )}
          Seller workbook
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => queue("GSTR1_REVIEW_ALL_SELLERS_ZIP")}
          disabled={!period.range || create.isPending}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          All-seller ZIP
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => queue("GSTR1_REVIEW_PLATFORM_XLSX")}
          disabled={!period.range || create.isPending}
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Platform workbook
        </Button>
      </div>

      {create.isError ? (
        <p className="mt-3 text-sm font-bold text-[#B42318]">
          {userFacingApiErrorMessage(create.error)}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm font-bold text-[#0F8A5F]">
          {message}{" "}
          <Link
            href={audience === "admin" ? "/admin/reports/exports" : "/finance/exports"}
            className="underline"
          >
            Open export history
          </Link>
        </p>
      ) : null}
    </section>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

function previousMonth() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 7);
}

function previousQuarter() {
  const date = new Date();
  const currentQuarter = Math.floor(date.getMonth() / 3) + 1;
  return currentQuarter === 1
    ? { year: date.getFullYear() - 1, quarter: 4 }
    : { year: date.getFullYear(), quarter: currentQuarter - 1 };
}
