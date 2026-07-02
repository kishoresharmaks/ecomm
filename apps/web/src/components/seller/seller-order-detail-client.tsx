"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  PackageCheck,
  Printer,
  ShoppingBag,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import type { StatusTone } from "@indihub/ui";
import {
  coordinatesFromSnapshot,
  formatCoordinates,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
} from "@/lib/map-navigation";
import { formatMoney } from "@/lib/storefront-api";
import {
  OrderStatusTimeline,
  type OrderStatusTimelineEvent,
} from "@/components/shared/order-status-timeline";
import {
  fetchSellerPackageLabel,
  getSellerOrder,
  getSellerProfile,
  updateSellerOrderStatus,
  updateSellerPackage,
} from "@/lib/seller-api";
import {
  SellerAuthNotice,
  SellerErrorPanel,
  SellerField,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formatDateTime,
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
type DeliveryModeValue =
  | "STORE_PICKUP"
  | "LOCAL_DELIVERY_PARTNER"
  | "THIRD_PARTY_COURIER"
  | "MANUAL_TRANSPORT";
const deliveryModeLabels: Record<DeliveryModeValue, string> = {
  STORE_PICKUP: "Store pickup",
  LOCAL_DELIVERY_PARTNER: "Local delivery partner (auto assign)",
  THIRD_PARTY_COURIER: "Third-party courier service",
  MANUAL_TRANSPORT: "Manual transport",
};
const automatedDeliveryModes = new Set(["LOCAL_DELIVERY_PARTNER", "THIRD_PARTY_COURIER"]);
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

export function SellerOrderDetailClient({
  orderNumber,
  initialSection: _initialSection = "overview",
}: {
  orderNumber: string;
  initialSection?: "overview" | "delivery";
}) {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [labelActionPackageId, setLabelActionPackageId] = useState<string | null>(null);
  const [packageDrafts, setPackageDrafts] = useState<
    Record<string, { weightGrams: string; lengthCm: string; breadthCm: string; heightCm: string }>
  >({});

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

  const packageMutation = useMutation({
    mutationFn: ({
      packageId,
      payload,
    }: {
      packageId: string;
      payload: Parameters<typeof updateSellerPackage>[2];
    }) => updateSellerPackage(sellerAuth.authHeaders, packageId, payload),
    onSuccess: () => {
      setNotice("Package details updated.");
      invalidateOrder();
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Package update failed."),
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

  function updatePackageDraft(packageId: string, key: keyof (typeof packageDrafts)[string], value: string) {
    setPackageDrafts((current) => ({
      ...current,
      [packageId]: {
        ...(current[packageId] ?? { weightGrams: "", lengthCm: "", breadthCm: "", heightCm: "" }),
        [key]: value,
      },
    }));
  }

  function savePackageDetails(packageId: string, markReadyForBooking = false) {
    const draft = packageDrafts[packageId];
    setNotice(null);
    packageMutation.mutate({
      packageId,
      payload: {
        weightGrams: positiveDraftNumber(draft?.weightGrams),
        lengthCm: positiveDraftNumber(draft?.lengthCm),
        breadthCm: positiveDraftNumber(draft?.breadthCm),
        heightCm: positiveDraftNumber(draft?.heightCm),
        markReadyForBooking,
      },
    });
  }

  async function handleLabelAction(
    shipmentPackage: { id: string; labelDownloadUrl?: string | null },
    action: "download" | "print",
  ) {
    if (!shipmentPackage.labelDownloadUrl) {
      setNotice("Courier label is not available yet.");
      return;
    }
    setNotice(null);
    setLabelActionPackageId(shipmentPackage.id);
    try {
      const label = await fetchSellerPackageLabel(
        sellerAuth.authHeaders,
        shipmentPackage.labelDownloadUrl,
      );
      const url = URL.createObjectURL(label.blob);
      if (action === "download") {
        const link = document.createElement("a");
        link.href = url;
        link.download = label.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Courier label could not be opened.");
    } finally {
      setLabelActionPackageId(null);
    }
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
  useEffect(() => {
    const nextDrafts: typeof packageDrafts = {};
    for (const shipmentPackage of sellerShipment?.packages ?? []) {
      nextDrafts[shipmentPackage.id] = {
        weightGrams: shipmentPackage.weightGrams ? String(shipmentPackage.weightGrams) : "",
        lengthCm: shipmentPackage.lengthCm ? String(shipmentPackage.lengthCm) : "",
        breadthCm: shipmentPackage.breadthCm ? String(shipmentPackage.breadthCm) : "",
        heightCm: shipmentPackage.heightCm ? String(shipmentPackage.heightCm) : "",
      };
    }
    setPackageDrafts(nextDrafts);
  }, [sellerShipment?.packages]);
  const sellerItems = useMemo(() => {
    if (!order) {
      return [];
    }

    return sellerId
      ? order.items.filter((item) => item.sellerId === sellerId || item.seller?.id === sellerId)
      : order.items;
  }, [order, sellerId]);

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
  const addressCoordinates = coordinatesFromSnapshot(address);
  const delivery = sellerShipment ?? order.deliveryDetail;
  const deliveryMode = delivery?.deliveryMode ?? order.deliveryDetail?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER";
  const isAutomatedDelivery = automatedDeliveryModes.has(deliveryMode);
  const currentSellerStatus = sellerStatusValue(sellerSplit?.sellerStatus);
  const currentDeliveryStatus = deliveryStatusValue(
    sellerShipment?.status ?? order.deliveryDetail?.status ?? order.deliveryStatus,
  );
  const nextSellerStatus = nextSellerWorkflowStatus(currentSellerStatus, isAutomatedDelivery);
  const isTerminalSellerStatus =
    currentSellerStatus === "DELIVERED" || currentSellerStatus === "CANCELLED";
  const canCancelSellerPackage = canSellerCancelPackage(currentSellerStatus, currentDeliveryStatus);
  const timelineEvents = buildTrackingTimeline(order);
  const statusSummaryItems: SellerStatusSummaryItem[] = [
    {
      label: "Order status",
      value: orderStatusText(order.orderStatus),
      detail: "Customer order workflow",
      status: order.orderStatus,
      icon: ShoppingBag,
    },
    {
      label: "Payment status",
      value: paymentStatusText(order.paymentStatus),
      detail: "Payment collection state",
      status: order.paymentStatus,
      icon: CreditCard,
    },
    {
      label: "Delivery status",
      value: deliveryStatusText(order.deliveryStatus),
      detail: "Overall delivery progress",
      status: order.deliveryStatus,
      icon: Truck,
    },
    {
      label: "Your fulfilment",
      value: sellerFulfilmentStatusText(currentSellerStatus),
      detail: "This store package",
      status: currentSellerStatus,
      icon: PackageCheck,
    },
  ];

  return (
    <div className="grid gap-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/seller/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/seller/orders/${encodeURIComponent(orderNumber)}/delivery`}>
            <Truck className="h-4 w-4" aria-hidden="true" />
            Logistics view
          </Link>
        </Button>
      </div>

      {notice ? (
        <StatusBadge tone={statusMutation.isError ? "danger" : "success"}>
          {notice}
        </StatusBadge>
      ) : null}

      <SellerPanel className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#667085]">
                  Placed on {formatDateTime(order.createdAt)}
                </p>
                <h2 className="mt-1 break-words text-2xl font-black text-[#1F2933]">
                  {order.orderNumber}
                </h2>
              </div>
              <StatusBadge tone={statusSummaryTone(currentSellerStatus)}>
                Next: {nextSellerStatus ? sellerActionLabel(nextSellerStatus) : "No seller action"}
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {statusSummaryItems.map((item) => (
                <SellerStatusSummary key={item.label} item={item} />
              ))}
            </div>
          </div>
          <div className="border-t border-[#F2D5CC] bg-[#FFFCFB] p-4 text-left lg:border-l lg:border-t-0 lg:text-right">
            <p className="text-sm font-bold text-[#667085]">Seller subtotal</p>
            <p className="mt-1 text-3xl font-black leading-tight text-[#163B5C]">
              {formatMoney(sellerSplit?.sellerSubtotalPaise ?? order.totalPaise, order.currency)}
            </p>
            {sellerSplit ? (
              <div className="mt-2 space-y-1 text-xs font-semibold text-[#667085]">
                <p>Commission {formatMoney(sellerSplit.commissionPaise, order.currency)}</p>
                {(sellerSplit.couponSellerFundedDiscountPaise ?? 0) > 0 ? (
                  <p className="font-black text-[#9F2600]">
                    Seller-funded coupon -{formatMoney(sellerSplit.couponSellerFundedDiscountPaise ?? 0, order.currency)}
                  </p>
                ) : null}
                {(sellerSplit.couponPlatformFundedDiscountPaise ?? 0) > 0 ? (
                  <p className="font-bold text-[#0F8A5F]">
                    Platform-funded coupon shown to buyer, seller payout unaffected
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </SellerPanel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid content-start gap-4">
      <SellerPanel className="p-4" id="delivery-details">
            <SectionHeading
              title="Store items"
              description="Items in this order that belong to this store."
            />
            <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB]">
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
            <SellerPanel className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#F8FAFC] text-[#163B5C]">
                  <Package className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading
                  title="Seller package"
                  description="This store's own shipment package."
                />
              </div>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085] sm:grid-cols-2">
                <Info label="Package" value={sellerShipment.shipmentNumber} />
                <Info label="Status" value={statusLabel(sellerShipment.status)} />
                <Info
                  label="Mode"
                  value={
                    deliveryModeLabels[
                      sellerShipment.deliveryMode as DeliveryModeValue
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
              <div className="mt-4 grid gap-3">
                {(sellerShipment.packages ?? []).map((shipmentPackage) => {
                  const labelBusy = labelActionPackageId === shipmentPackage.id;
                  const canEditPackage =
                    shipmentPackage.deliveryMode === "THIRD_PARTY_COURIER" &&
                    (shipmentPackage.courierTrackingStatus ?? "NOT_BOOKED") === "NOT_BOOKED";
                  const draft = packageDrafts[shipmentPackage.id] ?? {
                    weightGrams: "",
                    lengthCm: "",
                    breadthCm: "",
                    heightCm: "",
                  };
                  return (
                    <div
                      key={shipmentPackage.id}
                      className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-[#1F2933]">
                              {shipmentPackage.packageNumber}
                            </p>
                            <StatusBadge tone={shipmentPackage.canDownloadLabel ? "success" : "info"}>
                              {packageStatusTitle(shipmentPackage)}
                            </StatusBadge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm font-semibold text-[#667085] sm:grid-cols-2">
                            <Info
                              label="AWB"
                              value={shipmentPackage.awbNumber ?? "Not assigned"}
                            />
                            <Info
                              label="Courier"
                              value={
                                shipmentPackage.courierName ??
                                shipmentPackage.courierCode ??
                                "Not assigned"
                              }
                            />
                            <Info
                              label="Tracking"
                              value={
                                shipmentPackage.courierTrackingStatusLabel ??
                                statusLabel(shipmentPackage.courierTrackingStatus)
                              }
                            />
                            <Info
                              label="Booked"
                              value={
                                shipmentPackage.shipmentBookedAt
                                  ? formatDateTime(shipmentPackage.shipmentBookedAt)
                                  : "Not booked"
                              }
                            />
                          </div>
                          {canEditPackage ? (
                            <div className="mt-4 grid gap-3 rounded-lg border border-[#D8E2EA] bg-white p-3 sm:grid-cols-4">
                              <SellerField
                                label="Weight g"
                                name={`weight-${shipmentPackage.id}`}
                                type="number"
                                min={1}
                                value={draft.weightGrams}
                                onChange={(value) =>
                                  updatePackageDraft(shipmentPackage.id, "weightGrams", value)
                                }
                              />
                              <SellerField
                                label="Length cm"
                                name={`length-${shipmentPackage.id}`}
                                type="number"
                                min={1}
                                value={draft.lengthCm}
                                onChange={(value) =>
                                  updatePackageDraft(shipmentPackage.id, "lengthCm", value)
                                }
                              />
                              <SellerField
                                label="Breadth cm"
                                name={`breadth-${shipmentPackage.id}`}
                                type="number"
                                min={1}
                                value={draft.breadthCm}
                                onChange={(value) =>
                                  updatePackageDraft(shipmentPackage.id, "breadthCm", value)
                                }
                              />
                              <SellerField
                                label="Height cm"
                                name={`height-${shipmentPackage.id}`}
                                type="number"
                                min={1}
                                value={draft.heightCm}
                                onChange={(value) =>
                                  updatePackageDraft(shipmentPackage.id, "heightCm", value)
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {canEditPackage ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => savePackageDetails(shipmentPackage.id)}
                                disabled={packageMutation.isPending}
                              >
                                Save package
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => savePackageDetails(shipmentPackage.id, true)}
                                disabled={packageMutation.isPending}
                              >
                                Ready
                              </Button>
                            </>
                          ) : null}
                          {shipmentPackage.canDownloadLabel ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleLabelAction(shipmentPackage, "download")}
                                disabled={labelBusy}
                              >
                                <Download className="h-4 w-4" aria-hidden="true" />
                                Download label
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleLabelAction(shipmentPackage, "print")}
                                disabled={labelBusy}
                              >
                                <Printer className="h-4 w-4" aria-hidden="true" />
                                Print
                              </Button>
                            </>
                          ) : (
                            <StatusBadge tone="warning">{packageLabelState(shipmentPackage)}</StatusBadge>
                          )}
                          {shipmentPackage.trackingUrl ? (
                            <Button asChild size="sm" variant="outline">
                              <a
                                href={shipmentPackage.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                Track
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(sellerShipment.packages ?? []).length === 0 ? (
                  <p className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                    Package details are not available yet.
                  </p>
                ) : null}
              </div>
            </SellerPanel>
          ) : null}

          <SellerPanel className="p-4">
            <SectionHeading
              title="Status timeline"
              description="Recent status changes for order and delivery operations."
            />
            <OrderStatusTimeline
              className="mt-4"
              events={timelineEvents}
              orderCreatedAt={order.createdAt}
              currentOrderStatus={order.orderStatus}
              currentSellerStatus={currentSellerStatus}
              currentDeliveryStatus={currentDeliveryStatus}
              formatDateTime={formatDateTime}
              emptyText="No seller timeline events yet."
            />
          </SellerPanel>
        </div>

        <div className="grid content-start gap-4">
          <SellerPanel className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                title="Next seller action"
                description="Move this package through the normal fulfilment flow."
              />
            </div>
            <div className="mt-4 grid gap-3">
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
                    automatedDelivery={isAutomatedDelivery}
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
                  {isAutomatedDelivery && currentSellerStatus === "PROCESSING"
                    ? "Packed and ready. Courier, delivery partner, or admin operations will update dispatch and delivery."
                    : "No further seller action is needed for this package."}
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

          <SellerPanel className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading
                title="Logistics automation"
                description={
                  isAutomatedDelivery
                    ? "Transport is controlled by courier, delivery partner, or admin operations after seller packing."
                    : "This delivery mode needs seller or admin coordination."
                }
              />
            </div>
            <div className="mt-4 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info
                  label="Mode"
                  value={
                    deliveryModeLabels[deliveryMode as DeliveryModeValue] ??
                    statusLabel(deliveryMode)
                  }
                />
                <Info label="Delivery status" value={statusLabel(currentDeliveryStatus)} />
                <Info label="Tracking" value={delivery?.trackingReference ?? "Not assigned"} />
                <Info label="Partner" value={deliveryPartnerLabel(delivery)} />
                <Info
                  label="ETA"
                  value={
                    delivery?.estimatedDeliveryDate
                      ? formatDateTime(delivery.estimatedDeliveryDate)
                      : "Not assigned"
                  }
                />
                <Info label="Assignment" value={statusLabel(delivery?.assignmentStatus ?? "UNASSIGNED")} />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-[#D8E2EA] bg-white p-4 text-sm font-semibold leading-6 text-[#667085]">
              {isAutomatedDelivery ? (
                <p>
                  Seller action stops at packed. Assignment, AWB, tracking, proof, COD collection,
                  dispatch, and delivered updates come from the logistics workspace, delivery
                  partner app, courier webhook, or admin override.
                </p>
              ) : (
                <p>
                  Store pickup and manual transport do not have automated provider tracking. Use the
                  seller status flow for package progress and coordinate exceptions with admin.
                </p>
              )}
              {delivery?.deliveryNote ? (
                <p className="mt-3 rounded-md bg-[#F8FAFC] px-3 py-2">
                  Latest note: {delivery.deliveryNote}
                </p>
              ) : null}
            </div>
          </SellerPanel>

          <SellerPanel className="p-4">
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
              {addressCoordinates ? (
                <div className="mt-4 rounded-xl border border-[#D8E2EA] bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="success">Coordinates available</StatusBadge>
                    {address?.locationSource ? <StatusBadge tone="info">{statusLabel(address.locationSource)}</StatusBadge> : null}
                    {address?.accuracyMeters ? <StatusBadge tone="info">Accuracy {address.accuracyMeters} m</StatusBadge> : null}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#667085]">{formatCoordinates(addressCoordinates)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <a href={googleMapsDirectionsUrl(addressCoordinates)} target="_blank" rel="noreferrer">
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                        Open route
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={googleMapsSearchUrl(addressCoordinates)} target="_blank" rel="noreferrer">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        View pin
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-[#FFE0D6] bg-[#FFFCFB] px-3 py-2 text-xs font-bold text-[#8A4B32]">
                  No coordinate pin was saved for this order; use the written address.
                </p>
              )}
            </div>
          </SellerPanel>
        </div>
      </div>
    </div>
  );
}

function positiveDraftNumber(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function packageStatusTitle(shipmentPackage: {
  canDownloadLabel?: boolean;
  status?: string | null;
  courierTrackingStatus?: string | null;
}) {
  if (shipmentPackage.canDownloadLabel) {
    return "Label ready";
  }
  if (shipmentPackage.courierTrackingStatus && shipmentPackage.courierTrackingStatus !== "NOT_BOOKED") {
    return statusLabel(shipmentPackage.courierTrackingStatus);
  }
  return statusLabel(shipmentPackage.status);
}

function packageLabelState(shipmentPackage: {
  deliveryMode?: string | null;
  status?: string | null;
  courierTrackingStatus?: string | null;
}) {
  if (shipmentPackage.deliveryMode !== "THIRD_PARTY_COURIER") {
    return "No courier label";
  }
  if (shipmentPackage.courierTrackingStatus === "CANCELLED" || shipmentPackage.status === "CANCELLED") {
    return "Cancelled";
  }
  if (shipmentPackage.courierTrackingStatus === "FAILED" || shipmentPackage.status === "FAILED") {
    return "Booking failed";
  }
  if (shipmentPackage.courierTrackingStatus?.startsWith("RTO") || shipmentPackage.status?.startsWith("RTO")) {
    return "RTO";
  }
  if (shipmentPackage.status === "READY_FOR_BOOKING") {
    return "Courier booking pending";
  }
  return "Packing pending";
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <p>
      <span className="block text-xs font-bold uppercase text-[#667085]">{label}</span>
      <span className="mt-1 block font-black text-[#1F2933]">{value || "Not assigned"}</span>
    </p>
  );
}

type SellerStatusSummaryItem = {
  label: string;
  value: string;
  detail: string;
  status?: string | null;
  icon: LucideIcon;
};

const statusSummaryCardClasses: Record<StatusTone, string> = {
  neutral: "border-[#E5E7EB] bg-[#F8FAFC]",
  success: "border-[#BFEAD9] bg-[#F3FBF7]",
  warning: "border-[#FFD4C8] bg-[#FFFCFB]",
  danger: "border-[#F5B7B7] bg-[#FFF7F7]",
  info: "border-[#C5D8E8] bg-[#F8FAFC]",
};

const statusSummaryIconClasses: Record<StatusTone, string> = {
  neutral: "bg-white text-[#667085]",
  success: "bg-[#E9F7F1] text-[#0F8A5F]",
  warning: "bg-[#FFF0EC] text-[#ED3500]",
  danger: "bg-[#FDECEC] text-[#B42318]",
  info: "bg-[#EAF1F7] text-[#163B5C]",
};

function SellerStatusSummary({ item }: { item: SellerStatusSummaryItem }) {
  const Icon = item.icon;
  const tone = statusSummaryTone(item.status);

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg border p-3",
        statusSummaryCardClasses[tone],
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-md",
          statusSummaryIconClasses[tone],
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-black uppercase tracking-wide text-[#667085]">
          {item.label}
        </span>
        <span className="mt-0.5 block text-sm font-black leading-5 text-[#1F2933]">
          {item.value}
        </span>
        <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#667085]">
          {item.detail}
        </span>
      </span>
    </div>
  );
}

function orderStatusText(status?: string | null) {
  if (status === "PLACED") {
    return "Order placed";
  }
  if (status === "PROCESSING") {
    return "Order processing";
  }
  if (status === "DELIVERED") {
    return "Order delivered";
  }
  if (status === "CANCELLED") {
    return "Order cancelled";
  }
  return status ? `Order ${sentenceStatus(status)}` : "Order status not set";
}

function paymentStatusText(status?: string | null) {
  if (status === "PENDING") {
    return "Payment pending";
  }
  if (status === "PAID" || status === "CAPTURED") {
    return "Payment received";
  }
  if (status === "FAILED") {
    return "Payment failed";
  }
  if (status === "REFUNDED") {
    return "Payment refunded";
  }
  return status ? `Payment ${sentenceStatus(status)}` : "Payment status not set";
}

function deliveryStatusText(status?: string | null) {
  if (status === "NOT_ASSIGNED") {
    return "Delivery not assigned";
  }
  if (status === "PENDING") {
    return "Delivery pending";
  }
  if (status === "PACKED") {
    return "Package packed";
  }
  if (status === "DISPATCHED") {
    return "Package dispatched";
  }
  if (status === "IN_TRANSIT") {
    return "Package in transit";
  }
  if (status === "DELIVERED") {
    return "Package delivered";
  }
  if (status === "CANCELLED") {
    return "Delivery cancelled";
  }
  return status ? statusLabel(status) : "Delivery status not set";
}

function sellerFulfilmentStatusText(status: SellerStatus) {
  if (status === "PENDING") {
    return "Seller acceptance pending";
  }
  if (status === "ACCEPTED") {
    return "Order accepted by store";
  }
  if (status === "PROCESSING") {
    return "Items packed";
  }
  if (status === "DISPATCHED") {
    return "Package dispatched";
  }
  if (status === "DELIVERED") {
    return "Package delivered";
  }
  return "Seller package cancelled";
}

function sentenceStatus(status: string) {
  return statusLabel(status).toLowerCase();
}

function statusSummaryTone(status?: string | null): StatusTone {
  if (!status) {
    return "neutral";
  }
  if (
    [
      "ACTIVE",
      "APPROVED",
      "PAID",
      "CAPTURED",
      "DELIVERED",
      "COMPLETED",
      "ACCEPTED",
    ].includes(status)
  ) {
    return "success";
  }
  if (
    ["PENDING", "PENDING_APPROVAL", "PLACED", "PROCESSING", "IN_TRANSIT", "PACKED"].includes(
      status,
    )
  ) {
    return "warning";
  }
  if (["REJECTED", "SUSPENDED", "CANCELLED", "FAILED", "REFUNDED", "ARCHIVED"].includes(status)) {
    return "danger";
  }
  return "info";
}

function SellerStatusStep({
  step,
  currentStatus,
  index,
  automatedDelivery,
}: {
  step: (typeof sellerStatusFlow)[number];
  currentStatus: SellerStatus;
  index: number;
  automatedDelivery: boolean;
}) {
  const stepRank = sellerStatusRank[step.status];
  const currentRank = sellerStatusRank[currentStatus];
  const isOperationsStep =
    automatedDelivery && (step.status === "DISPATCHED" || step.status === "DELIVERED");
  const isDone = currentStatus !== "CANCELLED" && currentRank > stepRank;
  const isCurrent = currentStatus === step.status;
  const isFuture = currentStatus !== "CANCELLED" && currentRank < stepRank && !isOperationsStep;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3",
        isCurrent && "border-[#C5D8E8] bg-[#EAF1F7]",
        isDone && "border-[#BFEAD9] bg-[#E9F7F1]",
        isFuture && "border-[#E5E7EB] bg-white",
        isOperationsStep && !isDone && !isCurrent && "border-[#D8E2EA] bg-[#F8FAFC]",
        currentStatus === "CANCELLED" && "border-[#E5E7EB] bg-[#F8FAFC] opacity-70",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black",
          isDone && "bg-[#0F8A5F] text-white",
          isCurrent && "bg-[#163B5C] text-white",
          isFuture && "bg-[#F8FAFC] text-[#667085]",
          isOperationsStep && !isDone && !isCurrent && "bg-white text-[#667085]",
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
          {isOperationsStep && !isDone && !isCurrent ? (
            <StatusBadge tone="neutral">Operations</StatusBadge>
          ) : null}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
          {isOperationsStep && !isDone && !isCurrent
            ? "Updated by courier, delivery partner, or admin operations."
            : step.description}
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

function nextSellerWorkflowStatus(current: SellerStatus, automatedDelivery: boolean): SellerStatus | null {
  if (current === "PENDING") {
    return "ACCEPTED";
  }
  if (current === "ACCEPTED") {
    return "PROCESSING";
  }
  if (automatedDelivery) {
    return null;
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

function deliveryPartnerLabel(delivery?: {
  partnerName?: string | null;
  partnerPhone?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  deliveryPartner?: {
    fullName?: string | null;
    phone?: string | null;
    vehicleNumber?: string | null;
  } | null;
} | null) {
  const name =
    delivery?.deliveryPartner?.fullName ??
    delivery?.partnerName ??
    delivery?.courierName ??
    delivery?.courierCode ??
    null;
  const phone = delivery?.deliveryPartner?.phone ?? delivery?.partnerPhone ?? null;
  return [name, phone].filter(Boolean).join(" / ") || "Not assigned";
}

function buildTrackingTimeline(
  order: NonNullable<Awaited<ReturnType<typeof getSellerOrder>>>,
): OrderStatusTimelineEvent[] {
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
