"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Download, PackageCheck, Search, Truck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import {
  b2bAction,
  downloadB2BDocument,
  getAssignedB2BShipment,
  listAssignedB2BShipments,
} from "@/lib/b2b-operations-api";
import { uploadDeliveryProof, validateDeliveryProofFile } from "@/lib/delivery-proof-upload";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  DeliveryEmptyState,
  DeliveryError,
  DeliveryPanel,
  DeliveryStatusPill,
  formatDateTime,
  useDeliveryAuth,
} from "./delivery-ui";

export function DeliveryB2BShipmentsClient() {
  const auth = useDeliveryAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["delivery-b2b-shipments", auth.authKey, search, status, page],
    queryFn: () => listAssignedB2BShipments(auth.authHeaders, { search, status, page, limit: 25 }),
    enabled: auth.enabled,
    retry: false,
  });

  return (
    <DeliveryPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title="B2B shipments" description="Assigned commercial shipments with package, transporter, and POD controls." />
        <label className="relative w-full lg:max-w-md">
          <span className="sr-only">Search B2B shipments</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
          <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Shipment or order" className="h-11 w-full rounded-md border border-[#D8E2EA] bg-white pl-10 pr-3 text-sm font-semibold" />
        </label>
      </div>
      <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="mt-4 h-11 w-full max-w-xs rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold">
        <option value="">All shipment statuses</option><option value="READY">Ready</option><option value="DISPATCHED">Dispatched</option><option value="IN_TRANSIT">In transit</option><option value="DELIVERED">Delivered</option>
      </select>
      <div className="mt-5 grid gap-3">
        {query.isLoading ? <div className="h-56 animate-pulse rounded-md bg-[#F8FAFC]" /> : null}
        {query.error ? <DeliveryError error={query.error} onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.data?.items.length ? <DeliveryEmptyState title="No B2B shipments" message="Assigned B2B shipments appear after the seller completes invoice and dispatch readiness." /> : null}
        {query.data?.items.map((shipment) => (
          <Link key={shipment.id} href={`/delivery/b2b-shipments/${shipment.id}`} className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-black text-[#1F2933]">{shipment.shipmentNumber}</p><DeliveryStatusPill status={shipment.status} /></div>
              <p className="mt-1 text-sm font-semibold text-[#667085]">{shipment.order.orderNumber} / {shipment.order.businessBuyer.companyName}</p>
              <p className="mt-1 text-xs font-bold text-[#667085]">{shipment.transporterName ?? "Transporter pending"} / {shipment.lrNumber ?? shipment.awbNumber ?? "Reference pending"}</p>
            </div>
            <StatusBadge tone={shipment.acceptanceStatus === "ACCEPTED" ? "success" : "warning"}>{humanize(shipment.acceptanceStatus)}</StatusBadge>
          </Link>
        ))}
      </div>
      {(query.data?.total ?? 0) > 0 ? <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4"><p className="text-sm font-semibold text-[#667085]">Page {page} of {query.data?.totalPages ?? 1}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button type="button" variant="outline" disabled={page >= (query.data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div> : null}
    </DeliveryPanel>
  );
}

export function DeliveryB2BShipmentDetailClient({ shipmentId }: { shipmentId: string }) {
  const auth = useDeliveryAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [podFile, setPodFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const query = useQuery({
    queryKey: ["delivery-b2b-shipment", auth.authKey, shipmentId],
    queryFn: () => getAssignedB2BShipment(auth.authHeaders, shipmentId),
    enabled: auth.enabled,
    retry: false,
  });
  const action = useMutation({
    mutationFn: ({ path, payload }: { path: string; payload: Record<string, unknown> }) =>
      b2bAction(auth.authHeaders, path, payload),
    onSuccess: () => {
      setNotice("Shipment updated.");
      void query.refetch();
    },
    onError: (error) => setNotice(userFacingApiErrorMessage(error)),
  });
  const shipment = query.data;

  async function downloadPod() {
    try {
      setDownloading(true);
      await downloadB2BDocument(
        auth.authHeaders,
        `/api/delivery/b2b-shipments/${encodeURIComponent(shipmentId)}/pod/0`,
        `${shipment?.shipmentNumber ?? "b2b-shipment"}-pod`,
      );
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  async function submitPod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!podFile) {
      setNotice("Upload a POD image or PDF.");
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      setUploading(true);
      const upload = await uploadDeliveryProof(auth.authHeaders, podFile, "DELIVERY_PROOF");
      action.mutate({
        path: `/api/delivery/b2b-shipments/${encodeURIComponent(shipmentId)}/pod`,
        payload: {
          receiverName: String(form.get("receiverName") ?? "").trim(),
          receiverPhone: String(form.get("receiverPhone") ?? "").trim() || undefined,
          deliveredAt: new Date().toISOString(),
          proofFileKeys: [upload.assetKey],
          note: String(form.get("note") ?? "").trim() || undefined,
        },
      });
    } catch (error) {
      setNotice(userFacingApiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div><Button asChild variant="ghost"><Link href="/delivery/b2b-shipments"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to B2B shipments</Link></Button></div>
      {query.isLoading ? <div className="h-64 animate-pulse rounded-md bg-white" /> : null}
      {query.error ? <DeliveryError error={query.error} onRetry={() => void query.refetch()} /> : null}
      {notice ? <div className="rounded-md border border-[#B9D7EA] bg-[#EFF8FF] p-4 text-sm font-bold text-[#175CD3]">{notice}</div> : null}
      {shipment ? (
        <>
          <DeliveryPanel>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-wide text-[#ED3500]">B2B shipment</p><h2 className="mt-1 text-2xl font-black text-[#123A5A]">{shipment.shipmentNumber}</h2><p className="mt-1 text-sm font-semibold text-[#667085]">{shipment.order.orderNumber} / {shipment.order.businessBuyer?.companyName}</p></div>
              <DeliveryStatusPill status={shipment.status} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Transporter" value={shipment.transporterName ?? "Not set"} /><Info label="LR / AWB" value={shipment.lrNumber ?? shipment.awbNumber ?? "Not set"} /><Info label="Packages" value={String(shipment.packages.length)} /><Info label="Acceptance" value={humanize(shipment.acceptanceStatus)} /></div>
          </DeliveryPanel>
          {!shipment.proofOfDelivery ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <DeliveryPanel>
                <SectionHeading title="Transport event" description="Record movement before delivery. POD is required for the delivered state." />
                <Button className="mt-4" type="button" disabled={action.isPending || shipment.status === "IN_TRANSIT"} onClick={() => action.mutate({ path: `/api/delivery/b2b-shipments/${encodeURIComponent(shipmentId)}/events`, payload: { status: "IN_TRANSIT", note: "Shipment is in transit." } })}><Truck className="h-4 w-4" aria-hidden="true" /> Mark in transit</Button>
              </DeliveryPanel>
              <DeliveryPanel>
                <SectionHeading title="Proof of delivery" description="Upload private POD evidence and record the receiver identity." />
                <form onSubmit={submitPod} className="mt-4 grid gap-3">
                  <input name="receiverName" required minLength={2} placeholder="Receiver name" className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                  <input name="receiverPhone" placeholder="Receiver phone" className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold" />
                  <textarea name="note" rows={3} placeholder="Delivery note" className="rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold" />
                  <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" required onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file) { try { validateDeliveryProofFile(file); setPodFile(file); setNotice(null); } catch (error) { setPodFile(null); setNotice(userFacingApiErrorMessage(error)); } } }} />
                  <Button type="submit" disabled={uploading || action.isPending}><PackageCheck className="h-4 w-4" aria-hidden="true" /> {uploading ? "Uploading POD..." : "Complete delivery"}</Button>
                </form>
              </DeliveryPanel>
            </div>
          ) : (
            <DeliveryPanel>
              <SectionHeading title="POD recorded" description={`Delivered to ${shipment.proofOfDelivery.receiverName} on ${formatDateTime(shipment.proofOfDelivery.deliveredAt)}.`} />
              <Button className="mt-4" type="button" variant="outline" disabled={downloading} onClick={() => void downloadPod()}><Download className="h-4 w-4" aria-hidden="true" /> Download POD</Button>
            </DeliveryPanel>
          )}
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase tracking-wide text-[#98A2B3]">{label}</p><p className="mt-1 font-black text-[#1F2933]">{value}</p></div>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
