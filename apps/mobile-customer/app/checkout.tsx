import {
  BankIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  DeliveryBox01Icon,
  Home01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../src/components/empty-state";
import { MobileAddressForm, emptyMobileAddressForm } from "../src/components/mobile-address-form";
import { Screen } from "../src/components/screen";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { formatMoney, useMobileMarket } from "../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../src/features/maintenance/mobile-maintenance-gate";
import { checkoutPaymentOptions, type CheckoutPaymentOption } from "../src/features/storefront/checkout-payment-options";
import {
  assertCheckoutCartReady,
  cleanCheckoutAddressForm,
  cleanCheckoutCustomerNote,
  cleanCheckoutPaymentReference,
  checkoutCartSignature,
} from "../src/features/storefront/checkout-validation";
import {
  RAZORPAY_CHECKOUT_CANCELLED_ERROR,
  RAZORPAY_CHECKOUT_TIMEOUT_ERROR,
  isPaidRazorpayStatus,
  isRazorpayActionInFlight,
  razorpayStatusRetryMessage,
  recoverPendingRazorpayPayment,
  runMobileRazorpayPayment,
  type MobileRazorpayPaymentStage,
} from "../src/features/storefront/razorpay-payment";
import {
  createCustomerAddress,
  getCart,
  getCheckoutPaymentMethods,
  getCheckoutSummary,
  listCustomerOrders,
  listCustomerAddresses,
  placeOrder,
  type MobileCheckoutSummary,
  type MobileCartSummary,
  type MobileCustomerAddress,
  type MobileCustomerAddressPayload,
  type MobileDeliveryPreference,
  type MobileOrderSummary,
  type MobilePaymentMethod,
} from "../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../src/lib/image-url";
import { MobileApiError } from "../src/lib/api";
import { useLocationStore } from "../src/state/location-store";
import { colors } from "../src/theme";

type CheckoutFeedItem =
  | { id: "items"; type: "items" }
  | { id: "address"; type: "address" }
  | { id: "delivery"; type: "delivery" }
  | { id: "payment"; type: "payment" }
  | { id: "reference"; type: "reference" }
  | { id: "summary"; type: "summary" };

type CheckoutPaymentIssue = {
  buyerCurrency?: string | null | undefined;
  buyerTotalMinor?: number | null | undefined;
  orderNumber: string;
  totalPaise: number;
  currency: string;
  message: string;
};

type CheckoutOrderSuccessSnapshot = {
  buyerCurrency?: string | null | undefined;
  buyerTotalMinor?: number | null | undefined;
  orderNumber: string;
  totalPaise: number;
  currency: string;
  paymentStatus: string;
};

type CheckoutOrderResult = {
  order: MobileOrderSummary;
  paymentIssue?: string;
};

type CheckoutStepStatus = "complete" | "active" | "pending";

const feedItems: CheckoutFeedItem[] = [
  { id: "items", type: "items" },
  { id: "address", type: "address" },
  { id: "delivery", type: "delivery" },
  { id: "payment", type: "payment" },
  { id: "reference", type: "reference" },
  { id: "summary", type: "summary" },
];

function CheckoutScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const selectedBrowsingLocation = useLocationStore((state) => state.selectedLocation);
  const cartQueryKey = useMemo(() => ["mobile-cart", customerAuth.authKey] as const, [customerAuth.authKey]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryPreference, setDeliveryPreference] = useState<MobileDeliveryPreference>("DELIVER_TO_ADDRESS");
  const [paymentMethod, setPaymentMethod] = useState<MobilePaymentMethod>("COD");
  const [paymentReference, setPaymentReference] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [addressForm, setAddressForm] = useState<MobileCustomerAddressPayload>(() => emptyMobileAddressForm({ isDefault: true }));
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [paymentIssue, setPaymentIssue] = useState<CheckoutPaymentIssue | null>(null);
  const [paymentProgressText, setPaymentProgressText] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const orderIdempotencyRef = useRef<{ cartSignature: string; key: string } | null>(null);
  const paymentRecoveryAuthKeyRef = useRef<string | null>(null);
  const orderMutationResetRef = useRef<() => void>(() => undefined);
  const retryPaymentMutationResetRef = useRef<() => void>(() => undefined);
  const createAddressMutationResetRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      orderMutationResetRef.current();
      retryPaymentMutationResetRef.current();
      createAddressMutationResetRef.current();
    };
  }, []);

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: () => getCart(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    initialData: () => queryClient.getQueryData<MobileCartSummary>(cartQueryKey),
    refetchOnMount: "always",
    staleTime: 0,
  });
  const addressesQuery = useQuery({
    queryKey: ["mobile-account-addresses", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const paymentMethodsQuery = useQuery({
    queryKey: ["mobile-checkout-payment-methods", customerAuth.authKey],
    queryFn: () => getCheckoutPaymentMethods(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);
  const selectedAddress = selectedAddressId ? addresses.find((address) => address.id === selectedAddressId) : undefined;
  const buyerCountryCode = normalizeCheckoutCountryCode(selectedAddress?.countryCode ?? selectedBrowsingLocation.countryCode ?? "IN");
  const market = useMobileMarket(buyerCountryCode);
  const paymentOptions = useMemo(
    () => checkoutPaymentOptions(paymentMethodsQuery.data, paymentMethodsQuery.isError),
    [paymentMethodsQuery.data, paymentMethodsQuery.isError],
  );
  const enabledMethods = useMemo(() => paymentOptions.filter((method) => method.enabled), [paymentOptions]);
  const checkoutSummaryQuery = useQuery({
    queryKey: ["mobile-checkout-summary", customerAuth.authKey, selectedAddressId, deliveryPreference, paymentMethod, buyerCountryCode],
    queryFn: () =>
      getCheckoutSummary(customerAuth.authHeaders, {
        buyerCountryCode,
        deliveryPreference,
        paymentMethod,
        addressId: deliveryPreference === "DELIVER_TO_ADDRESS" ? selectedAddressId : null,
      }),
    enabled: customerAuth.enabled && (deliveryPreference === "STORE_PICKUP" || Boolean(selectedAddressId)),
    retry: false,
  });
  const cartItems = cartQuery.data?.items ?? [];
  const localSubtotal = cartItems.reduce((total, item) => total + item.quantity * (item.unitPricePaise ?? item.productVariant?.pricePaise ?? 0), 0);
  const summary = checkoutSummaryQuery.data ?? fallbackSummary(cartItems.length, localSubtotal);
  const selectedPayment = enabledMethods.find((method) => method.method === paymentMethod);
  const needsReference = paymentMethod === "BANK_TRANSFER" || paymentMethod === "MANUAL";
  const bankReferenceRequired =
    selectedPayment?.method === "BANK_TRANSFER" && selectedPayment.bankTransferDetails?.referenceRequired !== false;
  const paymentReferenceValidationError = useMemo(
    () => validationMessage(() => cleanCheckoutPaymentReference(paymentReference, { required: Boolean(bankReferenceRequired) })),
    [bankReferenceRequired, paymentReference],
  );
  const customerNoteValidationError = useMemo(
    () => validationMessage(() => cleanCheckoutCustomerNote(customerNote)),
    [customerNote],
  );
  const paymentMethodsError =
    paymentMethodsQuery.error instanceof Error ? paymentMethodsQuery.error.message : paymentMethodsQuery.isError ? "Payment methods could not load." : "";
  const deliveryServiceabilityError = deliveryPreference === "DELIVER_TO_ADDRESS"
    ? serviceabilityCheckoutError(checkoutSummaryQuery.error)
    : "";
  const summaryError =
    deliveryServiceabilityError ||
    (checkoutSummaryQuery.error instanceof Error ? checkoutSummaryQuery.error.message : checkoutSummaryQuery.isError ? "Checkout totals could not load." : "");
  const checkoutDataBlockedReason =
    paymentMethodsError ||
    (deliveryPreference === "DELIVER_TO_ADDRESS" && !selectedAddress
      ? "Select or add a delivery address."
      : !selectedPayment
        ? "Select an available payment method."
        : paymentReferenceValidationError
          ? paymentReferenceValidationError
          : customerNoteValidationError
            ? customerNoteValidationError
            : checkoutSummaryQuery.isFetching
              ? "Refreshing checkout totals..."
              : summaryError);

  const createAddressMutation = useMutation({
    mutationFn: () => createCustomerAddress(customerAuth.authHeaders, cleanCheckoutAddressForm(addressForm, { isDefaultFallback: true })),
    onSuccess: async (address) => {
      setSelectedAddressId(address.id);
      setAddressForm(emptyMobileAddressForm({ isDefault: true }));
      setAddressFormOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-account-addresses", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-checkout-summary", customerAuth.authKey] }),
      ]);
    },
  });
  const placeOrderBlockedReason = createAddressMutation.isPending ? "Saving delivery address..." : checkoutDataBlockedReason;

  useEffect(() => {
    if (selectedAddressId || !addresses.length) {
      return;
    }

    const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
    if (defaultAddress) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (!enabledMethods.length || enabledMethods.some((method) => method.method === paymentMethod)) {
      return;
    }

    setPaymentMethod(enabledMethods[0]?.method ?? "COD");
  }, [enabledMethods, paymentMethod]);

  useEffect(() => {
    orderIdempotencyRef.current = null;
  }, [customerAuth.authKey]);

  function setRazorpayStageText(stage: MobileRazorpayPaymentStage) {
    setPaymentProgressTextIfMounted(
      stage === "provider-order"
        ? "Starting secure payment..."
        : stage === "verification"
          ? "Verifying payment..."
          : "Opening Razorpay...",
    );
  }

  function setPaymentProgressTextIfMounted(value: string | null) {
    if (mountedRef.current) {
      setPaymentProgressText(value);
    }
  }

  function setPaymentIssueIfMounted(value: CheckoutPaymentIssue | null) {
    if (mountedRef.current) {
      setPaymentIssue(value);
    }
  }

  function replaceWithOrderSuccessIfMounted(order: CheckoutOrderSuccessSnapshot) {
    if (!mountedRef.current) {
      return;
    }

    const params = successRouteParams({
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      totalPaise: String(order.totalPaise),
      ...(order.buyerCurrency ? { buyerCurrency: order.buyerCurrency } : {}),
      ...(typeof order.buyerTotalMinor === "number" ? { buyerTotalMinor: String(order.buyerTotalMinor) } : {}),
    });

    router.replace(`/checkout/success/${encodeURIComponent(order.orderNumber)}?${params}` as never);
  }

  function getOrderIdempotencyKey(cart: MobileCartSummary) {
    const cartSignature = checkoutCartSignature(cart);
    if (orderIdempotencyRef.current?.cartSignature === cartSignature) {
      return orderIdempotencyRef.current.key;
    }

    const key = createMobileOrderIdempotencyKey(cart.id);
    orderIdempotencyRef.current = { cartSignature, key };
    return key;
  }

  async function invalidateCheckoutState(orderNumber?: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: cartQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["mobile-cart-count", customerAuth.authKey] }),
      queryClient.invalidateQueries({ queryKey: ["mobile-orders", customerAuth.authKey] }),
      ...(orderNumber ? [queryClient.invalidateQueries({ queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber] })] : []),
    ]);
  }

  const orderMutation = useMutation({
    mutationFn: async (): Promise<CheckoutOrderResult> => {
      setPaymentIssueIfMounted(null);
      setPaymentProgressTextIfMounted("Placing order...");
      const latestCart = await queryClient.fetchQuery({
        queryKey: cartQueryKey,
        queryFn: () => getCart(customerAuth.authHeaders),
        staleTime: 0,
      });

      assertCheckoutCartReady(latestCart, cartQuery.data);
      if (deliveryPreference === "DELIVER_TO_ADDRESS" && !selectedAddress) {
        throw new Error("Select a delivery address before placing the order.");
      }
      if (!selectedPayment) {
        throw new Error("Select an available payment method.");
      }
      if (bankReferenceRequired && !paymentReference.trim()) {
        throw new Error("Enter the bank transfer reference or UTR.");
      }
      if (checkoutSummaryQuery.isError) {
        throw new Error(summaryError || "Checkout totals could not load. Please retry before placing the order.");
      }
      if (checkoutSummaryQuery.isFetching) {
        throw new Error("Refreshing checkout totals. Try again in a moment.");
      }

      const cleanedPaymentReference = cleanCheckoutPaymentReference(paymentReference, { required: Boolean(bankReferenceRequired) });
      const cleanedCustomerNote = cleanCheckoutCustomerNote(customerNote);

      const order = await placeOrder(customerAuth.authHeaders, {
        buyerCountryCode,
        deliveryPreference,
        idempotencyKey: getOrderIdempotencyKey(latestCart),
        paymentMethod,
        ...(deliveryPreference === "DELIVER_TO_ADDRESS" && selectedAddress ? { addressId: selectedAddress.id } : {}),
        ...(needsReference && cleanedPaymentReference ? { paymentReference: cleanedPaymentReference } : {}),
        ...(cleanedCustomerNote ? { customerNote: cleanedCustomerNote } : {}),
      });

      if (paymentMethod !== "RAZORPAY") {
        return { order };
      }

      try {
        const verification = await runMobileRazorpayPayment({
          auth: customerAuth.authHeaders,
          orderNumber: order.orderNumber,
          prefill: customerAuth.userProfile,
          onStageChange: setRazorpayStageText,
        });

        if (!isPaidRazorpayStatus(verification.status)) {
          return {
            order: { ...order, paymentStatus: verification.status },
            paymentIssue: razorpayStatusRetryMessage(verification.status),
          };
        }

        return { order: { ...order, paymentStatus: verification.status } };
      } catch (error) {
        return {
          order,
          paymentIssue: error instanceof Error ? error.message : "Order placed, but online payment was not completed.",
        };
      }
    },
    onSuccess: async (result) => {
      setPaymentProgressTextIfMounted(null);
      orderIdempotencyRef.current = null;
      if (!mountedRef.current) {
        return;
      }

      if (result.paymentIssue) {
        setPaymentIssueIfMounted({
          orderNumber: result.order.orderNumber,
          buyerCurrency: result.order.buyerCurrency,
          buyerTotalMinor: result.order.buyerTotalMinor,
          totalPaise: result.order.totalPaise,
          currency: result.order.currency,
          message: result.paymentIssue,
        });
        void invalidateCheckoutState(result.order.orderNumber).catch(() => undefined);
        return;
      }

      setPaymentIssueIfMounted(null);
      replaceWithOrderSuccessIfMounted(result.order);
      void invalidateCheckoutState(result.order.orderNumber).catch(() => undefined);
    },
    onError: async (error) => {
      setPaymentProgressTextIfMounted(null);
      if (!isRecoverableOrderPlacementError(error)) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["mobile-cart-count", customerAuth.authKey] }),
      ]);

      const recoveredOrder = await recoverRecentlyPlacedOrder(customerAuth.authHeaders, summary.totalPaise, {
        attempts: isCartEmptyError(error) ? 1 : 4,
        delayMs: 900,
      });
      if (recoveredOrder && mountedRef.current) {
        orderIdempotencyRef.current = null;
        setPaymentIssueIfMounted(null);
        replaceWithOrderSuccessIfMounted(recoveredOrder);
        await queryClient.invalidateQueries({ queryKey: ["mobile-orders", customerAuth.authKey] });
      }
    },
  });
  const retryPaymentMutation = useMutation({
    mutationFn: async (issue: CheckoutPaymentIssue) => {
      const verification = await runMobileRazorpayPayment({
        auth: customerAuth.authHeaders,
        orderNumber: issue.orderNumber,
        prefill: customerAuth.userProfile,
        onStageChange: setRazorpayStageText,
      });

      if (!isPaidRazorpayStatus(verification.status)) {
        throw new Error(razorpayStatusRetryMessage(verification.status));
      }

      return issue;
    },
    onSuccess: async (issue) => {
      setPaymentProgressTextIfMounted(null);
      setPaymentIssueIfMounted(null);
      replaceWithOrderSuccessIfMounted({
        orderNumber: issue.orderNumber,
        buyerCurrency: issue.buyerCurrency,
        buyerTotalMinor: issue.buyerTotalMinor,
        totalPaise: issue.totalPaise,
        currency: issue.currency,
        paymentStatus: "PAID",
      });
      void invalidateCheckoutState(issue.orderNumber).catch(() => undefined);
    },
    onError: async (error, issue) => {
      setPaymentProgressTextIfMounted(null);
      await invalidateCheckoutState(issue.orderNumber);
      setPaymentIssueIfMounted({
        ...issue,
        message: error instanceof Error ? error.message : "Order placed, but online payment was not completed.",
      });
    },
  });
  const paymentInFlight = isRazorpayActionInFlight(orderMutation.isPending, retryPaymentMutation.isPending);
  const placeOrderDisabled = createAddressMutation.isPending || paymentInFlight || Boolean(placeOrderBlockedReason) || Boolean(paymentIssue);

  orderMutationResetRef.current = orderMutation.reset;
  retryPaymentMutationResetRef.current = retryPaymentMutation.reset;
  createAddressMutationResetRef.current = createAddressMutation.reset;

  useEffect(() => {
    if (!paymentInFlight && paymentProgressText) {
      setPaymentProgressText(null);
    }
  }, [paymentInFlight, paymentProgressText]);

  useEffect(() => {
    if (!customerAuth.enabled || paymentRecoveryAuthKeyRef.current === customerAuth.authKey) {
      return;
    }

    paymentRecoveryAuthKeyRef.current = customerAuth.authKey;
    let cancelled = false;

    async function recoverPaymentSession() {
      const recovery = await recoverPendingRazorpayPayment(customerAuth.authHeaders).catch(() => null);
      if (!recovery || cancelled || !mountedRef.current) {
        return;
      }

      if (isPaidRazorpayStatus(recovery.order.paymentStatus)) {
        setPaymentIssueIfMounted(null);
        replaceWithOrderSuccessIfMounted(recovery.order);
        void invalidateCheckoutState(recovery.order.orderNumber).catch(() => undefined);
        return;
      }

      setPaymentIssueIfMounted({
        orderNumber: recovery.order.orderNumber,
        buyerCurrency: recovery.order.buyerCurrency,
        buyerTotalMinor: recovery.order.buyerTotalMinor,
        totalPaise: recovery.order.totalPaise,
        currency: recovery.order.currency,
        message: recoveredPaymentMessage(recovery.session.status, recovery.order.paymentStatus),
      });
      void invalidateCheckoutState(recovery.order.orderNumber).catch(() => undefined);
    }

    void recoverPaymentSession();

    return () => {
      cancelled = true;
    };
  }, [customerAuth.authHeaders, customerAuth.authKey, customerAuth.enabled]);

  if (!customerAuth.enabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <EmptyState title="Sign in to checkout" message="Your cart and checkout are linked to your 1HandIndia account." />
        <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </Screen>
    );
  }

  if (cartQuery.isLoading || addressesQuery.isLoading || paymentMethodsQuery.isLoading || (!cartItems.length && cartQuery.isFetching)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Preparing checkout...</Text>
        </View>
      </Screen>
    );
  }

  if (cartQuery.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <EmptyState title="Cart could not load" message={cartErrorMessage(cartQuery.error)} />
        <Pressable style={styles.primaryButton} onPress={() => void cartQuery.refetch()}>
          <Text style={styles.primaryButtonText}>Retry cart</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/cart")}>
          <Text style={styles.secondaryButtonText}>Back to cart</Text>
        </Pressable>
      </Screen>
    );
  }

  if (!cartItems.length) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <EmptyState title="Cart is empty" message="Add products before checkout." />
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/cart")}>
          <Text style={styles.primaryButtonText}>Back to cart</Text>
        </Pressable>
      </Screen>
    );
  }

  const stepReadiness = feedItems.map((item) =>
    isCheckoutStepReady(item.type, {
      cartItems,
      deliveryPreference,
      paymentReference,
      needsReference,
      selectedAddress: Boolean(selectedAddress),
      selectedPayment: Boolean(selectedPayment),
      summaryError,
      summaryLoading: checkoutSummaryQuery.isFetching,
    }),
  );
  const firstIncompleteStepIndex = stepReadiness.findIndex((ready) => !ready);
  const activeStepIndex = firstIncompleteStepIndex === -1 ? feedItems.length - 1 : firstIncompleteStepIndex;
  const stepStatuses = feedItems.map<CheckoutStepStatus>((_item, index) => {
    if (firstIncompleteStepIndex === -1 || (stepReadiness[index] && index < activeStepIndex)) {
      return "complete";
    }

    return index === activeStepIndex ? "active" : "pending";
  });

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={feedItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<CheckoutProgressHeader stepStatuses={stepStatuses} />}
        renderItem={({ item, index }) => (
          <CheckoutSection
            addresses={addresses}
            addressForm={addressForm}
            addressFormError={createAddressMutation.error}
            addressFormOpen={addressFormOpen}
            cartItems={cartItems}
            customerNote={customerNote}
            deliveryPreference={deliveryPreference}
            paymentOptions={paymentOptions}
            isSummaryLoading={checkoutSummaryQuery.isFetching}
            formatCatalogPrice={market.format}
            item={item}
            orderError={orderMutation.error}
            paymentMethod={paymentMethod}
            paymentReference={paymentReference}
            savingAddress={createAddressMutation.isPending}
            selectedAddressId={selectedAddressId}
            selectedPaymentNote={selectedPayment?.note ?? ""}
            setAddressForm={setAddressForm}
            setAddressFormOpen={setAddressFormOpen}
            setCustomerNote={setCustomerNote}
            setDeliveryPreference={setDeliveryPreference}
            setPaymentMethod={setPaymentMethod}
            setPaymentReference={setPaymentReference}
            setSelectedAddressId={setSelectedAddressId}
            summaryError={summaryError}
            summary={summary}
            summaryLocale={market.market.locale}
            stepNumber={index + 1}
            stepStatus={stepStatuses[index] ?? "pending"}
            onCreateAddress={() => createAddressMutation.mutate()}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {paymentIssue ? (
              <View style={styles.paymentIssueCard}>
                <Text style={styles.paymentIssueTitle}>Payment pending</Text>
                <Text style={styles.paymentIssueText}>{paymentIssue.message}</Text>
                <View style={styles.paymentIssueActions}>
                  <Pressable
                    disabled={paymentInFlight}
                    style={[styles.paymentRetryButton, paymentInFlight ? styles.buttonDisabledLight : null]}
                    onPress={() => retryPaymentMutation.mutate(paymentIssue)}
                  >
                    {retryPaymentMutation.isPending ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={styles.paymentRetryText}>Retry payment</Text>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={paymentInFlight}
                    style={[styles.paymentViewButton, paymentInFlight ? styles.buttonDisabledLight : null]}
                    onPress={() => router.replace(`/orders/${paymentIssue.orderNumber}` as never)}
                  >
                    <Text style={styles.paymentViewText}>View order</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Pressable
              disabled={placeOrderDisabled}
              style={[styles.placeButton, placeOrderDisabled ? styles.buttonDisabled : null]}
              onPress={() => orderMutation.mutate()}
            >
              {paymentInFlight ? (
                <>
                  <ActivityIndicator color={colors.surface} />
                  <Text style={styles.placeButtonText}>{paymentProgressText ?? "Processing payment..."}</Text>
                </>
              ) : (
                <>
                  <HugeiconsIcon color={colors.surface} icon={ShoppingCart01Icon} size={20} strokeWidth={2.2} />
                  <Text style={styles.placeButtonText}>{paymentMethod === "RAZORPAY" ? "Pay online" : "Place order"}</Text>
                </>
              )}
            </Pressable>
            {placeOrderBlockedReason ? <Text style={styles.footerHelp}>{placeOrderBlockedReason}</Text> : null}
          </View>
        }
      />
    </Screen>
  );
}

export default withStorefrontMaintenance(CheckoutScreen);

function CheckoutSection({
  addresses,
  addressForm,
  addressFormError,
  addressFormOpen,
  cartItems,
  customerNote,
  deliveryPreference,
  formatCatalogPrice,
  paymentOptions,
  isSummaryLoading,
  item,
  onCreateAddress,
  orderError,
  paymentMethod,
  paymentReference,
  savingAddress,
  selectedAddressId,
  selectedPaymentNote,
  setAddressForm,
  setAddressFormOpen,
  setCustomerNote,
  setDeliveryPreference,
  setPaymentMethod,
  setPaymentReference,
  setSelectedAddressId,
  summaryError,
  summary,
  summaryLocale,
  stepNumber,
  stepStatus,
}: {
  addresses: MobileCustomerAddress[];
  addressForm: MobileCustomerAddressPayload;
  addressFormError: Error | null;
  addressFormOpen: boolean;
  cartItems: MobileCartSummary["items"];
  customerNote: string;
  deliveryPreference: MobileDeliveryPreference;
  formatCatalogPrice: (pricePaise?: number | null) => string;
  paymentOptions: CheckoutPaymentOption[];
  isSummaryLoading: boolean;
  item: CheckoutFeedItem;
  onCreateAddress: () => void;
  orderError: Error | null;
  paymentMethod: MobilePaymentMethod;
  paymentReference: string;
  savingAddress: boolean;
  selectedAddressId: string | null;
  selectedPaymentNote: string;
  setAddressForm: (value: MobileCustomerAddressPayload) => void;
  setAddressFormOpen: (value: boolean) => void;
  setCustomerNote: (value: string) => void;
  setDeliveryPreference: (value: MobileDeliveryPreference) => void;
  setPaymentMethod: (value: MobilePaymentMethod) => void;
  setPaymentReference: (value: string) => void;
  setSelectedAddressId: (value: string) => void;
  summaryError: string;
  summary: MobileCheckoutSummary;
  summaryLocale: string;
  stepNumber: number;
  stepStatus: CheckoutStepStatus;
}) {
  if (item.type === "items") {
    return (
      <View style={styles.section}>
        <SectionTitle icon={ShoppingCart01Icon} status={stepStatus} stepNumber={stepNumber} title="Review items" />
        {cartItems.map((cartItem) => (
          <CheckoutItemRow formatPrice={formatCatalogPrice} item={cartItem} key={cartItem.id} />
        ))}
      </View>
    );
  }

  if (item.type === "address") {
    return (
      <View style={styles.section}>
        <SectionTitle icon={Home01Icon} status={stepStatus} stepNumber={stepNumber} title="Delivery address" />
        {!addresses.length ? (
          <Text style={styles.helpText}>No saved address found. Add one here for delivery, or choose store pickup.</Text>
        ) : null}
        {addresses.map((address) => (
          <Pressable
            key={address.id}
            style={[styles.optionCard, selectedAddressId === address.id ? styles.optionCardActive : null]}
            onPress={() => setSelectedAddressId(address.id)}
          >
            <Text style={styles.optionTitle}>{address.label || address.fullName}</Text>
            <Text style={styles.optionText}>{address.line1}, {address.city}, {address.state} - {address.pincode}</Text>
            <Text style={styles.optionText}>{address.phone}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.secondaryButton} onPress={() => setAddressFormOpen(!addressFormOpen)}>
          <Text style={styles.secondaryButtonText}>{addressFormOpen ? "Close address form" : "Add delivery address"}</Text>
        </Pressable>
        {addressFormOpen ? (
          <View style={styles.addressForm}>
            <MobileAddressForm
              disabled={savingAddress}
              onChange={setAddressForm}
              value={addressForm}
            />
            {addressFormError ? <Text style={styles.errorText}>{addressFormError.message}</Text> : null}
            <Pressable disabled={savingAddress} style={[styles.secondaryButton, savingAddress ? styles.buttonDisabledLight : null]} onPress={onCreateAddress}>
              {savingAddress ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Save address</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  if (item.type === "delivery") {
    return (
      <View style={styles.section}>
        <SectionTitle icon={DeliveryBox01Icon} status={stepStatus} stepNumber={stepNumber} title="Delivery preference" />
        <View style={styles.segmentRow}>
          <SegmentButton active={deliveryPreference === "DELIVER_TO_ADDRESS"} label="Deliver" onPress={() => setDeliveryPreference("DELIVER_TO_ADDRESS")} />
          <SegmentButton active={deliveryPreference === "STORE_PICKUP"} label="Pickup" onPress={() => setDeliveryPreference("STORE_PICKUP")} />
        </View>
      </View>
    );
  }

  if (item.type === "payment") {
    return (
      <View style={styles.section}>
        <SectionTitle icon={CreditCardIcon} status={stepStatus} stepNumber={stepNumber} title="Payment method" />
        {paymentOptions.map((method) => (
          <Pressable
            key={method.method}
            disabled={!method.enabled}
            style={[
              styles.optionCard,
              paymentMethod === method.method ? styles.optionCardActive : null,
              !method.enabled ? styles.optionCardDisabled : null,
            ]}
            onPress={() => method.enabled && setPaymentMethod(method.method)}
          >
            <Text style={styles.optionTitle}>{method.label}</Text>
            <Text style={styles.optionText}>{method.note}</Text>
            {method.method === "COD" && method.maxOrderPaise && summary.buyerCurrency !== "INR" ? (
              <Text style={styles.paymentInstruction}>
                COD available up to {formatMoney(method.maxOrderPaise, "INR", "en-IN")} INR (~{formatCatalogPrice(method.maxOrderPaise)}).
              </Text>
            ) : null}
            {paymentMethod === method.method ? <PaymentMethodDetails method={method} /> : null}
          </Pressable>
        ))}
        {selectedPaymentNote ? <Text style={styles.helpText}>{selectedPaymentNote}</Text> : null}
      </View>
    );
  }

  if (item.type === "reference") {
    return (
      <View style={styles.section}>
        <SectionTitle icon={BankIcon} status={stepStatus} stepNumber={stepNumber} title="Order note" />
        {paymentMethod === "BANK_TRANSFER" || paymentMethod === "MANUAL" ? (
          <TextInput
            onChangeText={setPaymentReference}
            placeholder="Payment reference or UTR"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={paymentReference}
          />
        ) : null}
        <TextInput
          multiline
          onChangeText={setCustomerNote}
          placeholder="Delivery note optional"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.noteInput]}
          value={customerNote}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionTitle icon={ShoppingCart01Icon} status={stepStatus} stepNumber={stepNumber} title="Order summary" />
      {isSummaryLoading ? <Text style={styles.helpText}>Refreshing totals...</Text> : null}
      {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
      <SummaryRow label="Items" value={String(summary.itemCount)} />
      <SummaryRow
        label="Subtotal"
        value={checkoutSummaryAmount(summary, summary.buyerPayableSubtotalMinor ?? summary.buyerSubtotalMinor, summary.payableSubtotalPaise ?? summary.subtotalPaise, summaryLocale)}
      />
      <SummaryRow label="Shipping" value={checkoutSummaryAmount(summary, summary.buyerShippingMinor, summary.shippingPaise, summaryLocale)} />
      <SummaryRow label="Platform fee" value={checkoutSummaryAmount(summary, summary.buyerPlatformFeeMinor, summary.platformFeePaise, summaryLocale)} />
      {summary.couponDiscountPaise ? (
        <SummaryRow label="Coupon" value={`-${checkoutSummaryAmount(summary, summary.buyerCouponDiscountMinor, summary.couponDiscountPaise, summaryLocale)}`} />
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{checkoutSummaryAmount(summary, summary.buyerTotalMinor, summary.totalPaise, summaryLocale)}</Text>
      </View>
      {summary.buyerCurrency !== summary.currency ? <Text style={styles.helpText}>Base total: {formatMoney(summary.totalPaise, summary.currency, "en-IN")}</Text> : null}
      {orderError ? <Text style={styles.errorText}>{orderError.message}</Text> : null}
    </View>
  );
}

function CheckoutProgressHeader({ stepStatuses }: { stepStatuses: CheckoutStepStatus[] }) {
  return (
    <View style={styles.checkoutHeader}>
      <Text style={styles.checkoutEyebrow}>Secure checkout</Text>
      <Text style={styles.checkoutTitle}>Complete your order</Text>
      <Text style={styles.checkoutSubtitle}>Review your items, delivery, payment, and final total before placing the order.</Text>
      <View style={styles.progressRail}>
        {feedItems.map((item, index) => {
          const complete = stepStatuses[index] === "complete";
          const active = stepStatuses[index] === "active";
          return (
            <View key={item.id} style={styles.progressStep}>
              <View style={[styles.progressDot, complete ? styles.progressDotComplete : active ? styles.progressDotActive : null]}>
                {complete ? (
                  <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.4} />
                ) : (
                  <Text style={[styles.progressDotText, active ? styles.progressDotTextActive : null]}>{index + 1}</Text>
                )}
              </View>
              {index < feedItems.length - 1 ? <View style={[styles.progressLine, complete ? styles.progressLineComplete : null]} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SectionTitle({
  icon,
  status,
  stepNumber,
  title,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  status: CheckoutStepStatus;
  stepNumber: number;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.stepBadge, status === "complete" ? styles.stepBadgeComplete : status === "active" ? styles.stepBadgeActive : null]}>
        {status === "complete" ? (
          <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={17} strokeWidth={2.3} />
        ) : (
          <Text style={[styles.stepBadgeText, status === "active" ? styles.stepBadgeTextActive : null]}>{stepNumber}</Text>
        )}
      </View>
      <View style={styles.sectionTitleCopy}>
        <View style={styles.sectionTitleInnerRow}>
          <HugeiconsIcon color={status === "pending" ? colors.muted : colors.primary} icon={icon} size={21} strokeWidth={2.1} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{status === "complete" ? "Completed" : status === "active" ? "Required now" : "Next step"}</Text>
      </View>
    </View>
  );
}

function isCheckoutStepReady(
  type: CheckoutFeedItem["type"],
  input: {
    cartItems: MobileCartSummary["items"];
    deliveryPreference: MobileDeliveryPreference;
    needsReference: boolean;
    paymentReference: string;
    selectedAddress: boolean;
    selectedPayment: boolean;
    summaryError: string;
    summaryLoading: boolean;
  },
) {
  if (type === "items") {
    return input.cartItems.length > 0;
  }

  if (type === "address") {
    return input.deliveryPreference === "STORE_PICKUP" || input.selectedAddress;
  }

  if (type === "delivery") {
    return Boolean(input.deliveryPreference);
  }

  if (type === "payment") {
    return input.selectedPayment;
  }

  if (type === "reference") {
    return !input.needsReference || Boolean(input.paymentReference.trim());
  }

  return !input.summaryError && !input.summaryLoading;
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, active ? styles.segmentButtonActive : null]} onPress={onPress}>
      <Text style={[styles.segmentButtonText, active ? styles.segmentButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function PaymentMethodDetails({ method }: { method: CheckoutPaymentOption }) {
  const bankDetails = method.method === "BANK_TRANSFER" ? method.bankTransferDetails : undefined;

  if (method.method !== "BANK_TRANSFER") {
    return method.instructions ? <Text style={styles.paymentInstruction}>{method.instructions}</Text> : null;
  }

  return (
    <View style={styles.paymentDetails}>
      {bankDetails?.accountHolderName ? <DetailLine label="Account name" value={bankDetails.accountHolderName} /> : null}
      {bankDetails?.bankName ? <DetailLine label="Bank" value={bankDetails.bankName} /> : null}
      {bankDetails?.accountNumber ? <DetailLine label="Account no" value={bankDetails.accountNumber} /> : null}
      {bankDetails?.ifscCode ? <DetailLine label="IFSC" value={bankDetails.ifscCode} /> : null}
      {bankDetails?.branch ? <DetailLine label="Branch" value={bankDetails.branch} /> : null}
      {bankDetails?.upiId ? <DetailLine label="UPI" value={bankDetails.upiId} /> : null}
      {method.instructions ? <Text style={styles.paymentInstruction}>{method.instructions}</Text> : null}
      {bankDetails?.referenceRequired !== false ? <Text style={styles.paymentInstruction}>Reference or UTR is required for verification.</Text> : null}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function CheckoutItemRow({
  formatPrice,
  item,
}: {
  formatPrice: (pricePaise?: number | null) => string;
  item: MobileCartSummary["items"][number];
}) {
  const product = item.productVariant?.product;
  const imageUrl = resolveImageUrl(product?.images?.[0]?.url);
  const unitPrice = item.unitPricePaise ?? item.productVariant?.pricePaise ?? 0;

  return (
    <View style={styles.checkoutItemRow}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.checkoutItemImage} /> : <View style={styles.checkoutItemImageFallback} />}
      <View style={styles.checkoutItemBody}>
        <Text numberOfLines={2} style={styles.checkoutItemName}>{product?.name ?? "Cart item"}</Text>
        <Text numberOfLines={1} style={styles.optionText}>{product?.seller?.storeName ?? "1HandIndia seller"}</Text>
        <Text style={styles.checkoutItemMeta}>Qty {item.quantity} x {formatPrice(unitPrice)}</Text>
      </View>
      <Text style={styles.checkoutItemTotal}>{formatPrice(unitPrice * item.quantity)}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function createMobileOrderIdempotencyKey(cartId: string) {
  const safeCartId = cartId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "cart";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `mobile_${safeCartId}_${timestamp}_${random}`;
}

function successRouteParams(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function fallbackSummary(itemCount: number, subtotalPaise: number): MobileCheckoutSummary {
  return {
    itemCount,
    subtotalPaise,
    payableSubtotalPaise: subtotalPaise,
    shippingPaise: 0,
    platformFeePaise: 0,
    couponDiscountPaise: 0,
    totalPaise: subtotalPaise,
    currency: "INR",
    buyerCountryCode: "IN",
    buyerCurrency: "INR",
    buyerSubtotalMinor: subtotalPaise,
    buyerPayableSubtotalMinor: subtotalPaise,
    buyerShippingMinor: 0,
    buyerPlatformFeeMinor: 0,
    buyerCouponDiscountMinor: 0,
    buyerTotalMinor: subtotalPaise,
  };
}

function checkoutSummaryAmount(
  summary: Pick<MobileCheckoutSummary, "buyerCurrency" | "currency">,
  buyerMinor: number | null | undefined,
  baseMinor: number | null | undefined,
  buyerLocale: string,
) {
  if (summary.buyerCurrency && buyerMinor !== undefined && buyerMinor !== null) {
    return formatMoney(buyerMinor, summary.buyerCurrency, buyerLocale);
  }

  return formatMoney(baseMinor ?? 0, summary.currency, "en-IN");
}

function normalizeCheckoutCountryCode(countryCode?: string | null) {
  return countryCode?.trim().toUpperCase() || "IN";
}

function cartErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Check your connection and refresh the cart before checkout.";
}

function validationMessage(validate: () => unknown) {
  try {
    validate();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "Check the checkout details and try again.";
  }
}

function recoveredPaymentMessage(sessionStatus: string, paymentStatus: string | undefined) {
  if (sessionStatus === "timed_out") {
    return RAZORPAY_CHECKOUT_TIMEOUT_ERROR;
  }

  if (sessionStatus === "cancelled") {
    return RAZORPAY_CHECKOUT_CANCELLED_ERROR;
  }

  return razorpayStatusRetryMessage(paymentStatus);
}

function isCartEmptyError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("cart is empty");
}

function serviceabilityCheckoutError(error: unknown) {
  if (!(error instanceof MobileApiError) || error.status !== 400) {
    return "";
  }

  const message = error.message.trim();
  if (!message.toLowerCase().includes("not serviceable")) {
    return "";
  }

  return "Delivery is not available for this address yet. Please choose another saved address, add a different delivery location, or select pickup if it is available.";
}

function isRecoverableOrderPlacementError(error: unknown) {
  if (serviceabilityCheckoutError(error)) {
    return false;
  }

  if (isCartEmptyError(error)) {
    return true;
  }

  if (error instanceof MobileApiError) {
    return error.status === 0 || error.status === 408 || error.status === 409 || error.status >= 500;
  }

  return error instanceof Error && /network|timeout|connection|reach/i.test(error.message);
}

async function recoverRecentlyPlacedOrder(
  auth: Parameters<typeof listCustomerOrders>[0],
  expectedTotalPaise: number,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = Math.max(1, options.attempts ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 0);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const orders = await listCustomerOrders(auth, 20);
      const now = Date.now();
      const recoveredOrder =
        orders.items.find((order) => {
          if (order.totalPaise !== expectedTotalPaise || !order.createdAt) {
            return false;
          }

          const ageMs = now - new Date(order.createdAt).getTime();
          return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 15 * 60 * 1000;
        }) ?? null;

      if (recoveredOrder) {
        return recoveredOrder;
      }
    } catch {
      // A failed recovery read should not mask the original checkout error.
    }

    if (attempt < attempts && delayMs > 0) {
      await wait(delayMs);
    }
  }

  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const styles = StyleSheet.create({
  listContent: {
    padding: 20,
    paddingBottom: 132,
  },
  checkoutHeader: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 4,
    marginBottom: 18,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
  },
  checkoutEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  checkoutTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  checkoutSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  progressRail: {
    flexDirection: "row",
    marginTop: 18,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  progressDot: {
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressDotComplete: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  progressDotText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
  },
  progressDotTextActive: {
    color: colors.surface,
  },
  progressLine: {
    backgroundColor: "#F3E7E2",
    flex: 1,
    height: 2,
  },
  progressLineComplete: {
    backgroundColor: "#22C55E",
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 3,
    marginBottom: 16,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
  },
  sectionTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepBadgeComplete: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  stepBadgeText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "900",
  },
  stepBadgeTextActive: {
    color: colors.surface,
  },
  sectionTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitleInnerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 10,
    padding: 14,
  },
  optionCardActive: {
    backgroundColor: "#FFF8F5",
    borderColor: colors.primary,
  },
  optionCardDisabled: {
    backgroundColor: "#F3F4F6",
    opacity: 0.7,
  },
  optionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  optionText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  helpText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  paymentDetails: {
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    marginTop: 10,
    padding: 12,
  },
  detailLine: {
    flexDirection: "row",
    gap: 10,
  },
  detailLabel: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "900",
    width: 86,
  },
  detailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
  },
  paymentInstruction: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 4,
  },
  checkoutItemRow: {
    alignItems: "center",
    backgroundColor: "#FFFBFA",
    borderColor: "#F3E7E2",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    padding: 12,
  },
  checkoutItemImage: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    height: 64,
    width: 64,
  },
  checkoutItemImageFallback: {
    backgroundColor: colors.softSurface,
    borderRadius: 18,
    height: 64,
    width: 64,
  },
  checkoutItemBody: {
    flex: 1,
    minWidth: 0,
  },
  checkoutItemName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  checkoutItemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 5,
  },
  checkoutItemTotal: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  addressForm: {
    gap: 10,
    marginTop: 12,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexInput: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    alignItems: "center",
    backgroundColor: "#FFFBFA",
    borderColor: "#F3E7E2",
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  segmentButtonTextActive: {
    color: colors.surface,
  },
  input: {
    backgroundColor: "#FFFBFA",
    borderColor: "#F3E7E2",
    borderRadius: 20,
    borderWidth: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  noteInput: {
    marginTop: 10,
    minHeight: 76,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  summaryLabel: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  totalRow: {
    alignItems: "center",
    borderTopColor: "#F3E7E2",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 13,
  },
  totalLabel: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  totalValue: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: "900",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
  },
  footer: {
    paddingBottom: 20,
  },
  paymentIssueCard: {
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  paymentIssueTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  paymentIssueText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 5,
  },
  paymentIssueActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  paymentRetryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#F3E7E2",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  paymentRetryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  paymentViewButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  paymentViewText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  footerHelp: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
  placeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 58,
  },
  buttonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  buttonDisabledLight: {
    backgroundColor: "#F3F4F6",
  },
  placeButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    marginTop: 16,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
});
