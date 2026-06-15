"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, FileCheck2, FileText, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import {
  getBusinessBuyerB2BOrder,
  getBusinessBuyerProfile,
  listBusinessBuyerB2BOrders,
  submitBusinessBuyerPurchaseOrder,
  type B2BOrder,
  type BusinessBuyerPurchaseOrderPayload,
} from "@/lib/business-buyer-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BEmptyState,
  B2BErrorPanel,
  B2BField,
  B2BPanel,
  B2BSkeleton,
  B2BStatusPill,
  B2BTextArea,
  formatDateTime,
  formatMoney,
  formValue,
  optionalFormValue,
} from "./b2b-ui";

const b2bOrderStatuses = ["", "PROFORMA_ISSUED", "PO_SUBMITTED", "PO_ACCEPTED", "IN_FULFILMENT", "FULFILLED", "CANCELLED"];

export function B2BOrdersClient() {
  const auth = useB2BAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const ordersQuery = useQuery({
    queryKey: ["b2b-orders", auth.authKey, submittedSearch, status],
    queryFn: () =>
      listBusinessBuyerB2BOrders(auth.authHeaders, {
        search: submittedSearch,
        status,
        limit: 30,
      }),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false,
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  const orders = ordersQuery.data?.items ?? [];

  return (
    <B2BShell title="B2B orders" description="Track proforma invoices, purchase orders, and fulfilment state for confirmed B2B procurement.">
      <B2BAuthNotice />
      <B2BPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading title="Commercial orders" description="Finalised enquiries become proforma-backed B2B orders here." />
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
        <div className="mt-4">
          <label className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 w-full max-w-xs rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            >
              {b2bOrderStatuses.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? option.replace(/_/g, " ") : "All B2B order statuses"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </B2BPanel>

      <div className="mt-5 grid gap-4">
        {profileQuery.isLoading || ordersQuery.isLoading ? <B2BSkeleton /> : null}
        {profileQuery.error ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}
        {ordersQuery.error ? <B2BErrorPanel error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
        {!ordersQuery.isLoading && orders.length === 0 ? (
          <B2BEmptyState
            title="No B2B orders yet"
            message="After an admin finalises a confirmed quotation, its proforma invoice and purchase-order workflow will appear here."
            action={
              <Button asChild>
                <Link href="/b2b/enquiries">View enquiries</Link>
              </Button>
            }
          />
        ) : null}
        {orders.map((order) => (
          <B2BOrderSummaryCard key={order.id} order={order} />
        ))}
      </div>
    </B2BShell>
  );
}

export function B2BOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const auth = useB2BAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const orderQuery = useQuery({
    queryKey: ["b2b-order", auth.authKey, orderNumber],
    queryFn: () => getBusinessBuyerB2BOrder(auth.authHeaders, orderNumber),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false,
  });

  const poMutation = useMutation({
    mutationFn: (payload: BusinessBuyerPurchaseOrderPayload) =>
      submitBusinessBuyerPurchaseOrder(auth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNotice("Purchase order submitted for admin review.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-order", auth.authKey, orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-orders", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Purchase order submission failed."),
  });

  function submitPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const purchaseOrderFileKey = optionalFormValue(form, "purchaseOrderFileKey");
    const note = optionalFormValue(form, "note");
    setNotice(null);
    poMutation.mutate({
      purchaseOrderNumber: formValue(form, "purchaseOrderNumber"),
      ...(purchaseOrderFileKey ? { purchaseOrderFileKey } : {}),
      ...(note ? { note } : {}),
    });
  }

  const order = orderQuery.data;
  const canSubmitPo = order ? ["PROFORMA_ISSUED", "PO_SUBMITTED"].includes(order.status) : false;

  return (
    <B2BShell title={`B2B order ${orderNumber}`} description="Review the issued proforma invoice and submit purchase-order details for admin acceptance.">
      <B2BAuthNotice />
      <div className="mb-5">
        <Button asChild variant="ghost">
          <Link href="/b2b/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to B2B orders
          </Link>
        </Button>
      </div>

      {profileQuery.isLoading || orderQuery.isLoading ? <B2BSkeleton /> : null}
      {profileQuery.error ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}
      {orderQuery.error ? <B2BErrorPanel error={orderQuery.error} onRetry={() => void orderQuery.refetch()} /> : null}
      {notice ? (
        <div className="mb-5">
          <StatusBadge tone={poMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
        </div>
      ) : null}

      {order ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <B2BOrderCommercialPanel order={order} />
            <B2BPanel>
              <SectionHeading title="Purchase order" description="Submit the buyer PO reference once the proforma is approved internally." />
              {canSubmitPo ? (
                <form onSubmit={submitPurchaseOrder} className="mt-5 grid gap-4">
                  <B2BField label="Purchase order number" name="purchaseOrderNumber" required defaultValue={order.purchaseOrderNumber ?? null} placeholder="PO-2026-00045" />
                  <B2BField label="PO file key or URL" name="purchaseOrderFileKey" defaultValue={order.purchaseOrderFileKey ?? null} placeholder="private/b2b/po/file.pdf" />
                  <B2BTextArea label="Buyer note" name="note" defaultValue={order.purchaseOrderNote ?? null} rows={4} placeholder="Internal PO approval note, delivery instructions, or terms reference." />
                  <Button type="submit" disabled={poMutation.isPending}>
                    <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                    {poMutation.isPending ? "Submitting..." : "Submit purchase order"}
                  </Button>
                </form>
              ) : (
                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085]">
                  Purchase order changes are locked after admin acceptance or closure.
                </div>
              )}
            </B2BPanel>
          </div>

          <aside className="grid h-fit gap-4">
            <B2BOrderTimeline order={order} />
          </aside>
        </div>
      ) : null}
    </B2BShell>
  );
}

function B2BOrderSummaryCard({ order }: { order: B2BOrder }) {
  return (
    <Link href={`/b2b/orders/${encodeURIComponent(order.orderNumber)}`} className="block rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:border-[#ED3500]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <B2BStatusPill status={order.status} />
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
            {order.product?.name ?? order.seller?.storeName ?? "General B2B procurement"} / Qty {order.quantity}
          </p>
          <p className="text-xs font-bold text-[#667085]">Proforma {order.proformaInvoiceNumber}</p>
        </div>
        <div className="text-sm font-black text-[#163B5C]">
          {formatMoney(order.subtotalPaise)}
        </div>
      </div>
    </Link>
  );
}

function B2BOrderCommercialPanel({ order }: { order: B2BOrder }) {
  return (
    <B2BPanel>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <B2BStatusPill status={order.status} />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#667085]">
            Proforma {order.proformaInvoiceNumber} / issued {formatDateTime(order.proformaIssuedAt)}
          </p>
        </div>
        <StatusBadge tone="info">{formatMoney(order.subtotalPaise)}</StatusBadge>
      </div>
      <div className="mt-5 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085] md:grid-cols-2">
        <Info label="Product/store" value={order.product?.name ?? order.seller?.storeName ?? "General procurement"} />
        <Info label="Quantity" value={String(order.quantity)} />
        <Info label="Unit price" value={formatMoney(order.unitPricePaise)} />
        <Info label="Subtotal" value={formatMoney(order.subtotalPaise)} />
        <Info label="Proforma expires" value={formatDateTime(order.proformaExpiresAt)} />
        <Info label="PO number" value={order.purchaseOrderNumber ?? "Not submitted"} />
      </div>
    </B2BPanel>
  );
}

function B2BOrderTimeline({ order }: { order: B2BOrder }) {
  return (
    <B2BPanel>
      <SectionHeading title="Timeline" description="Commercial order events and admin decisions." />
      <div className="mt-4 grid gap-3">
        {(order.events ?? []).length ? (
          order.events?.map((event) => (
            <div key={event.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <B2BStatusPill status={event.status} />
                <span className="font-bold text-[#667085]">{formatDateTime(event.createdAt)}</span>
              </div>
              <p className="mt-2 font-semibold leading-6 text-[#667085]">{event.note ?? "Status updated."}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-semibold text-[#667085]">No timeline events yet.</p>
        )}
      </div>
    </B2BPanel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#1F2933]">{value}</p>
    </div>
  );
}
