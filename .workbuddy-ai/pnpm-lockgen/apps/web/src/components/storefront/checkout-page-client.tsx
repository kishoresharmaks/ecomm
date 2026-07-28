"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, Loader2, MapPin, TicketPercent, Truck, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { LocationFields } from "@/components/locations/location-fields";
import { MapLocationPicker } from "@/components/maps/map-location-picker";
import { useMarket } from "@/components/market/market-context";
import { listCustomerAddresses } from "@/lib/account-api";
import { IndihubApiError } from "@/lib/api";
import { customerDeliveryOptions, customerDeliveryModeLabel } from "@/lib/delivery-labels";
import { normalizeGstin, validateGstInvoiceDetails } from "@/lib/gst-invoice";
import {
  cartTotals,
  createRazorpayProviderOrder,
  formatMoney,
  getCart,
  getCheckoutSummary,
  getCheckoutPaymentMethods,
  placeOrder,
  cancelRazorpayOrder,
  verifyRazorpayPayment,
  type CheckoutAddress,
  type CheckoutManualTransportOption,
  type CheckoutPaymentMethodRecord,
  type CheckoutSummaryOptions,
  type DeliveryMode,
  type PlaceOrderPayload,
} from "@/lib/storefront-api";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import {
  couponApplyErrorMessage,
  couponFeedbackClassName,
  normalizeCouponCodeInput,
  validateCouponCodeInput,
  type CouponFeedback,
} from "./coupon-feedback";
import { StorefrontFrame } from "./storefront-frame";
import { StorefrontImage } from "./storefront-image";
import { StorefrontProductAttributeChips } from "./storefront-product-attributes";
import {
  StorefrontErrorPanel,
  StorefrontNotice,
  StorefrontOptionCard,
  StorefrontPageHeader,
  StorefrontPanel,
  StorefrontPanelHeader,
  StorefrontSkeleton,
  StorefrontSummaryRow,
  storefrontFieldLabelClassName,
  storefrontInputClassName,
  storefrontTextareaClassName,
} from "./storefront-ui";

type DirectCheckoutSnapshot = {
  variantId: string;
  quantity: number;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  sellerName: string;
  variantName?: string | null;
  pricePaise: number;
  currency: string;
};

const initialAddress: CheckoutAddress = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  countryCode: "IN",
  stateCode: "",
  cityCode: "",
  localAreaCode: "",
};

const fallbackPaymentOptions: CheckoutPaymentMethodRecord[] = [
  { method: "COD", label: "Cash on delivery", enabled: false, note: "Loading payment settings." },
  { method: "RAZORPAY", label: "Razorpay", enabled: false, note: "Loading payment settings." },
  {
    method: "BANK_TRANSFER",
    label: "Bank transfer",
    enabled: false,
    note: "Loading payment settings.",
  },
  { method: "MANUAL", label: "Manual payment", enabled: false, note: "Loading payment settings." },
];

const manualAddressId = "manual";
const directCheckoutStorageKey = "indihub.directCheckout.v1";

export function CheckoutPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const initialCouponCode = normalizeCouponCodeInput(searchParams.get("couponCode") ?? "");
  const validInitialCouponCode = validateCouponCodeInput(initialCouponCode) ? null : initialCouponCode || null;
  const [paymentMethod, setPaymentMethod] = useState<PlaceOrderPayload["paymentMethod"]>("COD");
  const [deliveryPreference, setDeliveryPreference] =
    useState<NonNullable<PlaceOrderPayload["deliveryPreference"]>>("DELIVER_TO_ADDRESS");
  const [requestedDeliveryMode, setRequestedDeliveryMode] = useState<string | null>(null);
  const [deliverySelectionsBySeller, setDeliverySelectionsBySeller] = useState<Record<string, DeliveryMode>>({});
  const [customerNote, setCustomerNote] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [businessInvoiceRequested, setBusinessInvoiceRequested] = useState(false);
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerLegalName, setBuyerLegalName] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState<CheckoutAddress>(initialAddress);
  const [formError, setFormError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState(validInitialCouponCode ?? "");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(validInitialCouponCode);
  const [pendingCouponCode, setPendingCouponCode] = useState<string | null>(validInitialCouponCode);
  const [couponFeedback, setCouponFeedback] = useState<CouponFeedback | null>(null);
  const directProductVariantId = searchParams.get("directProductVariantId") ?? undefined;
  const directQuantity = normalizeDirectQuantity(searchParams.get("directQuantity"));
  const isDirectCheckout = Boolean(directProductVariantId);
  const [directSnapshot, setDirectSnapshot] = useState<DirectCheckoutSnapshot | null>(null);

  const cartQuery = useQuery({
    queryKey: ["cart", customerAuth.authKey],
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ["checkout-payment-methods", customerAuth.authKey],
    queryFn: () => getCheckoutPaymentMethods(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const addressesQuery = useQuery({
    queryKey: ["account-addresses", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const savedAddresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const selectedSavedAddress = selectedAddressId
    ? savedAddresses.find((item) => item.id === selectedAddressId)
    : undefined;
  const useSavedAddress = Boolean(selectedSavedAddress);
  const showManualAddress = !useSavedAddress;
  const manualAddressReadyForSummary =
    deliveryPreference !== "STORE_PICKUP" &&
    showManualAddress &&
    hasManualAddressLocationForSummary(manualAddress);
  const checkoutSummaryOptions = useMemo(
    () => ({
      buyerCountryCode: market.countryCode,
      ...(directProductVariantId
        ? { directProductVariantId, directQuantity }
        : {}),
      deliveryPreference,
      ...(requestedDeliveryMode ? { requestedDeliveryMode } : {}),
      ...(Object.keys(deliverySelectionsBySeller).length
        ? {
            deliverySelections: Object.entries(deliverySelectionsBySeller).map(([sellerId, deliveryMode]) => ({
              sellerId,
              deliveryMode,
            })),
          }
        : {}),
      paymentMethod,
      ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
      ...(deliveryPreference !== "STORE_PICKUP" && selectedSavedAddress
        ? { addressId: selectedSavedAddress.id }
        : {}),
      ...(manualAddressReadyForSummary
        ? { shippingAddress: checkoutSummaryAddress(manualAddress) }
        : {}),
    }),
    [appliedCouponCode, deliveryPreference, deliverySelectionsBySeller, requestedDeliveryMode, directProductVariantId, directQuantity, manualAddress, manualAddressReadyForSummary, market.countryCode, paymentMethod, selectedSavedAddress],
  );
  const checkoutSummaryQuery = useQuery({
    queryKey: ["checkout-summary", customerAuth.authKey, checkoutSummaryOptions],
    queryFn: () => getCheckoutSummary(customerAuth.authHeaders, checkoutSummaryOptions),
    enabled:
      customerAuth.enabled &&
      (deliveryPreference === "STORE_PICKUP" || useSavedAddress || manualAddressReadyForSummary),
    retry: false,
  });
  const configuredPaymentOptions = paymentMethodsQuery.data?.methods ?? fallbackPaymentOptions;
  const totals = cartTotals(cartQuery.data);
  const checkoutTotals = {
    itemCount: checkoutSummaryQuery.data?.itemCount ?? totals.itemCount,
    subtotalPaise: checkoutSummaryQuery.data?.subtotalPaise ?? totals.subtotalPaise,
    buyerSubtotalMinor: checkoutSummaryQuery.data?.buyerSubtotalMinor ?? market.convert(totals.subtotalPaise),
    payableSubtotalPaise:
      checkoutSummaryQuery.data?.payableSubtotalPaise ?? checkoutSummaryQuery.data?.subtotalPaise ?? totals.subtotalPaise,
    buyerPayableSubtotalMinor:
      checkoutSummaryQuery.data?.buyerPayableSubtotalMinor ??
      checkoutSummaryQuery.data?.buyerSubtotalMinor ??
      market.convert(totals.subtotalPaise),
    deliveryChargePaise: checkoutSummaryQuery.data?.deliveryChargePaise ?? 0,
    buyerDeliveryChargeMinor: checkoutSummaryQuery.data?.buyerDeliveryChargeMinor ?? 0,
    codSurchargePaise: checkoutSummaryQuery.data?.codSurchargePaise ?? 0,
    buyerCodSurchargeMinor: checkoutSummaryQuery.data?.buyerCodSurchargeMinor ?? 0,
    shippingPaise: checkoutSummaryQuery.data?.shippingPaise ?? 0,
    buyerShippingMinor: checkoutSummaryQuery.data?.buyerShippingMinor ?? 0,
    platformFeePaise: checkoutSummaryQuery.data?.platformFeePaise ?? 0,
    buyerPlatformFeeMinor: checkoutSummaryQuery.data?.buyerPlatformFeeMinor ?? 0,
    couponDiscountPaise: checkoutSummaryQuery.data?.couponDiscountPaise ?? 0,
    buyerCouponDiscountMinor: checkoutSummaryQuery.data?.buyerCouponDiscountMinor ?? 0,
    couponMerchandiseDiscountPaise:
      checkoutSummaryQuery.data?.couponMerchandiseDiscountPaise ?? 0,
    buyerCouponMerchandiseDiscountMinor:
      checkoutSummaryQuery.data?.buyerCouponMerchandiseDiscountMinor ?? 0,
    couponShippingDiscountPaise:
      checkoutSummaryQuery.data?.couponShippingDiscountPaise ?? 0,
    buyerCouponShippingDiscountMinor:
      checkoutSummaryQuery.data?.buyerCouponShippingDiscountMinor ?? 0,
    coupon: checkoutSummaryQuery.data?.coupon ?? null,
    totalPaise: checkoutSummaryQuery.data?.totalPaise ?? totals.subtotalPaise,
    buyerTotalMinor: checkoutSummaryQuery.data?.buyerTotalMinor ?? market.convert(totals.subtotalPaise),
    buyerCurrency: checkoutSummaryQuery.data?.buyerCurrency ?? market.market.currency,
    buyerLocale: market.market.locale,
  };
  const couponIsApplying = Boolean(pendingCouponCode && checkoutSummaryQuery.isFetching);
  const couponApplied = Boolean(appliedCouponCode && checkoutTotals.coupon && !pendingCouponCode);
  const hasCheckoutItem = isDirectCheckout
    ? checkoutTotals.itemCount > 0
    : Boolean(cartQuery.data?.items.length);
  const sellerDeliveryBlockedMessage = checkoutSummaryQuery.data?.sellerDeliveryGroups?.some(
    (group) => !group.availableDeliveryOptions.some((option) => option.available),
  )
    ? "Delivery is not available for one seller package. Change address or remove the item."
    : checkoutSummaryQuery.data?.sellerDeliveryGroups?.some(
          (group) => !deliverySelectionsBySeller[group.sellerId],
        )
      ? "Select delivery for every seller package."
      : null;
  const deliveryServiceabilityError = deliveryPreference === "DELIVER_TO_ADDRESS"
    ? serviceabilityCheckoutError(checkoutSummaryQuery.error)
    : null;
  const checkoutBlockedMessage = deliveryServiceabilityError
    ? deliveryServiceabilityError
    : deliveryPreference === "DELIVER_TO_ADDRESS" && showManualAddress && !manualAddressReadyForSummary
      ? "Enter the delivery pincode or pick the map location to check shipping options."
    : sellerDeliveryBlockedMessage
      ? sellerDeliveryBlockedMessage
    : checkoutSummaryQuery.isError
      ? "We could not confirm the latest checkout total. Please retry before placing the order."
      : null;
  const manualTransportSelectedForCheckout =
    deliveryPreference === "DELIVER_TO_ADDRESS" &&
    (Object.values(deliverySelectionsBySeller).includes("MANUAL_TRANSPORT") ||
      requestedDeliveryMode === "MANUAL_TRANSPORT" ||
      (!checkoutSummaryQuery.data?.sellerDeliveryGroups?.length &&
        !requestedDeliveryMode &&
        checkoutSummaryQuery.data?.availableDeliveryOptions?.some(
          (option) => option.mode === "MANUAL_TRANSPORT" && option.available && option.isCheapest,
        )));

  useEffect(() => {
    const groups = checkoutSummaryQuery.data?.sellerDeliveryGroups ?? [];
    if (!groups.length) {
      return;
    }

    setDeliverySelectionsBySeller((current) => {
      const next: Record<string, DeliveryMode> = {};
      let changed = false;

      for (const group of groups) {
        const availableOptions = group.availableDeliveryOptions.filter((option) => option.available);
        const existing = current[group.sellerId];
        const existingStillAvailable = existing
          ? availableOptions.some((option) => option.mode === existing)
          : false;
        const selected =
          existingStillAvailable
            ? existing
            : availableOptions.find((option) => option.isCheapest)?.mode ?? availableOptions[0]?.mode;

        if (selected) {
          next[group.sellerId] = selected;
        }

        if (current[group.sellerId] !== selected) {
          changed = true;
        }
      }

      if (Object.keys(current).some((sellerId) => !next[sellerId])) {
        changed = true;
      }

      return changed ? next : current;
    });
  }, [checkoutSummaryQuery.data?.sellerDeliveryGroups]);

  useEffect(() => {
    if (!directProductVariantId || typeof window === "undefined") {
      setDirectSnapshot(null);
      return;
    }

    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(directCheckoutStorageKey) ?? "null") as DirectCheckoutSnapshot | null;
      setDirectSnapshot(parsed?.variantId === directProductVariantId ? parsed : null);
    } catch {
      setDirectSnapshot(null);
    }
  }, [directProductVariantId]);

  useEffect(() => {
    if (!pendingCouponCode || checkoutSummaryQuery.isFetching) {
      return;
    }

    if (checkoutSummaryQuery.isSuccess) {
      const appliedCoupon = checkoutSummaryQuery.data?.coupon;
      const appliedCode = appliedCoupon?.code;
      if (appliedCoupon && appliedCode && normalizeCouponCodeInput(appliedCode) === pendingCouponCode) {
        setCouponFeedback({
          tone: "success",
          message: `${appliedCode} applied. ${appliedCoupon.title}`,
        });
      } else {
        setAppliedCouponCode(null);
        setCouponFeedback({
          tone: "danger",
          message: "This coupon is not valid for the items in your cart.",
        });
      }
      setPendingCouponCode(null);
      return;
    }

    if (checkoutSummaryQuery.isError) {
      setAppliedCouponCode(null);
      setPendingCouponCode(null);
      setCouponFeedback({
        tone: "danger",
        message: couponApplyErrorMessage(checkoutSummaryQuery.error),
      });
    }
  }, [
    checkoutSummaryQuery.data?.coupon,
    checkoutSummaryQuery.error,
    checkoutSummaryQuery.isError,
    checkoutSummaryQuery.isFetching,
    checkoutSummaryQuery.isSuccess,
    pendingCouponCode,
  ]);
  const paymentOptions = useMemo(
    () =>
      configuredPaymentOptions.map((option) => {
        if (
          option.method !== "COD" ||
          !option.enabled ||
          !option.maxOrderPaise ||
          checkoutTotals.totalPaise <= option.maxOrderPaise
        ) {
          return option;
        }

        return {
          ...option,
          enabled: false,
          note:
            checkoutTotals.buyerCurrency !== "INR"
              ? `Cash on delivery is available up to ${formatMoney(option.maxOrderPaise)} INR (~${market.format(option.maxOrderPaise)}). Current total is ${formatMoney(checkoutTotals.buyerTotalMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}.`
              : `Cash on delivery is available up to ${formatMoney(option.maxOrderPaise)}. Current total is ${formatMoney(checkoutTotals.totalPaise)}.`,
        };
      }),
    [configuredPaymentOptions, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale, checkoutTotals.buyerTotalMinor, checkoutTotals.totalPaise, market],
  );
  const selectedPaymentOption = paymentOptions.find((option) => option.method === paymentMethod);
  const bankTransferDetails =
    selectedPaymentOption?.method === "BANK_TRANSFER"
      ? selectedPaymentOption.bankTransferDetails
      : undefined;
  const hasEnabledPaymentMethod = paymentOptions.some((option) => option.enabled);

  useEffect(() => {
    if (selectedAddressId !== null || !savedAddresses.length) {
      return;
    }

    const defaultAddress = savedAddresses.find((item) => item.isDefault) ?? savedAddresses[0];
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [savedAddresses, selectedAddressId]);

  useEffect(() => {
    if (!paymentOptions.length) {
      return;
    }

    if (selectedPaymentOption?.enabled) {
      return;
    }

    const firstEnabled = paymentOptions.find((option) => option.enabled);
    if (firstEnabled) {
      setPaymentMethod(firstEnabled.method);
    }
  }, [paymentOptions, selectedPaymentOption]);

  useEffect(() => {
    if (paymentMethod !== "BANK_TRANSFER" && paymentMethod !== "MANUAL") {
      setPaymentReference("");
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (market.countryCode !== "IN") {
      setBusinessInvoiceRequested(false);
    }
  }, [market.countryCode]);

  const orderMutation = useMutation({
    mutationFn: async (manualAddress?: CheckoutAddress) => {
      if (!hasCheckoutItem) {
        throw new Error(isDirectCheckout ? "Selected product is unavailable for checkout." : "Cart is empty.");
      }
      if (checkoutBlockedMessage) {
        throw new Error(checkoutBlockedMessage);
      }
      if (!selectedPaymentOption?.enabled) {
        throw new Error(
          selectedPaymentOption
            ? `${selectedPaymentOption.label} is not available right now.`
            : "Select an available payment method.",
        );
      }
      if (
        paymentMethod === "BANK_TRANSFER" &&
        selectedPaymentOption.bankTransferDetails?.referenceRequired &&
        !paymentReference.trim()
      ) {
        throw new Error("Enter the bank transfer UTR/reference before placing this order.");
      }

      const gstInvoice = businessInvoiceRequested
        ? validateGstInvoiceDetails(buyerGstin, buyerLegalName)
        : null;
      if (businessInvoiceRequested && market.countryCode !== "IN") {
        throw new Error("GST invoices are available only for India billing details.");
      }
      if (gstInvoice?.error) {
        throw new Error(gstInvoice.error);
      }

      const payload: PlaceOrderPayload = {
        deliveryPreference,
        ...(isDeliveryMode(requestedDeliveryMode) ? { deliveryMode: requestedDeliveryMode } : {}),
        ...(Object.keys(deliverySelectionsBySeller).length
          ? {
              deliverySelections: Object.entries(deliverySelectionsBySeller).map(([sellerId, deliveryMode]) => ({
                sellerId,
                deliveryMode,
              })),
            }
          : {}),
        paymentMethod,
        buyerCountryCode: market.countryCode,
        ...(directProductVariantId
          ? { directProductVariantId, directQuantity }
          : {}),
        ...((paymentMethod === "BANK_TRANSFER" || paymentMethod === "MANUAL") &&
        paymentReference.trim()
          ? { paymentReference: paymentReference.trim() }
          : {}),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
        ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
        ...(gstInvoice?.details ?? {}),
      };

      if (deliveryPreference !== "STORE_PICKUP") {
        if (useSavedAddress && selectedSavedAddress) {
          if (manualTransportSelectedForCheckout && !hasAddressCoordinates(selectedSavedAddress)) {
            throw new Error("Add a map pin to this address before using seller-arranged delivery.");
          }
          payload.addressId = selectedSavedAddress.id;
        } else {
          const validation = validateAddress(manualAddress ?? initialAddress);
          if (validation) {
            throw new Error(validation);
          }
          if (manualTransportSelectedForCheckout && !hasAddressCoordinates(manualAddress ?? initialAddress)) {
            throw new Error("Pick the address location on the map before using seller-arranged delivery.");
          }
          payload.shippingAddress = cleanAddress(manualAddress ?? initialAddress);
        }
      }

      const order = await placeOrder(customerAuth.authHeaders, payload);
      if (paymentMethod !== "RAZORPAY") {
        return order;
      }

      let providerOrder;
      try {
        providerOrder = await createRazorpayProviderOrder(
          customerAuth.authHeaders,
          order.orderNumber,
        );
      } catch (error) {
        // Failed to create Razorpay provider order — cancel the placed order
        await cancelRazorpayOrder(customerAuth.authHeaders, order.orderNumber).catch(() => null);
        throw new Error("Could not initiate payment. Order has been cancelled. Please try again.", {
          cause: error,
        });
      }

      const checkoutResponse = await openRazorpayCheckout(providerOrder, `Order ${providerOrder.orderNumber}`);

      if (!checkoutResponse) {
        // User dismissed the Razorpay modal — cancel the order
        await cancelRazorpayOrder(customerAuth.authHeaders, order.orderNumber).catch(() => null);
        throw new Error("Payment was cancelled. Your order has not been placed.");
      }

      try {
        const verification = await verifyRazorpayPayment(customerAuth.authHeaders, {
          razorpayOrderId: checkoutResponse.razorpay_order_id,
          razorpayPaymentId: checkoutResponse.razorpay_payment_id,
          razorpaySignature: checkoutResponse.razorpay_signature,
        });
        return { ...order, paymentStatus: verification.status };
      } catch {
        return order;
      }
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
      router.push(`/checkout/success/${order.orderNumber}`);
    },
    onError: (error) =>
      setFormError(
        appliedCouponCode && error instanceof Error && error.message.toLowerCase().includes("coupon")
          ? couponApplyErrorMessage(error)
          : error instanceof Error
            ? error.message
            : "Unable to place order.",
      ),
  });

  function syncManualAddressFromForm(form: HTMLFormElement) {
    if (showManualAddress) {
      setManualAddress(addressFromForm(new FormData(form)));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const nextManualAddress = addressFromForm(form);
    if (showManualAddress) {
      setManualAddress(nextManualAddress);
    }
    orderMutation.mutate(showManualAddress ? nextManualAddress : undefined);
  }

  function applyCoupon() {
    const code = normalizeCouponCodeInput(couponInput);
    const validation = validateCouponCodeInput(code);

    if (validation) {
      setCouponFeedback(validation);
      setAppliedCouponCode(null);
      setPendingCouponCode(null);
      return;
    }

    setFormError(null);
    setCouponFeedback(null);
    setPendingCouponCode(code);
    setAppliedCouponCode(code);
    setCouponInput(code);
  }

  function removeCoupon() {
    setAppliedCouponCode(null);
    setPendingCouponCode(null);
    setCouponInput("");
    setCouponFeedback(null);
    setFormError(null);
  }

  return (
    <StorefrontFrame>
      <StorefrontPageHeader
        badge="Checkout"
        title="Place order"
        description="Confirm delivery, payment, and market currency before placing your order."
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_380px] lg:px-6">
        <form
          onSubmit={submit}
          onChange={(event) => syncManualAddressFromForm(event.currentTarget)}
          onInput={(event) => syncManualAddressFromForm(event.currentTarget)}
          className="space-y-6"
        >
          <CustomerAuthNotice />

          <StorefrontPanel as="section">
            <StorefrontPanelHeader
              icon={MapPin}
              title="Delivery address"
              description="Choose a saved delivery location or enter a new one."
            />
            {addressesQuery.isLoading ? <StorefrontSkeleton className="mt-5 h-24" /> : null}
            {savedAddresses.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {savedAddresses.map((item) => (
                  <StorefrontOptionCard
                    key={item.id}
                    onClick={() => setSelectedAddressId(item.id)}
                    selected={selectedAddressId === item.id}
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-[#1F2933]">
                      {item.label ?? "Saved address"}
                      {item.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : null}
                    </span>
                    <span className="mt-2 block text-sm font-semibold leading-6 text-[#667085]">
                      {[
                        item.fullName,
                        item.line1,
                        item.area,
                        item.city,
                        item.state,
                        item.pincode,
                        item.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    <span className="mt-1 block text-xs font-bold text-[#667085]">
                      {item.phone}
                    </span>
                    {!hasAddressCoordinates(item) ? (
                      <span className="mt-2 block text-xs font-bold text-[#B45309]">
                        Map pin needed for seller-arranged delivery
                      </span>
                    ) : null}
                  </StorefrontOptionCard>
                ))}
                <StorefrontOptionCard
                  onClick={() => setSelectedAddressId(manualAddressId)}
                  selected={showManualAddress}
                  selectedClassName="border-[#163B5C] bg-[#EAF1F7] text-[#163B5C]"
                  className="text-sm font-black"
                >
                  Use a new address
                </StorefrontOptionCard>
              </div>
            ) : null}
            {addressesQuery.isError ? (
              <StorefrontErrorPanel
                className="mt-5"
                error={addressesQuery.error}
                onRetry={() => void addressesQuery.refetch()}
                retryLabel="Retry addresses"
              />
            ) : null}
            {showManualAddress ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  ["fullName", "Full name"],
                  ["phone", "Phone"],
                  ["line1", "Address line 1"],
                  ["line2", "Address line 2"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className={`space-y-2 ${name === "line1" || name === "line2" ? "md:col-span-2" : ""}`}
                  >
                    <span className={storefrontFieldLabelClassName}>{label}</span>
                    <input
                      name={name}
                      defaultValue={initialAddress[name as keyof CheckoutAddress] ?? ""}
                      className={storefrontInputClassName}
                    />
                  </label>
                ))}
                <div className="md:col-span-2">
                  <LocationFields
                    defaultValue={initialAddress}
                    defaultCountryCode="IN"
                    loadCitiesAcrossCountry
                    className="md:grid-cols-2"
                    labelClassName="space-y-2"
                    inputClassName={storefrontInputClassName}
                    onChange={(location) =>
                      setManualAddress((current) => ({
                        ...current,
                        country: location.country ?? current.country,
                        countryCode: location.countryCode ?? current.countryCode,
                        state: location.state ?? current.state,
                        stateCode: location.stateCode ?? current.stateCode,
                        city: location.city ?? current.city,
                        cityCode: location.cityCode ?? current.cityCode,
                        area: location.area ?? current.area,
                        localAreaCode: location.localAreaCode ?? current.localAreaCode,
                        pincode: location.pincode ?? current.pincode,
                      }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <MapLocationPicker
                    defaultValue={{
                      latitude: initialAddress.latitude,
                      longitude: initialAddress.longitude,
                      locationSource: initialAddress.locationSource,
                      accuracyMeters: initialAddress.accuracyMeters,
                      locationConfidenceScore: initialAddress.locationConfidenceScore,
                    }}
                    authHeaders={customerAuth.authHeaders}
                    disabled={orderMutation.isPending}
                    inputClassName={storefrontInputClassName}
                    onChange={(location) =>
                      setManualAddress((current) => ({
                        ...current,
                        latitude: nullableFiniteNumber(location.latitude) ?? null,
                        longitude: nullableFiniteNumber(location.longitude) ?? null,
                        locationSource: normalizeLocationSource(location.locationSource),
                        accuracyMeters: nullableFiniteNumber(location.accuracyMeters) ?? null,
                        locationConfidenceScore: nullableFiniteNumber(location.locationConfidenceScore) ?? null,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </StorefrontPanel>

          <StorefrontPanel as="section">
            <StorefrontPanelHeader
              icon={Building2}
              iconTone="orange"
              title="Business GST invoice"
              description="Add registered business details to print them on eligible seller tax invoices."
            />
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-4">
              <input
                type="checkbox"
                checked={businessInvoiceRequested}
                onChange={(event) => setBusinessInvoiceRequested(event.target.checked)}
                disabled={market.countryCode !== "IN" || orderMutation.isPending}
                className="mt-0.5 h-4 w-4 rounded border-[#D8E2EA] accent-[#ED3500]"
              />
              <span>
                <span className="block text-sm font-black text-[#1F2933]">
                  Request an invoice with GSTIN
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[#667085]">
                  {market.countryCode === "IN"
                    ? "Use the legal name exactly as registered for this GSTIN."
                    : "Available when the checkout market is India."}
                </span>
              </span>
            </label>
            {businessInvoiceRequested ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={storefrontFieldLabelClassName}>Buyer GSTIN</span>
                  <input
                    value={buyerGstin}
                    onChange={(event) => setBuyerGstin(normalizeGstin(event.target.value))}
                    maxLength={15}
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder="33ABCDE1234F1Z5"
                    className={storefrontInputClassName}
                  />
                  <span className="block text-xs font-semibold text-[#667085]">
                    15-character GST identification number.
                  </span>
                </label>
                <label className="space-y-2">
                  <span className={storefrontFieldLabelClassName}>Registered legal name</span>
                  <input
                    value={buyerLegalName}
                    onChange={(event) => setBuyerLegalName(event.target.value)}
                    maxLength={160}
                    autoComplete="organization"
                    placeholder="Registered business name"
                    className={storefrontInputClassName}
                  />
                  <span className="block text-xs font-semibold text-[#667085]">
                    Printed on each seller invoice for this order.
                  </span>
                </label>
              </div>
            ) : null}
          </StorefrontPanel>

          <StorefrontPanel as="section">
            <StorefrontPanelHeader
              icon={Truck}
              iconTone="orange"
              title="Delivery option"
              description="Choose how you want to receive this order."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {customerDeliveryOptions.map((option) => (
                <StorefrontOptionCard
                  key={option.preference}
                  onClick={() => {
                    setDeliveryPreference(option.preference);
                    setDeliverySelectionsBySeller({});
                    if (option.preference === "STORE_PICKUP") setRequestedDeliveryMode(null);
                  }}
                  selected={deliveryPreference === option.preference}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-[#667085]">
                    {option.description}
                  </span>
                </StorefrontOptionCard>
              ))}
            </div>

            {checkoutSummaryQuery.data?.sellerDeliveryGroups?.length ? (
              <div className="mt-6 border-t border-[#E5E7EB] pt-6">
                <h4 className="mb-4 text-sm font-bold text-[#1F2933]">Select delivery for each seller</h4>
                <div className="grid gap-4">
                  {checkoutSummaryQuery.data.sellerDeliveryGroups.map((group) => {
                    const selectedMode = deliverySelectionsBySeller[group.sellerId];
                    const availableOptions = group.availableDeliveryOptions.filter((option) => option.available);
                    return (
                      <div key={group.sellerId} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-[#1F2933]">{group.sellerName}</p>
                            <p className="text-xs font-semibold text-[#667085]">
                              {group.items.map((item) => item.productName).join(", ")}
                            </p>
                          </div>
                          <StatusBadge tone={availableOptions.length ? "success" : "warning"}>
                            {availableOptions.length ? `${availableOptions.length} options` : "Unavailable"}
                          </StatusBadge>
                        </div>
                        {availableOptions.length ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {availableOptions.map((opt) => {
                              const payableChargePaise = opt.payableChargePaise ?? opt.chargePaise;
                              return (
                                <StorefrontOptionCard
                                  key={opt.mode}
                                  onClick={() =>
                                    setDeliverySelectionsBySeller((current) => ({
                                      ...current,
                                      [group.sellerId]: opt.mode,
                                    }))
                                  }
                                  selected={selectedMode === opt.mode}
                                >
                                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                                    {customerDeliveryModeLabel(opt.mode)}
                                    {opt.isCheapest ? (
                                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                                        Cheapest
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="mt-2 flex items-center gap-2 text-xs font-bold text-[#667085]">
                                    {payableChargePaise < opt.chargePaise ? (
                                      <span className="line-through">{market.format(opt.chargePaise)}</span>
                                    ) : null}
                                    <span className={payableChargePaise < opt.chargePaise ? "text-[#0F8A5F]" : ""}>
                                      {payableChargePaise === 0 ? "Free with coupon" : market.format(payableChargePaise)}
                                    </span>
                                  </span>
                                  {opt.mode === "MANUAL_TRANSPORT" && opt.manualTransport ? (
                                    <ManualTransportOptionMeta option={opt.manualTransport} />
                                  ) : null}
                                </StorefrontOptionCard>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-bold text-[#B42318]">
                            {group.blockedReason ?? "Delivery is not available for this seller package."}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : deliveryPreference === "DELIVER_TO_ADDRESS" && checkoutSummaryQuery.data?.availableDeliveryOptions?.length ? (
              <div className="mt-6 border-t border-[#E5E7EB] pt-6">
                <h4 className="text-sm font-bold text-[#1F2933] mb-4">Select transport method</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {checkoutSummaryQuery.data.availableDeliveryOptions
                    .filter((opt) => opt.mode !== "STORE_PICKUP")
                    .map((opt) => {
                      const payableChargePaise = opt.payableChargePaise ?? opt.chargePaise;
                      return (
                        <StorefrontOptionCard
                          key={opt.mode}
                          onClick={() => {
                            if (opt.available) setRequestedDeliveryMode(opt.mode);
                          }}
                          selected={opt.available && (requestedDeliveryMode === opt.mode || (!requestedDeliveryMode && opt.isCheapest))}
                          className={opt.available ? "" : "opacity-50 cursor-not-allowed"}
                        >
                          <span className="flex items-center justify-between gap-2 text-sm font-black">
                            {customerDeliveryModeLabel(opt.mode)}
                            {!opt.available && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                Unavailable
                              </span>
                            )}
                            {opt.isCheapest && opt.available && (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                                Cheapest
                              </span>
                            )}
                          </span>
                          <span className="mt-2 flex items-center gap-2 text-xs font-bold text-[#667085]">
                            {!opt.available ? (
                              opt.reason || "Delivery unavailable"
                            ) : (
                              <>
                                {payableChargePaise < opt.chargePaise ? (
                                  <span className="line-through">{market.format(opt.chargePaise)}</span>
                                ) : null}
                                <span className={payableChargePaise < opt.chargePaise ? "text-[#0F8A5F]" : ""}>
                                  {payableChargePaise === 0 ? "Free with coupon" : market.format(payableChargePaise)}
                                </span>
                              </>
                            )}
                          </span>
                          {opt.available && opt.mode === "MANUAL_TRANSPORT" && opt.manualTransport ? (
                            <ManualTransportOptionMeta option={opt.manualTransport} />
                          ) : null}
                        </StorefrontOptionCard>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </StorefrontPanel>

          <StorefrontPanel as="section">
            <StorefrontPanelHeader
              icon={CreditCard}
              iconTone="green"
              title="Payment method"
              description="Choose an available payment method for this order."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {paymentOptions.map((option) => (
                <StorefrontOptionCard
                  key={option.method}
                  onClick={() => {
                    if (option.enabled) {
                      setPaymentMethod(option.method);
                    }
                  }}
                  disabled={!option.enabled}
                  selected={paymentMethod === option.method}
                  selectedClassName="border-[#0F8A5F] bg-[#E9F7F1] text-[#064C35]"
                  className="hover:border-[#0F8A5F]"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                    {option.label}
                    <StatusBadge tone={option.enabled ? "success" : "warning"}>
                      {option.enabled ? "Available" : "Off"}
                    </StatusBadge>
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-[#667085]">
                    {option.note}
                  </span>
                  {option.method === "COD" && option.instructions ? (
                    <span className="mt-2 block text-xs font-bold text-[#8A5A00]">
                      {option.instructions}
                    </span>
                  ) : null}
                </StorefrontOptionCard>
              ))}
            </div>
            {paymentMethod === "BANK_TRANSFER" ? (
              <div className="mt-5 rounded-2xl border border-[#C5D8E8] bg-[#F8FAFC] p-4">
                <div className="grid gap-3 text-sm font-semibold text-[#667085] md:grid-cols-2">
                  <BankTransferLine
                    label="Account holder"
                    value={bankTransferDetails?.accountHolderName}
                  />
                  <BankTransferLine label="Bank" value={bankTransferDetails?.bankName} />
                  <BankTransferLine
                    label="Account number"
                    value={bankTransferDetails?.accountNumber}
                  />
                  <BankTransferLine label="IFSC" value={bankTransferDetails?.ifscCode} />
                  <BankTransferLine label="Branch" value={bankTransferDetails?.branch} />
                  <BankTransferLine label="UPI ID" value={bankTransferDetails?.upiId} />
                </div>
                {bankTransferDetails?.instructions || selectedPaymentOption?.instructions ? (
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#1F2933]">
                    {bankTransferDetails?.instructions ?? selectedPaymentOption?.instructions}
                  </p>
                ) : null}
                <label className="mt-4 block space-y-2">
                  <span className={storefrontFieldLabelClassName}>
                    UTR / transfer reference{" "}
                    {bankTransferDetails?.referenceRequired ? "" : "(optional)"}
                  </span>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Enter UTR/reference after transfer"
                    className={`${storefrontInputClassName} bg-white`}
                  />
                </label>
              </div>
            ) : paymentMethod === "MANUAL" ? (
              <label className="mt-5 block space-y-2">
                <span className={storefrontFieldLabelClassName}>Manual payment reference</span>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Reference shared by support or finance"
                  className={storefrontInputClassName}
                />
              </label>
            ) : null}
            {paymentMethodsQuery.isError ? (
              <StorefrontErrorPanel
                className="mt-5"
                error={paymentMethodsQuery.error}
                onRetry={() => void paymentMethodsQuery.refetch()}
                retryLabel="Retry payment methods"
              />
            ) : null}
          </StorefrontPanel>

          <StorefrontPanel as="section">
            <label className="space-y-2">
              <span className={storefrontFieldLabelClassName}>Delivery note</span>
              <textarea
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                rows={4}
                className={storefrontTextareaClassName}
              />
            </label>
          </StorefrontPanel>

          {formError ? <StorefrontNotice tone="danger">{formError}</StorefrontNotice> : null}

          <Button
            type="submit"
            size="lg"
            disabled={
              !customerAuth.enabled ||
              !hasCheckoutItem ||
              Boolean(checkoutBlockedMessage) ||
              !hasEnabledPaymentMethod ||
              orderMutation.isPending
            }
          >
            {orderMutation.isPending
              ? "Placing order"
              : paymentMethod === "RAZORPAY"
                ? "Place order and pay"
                : "Place order"}
          </Button>
        </form>

        <StorefrontPanel as="aside" className="h-fit">
          <h2 className="text-lg font-black text-[#1F2933]">Checkout summary</h2>
          {isDirectCheckout ? (
            <div className="mt-5 rounded-lg border border-[#FAD7CB] bg-[#FFFCFB] p-3">
              <div className="flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-[#EAF1F7]">
                  <StorefrontImage src={directSnapshot?.imageUrl ?? null} alt={directSnapshot?.productName ?? "Selected product"} sizes="80px" fallbackLabel="Item" />
                </div>
                <div className="min-w-0">
                  <StatusBadge tone="success">Direct checkout</StatusBadge>
                  <p className="mt-2 line-clamp-2 text-sm font-black text-[#1F2933]">
                    {directSnapshot?.productName ?? "Selected wishlist product"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#667085]">
                    {directSnapshot?.sellerName ?? "Seller"}{directSnapshot?.variantName ? ` · ${directSnapshot.variantName}` : ""}
                  </p>
                  <p className="mt-2 text-sm font-black text-[#163B5C]">
                    Qty {directQuantity}
                    {directSnapshot ? ` · ${market.format(directSnapshot.pricePaise * directQuantity)}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : cartQuery.isLoading ? (
            <StorefrontSkeleton className="mt-5 h-40" />
          ) : cartQuery.data?.items.length ? (
            <div className="mt-5 space-y-4">
              {cartQuery.data.items.map((item) => {
                const originalUnitPrice =
                  item.originalUnitPricePaise && item.originalUnitPricePaise > item.unitPricePaise
                    ? item.originalUnitPricePaise
                    : item.productVariant.originalPricePaise && item.productVariant.originalPricePaise > item.unitPricePaise
                      ? item.productVariant.originalPricePaise
                      : null;
                const activeDeal = item.activeDeal ?? item.productVariant.activeDeal ?? null;

                return (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 border-b border-[#E5E7EB] pb-3 text-sm"
                  >
                    <div>
                      <span className="font-semibold text-[#667085]">
                        {item.productVariant.product.name} x {item.quantity}
                      </span>
                      <StorefrontProductAttributeChips
                        product={item.productVariant.product}
                        limit={2}
                        variant="inline"
                      />
                      {activeDeal ? (
                        <p className="mt-1 text-xs font-black text-[#ED3500]">{activeDeal.discountBps / 100}% deal applied</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-[#1F2933]">
                        {formatMoney(item.quantity * item.unitPricePaise, item.currency)}
                      </span>
                      {originalUnitPrice ? (
                        <p className="text-xs font-bold text-[#98A2B3] line-through">{formatMoney(item.quantity * originalUnitPrice, item.currency)}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm font-semibold text-[#667085]">Cart is empty.</p>
          )}
          <div className="mt-5 space-y-3 border-t border-[#E5E7EB] pt-5 text-sm font-semibold text-[#667085]">
            <div className="rounded-2xl border border-[#FAD7CB] bg-[#FFFCFB] p-3">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#ED3500]">
                <TicketPercent className="h-4 w-4" />
                Coupon
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  value={couponInput}
                  onChange={(event) => {
                    setCouponInput(event.target.value.toUpperCase());
                    if (!couponIsApplying && couponFeedback?.tone !== "success") {
                      setCouponFeedback(null);
                    }
                  }}
                  placeholder="Enter coupon code"
                  className={`${storefrontInputClassName} h-11 flex-1 bg-white text-sm`}
                  disabled={couponIsApplying || couponApplied}
                />
                {couponApplied ? (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FAD7CB] bg-white text-[#ED3500] transition hover:bg-[#FFF2ED]"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Button type="button" variant="secondary" onClick={applyCoupon} disabled={couponIsApplying}>
                    {couponIsApplying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Applying
                      </>
                    ) : (
                      "Apply"
                    )}
                  </Button>
                )}
              </div>
              {couponFeedback ? (
                <p
                  className={`mt-2 text-xs font-bold ${couponFeedbackClassName(couponFeedback.tone)}`}
                  role={couponFeedback.tone === "danger" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {couponFeedback.message}
                </p>
              ) : null}
            </div>
            <StorefrontSummaryRow label="Items" value={checkoutTotals.itemCount} />
            <StorefrontSummaryRow
              label="Subtotal"
              value={formatMoney(checkoutTotals.buyerSubtotalMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}
            />
            {checkoutTotals.couponMerchandiseDiscountPaise > 0 ? (
              <StorefrontSummaryRow
                label={`Coupon ${checkoutTotals.coupon?.code ?? ""}`.trim()}
                value={`-${formatMoney(checkoutTotals.buyerCouponMerchandiseDiscountMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}`}
              />
            ) : null}
            <StorefrontSummaryRow
              label={
                checkoutTotals.couponShippingDiscountPaise > 0
                  ? `Delivery (${formatMoney(checkoutTotals.buyerCouponShippingDiscountMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)} saved)`
                  : "Delivery"
              }
              value={
                checkoutTotals.deliveryChargePaise === 0
                  ? "FREE"
                  : formatMoney(
                      checkoutTotals.buyerDeliveryChargeMinor,
                      checkoutTotals.buyerCurrency,
                      checkoutTotals.buyerLocale,
                    )
              }
            />
            {checkoutTotals.codSurchargePaise > 0 ? (
              <StorefrontSummaryRow
                label="Cash on delivery fee"
                value={formatMoney(
                  checkoutTotals.buyerCodSurchargeMinor,
                  checkoutTotals.buyerCurrency,
                  checkoutTotals.buyerLocale,
                )}
              />
            ) : null}
            <StorefrontSummaryRow
              label="Platform fee"
              value={formatMoney(checkoutTotals.buyerPlatformFeeMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}
            />
            <StorefrontSummaryRow
              className="border-t border-[#E5E7EB] pt-4 text-base"
              label="Total"
              value={formatMoney(checkoutTotals.buyerTotalMinor, checkoutTotals.buyerCurrency, checkoutTotals.buyerLocale)}
              strong
            />
            {checkoutTotals.buyerCurrency !== "INR" ? (
              <p className="text-xs font-semibold text-[#667085]">
                Base total: {formatMoney(checkoutTotals.totalPaise)}. Final buyer-currency rate is locked by the API when the order is placed.
              </p>
            ) : null}
          </div>
          {cartQuery.isError ? (
            <StorefrontErrorPanel
              className="mt-5"
              error={cartQuery.error}
              onRetry={() => void cartQuery.refetch()}
              retryLabel="Retry cart"
            />
          ) : null}
          {checkoutBlockedMessage && !couponFeedback ? (
            <StorefrontNotice
              tone={deliveryServiceabilityError ? "warning" : "danger"}
              className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{checkoutBlockedMessage}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void checkoutSummaryQuery.refetch()}>
                <Loader2 className={checkoutSummaryQuery.isFetching ? "h-4 w-4 animate-spin" : "hidden"} aria-hidden="true" />
                Retry delivery check
              </Button>
            </StorefrontNotice>
          ) : null}
        </StorefrontPanel>
      </section>
    </StorefrontFrame>
  );
}

function ManualTransportOptionMeta({ option }: { option: CheckoutManualTransportOption }) {
  const details = [
    typeof option.distanceKm === "number" ? `${option.distanceKm.toFixed(2)} km from seller` : null,
    typeof option.freeDistanceKm === "number" ? `${option.freeDistanceKm} km free` : null,
    typeof option.billableKm === "number" ? `${option.billableKm} km billed` : null,
  ].filter(Boolean);

  return (
    <span className="mt-2 block text-xs font-semibold leading-5 text-[#9A3412]">
      {details.join(" | ")}
      {option.note ? <span className="block text-[#667085]">{option.note}</span> : null}
    </span>
  );
}

function BankTransferLine({ label, value }: { label: string; value?: string | undefined }) {
  if (!value?.trim()) {
    return null;
  }

  return (
    <p>
      {label}: <span className="font-black text-[#1F2933]">{value}</span>
    </p>
  );
}

function cleanAddress(address: CheckoutAddress): CheckoutAddress {
  return {
    fullName: address.fullName.trim(),
    phone: address.phone.trim(),
    line1: address.line1.trim(),
    ...(address.line2?.trim() ? { line2: address.line2.trim() } : {}),
    ...(address.area?.trim() ? { area: address.area.trim() } : {}),
    city: address.city.trim(),
    state: address.state.trim(),
    pincode: address.pincode.trim(),
    country: address.country?.trim(),
    countryCode: address.countryCode?.trim().toUpperCase(),
    stateCode: address.stateCode?.trim(),
    cityCode: address.cityCode?.trim(),
    localAreaCode: address.localAreaCode?.trim(),
    ...coordinatePairFromValues(address.latitude, address.longitude),
    locationSource: address.locationSource ?? null,
    accuracyMeters: nullableFiniteNumber(address.accuracyMeters),
    locationConfidenceScore: nullableFiniteNumber(address.locationConfidenceScore),
  };
}

function checkoutSummaryAddress(address: CheckoutAddress): NonNullable<CheckoutSummaryOptions["shippingAddress"]> {
  const coordinates = coordinatePairFromValues(address.latitude, address.longitude);

  return {
    countryCode: address.countryCode?.trim().toUpperCase() || undefined,
    stateCode: address.stateCode?.trim() || undefined,
    cityCode: address.cityCode?.trim() || undefined,
    pincode: address.pincode?.trim() || undefined,
    localAreaCode: address.localAreaCode?.trim() || undefined,
    ...(typeof coordinates.latitude === "number" && typeof coordinates.longitude === "number"
      ? {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }
      : {}),
    locationSource: address.locationSource ?? undefined,
    accuracyMeters: nullableFiniteNumber(address.accuracyMeters) ?? undefined,
    locationConfidenceScore: nullableFiniteNumber(address.locationConfidenceScore) ?? undefined,
  };
}

function hasManualAddressLocationForSummary(address: CheckoutAddress) {
  const summaryAddress = checkoutSummaryAddress(address);
  return Boolean(
    summaryAddress.countryCode &&
      (summaryAddress.localAreaCode ||
        summaryAddress.pincode ||
        (typeof summaryAddress.latitude === "number" && typeof summaryAddress.longitude === "number")),
  );
}

function validateAddress(address: CheckoutAddress) {
  const next = cleanAddress(address);

  if (next.fullName.length < 2) {
    return "Full name is required.";
  }
  if (!/^\+?[0-9][0-9\s()-]{6,24}$/.test(next.phone)) {
    return "Enter a valid phone number.";
  }
  if (next.line1.length < 3 || next.city.length < 2 || next.state.length < 2 || !next.countryCode) {
    return "Complete delivery address is required.";
  }
  if (!next.pincode && next.countryCode !== "AE") {
    return "Postal code is required.";
  }

  return null;
}

function hasAddressCoordinates(address: {
  latitude?: number | string | null | undefined;
  longitude?: number | string | null | undefined;
}) {
  const latitude = nullableFiniteNumber(address.latitude);
  const longitude = nullableFiniteNumber(address.longitude);

  return typeof latitude === "number" && typeof longitude === "number";
}

function normalizeLocationSource(value: string | null | undefined): CheckoutAddress["locationSource"] {
  return value === "GPS" || value === "MAP_PICK" || value === "MANUAL" || value === "REVERSE_GEOCODE"
    ? value
    : null;
}

function isDeliveryMode(value: string | null): value is DeliveryMode {
  return (
    value === "STORE_PICKUP" ||
    value === "LOCAL_DELIVERY_PARTNER" ||
    value === "THIRD_PARTY_COURIER" ||
    value === "MANUAL_TRANSPORT"
  );
}

function addressFromForm(form: FormData): CheckoutAddress {
  const coordinates = nullableCoordinatePair(form);

  return {
    fullName: formValue(form, "fullName"),
    phone: formValue(form, "phone"),
    line1: formValue(form, "line1"),
    line2: optionalFormValue(form, "line2"),
    area: optionalFormValue(form, "area"),
    city: formValue(form, "city"),
    state: formValue(form, "state"),
    pincode: formValue(form, "pincode"),
    country: optionalFormValue(form, "country"),
    countryCode: formValue(form, "countryCode"),
    stateCode: formValue(form, "stateCode"),
    cityCode: formValue(form, "cityCode"),
    localAreaCode: optionalFormValue(form, "localAreaCode"),
    ...coordinates,
    locationSource: nullableFormValue(form, "locationSource") as CheckoutAddress["locationSource"],
    accuracyMeters: nullableNumberValue(form, "accuracyMeters"),
    locationConfidenceScore: nullableNumberValue(form, "locationConfidenceScore"),
  };
}

function formValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalFormValue(form: FormData, key: string) {
  const value = formValue(form, key);
  return value || undefined;
}

function nullableFormValue(form: FormData, key: string) {
  if (!form.has(key)) {
    return undefined;
  }

  return optionalFormValue(form, key) ?? null;
}

function nullableCoordinatePair(form: FormData) {
  const latitude = nullableNumberValue(form, "latitude");
  const longitude = nullableNumberValue(form, "longitude");

  if (latitude === undefined && longitude === undefined) {
    return {};
  }

  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }

  return { latitude: null, longitude: null };
}

function nullableNumberValue(form: FormData, key: string) {
  if (!form.has(key)) {
    return undefined;
  }

  const value = optionalFormValue(form, key);
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function coordinatePairFromValues(
  rawLatitude: number | string | null | undefined,
  rawLongitude: number | string | null | undefined,
) {
  const latitude = nullableFiniteNumber(rawLatitude);
  const longitude = nullableFiniteNumber(rawLongitude);

  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }

  if (latitude === undefined && longitude === undefined) {
    return {};
  }

  return { latitude: null, longitude: null };
}

function nullableFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDirectQuantity(value: string | null) {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, 99);
}

function serviceabilityCheckoutError(error: unknown) {
  if (!(error instanceof IndihubApiError) || error.status !== 400) {
    return null;
  }

  const message = error.message.trim();
  const normalized = message.toLowerCase();
  if (
    !normalized.includes("not serviceable") &&
    !normalized.includes("delivery is not available") &&
    !normalized.includes("could not calculate seller-arranged delivery distance") &&
    !normalized.includes("map location is required") &&
    !normalized.includes("seller-collected delivery and courier/partner delivery")
  ) {
    return null;
  }

  if (normalized.includes("seller-collected delivery and courier/partner delivery")) {
    return "This COD cart has products with different cash-collection delivery types. Please place separate orders for these products.";
  }

  if (normalized.includes("map location") || normalized.includes("seller-arranged")) {
    return "Seller-arranged delivery needs an exact map location. Pick the address location on the map, or choose another delivery method.";
  }

  return "Delivery is not available for this address yet. Check the pincode/map location, choose another address, or select store pickup if available.";
}
