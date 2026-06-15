import {
  DeliveryBox01Icon,
  Location01Icon,
  PackageIcon,
  Search01Icon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useMutation } from "@tanstack/react-query";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMobileCustomerAuth } from "../src/auth/mobile-auth-context";
import { RemoteImage } from "../src/components/remote-image";
import { Screen } from "../src/components/screen";
import { accountErrorMessage, formatDate, formatDateTime, formatStatus, StatusPill } from "../src/features/account/account-ui";
import { formatMoney, formatOrderDisplayTotal } from "../src/features/market/mobile-market";
import { trackOrder, type MobileTrackedOrder } from "../src/features/storefront/storefront-api";
import { resolveImageUrl } from "../src/lib/image-url";
import { colors } from "../src/theme";

type TimelineItem = {
  createdAt: string | null;
  label: string;
  note: string | null;
};

export default function TrackOrderScreen() {
  const customerAuth = useMobileCustomerAuth();
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [contactTouched, setContactTouched] = useState(false);
  const [formError, setFormError] = useState("");
  const profileContact = customerAuth.userProfile.email ?? customerAuth.userProfile.phone ?? "";
  const lookupMutation = useMutation({
    mutationFn: trackOrder,
    onSuccess: () => setFormError(""),
  });

  useEffect(() => {
    if (!contactTouched && !contact.trim() && profileContact) {
      setContact(profileContact);
    }
  }, [contact, contactTouched, profileContact]);

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

    lookupMutation.mutate({ contact: trimmedContact, orderNumber: trimmedOrderNumber });
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Track order" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <HugeiconsIcon color={colors.primary} icon={DeliveryBox01Icon} size={31} strokeWidth={2.15} />
          </View>
          <Text style={styles.title}>Track order</Text>
          <Text style={styles.subtitle}>Use your order number and the email or phone used at checkout.</Text>
        </View>

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
            <Text style={styles.errorText}>{accountErrorMessage(lookupMutation.error, "Order could not be found.")}</Text>
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
            <Text style={styles.primaryButtonText}>{lookupMutation.isPending ? "Checking order..." : "Track order"}</Text>
          </Pressable>
        </View>

        {lookupMutation.data ? <TrackedOrderResult order={lookupMutation.data} /> : null}
      </ScrollView>
    </Screen>
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

function TrackedOrderResult({ order }: { order: MobileTrackedOrder }) {
  const timeline = useMemo(() => trackedTimeline(order), [order]);
  const location = shippingLocationLabel(order);

  return (
    <View style={styles.resultWrap}>
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIcon}>
            <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={27} strokeWidth={2.1} />
          </View>
          <View style={styles.orderCopy}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderMeta}>Placed {formatDate(order.createdAt)}</Text>
          </View>
          <Text style={styles.orderTotal}>{formatOrderDisplayTotal(order)}</Text>
        </View>
        <View style={styles.statusRow}>
          <StatusPill label={order.orderStatus} tone={order.orderStatus === "CANCELLED" ? "danger" : "neutral"} />
          <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "PAID" ? "success" : "warning"} />
          <StatusPill label={order.deliveryStatus} tone={order.deliveryStatus === "DELIVERED" ? "success" : "neutral"} />
        </View>
      </View>

      <InfoSection icon={DeliveryBox01Icon} title="Delivery">
        <View style={styles.detailGrid}>
          <Detail label="Delivery status" value={formatStatus(order.deliveryDetail?.status ?? order.deliveryStatus)} />
          <Detail label="Tracking" value={order.deliveryDetail?.trackingReference ?? "Not assigned"} />
          <Detail label="Estimated" value={formatDate(order.deliveryDetail?.estimatedDeliveryDate)} />
          <Detail label="Location" value={location} />
        </View>
      </InfoSection>

      <InfoSection icon={ShoppingCart01Icon} title="Items">
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <RemoteImage fallbackLabel={item.productNameSnapshot} style={styles.itemImage} uri={resolveImageUrl(item.product?.imageUrl)} />
            <View style={styles.itemBody}>
              <Text numberOfLines={2} style={styles.itemName}>
                {item.productNameSnapshot}
              </Text>
              <Text numberOfLines={1} style={styles.itemMeta}>
                Qty {item.quantity}
                {item.seller?.storeName ? ` - ${item.seller.storeName}` : ""}
              </Text>
              <Text style={styles.itemMeta}>{formatMoney(item.unitPricePaise, item.currency ?? order.currency, "en-IN")} each</Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(item.lineTotalPaise, item.currency ?? order.currency, "en-IN")}</Text>
          </View>
        ))}
      </InfoSection>

      <InfoSection icon={Location01Icon} title="Timeline">
        {timeline.length ? (
          <View style={styles.timeline}>
            {timeline.map((event, index) => (
              <View key={`${event.label}-${event.createdAt ?? index}`} style={styles.timelineRow}>
                <View style={[styles.timelineDot, index === 0 ? styles.timelineDotActive : null]} />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{event.label}</Text>
                  {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
                  <Text style={styles.timelineDate}>{formatDateTime(event.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helpText}>Timeline updates will appear after seller or delivery activity starts.</Text>
        )}
      </InfoSection>
    </View>
  );
}

function InfoSection({ children, icon, title }: { children: ReactNode; icon: IconSvgElement; title: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <HugeiconsIcon color={colors.primary} icon={icon} size={22} strokeWidth={2.1} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
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

function trackedTimeline(order: MobileTrackedOrder): TimelineItem[] {
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

function shippingLocationLabel(order: MobileTrackedOrder) {
  const location = order.shippingLocation;
  if (!location) {
    return "Not shared";
  }

  return [location.city, location.state, location.pincode].filter(Boolean).join(", ") || location.country || "Not shared";
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 120,
  },
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
    fontSize: 26,
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
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
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
  },
  input: {
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 12,
  },
  resultWrap: {
    gap: 12,
    marginTop: 14,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: "#FFE0D6",
    borderRadius: 22,
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
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  orderCopy: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailBox: {
    backgroundColor: "#FFF9F6",
    borderColor: "#FFE0D6",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 70,
    padding: 10,
    width: "48%",
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    marginTop: 5,
  },
  itemRow: {
    alignItems: "center",
    borderTopColor: "#F3E7E2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  itemImage: {
    backgroundColor: "#FFF4EF",
    borderRadius: 12,
    height: 56,
    width: 56,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 2,
  },
  itemTotal: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  timeline: {
    gap: 12,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timelineDot: {
    backgroundColor: "#F3B8A7",
    borderRadius: 999,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineBody: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 18,
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
});
