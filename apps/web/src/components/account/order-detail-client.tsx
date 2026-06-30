"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Star,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  OrderStatusTimeline,
  type OrderStatusTimelineEvent,
} from "@/components/shared/order-status-timeline";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { AccountShell } from "./account-shell";
import {
  ErrorPanel,
  PagePanel,
  SkeletonBlock,
  StatusPill,
  formatDateTime,
  statusLabel,
  statusTone,
} from "./account-ui";
import {
  cancelCustomerOrder,
  createCustomerItemCancellation,
  createCustomerReturnRequest,
  getAccountOrder,
  getOrderReviewOptions,
  submitProductReview,
  type CreateCustomerCancellationPayload,
  type CreateCustomerReturnPayload,
  type OrderReviewOptions,
  type SubmitProductReviewPayload,
} from "@/lib/account-api";
import { hasOrderLeftSeller } from "@/lib/order-cancellation";
import {
  cancellableQuantityOf,
  deliveredItemReturnState,
  isOrderDelivered,
  isOrderCancellable,
  isOrderReturnable,
  orderCancellationUnavailableReason,
  orderReturnUnavailableReason,
  returnPolicyDescription,
  summarizeSelection,
  type CustomerResolution,
  type OrderDetailItem,
} from "@/lib/order-returns";
import { formatMoney, formatOrderBaseAmount, formatOrderBuyerAmount, formatOrderTotal, primaryImage } from "@/lib/storefront-api";

type AccountOrderDetail = Awaited<ReturnType<typeof getAccountOrder>>;

export function OrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const confirmation = useConfirmationDialog();
  const [showCancellationDrawer, setShowCancellationDrawer] = useState(false);
  const [showReturnDrawer, setShowReturnDrawer] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [returnResolution, setReturnResolution] = useState<CustomerResolution>("REFUND");
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");

  const orderQuery = useQuery({
    queryKey: ["account-order", customerAuth.authKey, orderNumber],
    queryFn: () => getAccountOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled,
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: (note?: string) => cancelCustomerOrder(customerAuth.authHeaders, orderNumber, note),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Order cancelled.");
      void queryClient.invalidateQueries({
        queryKey: ["account-order", customerAuth.authKey, orderNumber],
      });
      void queryClient.invalidateQueries({ queryKey: ["account-orders", customerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Order cancellation failed.");
    },
  });

  const reviewOptionsQuery = useQuery({
    queryKey: ["account-order-review-options", customerAuth.authKey, orderNumber],
    queryFn: () => getOrderReviewOptions(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled && Boolean(orderQuery.data),
    retry: false,
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: SubmitProductReviewPayload) =>
      submitProductReview(customerAuth.authHeaders, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Review submitted for admin approval.");
      void queryClient.invalidateQueries({
        queryKey: ["account-order-review-options", customerAuth.authKey, orderNumber],
      });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Review submission failed.");
    },
  });

  const partialCancelMutation = useMutation({
    mutationFn: (payload: CreateCustomerCancellationPayload) =>
      createCustomerItemCancellation(customerAuth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Items cancelled successfully.");
      setShowCancellationDrawer(false);
      setSelectedItems(new Map());
      setCancellationReason("");
      setCancellationNote("");
      void queryClient.invalidateQueries({
        queryKey: ["account-order", customerAuth.authKey, orderNumber],
      });
      void queryClient.invalidateQueries({ queryKey: ["account-orders", customerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Partial cancellation failed.");
    },
  });

  const returnMutation = useMutation({
    mutationFn: (payload: CreateCustomerReturnPayload) =>
      createCustomerReturnRequest(customerAuth.authHeaders, orderNumber, payload),
    onSuccess: () => {
      setNoticeTone("success");
      setNotice("Return request submitted successfully.");
      setShowReturnDrawer(false);
      setSelectedItems(new Map());
      setReturnReason("");
      setReturnNote("");
      void queryClient.invalidateQueries({
        queryKey: ["account-order", customerAuth.authKey, orderNumber],
      });
      void queryClient.invalidateQueries({ queryKey: ["account-returns", customerAuth.authKey] });
    },
    onError: (error) => {
      setNoticeTone("danger");
      setNotice(error instanceof Error ? error.message : "Return request failed.");
    },
  });

  function handlePartialCancellation() {
    if (selectedItems.size === 0) {
      setNoticeTone("danger");
      setNotice("Please select at least one item to cancel.");
      return;
    }

    const items: CreateCustomerCancellationPayload["items"] = [];
    for (const [itemId, quantity] of selectedItems.entries()) {
      if (quantity > 0) {
        items.push({ orderItemId: itemId, quantity });
      }
    }

    setNotice(null);
    const payload: CreateCustomerCancellationPayload = { items };
    const cleanReason = cancellationReason.trim();
    const cleanNote = cancellationNote.trim();
    if (cleanReason) {
      payload.reason = cleanReason;
    }
    if (cleanNote) {
      payload.note = cleanNote;
    }

    confirmation.requestConfirmation({
      title: "Cancel selected items?",
      description: "This will cancel the selected items and quantities from your order.",
      confirmLabel: "Cancel items",
      onConfirm: () => partialCancelMutation.mutate(payload),
    });
  }

  function handleReturnRequest() {
    if (selectedItems.size === 0) {
      setNoticeTone("danger");
      setNotice("Please select at least one item to return.");
      return;
    }

    if (!returnReason.trim()) {
      setNoticeTone("danger");
      setNotice("Please provide a reason for the return.");
      return;
    }

    const items: CreateCustomerReturnPayload["items"] = [];
    for (const [itemId, quantity] of selectedItems.entries()) {
      if (quantity > 0) {
        items.push({ orderItemId: itemId, quantity });
      }
    }

    const payload: CreateCustomerReturnPayload = {
      resolution: returnResolution,
      reason: returnReason.trim(),
      items,
    };
    const cleanNote = returnNote.trim();
    if (cleanNote) {
      payload.note = cleanNote;
    }

    setNotice(null);
    confirmation.requestConfirmation({
      title: `Request ${returnResolution === "REFUND" ? "refund" : "replacement"}?`,
      description: "This will submit a return request for the selected items.",
      confirmLabel: "Submit request",
      onConfirm: () => returnMutation.mutate(payload),
    });
  }

  function toggleItemSelection(itemId: string, maxQuantity: number) {
    const currentQuantity = selectedItems.get(itemId) || 0;
    const newSelection = new Map(selectedItems);

    if (currentQuantity > 0) {
      newSelection.delete(itemId);
    } else {
      newSelection.set(itemId, maxQuantity);
    }

    setSelectedItems(newSelection);
  }

  function updateItemQuantity(itemId: string, quantity: number, maxQuantity: number) {
    const newSelection = new Map(selectedItems);
    if (quantity <= 0) {
      newSelection.delete(itemId);
    } else {
      newSelection.set(itemId, Math.min(quantity, maxQuantity));
    }
    setSelectedItems(newSelection);
  }

  function openCancellationDrawer() {
    setSelectedItems(new Map());
    setCancellationReason("");
    setCancellationNote("");
    setShowCancellationDrawer(true);
  }

  function openReturnDrawer(resolution: CustomerResolution = "REFUND") {
    setSelectedItems(new Map());
    setReturnResolution(resolution);
    setReturnReason("");
    setReturnNote("");
    setShowReturnDrawer(true);
  }

  const order = orderQuery.data;
  const address = order?.shippingAddressSnapshot;
  const canCancel = order ? isOrderCancellable(order) : false;
  const cancellationUnavailableReason = order ? orderCancellationUnavailableReason(order) : null;
  const shouldShowSupportLink = order ? hasOrderLeftSeller(order) : false;
  const timeline = order ? buildTrackingTimeline(order) : [];
  const deliveryStatus = order ? effectiveCustomerDeliveryStatus(order) : null;
  const canShowDeliveryAssignment = order ? customerDeliveryAssignmentReady(order) : false;
  const latestPayment = order?.payments?.[0] ?? null;
  const canReturn = order ? isOrderReturnable(order) : false;
  const isDelivered = order ? isOrderDelivered(order) : false;
  const returnUnavailableReason = order ? orderReturnUnavailableReason(order) : null;
  const hasCancellableItems = order
    ? order.items.some((item) => cancellableQuantityOf(item) > 0)
    : false;
  const hasReturnableItems = order
    ? canReturn && order.items.some((item) => deliveredItemReturnState(item).kind === "returnable")
    : false;

  return (
    <AccountShell
      title="Order detail"
      description={`Review status, delivery, payment, and items for order ${orderNumber}.`}
    >
      {confirmation.confirmationDialog}
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="mb-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to orders
          </Link>
        </Button>
      </div>

      {orderQuery.isLoading ? <SkeletonBlock /> : null}
      {orderQuery.error ? (
        <ErrorPanel error={orderQuery.error} onRetry={() => void orderQuery.refetch()} />
      ) : null}
      {notice ? (
        <div className="mb-4">
          <StatusBadge tone={noticeTone}>{notice}</StatusBadge>
        </div>
      ) : null}

      {order ? (
        <div className="grid gap-4">
          <section className="rounded-xl border border-[#D8E2EA] bg-white p-5 shadow-sm lg:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ContextStatusPill
                  status={order.orderStatus}
                  label={customerOrderStatusLabel(order.orderStatus)}
                />
                <ContextStatusPill
                  status={order.paymentStatus}
                  label={customerPaymentStatusLabel(order.paymentStatus)}
                />
                <ContextStatusPill
                  status={deliveryStatus ?? order.deliveryStatus}
                  label={friendlyDeliveryLabel(deliveryStatus ?? order.deliveryStatus)}
                />
              </div>
              <h2 className="mt-3 break-words text-2xl font-black tracking-normal text-[#0B1828] md:text-3xl">
                Order #{order.orderNumber}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                Placed on {formatDateTime(order.createdAt)}
              </p>
            </div>
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid min-w-0 gap-4">
              <PagePanel className="p-0">
                <div className="border-b border-[#E5E7EB] p-5">
                  <SectionHeading
                    title="Delivery progress"
                    description="From confirmation to delivery."
                  />
                </div>
                <DeliveryProgress currentStatus={deliveryStatus} />
              </PagePanel>

              <PagePanel>
                <SectionHeading
                  title={`Items in this order (${order.items.length})`}
                  description="Products included in this order."
                />
                <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB]">
                  {order.items.map((item) => {
                    const imageUrl = item.product ? primaryImage(item.product) : null;
                    const reviewOption = reviewOptionsQuery.data?.items.find(
                      (option) => option.orderItemId === item.id,
                    );
                    const returnState = isDelivered ? deliveredItemReturnState(item) : null;
                    const cancellableQty = canCancel ? cancellableQuantityOf(item) : 0;
                    const policyDescription = returnPolicyDescription(item);

                    return (
                      <div
                        key={item.id}
                        className="grid gap-4 border-b border-[#E5E7EB] bg-white p-4 last:border-b-0 md:grid-cols-[96px_1fr_auto]"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-md bg-[#EAF1F7]">
                          <StorefrontImage
                            src={imageUrl}
                            alt={item.productNameSnapshot}
                            sizes="96px"
                            fallbackLabel="Item"
                          />
                        </div>
                        <div>
                          <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                          <p className="mt-1 text-sm font-semibold text-[#667085]">
                            {item.variantSnapshot?.variantName ?? "Default"}{" "}
                            x {item.quantity}
                          </p>
                          {item.seller?.storeName ? (
                            <p className="mt-1 text-sm font-semibold text-[#667085]">
                              Seller: {item.seller.storeName}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-[#F8FAFC] px-2 py-1 text-xs font-bold text-[#667085]">
                              Policy: {policyDescription}
                            </span>
                            {cancellableQty > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7E6] px-2 py-1 text-xs font-bold text-[#9A5B00]">
                                <Ban className="h-3 w-3" aria-hidden="true" />
                                {cancellableQty} cancellable
                              </span>
                            ) : null}
                            {returnState ? (
                              returnState.kind === "returnable" ? (
                                canReturn ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF1F7] px-2 py-1 text-xs font-bold text-[#163B5C]">
                                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                    Returnable ({returnState.availableQuantity} available)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-2 py-1 text-xs font-bold text-[#667085]">
                                    {returnUnavailableReason}
                                  </span>
                                )
                              ) : returnState.kind === "non-returnable" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDECEC] px-2 py-1 text-xs font-bold text-[#8A1F1F]">
                                  Non-returnable: {returnState.reason}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-2 py-1 text-xs font-bold text-[#667085]">
                                  {canReturn ? returnState.reason : returnUnavailableReason}
                                </span>
                              )
                            ) : null}
                            {item.returnItems?.length ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-1 text-xs font-bold text-[#067647]">
                                Return request: {item.returnItems[0]?.returnRequest.requestNumber}
                              </span>
                            ) : null}
                            {(item.cancelledQuantity ?? 0) > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-[#FDECEC] px-2 py-1 text-xs font-bold text-[#8A1F1F]">
                                {item.cancelledQuantity} cancelled
                              </span>
                            ) : null}
                            {(item.returnedQuantity ?? 0) > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-[#EAF1F7] px-2 py-1 text-xs font-bold text-[#163B5C]">
                                {item.returnedQuantity} returned
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-sm font-semibold text-[#667085]">
                            {formatMoney(item.unitPricePaise, item.currency)} each
                          </p>
                          <p className="mt-1 text-lg font-black text-[#163B5C]">
                            {formatMoney(item.lineTotalPaise, item.currency)}
                          </p>
                        </div>
                        {reviewOption ? (
                          <div className="md:col-span-3">
                            <OrderItemReviewBox
                              key={`${reviewOption.orderItemId}-${reviewOption.existingReview?.updatedAt ?? "new"}`}
                              option={reviewOption}
                              isPending={reviewMutation.isPending}
                              onSubmit={(payload) => reviewMutation.mutate(payload)}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </PagePanel>

              <PagePanel>
                <SectionHeading
                  title="Order timeline"
                  description="A short history of important updates."
                />
                <OrderStatusTimeline
                  className="mt-5"
                  events={timeline}
                  orderCreatedAt={order.createdAt}
                  currentOrderStatus={order.orderStatus}
                  currentDeliveryStatus={deliveryStatus}
                  formatDateTime={formatDateTime}
                  emptyText="No timeline events found."
                  compact
                  showSources={false}
                  showNotes={false}
                  showFooter={false}
                  showStateBadges={false}
                />
              </PagePanel>
            </div>

            <div className="grid gap-4 xl:sticky xl:top-24">
              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Delivery address" description="Saved at checkout." />
                </div>
                <div className="mt-4 text-sm font-semibold leading-6 text-[#667085]">
                  <p className="font-black text-[#1F2933]">
                    {address?.fullName ?? "Not available"}
                  </p>
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
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Tracking" description="Partner and tracking details." />
                </div>
                <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                  <Info
                    label="Partner"
                    value={
                      canShowDeliveryAssignment
                        ? customerDeliveryPartnerName(order.deliveryDetail)
                        : "Assigned after packing"
                    }
                  />
                  <Info
                    label="Phone"
                    value={
                      canShowDeliveryAssignment
                        ? customerDeliveryPartnerPhone(order.deliveryDetail)
                        : "Shown after assignment"
                    }
                  />
                  <Info
                    label="Tracking ID"
                    value={
                      canShowDeliveryAssignment
                        ? (order.deliveryDetail?.trackingReference ?? "Not generated yet")
                        : "Shown after pickup"
                    }
                  />
                  <Info
                    label="Current step"
                    value={trackingStatusLabel(deliveryStatus ?? order.deliveryStatus)}
                  />
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#F8FAFC] text-[#163B5C]">
                    <ReceiptText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading title="Order summary" description="Charges saved at checkout." />
                </div>
                <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                  <Info label="Subtotal" value={formatOrderBuyerAmount(order, order.buyerSubtotalMinor, order.subtotalPaise)} />
                  {(order.couponDiscountPaise ?? 0) > 0 ? (
                    <Info
                      label={`Coupon ${order.couponCode ?? ""}`.trim()}
                      value={`-${formatOrderBuyerAmount(order, order.buyerCouponDiscountMinor, order.couponDiscountPaise ?? 0)}`}
                    />
                  ) : null}
                  <Info label="Shipping" value={formatOrderBuyerAmount(order, order.buyerShippingMinor, order.shippingPaise)} />
                  <Info
                    label="Platform fee"
                    value={formatOrderBuyerAmount(order, order.buyerPlatformFeeMinor, order.platformFeePaise)}
                  />
                  <Info label="Total" value={formatOrderTotal(order)} />
                  {formatOrderBaseAmount(order, order.totalPaise) ? (
                    <Info label="Base total" value={formatOrderBaseAmount(order, order.totalPaise) ?? ""} />
                  ) : null}
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#E9F7F1] text-[#0F8A5F]">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading
                    title="Payment details"
                    description="Method, status, and amount."
                  />
                </div>
                <div className="mt-4 grid gap-3 text-sm font-semibold text-[#667085]">
                  <Info
                    label="Method"
                    value={latestPayment ? statusLabel(latestPayment.provider) : "Not recorded"}
                  />
                  <Info
                    label="Status"
                    value={statusLabel(latestPayment?.status ?? order.paymentStatus)}
                  />
                </div>
              </PagePanel>

              <PagePanel>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                    <Headphones className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <SectionHeading
                    title="Help & actions"
                    description="Cancel, return, or get support for this order."
                  />
                </div>

                <div className="mt-5 grid gap-3">
                  {canCancel ? (
                    <div className="grid gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setNotice(null);
                          confirmation.requestConfirmation({
                            title: "Cancel this order?",
                            description: `This will cancel order ${orderNumber}. You can place a new order again if needed.`,
                            confirmLabel: "Cancel order",
                            onConfirm: () => cancelMutation.mutate(undefined),
                          });
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        <Ban className="h-4 w-4" aria-hidden="true" />
                        {cancelMutation.isPending ? "Cancelling..." : "Cancel order"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openCancellationDrawer}
                        disabled={!hasCancellableItems || partialCancelMutation.isPending}
                      >
                        <Ban className="h-4 w-4" aria-hidden="true" />
                        Cancel selected items
                      </Button>
                    </div>
                  ) : null}

                  {hasReturnableItems ? (
                    <div className="grid gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openReturnDrawer("REFUND")}
                        disabled={returnMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Request refund
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openReturnDrawer("REPLACEMENT")}
                        disabled={returnMutation.isPending}
                      >
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />
                        Request replacement
                      </Button>
                    </div>
                  ) : null}

                  {!canCancel && !hasReturnableItems ? (
                    <div className="grid gap-3">
                      {isDelivered && returnUnavailableReason ? (
                        <p className="text-sm font-semibold leading-6 text-[#667085]">
                          {returnUnavailableReason}
                        </p>
                      ) : cancellationUnavailableReason ? (
                        <p className="text-sm font-semibold leading-6 text-[#667085]">
                          {cancellationUnavailableReason}
                        </p>
                      ) : null}
                      {shouldShowSupportLink ? (
                        <Button asChild variant="outline">
                          <Link href="/account/support">Contact support</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </PagePanel>
            </div>
          </div>

          {/* Partial Cancellation Drawer */}
          {showCancellationDrawer && order ? (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
              <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-[#1F2933]">Cancel selected items</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                    Choose only pre-dispatch items and quantities. Delivered orders use the return flow.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancellationDrawer(false)}
                  disabled={partialCancelMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {order.items.filter((item) => cancellableQuantityOf(item) > 0).length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                    No item quantities are currently eligible for customer self-cancellation.
                  </div>
                ) : null}
                {order.items
                  .filter((item) => cancellableQuantityOf(item) > 0)
                  .map((item) => {
                    const maxQuantity = cancellableQuantityOf(item);
                    const selectedQuantity = selectedItems.get(item.id) || 0;

                    return (
                      <div key={item.id} className="flex flex-col gap-3 rounded-md border border-[#E5E7EB] p-3 sm:flex-row sm:items-center">
                        <input
                          type="checkbox"
                          checked={selectedQuantity > 0}
                          onChange={() => toggleItemSelection(item.id, maxQuantity)}
                          className="h-4 w-4 rounded border-[#D8E2EA]"
                          disabled={partialCancelMutation.isPending}
                          aria-label={`Select ${item.productNameSnapshot} for cancellation`}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#1F2933]">{item.productNameSnapshot}</p>
                          <p className="text-xs font-semibold text-[#667085]">
                            {formatMoney(item.unitPricePaise, item.currency)} each / {maxQuantity} available
                          </p>
                        </div>
                        {selectedQuantity > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selectedQuantity - 1, maxQuantity)}
                              className="h-8 w-8 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] text-sm font-bold hover:bg-[#EAF1F7]"
                              disabled={partialCancelMutation.isPending}
                            >
                              -
                            </button>
                            <span className="text-sm font-bold text-[#1F2933] w-8 text-center">
                              {selectedQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selectedQuantity + 1, maxQuantity)}
                              className="h-8 w-8 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] text-sm font-bold hover:bg-[#EAF1F7]"
                              disabled={partialCancelMutation.isPending || selectedQuantity >= maxQuantity}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {selectedItems.size > 0 ? (
                <div className="mt-4 p-4 bg-[#F8FAFC] rounded-md">
                  <SelectionSummaryDisplay
                    items={order.items}
                    selection={selectedItems}
                    currency={order.currency}
                    amountLabel="Estimated refund"
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">
                    Reason (optional)
                  </span>
                  <input
                    type="text"
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    maxLength={160}
                    placeholder="Ordered by mistake, changed quantity, or duplicate order"
                    className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                    disabled={partialCancelMutation.isPending}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">
                    Note (optional)
                  </span>
                  <textarea
                    value={cancellationNote}
                    onChange={(event) => setCancellationNote(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Add any detail for support or refund review."
                    className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                    disabled={partialCancelMutation.isPending}
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCancellationDrawer(false)}
                  disabled={partialCancelMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handlePartialCancellation}
                  disabled={selectedItems.size === 0 || partialCancelMutation.isPending}
                >
                  {partialCancelMutation.isPending ? "Processing..." : "Submit cancellation"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Return Request Drawer */}
        {showReturnDrawer && order ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-[#1F2933]">
                    Request {returnResolution === "REPLACEMENT" ? "replacement" : "refund"}
                  </h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                    Select delivered eligible items. Replacement stays an explicit choice and is not auto-selected.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReturnDrawer(false)}
                  disabled={returnMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {order.items.filter((item) => deliveredItemReturnState(item).kind === "returnable").length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                    No delivered items are currently eligible for a new refund or replacement request.
                  </div>
                ) : null}
                {order.items
                  .filter((item) => {
                    const state = deliveredItemReturnState(item);
                    return state.kind === "returnable";
                  })
                  .map((item) => {
                    const state = deliveredItemReturnState(item);
                    const maxQuantity = state.kind === "returnable" ? state.availableQuantity : 0;
                    const selectedQuantity = selectedItems.get(item.id) || 0;

                    return (
                      <div key={item.id} className="flex flex-col gap-3 rounded-md border border-[#E5E7EB] p-3 sm:flex-row sm:items-center">
                        <input
                          type="checkbox"
                          checked={selectedQuantity > 0}
                          onChange={() => toggleItemSelection(item.id, maxQuantity)}
                          className="h-4 w-4 rounded border-[#D8E2EA]"
                          disabled={returnMutation.isPending}
                          aria-label={`Select ${item.productNameSnapshot} for ${returnResolution.toLowerCase()}`}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#1F2933]">{item.productNameSnapshot}</p>
                          <p className="text-xs font-semibold text-[#667085]">
                            {formatMoney(item.unitPricePaise, item.currency)} each / {maxQuantity} returnable
                          </p>
                        </div>
                        {selectedQuantity > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selectedQuantity - 1, maxQuantity)}
                              className="h-8 w-8 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] text-sm font-bold hover:bg-[#EAF1F7]"
                              disabled={returnMutation.isPending}
                            >
                              -
                            </button>
                            <span className="text-sm font-bold text-[#1F2933] w-8 text-center">
                              {selectedQuantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(item.id, selectedQuantity + 1, maxQuantity)}
                              className="h-8 w-8 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] text-sm font-bold hover:bg-[#EAF1F7]"
                              disabled={returnMutation.isPending || selectedQuantity >= maxQuantity}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {selectedItems.size > 0 ? (
                <div className="mt-4 p-4 bg-[#F8FAFC] rounded-md">
                  <SelectionSummaryDisplay
                    items={order.items}
                    selection={selectedItems}
                    currency={order.currency}
                    amountLabel={returnResolution === "REPLACEMENT" ? "Selected item value" : "Estimated refund"}
                  />
                </div>
              ) : null}

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#667085] mb-2">
                    Resolution
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setReturnResolution("REFUND")}
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-bold transition ${
                        returnResolution === "REFUND"
                          ? "border-[#ED3500] bg-[#FFF0EC] text-[#ED3500]"
                          : "border-[#D8E2EA] bg-[#F8FAFC] text-[#667085] hover:bg-[#EAF1F7]"
                      }`}
                    >
                      Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnResolution("REPLACEMENT")}
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-bold transition ${
                        returnResolution === "REPLACEMENT"
                          ? "border-[#ED3500] bg-[#FFF0EC] text-[#ED3500]"
                          : "border-[#D8E2EA] bg-[#F8FAFC] text-[#667085] hover:bg-[#EAF1F7]"
                      }`}
                    >
                      Replacement
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#667085] mb-2">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Why are you returning this item?"
                    required
                    className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#667085] mb-2">
                    Additional note (optional)
                  </label>
                  <textarea
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Any additional details about your return"
                    rows={3}
                    className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReturnDrawer(false)}
                  disabled={returnMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleReturnRequest}
                  disabled={selectedItems.size === 0 || returnMutation.isPending}
                >
                  {returnMutation.isPending ? "Processing..." : "Submit return request"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      ) : null}
    </AccountShell>
  );
}

type ReviewOptionItem = OrderReviewOptions["items"][number];

function SelectionSummaryDisplay({
  items,
  selection,
  currency,
  amountLabel,
}: {
  items: OrderDetailItem[];
  selection: Map<string, number>;
  currency: string;
  amountLabel: string;
}) {
  const summary = summarizeSelection(items, selection);

  if (summary.itemCount === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 text-sm">
      <div className="flex justify-between">
        <span className="font-semibold text-[#667085]">Selected items:</span>
        <span className="font-bold text-[#1F2933]">{summary.itemCount}</span>
      </div>
      <div className="flex justify-between">
        <span className="font-semibold text-[#667085]">Total quantity:</span>
        <span className="font-bold text-[#1F2933]">{summary.quantityTotal}</span>
      </div>
      <div className="flex justify-between">
        <span className="font-semibold text-[#667085]">{amountLabel}:</span>
        <span className="font-bold text-[#163B5C]">
          {summary.approximate ? "Up to " : ""}
          {formatMoney(summary.refundPaise, currency)}
        </span>
      </div>
      {summary.approximate ? (
        <p className="rounded-md bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#667085]">
          Coupon or discount allocation can make the final amount slightly lower. This estimate is indicative until the backend confirms it.
        </p>
      ) : null}
    </div>
  );
}

function OrderItemReviewBox({
  option,
  isPending,
  onSubmit,
}: {
  option: ReviewOptionItem;
  isPending: boolean;
  onSubmit: (payload: SubmitProductReviewPayload) => void;
}) {
  const existingReview = option.existingReview;
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [comment, setComment] = useState(existingReview?.comment ?? "");

  if (!option.eligible) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#667085]">
        {option.reason ?? "Reviews are available after paid and delivered orders."}
      </div>
    );
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: SubmitProductReviewPayload = {
      orderItemId: option.orderItemId,
      rating,
    };
    const cleanTitle = title.trim();
    const cleanComment = comment.trim();
    if (cleanTitle) {
      payload.title = cleanTitle;
    }
    if (cleanComment) {
      payload.comment = cleanComment;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={submitReview} className="rounded-lg border border-[#FFE0D6] bg-[#FFF8F5] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#1F2933]">Rate this product</p>
          <p className="mt-1 text-xs font-semibold text-[#667085]">
            {existingReview
              ? "Editing will send the review back to admin approval."
              : "Submitted reviews appear publicly after admin approval."}
          </p>
        </div>
        {existingReview ? <StatusPill status={existingReview.status} /> : null}
      </div>

      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Review rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`grid h-9 w-9 place-items-center rounded-full border transition ${
              value <= rating
                ? "border-[#ED3500] bg-white text-[#ED3500]"
                : "border-[#E5E7EB] bg-white text-[#98A2B3]"
            }`}
            aria-label={`${value} star`}
            aria-pressed={value === rating}
          >
            <Star
              className={`h-4 w-4 ${value <= rating ? "fill-[#ED3500]" : ""}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
        <label className="grid gap-1 text-sm font-black text-[#1F2933]">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Short review title"
            className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-[#1F2933]">
          Review
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Share product quality, fit, packing, or usage feedback"
            className="min-h-20 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
          />
        </label>
      </div>

      {existingReview?.adminNote ? (
        <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#667085]">
          Admin note: {existingReview.adminNote}
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        className="mt-3 rounded-full bg-[#ED3500]"
        disabled={isPending}
      >
        {isPending ? "Submitting" : existingReview ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}

function ContextStatusPill({ status, label }: { status?: string | null; label: string }) {
  return <StatusBadge tone={statusTone(status)}>{label}</StatusBadge>;
}

function customerOrderStatusLabel(status?: string | null) {
  switch (status) {
    case "PLACED":
    case "PENDING":
      return "Order confirmed";
    case "PROCESSING":
      return "Order in progress";
    case "COMPLETED":
      return "Order completed";
    case "CANCELLED":
      return "Order cancelled";
    default:
      return `Order ${statusLabel(status).toLowerCase()}`;
  }
}

function customerPaymentStatusLabel(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Payment received";
    case "PENDING":
      return "Payment pending";
    case "FAILED":
      return "Payment failed";
    case "REFUNDED":
      return "Payment refunded";
    default:
      return `Payment ${statusLabel(status).toLowerCase()}`;
  }
}

function DeliveryProgress({ currentStatus }: { currentStatus?: string | null }) {
  const steps: Array<{ status: string; label: string; helper: string; icon: LucideIcon }> = [
    {
      status: "PENDING",
      label: "Placed",
      helper: "Order received",
      icon: ShoppingBag,
    },
    {
      status: "PACKED",
      label: "Packed",
      helper: "Ready for pickup",
      icon: Package,
    },
    {
      status: "DISPATCHED",
      label: "Picked up",
      helper: "With delivery",
      icon: PackageCheck,
    },
    {
      status: "IN_TRANSIT",
      label: "Out for delivery",
      helper: "On the way",
      icon: Truck,
    },
    {
      status: "DELIVERED",
      label: "Delivered",
      helper: "Completed",
      icon: CheckCircle2,
    },
  ];
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.status === (currentStatus ?? "PENDING")),
  );
  const isCancelled = currentStatus === "CANCELLED";

  return (
    <div className="p-5">
      <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
        <div className="grid gap-4 sm:grid-cols-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const done = !isCancelled && currentIndex > index;
            const current = !isCancelled && currentIndex === index;
            const active = done || current;
            return (
              <div
                key={step.status}
                className="relative grid min-w-0 grid-cols-[40px_1fr] gap-3 sm:block sm:text-center"
              >
                {index < steps.length - 1 ? (
                  <span
                    className={`absolute left-5 top-10 h-[calc(100%+1rem)] w-px sm:left-[calc(50%+24px)] sm:right-[calc(-50%+24px)] sm:top-5 sm:h-px sm:w-auto ${
                      done ? "bg-[#0F8A5F]" : "bg-[#D8E2EA]"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-sm sm:mx-auto ${
                    active
                      ? "border-[#0F8A5F] bg-[#0F8A5F] text-white"
                      : "border-[#D8E2EA] bg-white text-[#98A2B3]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-5 text-[#1F2933]">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#667085]">
                    {current ? "Current step" : step.helper}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {isCancelled ? (
        <div className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-black text-[#8A1F1F]">
          This order delivery was cancelled.
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="text-right font-black text-[#1F2933]">{value}</span>
    </div>
  );
}

const customerDeliveryStatusRank: Record<string, number> = {
  NOT_ASSIGNED: 0,
  PENDING: 1,
  PACKED: 2,
  DISPATCHED: 3,
  IN_TRANSIT: 4,
  DELIVERED: 5,
  CANCELLED: 6,
};

function effectiveCustomerDeliveryStatus(order: NonNullable<AccountOrderDetail>) {
  const actualStatus = order.deliveryDetail?.status ?? order.deliveryStatus ?? "PENDING";
  if (
    !customerSellerPackagesReady(order) &&
    customerDeliveryRank(actualStatus) >= customerDeliveryRank("PACKED")
  ) {
    return "PENDING";
  }
  return actualStatus;
}

function customerDeliveryAssignmentReady(order: NonNullable<AccountOrderDetail>) {
  return (
    customerSellerPackagesReady(order) &&
    ["ASSIGNED", "ACCEPTED"].includes(order.deliveryDetail?.assignmentStatus ?? "")
  );
}

function customerSellerPackagesReady(order: NonNullable<AccountOrderDetail>) {
  const shipments = order.shipments ?? [];
  const activeShipments = shipments.filter((shipment) => shipment.status !== "CANCELLED");

  return (
    activeShipments.length > 0 &&
    activeShipments.every(
      (shipment) =>
        customerDeliveryRank(shipment.status) >= customerDeliveryRank("PACKED") &&
        shipment.status !== "CANCELLED",
    )
  );
}

function customerDeliveryRank(status?: string | null) {
  return customerDeliveryStatusRank[status ?? ""] ?? 0;
}

function customerDeliveryPartnerName(
  delivery?: NonNullable<NonNullable<AccountOrderDetail>["deliveryDetail"]> | null,
) {
  return delivery?.partnerName ?? delivery?.deliveryPartner?.fullName ?? "Not assigned";
}

function customerDeliveryPartnerPhone(
  delivery?: NonNullable<NonNullable<AccountOrderDetail>["deliveryDetail"]> | null,
) {
  return delivery?.partnerPhone ?? delivery?.deliveryPartner?.phone ?? "Not assigned";
}

function buildTrackingTimeline(order: AccountOrderDetail): OrderStatusTimelineEvent[] {
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

function friendlyDeliveryLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Delivery pending";
    case "PACKED":
      return "Packed for pickup";
    case "DISPATCHED":
      return "Picked up";
    case "IN_TRANSIT":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Delivery cancelled";
    default:
      return statusLabel(status ?? "PENDING");
  }
}

function trackingStatusLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Waiting for packing";
    case "PACKED":
      return "Ready for pickup";
    case "DISPATCHED":
      return "Picked up by partner";
    case "IN_TRANSIT":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Delivery cancelled";
    default:
      return statusLabel(status ?? "PENDING");
  }
}
