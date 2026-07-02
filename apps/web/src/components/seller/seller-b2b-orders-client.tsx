"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { userFacingApiErrorMessage } from "@/lib/api";
import { openB2BPurchaseOrderDocument } from "@/lib/b2b-po-documents";
import { getSellerB2BOrder, listSellerB2BOrders, updateSellerB2BTransport, type SellerB2BOrder, type SellerB2BTransportMode, type SellerB2BTransportStatus } from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formatDateTime,
  formValue,
  isSellerOnboardingRequiredError,
  optionalFormValue,
  rupeesToPaise,
  useSellerAuth,
} from "./seller-ui";
import { formatMoney } from "@/lib/storefront-api";

const orderStatuses = ["", "PROFORMA_ISSUED", "PO_SUBMITTED", "PO_ACCEPTED", "IN_FULFILMENT", "FULFILLED", "CANCELLED"];

export function SellerB2BOrdersClient() {
  const sellerAuth = useSellerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["seller-b2b-orders", sellerAuth.authKey, submittedSearch, status],
    queryFn: () =>
      listSellerB2BOrders(sellerAuth.authHeaders, {
        search: submittedSearch,
        status,
        limit: 30,
      }),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (ordersQuery.error && isSellerOnboardingRequiredError(ordersQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing B2B proforma and PO orders." />;
  }

  const orders = ordersQuery.data?.items ?? [];

  return (
    <SellerPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title="B2B orders" description="Finalised B2B enquiries that now have proforma invoices and PO tracking." />
        <form onSubmit={submitSearch} className="flex w-full gap-2 lg:max-w-md">
          <label className="relative flex-1">
            <span className="sr-only">Search B2B orders</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, proforma, PO"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      <div className="mt-5 max-w-xs">
        <SellerSelect label="B2B order status" name="status" value={status} onChange={setStatus}>
          {orderStatuses.map((option) => (
            <option key={option || "all"} value={option}>
              {option ? option.replace(/_/g, " ") : "All B2B order statuses"}
            </option>
          ))}
        </SellerSelect>
      </div>

      <div className="mt-5 grid gap-4">
        {ordersQuery.isLoading ? <SellerSkeleton /> : null}
        {ordersQuery.error ? <SellerErrorPanel error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
        {!ordersQuery.isLoading && orders.length === 0 ? (
          <SellerEmptyState title="No B2B orders found" message="B2B orders appear after admin finalises a buyer-confirmed quotation." />
        ) : null}
        {orders.map((order) => (
          <Link key={order.id} href={`/seller/b2b-orders/${encodeURIComponent(order.orderNumber)}`} className="block rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500]">
            <B2BOrderHeader order={order} />
          </Link>
        ))}
      </div>
    </SellerPanel>
  );
}

export function SellerB2BOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const orderQuery = useQuery({
    queryKey: ["seller-b2b-order", sellerAuth.authKey, orderNumber],
    queryFn: () => getSellerB2BOrder(sellerAuth.authHeaders, orderNumber),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (orderQuery.error && isSellerOnboardingRequiredError(orderQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before viewing B2B order detail." />;
  }

  const order = orderQuery.data;
  const transportMutation = useMutation({
    mutationFn: (payload: {
      transportMode?: SellerB2BTransportMode;
      transportStatus?: SellerB2BTransportStatus;
      transportChargePaise?: number;
      transportPartnerName?: string;
      transportPartnerPhone?: string;
      transportTrackingRef?: string;
      transportEta?: string;
      transportPickupAddress?: string;
      transportNote?: string;
    }) => updateSellerB2BTransport(sellerAuth.authHeaders, orderNumber, payload),
    onSuccess: async () => {
      setNotice("B2B transport details updated.");
      await queryClient.invalidateQueries({ queryKey: ["seller-b2b-order", sellerAuth.authKey, orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["seller-b2b-orders", sellerAuth.authKey] });
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });

  async function openPurchaseOrder() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        sellerAuth.authHeaders,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/purchase-order/document-access`,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/purchase-order/document`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function openProformaInvoice() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        sellerAuth.authHeaders,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/proforma-invoice/document-access`,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/proforma-invoice`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function openTaxInvoice() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        sellerAuth.authHeaders,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/tax-invoice/document-access`,
        `/api/seller/b2b-orders/${encodeURIComponent(orderNumber)}/tax-invoice`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild variant="ghost">
          <Link href="/seller/b2b-orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to B2B orders
          </Link>
        </Button>
      </div>
      {orderQuery.isLoading ? <SellerSkeleton /> : null}
      {orderQuery.error ? <SellerErrorPanel error={orderQuery.error} onRetry={() => void orderQuery.refetch()} /> : null}
      {notice ? <StatusBadge tone="danger">{notice}</StatusBadge> : null}
      {order ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SellerPanel>
            <B2BOrderHeader order={order} />
            <div className="mt-5 grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 text-sm font-semibold leading-6 text-[#667085] md:grid-cols-2">
              <Info label="Buyer" value={order.businessBuyer?.companyName ?? "Business buyer"} />
              <Info label="Contact" value={order.businessBuyer?.contactPhone ?? "Hidden until B2B payment is confirmed"} />
              <Info label="Product/store" value={order.product?.name ?? order.seller?.storeName ?? "General procurement"} />
              <Info label="PO number" value={order.purchaseOrderNumber ?? "Not submitted"} />
              <Info label="Payment status" value={(order.paymentStatus ?? "PENDING").replace(/_/g, " ")} />
              <Info label="Payment due" value={formatDateTime(order.paymentDueAt)} />
              <Info label="Paid amount" value={formatMoney(order.paidAmountPaise)} />
              <Info label="Seller payout" value={formatMoney(order.sellerPayoutAmountPaise)} />
              <Info label="Payout status" value={payoutStatusText(order)} />
              <Info label="Fulfilment controls" value={fulfilmentLockText(order)} />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Final tax invoice</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1"
                  disabled={order.status !== "FULFILLED"}
                  onClick={() => void openTaxInvoice()}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open invoice
                </Button>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Proforma</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1"
                  onClick={() => void openProformaInvoice()}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View proforma
                </Button>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">PO file</p>
                {order.purchaseOrderFileKey ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1"
                    onClick={() => void openPurchaseOrder()}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View PO
                  </Button>
                ) : (
                  <p className="mt-1 text-sm font-black text-[#1F2933]">Not attached</p>
                )}
              </div>
              <Info label="PO note" value={order.purchaseOrderNote ?? "No buyer note"} />
            </div>
          </SellerPanel>
          <SellerB2BTransportPanel
            order={order}
            isSaving={transportMutation.isPending}
            onSubmit={(payload) => transportMutation.mutate(payload)}
          />
          <SellerPanel>
            <SectionHeading title="Timeline" description="Commercial order events from proforma to fulfilment." />
            <div className="mt-4 grid gap-3">
              {(order.events ?? []).map((event) => (
                <div key={event.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">
                  <SellerStatusPill status={event.status} />
                  <p className="mt-2 font-semibold leading-6 text-[#667085]">{event.note ?? "Status updated."}</p>
                  <p className="mt-1 text-xs font-bold text-[#667085]">{formatDateTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          </SellerPanel>
        </div>
      ) : null}
    </div>
  );
}

function B2BOrderHeader({ order }: { order: SellerB2BOrder }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <SellerStatusPill status={order.status} />
            <StatusBadge tone={paymentTone(order.paymentStatus)}>
              {(order.paymentStatus ?? "PENDING").replace(/_/g, " ")}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
            Proforma {order.proformaInvoiceNumber} / Qty {order.quantity}
          </p>
          <p className="text-xs font-bold text-[#667085]">Issued {formatDateTime(order.proformaIssuedAt)}</p>
      </div>
      <StatusBadge tone="info">{formatMoney(order.subtotalPaise)}</StatusBadge>
    </div>
  );
}

function SellerB2BTransportPanel({
  order,
  isSaving,
  onSubmit,
}: {
  order: SellerB2BOrder;
  isSaving: boolean;
  onSubmit: (payload: {
    transportMode?: SellerB2BTransportMode;
    transportStatus?: SellerB2BTransportStatus;
    transportChargePaise?: number;
    transportPartnerName?: string;
    transportPartnerPhone?: string;
    transportTrackingRef?: string;
    transportEta?: string;
    transportPickupAddress?: string;
    transportNote?: string;
  }) => void;
}) {
  const chargeLocked = Boolean(order.transportChargeLockedAt) || order.status !== "PROFORMA_ISSUED" || (order.paidAmountPaise ?? 0) > 0 || order.paymentStatus !== "PENDING";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const charge = optionalFormValue(form, "transportCharge");
    const transportPartnerName = optionalFormValue(form, "transportPartnerName");
    const transportPartnerPhone = optionalFormValue(form, "transportPartnerPhone");
    const transportTrackingRef = optionalFormValue(form, "transportTrackingRef");
    const transportEta = optionalFormValue(form, "transportEta");
    const transportPickupAddress = optionalFormValue(form, "transportPickupAddress");
    const transportNote = optionalFormValue(form, "transportNote");
    onSubmit({
      transportMode: formValue(form, "transportMode") as SellerB2BTransportMode,
      transportStatus: formValue(form, "transportStatus") as SellerB2BTransportStatus,
      ...(charge && !chargeLocked ? { transportChargePaise: rupeesToPaise(charge) } : {}),
      ...(transportPartnerName ? { transportPartnerName } : {}),
      ...(transportPartnerPhone ? { transportPartnerPhone } : {}),
      ...(transportTrackingRef ? { transportTrackingRef } : {}),
      ...(transportEta ? { transportEta } : {}),
      ...(transportPickupAddress ? { transportPickupAddress } : {}),
      ...(transportNote ? { transportNote } : {}),
    });
  }

  return (
    <SellerPanel>
      <SectionHeading
        title="B2B transport"
        description="Update seller-arranged courier or buyer pickup details for this B2B order. This is separate from normal customer delivery."
      />
      <div className="mt-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 text-sm font-semibold leading-6 text-[#667085] md:grid-cols-2">
        <Info label="Current mode" value={transportLabel(order.transportMode)} />
        <Info label="Current status" value={(order.transportStatus ?? "REQUESTED").replace(/_/g, " ")} />
        <Info label="Transport charge" value={formatMoney(order.transportChargePaise ?? 0)} />
        <Info label="Buyer payable" value={formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise)} />
        <Info label="Partner" value={order.transportPartnerName ?? "Not added"} />
        <Info label="Tracking" value={order.transportTrackingRef ?? "Not added"} />
      </div>
      {chargeLocked ? (
        <p className="mt-4 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] p-3 text-xs font-bold leading-5 text-[#B54708]">
          Transport charge is locked after PO submission or payment activity. You can still update courier, pickup, ETA, tracking, and notes.
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <SellerSelect label="Transport mode" name="transportMode" defaultValue={order.transportMode ?? "SELLER_ARRANGED_TRANSPORT"}>
            <option value="SELLER_ARRANGED_TRANSPORT">Seller-arranged transport</option>
            <option value="STORE_PICKUP">Store pickup by buyer</option>
          </SellerSelect>
          <SellerSelect label="Transport status" name="transportStatus" defaultValue={order.transportStatus ?? "REQUESTED"}>
            {["REQUESTED", "QUOTED", "READY_FOR_PICKUP", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
            ))}
          </SellerSelect>
          <SellerField
            label="Transport charge"
            name="transportCharge"
            type="number"
            min={0}
            step="0.01"
            defaultValue={((order.transportChargePaise ?? 0) / 100).toFixed(2)}
            readOnly={chargeLocked}
          />
          <SellerField label="Transport partner" name="transportPartnerName" defaultValue={order.transportPartnerName ?? ""} placeholder="Courier or goods carrier name" />
          <SellerField label="Partner phone" name="transportPartnerPhone" defaultValue={order.transportPartnerPhone ?? ""} placeholder="+91..." />
          <SellerField label="Tracking / LR / AWB" name="transportTrackingRef" defaultValue={order.transportTrackingRef ?? ""} placeholder="AWB / LR / docket number" />
          <SellerField label="ETA" name="transportEta" defaultValue={order.transportEta ?? ""} placeholder="Expected delivery date or window" />
          <SellerField label="Pickup address" name="transportPickupAddress" defaultValue={order.transportPickupAddress ?? ""} placeholder="Warehouse or store pickup point" />
        </div>
        <SellerTextArea label="Transport note" name="transportNote" rows={3} defaultValue={order.transportNote ?? ""} placeholder="Packing, dispatch proof note, unloading instructions, or buyer coordination details." />
        <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save B2B transport"}</Button>
      </form>
    </SellerPanel>
  );
}

function paymentTone(status?: string | null): "success" | "warning" | "danger" | "info" {
  if (status === "PAID" || status === "NOT_REQUIRED") {
    return "success";
  }
  if (status === "OVERDUE") {
    return "danger";
  }
  if (status === "SUBMITTED_FOR_VERIFICATION" || status === "PARTIALLY_PAID") {
    return "info";
  }
  return "warning";
}

function fulfilmentLockText(order: SellerB2BOrder) {
  if (order.status === "IN_FULFILMENT" || order.status === "FULFILLED") {
    return "Unlocked";
  }
  if (order.status !== "PO_ACCEPTED") {
    return "Locked until PO is accepted";
  }
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "NOT_REQUIRED") {
    return "Locked until payment is cleared";
  }
  return "Ready to unlock";
}

function payoutStatusText(order: SellerB2BOrder) {
  if (order.paymentStatus !== "PAID") {
    return "Waiting for verified payment";
  }
  if (order.status !== "FULFILLED") {
    return "Eligible after fulfilment";
  }
  if (order.settlementStatus === "PAID") {
    return "Paid";
  }
  if (order.settlementStatus === "APPROVED") {
    return "Approved for payout";
  }
  if (order.settlementStatus === "DRAFTED" || order.payoutId) {
    return "In payout batch";
  }
  if (order.settlementStatus === "ELIGIBLE") {
    return "Eligible for payout";
  }
  return "Pending finance review";
}

function transportLabel(value?: string | null) {
  if (value === "STORE_PICKUP") {
    return "Store pickup by buyer";
  }
  return "Seller-arranged B2B transport";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}
