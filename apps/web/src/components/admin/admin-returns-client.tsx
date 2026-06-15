"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
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
  autoAssignAdminReversePickup,
  getAdminReturn,
  listAdminReturns,
  recordAdminReturnQc,
  releaseAdminReversePickupAssignment,
  updateAdminReversePickupAssignment,
  updateAdminReturnStatus,
  type ReturnDetail,
  type ReturnRequestStatus,
  type ReturnSummary,
} from "@/lib/returns-api";
import { indihubFetch } from "@/lib/api";
import { formatMoney } from "@/lib/storefront-api";

const returnStatusFilters: Array<ReturnRequestStatus | "ALL"> = [
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

type DeliveryPartnerOption = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  status: string;
  activeWorkload?: number;
  deliveryProfile?: { isAvailable?: boolean; serviceCityCode?: string | null; servicePincodes?: string[] } | null;
};

type DeliveryPartnerPage = {
  items: DeliveryPartnerOption[];
  total: number;
  page: number;
  limit: number;
};

export function AdminReturnsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReturnRequestStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedRequestNumber, setSelectedRequestNumber] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const returnsQuery = useQuery({
    queryKey: ["admin-returns", auth.token, status, submittedSearch],
    queryFn: () =>
      listAdminReturns(auth.authHeaders, {
        ...(status !== "ALL" ? { status } : {}),
        search: submittedSearch,
        limit: 30,
      }),
    enabled: auth.isAuthenticated,
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
    queryKey: ["admin-return-detail", auth.token, selectedRequestNumber],
    queryFn: () => getAdminReturn(auth.authHeaders, selectedRequestNumber),
    enabled: auth.isAuthenticated && Boolean(selectedRequestNumber),
  });

  const statusMutation = useMutation({
    mutationFn: ({ requestNumber, nextStatus }: { requestNumber: string; nextStatus: ReturnRequestStatus }) =>
      updateAdminReturnStatus(auth.authHeaders, requestNumber, {
        status: nextStatus,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleReturnUpdated(detail, "Return request updated."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update the return request."),
  });

  const qcMutation = useMutation({
    mutationFn: ({
      requestNumber,
      qcStatus,
    }: {
      requestNumber: string;
      qcStatus: "QC_PASSED" | "QC_FAILED";
    }) =>
      recordAdminReturnQc(auth.authHeaders, requestNumber, {
        status: qcStatus,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (detail) => handleReturnUpdated(detail, "Quality check recorded."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to record quality check."),
  });

  const pickupMutation = useMutation({
    mutationFn: ({
      requestNumber,
      action,
      deliveryPartnerUserId,
    }: {
      requestNumber: string;
      action: "AUTO" | "ASSIGN" | "RELEASE";
      deliveryPartnerUserId?: string;
    }) => {
      if (action === "AUTO") {
        return autoAssignAdminReversePickup(auth.authHeaders, requestNumber);
      }
      if (action === "RELEASE") {
        return releaseAdminReversePickupAssignment(auth.authHeaders, requestNumber, {
          ...(note.trim() ? { note: note.trim() } : {}),
        });
      }
      return updateAdminReversePickupAssignment(auth.authHeaders, requestNumber, {
        ...(deliveryPartnerUserId ? { deliveryPartnerUserId } : {}),
        ...(note.trim() ? { assignmentNote: note.trim() } : {}),
      });
    },
    onSuccess: (detail) => handleReturnUpdated(detail, "Reverse pickup assignment updated."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update reverse pickup assignment."),
  });

  const metrics = useMemo(() => returnMetrics(returns), [returns]);

  function handleReturnUpdated(detail: ReturnDetail, message: string) {
    setNotice(message);
    setNote("");
    setSelectedRequestNumber(detail.requestNumber);
    void queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-return-detail"] });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const selectedDetail = detailQuery.data;
  const isBusy = statusMutation.isPending || qcMutation.isPending || pickupMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReturnMetricCard label="Loaded requests" value={returns.length} helper="Current filtered queue" tone="info" />
        <ReturnMetricCard label="Needs review" value={metrics.review} helper="Awaiting admin decision" tone="warning" />
        <ReturnMetricCard label="In progress" value={metrics.progress} helper="Approved, pickup, or QC work" tone="info" />
        <ReturnMetricCard label="Closed" value={metrics.closed} helper="Resolved, rejected, or cancelled" tone="success" />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)_auto] xl:items-center">
          <div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-[#F8FAFC] p-1">
            {returnStatusFilters.map((filter) => (
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
              <span className="sr-only">Search returns</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search return, order, buyer, or product..."
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
            <WorkspaceNotice tone="success" title="Saved" message={notice} />
          </div>
        ) : null}

        <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] p-3 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              {returnsQuery.isLoading ? (
                <QueueSkeleton />
              ) : returnsQuery.error ? (
                <WorkspaceNotice
                  tone="danger"
                  title="Returns could not be loaded"
                  message={returnsQuery.error instanceof Error ? returnsQuery.error.message : "Try refreshing the queue."}
                />
              ) : !returns.length ? (
                <EmptyReturnPanel
                  title="No return requests"
                  message="Return and replacement requests will appear here after customers raise them from delivered orders."
                />
              ) : (
                returns.map((request) => (
                  <ReturnQueueCard
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
              <AdminReturnDetailPanel
                detail={selectedDetail}
                note={note}
                setNote={setNote}
                isBusy={isBusy}
                onStatus={(nextStatus) =>
                  statusMutation.mutate({
                    requestNumber: selectedDetail.requestNumber,
                    nextStatus,
                  })
                }
                onQc={(qcStatus) =>
                  qcMutation.mutate({
                    requestNumber: selectedDetail.requestNumber,
                    qcStatus,
                  })
                }
                onPickupAction={(action, deliveryPartnerUserId) =>
                  pickupMutation.mutate({
                    requestNumber: selectedDetail.requestNumber,
                    action,
                    ...(deliveryPartnerUserId ? { deliveryPartnerUserId } : {}),
                  })
                }
              />
            ) : detailQuery.isLoading ? (
              <QueueSkeleton />
            ) : (
              <EmptyReturnPanel
                title="Select a return request"
                message="Choose a request from the queue to review items, seller context, pickup state, QC notes, and refund links."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminReturnDetailPanel({
  detail,
  note,
  setNote,
  isBusy,
  onStatus,
  onQc,
  onPickupAction,
}: {
  detail: ReturnDetail;
  note: string;
  setNote: (value: string) => void;
  isBusy: boolean;
  onStatus: (status: ReturnRequestStatus) => void;
  onQc: (status: "QC_PASSED" | "QC_FAILED") => void;
  onPickupAction: (action: "AUTO" | "ASSIGN" | "RELEASE", deliveryPartnerUserId?: string) => void;
}) {
  const auth = useAdminAuth();
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const canReview = detail.status === "PENDING_REVIEW";
  const canCancel = !["RESOLVED", "REJECTED", "CANCELLED"].includes(detail.status);
  const canQc = ["RECEIVED", "PICKED_UP", "IN_TRANSIT", "APPROVED", "AUTO_APPROVED", "PICKUP_PENDING"].includes(detail.status);
  const canManagePickup = detail.reverseShipments.length > 0 && !detail.reverseShipments.some((shipment) =>
    ["PICKED_UP", "IN_TRANSIT", "RECEIVED"].includes(shipment.status),
  );
  const partnersQuery = useQuery({
    queryKey: ["admin-delivery-partners-for-return", auth.token],
    queryFn: () =>
      indihubFetch<DeliveryPartnerPage>(
        "/api/admin/delivery/partners?status=ACTIVE&isAvailable=true&limit=100",
        undefined,
        auth.authHeaders,
      ),
    enabled: auth.isAuthenticated,
  });

  useEffect(() => {
    const assignedPartnerId = detail.reverseShipments.find((shipment) => shipment.assignedPartner?.id)?.assignedPartner?.id ?? "";
    setSelectedPartnerId((current) => current || assignedPartnerId);
  }, [detail.requestNumber, detail.reverseShipments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusBadge status={detail.status} />
            <ResolutionBadge resolution={detail.resolution} />
            {detail.autoApproved ? <StatusBadge tone="info">Policy auto-approved</StatusBadge> : null}
          </div>
          <h2 className="mt-3 break-words text-2xl font-black text-[#0B1F3A]">{detail.requestNumber}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
            Order{" "}
            <Link href={`/admin/orders/${detail.order.orderNumber}`} className="font-black text-[#ED3500] hover:underline">
              {detail.order.orderNumber}
            </Link>{" "}
            requested on {formatDateTime(detail.requestedAt ?? detail.createdAt)}.
          </p>
        </div>
        <div className="grid gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085] xl:min-w-72">
          <p className="flex items-center gap-2 font-black text-[#1F2933]">
            <UserRound className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
            {detail.customer?.name ?? detail.customerName ?? "Customer"}
          </p>
          <p>{detail.customer?.email ?? detail.customerEmail ?? "Email not available"}</p>
          <p>{detail.customer?.phone ?? "Phone not available"}</p>
        </div>
      </div>

      <ReturnStepTrack status={detail.status} />

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyMetric label="Requested refund" value={detail.requestedAmountPaise} currency={detail.currency} />
        <MoneyMetric label="Approved refund" value={detail.approvedAmountPaise} currency={detail.currency} />
        <MoneyMetric label="Coupon adjustment" value={detail.couponAdjustmentPaise ?? 0} currency={detail.currency} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <PanelTitle icon={<ClipboardCheck className="h-5 w-5" />} title="Items under return" description={detail.reason} />
          {detail.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#E5E7EB] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-black leading-6 text-[#1F2933]">{item.productName}</p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {item.seller?.storeName ?? item.sellerName} / Qty {item.quantity} / {item.variantSnapshot ?? "Default variant"}
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
            <PanelTitle icon={<ShieldCheck className="h-5 w-5" />} title="Next admin step" description="Use one action at a time." />
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#667085]">Internal note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Add a short reason for the decision."
                className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <div className="mt-4 grid gap-2">
              {canReview ? (
                <>
                  <Button type="button" onClick={() => onStatus("APPROVED")} disabled={isBusy}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Approve return
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onStatus("REJECTED")} disabled={isBusy}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Reject request
                  </Button>
                </>
              ) : null}
              {canQc ? (
                <>
                  <Button type="button" onClick={() => onQc("QC_PASSED")} disabled={isBusy}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    QC passed
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onQc("QC_FAILED")} disabled={isBusy}>
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    QC failed
                  </Button>
                </>
              ) : null}
              {canCancel ? (
                <Button type="button" variant="outline" onClick={() => onStatus("CANCELLED")} disabled={isBusy}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel return case
                </Button>
              ) : null}
              {!canReview && !canQc && !canCancel ? (
                <WorkspaceNotice tone="success" title="No pending admin action" message="This return case is closed or waiting for refund completion." />
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<Truck className="h-5 w-5" />} title="Reverse pickup" description="Pickup and receiving updates from delivery/courier operations." />
            <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">Assignment control</p>
              <div className="mt-3 grid gap-2">
                <select
                  value={selectedPartnerId}
                  onChange={(event) => setSelectedPartnerId(event.target.value)}
                  className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                  disabled={!canManagePickup || partnersQuery.isLoading}
                >
                  <option value="">Select delivery partner</option>
                  {(partnersQuery.data?.items ?? []).map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.fullName ?? partner.email ?? partner.phone ?? partner.id} {partner.activeWorkload !== undefined ? `- workload ${partner.activeWorkload}` : ""}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" onClick={() => onPickupAction("AUTO")} disabled={isBusy || !canManagePickup}>
                    Auto assign
                  </Button>
                  <Button
                    type="button"
                    onClick={() => onPickupAction("ASSIGN", selectedPartnerId)}
                    disabled={isBusy || !canManagePickup || !selectedPartnerId}
                  >
                    Assign partner
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onPickupAction("RELEASE")} disabled={isBusy || !canManagePickup}>
                    Release
                  </Button>
                </div>
                {!canManagePickup && detail.reverseShipments.length ? (
                  <p className="text-xs font-bold text-[#667085]">Assignment is locked after customer pickup starts.</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {detail.reverseShipments.length ? (
                detail.reverseShipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-[#1F2933]">{shipment.seller?.storeName ?? "Seller"}</p>
                      <StatusBadge tone={shipment.status === "RECEIVED" ? "success" : shipment.status === "FAILED" ? "danger" : "warning"}>
                        {humanize(shipment.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2">Assignment: {humanize(shipment.assignmentStatus ?? "UNASSIGNED")}</p>
                    <p>Partner: {shipment.assignedPartner?.fullName ?? shipment.assignedPartner?.phone ?? "Not assigned"}</p>
                    <p className="mt-2">Mode: {humanize(shipment.mode)}</p>
                    <p>AWB: {shipment.awbNumber ?? "Not assigned"}</p>
                    <p>Courier: {shipment.courierName ?? "Not assigned"}</p>
                    <p>Seller destination: {formatReturnAddress(shipment.seller?.destinationAddress)}</p>
                    {shipment.assignmentExpiresAt ? <p>Accept before: {formatDateTime(shipment.assignmentExpiresAt)}</p> : null}
                    {shipment.assignmentNote ? <p className="mt-2 rounded bg-white px-2 py-1">{shipment.assignmentNote}</p> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  Reverse shipment is created after approval when pickup is required.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
            <PanelTitle icon={<Store className="h-5 w-5" />} title="Refund links" description="Finance moves money from the refund queue." />
            <div className="mt-3 grid gap-2">
              {detail.refunds.length ? (
                detail.refunds.map((refund) => (
                  <Link
                    key={refund.id}
                    href="/admin/refunds"
                    className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 transition hover:border-[#ED3500]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#1F2933]">{refund.refundNumber}</p>
                      <StatusBadge tone={refund.status === "SUCCESS" ? "success" : refund.status === "FAILED" ? "danger" : "warning"}>
                        {humanize(refund.status)}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">{formatMoney(refund.amountPaise, refund.currency)}</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
                  No refund request is attached yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <PanelTitle icon={<ClipboardCheck className="h-5 w-5" />} title="Case notes" description="Admin, seller, and system notes for this return." />
        <div className="mt-3 grid gap-2">
          {detail.notes.length ? (
            detail.notes.map((item) => (
              <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <p className="text-sm font-semibold leading-6 text-[#1F2933]">{item.note}</p>
                <p className="mt-1 text-xs font-bold text-[#667085]">
                  {item.createdBy?.fullName ?? item.createdBy?.email ?? "System"} / {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
              No notes recorded yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReturnQueueCard({
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
        <span>{request.customerEmail ?? request.customerName ?? "Customer"}</span>
        <span>/</span>
        <span>{formatDateTime(request.createdAt)}</span>
      </div>
    </button>
  );
}

function ReturnMetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "info" | "warning" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "bg-[#ECFDF3] text-[#0F8A5F]"
      : tone === "warning"
        ? "bg-[#FFF7E6] text-[#B7791F]"
        : "bg-[#F0F7FF] text-[#175CD3]";

  return (
    <div className="rounded-xl border border-[#D8E2EA] bg-white p-5 shadow-sm">
      <span className={cn("grid h-11 w-11 place-items-center rounded-full", toneClass)}>
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#0B1F3A]">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{helper}</p>
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

function returnMetrics(items: ReturnSummary[]) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "PENDING_REVIEW") summary.review += 1;
      if (["APPROVED", "AUTO_APPROVED", "PICKUP_PENDING", "PICKED_UP", "IN_TRANSIT", "RECEIVED", "QC_PASSED"].includes(item.status)) {
        summary.progress += 1;
      }
      if (["RESOLVED", "REJECTED", "CANCELLED", "QC_FAILED"].includes(item.status)) {
        summary.closed += 1;
      }
      return summary;
    },
    { review: 0, progress: 0, closed: 0 },
  );
}

function returnPlural(quantity: number) {
  return quantity === 1 ? "" : "s";
}

function formatReturnAddress(address?: {
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
} | null) {
  if (!address) {
    return "Seller address missing";
  }
  return [address.line1, address.line2, address.area, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(", ");
}
