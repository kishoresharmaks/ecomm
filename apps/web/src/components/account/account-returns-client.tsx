"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, RefreshCw, RotateCcw, Search, Truck, WalletCards } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import {
  RefundStatusBadge,
  RefundStepTrack,
  ResolutionBadge,
  ReturnStatusBadge,
  ReturnStepTrack,
  WorkspaceNotice,
  formatDateTime as formatReturnDateTime,
  humanize,
} from "@/components/returns/returns-workspace-ui";
import { AccountShell } from "./account-shell";
import { EmptyState, ErrorPanel, PagePanel, SkeletonBlock } from "./account-ui";
import { listCustomerReturns, getCustomerReturnDetail } from "@/lib/account-api";
import { formatMoney } from "@/lib/storefront-api";

export function AccountReturnsClient() {
  const customerAuth = useCustomerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null);

  const returnsQuery = useQuery({
    queryKey: ["account-returns", customerAuth.authKey, submittedSearch],
    queryFn: () => listCustomerReturns(customerAuth.authHeaders, { search: submittedSearch, limit: 20 }),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const returnDetailQuery = useQuery({
    queryKey: ["account-return-detail", customerAuth.authKey, selectedReturn],
    queryFn: () => getCustomerReturnDetail(customerAuth.authHeaders, selectedReturn!),
    enabled: customerAuth.enabled && Boolean(selectedReturn),
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function handleViewReturn(requestNumber: string) {
    setSelectedReturn(requestNumber);
  }

  function handleBackToList() {
    setSelectedReturn(null);
  }

  const returns = returnsQuery.data?.items ?? [];
  const returnDetail = returnDetailQuery.data;

  return (
    <AccountShell title="Returns" description="View return and refund request history, track reverse pickup status, and see resolution details.">
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      {selectedReturn ? (
        <ReturnDetailView
          returnDetail={returnDetail}
          isLoading={returnDetailQuery.isLoading}
          error={returnDetailQuery.error}
          onBack={handleBackToList}
          onRetry={() => void returnDetailQuery.refetch()}
        />
      ) : (
        <PagePanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading title="Return history" description="Track return requests, refund status, and resolution details." />
            <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <label className="relative flex-1">
                <span className="sr-only">Search return number</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search return number"
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <Button type="submit">
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
              <Button type="button" variant="outline" onClick={() => void returnsQuery.refetch()} disabled={returnsQuery.isFetching}>
                <RefreshCw className={`h-4 w-4 ${returnsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
                Retry
              </Button>
            </form>
          </div>

          <div className="mt-5 grid gap-3">
            {returnsQuery.isLoading ? <SkeletonBlock className="h-72" /> : null}
            {returnsQuery.error ? <ErrorPanel error={returnsQuery.error} onRetry={() => void returnsQuery.refetch()} /> : null}
            {!returnsQuery.isLoading && returns.length === 0 ? (
              <EmptyState
                title="No returns found"
                message="Return and refund requests will appear here with status, resolution, and tracking details."
              />
            ) : null}

            {returns.map((returnRequest) => (
              <button
                key={returnRequest.id}
                onClick={() => handleViewReturn(returnRequest.requestNumber)}
                className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-left transition hover:border-[#ED3500] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                    <RotateCcw className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-black text-[#1F2933]">{returnRequest.requestNumber}</p>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      Order {returnRequest.order.orderNumber} / {returnRequest.totalQuantity} unit{returnRequest.totalQuantity === 1 ? "" : "s"} / Created {formatReturnDateTime(returnRequest.createdAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#667085]">
                      Requested {formatMoney(returnRequest.requestedAmountPaise, returnRequest.currency)}
                      {returnRequest.approvedAmountPaise > 0
                        ? ` / Approved ${formatMoney(returnRequest.approvedAmountPaise, returnRequest.currency)}`
                        : " / Approval pending"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <ReturnStatusBadge status={returnRequest.status} />
                  <ResolutionBadge resolution={returnRequest.resolution} />
                  <span className="text-base font-black text-[#163B5C]">
                    {formatMoney(returnRequest.approvedAmountPaise || returnRequest.requestedAmountPaise, returnRequest.currency)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </PagePanel>
      )}
    </AccountShell>
  );
}

function ReturnDetailView({
  returnDetail,
  isLoading,
  error,
  onBack,
  onRetry,
}: {
  returnDetail: Awaited<ReturnType<typeof getCustomerReturnDetail>> | undefined;
  isLoading: boolean;
  error: Error | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <PagePanel>
        <SkeletonBlock className="h-96" />
      </PagePanel>
    );
  }

  if (error) {
    return (
      <PagePanel>
        <ErrorPanel error={error} onRetry={onRetry} />
      </PagePanel>
    );
  }

  if (!returnDetail) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="mb-5">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to returns
        </Button>
      </div>

      <PagePanel>
        <div className="border-b border-[#E5E7EB] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusBadge status={returnDetail.status} />
            <ResolutionBadge resolution={returnDetail.resolution} />
          </div>
          <h2 className="mt-3 text-2xl font-black text-[#1F2933]">{returnDetail.requestNumber}</h2>
          <p className="mt-2 text-sm font-semibold text-[#667085]">
            Order {returnDetail.order.orderNumber} / Created on {formatReturnDateTime(returnDetail.createdAt)}
          </p>
        </div>

        <div className="mt-5">
          <ReturnStepTrack status={returnDetail.status} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Reason</h3>
            <p className="mt-2 text-sm font-semibold text-[#1F2933]">{returnDetail.reason}</p>
            {returnDetail.note ? (
              <>
                <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-[#667085]">Note</h3>
                <p className="mt-2 text-sm font-semibold text-[#1F2933]">{returnDetail.note}</p>
              </>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Refund Amount</h3>
            <p className="mt-2 text-base font-black text-[#163B5C]">
              {formatMoney(returnDetail.approvedAmountPaise || returnDetail.requestedAmountPaise, returnDetail.currency)}
            </p>
            {returnDetail.requestedAmountPaise !== returnDetail.approvedAmountPaise ? (
              <p className="mt-1 text-xs font-semibold text-[#667085]">
                Requested: {formatMoney(returnDetail.requestedAmountPaise, returnDetail.currency)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Items</h3>
          <div className="mt-2 grid gap-2">
            {returnDetail.items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-bold text-[#1F2933]">{item.productName}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">
                    Qty: {item.quantity} / {item.variantSnapshot ?? "Default variant"} / {item.seller?.storeName ?? item.sellerName ?? "Seller"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">
                    Requested {formatMoney(item.requestedRefundPaise, returnDetail.currency)}
                    {item.approvedRefundPaise > 0
                      ? ` / Approved ${formatMoney(item.approvedRefundPaise, returnDetail.currency)}`
                      : " / Approval pending"}
                  </p>
                </div>
                <ReturnStatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>

        {returnDetail.reverseShipments.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Reverse Pickup</h3>
            <div className="mt-2 grid gap-2">
              {returnDetail.reverseShipments.map((shipment) => (
                <div key={shipment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-sm font-bold text-[#1F2933]">
                      <Truck className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                      {shipment.mode === "PLATFORM_PICKUP" ? "Platform Pickup" : "Self Ship"}
                    </p>
                    <ReturnStatusBadge status={shipment.status} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#667085]">
                    Assignment: {humanize(shipment.assignmentStatus ?? "UNASSIGNED")}
                    {shipment.assignedPartner?.fullName || shipment.assignedPartner?.phone
                      ? ` / Partner: ${shipment.assignedPartner.fullName ?? shipment.assignedPartner.phone}`
                      : ""}
                  </p>
                  {shipment.awbNumber ? (
                    <p className="mt-2 text-xs font-semibold text-[#667085]">AWB: {shipment.awbNumber}</p>
                  ) : null}
                  {shipment.courierName ? (
                    <p className="mt-1 text-xs font-semibold text-[#667085]">Courier: {shipment.courierName}</p>
                  ) : null}
                  {shipment.events?.length ? (
                    <div className="mt-3 border-t border-[#E5E7EB] pt-3">
                      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Pickup timeline</p>
                      <div className="mt-2 grid gap-2">
                        {shipment.events.map((event) => (
                          <div key={event.id} className="rounded bg-white px-3 py-2 text-xs font-semibold text-[#667085]">
                            <span className="font-black text-[#1F2933]">{humanize(event.newStatus)}</span>
                            {" / "}
                            {formatReturnDateTime(event.createdAt)}
                            {event.note ? ` / ${event.note}` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <WorkspaceNotice
              title="Reverse pickup not created yet"
              message="Pickup or self-ship details appear after the return request is approved."
            />
          </div>
        )}

        {returnDetail.refunds.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Refunds</h3>
            <div className="mt-2 grid gap-2">
              {returnDetail.refunds.map((refund) => (
                <div key={refund.id} className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-[#1F2933]">
                      <WalletCards className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
                      {refund.refundNumber}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#667085]">{formatReturnDateTime(refund.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RefundStatusBadge status={refund.status} />
                    <span className="text-sm font-black text-[#163B5C]">{formatMoney(refund.amountPaise, refund.currency)}</span>
                  </div>
                  <RefundStepTrack status={refund.status} compact />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <WorkspaceNotice
              title="Refund not attached yet"
              message="Refund status appears here after approval and finance review, or when replacement is converted to a refund."
            />
          </div>
        )}

        {returnDetail.notes.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#667085]">Notes</h3>
            <div className="mt-2 grid gap-2">
              {returnDetail.notes.map((note) => (
                <div key={note.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="text-sm font-semibold text-[#1F2933]">{note.note}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{formatReturnDateTime(note.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </PagePanel>
    </div>
  );
}
