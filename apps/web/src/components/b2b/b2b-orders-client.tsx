"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ExternalLink, FileCheck2, FileText, Search, UploadCloud } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  openB2BPurchaseOrderDocument,
  uploadB2BPaymentProofDocument,
  uploadB2BPurchaseOrderDocument,
  validateB2BPurchaseOrderFile,
} from "@/lib/b2b-po-documents";
import {
  getBusinessBuyerB2BOrder,
  getBusinessBuyerProfile,
  listBusinessBuyerB2BOrders,
  submitBusinessBuyerPaymentProof,
  submitBusinessBuyerPurchaseOrder,
  type B2BOrder,
  type B2BPaymentProofPayload,
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
  const [poFile, setPoFile] = useState<File | null>(null);
  const [uploadedPoKey, setUploadedPoKey] = useState<string | null>(null);
  const [isUploadingPo, setIsUploadingPo] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

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
      setPoFile(null);
      void queryClient.invalidateQueries({ queryKey: ["b2b-order", auth.authKey, orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-orders", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Purchase order submission failed."),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: B2BPaymentProofPayload) =>
      submitBusinessBuyerPaymentProof(auth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNotice("Payment proof submitted for finance verification.");
      setProofFile(null);
      void queryClient.invalidateQueries({ queryKey: ["b2b-order", auth.authKey, orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-orders", auth.authKey] });
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });

  async function submitPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = optionalFormValue(form, "note");
    setNotice(null);

    let purchaseOrderFileKey = uploadedPoKey ?? order?.purchaseOrderFileKey ?? "";

    try {
      if (poFile) {
        setIsUploadingPo(true);
        purchaseOrderFileKey = await uploadB2BPurchaseOrderDocument(
          auth.authHeaders,
          orderNumber,
          poFile,
        );
        setUploadedPoKey(purchaseOrderFileKey);
      }
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
      setIsUploadingPo(false);
      return;
    } finally {
      setIsUploadingPo(false);
    }

    if (!purchaseOrderFileKey) {
      setNotice("Upload a purchase order file before submitting PO details.");
      return;
    }

    poMutation.mutate({
      purchaseOrderNumber: formValue(form, "purchaseOrderNumber"),
      purchaseOrderFileKey,
      ...(note ? { note } : {}),
    });
  }

  function selectPoFile(file: File | null) {
    setUploadedPoKey(null);
    setNotice(null);

    if (!file) {
      setPoFile(null);
      return;
    }

    try {
      validateB2BPurchaseOrderFile(file);
      setPoFile(file);
    } catch (error) {
      setPoFile(null);
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function openPurchaseOrder() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        auth.authHeaders,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/document-access`,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/purchase-order/document`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function openProformaInvoice() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        auth.authHeaders,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/proforma-invoice/document-access`,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/proforma-invoice`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function openTaxInvoice() {
    setNotice(null);

    try {
      await openB2BPurchaseOrderDocument(
        auth.authHeaders,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/tax-invoice/document-access`,
        `/api/b2b/orders/${encodeURIComponent(orderNumber)}/tax-invoice`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    }
  }

  async function submitPaymentProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proofFile) {
      setNotice("Upload a bank receipt before submitting payment proof.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setNotice(null);

    try {
      setIsUploadingProof(true);
      const proofFileKey = await uploadB2BPaymentProofDocument(auth.authHeaders, orderNumber, proofFile);
      paymentMutation.mutate({
        method: "BANK_TRANSFER",
        amountPaise: Math.round(Number(formValue(form, "amountRupees")) * 100),
        currency: order?.currency ?? "INR",
        referenceNumber: formValue(form, "referenceNumber"),
        proofFileKey,
      });
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setIsUploadingProof(false);
    }
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
          <StatusBadge tone={poMutation.isError || paymentMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
        </div>
      ) : null}

      {order ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <B2BOrderCommercialPanel order={order} />
            <B2BTransportPanel order={order} />
            <B2BProformaPanel order={order} onOpen={openProformaInvoice} />
            <B2BFinalTaxInvoicePanel order={order} onOpen={openTaxInvoice} />
            <B2BOrderPaymentPanel
              order={order}
              proofFile={proofFile}
              isSubmitting={paymentMutation.isPending || isUploadingProof}
              onProofFile={(file) => {
                setNotice(null);
                if (!file) {
                  setProofFile(null);
                  return;
                }
                try {
                  validateB2BPurchaseOrderFile(file);
                  setProofFile(file);
                } catch (error) {
                  setProofFile(null);
                  setNotice(userFacingApiErrorMessage(error));
                }
              }}
              onSubmit={submitPaymentProof}
            />
            <B2BPaymentProofHistory order={order} />
            <B2BPanel>
              <SectionHeading title="Purchase order" description="Submit the buyer PO reference once the proforma is approved internally." />
              {canSubmitPo ? (
                <form onSubmit={submitPurchaseOrder} className="mt-5 grid gap-4">
                  <B2BField label="Purchase order number" name="purchaseOrderNumber" required defaultValue={order.purchaseOrderNumber ?? null} placeholder="PO-2026-00045" />
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Purchase order file</span>
                    <span className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-[#F3B199] bg-[#FFF7F4] px-4 py-5 text-center">
                      <UploadCloud className="h-6 w-6 text-[#ED3500]" aria-hidden="true" />
                      <span className="mt-2 text-sm font-black text-[#1F2933]">
                        {poFile?.name ?? "Upload signed PO document"}
                      </span>
                      <span className="mt-1 text-xs font-semibold text-[#667085]">
                        PDF, JPG, PNG, or WebP / max 10 MB
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(event) => selectPoFile(event.target.files?.[0] ?? null)}
                        className="mt-4 block w-full max-w-xs cursor-pointer rounded-md border border-[#F3E7E2] bg-white px-3 py-2 text-xs font-bold text-[#667085] file:mr-3 file:rounded-full file:border-0 file:bg-[#ED3500] file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                      />
                    </span>
                  </label>
                  {order.purchaseOrderFileKey || uploadedPoKey ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-[#F3E7E2] bg-white p-3 text-sm font-semibold text-[#667085] sm:flex-row sm:items-center sm:justify-between">
                      <span className="break-all">
                        Current PO: {uploadedPoKey ?? order.purchaseOrderFileKey}
                      </span>
                      {order.purchaseOrderFileKey ? (
                        <Button type="button" variant="ghost" onClick={() => void openPurchaseOrder()}>
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          View PO
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <B2BTextArea label="Buyer note" name="note" defaultValue={order.purchaseOrderNote ?? null} rows={4} placeholder="Internal PO approval note, delivery instructions, or terms reference." />
                  <Button type="submit" disabled={poMutation.isPending || isUploadingPo}>
                    <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                    {isUploadingPo ? "Uploading PO..." : poMutation.isPending ? "Submitting..." : "Submit purchase order"}
                  </Button>
                </form>
              ) : (
                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085]">
                  Purchase order changes are locked after admin acceptance or closure.
                  {order.purchaseOrderFileKey ? (
                    <div className="mt-3">
                      <Button type="button" variant="ghost" onClick={() => void openPurchaseOrder()}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        View submitted PO
                      </Button>
                    </div>
                  ) : null}
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
          {formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise)}
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
        <Info label="Buyer payable" value={formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise)} />
        <Info label="B2B transport" value={`${transportLabel(order.transportMode)} / ${formatMoney(order.transportChargePaise ?? 0)}`} />
        <Info label="Proforma expires" value={formatDateTime(order.proformaExpiresAt)} />
        <Info label="Payment due" value={formatDateTime(order.paymentDueAt)} />
        <Info label="Payment status" value={(order.paymentStatus ?? "PENDING").replace(/_/g, " ")} />
        <Info label="PO number" value={order.purchaseOrderNumber ?? "Not submitted"} />
      </div>
    </B2BPanel>
  );
}

function B2BTransportPanel({ order }: { order: B2BOrder }) {
  return (
    <B2BPanel>
      <SectionHeading
        title="B2B transport"
        description="This is seller-arranged B2B transport or buyer pickup for this commercial order, separate from normal customer delivery."
      />
      <div className="mt-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold leading-6 text-[#667085] md:grid-cols-2">
        <Info label="Mode" value={transportLabel(order.transportMode)} />
        <Info label="Status" value={(order.transportStatus ?? "REQUESTED").replace(/_/g, " ")} />
        <Info label="Charge in proforma" value={formatMoney(order.transportChargePaise ?? 0)} />
        <Info label="ETA" value={order.transportEta ?? "Not provided"} />
        <Info label="Partner" value={order.transportPartnerName ?? "Seller will update after dispatch"} />
        <Info label="Tracking reference" value={order.transportTrackingRef ?? "Not available yet"} />
        <Info label="Pickup address" value={order.transportPickupAddress ?? "Seller will share if pickup applies"} />
        <Info label="Transport note" value={order.transportNote ?? order.enquiry?.transportNote ?? "No note"} />
      </div>
    </B2BPanel>
  );
}

function B2BProformaPanel({ order, onOpen }: { order: B2BOrder; onOpen: () => void }) {
  return (
    <B2BPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title="Proforma invoice" description="Download the current commercial proforma before submitting PO and payment." />
        <Button type="button" variant="outline" onClick={onOpen}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Download PDF
        </Button>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085] md:grid-cols-3">
        <Info label="Invoice number" value={order.proformaInvoiceNumber} />
        <Info label="Issued" value={formatDateTime(order.proformaIssuedAt)} />
        <Info label="Expires" value={formatDateTime(order.proformaExpiresAt)} />
      </div>
    </B2BPanel>
  );
}

function B2BFinalTaxInvoicePanel({ order, onOpen }: { order: B2BOrder; onOpen: () => Promise<void> }) {
  const available = order.status === "FULFILLED";

  return (
    <B2BPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          title="Final tax invoice"
          description={available ? "Download the server-generated final tax invoice PDF." : "Available after seller fulfilment is complete."}
        />
        <Button
          type="button"
          variant={available ? "outline" : "ghost"}
          disabled={!available}
          onClick={() => void onOpen()}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open invoice
        </Button>
      </div>
    </B2BPanel>
  );
}

function B2BOrderPaymentPanel({
  order,
  proofFile,
  isSubmitting,
  onProofFile,
  onSubmit,
}: {
  order: B2BOrder;
  proofFile: File | null;
  isSubmitting: boolean;
  onProofFile: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const paymentStatus = order.paymentStatus ?? "PENDING";
  const locked = ["PAID", "NOT_REQUIRED", "REFUNDED"].includes(paymentStatus);
  const defaultAmount = ((order.buyerPayableAmountPaise ?? order.subtotalPaise ?? 0) / 100).toFixed(2);
  const bankTransfer = order.paymentInstructions?.bankTransfer;
  const bankDetails = bankTransfer?.bankTransferDetails;
  const bankConfigured = Boolean(bankTransfer?.enabled && bankTransfer.configured && bankDetails);

  return (
    <B2BPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading title="Payment proof" description="Submit bank transfer details for finance verification." />
        <StatusBadge tone={paymentStatus === "PAID" || paymentStatus === "NOT_REQUIRED" ? "success" : paymentStatus === "OVERDUE" ? "danger" : "warning"}>
          {paymentStatus.replace(/_/g, " ")}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085] md:grid-cols-3">
        <Info label="Buyer payable" value={formatMoney(order.buyerPayableAmountPaise ?? order.subtotalPaise)} />
        <Info label="Paid amount" value={formatMoney(order.paidAmountPaise)} />
        <Info label="Due date" value={formatDateTime(order.paymentDueAt)} />
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-[#F3E7E2] bg-[#FFF7F4] p-4 text-sm font-semibold text-[#667085] md:grid-cols-2">
        <Info label="Payment method" value={bankTransfer?.label ?? "Bank transfer"} />
        <Info label="Account holder" value={bankDetails?.accountHolderName || "Not configured"} />
        <Info label="Bank" value={bankDetails?.bankName || "Not configured"} />
        <Info label="Account number" value={bankDetails?.accountNumber || "Not configured"} />
        <Info label="IFSC" value={bankDetails?.ifscCode || "Not configured"} />
        <Info label="UPI" value={bankDetails?.upiId || "Not configured"} />
        <Info label="Reference" value={bankDetails?.referenceRequired === false ? "Reference optional" : "UTR / NEFT / RTGS reference required"} />
        <Info label="Instructions" value={bankTransfer?.instructions || bankTransfer?.note || "Transfer to the configured platform bank account."} />
      </div>
      {!bankConfigured && !locked ? (
        <p className="mt-4 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] p-4 text-sm font-bold text-[#B54708]">
          Bank transfer is not fully configured by admin yet. Please wait for finance instructions before transferring funds.
        </p>
      ) : null}
      {locked ? (
        <p className="mt-4 rounded-lg border border-[#D1FADF] bg-[#F6FEF9] p-4 text-sm font-bold text-[#027A48]">
          Payment is complete for this B2B order.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <B2BField label="UTR / bank reference" name="referenceNumber" required placeholder="UTR1234567890" />
            <B2BField label="Amount paid in rupees" name="amountRupees" required defaultValue={defaultAmount} placeholder="100000.00" />
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Bank receipt</span>
            <span className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-dashed border-[#F3B199] bg-[#FFF7F4] px-4 py-5 text-center">
              <UploadCloud className="h-6 w-6 text-[#ED3500]" aria-hidden="true" />
              <span className="mt-2 text-sm font-black text-[#1F2933]">
                {proofFile?.name ?? "Upload receipt or screenshot"}
              </span>
              <span className="mt-1 text-xs font-semibold text-[#667085]">PDF, JPG, PNG, or WebP / max 10 MB</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => onProofFile(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full max-w-xs cursor-pointer rounded-md border border-[#F3E7E2] bg-white px-3 py-2 text-xs font-bold text-[#667085] file:mr-3 file:rounded-full file:border-0 file:bg-[#ED3500] file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
              />
            </span>
          </label>
          <Button type="submit" disabled={isSubmitting}>
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Submitting proof..." : "Submit payment proof"}
          </Button>
        </form>
      )}
    </B2BPanel>
  );
}

function B2BPaymentProofHistory({ order }: { order: B2BOrder }) {
  const proofs = order.paymentProofs ?? [];

  return (
    <B2BPanel>
      <SectionHeading title="Payment proof history" description="All submitted receipts and finance decisions remain visible for audit." />
      <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB]">
        <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
          <thead className="bg-[#F8FAFC] text-left text-xs font-black uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Reference</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Finance note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {proofs.length ? (
              proofs.map((proof) => (
                <tr key={proof.id}>
                  <td className="px-3 py-3 font-semibold text-[#667085]">{formatDateTime(proof.submittedAt)}</td>
                  <td className="px-3 py-3 font-black text-[#1F2933]">{proof.referenceNumber ?? "Manual"}</td>
                  <td className="px-3 py-3 font-black text-[#163B5C]">
                    {formatMoney(proof.amountPaise)}
                    {(proof.overpaymentAmountPaise ?? 0) > 0 ? (
                      <span className="mt-1 block text-xs text-[#B54708]">
                        Overpayment {formatMoney(proof.overpaymentAmountPaise)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={proof.status === "VERIFIED" ? "success" : proof.status === "REJECTED" || proof.status === "RAZORPAY_FAILED" ? "danger" : "warning"}>
                      {proof.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3 font-semibold text-[#667085]">
                    {proof.rejectionReason ?? proof.note ?? "Awaiting review"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-5 font-semibold text-[#667085]" colSpan={5}>
                  No payment proof has been submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

function transportLabel(value?: string | null) {
  if (value === "STORE_PICKUP") {
    return "Store pickup by buyer";
  }
  return "Seller-arranged B2B transport";
}
