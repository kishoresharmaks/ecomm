"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Button, cn } from "@indihub/ui";
import { ReturnStatusBadge, formatShortDate } from "@/components/returns/returns-workspace-ui";
import {
  listSellerReturns,
  type ReturnRequestStatus,
  type ReturnSummary,
  type SellerReturnQueueSummary,
} from "@/lib/returns-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerCursorPagination,
  SellerErrorPanel,
  SellerOnboardingRequired,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";
import { PackageCheck } from "lucide-react";

type ReturnFilterKey = "ALL" | "PENDING" | "APPROVED" | "REFUNDED" | "REJECTED" | "CANCELLED";

const returnFilters: Array<{ key: ReturnFilterKey; label: string; status?: ReturnRequestStatus }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending", status: "PENDING_REVIEW" },
  { key: "APPROVED", label: "Approved", status: "APPROVED" },
  { key: "REFUNDED", label: "Refunded", status: "RESOLVED" },
  { key: "REJECTED", label: "Rejected", status: "REJECTED" },
  { key: "CANCELLED", label: "Cancelled", status: "CANCELLED" },
];

export function SellerReturnsClient() {
  const sellerAuth = useSellerAuth();
  const [filter, setFilter] = useState<ReturnFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);

  const activeFilter = returnFilters.find((item) => item.key === filter);

  const returnsQuery = useQuery({
    queryKey: ["seller-returns", sellerAuth.authKey, activeFilter?.status ?? "ALL", submittedSearch, cursor],
    queryFn: () =>
      listSellerReturns(sellerAuth.authHeaders, {
        ...(activeFilter?.status ? { status: activeFilter.status } : {}),
        search: submittedSearch,
        limit: 30,
        ...(cursor ? { cursor } : {}),
      }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const returns = returnsQuery.data?.items ?? [];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    setCursor(null);
    setCursorHistory([]);
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (returnsQuery.error && isSellerOnboardingRequiredError(returnsQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before reviewing return requests." />;
  }

  return (
    <div className="space-y-6">
      <ReturnsHeader
        search={search}
        setSearch={setSearch}
        onSubmit={submitSearch}
        onRefresh={() => void returnsQuery.refetch()}
        isRefreshing={returnsQuery.isFetching}
      />

      <ReturnsStats summary={returnsQuery.data?.summary} isLoading={returnsQuery.isLoading} />

      <section className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm shadow-slate-200/70">
        <ReturnFilters
          activeFilter={filter}
          onChange={(nextFilter) => {
            setFilter(nextFilter);
            setCursor(null);
            setCursorHistory([]);
          }}
        />
        <ReturnList
          loading={returnsQuery.isLoading}
          error={returnsQuery.error as Error | null}
          onRetry={() => void returnsQuery.refetch()}
          returns={returns}
        />
        <SellerCursorPagination
          hasPreviousPage={cursorHistory.length > 0}
          hasNextPage={Boolean(returnsQuery.data?.pageInfo?.hasNextPage && returnsQuery.data.pageInfo.nextCursor)}
          isLoading={returnsQuery.isFetching}
          onPreviousPage={() => {
            const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;
            setCursorHistory((current) => current.slice(0, -1));
            setCursor(previousCursor);
          }}
          onNextPage={() => {
            const nextCursor = returnsQuery.data?.pageInfo?.nextCursor ?? null;
            if (!nextCursor) return;
            setCursorHistory((current) => [...current, cursor]);
            setCursor(nextCursor);
          }}
        />
      </section>
    </div>
  );
}

function ReturnsHeader({
  search,
  setSearch,
  onSubmit,
  onRefresh,
  isRefreshing,
}: {
  search: string;
  setSearch: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <form onSubmit={onSubmit} className="min-w-0 sm:w-[360px]">
        <label className="relative block">
          <span className="sr-only">Search seller returns</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, return ID, customer, SKU, product..."
            className="h-12 w-full rounded-2xl border border-[#CBD5E1] bg-white pl-11 pr-4 text-sm font-semibold text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#ED5A2F] focus:ring-4 focus:ring-[#FED7CA]"
          />
        </label>
      </form>
      <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
        Refresh
      </Button>
    </div>
  );
}

function ReturnsStats({ summary, isLoading }: { summary: SellerReturnQueueSummary | undefined; isLoading: boolean }) {
  type ReturnStatTone = "orange" | "blue" | "green" | "violet" | "red";
  const cards: Array<{
    label: string;
    value: number;
    trend: string;
    icon: typeof RotateCcw;
    tone: ReturnStatTone;
  }> = [
    { label: "Total Returns", value: summary?.total ?? 0, trend: "All cases", icon: RotateCcw, tone: "orange" },
    { label: "Pending Review", value: summary?.pending ?? 0, trend: "Needs action", icon: ClipboardCheck, tone: "blue" },
    { label: "Approved", value: summary?.approved ?? 0, trend: "In progress", icon: CheckCircle2, tone: "green" },
    { label: "Refunded", value: summary?.refunded ?? 0, trend: "Resolved", icon: WalletCards, tone: "violet" },
    { label: "Rejected", value: summary?.rejected ?? 0, trend: "Closed", icon: XCircle, tone: "red" },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm shadow-slate-200/70 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <span className={cn("grid h-11 w-11 place-items-center rounded-full", statToneClass(card.tone))}>
              <card.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-black text-[#64748B]">{card.trend}</span>
          </div>
          <p className="mt-5 text-sm font-bold text-[#475569]">{card.label}</p>
          <p className="mt-1 text-3xl font-black text-[#0F172A]">{isLoading ? "-" : card.value.toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[13px] font-semibold text-[#64748B]">from complete return history</p>
        </article>
      ))}
    </div>
  );
}

function ReturnFilters({ activeFilter, onChange }: { activeFilter: ReturnFilterKey; onChange: (value: ReturnFilterKey) => void }) {
  return (
    <div className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-white/95 px-4 pt-4 backdrop-blur">
      <div role="tablist" aria-label="Return status filters" className="flex gap-7 overflow-x-auto">
        {returnFilters.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={activeFilter === item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative shrink-0 pb-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED5A2F]",
              activeFilter === item.key ? "text-[#ED5A2F]" : "text-[#475569] hover:text-[#0F172A]",
            )}
          >
            {item.label}
            <span className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-center rounded-full bg-[#ED5A2F] transition-transform duration-200", activeFilter === item.key ? "scale-x-100" : "scale-x-0")} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReturnList({
  loading,
  error,
  onRetry,
  returns,
}: {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  returns: ReturnSummary[];
}) {
  return (
    <div className="max-h-[calc(100vh-330px)] min-h-[620px] overflow-y-auto p-3">
      {loading ? <QueueSkeleton /> : null}
      {error ? <SellerErrorPanel error={error} onRetry={onRetry} /> : null}
      {!loading && !error && !returns.length ? (
        <SellerEmptyState title="No return requests" message="Return cases involving this store will appear here after customers raise eligible return or replacement requests." />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {returns.map((request) => (
          <ReturnCard
            key={request.id}
            request={request}
          />
        ))}
      </div>
    </div>
  );
}

function ReturnCard({ request }: { request: ReturnSummary }) {
  const firstItem = request.items[0];

  return (
    <Link
      href={`/seller/returns/${encodeURIComponent(request.requestNumber)}`}
      className={cn(
        "block w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#ED5A2F] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED5A2F]",
        "border-[#E2E8F0]",
        "relative overflow-hidden",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-[#ED5A2F]">{request.requestNumber}</p>
          <p className="mt-1 text-xs font-bold text-[#2563EB]">Order ID: {request.order.orderNumber}</p>
          <p className="mt-1 text-sm font-black text-[#0F172A]">{request.customerName ?? request.customerEmail ?? "Customer"}</p>
        </div>
        <ReturnStatusBadge status={request.status} />
      </div>
      <div className="mt-4 flex gap-3">
        <ProductThumb label={firstItem?.productName ?? request.reason} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-black leading-5 text-[#0F172A]">{firstItem?.productName ?? request.reason}</p>
          <p className="mt-1 text-xs font-semibold text-[#64748B]">Reason: {request.reason}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <span className="text-xs font-bold text-[#64748B]">{formatShortDate(request.createdAt)}</span>
            <span className="text-sm font-black text-[#0F172A]">{formatMoney(request.requestedAmountPaise, request.currency)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProductThumb({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFC] to-[#FFF0EC] text-[#ED5A2F]",
        "h-16 w-16",
      )}
      aria-label={`${label} product image placeholder`}
      role="img"
    >
      <PackageCheck className={cn("h-6 w-6")} aria-hidden="true" />
    </span>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <div className="h-36 animate-pulse rounded-2xl bg-[#F8FAFC]" />
      <div className="h-36 animate-pulse rounded-2xl bg-[#F8FAFC]" />
      <div className="h-36 animate-pulse rounded-2xl bg-[#F8FAFC]" />
    </div>
  );
}

function statToneClass(tone: "orange" | "blue" | "green" | "violet" | "red") {
  return {
    orange: "bg-[#FFF0EC] text-[#ED5A2F]",
    blue: "bg-[#EFF6FF] text-[#2563EB]",
    green: "bg-[#DCFCE7] text-[#16A34A]",
    violet: "bg-[#F5F3FF] text-[#7C3AED]",
    red: "bg-[#FEE2E2] text-[#EF4444]",
  }[tone];
}
