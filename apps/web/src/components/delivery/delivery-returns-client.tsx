"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Search,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import {
  acceptDeliveryReturnPickup,
  getDeliveryReturn,
  listDeliveryReturns,
  recordDeliveryReturnShipmentReceipt,
  rejectDeliveryReturnPickup,
  updateDeliveryReturnPickup,
  type ReturnAddressSnapshot,
  type ReturnDetail,
  type ReverseShipmentStatus,
} from "@/lib/returns-api";
import {
  DeliveryEmptyState,
  DeliveryError,
  DeliveryIconTile,
  DeliveryPanel,
  formatPaise,
  humanize,
  useDeliveryAuth,
} from "./delivery-ui";

export function DeliveryReturnsClient() {
  const auth = useDeliveryAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const returnsQuery = useQuery({
    queryKey: ["delivery-returns", auth.authKey, submittedSearch],
    queryFn: () => listDeliveryReturns(auth.authHeaders, { search: submittedSearch, limit: 40 }),
    enabled: auth.enabled,
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!auth.enabled) return null;

  const returns = returnsQuery.data?.items ?? [];

  return (
    <DeliveryPanel>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <SectionHeading
          title="Return pickup queue"
          description="Accept assigned return pickups, collect from customers, and record seller-store receipt proof."
        />
        <form onSubmit={submit} className="flex w-full gap-2 xl:max-w-md">
          <label className="relative flex-1">
            <span className="sr-only">Search return pickup</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search return or order number"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      <div className="mt-5 grid gap-3">
        {returnsQuery.isLoading ? <div className="h-56 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
        {returnsQuery.error ? <DeliveryError error={returnsQuery.error as Error} onRetry={() => void returnsQuery.refetch()} /> : null}
        {!returnsQuery.isLoading && returns.length === 0 ? (
          <DeliveryEmptyState
            title="No return pickups"
            message="Assigned return pickup tasks will appear here after admin or auto-assignment."
          />
        ) : null}
        {returns.map((request) => (
          <ReturnPickupCard key={request.id} request={request} />
        ))}
      </div>
    </DeliveryPanel>
  );
}

function ReturnPickupCard({ request }: { request: ReturnDetail }) {
  const firstShipment = request.reverseShipments[0];
  const sellerCount = new Set(request.reverseShipments.map((shipment) => shipment.sellerId)).size;
  const accepted = request.reverseShipments.every((shipment) => shipment.assignmentStatus === "ACCEPTED");

  return (
    <div className="grid gap-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <DeliveryIconTile>
          <PackageCheck className="h-5 w-5" aria-hidden="true" />
        </DeliveryIconTile>
        <div className="min-w-0">
          <p className="text-lg font-black text-[#1F2933]">{request.requestNumber}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Order {request.order.orderNumber} / {request.totalQuantity} item{returnPlural(request.totalQuantity)}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#667085]">
            Pickup: {addressLine(request.pickupAddress) || request.customer?.name || "Customer address"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <StatusBadge tone={accepted ? "success" : "warning"}>
            {humanize(firstShipment?.assignmentStatus ?? "ASSIGNED")}
          </StatusBadge>
          <StatusBadge tone={shipmentTone(firstShipment?.status)}>{humanize(firstShipment?.status ?? "REQUESTED")}</StatusBadge>
          <StatusBadge tone="info">{sellerCount} seller package{returnPlural(sellerCount)}</StatusBadge>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <span className="font-black text-[#123A5A]">{formatPaise(request.requestedAmountPaise, request.currency)}</span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/delivery/returns/${request.requestNumber}`}>
              {accepted ? "Update pickup" : "Accept pickup"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeliveryReturnDetailClient({ requestNumber }: { requestNumber: string }) {
  const auth = useDeliveryAuth();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [note, setNote] = useState("");
  const [pickupProof, setPickupProof] = useState("");
  const [trackingReference, setTrackingReference] = useState("");
  const [receiptProofByShipment, setReceiptProofByShipment] = useState<Record<string, string>>({});
  const [receiverByShipment, setReceiverByShipment] = useState<Record<string, string>>({});

  const detailQuery = useQuery({
    queryKey: ["delivery-return", auth.authKey, requestNumber],
    queryFn: () => getDeliveryReturn(auth.authHeaders, requestNumber),
    enabled: auth.enabled,
    retry: false,
  });

  const detail = detailQuery.data;

  useEffect(() => {
    setTrackingReference(detail?.reverseShipments[0]?.trackingReference ?? "");
  }, [detail]);

  const acceptMutation = useMutation({
    mutationFn: () => acceptDeliveryReturnPickup(auth.authHeaders, requestNumber, notePayload(note)),
    onSuccess: () => afterMutation("Return pickup accepted."),
    onError: (error) => showError(error, "Could not accept return pickup."),
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectDeliveryReturnPickup(auth.authHeaders, requestNumber, notePayload(note)),
    onSuccess: () => afterMutation("Return pickup rejected and released."),
    onError: (error) => showError(error, "Could not reject return pickup."),
  });
  const pickupMutation = useMutation({
    mutationFn: (status: ReverseShipmentStatus) =>
      updateDeliveryReturnPickup(auth.authHeaders, requestNumber, {
        status,
        ...(trackingReference.trim() ? { trackingReference: trackingReference.trim() } : {}),
        ...(pickupProof.trim() ? { pickupProofReference: pickupProof.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => afterMutation("Return pickup progress updated."),
    onError: (error) => showError(error, "Could not update pickup progress."),
  });
  const receiptMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      recordDeliveryReturnShipmentReceipt(auth.authHeaders, requestNumber, shipmentId, {
        receivedByName: receiverByShipment[shipmentId]?.trim() ?? "",
        ...(receiptProofByShipment[shipmentId]?.trim() ? { receiptProofReference: receiptProofByShipment[shipmentId]?.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => afterMutation("Seller receipt recorded."),
    onError: (error) => showError(error, "Could not record seller receipt."),
  });

  function afterMutation(message: string) {
    setNotice({ message, tone: "success" });
    setNote("");
    void queryClient.invalidateQueries({ queryKey: ["delivery-return", auth.authKey, requestNumber] });
    void queryClient.invalidateQueries({ queryKey: ["delivery-returns", auth.authKey] });
  }

  function showError(error: unknown, fallback: string) {
    setNotice({ message: error instanceof Error ? error.message : fallback, tone: "danger" });
  }

  if (!auth.enabled) return null;

  if (detailQuery.isLoading) {
    return <DeliveryPanel><div className="h-96 animate-pulse rounded-md bg-[#F8FAFC]" /></DeliveryPanel>;
  }

  if (detailQuery.error) {
    return <DeliveryError error={detailQuery.error as Error} onRetry={() => void detailQuery.refetch()} />;
  }

  if (!detail) {
    return <DeliveryEmptyState title="Return pickup not found" message="This pickup is not assigned to your delivery account." />;
  }

  const allAccepted = detail.reverseShipments.every((shipment) => shipment.assignmentStatus === "ACCEPTED");
  const anyPicked = detail.reverseShipments.some((shipment) => shipment.status === "PICKED_UP" || shipment.status === "IN_TRANSIT" || shipment.status === "RECEIVED");
  const allReceived = detail.reverseShipments.every((shipment) => shipment.status === "RECEIVED");

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/delivery/returns"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to return pickups</Link>
      </Button>

      {notice ? (
        <div className={cn("rounded-md border p-4 text-sm font-black", notice.tone === "success" ? "border-[#B7E4CE] bg-[#ECFDF3] text-[#0F8A5F]" : "border-[#F5B7B7] bg-[#FDECEC] text-[#B42318]")}>
          {notice.message}
        </div>
      ) : null}

      <DeliveryPanel>
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={allAccepted ? "success" : "warning"}>{allAccepted ? "Accepted" : "Awaiting acceptance"}</StatusBadge>
              <StatusBadge tone={allReceived ? "success" : anyPicked ? "info" : "warning"}>{humanize(detail.status)}</StatusBadge>
            </div>
            <h2 className="mt-3 text-3xl font-black text-[#123A5A]">{detail.requestNumber}</h2>
            <p className="mt-2 text-sm font-semibold text-[#667085]">
              Order {detail.order.orderNumber} / {detail.totalQuantity} return item{returnPlural(detail.totalQuantity)} / {formatPaise(detail.requestedAmountPaise, detail.currency)}
            </p>
          </div>
          <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Pickup customer</p>
            <p className="mt-2 text-base font-black text-[#1F2933]">{detail.customer?.name ?? "Customer"}</p>
            <p className="mt-1 text-sm font-semibold text-[#667085]">{detail.customer?.phone ?? detail.pickupAddress?.phone ?? "Phone not available"}</p>
          </div>
        </div>
      </DeliveryPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          <RouteCard title="Pickup address" icon={<MapPin className="h-5 w-5" />} {...(detail.pickupAddress ? { address: detail.pickupAddress } : {})} />
          <DeliveryPanel>
            <SectionHeading title="Seller packages" description="Carry each seller package separately and record receipt proof at the seller store." />
            <div className="mt-4 grid gap-3">
              {detail.reverseShipments.map((shipment) => (
                <div key={shipment.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-base font-black text-[#1F2933]">{shipment.seller?.storeName ?? "Seller store"}</p>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">{addressLine(shipment.seller?.destinationAddress) || "Seller address not available"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <StatusBadge tone={shipmentTone(shipment.status)}>{humanize(shipment.status)}</StatusBadge>
                      <StatusBadge tone={shipment.assignmentStatus === "ACCEPTED" ? "success" : "warning"}>{humanize(shipment.assignmentStatus)}</StatusBadge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <input
                      value={receiverByShipment[shipment.id] ?? ""}
                      onChange={(event) => setReceiverByShipment((current) => ({ ...current, [shipment.id]: event.target.value }))}
                      placeholder="Receiver name at seller store"
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                      disabled={shipment.status === "RECEIVED"}
                    />
                    <input
                      value={receiptProofByShipment[shipment.id] ?? ""}
                      onChange={(event) => setReceiptProofByShipment((current) => ({ ...current, [shipment.id]: event.target.value }))}
                      placeholder="Receipt proof reference"
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                      disabled={shipment.status === "RECEIVED"}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={shipment.status === "RECEIVED" ? "outline" : "primary"}
                      disabled={
                        shipment.status === "RECEIVED" ||
                        shipment.assignmentStatus !== "ACCEPTED" ||
                        !["PICKED_UP", "IN_TRANSIT"].includes(shipment.status) ||
                        receiptMutation.isPending
                      }
                      onClick={() => receiptMutation.mutate(shipment.id)}
                    >
                      <Store className="h-4 w-4" aria-hidden="true" />
                      {shipment.status === "RECEIVED" ? "Received" : "Record seller receipt"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DeliveryPanel>
        </div>

        <aside className="space-y-5">
          <DeliveryPanel>
            <SectionHeading title="Pickup actions" description="Follow the return pickup steps in order." />
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Tracking reference</span>
              <input
                value={trackingReference}
                onChange={(event) => setTrackingReference(event.target.value)}
                placeholder="Return tracking reference"
                className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Pickup proof reference</span>
              <input
                value={pickupProof}
                onChange={(event) => setPickupProof(event.target.value)}
                placeholder="Photo/file reference after customer pickup"
                className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Short handover note"
                className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <div className="mt-4 grid gap-2">
              {!allAccepted ? (
                <>
                  <Button type="button" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Accept pickup
                  </Button>
                  <Button type="button" variant="outline" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    Reject pickup
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" onClick={() => pickupMutation.mutate("PICKED_UP")} disabled={pickupMutation.isPending || anyPicked}>
                    <PackageCheck className="h-4 w-4" aria-hidden="true" />
                    Mark picked up
                  </Button>
                  <Button type="button" variant="outline" onClick={() => pickupMutation.mutate("IN_TRANSIT")} disabled={pickupMutation.isPending || !anyPicked || allReceived}>
                    <Truck className="h-4 w-4" aria-hidden="true" />
                    Mark in transit
                  </Button>
                </>
              )}
            </div>
          </DeliveryPanel>

          <DeliveryPanel>
            <SectionHeading title="Items" description="Items requested by the customer for this return." />
            <div className="mt-4 grid gap-2">
              {detail.items.map((item) => (
                <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="text-sm font-black text-[#1F2933]">{item.productName}</p>
                  <p className="mt-1 text-xs font-bold text-[#667085]">
                    {item.seller?.storeName ?? "Seller"} / Qty {item.quantity}
                  </p>
                </div>
              ))}
            </div>
          </DeliveryPanel>
        </aside>
      </div>
    </div>
  );
}

function RouteCard({ title, icon, address }: { title: string; icon: ReactNode; address?: ReturnAddressSnapshot | null }) {
  return (
    <DeliveryPanel>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">{icon}</span>
        <div>
          <h3 className="text-lg font-black text-[#1F2933]">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{addressBlock(address)}</p>
        </div>
      </div>
    </DeliveryPanel>
  );
}

function addressLine(address?: ReturnAddressSnapshot | null) {
  if (!address) return "";
  return [address.line1, address.area, address.city, address.pincode].filter(Boolean).join(", ");
}

function addressBlock(address?: ReturnAddressSnapshot | null) {
  if (!address) return "Address not available.";
  return [address.fullName, address.phone, address.line1, address.line2, address.area, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join("\n");
}

function shipmentTone(status?: string | null) {
  if (status === "RECEIVED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "IN_TRANSIT" || status === "PICKED_UP") return "info";
  return "warning";
}

function returnPlural(quantity: number) {
  return quantity === 1 ? "" : "s";
}

function notePayload(note: string) {
  return note.trim() ? { note: note.trim() } : {};
}
