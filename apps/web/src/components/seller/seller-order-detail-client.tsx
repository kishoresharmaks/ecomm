"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  ExternalLink,
  LockKeyhole,
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
  updateSellerDelivery,
  updateSellerOrderStatus,
  updateSellerPackage,
} from "@/lib/seller-api";
import { formatVariantLabel } from "@/lib/order-variant";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  SellerAuthNotice,
  SellerErrorPanel,
  SellerField,
  SellerNoticeBadge,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formatDateTime,
  isSellerOnboardingRequiredError,
  statusLabel,
  type SellerNotice,
  useSellerAuth,
} from "./seller-ui";
import { mergePackageDrafts, type PackageDraft } from "./seller-package-drafts";
import { sellerCollectedCodExpectedPaise } from "./seller-cod-calculations";
import {
  EWAY_BILL_LOCK_WARNING,
  isValidEWayBillNumber,
} from "./seller-eway-bill";

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
const EWAY_BILL_THRESHOLD_PAISE = 5_000_000;
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
  initialSection: section = "overview",
}: {
  orderNumber: string;
  initialSection?: "overview" | "delivery";
}) {
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [notice, setNotice] = useState<SellerNotice | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [ewayBillNumber, setEwayBillNumber] = useState("");
  const [manualCodCollected, setManualCodCollected] = useState(false);
  const [manualCodNote, setManualCodNote] = useState("");
  const [labelActionPackageId, setLabelActionPackageId] = useState<string | null>(null);
  const [packageDrafts, setPackageDrafts] = useState<Record<string, PackageDraft>>({});
  const dirtyPackageIdsRef = useRef(new Set<string>());

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
      ewayBillNumber,
    }: {
      sellerStatus: SellerStatus;
      note?: string | undefined;
      ewayBillNumber?: string | undefined;
    }) => updateSellerOrderStatus(sellerAuth.authHeaders, orderNumber, { sellerStatus, note, ewayBillNumber }),
    onSuccess: () => {
      setNotice({ tone: "success", message: "Seller order status updated." });
      setStatusNote("");
      invalidateOrder();
    },
    onError: (error) =>
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const packageMutation = useMutation({
    mutationFn: ({
      packageId,
      payload,
    }: {
      packageId: string;
      payload: Parameters<typeof updateSellerPackage>[2];
    }) => updateSellerPackage(sellerAuth.authHeaders, packageId, payload),
    onSuccess: (_package, variables) => {
      dirtyPackageIdsRef.current.delete(variables.packageId);
      setNotice({ tone: "success", message: "Package details updated." });
      invalidateOrder();
    },
    onError: (error) =>
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  const deliveryMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSellerDelivery>[2]) =>
      updateSellerDelivery(sellerAuth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNotice({ tone: "success", message: "Manual transport COD delivery recorded." });
      setStatusNote("");
      setManualCodCollected(false);
      setManualCodNote("");
      invalidateOrder();
    },
    onError: (error) =>
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
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
    const nextEWayBillNumber = ewayBillNumber.trim();
    if (
      sellerStatus === "DELIVERED" &&
      order &&
      isManualTransportCodOrder(order, deliveryMode)
    ) {
      setNotice({ tone: "warning", message: "Manual transport COD delivery must be completed from Logistics view with the collected COD amount." });
      return;
    }
    
    if (
      (sellerStatus === "PROCESSING" ||
        sellerStatus === "DISPATCHED" ||
        sellerStatus === "DELIVERED") &&
      (sellerSplit?.sellerSubtotalPaise ?? 0) >= EWAY_BILL_THRESHOLD_PAISE &&
      !savedEWayBillNumber &&
      !nextEWayBillNumber
    ) {
      setNotice({ tone: "danger", message: "E-Way Bill Number is mandatory for goods valued at \u20b950,000 or above." });
      return;
    }
    if (nextEWayBillNumber && !isValidEWayBillNumber(nextEWayBillNumber)) {
      setNotice({ tone: "danger", message: "E-Way Bill Number must contain exactly 12 digits." });
      return;
    }

    statusMutation.mutate({
      sellerStatus,
      note: statusNote.trim() || undefined,
      ewayBillNumber: savedEWayBillNumber ? undefined : nextEWayBillNumber || undefined,
    });
  }

  function markManualTransportCodDelivered(expectedAmountPaise: number) {
    setNotice(null);
    if (!manualCodCollected) {
      setNotice({ tone: "warning", message: "Confirm that the COD amount was collected from the customer." });
      return;
    }
    if (expectedAmountPaise <= 0) {
      setNotice({ tone: "danger", message: "Expected COD amount is not available. Refresh the order and try again." });
      return;
    }
    deliveryMutation.mutate({
      status: "DELIVERED",
      deliveryMode: "MANUAL_TRANSPORT",
      codCollected: true,
      codCollectedAmountPaise: expectedAmountPaise,
      ...(manualCodNote.trim() ? { codCollectionNote: manualCodNote.trim() } : {}),
    });
  }

  function updatePackageDraft(packageId: string, key: keyof (typeof packageDrafts)[string], value: string) {
    dirtyPackageIdsRef.current.add(packageId);
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
      setNotice({ tone: "warning", message: "Courier label is not available yet." });
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
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) });
    } finally {
      setLabelActionPackageId(null);
    }
  }

  function printPackageSlip(shipmentPackage: {
    packageNumber?: string | null;
    status?: string | null;
    ewayBillNumber?: string | null;
  }) {
    if (!order) {
      setNotice({ tone: "warning", message: "Order details are still loading. Try again in a moment." });
      return;
    }

    const printWindow = window.open("", "_blank", "width=760,height=720");
    if (!printWindow) {
      setNotice({ tone: "warning", message: "Popup blocked. Allow popups to print the package slip." });
      return;
    }

    const rows = sellerItems
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.productNameSnapshot)}</td><td>${escapeHtml(formatVariantLabel(item.variantSnapshot) ?? "Default")}</td><td>${item.quantity}</td></tr>`,
      )
      .join("");
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Package slip ${escapeHtml(shipmentPackage.packageNumber ?? order.orderNumber)}</title>
          <style>
            body{font-family:Arial,sans-serif;margin:24px;color:#1f2933}
            .box{border:1px solid #d8e2ea;border-radius:8px;padding:16px;margin-bottom:16px}
            h1{font-size:20px;margin:0 0 8px}
            p{margin:4px 0;font-size:13px}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}
            th{background:#f8fafc}
            .muted{color:#667085}
            @media print{button{display:none}}
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print</button>
          <div class="box">
            <h1>1HandIndia package slip</h1>
            <p><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p>
            <p><strong>Package:</strong> ${escapeHtml(shipmentPackage.packageNumber ?? sellerShipment?.shipmentNumber ?? "Package")}</p>
            <p><strong>Mode:</strong> ${escapeHtml(deliveryModeLabels[deliveryMode as DeliveryModeValue] ?? statusLabel(deliveryMode))}</p>
            <p><strong>Status:</strong> ${escapeHtml(statusLabel(shipmentPackage.status ?? currentDeliveryStatus))}</p>
            ${shipmentPackage.ewayBillNumber ? `<p><strong>E-Way Bill No:</strong> ${escapeHtml(shipmentPackage.ewayBillNumber)}</p>` : ""}
            <p><strong>Seller:</strong> ${escapeHtml(profileQuery.data?.storeName ?? "Seller")}</p>
          </div>
          <div class="box">
            <p class="muted">Use this slip for store pickup or local delivery handover. Courier AWB labels appear only after third-party courier booking.</p>
            <table>
              <thead><tr><th>Item</th><th>Variant</th><th>Qty</th></tr></thead>
              <tbody>${rows || "<tr><td colspan='3'>No seller items found.</td></tr>"}</tbody>
            </table>
          </div>
          <script>window.focus(); window.print();</script>
        </body>
      </html>`);
    printWindow.document.close();
  }

  const order = orderQuery.data;
  const sellerId = profileQuery.data?.id;
  // Never fall back to another seller's split/shipment on multi-seller orders;
  // the [0] fallback is only safe when the order has a single seller.
  const sellerSplit = useMemo(
    () =>
      order?.sellerSplits?.find((split) => split.sellerId === sellerId) ??
      (order?.sellerSplits?.length === 1 ? order.sellerSplits[0] : undefined),
    [order?.sellerSplits, sellerId],
  );
  const sellerShipment = useMemo(
    () =>
      order?.shipments?.find((shipment) => shipment.sellerId === sellerId) ??
      (order?.shipments?.length === 1 ? order.shipments[0] : undefined),
    [order?.shipments, sellerId],
  );
  const savedEWayBillNumber =
    sellerShipment?.packages
      ?.find((shipmentPackage) => shipmentPackage.ewayBillNumber)
      ?.ewayBillNumber?.trim() || null;
  useEffect(() => {
    setPackageDrafts((current) => mergePackageDrafts(current, sellerShipment?.packages ?? [], dirtyPackageIdsRef.current));
  }, [sellerShipment?.packages]);
  const sellerItems = useMemo(() => {
    if (!order) {
      return [];
    }

    if (sellerId) {
      return order.items.filter((item) => item.sellerId === sellerId || item.seller?.id === sellerId);
    }

    // Without a resolved seller profile, only trust items on single-seller orders.
    return (order.sellerSplits?.length ?? 0) <= 1 ? order.items : [];
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

  if (profileQuery.error && !isSellerOnboardingRequiredError(profileQuery.error)) {
    return <SellerErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  if (!order) {
    return null;
  }

  const address = order.shippingAddressSnapshot;
  const addressCoordinates = coordinatesFromSnapshot(address);
  const delivery = sellerShipment ?? order.deliveryDetail;
  const deliveryMode = delivery?.deliveryMode ?? order.deliveryDetail?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER";
  const isStorePickup = deliveryMode === "STORE_PICKUP";
  const isAutomatedDelivery = automatedDeliveryModes.has(deliveryMode);
  const isManualTransportCod = isManualTransportCodOrder(order, deliveryMode);
  const manualTransportCodExpectedPaise = sellerCollectedCodExpectedPaise(order, sellerSplit, sellerShipment);
  const sellerCurrencySnapshot = order.sellerCurrencySnapshot;
  const sellerCurrency = sellerCurrencySnapshot?.currency ?? order.currency;
  const sellerSubtotalMinor =
    sellerCurrencySnapshot?.sellerSubtotalMinor ??
    sellerSplit?.sellerSubtotalPaise ??
    order.totalPaise;
  const usesSeparateSellerCurrency = sellerCurrency !== order.currency;
  const currentSellerStatus = sellerStatusValue(sellerSplit?.sellerStatus);
  const currentDeliveryStatus = deliveryStatusValue(
    sellerShipment?.status ?? order.deliveryDetail?.status ?? order.deliveryStatus,
  );
  const isTerminalSellerStatus =
    currentSellerStatus === "DELIVERED" || currentSellerStatus === "CANCELLED";
  const nextSellerStatus = isStorePickup
    ? isTerminalSellerStatus
      ? null
      : "DELIVERED"
    : nextSellerWorkflowStatus(currentSellerStatus, isAutomatedDelivery);
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
      detail: order.payments?.some((p) => p.method === "COD") ? "Cash on delivery" : "Payment collection state",
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
      {section !== "delivery" ? (
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/seller/orders">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to orders
            </Link>
          </Button>
          {!isStorePickup ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/seller/orders/${encodeURIComponent(orderNumber)}/delivery`}>
                <Truck className="h-4 w-4" aria-hidden="true" />
                Logistics view
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <SellerNoticeBadge notice={notice} />

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
            <p className="text-sm font-bold text-[#667085]">
              Seller subtotal ({sellerCurrency})
            </p>
            <p className="mt-1 text-3xl font-black leading-tight text-[#163B5C]">
              {formatMoney(sellerSubtotalMinor, sellerCurrency)}
            </p>
            {usesSeparateSellerCurrency ? (
              <div className="mt-2 space-y-1 text-xs font-bold leading-5 text-[#667085]">
                <p>
                  Base ledger:{" "}
                  {formatMoney(sellerSplit?.sellerSubtotalPaise ?? order.totalPaise, order.currency)}
                </p>
                <p>Customer payment and COD currency: {order.buyerCurrency ?? order.currency}</p>
              </div>
            ) : null}
            {sellerSplit ? (
              <div className="mt-4 space-y-2 text-sm font-semibold text-[#667085]">
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>Gross Amount</span>
                  <span className="text-[#1F2933]">
                    {formatMoney(sellerSubtotalMinor, sellerCurrency)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>Commission</span>
                  <span className="text-[#9F2600]">
                    -{formatMoney(
                      sellerCurrencySnapshot?.commissionMinor ?? sellerSplit.commissionPaise ?? 0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>Platform Fee</span>
                  <span className="text-[#9F2600]">
                    -{formatMoney(
                      sellerCurrencySnapshot?.platformFeeMinor ?? sellerSplit.platformFeePaise ?? 0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>GST on Comm/Fee</span>
                  <span className="text-[#9F2600]">
                    -{formatMoney(
                      sellerCurrencySnapshot?.gstOnCommissionMinor ??
                        sellerSplit.gstOnCommissionPaise ??
                        0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>TDS</span>
                  <span className="text-[#9F2600]">
                    -{formatMoney(
                      sellerCurrencySnapshot?.tdsMinor ?? sellerSplit.tdsPaise ?? 0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 lg:justify-end">
                  <span>TCS</span>
                  <span className="text-[#9F2600]">
                    -{formatMoney(
                      sellerCurrencySnapshot?.tcsMinor ?? sellerSplit.tcsPaise ?? 0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                {(sellerSplit.couponSellerFundedDiscountPaise ?? 0) > 0 ? (
                  <div className="flex justify-between gap-4 lg:justify-end">
                    <span>Seller-funded coupon</span>
                    <span className="text-[#9F2600]">
                      -{formatMoney(
                        sellerCurrencySnapshot?.couponSellerFundedDiscountMinor ??
                          sellerSplit.couponSellerFundedDiscountPaise ??
                          0,
                        sellerCurrency,
                      )}
                    </span>
                  </div>
                ) : null}
                {(sellerSplit.couponPlatformFundedDiscountPaise ?? 0) > 0 ? (
                  <p className="mt-2 text-xs font-bold text-[#0F8A5F]">
                    Platform-funded coupon shown to buyer, seller payout unaffected
                  </p>
                ) : null}
                <div className="mt-3 flex justify-between gap-4 border-t border-[#F2D5CC] pt-3 text-base lg:justify-end">
                  <span className="font-bold text-[#163B5C]">Net added to Wallet</span>
                  <span className="font-black text-[#0F8A5F]">
                    {formatMoney(
                      sellerCurrencySnapshot?.netPayableMinor ?? sellerSplit.netPayablePaise ?? 0,
                      sellerCurrency,
                    )}
                  </span>
                </div>
                {usesSeparateSellerCurrency ? (
                  <p className="text-xs font-bold leading-5 text-[#667085]">
                    Order-time seller pricing snapshot. Platform ledger remains{" "}
                    {formatMoney(sellerSplit.netPayablePaise ?? 0, order.currency)}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </SellerPanel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid content-start gap-4">
          {section !== "delivery" ? (
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
                        {formatVariantLabel(item.variantSnapshot) ?? "Default"}{" "}
                        x {item.quantity}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-sm font-semibold text-[#667085]">
                        {formatMoney(
                          item.sellerUnitPriceMinor ?? item.unitPricePaise,
                          item.sellerCurrency ?? item.currency,
                        )}{" "}
                        each
                      </p>
                      <p className="mt-1 text-lg font-black text-[#163B5C]">
                        {formatMoney(
                          item.sellerLineTotalMinor ?? item.lineTotalPaise,
                          item.sellerCurrency ?? item.currency,
                        )}
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
          ) : null}

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
                {!isStorePickup ? (
                  <Info label="Tracking" value={sellerShipment.trackingReference ?? "Not assigned"} />
                ) : null}
                <Info
                  label="Subtotal"
                  value={formatMoney(sellerSubtotalMinor, sellerCurrency)}
                />
                {!isStorePickup ? (
                  <Info
                    label={`Shipping share (${order.currency})`}
                    value={formatMoney(sellerShipment.shippingPaise, order.currency)}
                  />
                ) : null}
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
                              {isStorePickup
                                ? statusLabel(shipmentPackage.status)
                                : packageStatusTitle(shipmentPackage)}
                            </StatusBadge>
                          </div>
                          {!isStorePickup ? (
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
                          ) : null}
                          {shipmentPackage.ewayBillNumber ? (
                            <div className="mt-3 rounded-lg border border-[#F2B56B] bg-[#FFF7ED] p-3">
                              <div className="flex items-center gap-2 text-sm font-black text-[#9A3412]">
                                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                                E-Way Bill locked
                              </div>
                              <input
                                aria-label={`E-Way Bill Number for ${shipmentPackage.packageNumber}`}
                                readOnly
                                value={shipmentPackage.ewayBillNumber}
                                className="mt-2 h-10 w-full rounded-md border border-[#F2B56B] bg-white px-3 font-mono text-sm font-black tracking-wider text-[#1F2933] outline-none"
                              />
                              <p className="mt-2 text-xs font-semibold leading-5 text-[#9A3412]">
                                This statutory number is permanently non-editable for sellers.
                                Contact support only if a legally required correction is needed.
                              </p>
                            </div>
                          ) : null}
                          {shipmentPackage.bookingError ? (
                            <div className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#9B1C1C]">
                              <p className="font-bold">Booking failed</p>
                              <p className="mt-1">{shipmentPackage.bookingError}</p>
                            </div>
                          ) : null}
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
                          {canEditPackage && !isStorePickup ? (
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
                          {!isStorePickup && shipmentPackage.canDownloadLabel ? (
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
                          ) : !isStorePickup ? (
                            <StatusBadge tone="warning">{packageLabelState(shipmentPackage)}</StatusBadge>
                          ) : null}
                          {shipmentPackage.deliveryMode !== "THIRD_PARTY_COURIER" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => printPackageSlip(shipmentPackage)}
                            >
                              <Printer className="h-4 w-4" aria-hidden="true" />
                              Print pickup slip
                            </Button>
                          ) : null}
                          {!isStorePickup && shipmentPackage.trackingUrl ? (
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
                      {isStorePickup ? "Pickup state" : "Current package state"}
                    </p>
                    <p className="mt-1 text-lg font-black text-[#123A5A]">
                      {isStorePickup
                        ? storePickupActionTitle(currentSellerStatus)
                        : sellerActionTitle(currentSellerStatus)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SellerStatusPill status={currentSellerStatus} />
                    <SellerStatusPill status={currentDeliveryStatus} />
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
                  {isStorePickup
                    ? storePickupActionDescription(currentSellerStatus)
                    : sellerActionDescription(currentSellerStatus)}
                </p>
              </div>

              {!isStorePickup ? (
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
              ) : null}

              {!isTerminalSellerStatus ? (
                <>
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
                  {savedEWayBillNumber ||
                  nextSellerStatus === "PROCESSING" ||
                  nextSellerStatus === "DISPATCHED" ||
                  (nextSellerStatus === "DELIVERED" &&
                    (sellerSplit?.sellerSubtotalPaise ?? 0) >=
                      EWAY_BILL_THRESHOLD_PAISE) ? (
                    <div className="mt-4 grid gap-3">
                      {savedEWayBillNumber ? (
                        <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
                          <span className="flex items-center gap-2">
                            E-Way Bill Number
                            <StatusBadge tone="warning">Locked</StatusBadge>
                          </span>
                          <input
                            name="ewayBillNumber"
                            value={savedEWayBillNumber}
                            readOnly
                            className="h-11 rounded-md border border-[#F2B56B] bg-[#FFF7ED] px-3 font-mono font-black tracking-wider text-[#1F2933] outline-none"
                          />
                          <span className="text-xs font-semibold leading-5 text-[#9A3412]">
                            Saved for GST compliance and courier audit. Seller editing is disabled.
                          </span>
                        </label>
                      ) : (
                        <>
                          <div
                            role="note"
                            className="rounded-lg border border-[#F2B56B] bg-[#FFF7ED] p-3 text-sm font-semibold leading-6 text-[#9A3412]"
                          >
                            <strong>Important:</strong>{" "}
                            {EWAY_BILL_LOCK_WARNING.replace(/^Important:\s*/, "")}
                          </div>
                          <SellerField
                            label={
                              (sellerSplit?.sellerSubtotalPaise ?? 0) >=
                              EWAY_BILL_THRESHOLD_PAISE
                                ? "E-Way Bill Number (Required for values \u2265 \u20b950,000)"
                                : "E-Way Bill Number (Optional)"
                            }
                            name="ewayBillNumber"
                            value={ewayBillNumber}
                            onChange={(value) =>
                              setEwayBillNumber(value.replace(/\D/g, "").slice(0, 12))
                            }
                            placeholder="Enter 12-digit E-Way Bill Number"
                            required={
                              (sellerSplit?.sellerSubtotalPaise ?? 0) >=
                              EWAY_BILL_THRESHOLD_PAISE
                            }
                          />
                        </>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}

              {nextSellerStatus ? (
                <Button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => updateStatus(nextSellerStatus)}
                  className="h-12"
                >
                  {statusMutation.isPending
                    ? "Updating..."
                    : isStorePickup
                      ? "Mark pickup delivered"
                      : sellerActionLabel(nextSellerStatus)}
                </Button>
              ) : (
                <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                  {isAutomatedDelivery && currentSellerStatus === "PROCESSING"
                    ? "Packed and ready. Courier, delivery partner, or marketplace operations will update dispatch and delivery."
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
                  Package already dispatched. Contact support to reverse or handle return/refund.
                </div>
              ) : null}
            </div>
          </SellerPanel>

          {!isStorePickup ? (
            <>
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
                        : "This delivery mode needs seller or platform support coordination."
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
                      partner app, courier webhook, or support override.
                    </p>
                  ) : (
                    <p>
                      Manual transport does not have automated provider tracking. Use the seller
                      status flow for package progress and coordinate exceptions with support.
                    </p>
                  )}
                  {delivery?.deliveryNote ? (
                    <p className="mt-3 rounded-md bg-[#F8FAFC] px-3 py-2">
                      Latest note: {delivery.deliveryNote}
                    </p>
                  ) : null}
                </div>
              </SellerPanel>

              {section === "delivery" && isManualTransportCod && currentDeliveryStatus !== "DELIVERED" ? (
                <SellerPanel className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <SectionHeading
                      title="Manual transport COD"
                      description="Record the cash collected before marking this package delivered."
                    />
                  </div>
                  <div className="mt-4 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info
                        label="Expected collection"
                        value={formatMoney(manualTransportCodExpectedPaise, order.currency)}
                      />
                      <Info label="Mode" value="Seller-arranged delivery" />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4">
                    <div className="rounded-lg border border-[#FDE2B8] bg-[#FFF7ED] p-4 text-sm font-semibold leading-6 text-[#9A3412]">
                      Collect exactly {formatMoney(manualTransportCodExpectedPaise, order.currency)} from the customer. This amount is locked by the order total and cannot be edited here.
                    </div>
                    <SellerField
                      label="Collected amount"
                      name="manualCodAmount"
                      type="text"
                      value={formatMoney(manualTransportCodExpectedPaise, order.currency)}
                      readOnly
                    />
                    <label className="flex items-start gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 text-sm font-bold text-[#1F2933]">
                      <input
                        type="checkbox"
                        checked={manualCodCollected}
                        onChange={(event) => setManualCodCollected(event.currentTarget.checked)}
                        className="mt-1 h-4 w-4 rounded border-[#D8E2EA] accent-[#ED3500]"
                      />
                      <span>
                        COD cash collected from customer
                        <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
                          Tick this only after receiving the full locked amount shown above.
                        </span>
                      </span>
                    </label>
                    <SellerTextArea
                      label="Collection note"
                      name="manualCodNote"
                      rows={2}
                      value={manualCodNote}
                      onChange={setManualCodNote}
                      placeholder="Optional note, receipt reference, or handover detail"
                    />
                    <Button
                      type="button"
                      disabled={deliveryMutation.isPending}
                      onClick={() => markManualTransportCodDelivered(manualTransportCodExpectedPaise)}
                      className="h-12"
                    >
                      {deliveryMutation.isPending ? "Recording..." : "Record COD and mark delivered"}
                    </Button>
                  </div>
                </SellerPanel>
              ) : null}

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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function positiveDraftNumber(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isManualTransportCodOrder(
  order: { payments?: Array<{ method?: string | null }> },
  deliveryMode: string | null | undefined,
) {
  return deliveryMode === "MANUAL_TRANSPORT" && (order.payments ?? []).some((payment) => payment.method === "COD");
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
    return "Courier label not needed";
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
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
            ? "Updated by courier, delivery partner, or marketplace operations."
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

function storePickupActionTitle(status: SellerStatus) {
  if (status === "DELIVERED") {
    return "Pickup completed";
  }
  if (status === "CANCELLED") {
    return "Pickup cancelled";
  }
  return "Ready to confirm pickup";
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

function storePickupActionDescription(status: SellerStatus) {
  if (status === "DELIVERED") {
    return "The buyer pickup is marked complete for this store order.";
  }
  if (status === "CANCELLED") {
    return "This pickup order was cancelled.";
  }
  return "Confirm this only after the customer has collected the order from the store.";
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
