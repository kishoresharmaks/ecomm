"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import {
  EmptyReturnPanel,
  MoneyMetric,
  ResolutionBadge,
  ReturnStatusBadge,
  ReturnStepTrack,
  WorkspaceNotice,
  formatDateTime,
  humanize,
} from "@/components/returns/returns-workspace-ui";
import {
  addSellerReturnNote,
  getSellerReturn,
  listSellerReturns,
  type ReturnDetail,
  type ReturnRequestStatus,
  type ReturnSummary,
} from "@/lib/returns-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerOnboardingRequired,
  SellerPanel,
  isSellerOnboardingRequiredError,
  useSellerAuth,
} from "./seller-ui";

const sellerReturnStatusFilters: Array<ReturnRequestStatus | "ALL"> = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "PICKUP_PENDING",
  "RECEIVED",
  "QC_PASSED",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
];

export function SellerReturnsClient() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReturnRequestStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedRequestNumber, setSelectedRequestNumber] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const returnsQuery = useQuery({
    queryKey: ["seller-returns", sellerAuth.authKey, status, submittedSearch],
    queryFn: () =>
      listSellerReturns(sellerAuth.authHeaders, {
        ...(status !== "ALL" ? { status } : {}),
        search: submittedSearch,
        limit: 30,
      }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const returns = returnsQuery.data?.items ?? [];

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

  const metrics = useMemo(() => sellerReturnMetrics(returns), [returns]);

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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SellerReturnMetric label="Return cases" value={returns.length} note="Current loaded queue" />
        <SellerReturnMetric label="Needs store note" value={metrics.needsNote} note="No seller note yet" />
        <SellerReturnMetric label="Closed" value={metrics.closed} note="Resolved, rejected, or cancelled" />
      </div>

      <SellerPanel className="p-0">
        <div className="grid gap-3 border-b border-[#E5E7EB] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)_auto] xl:items-center">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-[#F8FAFC] p-1">
            {sellerReturnStatusFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatus(filter)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm font-black transition",
                  status === filter
                    ? "bg-white text-[#ED3500] shadow-sm ring-1 ring-[#FFE0D6]"
                    : "text-[#344054] hover:bg-white hover:text-[#ED3500]",
                )}
              >
                {filter === "ALL" ? "All returns" : humanize(filter)}
              </button>
            ))}
          </div>
          <form onSubmit={submitSearch} className="flex min-w-0 gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search seller returns</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search return, order, or product..."
                className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-11 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#667085] focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
              />
            </label>
            <Button type="submit" className="h-12">
              Search
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => void returnsQuery.refetch()}
            disabled={returnsQuery.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", returnsQuery.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {notice ? (
          <div className="border-b border-[#E5E7EB] p-4">
            <WorkspaceNotice tone={notice.includes("Unable") ? "danger" : "success"} title={notice.includes("Unable") ? "Action failed" : "Saved"} message={notice} />
          </div>
        ) : null}

        <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] p-3 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              {returnsQuery.isLoading ? (
                <QueueSkeleton />
              ) : returnsQuery.error ? (
                <SellerErrorPanel error={returnsQuery.error as Error} onRetry={() => void returnsQuery.refetch()} />
              ) : !returns.length ? (
                <SellerEmptyState title="No return requests" message="Return cases involving this store will appear here after customers raise eligible return or replacement requests." />
              ) : (
                returns.map((request) => (
                  <SellerReturnQueueCard
                    key={request.id}
                    request={request}
                    active={request.requestNumber === selectedRequestNumber}
                    onSelect={() => setSelectedRequestNumber(request.requestNumber)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="p-4">
            {selectedDetail ? (
              <SellerReturnDetailPanel
                detail={selectedDetail}
                note={note}
                setNote={setNote}
                isBusy={noteMutation.isPending}
                onAddNote={() => noteMutation.mutate(selectedDetail.requestNumber)}
              />
            ) : detailQuery.isLoading ? (
              <QueueSkeleton />
            ) : (
              <EmptyReturnPanel
                title="Select a return case"
                message="Choose a request from the queue to inspect affected items, pickup state, QC notes, and store note history."
              />
            )}
          </div>
        </div>
      </SellerPanel>
    </div>
  );
}

function SellerReturnDetailPanel({
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
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusBadge status={detail.status} />
            <ResolutionBadge resolution={detail.resolution} />
          </div>
          <h2 className="mt-3 break-words text-2xl font-black text-[#0B1F3A]">{detail.requestNumber}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Order {detail.order.orderNumber} / requested {formatDateTime(detail.requestedAt ?? detail.createdAt)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 xl:min-w-72">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Customer context</p>
          <p className="mt-2 font-black text-[#1F2933]">{detail.customer?.name ?? detail.customerName ?? "Customer"}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">Contact details are hidden for seller privacy. Use case notes for coordination.</p>
        </div>
      </div>

      <ReturnStepTrack status={detail.status} />

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyMetric label="Requested refund" value={detail.requestedAmountPaise} currency={detail.currency} />
        <MoneyMetric label="Approved refund" value={detail.approvedAmountPaise} currency={detail.currency} />
        <MoneyMetric label="Coupon adjustment" value={detail.couponAdjustmentPaise ?? 0} currency={detail.currency} />
      </div>

      <WorkspaceNotice
        tone="info"
        title="Seller procedure"
        message="Review the affected item, keep the product ready for pickup or inspection, add a store note, and wait for admin or finance to complete QC and refund decisions."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <PanelTitle icon={<PackageCheck className="h-5 w-5" />} title="Store items" description={detail.reason} />
          {detail.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-black leading-6 text-[#1F2933]">{item.productName}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    Qty {item.quantity} / {item.variantSnapshot ?? "Default variant"}
                  </p>
                </div>
                <ReturnStatusBadge status={item.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Requested" value={formatMoney(item.requestedRefundPaise, detail.currency)} />
                <SmallMetric label="Approved" value={formatMoney(item.approvedRefundPaise, detail.currency)} />
                <SmallMetric label="Coupon share" value={formatMoney(item.couponAdjustmentPaise, detail.currency)} />
              </div>
              {item.qcNote || item.sellerNote ? (
                <p className="mt-3 rounded-md bg-[#F8FAFC] px-3 py-2 text-sm font-semibold leading-6 text-[#667085]">
                  {item.qcNote ? `QC: ${item.qcNote}` : null}
                  {item.qcNote && item.sellerNote ? " / " : null}
                  {item.sellerNote ? `Seller: ${item.sellerNote}` : null}
                </p>
              ) : null}
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<MessageSquareText className="h-5 w-5" />} title="Add store note" description="Notes are visible to admin and finance teams." />
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Seller note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                placeholder="Example: Return invoice verified, item package received, or mismatch observed."
                className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <Button type="button" className="mt-4 w-full" onClick={onAddNote} disabled={isBusy || !note.trim()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Save seller note
            </Button>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<Truck className="h-5 w-5" />} title="Reverse pickup" description="Pickup state for this store's returned package." />
            <div className="mt-3 space-y-3">
              {detail.reverseShipments.length ? (
                detail.reverseShipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-[#1F2933]">{shipment.seller?.storeName ?? "Store"}</p>
                      <StatusBadge tone={shipment.status === "RECEIVED" ? "success" : shipment.status === "FAILED" ? "danger" : "warning"}>
                        {humanize(shipment.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2">Assignment: {humanize(shipment.assignmentStatus ?? "UNASSIGNED")}</p>
                    <p>Partner: {shipment.assignedPartner?.fullName ?? shipment.assignedPartner?.phone ?? "Not assigned"}</p>
                    <p className="mt-2">Mode: {humanize(shipment.mode)}</p>
                    <p>AWB: {shipment.awbNumber ?? "Not assigned"}</p>
                    <p>Tracking: {shipment.trackingReference ?? "Not assigned"}</p>
                    <p>Received by: {shipment.receivedByName ?? "Not received yet"}</p>
                    <p>Receipt proof: {shipment.receiptProofReference ?? "Not uploaded yet"}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  No reverse pickup has been created yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<ShieldCheck className="h-5 w-5" />} title="Case notes" description="Latest notes for this store's return context." />
            <div className="mt-3 grid gap-2">
              {detail.notes.length ? (
                detail.notes.map((item) => (
                  <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <p className="text-sm font-semibold leading-6 text-[#1F2933]">{item.note}</p>
                    <p className="mt-1 text-xs font-bold text-[#667085]">{formatDateTime(item.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  No case notes yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SellerReturnQueueCard({
  request,
  active,
  onSelect,
}: {
  request: ReturnSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const firstItem = request.items[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-[#ED3500]",
        active ? "border-[#ED3500] ring-2 ring-[#FFE0D6]" : "border-[#D8E2EA]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusBadge status={request.status} />
            <ResolutionBadge resolution={request.resolution} />
          </div>
          <p className="mt-3 break-words text-base font-black text-[#0B1F3A]">{request.requestNumber}</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#667085]">{request.order.orderNumber}</p>
        </div>
        <p className="shrink-0 text-right text-sm font-black text-[#163B5C]">
          {formatMoney(request.requestedAmountPaise, request.currency)}
        </p>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[#344054]">
        {firstItem?.productName ?? request.reason}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#667085]">
        <span>{request.totalQuantity} unit{returnPlural(request.totalQuantity)}</span>
        <span>/</span>
        <span>{formatDateTime(request.createdAt)}</span>
      </div>
    </button>
  );
}

function SellerReturnMetric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#163B5C]">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p>
    </div>
  );
}

function PanelTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">{icon}</span>
      <div>
        <h3 className="text-lg font-black text-[#1F2933]">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p>
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-32 animate-pulse rounded-xl bg-white" />
      <div className="h-32 animate-pulse rounded-xl bg-white" />
    </div>
  );
}

function sellerReturnMetrics(items: ReturnSummary[]) {
  return items.reduce(
    (summary, item) => {
      const hasMissingNote = item.items.some((returnItem) => !["REJECTED", "CLOSED"].includes(returnItem.status));
      if (hasMissingNote) summary.needsNote += 1;
      if (["RESOLVED", "REJECTED", "CANCELLED", "QC_FAILED"].includes(item.status)) {
        summary.closed += 1;
      }
      return summary;
    },
    { needsNote: 0, closed: 0 },
  );
}

function returnPlural(quantity: number) {
  return quantity === 1 ? "" : "s";
}
