"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileText,
  ImageIcon,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Button, cn } from "@indihub/ui";
import {
  EmptyReturnPanel,
  ResolutionBadge,
  ReturnStatusBadge,
  WorkspaceNotice,
  formatDateTime,
  formatShortDate,
  humanize,
} from "@/components/returns/returns-workspace-ui";
import {
  addSellerReturnNote,
  acceptSellerReturn,
  getSellerReturn,
  listSellerReturns,
  rejectSellerReturn,
  type ReturnDetail,
  type ReturnRequestStatus,
  type ReturnSummary,
} from "@/lib/returns-api";
import { openPrivateProofReference } from "@/lib/delivery-proof-upload";
import { formatVariantLabel } from "@/lib/order-variant";
import { formatMoney } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerOnboardingRequired,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";

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
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReturnFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedRequestNumber, setSelectedRequestNumber] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const activeFilter = returnFilters.find((item) => item.key === filter);

  const statsQuery = useQuery({
    queryKey: ["seller-returns", "stats", sellerAuth.authKey],
    queryFn: () => listSellerReturns(sellerAuth.authHeaders, { limit: 100 }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const returnsQuery = useQuery({
    queryKey: ["seller-returns", sellerAuth.authKey, activeFilter?.status ?? "ALL", submittedSearch],
    queryFn: () =>
      listSellerReturns(sellerAuth.authHeaders, {
        ...(activeFilter?.status ? { status: activeFilter.status } : {}),
        search: submittedSearch,
        limit: 30,
      }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const returns = returnsQuery.data?.items ?? [];
  const statsItems = statsQuery.data?.items ?? returns;

  useEffect(() => {
    if (!returns.length) {
      setSelectedRequestNumber("");
      return;
    }
    if (!selectedRequestNumber || !returns.some((item) => item.requestNumber === selectedRequestNumber)) {
      setSelectedRequestNumber(returns[0]?.requestNumber ?? "");
    }
  }, [returns, selectedRequestNumber]);

  const detailQuery = useQuery({
    queryKey: ["seller-return-detail", sellerAuth.authKey, selectedRequestNumber],
    queryFn: () => getSellerReturn(sellerAuth.authHeaders, selectedRequestNumber),
    enabled: sellerAuth.enabled && Boolean(selectedRequestNumber),
    retry: false,
  });

  const noteMutation = useMutation({
    mutationFn: (requestNumber: string) =>
      addSellerReturnNote(sellerAuth.authHeaders, requestNumber, { note: note.trim() }),
    onSuccess: (detail) => {
      setNotice("Seller note added.");
      setNote("");
      setSelectedRequestNumber(detail.requestNumber);
      void queryClient.invalidateQueries({ queryKey: ["seller-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-return-detail"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to add seller note."),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ requestNumber, decision }: { requestNumber: string; decision: "ACCEPT" | "REJECT" }) => {
      const cleanNote = note.trim();
      const payload = cleanNote ? { note: cleanNote } : {};
      return decision === "ACCEPT"
        ? acceptSellerReturn(sellerAuth.authHeaders, requestNumber, payload)
        : rejectSellerReturn(sellerAuth.authHeaders, requestNumber, payload);
    },
    onSuccess: (detail, variables) => {
      setNotice(variables.decision === "ACCEPT" ? "Return request accepted by seller." : "Return request rejected by seller.");
      setNote("");
      setSelectedRequestNumber(detail.requestNumber);
      void queryClient.invalidateQueries({ queryKey: ["seller-returns"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-return-detail"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update seller return decision."),
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (returnsQuery.error && isSellerOnboardingRequiredError(returnsQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before reviewing return requests." />;
  }

  const selectedDetail = detailQuery.data;
  const isBusy = noteMutation.isPending || decisionMutation.isPending;

  return (
    <div className="-mx-4 bg-[#F8FAFC] px-4 pb-24 pt-1 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <ReturnsHeader
          search={search}
          setSearch={setSearch}
          onSubmit={submitSearch}
          onRefresh={() => void returnsQuery.refetch()}
          isRefreshing={returnsQuery.isFetching}
        />

        <ReturnsStats returns={statsItems} isLoading={statsQuery.isLoading && returnsQuery.isLoading} />

        {notice ? (
          <WorkspaceNotice tone={notice.includes("Unable") ? "danger" : "success"} title={notice.includes("Unable") ? "Action failed" : "Saved"} message={notice} />
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(320px,35%)_minmax(0,65%)]">
          <section className="min-w-0 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm shadow-slate-200/70">
            <ReturnFilters activeFilter={filter} onChange={setFilter} />
            <ReturnList
              loading={returnsQuery.isLoading}
              error={returnsQuery.error as Error | null}
              onRetry={() => void returnsQuery.refetch()}
              returns={returns}
              selectedRequestNumber={selectedRequestNumber}
              onSelect={setSelectedRequestNumber}
            />
          </section>

          <section className="min-w-0">
            {selectedDetail ? (
              <ReturnDetails
                detail={selectedDetail}
                note={note}
                setNote={setNote}
                isBusy={isBusy}
                notice={setNotice}
                onAddNote={() => noteMutation.mutate(selectedDetail.requestNumber)}
                onDecision={(decision) => decisionMutation.mutate({ requestNumber: selectedDetail.requestNumber, decision })}
              />
            ) : detailQuery.isLoading ? (
              <QueueSkeleton />
            ) : (
              <EmptyReturnPanel
                title="Select a return case"
                message="Choose a request from the queue to inspect affected items, pickup state, QC notes, refund details, and store note history."
              />
            )}
          </section>
        </div>
      </div>
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
    <div className="flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm shadow-slate-200/70 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#64748B]">
          <Link href="/seller" className="transition hover:text-[#ED5A2F]">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/seller/orders" className="transition hover:text-[#ED5A2F]">Orders</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[#0F172A]">Returns</span>
        </nav>
        <h2 className="mt-2 text-[36px] font-black leading-tight tracking-normal text-[#0F172A]">Returns</h2>
        <p className="mt-1 text-sm font-semibold text-[#64748B]">Manage product returns, seller review decisions, pickup progress, and refund readiness in one place.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={onSubmit} className="min-w-0 sm:w-[360px]">
          <label className="relative block">
            <span className="sr-only">Search seller returns</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, return ID, customer, SKU, product..."
              className="h-12 w-full rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] pl-11 pr-4 text-sm font-semibold text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#ED5A2F] focus:bg-white focus:ring-4 focus:ring-[#FED7CA]"
            />
          </label>
        </form>
        <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function ReturnsStats({ returns, isLoading }: { returns: ReturnSummary[]; isLoading: boolean }) {
  const stats = sellerReturnMetrics(returns);
  const cards = [
    { label: "Total Returns", value: returns.length, trend: "+12%", icon: RotateCcw, tone: "orange" },
    { label: "Pending Review", value: stats.pending, trend: "Needs action", icon: ClipboardCheck, tone: "blue" },
    { label: "Approved", value: stats.approved, trend: "+15.7%", icon: CheckCircle2, tone: "green" },
    { label: "Refunded", value: stats.refunded, trend: "+5.2%", icon: WalletCards, tone: "violet" },
    { label: "Rejected", value: stats.rejected, trend: "-3.1%", icon: XCircle, tone: "red" },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          <p className="mt-1 text-[13px] font-semibold text-[#64748B]">from loaded return queue</p>
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
  selectedRequestNumber,
  onSelect,
}: {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  returns: ReturnSummary[];
  selectedRequestNumber: string;
  onSelect: (requestNumber: string) => void;
}) {
  return (
    <div className="max-h-[calc(100vh-330px)] min-h-[620px] overflow-y-auto p-3">
      {loading ? <QueueSkeleton /> : null}
      {error ? <SellerErrorPanel error={error} onRetry={onRetry} /> : null}
      {!loading && !error && !returns.length ? (
        <SellerEmptyState title="No return requests" message="Return cases involving this store will appear here after customers raise eligible return or replacement requests." />
      ) : null}
      <div className="grid gap-3">
        {returns.map((request) => (
          <ReturnCard
            key={request.id}
            request={request}
            active={request.requestNumber === selectedRequestNumber}
            onSelect={() => onSelect(request.requestNumber)}
          />
        ))}
      </div>
    </div>
  );
}

function ReturnCard({ request, active, onSelect }: { request: ReturnSummary; active: boolean; onSelect: () => void }) {
  const firstItem = request.items[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#ED5A2F] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED5A2F]",
        active ? "border-[#ED5A2F] bg-[#FFF7F3] shadow-md shadow-orange-100 before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-r-full before:bg-[#ED5A2F]" : "border-[#E2E8F0]",
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
    </button>
  );
}

function ReturnDetails({
  detail,
  note,
  setNote,
  isBusy,
  notice,
  onAddNote,
  onDecision,
}: {
  detail: ReturnDetail;
  note: string;
  setNote: (value: string) => void;
  isBusy: boolean;
  notice: (value: string | null) => void;
  onAddNote: () => void;
  onDecision: (decision: "ACCEPT" | "REJECT") => void;
}) {
  const canDecide = detail.status === "PENDING_REVIEW" && detail.items.some((item) => item.status === "PENDING_REVIEW");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ReturnStatusBadge status={detail.status} />
              <ResolutionBadge resolution={detail.resolution} />
            </div>
            <h2 className="mt-3 break-words text-2xl font-black text-[#0F172A] md:text-[28px]">{detail.requestNumber}</h2>
            <p className="mt-1 text-sm font-semibold text-[#64748B]">
              Customer {detail.customer?.name ?? detail.customerName ?? "Customer"} / Order {detail.order.orderNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild className="rounded-2xl">
              <Link href="/seller/orders"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</Link>
            </Button>
            <Button type="button" variant="outline" asChild className="rounded-2xl">
              <Link href={`/seller/orders/${encodeURIComponent(detail.order.orderNumber)}`}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Invoice
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={() => onDecision("REJECT")} disabled={!canDecide || isBusy} className="rounded-2xl">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
            <Button type="button" onClick={() => onDecision("ACCEPT")} disabled={!canDecide || isBusy} className="rounded-2xl bg-[#ED5A2F] hover:bg-[#C84520]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
          </div>
        </div>
      </div>

      <ReturnStepper detail={detail} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <OrderSummary detail={detail} />
          <ProductCard detail={detail} />
          <CustomerCard detail={detail} />
          <ReturnDetailCard detail={detail} />
          <RefundCard detail={detail} />
          <SellerNotes detail={detail} note={note} setNote={setNote} isBusy={isBusy} onAddNote={onAddNote} />
          <ActivityTimeline detail={detail} />
        </div>

        <QuickActions detail={detail} onCopied={() => notice("Return ID copied.")} />
      </div>

      <BottomActionBar canDecide={canDecide} isBusy={isBusy} onDecision={onDecision} />
    </div>
  );
}

function ReturnStepper({ detail }: { detail: ReturnDetail }) {
  const refundStarted = detail.refunds.some((refund) => ["INITIATED", "PROCESSING", "SUCCESS"].includes(refund.status));
  const refundComplete = detail.refunds.some((refund) => refund.status === "SUCCESS") || detail.status === "RESOLVED";
  const productReceived = ["RECEIVED", "QC_PASSED", "RESOLVED"].includes(detail.status);
  const approved = ["AUTO_APPROVED", "APPROVED", "PICKUP_PENDING", "PICKED_UP", "IN_TRANSIT", "RECEIVED", "QC_PASSED", "RESOLVED"].includes(detail.status);
  const rejected = ["REJECTED", "CANCELLED", "QC_FAILED"].includes(detail.status);
  const steps = [
    { label: "Return Requested", done: true, active: detail.status === "PENDING_REVIEW", helper: formatDateTime(detail.requestedAt ?? detail.createdAt) },
    { label: "Seller Review", done: approved || rejected, active: detail.status === "PENDING_REVIEW", helper: rejected ? humanize(detail.status) : "Seller decision" },
    { label: "Approved", done: approved, active: approved && !productReceived, helper: approved ? "Return approved" : "Pending" },
    { label: "Product Received", done: productReceived, active: productReceived && !refundStarted, helper: productReceived ? "Received/QC tracked" : "Pending" },
    { label: "Refund Initiated", done: refundStarted, active: refundStarted && !refundComplete, helper: refundStarted ? "Refund in process" : "Pending" },
    { label: "Refund Completed", done: refundComplete, active: refundComplete, helper: refundComplete ? "Closed" : "Pending" },
  ];

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {steps.map((step, index) => (
          <div key={step.label} className="relative min-w-0">
            {index > 0 ? <span className="absolute right-1/2 top-5 hidden h-px w-full bg-[#E2E8F0] 2xl:block" aria-hidden="true" /> : null}
            <div
              className={cn(
                "relative z-10 flex min-h-[96px] flex-col items-center rounded-2xl border bg-white px-3 py-3 text-center transition duration-200",
                step.active && "border-[#ED5A2F] shadow-sm ring-4 ring-[#FED7CA]",
                !step.active && step.done && "border-[#BBF7D0]",
                !step.active && !step.done && "border-[#E2E8F0]",
              )}
            >
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full border",
                  step.done && !rejected && "border-[#86EFAC] bg-[#DCFCE7] text-[#16A34A]",
                  step.done && rejected && "border-[#FCA5A5] bg-[#FEE2E2] text-[#EF4444]",
                  step.active && "border-[#FDBA74] bg-[#FFF7ED] text-[#ED5A2F]",
                  !step.done && !step.active && "border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8]",
                )}
              >
                {step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
              </span>
              <p className="mt-2 text-xs font-black leading-4 text-[#0F172A]">{step.label}</p>
              <p className="mt-1 text-[11px] font-semibold leading-4 text-[#64748B]">{step.helper}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderSummary({ detail }: { detail: ReturnDetail }) {
  const firstShipment = detail.reverseShipments[0];
  const refundAmount = detail.approvedAmountPaise || detail.requestedAmountPaise;
  const rows: Array<[string, ReactNode]> = [
    ["Order ID", detail.order.orderNumber],
    ["Order Date", formatDateTime(detail.requestedAt ?? detail.createdAt)],
    ["Customer", detail.customer?.name ?? detail.customerName ?? "Customer"],
    ["Payment Method", detail.refunds[0]?.method ? humanize(detail.refunds[0].method) : "Original payment method"],
    ["Payment Status", humanize(detail.order.paymentStatus)],
    ["Refund Amount", formatMoney(refundAmount, detail.currency)],
    ["Coupon Used", formatMoney(detail.couponAdjustmentPaise ?? 0, detail.currency)],
    ["Shipping Method", firstShipment?.mode ? humanize(firstShipment.mode) : humanize(detail.order.deliveryStatus)],
  ];

  return (
    <SectionCard icon={<ReceiptText className="h-5 w-5" />} title="Order Summary">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <InfoTile key={label} label={label} value={value} />
        ))}
      </div>
    </SectionCard>
  );
}

function ProductCard({ detail }: { detail: ReturnDetail }) {
  return (
    <SectionCard icon={<PackageCheck className="h-5 w-5" />} title="Product Card">
      <div className="grid gap-4">
        {detail.items.map((item) => (
          <div key={item.id} className="grid gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 md:grid-cols-[160px_minmax(0,1fr)]">
            <ProductThumb label={item.productName} large />
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Product Name" value={item.productName} />
              <InfoTile label="Brand / Store" value={item.seller?.storeName ?? item.sellerName ?? "Seller store"} />
              <InfoTile label="SKU" value={item.product?.slug ?? "Not available"} />
              <InfoTile label="Variant" value={formatVariantLabel(item.variantSnapshot) ?? "Default variant"} />
              <InfoTile label="Price" value={formatMoney(item.requestedRefundPaise, detail.currency)} />
              <InfoTile label="Quantity" value={item.quantity.toLocaleString("en-IN")} />
              <InfoTile label="Item Status" value={<ReturnStatusBadge status={item.status} />} />
              <InfoTile label="Resolution" value={<ResolutionBadge resolution={item.resolution} />} />
              <InfoTile label="Approved Refund" value={formatMoney(item.approvedRefundPaise, detail.currency)} />
              <InfoTile label="Coupon Share" value={formatMoney(item.couponAdjustmentPaise, detail.currency)} />
            </div>
            {item.qcNote || item.sellerNote ? (
              <div className="md:col-span-2 rounded-2xl border border-[#E2E8F0] bg-white p-3 text-sm font-semibold leading-6 text-[#475569]">
                {item.qcNote ? <p>QC: {item.qcNote}</p> : null}
                {item.sellerNote ? <p>Seller: {item.sellerNote}</p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function CustomerCard({ detail }: { detail: ReturnDetail }) {
  const customerName = detail.customer?.name ?? detail.customerName ?? "Customer";

  return (
    <SectionCard icon={<UserRound className="h-5 w-5" />} title="Customer Information Card">
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#0F172A] text-base font-black text-white">{initials(customerName)}</span>
          <p className="mt-4 text-base font-black text-[#0F172A]">{customerName}</p>
          <p className="mt-2 text-sm font-semibold text-[#64748B]">Phone: {detail.customer?.phone ?? "Not available"}</p>
          <p className="mt-1 break-all text-sm font-semibold text-[#64748B]">Email: {detail.customer?.email ?? detail.customerEmail ?? "Not available"}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InfoTile label="Shipping / Pickup Address" value={formatAddress(detail.pickupAddress)} />
          <InfoTile label="Billing Address" value="Not available in seller return record" />
          <InfoTile label="Requested By" value={customerName} />
          <InfoTile label="Privacy Note" value="Use seller notes for coordination; admin manages sensitive refund operations." />
        </div>
      </div>
    </SectionCard>
  );
}

function ReturnDetailCard({ detail }: { detail: ReturnDetail }) {
  const sellerAuth = useSellerAuth();
  const [proofOpenError, setProofOpenError] = useState<string | null>(null);

  async function openProof(assetKey: string) {
    setProofOpenError(null);
    try {
      await openPrivateProofReference(sellerAuth.authHeaders, assetKey);
    } catch (error) {
      setProofOpenError(error instanceof Error ? error.message : "Could not open proof image.");
    }
  }

  return (
    <SectionCard icon={<FileText className="h-5 w-5" />} title="Return Details">
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoTile label="Reason" value={detail.reason} />
        <InfoTile label="Detailed Description" value={detail.note ?? detail.reason} />
        <InfoTile label="Customer Comment" value={detail.note ?? "No customer comment provided."} />
        <InfoTile label="Requested On" value={formatDateTime(detail.requestedAt ?? detail.createdAt)} />
        <InfoTile label="Requested By" value={detail.customer?.name ?? detail.customerName ?? "Customer"} />
        <InfoTile label="Auto Approved" value={detail.autoApproved ? "Yes" : "No"} />
      </div>
      <div className="mt-4">
        <p className="text-sm font-black text-[#0F172A]">Images</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {detail.qualityProofKeys?.length ? (
            detail.qualityProofKeys.map((key, index) => (
              <button
                key={key}
                type="button"
                onClick={() => void openProof(key)}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-left transition hover:border-[#ED5A2F] hover:bg-[#FFF7F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED5A2F]"
              >
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-[#ED5A2F]">
                  <ImageIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#0F172A]">Return image {index + 1}</span>
                  <span className="block truncate text-xs font-semibold text-[#64748B]">{key}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#64748B]">No customer images uploaded.</p>
          )}
        </div>
        {proofOpenError ? <p className="mt-2 text-sm font-bold text-[#EF4444]">{proofOpenError}</p> : null}
      </div>
    </SectionCard>
  );
}

function RefundCard({ detail }: { detail: ReturnDetail }) {
  const refund = detail.refunds[0];
  const fields = [
    ["Refund Method", refund?.method ? humanize(refund.method) : "Original payment method"],
    ["Refund Amount", formatMoney(refund?.approvedAmountPaise ?? refund?.amountPaise ?? detail.approvedAmountPaise ?? detail.requestedAmountPaise, detail.currency)],
    ["Coupon Adjustment", formatMoney(detail.couponAdjustmentPaise ?? 0, detail.currency)],
    ["Restocking Fee", formatMoney(0, detail.currency)],
    ["Shipping Deduction", formatMoney(0, detail.currency)],
    ["Refund Status", refund?.status ? humanize(refund.status) : "Not created yet"],
  ];

  return (
    <SectionCard icon={<WalletCards className="h-5 w-5" />} title="Refund Information">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <label key={label} className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#64748B]">{label}</span>
            <input
              value={value}
              readOnly
              className="mt-2 h-11 w-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-black text-[#0F172A] outline-none"
              aria-label={label}
            />
          </label>
        ))}
      </div>
      {refund?.amountAdjustmentNote ? <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">Adjustment note: {refund.amountAdjustmentNote}</p> : null}
    </SectionCard>
  );
}

function SellerNotes({
  detail,
  note,
  setNote,
  isBusy,
  onAddNote,
}: {
  detail: ReturnDetail;
  note: string;
  setNote: (value: string) => void;
  isBusy: boolean;
  onAddNote: () => void;
}) {
  return (
    <SectionCard icon={<MessageSquareText className="h-5 w-5" />} title="Seller Notes">
      <label className="block">
        <span className="sr-only">Seller note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          placeholder="Add seller-side review notes, package condition, mismatch details, or refund readiness comments."
          className="w-full rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold leading-6 text-[#0F172A] outline-none transition focus:border-[#ED5A2F] focus:bg-white focus:ring-4 focus:ring-[#FED7CA]"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-[#64748B]">{detail.notes.length.toLocaleString("en-IN")} saved case note{returnPlural(detail.notes.length)}</p>
        <Button type="button" onClick={onAddNote} disabled={isBusy || !note.trim()} className="rounded-2xl bg-[#ED5A2F] hover:bg-[#C84520]">
          <Send className="h-4 w-4" aria-hidden="true" />
          Save note
        </Button>
      </div>
    </SectionCard>
  );
}

function ActivityTimeline({ detail }: { detail: ReturnDetail }) {
  const timeline = buildTimeline(detail);

  return (
    <SectionCard icon={<Sparkles className="h-5 w-5" />} title="Internal Timeline">
      <div className="space-y-4">
        {timeline.map((item) => (
          <div key={item.id} className="grid grid-cols-[74px_1fr] gap-4">
            <time className="pt-1 text-xs font-black text-[#64748B]">{formatTime(item.createdAt)}</time>
            <div className="relative border-l border-[#E2E8F0] pb-4 pl-5 last:pb-0">
              <span className="absolute -left-2 top-1 grid h-4 w-4 place-items-center rounded-full bg-white ring-4 ring-white">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ED5A2F]" />
              </span>
              <p className="text-sm font-black text-[#0F172A]">{item.title}</p>
              {item.description ? <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">{item.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function QuickActions({ detail, onCopied }: { detail: ReturnDetail; onCopied: () => void }) {
  function copyReturnId() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(detail.requestNumber);
      onCopied();
    }
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      <SectionCard compact icon={<MessageSquareText className="h-5 w-5" />} title="Customer Notes">
        <p className="text-sm font-semibold leading-6 text-[#475569]">{detail.note ?? detail.reason}</p>
      </SectionCard>

      <SectionCard compact icon={<ShieldCheck className="h-5 w-5" />} title="Seller Notes">
        <div className="grid gap-2">
          {detail.notes.length ? (
            detail.notes.slice(0, 3).map((item) => (
              <p key={item.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm font-semibold leading-6 text-[#475569]">
                {item.note}
              </p>
            ))
          ) : (
            <p className="text-sm font-semibold text-[#64748B]">No seller notes yet.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard compact icon={<ReceiptText className="h-5 w-5" />} title="Case History">
        <div className="space-y-2 text-sm font-semibold text-[#475569]">
          <p>Status: {humanize(detail.status)}</p>
          <p>Resolution: {humanize(detail.resolution)}</p>
          <p>Shipments: {detail.reverseShipments.length.toLocaleString("en-IN")}</p>
          <p>Refunds: {detail.refunds.length.toLocaleString("en-IN")}</p>
        </div>
      </SectionCard>

      <SectionCard compact icon={<Sparkles className="h-5 w-5" />} title="Quick Actions">
        <div className="grid gap-2">
          <QuickAction asChild icon={<Download className="h-4 w-4" />} label="Download Invoice">
            <Link href={`/seller/orders/${encodeURIComponent(detail.order.orderNumber)}`} />
          </QuickAction>
          <QuickAction asChild icon={<Eye className="h-4 w-4" />} label="Open Order">
            <Link href={`/seller/orders/${encodeURIComponent(detail.order.orderNumber)}`} />
          </QuickAction>
          <QuickAction icon={<UserRound className="h-4 w-4" />} label="View Customer" disabled />
          <QuickAction icon={<Truck className="h-4 w-4" />} label="Print Label" disabled />
          <QuickAction icon={<Copy className="h-4 w-4" />} label="Copy Return ID" onClick={copyReturnId} />
        </div>
      </SectionCard>
    </aside>
  );
}

function BottomActionBar({
  canDecide,
  isBusy,
  onDecision,
}: {
  canDecide: boolean;
  isBusy: boolean;
  onDecision: (decision: "ACCEPT" | "REJECT") => void;
}) {
  return (
    <div className="sticky bottom-4 z-20 rounded-2xl border border-[#E2E8F0] bg-white/95 p-3 shadow-xl shadow-slate-300/30 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={() => onDecision("REJECT")} disabled={!canDecide || isBusy} className="rounded-2xl border-[#FCA5A5] text-[#EF4444] hover:bg-[#FEF2F2]">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject Return
        </Button>
        <Button type="button" variant="outline" onClick={() => onDecision("ACCEPT")} disabled={!canDecide || isBusy} className="rounded-2xl border-[#FDBA74] text-[#ED5A2F] hover:bg-[#FFF7ED]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Approve Return
        </Button>
        <Button type="button" onClick={() => onDecision("ACCEPT")} disabled={!canDecide || isBusy} className="rounded-2xl bg-[#ED5A2F] hover:bg-[#C84520]">
          <WalletCards className="h-4 w-4" aria-hidden="true" />
          Approve & Send to Refund
        </Button>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children, compact = false }: { icon: ReactNode; title: string; children: ReactNode; compact?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-[#E2E8F0] bg-white shadow-sm shadow-slate-200/70", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFF0EC] text-[#ED5A2F]">{icon}</span>
        <h3 className="text-[20px] font-black text-[#0F172A]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#64748B]">{label}</p>
      <div className="mt-2 break-words text-sm font-black leading-6 text-[#0F172A]">{value}</div>
    </div>
  );
}

function ProductThumb({ label, large = false }: { label: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFC] to-[#FFF0EC] text-[#ED5A2F]",
        large ? "h-36 w-full md:w-40" : "h-16 w-16",
      )}
      aria-label={`${label} product image placeholder`}
      role="img"
    >
      <PackageCheck className={cn(large ? "h-10 w-10" : "h-6 w-6")} aria-hidden="true" />
    </span>
  );
}

function QuickAction({
  icon,
  label,
  children,
  asChild,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  children?: ReactNode;
  asChild?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (asChild) {
    return (
      <Button type="button" variant="outline" asChild className="h-11 justify-between rounded-2xl">
        {children && isLinkElement(children) ? (
          <Link href={children.props.href} className="w-full">
            <span className="flex items-center gap-2">{icon}{label}</span>
          </Link>
        ) : (
          <span />
        )}
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={disabled} className="h-11 justify-between rounded-2xl">
      <span className="flex items-center gap-2">{icon}{label}</span>
    </Button>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-36 animate-pulse rounded-2xl bg-white" />
      <div className="h-36 animate-pulse rounded-2xl bg-white" />
      <div className="h-36 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

function sellerReturnMetrics(items: ReturnSummary[]) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "PENDING_REVIEW") summary.pending += 1;
      if (["AUTO_APPROVED", "APPROVED", "PICKUP_PENDING", "PICKED_UP", "IN_TRANSIT", "RECEIVED", "QC_PASSED"].includes(item.status)) {
        summary.approved += 1;
      }
      if (item.status === "RESOLVED") summary.refunded += 1;
      if (["REJECTED", "QC_FAILED"].includes(item.status)) summary.rejected += 1;
      if (item.status === "CANCELLED") summary.cancelled += 1;
      return summary;
    },
    { pending: 0, approved: 0, refunded: 0, rejected: 0, cancelled: 0 },
  );
}

type TimelineItem = {
  id: string;
  title: string;
  description?: string | undefined;
  createdAt?: string | undefined;
};

function buildTimeline(detail: ReturnDetail) {
  const items: TimelineItem[] = [
    {
      id: "requested",
      title: "Customer requested return",
      description: detail.reason,
      createdAt: optionalString(detail.requestedAt ?? detail.createdAt),
    },
  ];

  detail.notes.forEach((note) => {
    items.push({
      id: `note-${note.id}`,
      title: note.createdBy?.fullName ? `${note.createdBy.fullName} added a note` : "Seller viewed or noted request",
      description: note.note,
      createdAt: optionalString(note.createdAt),
    });
  });

  detail.reverseShipments.forEach((shipment) => {
    items.push({
      id: `shipment-${shipment.id}`,
      title: `Reverse pickup ${humanize(shipment.status)}`,
      description: `${shipment.courierName ?? "Courier"} / AWB ${shipment.awbNumber ?? "not assigned"}`,
      createdAt: optionalString(shipment.receivedAt ?? shipment.pickedUpAt ?? shipment.assignedAt),
    });
    shipment.events?.forEach((event) => {
      items.push({
        id: `shipment-event-${event.id}`,
        title: `Shipment updated to ${humanize(event.newStatus)}`,
        description: event.note ?? undefined,
        createdAt: optionalString(event.createdAt),
      });
    });
  });

  detail.refunds.forEach((refund) => {
    items.push({
      id: `refund-${refund.id}`,
      title: `Refund ${humanize(refund.status)}`,
      description: `${refund.refundNumber} / ${formatMoney(refund.approvedAmountPaise ?? refund.amountPaise, refund.currency)}`,
      createdAt: optionalString(refund.approvedAt ?? refund.reviewedAt ?? refund.createdAt),
    });
    refund.transactions?.forEach((transaction) => {
      items.push({
        id: `refund-transaction-${transaction.id}`,
        title: `Refund transaction ${humanize(transaction.status)}`,
        description: transaction.providerRefundId ?? transaction.manualReference ?? transaction.failureReason ?? undefined,
        createdAt: optionalString(transaction.paidAt ?? transaction.processedAt ?? transaction.createdAt),
      });
    });
  });

  return items.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, 12);
}

function formatAddress(address: ReturnDetail["pickupAddress"]) {
  if (!address) {
    return "Not available";
  }

  return [
    address.fullName,
    address.phone,
    address.line1,
    address.line2,
    address.area,
    address.city,
    address.state,
    address.pincode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatTime(value?: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timestamp(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function optionalString(value?: string | null) {
  return value ?? undefined;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "C";
}

function returnPlural(quantity: number) {
  return quantity === 1 ? "" : "s";
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

function isLinkElement(node: ReactNode): node is React.ReactElement<{ href: string }> {
  return Boolean(node && typeof node === "object" && "props" in node && typeof (node as React.ReactElement<{ href?: unknown }>).props.href === "string");
}
