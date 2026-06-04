"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CreditCard, MapPin, Truck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { LocationFields } from "@/components/locations/location-fields";
import { useMarket } from "@/components/market/market-context";
import { listCustomerAddresses } from "@/lib/account-api";
import { customerDeliveryOptions } from "@/lib/delivery-labels";
import {
  cartTotals,
  createRazorpayProviderOrder,
  formatMoney,
  getCart,
  getCheckoutSummary,
  getCheckoutPaymentMethods,
  placeOrder,
  verifyRazorpayPayment,
  type CheckoutAddress,
  type CheckoutPaymentMethodRecord,
  type RazorpayOrderResponse,
  type PlaceOrderPayload,
} from "@/lib/storefront-api";
import { StorefrontFrame } from "./storefront-frame";
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

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    description?: string;
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal: {
    ondismiss: () => void;
  };
  theme: {
    color: string;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (eventName: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

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

export function CheckoutPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const market = useMarket();
  const [paymentMethod, setPaymentMethod] = useState<PlaceOrderPayload["paymentMethod"]>("COD");
  const [deliveryPreference, setDeliveryPreference] =
    useState<NonNullable<PlaceOrderPayload["deliveryPreference"]>>("DELIVER_TO_ADDRESS");
  const [customerNote, setCustomerNote] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
  const checkoutSummaryOptions = useMemo(
    () => ({
      buyerCountryCode: market.countryCode,
      deliveryPreference,
      paymentMethod,
      ...(deliveryPreference !== "STORE_PICKUP" && selectedSavedAddress
        ? { addressId: selectedSavedAddress.id }
        : {}),
    }),
    [deliveryPreference, market.countryCode, paymentMethod, selectedSavedAddress],
  );
  const checkoutSummaryQuery = useQuery({
    queryKey: ["checkout-summary", customerAuth.authKey, checkoutSummaryOptions],
    queryFn: () => getCheckoutSummary(customerAuth.authHeaders, checkoutSummaryOptions),
    enabled: customerAuth.enabled,
    retry: false,
  });
  const configuredPaymentOptions = paymentMethodsQuery.data?.methods ?? fallbackPaymentOptions;
  const totals = cartTotals(cartQuery.data);
  const checkoutTotals = {
    itemCount: checkoutSummaryQuery.data?.itemCount ?? totals.itemCount,
    subtotalPaise: checkoutSummaryQuery.data?.subtotalPaise ?? totals.subtotalPaise,
    shippingPaise: checkoutSummaryQuery.data?.shippingPaise ?? 0,
    platformFeePaise: checkoutSummaryQuery.data?.platformFeePaise ?? 0,
    totalPaise: checkoutSummaryQuery.data?.totalPaise ?? totals.subtotalPaise,
  };
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
          note: `Cash on delivery is available up to ${formatMoney(option.maxOrderPaise)}. Current total is ${formatMoney(checkoutTotals.totalPaise)}.`,
        };
      }),
    [configuredPaymentOptions, checkoutTotals.totalPaise],
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

  const orderMutation = useMutation({
    mutationFn: async (manualAddress?: CheckoutAddress) => {
      if (!cartQuery.data?.items.length) {
        throw new Error("Cart is empty.");
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

      const payload: PlaceOrderPayload = {
        deliveryPreference,
        paymentMethod,
        buyerCountryCode: market.countryCode,
        ...((paymentMethod === "BANK_TRANSFER" || paymentMethod === "MANUAL") &&
        paymentReference.trim()
          ? { paymentReference: paymentReference.trim() }
          : {}),
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
      };

      if (useSavedAddress && selectedSavedAddress) {
        payload.addressId = selectedSavedAddress.id;
      } else {
        const validation = validateAddress(manualAddress ?? initialAddress);
        if (validation) {
          throw new Error(validation);
        }
        payload.shippingAddress = cleanAddress(manualAddress ?? initialAddress);
      }

      const order = await placeOrder(customerAuth.authHeaders, payload);
      if (paymentMethod !== "RAZORPAY") {
        return order;
      }

      try {
        const providerOrder = await createRazorpayProviderOrder(
          customerAuth.authHeaders,
          order.orderNumber,
        );
        const checkoutResponse = await openRazorpayCheckout(providerOrder);
        if (!checkoutResponse) {
          return order;
        }

        const verification = await verifyRazorpayPayment(customerAuth.authHeaders, {
          razorpayOrderId: checkoutResponse.razorpay_order_id,
          razorpayPaymentId: checkoutResponse.razorpay_payment_id,
          razorpaySignature: checkoutResponse.razorpay_signature,
        });

        return { ...order, paymentStatus: verification.status };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Razorpay payment could not be completed.";
        setFormError(`Order ${order.orderNumber} was placed, but ${message}`);
        return order;
      }
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["cart", customerAuth.authKey] });
      router.push(`/checkout/success/${order.orderNumber}`);
    },
    onError: (error) =>
      setFormError(error instanceof Error ? error.message : "Unable to place order."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    orderMutation.mutate(showManualAddress ? addressFromForm(form) : undefined);
  }

  return (
    <StorefrontFrame>
      <StorefrontPageHeader
        badge="Checkout"
        title="Place order"
        description="Confirm delivery, payment, and market currency before placing your order."
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_380px] lg:px-6">
        <form onSubmit={submit} className="space-y-6">
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
                  />
                </div>
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
                  onClick={() => setDeliveryPreference(option.preference)}
                  selected={deliveryPreference === option.preference}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-[#667085]">
                    {option.description}
                  </span>
                </StorefrontOptionCard>
              ))}
            </div>
          </StorefrontPanel>

          <StorefrontPanel as="section">
            <StorefrontPanelHeader
              icon={CreditCard}
              iconTone="green"
              title="Payment method"
              description="Backend settings decide which methods can place orders."
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
              !cartQuery.data?.items.length ||
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
          {cartQuery.isLoading ? (
            <StorefrontSkeleton className="mt-5 h-40" />
          ) : cartQuery.data?.items.length ? (
            <div className="mt-5 space-y-4">
              {cartQuery.data.items.map((item) => (
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
                  </div>
                  <span className="font-black text-[#1F2933]">
                    {market.format(item.quantity * item.unitPricePaise)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm font-semibold text-[#667085]">Cart is empty.</p>
          )}
          <div className="mt-5 space-y-3 border-t border-[#E5E7EB] pt-5 text-sm font-semibold text-[#667085]">
            <StorefrontSummaryRow label="Items" value={checkoutTotals.itemCount} />
            <StorefrontSummaryRow
              label="Subtotal"
              value={market.format(checkoutTotals.subtotalPaise)}
            />
            <StorefrontSummaryRow
              label="Shipping"
              value={market.format(checkoutTotals.shippingPaise)}
            />
            <StorefrontSummaryRow
              label="Platform fee"
              value={market.format(checkoutTotals.platformFeePaise)}
            />
            <StorefrontSummaryRow
              className="border-t border-[#E5E7EB] pt-4 text-base"
              label="Total"
              value={market.format(checkoutTotals.totalPaise)}
              strong
            />
            {market.market.currency !== "INR" ? (
              <p className="text-xs font-semibold text-[#667085]">
                Base total: {formatMoney(checkoutTotals.totalPaise)}. Final rate is locked by the
                API when the order is placed.
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
          {checkoutSummaryQuery.isError ? (
            <StorefrontErrorPanel
              className="mt-5"
              error={checkoutSummaryQuery.error}
              onRetry={() => void checkoutSummaryQuery.refetch()}
              retryLabel="Retry totals"
            />
          ) : null}
        </StorefrontPanel>
      </section>
    </StorefrontFrame>
  );
}

async function openRazorpayCheckout(providerOrder: RazorpayOrderResponse) {
  await loadRazorpayScript();
  const Razorpay = window.Razorpay;

  if (!Razorpay) {
    throw new Error("Razorpay Checkout could not be loaded.");
  }

  return new Promise<RazorpaySuccessResponse | null>((resolve, reject) => {
    const checkout = new Razorpay({
      key: providerOrder.keyId,
      amount: providerOrder.amountPaise,
      currency: providerOrder.currency,
      name: "1HandIndia",
      description: `Order ${providerOrder.orderNumber}`,
      order_id: providerOrder.razorpayOrderId,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => resolve(null),
      },
      theme: {
        color: "#ED3500",
      },
    });

    checkout.on("payment.failed", (response) => {
      reject(new Error(response.error?.description ?? "Razorpay payment failed."));
    });
    checkout.open();
  });
}

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only run in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Unable to load Razorpay Checkout.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Unable to load Razorpay Checkout.")),
        { once: true },
      );
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
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
  };
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

function addressFromForm(form: FormData): CheckoutAddress {
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
