import {
  Add01Icon,
  CheckmarkCircle02Icon,
  DeliveryReturn01Icon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../../src/components/empty-state";
import { RemoteImage } from "../../../src/components/remote-image";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { accountErrorMessage, formatDate, SignInRequiredState } from "../../../src/features/account/account-ui";
import { formatMoney, useMobileMarket } from "../../../src/features/market/mobile-market";
import {
  availableReturnQuantity,
  mobileReturnResolutions,
  mobileReverseShipmentModes,
  orderCanStartReturn,
  selectedReturnItems,
  validateReturnForm,
  type MobileReturnResolution,
  type MobileReverseShipmentMode,
  type ReturnFormSelection,
} from "../../../src/features/returns/return-eligibility";
import { isMobileReturnsEnabled } from "../../../src/features/returns/return-feature";
import { returnsCopy } from "../../../src/features/returns/return-copy";
import {
  createCustomerReturn,
  getCustomerOrder,
  type MobileOrderDetail,
} from "../../../src/features/storefront/storefront-api";
import { MobileApiError } from "../../../src/lib/api";
import { resolveImageUrl } from "../../../src/lib/image-url";
import { captureMobileException, trackMobileEvent } from "../../../src/lib/mobile-telemetry";
import { colors } from "../../../src/theme";

type FormErrorKey = ReturnType<typeof validateReturnForm>;

export default function OrderReturnScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string }>();
  const orderNumber = Array.isArray(params.orderNumber) ? params.orderNumber[0] : params.orderNumber;
  const customerAuth = useMobileCustomerAuth();
  const market = useMobileMarket();
  const copy = returnsCopy(market.market.locale);
  const featureEnabled = isMobileReturnsEnabled(customerAuth.authKey);
  const queryClient = useQueryClient();
  const router = useRouter();
  const submittedRef = useRef(false);
  const [selection, setSelection] = useState<ReturnFormSelection>({});
  const [resolution, setResolution] = useState<MobileReturnResolution>("REFUND");
  const [reverseShipmentMode, setReverseShipmentMode] = useState<MobileReverseShipmentMode>("PLATFORM_PICKUP");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<FormErrorKey>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [requiresServerRefresh, setRequiresServerRefresh] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber],
    queryFn: () => getCustomerOrder(customerAuth.authHeaders, orderNumber ?? ""),
    enabled: customerAuth.enabled && featureEnabled && Boolean(orderNumber),
    refetchOnMount: "always",
    retry: false,
  });

  const order = orderQuery.data;
  const selectedItems = useMemo(() => selectedReturnItems(selection), [selection]);

  useEffect(() => {
    if (customerAuth.enabled && featureEnabled && orderNumber) {
      trackMobileEvent("return_started", { itemCount: order?.items.length ?? 0 });
    }
  }, [customerAuth.enabled, featureEnabled, order?.items.length, orderNumber]);

  useEffect(() => {
    return () => {
      if (!submittedRef.current && customerAuth.enabled && featureEnabled && orderNumber) {
        trackMobileEvent("return_abandoned", {
          selectedItemCount: selectedItems.length,
        });
      }
    };
  }, [customerAuth.enabled, featureEnabled, orderNumber, selectedItems.length]);

  useEffect(() => {
    if (orderQuery.isError) {
      captureMobileException(orderQuery.error, "return_order_load_failed", {
        status: "order_error",
      });
    }
  }, [orderQuery.error, orderQuery.isError]);

  const createReturnMutation = useMutation({
    mutationFn: () => {
      if (!orderNumber) {
        throw new Error("Order number is missing.");
      }

      const validation = validateReturnForm({ note, reason, selection });
      setFormError(validation);
      if (validation) {
        throw new Error(copy[validation]);
      }

      trackMobileEvent("return_submit_attempted", {
        itemCount: selectedItems.length,
        resolution,
        reverseShipmentMode,
      });

      return createCustomerReturn(customerAuth.authHeaders, orderNumber, {
        items: selectedItems,
        reason: reason.trim(),
        resolution,
        reverseShipmentMode,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    retry: false,
    onSuccess: async (result) => {
      submittedRef.current = true;
      trackMobileEvent("return_submit_succeeded", {
        itemCount: result.items.length,
        resolution: result.resolution,
        status: result.status,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-order-detail", customerAuth.authKey, orderNumber] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-orders", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-returns", customerAuth.authKey] }),
      ]);
      router.replace(`/account/returns/${encodeURIComponent(result.requestNumber)}` as never);
    },
    onError: async (error) => {
      const message = returnSubmitErrorMessage(error, copy);
      setSubmitMessage(message);
      trackMobileEvent("return_submit_failed", {
        offline: error instanceof MobileApiError && error.status === 0,
        rateLimited: error instanceof MobileApiError && error.status === 429,
        status: error instanceof MobileApiError ? error.status : "client",
      });
      captureMobileException(error, "return_submit_failed", {
        itemCount: selectedItems.length,
        status: error instanceof MobileApiError ? error.status : "client",
      });

      if (shouldRequireServerRefresh(error)) {
        setRequiresServerRefresh(true);
        await Promise.all([
          orderQuery.refetch(),
          queryClient.invalidateQueries({ queryKey: ["mobile-returns", customerAuth.authKey] }),
        ]);
      }
    },
  });

  async function refreshBeforeRetry() {
    setSubmitMessage(copy.alreadySubmittedGuard);
    await Promise.all([
      orderQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["mobile-returns", customerAuth.authKey] }),
    ]);
    setRequiresServerRefresh(false);
    setSubmitMessage("");
  }

  function handleSubmit() {
    if (createReturnMutation.isPending) {
      return;
    }

    if (requiresServerRefresh) {
      void refreshBeforeRetry();
      return;
    }

    createReturnMutation.mutate();
  }

  if (!featureEnabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <EmptyState title={copy.disabledTitle} message={copy.disabledMessage} />
      </Screen>
    );
  }

  if (!orderNumber) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <EmptyState title={copy.orderMissingTitle} message={copy.orderMissingMessage} />
      </Screen>
    );
  }

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || orderQuery.isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>{copy.preparingForm}</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <SignInRequiredState title={copy.createSignInTitle} message={copy.sessionExpired} />
      </>
    );
  }

  if (orderQuery.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <EmptyState title={copy.orderLoadErrorTitle} message={accountErrorMessage(orderQuery.error, copy.genericRetryMessage)} />
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void orderQuery.refetch()}>
          <Text style={styles.primaryButtonText}>{copy.retry}</Text>
        </Pressable>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <EmptyState title={copy.orderMissingTitle} message={copy.orderUnavailableMessage} />
      </Screen>
    );
  }

  if (!orderCanStartReturn(order)) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
        <EmptyState
          title={copy.returnLockedTitle}
          message={copy.returnLockedMessage}
        />
      </Screen>
    );
  }

  const validationMessage = formError ? copy[formError] : "";
  const submitDisabled = createReturnMutation.isPending || (requiresServerRefresh && orderQuery.isFetching);

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: copy.createTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <HugeiconsIcon color={colors.primary} icon={DeliveryReturn01Icon} size={30} strokeWidth={2.1} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{copy.returnEligibleTitle}</Text>
              <Text style={styles.heroMeta}>Order {order.orderNumber} - {copy.deliveredLabel} {formatDate(order.createdAt)}</Text>
            </View>
          </View>
          <Text style={styles.heroDescription}>{copy.createDescription}</Text>
        </View>

        <Text style={styles.sectionTitle}>{copy.selectedItemsLabel}</Text>
        <View style={styles.sectionCard}>
          {order.items.map((item) => (
            <ReturnSelectableItem
              copy={copy}
              item={item}
              key={item.id}
              order={order}
              quantity={selection[item.id] ?? 0}
              onChange={(quantity) => {
                setFormError(null);
                setSelection((current) => ({ ...current, [item.id]: quantity }));
                trackMobileEvent("return_item_selected", {
                  selected: quantity > 0,
                });
              }}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.resolutionLabel}</Text>
        <View style={styles.segmentRow}>
          {mobileReturnResolutions.map((item) => (
            <SegmentButton
              active={resolution === item}
              key={item}
              label={item === "REFUND" ? copy.refund : copy.replacement}
              onPress={() => setResolution(item)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{copy.returnModeLabel}</Text>
        <View style={styles.segmentRow}>
          {mobileReverseShipmentModes.map((item) => (
            <SegmentButton
              active={reverseShipmentMode === item}
              key={item}
              label={item === "PLATFORM_PICKUP" ? copy.returnModePickup : copy.returnModeSelfShip}
              onPress={() => setReverseShipmentMode(item)}
            />
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{copy.formReasonLabel}</Text>
          <TextInput
            accessibilityLabel={copy.formReasonLabel}
            maxLength={160}
            multiline
            onChangeText={(value) => {
              setFormError(null);
              setReason(value);
            }}
            placeholder={copy.formReasonPlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.textArea}
            value={reason}
          />
          <Text style={styles.counterText}>{reason.length}/160</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{copy.noteLabel}</Text>
          <TextInput
            accessibilityLabel={copy.noteLabel}
            maxLength={1000}
            multiline
            onChangeText={(value) => {
              setFormError(null);
              setNote(value);
            }}
            placeholder={copy.notePlaceholder}
            placeholderTextColor={colors.muted}
            style={[styles.textArea, styles.noteArea]}
            value={note}
          />
          <Text style={styles.counterText}>{note.length}/1000</Text>
        </View>

        {validationMessage ? <Text style={styles.errorText}>{validationMessage}</Text> : null}
        {submitMessage ? <Text style={styles.errorText}>{submitMessage}</Text> : null}

        <Pressable
          accessibilityHint={requiresServerRefresh ? "Refresh order and returns before retrying" : "Submit this return request"}
          accessibilityRole="button"
          disabled={submitDisabled}
          style={[styles.primaryButton, submitDisabled ? styles.disabledButton : null]}
          onPress={handleSubmit}
        >
          {createReturnMutation.isPending || (requiresServerRefresh && orderQuery.isFetching) ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <HugeiconsIcon color={colors.surface} icon={DeliveryReturn01Icon} size={20} strokeWidth={2.2} />
          )}
          <Text style={styles.primaryButtonText}>
            {createReturnMutation.isPending
              ? copy.formSubmitting
              : requiresServerRefresh
                ? copy.refreshBeforeRetry
                : copy.formSubmit}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function ReturnSelectableItem({
  copy,
  item,
  onChange,
  order,
  quantity,
}: {
  copy: ReturnType<typeof returnsCopy>;
  item: MobileOrderDetail["items"][number];
  onChange: (quantity: number) => void;
  order: MobileOrderDetail;
  quantity: number;
}) {
  const maxQuantity = availableReturnQuantity(item);
  const selected = quantity > 0;
  const disabled = maxQuantity <= 0;
  const imageUrl = resolveImageUrl(item.product?.imageUrl);

  function setNextQuantity(nextQuantity: number) {
    onChange(Math.max(0, Math.min(maxQuantity, nextQuantity)));
  }

  return (
    <View style={[styles.itemCard, disabled ? styles.itemDisabled : null]}>
      <Pressable
        accessibilityHint={copy.itemSelectHint}
        accessibilityLabel={`${item.productNameSnapshot}, available quantity ${maxQuantity}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        style={styles.itemMain}
        onPress={() => setNextQuantity(selected ? 0 : Math.max(1, Math.min(1, maxQuantity)))}
      >
        <RemoteImage fallbackLabel={item.productNameSnapshot} resizeMode="contain" style={styles.itemImage} uri={imageUrl} />
        <View style={styles.itemCopy}>
          <Text numberOfLines={2} style={styles.itemName}>{item.productNameSnapshot}</Text>
          <Text numberOfLines={1} style={styles.itemMeta}>
            {copy.quantityShort} {item.quantity}
            {item.seller?.storeName ? ` - ${item.seller.storeName}` : ""}
          </Text>
          <Text style={styles.itemPrice}>{formatMoney(item.unitPricePaise, item.currency ?? order.currency, "en-IN")} {copy.eachLabel}</Text>
          {disabled ? <Text style={styles.unavailableText}>{copy.unavailableQuantity}</Text> : null}
        </View>
        <View style={[styles.checkbox, selected ? styles.checkboxActive : null]}>
          {selected ? <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.2} /> : null}
        </View>
      </Pressable>

      {selected ? (
        <View accessibilityLabel={copy.quantityControlsLabel} accessibilityRole="adjustable" style={styles.quantityRow}>
          <Pressable
            accessibilityHint={copy.decreaseQuantityHint}
            accessibilityRole="button"
            style={styles.quantityButton}
            onPress={() => setNextQuantity(quantity - 1)}
          >
            <HugeiconsIcon color={colors.primary} icon={MinusSignIcon} size={18} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.quantityText}>{quantity} of {maxQuantity}</Text>
          <Pressable
            accessibilityHint={copy.increaseQuantityHint}
            accessibilityRole="button"
            disabled={quantity >= maxQuantity}
            style={[styles.quantityButton, quantity >= maxQuantity ? styles.disabledButton : null]}
            onPress={() => setNextQuantity(quantity + 1)}
          >
            <HugeiconsIcon color={colors.primary} icon={Add01Icon} size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function returnSubmitErrorMessage(error: unknown, copy: ReturnType<typeof returnsCopy>) {
  if (error instanceof MobileApiError) {
    if (error.status === 0) {
      return copy.networkError;
    }
    if (error.status === 401) {
      return copy.sessionExpired;
    }
    if (error.status === 429) {
      return copy.rateLimited;
    }
    return error.message;
  }

  return error instanceof Error ? error.message : copy.returnSubmitFallbackError;
}

function shouldRequireServerRefresh(error: unknown) {
  if (error instanceof MobileApiError) {
    return error.status === 0 || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
  }

  return false;
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  content: {
    padding: 18,
    paddingBottom: 128,
  },
  counterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "right",
  },
  disabledButton: {
    opacity: 0.58,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 10,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroDescription: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 14,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderRadius: 20,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  heroMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  itemCard: {
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemDisabled: {
    opacity: 0.58,
  },
  itemImage: {
    backgroundColor: "#FFF9F6",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 74,
    width: 74,
  },
  itemMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 96,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  itemName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  itemPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
  },
  noteArea: {
    minHeight: 118,
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  quantityButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  quantityRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
  },
  quantityText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 18,
    padding: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  segmentButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  segmentText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: colors.surface,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    minHeight: 92,
    padding: 14,
    textAlignVertical: "top",
  },
  unavailableText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
});
