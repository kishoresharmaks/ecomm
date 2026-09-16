import {
  ArrowDown02Icon,
  CheckmarkCircle02Icon,
  DeliveryBox01Icon,
  Location01Icon,
  PackageIcon,
  Search01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { RemoteImage } from "../src/components/remote-image";
import { Screen } from "../src/components/screen";
import {
  accountErrorMessage,
  formatDate,
  formatDateTime,
  formatStatus,
  StatusPill,
} from "../src/features/account/account-ui";
import { formatMoney, formatOrderDisplayTotal } from "../src/features/market/mobile-market";
import { withStorefrontMaintenance } from "../src/features/maintenance/mobile-maintenance-gate";
import {
  listCustomerOrders,
  trackOrder,
  type MobileOrderSummary,
  type MobileTrackedOrder,
} from "../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../src/lib/image-url";
import { colors } from "../src/theme";

type TrackedTimelineItem = {
  createdAt: string | null;
  label: string;
  note: string | null;
};

function TrackOrderScreen() {
  const customerAuth = useMobileCustomerAuth();
  const isSignedIn = customerAuth.enabled;
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [contactTouched, setContactTouched] = useState(false);
  const [formError, setFormError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const profileContact = customerAuth.userProfile.email ?? customerAuth.userProfile.phone ?? "";

  const ordersQuery = useQuery({
    queryKey: ["track-order-dropdown", customerAuth.authKey],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders, 50, 1),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const userOrders = ordersQuery.data?.items ?? [];

  const lookupMutation = useMutation({
    mutationFn: trackOrder,
    onSuccess: () => setFormError(""),
  });

  useEffect(() => {
    if (!contactTouched && !contact.trim() && profileContact) {
      setContact(profileContact);
    }
  }, [contact, contactTouched, profileContact]);

  function selectOrder(order: MobileOrderSummary) {
    setOrderNumber(order.orderNumber);
    setPickerOpen(false);
    setFormError("");
  }

  function submit() {
    const trimmedOrderNumber = orderNumber.trim();
    const trimmedContact = contact.trim();

    if (trimmedOrderNumber.length < 6) {
      setFormError("Enter a valid order number.");
      return;
    }

    if (trimmedContact.length < 5) {
      setFormError("Enter the email or phone used on the order.");
      return;
    }

    setFormError("");
    lookupMutation.mutate({ contact: trimmedContact, orderNumber: trimmedOrderNumber });
  }

  const selectedOrder = useMemo(
    () => userOrders.find((o) => o.orderNumber === orderNumber.trim().toUpperCase()),
    [userOrders, orderNumber],
  );

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Track Order" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <HugeiconsIcon color={colors.primary} icon={DeliveryBox01Icon} size={30} strokeWidth={2.1} />
          </View>
          <Text style={styles.title}>Track your order</Text>
          <Text style={styles.subtitle}>
            {isSignedIn
              ? "Pick an order from your list or enter the details manually."
              : "Enter your order number and the email or phone used at checkout."}
          </Text>
        </View>

        {/* Order picker for signed-in users */}
        {isSignedIn && (
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Your orders</Text>
            <Pressable style={styles.pickerButton} onPress={() => setPickerOpen(true)}>
              {selectedOrder ? (
                <View style={styles.pickerSelectedRow}>
                  <View style={styles.pickerSelectedIcon}>
                    <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={18} strokeWidth={2.1} />
                  </View>
                  <View style={styles.pickerSelectedCopy}>
                    <Text numberOfLines={1} style={styles.pickerSelectedNumber}>
                      {selectedOrder.orderNumber}
                    </Text>
                    <Text numberOfLines={1} style={styles.pickerSelectedMeta}>
                      {formatOrderDisplayTotal(selectedOrder)}
                      {" · "}
                      {selectedOrder.items?.[0]?.productNameSnapshot
                        ? `${selectedOrder.items[0].productNameSnapshot.slice(0, 28)}${selectedOrder.items[0].productNameSnapshot.length > 28 ? "..." : ""}`
                        : "No items"}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.pickerPlaceholderRow}>
                  <HugeiconsIcon color={colors.muted} icon={PackageIcon} size={20} strokeWidth={1.8} />
                  <Text style={styles.pickerPlaceholder}>Select an order to track</Text>
                </View>
              )}
              <HugeiconsIcon color={colors.muted} icon={ArrowDown02Icon} size={20} strokeWidth={2.2} />
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter manually</Text>
              <View style={styles.dividerLine} />
            </View>

            <Field
              autoCapitalize="characters"
              label="Order number"
              onChangeText={setOrderNumber}
              placeholder="1HI202606..."
              value={orderNumber}
            />
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email or phone"
              onChangeText={(value) => {
                setContactTouched(true);
                setContact(value);
              }}
              placeholder="Email or mobile number"
              value={contact}
            />
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {lookupMutation.isError ? (
              <Text style={styles.errorText}>
                {accountErrorMessage(lookupMutation.error, "Order could not be found.")}
              </Text>
            ) : null}
            <Pressable
              disabled={lookupMutation.isPending}
              style={[styles.primaryButton, lookupMutation.isPending ? styles.buttonDisabled : null]}
              onPress={submit}
            >
              {lookupMutation.isPending ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <HugeiconsIcon color={colors.surface} icon={Search01Icon} size={20} strokeWidth={2.2} />
              )}
              <Text style={styles.primaryButtonText}>
                {lookupMutation.isPending ? "Tracking..." : "Track order"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Non-signed-in form */}
        {!isSignedIn && (
          <View style={styles.formCard}>
            <Field
              autoCapitalize="characters"
              label="Order number"
              onChangeText={setOrderNumber}
              placeholder="1HI202606..."
              value={orderNumber}
            />
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email or phone"
              onChangeText={(value) => {
                setContactTouched(true);
                setContact(value);
              }}
              placeholder="Email or mobile number"
              value={contact}
            />
            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            {lookupMutation.isError ? (
              <Text style={styles.errorText}>
                {accountErrorMessage(lookupMutation.error, "Order could not be found.")}
              </Text>
            ) : null}
            <Pressable
              disabled={lookupMutation.isPending}
              style={[styles.primaryButton, lookupMutation.isPending ? styles.buttonDisabled : null]}
              onPress={submit}
            >
              {lookupMutation.isPending ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <HugeiconsIcon color={colors.surface} icon={Search01Icon} size={20} strokeWidth={2.2} />
              )}
              <Text style={styles.primaryButtonText}>
                {lookupMutation.isPending ? "Tracking..." : "Track order"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Loading state */}
        {lookupMutation.isPending && (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Tracking your order...</Text>
          </View>
        )}

        {/* Tracked order result */}
        {lookupMutation.data ? (
          <TrackedOrderResult order={lookupMutation.data} />
        ) : null}
      </ScrollView>

      {/* Order picker modal */}
      <OrderPickerModal
        open={pickerOpen}
        orders={userOrders}
        selectedNumber={orderNumber.trim().toUpperCase()}
        onClose={() => setPickerOpen(false)}
        onSelect={selectOrder}
      />
    </Screen>
  );
}

function OrderPickerModal({
  open,
  orders,
  selectedNumber,
  onClose,
  onSelect,
}: {
  open: boolean;
  orders: MobileOrderSummary[];
  selectedNumber: string;
  onClose: () => void;
  onSelect: (order: MobileOrderSummary) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.items?.some((item) => item.productNameSnapshot.toLowerCase().includes(q)),
    );
  }, [orders, search]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select an order</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={20} strokeWidth={2} />
            <TextInput
              autoCapitalize="none"
              onChangeText={setSearch}
              placeholder="Search by order number or product..."
              placeholderTextColor="#98A2B3"
              style={styles.searchInput}
              value={search}
            />
          </View>

          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>No orders found</Text>
              </View>
            ) : (
              filtered.map((order) => {
                const firstItem = order.items?.[0];
                const extraItems = Math.max(0, (order.items?.length ?? 0) - 1);
                const isSelected = order.orderNumber === selectedNumber;
                return (
                  <Pressable
                    key={order.id}
                    style={[styles.pickerRow, isSelected ? styles.pickerRowActive : null]}
                    onPress={() => onSelect(order)}
                  >
                    <View style={styles.pickerRowLeft}>
                      <View style={styles.pickerItemImageWrap}>
                        <RemoteImage
                          fallbackLabel={firstItem?.productNameSnapshot ?? "Item"}
                          resizeMode="cover"
                          style={styles.pickerItemImage}
                          uri={resolveImageUrl(
                            firstItem?.product?.imageUrl ?? firstItem?.product?.images?.[0]?.url ?? null,
                          )}
                        />
                      </View>
                      <View style={styles.pickerRowCopy}>
                        <Text numberOfLines={1} style={[styles.pickerRowTitle, isSelected ? styles.pickerRowTitleActive : null]}>
                          {order.orderNumber}
                        </Text>
                        <Text numberOfLines={1} style={styles.pickerRowMeta}>
                          {firstItem?.productNameSnapshot
                            ? `${firstItem.productNameSnapshot.slice(0, 32)}${firstItem.productNameSnapshot.length > 32 ? "..." : ""}`
                            : "No items"}
                          {extraItems > 0 ? ` +${extraItems} more` : ""}
                        </Text>
                        <Text style={styles.pickerRowDate}>{formatDate(order.createdAt)}</Text>
                      </View>
                    </View>
                    <View style={styles.pickerRowRight}>
                      <Text style={[styles.pickerRowTotal, isSelected ? styles.pickerRowTotalActive : null]}>
                        {formatOrderDisplayTotal(order)}
                      </Text>
                      {isSelected && (
                        <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={20} strokeWidth={2.2} />
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TrackedOrderResult({ order }: { order: MobileTrackedOrder }) {
  const displayTimeline = useMemo<TrackedTimelineItem[]>(() => {
    // Prefer the customer-facing timeline from the backend
    const customerTimeline = order.customerDeliveryTimeline ?? [];
    if (customerTimeline.length > 0) {
      return customerTimeline.map((event) => ({
        createdAt: event.createdAt ?? null,
        label: event.label ?? formatStatus(event.status ?? "Updated"),
        note: event.note ?? null,
      }));
    }

    // Fall back to status events
    const statusEvents = order.statusEvents ?? [];
    if (statusEvents.length > 0) {
      return statusEvents.map((event) => ({
        createdAt: event.createdAt ?? null,
        label: formatStatus(event.newStatus ?? "Updated"),
        note: event.note ?? null,
      }));
    }

    return [];
  }, [order]);

  const location = shippingLocationLabel(order);

  const subtotal = order.subtotalPaise ?? 0;
  const shipping = order.shippingPaise ?? 0;
  const platformFee = order.platformFeePaise ?? 0;
  const couponDiscount = order.couponDiscountPaise ?? 0;
  const total = order.totalPaise;

  return (
    <View style={styles.resultWrap}>
      {/* Order summary card */}
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIcon}>
            <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={24} strokeWidth={2.1} />
          </View>
          <View style={styles.orderCopy}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderMeta}>Placed {formatDate(order.createdAt)}</Text>
          </View>
          <Text style={styles.orderTotal}>{formatMoney(total, order.currency)}</Text>
        </View>
        <View style={styles.statusRow}>
          <StatusPill label={formatStatus(order.orderStatus)} tone={statusTone(order.orderStatus)} />
          <StatusPill label={formatStatus(order.paymentStatus)} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
          <StatusPill label={formatStatus(order.deliveryStatus)} tone={order.deliveryStatus === "DELIVERED" ? "success" : "neutral"} />
        </View>
      </View>

      {/* Payment breakdown */}
      <InfoSection icon={ShoppingCart01Icon} title="Payment summary">
        <View style={styles.paymentBreakdown}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Subtotal</Text>
            <Text style={styles.paymentValue}>{formatMoney(subtotal, order.currency)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Delivery</Text>
            <Text style={[styles.paymentValue, shipping === 0 && styles.paymentFree]}>
              {shipping === 0 ? "FREE" : formatMoney(shipping, order.currency)}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Platform fee</Text>
            <Text style={styles.paymentValue}>{formatMoney(platformFee, order.currency)}</Text>
          </View>
          {couponDiscount > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Discount</Text>
              <Text style={[styles.paymentValue, styles.paymentDiscount]}>
                -{formatMoney(couponDiscount, order.currency)}
              </Text>
            </View>
          )}
          <View style={[styles.paymentRow, styles.paymentTotalRow]}>
            <Text style={styles.paymentTotalLabel}>Total paid</Text>
            <Text style={styles.paymentTotalValue}>{formatMoney(total, order.currency)}</Text>
          </View>
        </View>
        {order.couponCode ? (
          <View style={styles.couponBadge}>
            <Text style={styles.couponText}>{order.couponTitle ?? order.couponCode}</Text>
          </View>
        ) : null}
      </InfoSection>

      {/* Delivery details */}
      <InfoSection icon={Location01Icon} title="Delivery details">
        <View style={styles.detailGrid}>
          <Detail label="Status" value={formatStatus(order.deliveryDetail?.status ?? order.deliveryStatus)} />
          <Detail label="Tracking" value={order.deliveryDetail?.trackingReference ?? "Not assigned"} />
          <Detail label="Estimated" value={formatDate(order.deliveryDetail?.estimatedDeliveryDate)} />
          <Detail label="Location" value={location} />
          {order.deliveryDetail?.deliveryMode ? (
            <Detail label="Delivery mode" value={formatStatus(order.deliveryDetail.deliveryMode)} />
          ) : null}
          {order.deliveryDetail?.partnerName ? (
            <Detail label="Courier partner" value={order.deliveryDetail.partnerName} />
          ) : null}
          {order.deliveryDetail?.deliveryNote ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Delivery note</Text>
              <Text style={styles.noteText}>{order.deliveryDetail.deliveryNote}</Text>
            </View>
          ) : null}
        </View>
      </InfoSection>

      {/* Items */}
      <InfoSection icon={ShoppingCart01Icon} title="Items">
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemImageWrap}>
              <RemoteImage
                fallbackLabel={item.productNameSnapshot}
                resizeMode="cover"
                style={styles.itemImage}
                uri={resolveImageUrl(item.product?.imageUrl)}
              />
            </View>
            <View style={styles.itemBody}>
              <Text numberOfLines={2} style={styles.itemName}>
                {item.productNameSnapshot}
              </Text>
              <Text style={styles.itemMeta}>
                Qty {item.quantity}
                {item.seller?.storeName ? ` · ${item.seller.storeName}` : ""}
              </Text>
              <Text style={styles.itemPrice}>{formatMoney(item.unitPricePaise, item.currency ?? order.currency, "en-IN")} each</Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(item.lineTotalPaise, item.currency ?? order.currency, "en-IN")}</Text>
          </View>
        ))}
      </InfoSection>

      {/* Tracking timeline */}
      <InfoSection icon={DeliveryBox01Icon} title="Tracking timeline">
        {displayTimeline.length > 0 ? (
          <View style={styles.timeline}>
            {displayTimeline.map((event, index) => (
              <View
                key={`${event.label}-${event.createdAt ?? index}`}
                style={styles.timelineRow}
              >
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, index === 0 ? styles.timelineDotActive : null]} />
                  {index < displayTimeline.length - 1 ? <View style={styles.timelineConnector} /> : null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{event.label}</Text>
                  {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
                  <Text style={styles.timelineDate}>{formatDateTime(event.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helpText}>Tracking updates will appear here as the order progresses.</Text>
        )}
      </InfoSection>
    </View>
  );
}

function InfoSection({ children, icon, title }: { children: ReactNode; icon: typeof PackageIcon; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIconWrap}>
          <HugeiconsIcon color="#FFFFFF" icon={icon} size={18} strokeWidth={2.2} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({
  autoCapitalize,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "phone-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        returnKeyType="done"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function trackedTimeline(order: MobileTrackedOrder): TrackedTimelineItem[] {
  if (order.customerDeliveryTimeline?.length) {
    return order.customerDeliveryTimeline.map((event) => ({
      createdAt: event.createdAt ?? null,
      label: event.label ?? formatStatus(event.status ?? "Updated"),
      note: event.note ?? null,
    }));
  }

  return (order.statusEvents ?? []).map((event) => ({
    createdAt: event.createdAt ?? null,
    label: formatStatus(event.newStatus ?? "Updated"),
    note: event.note ?? null,
  }));
}

function shippingLocationLabel(order: MobileTrackedOrder): string {
  const location = order.shippingLocation;
  if (!location) return "Not shared";
  return [location.city, location.state, location.pincode].filter(Boolean).join(", ") || location.country || "Not shared";
}

function statusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "DELIVERED" || status === "PAID") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "PROCESSING" || status === "PENDING") return "warning";
  return "neutral";
}

export default withStorefrontMaintenance(TrackOrderScreen);

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 120,
  },

  /* ── Header card ── */
  headerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "#FFF0EC",
    borderRadius: 22,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },

  /* ── Form card ── */
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 14,
  },

  /* ── Order picker ── */
  pickerButton: {
    alignItems: "center",
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  pickerSelectedRow: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 12,
  },
  pickerSelectedIcon: {
    alignItems: "center",
    backgroundColor: "#FFF0EC",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  pickerSelectedCopy: {
    flex: 1,
  },
  pickerSelectedNumber: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  pickerSelectedMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  pickerPlaceholderRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  pickerPlaceholder: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },

  /* ── Divider ── */
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F3E7E2",
  },
  dividerText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* ── Buttons ── */
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  /* ── Loading ── */
  loadingState: {
    alignItems: "center",
    paddingVertical: 30,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
  },

  /* ── Result ── */
  resultWrap: {
    gap: 12,
    marginTop: 14,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  orderHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  orderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF0EC",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  orderCopy: {
    flex: 1,
  },
  orderNumber: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  /* ── Sections ── */
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  sectionIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  /* ── Payment breakdown ── */
  paymentBreakdown: {
    gap: 1,
  },
  paymentRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  paymentLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  paymentValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  paymentFree: {
    color: "#15803D",
    fontWeight: "900",
  },
  paymentDiscount: {
    color: "#15803D",
  },
  paymentTotalRow: {
    borderTopColor: "#F3E7E2",
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
  },
  paymentTotalLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  paymentTotalValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  couponBadge: {
    alignItems: "center",
    backgroundColor: "#FFF8F0",
    borderColor: "#FFD7CA",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  couponText: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "900",
  },

  /* ── Delivery details ── */
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailBox: {
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 64,
    padding: 10,
    width: "48%",
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 4,
  },
  noteBox: {
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    padding: 10,
    width: "100%",
  },
  noteLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  noteText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },

  /* ── Items ── */
  itemRow: {
    alignItems: "center",
    borderTopColor: "#F3E7E2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  itemImageWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  itemImage: {
    backgroundColor: "#FFF4EF",
    borderRadius: 12,
    height: 64,
    width: 64,
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  itemPrice: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  itemTotal: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },

  /* ── Timeline ── */
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  timelineLeft: {
    alignItems: "center",
    width: 12,
  },
  timelineDot: {
    backgroundColor: "#F3B8A7",
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineConnector: {
    backgroundColor: "#E8DAD4",
    flex: 1,
    minHeight: 32,
    width: 2,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  timelineNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  timelineDate: {
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  helpText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },

  /* ── Picker modal ── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    backgroundColor: "rgba(17,24,39,0.25)",
    ...StyleSheet.absoluteFill,
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "75%",
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#E8DAD4",
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 46,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  sheetClose: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 40,
  },
  pickerList: {
    paddingHorizontal: 18,
  },
  pickerEmpty: {
    alignItems: "center",
    paddingVertical: 30,
  },
  pickerEmptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  pickerRow: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    padding: 12,
  },
  pickerRowActive: {
    backgroundColor: "#FFF8F5",
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  pickerRowLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 12,
  },
  pickerItemImageWrap: {
    borderRadius: 10,
    overflow: "hidden",
  },
  pickerItemImage: {
    backgroundColor: "#FFF4EF",
    borderRadius: 10,
    height: 48,
    width: 48,
  },
  pickerRowCopy: {
    flex: 1,
  },
  pickerRowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  pickerRowTitleActive: {
    color: colors.primary,
  },
  pickerRowMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  pickerRowDate: {
    color: "#98A2B3",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  pickerRowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  pickerRowTotal: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  pickerRowTotalActive: {
    color: colors.primary,
  },
});
