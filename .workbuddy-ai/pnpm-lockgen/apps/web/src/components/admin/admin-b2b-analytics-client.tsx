"use client";

import { FormEvent, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Building2, IndianRupee, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch, type IndihubAuthHeaders, userFacingApiErrorMessage } from "@/lib/api";

type B2BAnalytics = {
  totalEnquiries: number;
  confirmedOrders: number;
  conversionRate: number;
  averageOrderValuePaise: number;
  totalCommissionEarnedPaise: number;
  totalConfirmedOrderValuePaise: number;
  averageNegotiationMessages: number;
  offPlatformRiskCount: number;
  enquiriesByStatus: Record<string, number>;
  topBuyers: Array<{
    id: string;
    companyName: string;
    email?: string | null;
    confirmedOrderValuePaise: number;
    orderCount: number;
  }>;
  topSellers: Array<{
    id?: string | null;
    storeName: string;
    email?: string | null;
    confirmedOrderValuePaise: number;
    orderCount: number;
  }>;
};

const b2bStatuses = [
  "SUBMITTED",
  "IN_REVIEW",
  "RESPONDED",
  "NEGOTIATING",
  "BUYER_CONFIRMED",
  "ADMIN_APPROVED",
  "FINALISED",
  "CLOSED",
  "CANCELLED",
];

export function AdminB2BAnalyticsPageClient() {
  const auth = useAdminAuth();
  const defaultRange = useMemo(() => currentMonthRange(), []);
  const [range, setRange] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);

  const query = useQuery({
    queryKey: ["admin-b2b-analytics", auth.authHeaders, appliedRange.from, appliedRange.to],
    enabled: Boolean(auth.authHeaders.bearerToken),
    queryFn: () => getAdminB2BAnalytics(auth.authHeaders, appliedRange),
  });

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedRange(range);
  }

  const analytics = query.data;

  return (
    <div className="grid gap-5">
      <form onSubmit={applyRange} className="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black text-[#1F2933]">Date range</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Analytics use enquiry/order creation dates in the selected window.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[#667085]">
            From
            <input
              type="date"
              value={range.from.slice(0, 10)}
              onChange={(event) => setRange((current) => ({ ...current, from: isoStart(event.target.value) }))}
              className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[#667085]">
            To
            <input
              type="date"
              value={range.to.slice(0, 10)}
              onChange={(event) => setRange((current) => ({ ...current, to: isoEnd(event.target.value) }))}
              className="h-11 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <Button type="submit">Apply</Button>
        </div>
      </form>

      {query.error ? (
        <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4 text-sm font-semibold text-[#8A1F1F]">
          {userFacingApiErrorMessage(query.error)}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Building2} label="Total enquiries" value={analytics?.totalEnquiries ?? 0} note="Submitted in range" />
        <MetricCard icon={BarChart3} label="Confirmed orders" value={analytics?.confirmedOrders ?? 0} note={`${formatPercent(analytics?.conversionRate ?? 0)} conversion`} />
        <MetricCard icon={IndianRupee} label="Commission earned" value={formatPaise(analytics?.totalCommissionEarnedPaise ?? 0)} note={`${formatPaise(analytics?.averageOrderValuePaise ?? 0)} avg order`} />
        <MetricCard icon={AlertTriangle} label="Off-platform risk" value={analytics?.offPlatformRiskCount ?? 0} note="Cancelled after negotiation signals" tone="risk" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Enquiries by status</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Operational status split for the selected range.</p>
            </div>
            <StatusBadge tone="info">{analytics?.averageNegotiationMessages.toFixed(1) ?? "0.0"} avg messages</StatusBadge>
          </div>
          <div className="mt-5 grid gap-3">
            {b2bStatuses.map((status) => {
              const value = analytics?.enquiriesByStatus?.[status] ?? 0;
              const total = analytics?.totalEnquiries ?? 0;
              const width = total ? Math.max(4, (value / total) * 100) : 0;
              return (
                <div key={status} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm font-bold text-[#1F2933]">
                    <span>{humanize(status)}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#EEF3F7]">
                    <div className="h-full rounded-full bg-[#ED3500]" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Activity className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Revenue signal</h2>
              <p className="text-sm font-semibold text-[#667085]">Confirmed B2B order value and platform take.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085]">
            <InfoRow label="Confirmed order value" value={formatPaise(analytics?.totalConfirmedOrderValuePaise ?? 0)} />
            <InfoRow label="Average order value" value={formatPaise(analytics?.averageOrderValuePaise ?? 0)} />
            <InfoRow label="Commission earned" value={formatPaise(analytics?.totalCommissionEarnedPaise ?? 0)} />
            <InfoRow label="Conversion rate" value={formatPercent(analytics?.conversionRate ?? 0)} />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Leaderboard title="Top buyers" icon={UsersRound} rows={analytics?.topBuyers ?? []} nameKey="companyName" />
        <Leaderboard title="Top sellers" icon={Building2} rows={analytics?.topSellers ?? []} nameKey="storeName" />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "normal",
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  note: string;
  tone?: "normal" | "risk";
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <span className={`grid h-10 w-10 place-items-center rounded-md ${tone === "risk" ? "bg-[#FDECEC] text-[#D64545]" : "bg-[#EAF1F7] text-[#163B5C]"}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#163B5C]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p>
    </section>
  );
}

function Leaderboard<T extends { id?: string | null; email?: string | null; confirmedOrderValuePaise: number; orderCount: number }>({
  title,
  icon: Icon,
  rows,
  nameKey,
}: {
  title: string;
  icon: typeof Building2;
  rows: T[];
  nameKey: keyof T;
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id ?? String(row[nameKey])} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#1F2933]">{String(row[nameKey] ?? "Not available")}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-[#667085]">{row.email ?? "Email unavailable"}</p>
                </div>
                <StatusBadge tone="success">{formatPaise(row.confirmedOrderValuePaise)}</StatusBadge>
              </div>
              <p className="mt-2 text-xs font-semibold text-[#667085]">{row.orderCount} confirmed order{row.orderCount === 1 ? "" : "s"}</p>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            No confirmed B2B orders in this range.
          </p>
        )}
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-[#F8FAFC] px-3 py-2">
      <span>{label}</span>
      <span className="font-black text-[#1F2933]">{value}</span>
    </div>
  );
}

function getAdminB2BAnalytics(auth: IndihubAuthHeaders, query: { from: string; to: string }) {
  const params = new URLSearchParams(query);
  return indihubFetch<B2BAnalytics>(`/api/admin/b2b/analytics?${params.toString()}`, undefined, auth);
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function isoStart(date: string) {
  return date ? new Date(`${date}T00:00:00.000`).toISOString() : "";
}

function isoEnd(date: string) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : "";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPaise(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
