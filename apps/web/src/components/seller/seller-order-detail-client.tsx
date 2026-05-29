"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import { formatMoney } from "@/lib/storefront-api";
import {
  getSellerOrder,
  getSellerProfile,
  updateSellerDelivery,
  updateSellerOrderStatus,
} from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerErrorPanel,
  SellerField,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formatDateTime,
  optionalFormValue,
  statusLabel,
  useSellerAuth,
} from "./seller-ui";

const sellerStatuses = [
  "PENDING",
  "ACCEPTED",
  "PROCESSING",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
] as const;
type SellerStatus = (typeof sellerStatuses)[number];
const deliveryModes = ["STORE_PICKUP", "LOCAL_DELIVERY_PARTNER", "THIRD_PARTY_COURIER"] as const;
const deliveryModeLabels: Record<(typeof deliveryModes)[number], string> = {
  STORE_PICKUP: "Store pickup",
  LOCAL_DELIVERY_PARTNER: "Local delivery partner (auto assign)",
  THIRD_PARTY_COURIER: "Third-party courier service",
};
const deliveryStatuses = [
  "NOT_ASSIGNED",
  "PENDING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const;
type DeliveryStatus = (typeof deliveryStatuses)[number];

const sellerStatusFlow: Array<{
  status: Exclude<SellerStatus, "PENDING" | "CANCELLED">;
  title: string;
  description: string;
  actionLabel: string;
}> = [
  {
    status: "ACCEPTED",
    title: "Accepted",
    description: "Confirm this store will fulfil the order.",
    actionLabel: "Accept order",
  },
  {
    status: "PROCESSING",
    title: "Packed",
    description: "Items are packed and ready for pickup.",
    actionLabel: "Mark packed",
  },
  {
    status: "DISPATCHED",
    title: "Dispatched",
    description: "Package has left the store.",
    actionLabel: "Mark dispatched",
  },
  {
    status: "DELIVERED",
    title: "Delivered",
    description: "Customer received this package.",
    actionLabel: "Mark delivered",
  },
];

const sellerStatusRank: Record<SellerStatus, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PROCESSING: 2,
  DISPATCHED: 3,
  DELIVERED: 4,
  CANCELLED: 5,
};

export function SellerOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState<DeliveryStatus>("PENDING");
  const [showDeliveryDetails, setShowDeliveryDetails] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const orderQuery = useQuery({
    queryKey: ["seller-order", sellerAuth.authKey, orderNumber],
    queryFn: () => getSellerOrder(sellerAuth.authHeaders, orderNumber),
    enabled: sellerAuth.enabled,
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      sellerStatus,
      note,
    }: {
      sellerStatus: SellerStatus;
      note?: string | undefined;
    }) => updateSellerOrderStatus(sellerAuth.authHeaders, orderNumber, { sellerStatus, note }),
    onSuccess: () => {
      setNotice("Seller order status updated.");
      setStatusNote("");
      invalidateOrder();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Seller status update failed."),
  });

  const deliveryMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSellerDelivery>[2]) =>
      updateSellerDelivery(sellerAuth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNotice("Delivery details updated.");
      invalidateOrder();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Delivery update failed."),
  });

  function invalidateOrder() {
    void queryClient.invalidateQueries({
      queryKey: ["seller-order", sellerAuth.authKey, orderNumber],
    });
    void queryClient.invalidateQueries({ queryKey: ["seller-orders", sellerAuth.authKey] });
    void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
  }

  function updateStatus(sellerStatus: SellerStatus) {
    setNotice(null);
    statusMutation.mutate({
      sellerStatus,
      note: statusNote.trim() || undefined,
    });
  }

  function submitDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setNotice(null);
    deliveryMutation.mutate({
      deliveryMode: optionalFormValue(form, "deliveryMode") as Parameters<
        typeof updateSellerDelivery
      >[2]["deliveryMode"],
      partnerName: optionalFormValue(form, "partnerName"),
      partnerPhone: optionalFormValue(form, "partnerPhone"),
      trackingReference: optionalFormValue(form, "trackingReference"),
      estimatedDeliveryDate: optionalFormValue(form, "estimatedDeliveryDate"),
      deliveryNote: optionalFormValue(form, "deliveryNote"),
      status: selectedDeliveryStatus,
    });
  }

  const order = orderQuery.data;
  const sellerId = profileQuery.data?.id;
  const sellerSplit = useMemo(
    () =>
      order?.sellerSplits?.find((split) => split.sellerId === sellerId) ?? order?.sellerSplits?.[0],
    [order?.sellerSplits, sellerId],
  );
  const sellerShipment = useMemo(
    () =>
      order?.shipments?.find((shipment) => shipment.sellerId === sellerId) ?? order?.shipments?.[0],
    [order?.shipments, sellerId],
  );
  const sellerItems = useMemo(() => {
    if (!order) {
      return [];
    }

    return sellerId
      ? order.items.filter((item) => item.sellerId === sellerId || item.seller?.id === sellerId)
      : order.items;
  }, [order, sellerId]);

  useEffect(() => {
    if (sellerShipment?.status && isDeliveryStatus(sellerShipment.status)) {
      setSelectedDeliveryStatus(sellerShipment.status);
    } else if (order?.deliveryDetail?.status && isDeliveryStatus(order.deliveryDetail.status)) {
      setSelectedDeliveryStatus(order.deliveryDetail.status);
    } else if (order?.deliveryStatus && isDeliveryStatus(order.deliveryStatus)) {
      setSelectedDeliveryStatus(order.deliveryStatus);
    }
  }, [sellerShipment?.status, order?.deliveryDetail?.status, order?.deliveryStatus]);

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (orderQuery.isLoading || profileQuery.isLoading) {
    return <SellerSkeleton />;
  }

  if (orderQuery.error) {
    return <SellerErrorPanel error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />;
  }

  if (!order) {
    return null;
  }

  const address = order.shippingAddressSnapshot;
  const delivery = sellerShipment ?? order.deliveryDetail;
  const currentSellerStatus = sellerStatusValue(sellerSplit?.sellerStatus);
  const currentDeliveryStatus = deliveryStatusValue(
    sellerShipment?.status ?? order.deliveryDetail?.status ?? order.deliveryStatus,
  );
  const nextSellerStatus = nextSellerWorkflowStatus(currentSellerStatus);
  const isTerminalSellerStatus =
    currentSellerStatus === "DELIVERED" || currentSellerStatus === "CANCELLED";
  const canCancelSellerPackage = canSellerCancelPackage(currentSellerStatus, currentDeliveryStatus);
  const selectableDeliveryStatuses =
    canCancelSellerPackage || currentDeliveryStatus === "CANCELLED"
      ? deliveryStatuses
      : deliveryStatuses.filter((status) => status !== "CANCELLED");

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/seller/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </Button>
      </div>

      {notice ? (
        <StatusBadge
          tone={statusMutation.isError || deliveryMutation.isError ? "danger" : "success"}
        >
          {notice}
        </StatusBadge>
      ) : null}

      <SellerPanel>
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-sm font-bold text-[#667085]">
              Placed on {formatDateTime(order.createdAt)}
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#1F2933]">{order.orderNumber}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <SellerStatusPill status={order.orderStatus} />
              <SellerStatusPill status={order.paymentStatus} />
              <SellerStatusPill status={order.deliveryStatus} />
              <SellerStatusPill status={sellerSplit?.sellerStatus} />
            </div>
          </div>
          <div className="rounded-md bg-[#FFFCFB] p-4 text-right">
            <p className="text-sm font-bold text-[#667085]">Seller subtotal</p>
            <p className="mt-1 text-3xl font-black text-[#163B5C]">
              {formatMoney(sellerSplit?.sellerSubtotalPaise ?? order.totalPaise, order.currency)}
            </p>
            {sellerSplit ? (
              <p className="mt-1 text-xs font-semibold text-[#667085]">
                Commission {formatMoney(sellerSplit.commissionPaise, order.currency)}
              </p>
            ) : null}
          </div>
        </div>
      </SellerPanel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-5">
          <SellerPanel>
            <SectionHeading
              title="Store items"
              description="Items in this order that belong to this store."
            />
            <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB]">
              {sellerItems.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {item.variantSnapshot?.variantName ?? item.variantSnapshot?.sku ?? "Default"}{" "}
                      x {item.quantity}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm font-semibold text-[#667085]">
                      {formatMoney(item.unitPricePaise, item.currency)} each
                    </p>
                    <p className="mt-1 text-lg font-black text-[#163B5C]">
                      {formatMoney(item.lineTotalPaise, item.currency)}
                    </p>
                  </div>
                </div>
              ))}
              {sellerItems.length === 0 ? (
                <p className="p-4 text-sm font-semibold text-[#667085]">
                  No seller items found for this order.
                </p>
              ) : null}
            </div>
          </SellerPanel>

          {sellerShipment ? (
            <SellerPanel>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#F8FAFC] text-[#163B5C]">
                  <Package className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading
                  title="Seller package"
                  description="This store's own shipment package."
                />
              </div>
              <div className="mt-5 grid gap-3 text-sm font-semibold text-[#667085] sm:grid-cols-2">
                <Info label="Package" value={sellerShipment.shipmentNumber} />
                <Info label="Status" value={statusLabel(sellerShipment.status)} />
                <Info
                  label="Mode"
                  value={
                    deliveryModeLabels[
                      sellerShipment.deliveryMode as (typeof deliveryModes)[number]
                    ] ?? statusLabel(sellerShipment.deliveryMode)
                  }
                />
                <Info label="Tracking" value={sellerShipment.trackingReference ?? "Not assigned"} />
                <Info
                  label="Subtotal"
                  value={formatMoney(sellerShipment.subtotalPaise, order.currency)}
                />
                <Info
                  label="Shipping share"
                  value={formatMoney(sellerShipment.shippingPaise, order.currency)}
                />
              </div>
            </SellerPanel>
          ) : null}

          <SellerPanel>
            <SectionHeading
              title="Status timeline"
              description="Recent status changes for order and delivery operations."
            />
            <div className="mt-5 grid gap-3">
              {buildTrackingTimeline(order).map((event) => (
                <div key={event.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="info">{event.kind}</StatusBadge>
                    <p className="font-black text-[#1F2933]">{statusLabel(event.newStatus)}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#667085]">
                    {formatDateTime(event.createdAt)}
                  </p>
                  {event.note ? (
                    <p className="mt-2 text-sm leading-6 text-[#667085]">{event.note}</p>
                  ) : null}
                </div>
              ))}
              {buildTrackingTimeline(order).length === 0 ? (
                <p className="text-sm font-semibold text-[#667085]">No timeline events yet.</p>
              ) : null}
            </div>
          </SellerPanel>
        </div>

        <div className="grid gap-5">
          <SellerPanel>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                title="Next seller action"
                description="Move this package through the normal fulfilment flow."
              />
            </div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                      Current package state
                    </p>
                    <p className="mt-1 text-lg font-black text-[#123A5A]">
                      {sellerActionTitle(currentSellerStatus)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SellerStatusPill status={currentSellerStatus} />
                    <SellerStatusPill status={currentDeliveryStatus} />
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
                  {sellerActionDescription(currentSellerStatus)}
                </p>
              </div>

              <div className="grid gap-2">
                {sellerStatusFlow.map((step, index) => (
                  <SellerStatusStep
                    key={step.status}
                    index={index + 1}
                    currentStatus={currentSellerStatus}
                    step={step}
                  />
                ))}
              </div>

              {!isTerminalSellerStatus ? (
                <SellerTextArea
                  label="Optional note"
                  name="note"
                  rows={2}
                  value={statusNote}
                  onChange={setStatusNote}
                  placeholder={
                    nextSellerStatus
                      ? statusNotePlaceholder(nextSellerStatus)
                      : "Add a short update for the timeline"
                  }
                />
              ) : null}

              {nextSellerStatus ? (
                <Button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => updateStatus(nextSellerStatus)}
                  className="h-12"
                >
                  {statusMutation.isPending ? "Updating..." : sellerActionLabel(nextSellerStatus)}
                </Button>
              ) : (
                <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                  No further seller action is needed for this package.
                </div>
              )}

              {canCancelSellerPackage ? (
                <button
                  type="button"
                  onClick={() => updateStatus("CANCELLED")}
                  disabled={statusMutation.isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#F5B7B7] bg-white px-3 text-sm font-black text-[#B42318] transition hover:bg-[#FDECEC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel this seller package
                </button>
              ) : null}

              {!isTerminalSellerStatus && !canCancelSellerPackage ? (
                <div className="rounded-lg border border-[#FDE2B8] bg-[#FFF7ED] p-4 text-sm font-semibold leading-6 text-[#9A3412]">
                  Package already dispatched. Contact admin to reverse or handle return/refund.
                </div>
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel>
            <button
              type="button"
              onClick={() => setShowDeliveryDetails((current) => !current)}
              className="flex w-full items-start justify-between gap-3 text-left"
              aria-expanded={showDeliveryDetails}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <Truck className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xl font-black text-[#1F2933]">Delivery details</span>
                  <span className="mt-1 block text-sm font-semibold text-[#667085]">
                    Optional courier, partner, and tracking details.
                  </span>
                </span>
              </span>
              {showDeliveryDetails ? (
                <ChevronUp className="mt-2 h-5 w-5 shrink-0 text-[#667085]" aria-hidden="true" />
              ) : (
                <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-[#667085]" aria-hidden="true" />
              )}
            </button>
            <div className="mt-4 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
              <Info
                label="Mode"
                value={
                  deliveryModeLabels[delivery?.deliveryMode as (typeof deliveryModes)[number]] ??
                  statusLabel(delivery?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER")
                }
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Delivery status" value={statusLabel(currentDeliveryStatus)} />
                <Info label="Tracking" value={delivery?.trackingReference ?? "Not assigned"} />
              </div>
            </div>
            {showDeliveryDetails ? (
              <form onSubmit={submitDelivery} className="mt-5 grid gap-4">
                <SellerSelect
                  label="Delivery mode"
                  name="deliveryMode"
                  defaultValue={delivery?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER"}
                >
                  {deliveryModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {deliveryModeLabels[mode]}
                    </option>
                  ))}
                </SellerSelect>
                <SellerSelect
                  label="Delivery status"
                  name="deliveryStatus"
                  value={selectedDeliveryStatus}
                  onChange={(value) => setSelectedDeliveryStatus(value as DeliveryStatus)}
                >
                  {selectableDeliveryStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </SellerSelect>
                <SellerField
                  label="Partner name"
                  name="partnerName"
                  defaultValue={delivery?.partnerName}
                />
                <SellerField
                  label="Partner phone"
                  name="partnerPhone"
                  defaultValue={delivery?.partnerPhone}
                  placeholder="9876543210"
                />
                <SellerField
                  label="Tracking reference"
                  name="trackingReference"
                  defaultValue={delivery?.trackingReference}
                  placeholder="Auto-generated on partner assignment if left blank"
                />
                <SellerField
                  label="Estimated delivery date"
                  name="estimatedDeliveryDate"
                  type="date"
                  defaultValue={toDateInput(delivery?.estimatedDeliveryDate)}
                />
                <SellerTextArea
                  label="Delivery note"
                  name="deliveryNote"
                  rows={3}
                  defaultValue={delivery?.deliveryNote}
                />
                <Button type="submit" disabled={deliveryMutation.isPending}>
                  {deliveryMutation.isPending ? "Saving..." : "Save delivery details"}
                </Button>
              </form>
            ) : null}
          </SellerPanel>

          <SellerPanel>
            <SectionHeading
              title="Customer delivery address"
              description="Checkout snapshot for dispatch coordination."
            />
            <div className="mt-4 text-sm font-semibold leading-6 text-[#667085]">
              <p className="font-black text-[#1F2933]">{address?.fullName ?? "Not available"}</p>
              {address?.phone ? <p>{address.phone}</p> : null}
              {address?.line1 ? <p>{address.line1}</p> : null}
              {address?.line2 ? <p>{address.line2}</p> : null}
              {address?.area ? <p>{address.area}</p> : null}
              <p>
                {[address?.city, address?.state, address?.pincode].filter(Boolean).join(", ") ||
                  "Address not available"}
              </p>
              {address?.country || address?.countryCode ? (
                <p>{address.country ?? address.countryCode}</p>
              ) : null}
            </div>
          </SellerPanel>
        </div>
      </div>
    </div>
  );
}

function toDateInput(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <p>
      <span className="block text-xs font-bold uppercase text-[#667085]">{label}</span>
      <span className="mt-1 block font-black text-[#1F2933]">{value || "Not assigned"}</span>
    </p>
  );
}

function SellerStatusStep({
  step,
  currentStatus,
  index,
}: {
  step: (typeof sellerStatusFlow)[number];
  currentStatus: SellerStatus;
  index: number;
}) {
  const stepRank = sellerStatusRank[step.status];
  const currentRank = sellerStatusRank[currentStatus];
  const isDone = currentStatus !== "CANCELLED" && currentRank > stepRank;
  const isCurrent = currentStatus === step.status;
  const isFuture = currentStatus !== "CANCELLED" && currentRank < stepRank;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3",
        isCurrent && "border-[#C5D8E8] bg-[#EAF1F7]",
        isDone && "border-[#BFEAD9] bg-[#E9F7F1]",
        isFuture && "border-[#E5E7EB] bg-white",
        currentStatus === "CANCELLED" && "border-[#E5E7EB] bg-[#F8FAFC] opacity-70",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black",
          isDone && "bg-[#0F8A5F] text-white",
          isCurrent && "bg-[#163B5C] text-white",
          isFuture && "bg-[#F8FAFC] text-[#667085]",
          currentStatus === "CANCELLED" && "bg-white text-[#98A2B3]",
        )}
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-[#1F2933]">{step.title}</span>
          {isCurrent ? <StatusBadge tone="info">Current</StatusBadge> : null}
          {isDone ? <StatusBadge tone="success">Done</StatusBadge> : null}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
          {step.description}
        </span>
      </span>
    </div>
  );
}

function sellerStatusValue(value?: string | null): SellerStatus {
  return value && isSellerStatus(value) ? value : "PENDING";
}

function deliveryStatusValue(value?: string | null): DeliveryStatus {
  return value && isDeliveryStatus(value) ? value : "PENDING";
}

function nextSellerWorkflowStatus(current: SellerStatus): SellerStatus | null {
  if (current === "PENDING") {
    return "ACCEPTED";
  }
  if (current === "ACCEPTED") {
    return "PROCESSING";
  }
  if (current === "PROCESSING") {
    return "DISPATCHED";
  }
  if (current === "DISPATCHED") {
    return "DELIVERED";
  }
  return null;
}

function canSellerCancelPackage(sellerStatus: SellerStatus, deliveryStatus: DeliveryStatus) {
  return (
    ["PENDING", "ACCEPTED", "PROCESSING"].includes(sellerStatus) &&
    !["DISPATCHED", "IN_TRANSIT", "DELIVERED"].includes(deliveryStatus)
  );
}

function sellerActionTitle(status: SellerStatus) {
  if (status === "PENDING") {
    return "Waiting for seller action";
  }
  if (status === "PROCESSING") {
    return "Packed";
  }
  return statusLabel(status);
}

function sellerActionDescription(status: SellerStatus) {
  if (status === "PENDING") {
    return "Accept the order first. After that, use the same card to mark packed, dispatched, and delivered.";
  }
  if (status === "ACCEPTED") {
    return "Order is accepted. The next step is to pack the items and mark them ready for pickup.";
  }
  if (status === "PROCESSING") {
    return "Package is packed. Mark it dispatched after pickup or handover.";
  }
  if (status === "DISPATCHED") {
    return "Package has left the store. Mark delivered after confirmation.";
  }
  if (status === "DELIVERED") {
    return "This seller package is completed.";
  }
  return "This seller package has been cancelled.";
}

function sellerActionLabel(status: SellerStatus) {
  return (
    sellerStatusFlow.find((step) => step.status === status)?.actionLabel ??
    `Update to ${statusLabel(status)}`
  );
}

function statusNotePlaceholder(status: SellerStatus) {
  if (status === "ACCEPTED") {
    return "Order accepted by store";
  }
  if (status === "PROCESSING") {
    return "Packed and ready for pickup";
  }
  if (status === "DISPATCHED") {
    return "Package handed over for delivery";
  }
  if (status === "DELIVERED") {
    return "Delivered to customer";
  }
  return "Add a short update for the timeline";
}

function isSellerStatus(value: string): value is (typeof sellerStatuses)[number] {
  return sellerStatuses.includes(value as (typeof sellerStatuses)[number]);
}

function isDeliveryStatus(value: string): value is (typeof deliveryStatuses)[number] {
  return deliveryStatuses.includes(value as (typeof deliveryStatuses)[number]);
}

function buildTrackingTimeline(order: NonNullable<Awaited<ReturnType<typeof getSellerOrder>>>) {
  return [
    ...(order.deliveryDetail?.events ?? []).map((event) => ({
      id: `delivery-${event.id}`,
      kind: "Delivery",
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
    ...(order.statusEvents ?? []).map((event) => ({
      id: `status-${event.id}`,
      kind: statusLabel(event.statusType),
      newStatus: event.newStatus,
      note: event.note ?? null,
      createdAt: event.createdAt ?? null,
    })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime(),
  );
}
