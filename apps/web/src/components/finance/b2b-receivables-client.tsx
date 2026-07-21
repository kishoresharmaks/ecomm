"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, Download, RefreshCw, Search } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  b2bAction,
  downloadB2BDocument,
  getFinanceB2BOperation,
  idempotencyKey,
  listFinanceB2BReceivables,
  type B2BOperationalOrder,
} from "@/lib/b2b-operations-api";

const statuses = ["", "OPEN", "PARTIALLY_PAID", "OVERDUE", "DISPUTED", "PAID"];

export function FinanceB2BReceivablesClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;
  const query = useQuery({
    queryKey: ["finance-b2b-receivables", submittedSearch, status, page, auth.authHeaders],
    queryFn: () =>
      listFinanceB2BReceivables(auth.authHeaders, {
        search: submittedSearch,
        status,
        page,
        limit,
      }),
    enabled: auth.isAuthenticated,
    retry: false,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search.trim());
  }

  return (
    <div className="grid gap-5">
      <section className="border-b border-[#E5E7EB] pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionHeading title="B2B ageing register" description="Invoice-level outstanding balances, ageing, collection activity, and payment clearance." />
          <form onSubmit={submit} className="flex w-full gap-2 xl:max-w-lg">
            <label className="relative flex-1">
              <span className="sr-only">Search B2B receivables</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order or buyer" className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ED3500]" />
            </label>
            <Button type="submit"><Search className="h-4 w-4" aria-hidden="true" /> Search</Button>
          </form>
        </div>
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="mt-4 h-11 w-full max-w-xs rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold">
          {statuses.map((value) => <option key={value || "all"} value={value}>{value ? humanize(value) : "All receivable statuses"}</option>)}
        </select>
      </section>

      {query.isLoading ? <div className="h-64 animate-pulse rounded-md bg-white" /> : null}
      {query.error ? <Notice tone="danger" message={userFacingApiErrorMessage(query.error)} /> : null}
      {!query.isLoading && !query.data?.items.length ? <Notice tone="info" message="No B2B receivables match the current filters." /> : null}

      <div className="grid gap-3">
        {query.data?.items.map((receivable) => (
          <article key={receivable.id} className="grid gap-4 border-b border-[#E5E7EB] bg-white px-4 py-4 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(120px,auto))_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black text-[#1F2933]">{receivable.order.orderNumber}</p>
                <StatusBadge tone={receivable.status === "OVERDUE" ? "danger" : receivable.status === "PAID" ? "success" : "warning"}>{humanize(receivable.status)}</StatusBadge>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#667085]">{receivable.order.businessBuyer.companyName} / {receivable.order.seller?.storeName ?? "Seller"}</p>
            </div>
            <Value label="Outstanding" value={money(receivable.outstandingAmountPaise)} />
            <Value label="Due" value={date(receivable.dueAt)} />
            <Value label="Ageing" value={humanize(receivable.ageingBucket)} />
            <Button asChild size="sm"><Link href={`/finance/b2b-orders/${encodeURIComponent(receivable.order.orderNumber)}`}>Open</Link></Button>
          </article>
        ))}
      </div>

      {(query.data?.total ?? 0) > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
          <p className="text-sm font-semibold text-[#667085]">Page {query.data?.page ?? page} of {query.data?.totalPages ?? 1} / {query.data?.total ?? 0} receivables</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
            <Button type="button" variant="outline" disabled={page >= (query.data?.totalPages ?? 1) || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FinanceB2BOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const auth = useAdminAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [term, setTerm] = useState("PREPAID_FULL");
  const [creditLimitRupees, setCreditLimitRupees] = useState("");
  const [downloading, setDownloading] = useState(false);
  const query = useQuery({
    queryKey: ["finance-b2b-order", orderNumber, auth.authHeaders],
    queryFn: () => getFinanceB2BOperation(auth.authHeaders, orderNumber),
    enabled: auth.isAuthenticated,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({
      path,
      payload,
      method = "POST",
    }: {
      path: string;
      payload: Record<string, unknown>;
      method?: "POST" | "PUT";
    }) => b2bAction(auth.authHeaders, path, payload, method, idempotencyKey("finance-b2b")),
    onSuccess: () => {
      setNotice("Finance action saved.");
      void query.refetch();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const order = query.data;

  async function downloadReceipt(paymentId: string, fileName: string) {
    try {
      setDownloading(true);
      await downloadB2BDocument(
        auth.authHeaders,
        `/api/finance/b2b/orders/${encodeURIComponent(orderNumber)}/payments/${paymentId}/receipt`,
        fileName,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div><Button asChild variant="ghost"><Link href="/finance/b2b-receivables"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to receivables</Link></Button></div>
      {query.isLoading ? <div className="h-64 animate-pulse rounded-md bg-white" /> : null}
      {query.error ? <Notice tone="danger" message={userFacingApiErrorMessage(query.error)} /> : null}
      {notice ? <Notice tone="info" message={notice} /> : null}
      {order ? (
        <>
          <OrderFinanceSummary
            order={order}
            isRefreshing={query.isFetching}
            onRefresh={() => void query.refetch()}
          />
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="bg-white p-5">
              <SectionHeading title="Credit clearance" description="Approve prepaid, advance, milestone, or permitted net terms against current exposure." />
              <div className="mt-4 grid gap-3">
                <select value={term} onChange={(event) => setTerm(event.target.value)} className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-bold">
                  {["PREPAID_FULL", "ADVANCE_PERCENT", "MILESTONE", "NET_7", "NET_15", "NET_30", "NET_45"].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
                </select>
                <input value={creditLimitRupees} onChange={(event) => setCreditLimitRupees(event.target.value)} inputMode="numeric" placeholder="Approved amount in INR" className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="button" disabled={action.isPending} onClick={() => action.mutate({ path: `/api/finance/b2b/orders/${encodeURIComponent(order.orderNumber)}/credit-decision`, payload: { version: order.version, status: term === "PREPAID_FULL" ? "NOT_REQUIRED" : "APPROVED", paymentTermType: term, approvedAmountPaise: creditLimitRupees ? Math.round(Number(creditLimitRupees) * 100) : order.buyerPayableAmountPaise } })}>Save credit decision</Button>
              </div>
            </section>
            <section className="bg-white p-5">
              <SectionHeading title="Buyer credit profile" description="Maintain the reusable approved limit and permitted terms for this business buyer." />
              <div className="mt-4 grid gap-3">
                <input value={creditLimitRupees} onChange={(event) => setCreditLimitRupees(event.target.value)} inputMode="numeric" placeholder="Credit limit in INR" className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                <Button type="button" variant="outline" disabled={action.isPending || !order.businessBuyer?.id || !creditLimitRupees} onClick={() => action.mutate({ method: "PUT", path: `/api/finance/b2b/buyers/${order.businessBuyer!.id}/credit-profile`, payload: { creditLimitPaise: Math.round(Number(creditLimitRupees) * 100), allowedTerms: ["NET_7", "NET_15", "NET_30", "NET_45"], isActive: true } })}>Update buyer limit</Button>
              </div>
            </section>
          </div>
          <section className="bg-white p-5">
            <SectionHeading title="Payment verification" description="Verified non-cheque payments and cleared cheques allocate automatically to schedules and receivables." />
            <div className="mt-4 grid gap-3">
              {order.paymentRecords.length ? order.paymentRecords.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2F6] pb-3">
                  <div><p className="font-black">{payment.referenceNumber ?? payment.id}</p><p className="text-sm font-semibold text-[#667085]">{humanize(payment.method)} / {money(payment.amountPaise)}</p></div>
                  <div className="flex items-center gap-2"><StatusBadge tone={payment.status === "CLEARED" ? "success" : "warning"}>{humanize(payment.status)}</StatusBadge>{["SUBMITTED", "VERIFIED"].includes(payment.status) ? <Button type="button" size="sm" disabled={action.isPending} onClick={() => action.mutate({ path: `/api/finance/b2b/payments/${payment.id}/verify`, payload: { status: payment.method === "CHEQUE" ? "CLEARED" : "VERIFIED" } })}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Verify</Button> : null}{payment.receiptVoucher ? <Button type="button" size="sm" variant="outline" disabled={downloading} onClick={() => void downloadReceipt(payment.id, `${payment.receiptVoucher?.voucherNumber ?? "b2b-receipt"}.pdf`)}><Download className="h-4 w-4" aria-hidden="true" /> Receipt</Button> : null}</div>
                </div>
              )) : <p className="text-sm font-semibold text-[#667085]">No V2 payment records submitted.</p>}
            </div>
          </section>
          {order.receivable ? (
            <section className="bg-white p-5">
              <SectionHeading title="Collection activity" description="Create a follow-up task or review the automated reminder schedule." />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusBadge tone={order.receivable.status === "OVERDUE" ? "danger" : "warning"}>{humanize(order.receivable.status)}</StatusBadge>
                <span className="font-black">{money(order.receivable.outstandingAmountPaise)} outstanding</span>
                <Button type="button" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ path: "/api/finance/b2b/collection-tasks", payload: { receivableId: order.receivable!.id, dueAt: new Date().toISOString(), note: "Finance follow-up created from the B2B receivable workspace." } })}><CalendarClock className="h-4 w-4" aria-hidden="true" /> Create follow-up</Button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function OrderFinanceSummary({
  order,
  isRefreshing,
  onRefresh,
}: {
  order: B2BOperationalOrder;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-wide text-[#ED3500]">B2B receivable</p><h2 className="mt-1 text-2xl font-black">{order.orderNumber}</h2><p className="mt-1 text-sm font-semibold text-[#667085]">{order.businessBuyer?.companyName} / {order.seller?.storeName}</p></div>
        <Button type="button" variant="outline" disabled={isRefreshing} onClick={onRefresh}><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh</Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Value label="Invoice value" value={money(order.buyerPayableAmountPaise)} /><Value label="Paid" value={money(order.paidAmountPaise)} /><Value label="Outstanding" value={money(order.receivable?.outstandingAmountPaise ?? order.buyerPayableAmountPaise - order.paidAmountPaise)} /><Value label="Due" value={date(order.receivable?.dueAt ?? order.paymentDueAt)} /></div>
    </section>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="mt-1 font-black text-[#1F2933]">{value}</p></div>;
}

function Notice({ tone, message }: { tone: "danger" | "info"; message: string }) {
  return <div className={`rounded-md border p-4 text-sm font-bold ${tone === "danger" ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#B9D7EA] bg-[#EFF8FF] text-[#175CD3]"}`}>{message}</div>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
