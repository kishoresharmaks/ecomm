import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import { openB2BWeb } from "../../../../src/features/b2b/b2b-web-redirect";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import { getB2BOrder } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";
import type { B2BOrder } from "../../../../src/features/b2b/b2b-types";

function B2BOrderDetailContent({ order }: { order: B2BOrder }) {
  const statusColor = ORDER_STATUS_COLOR[order.status];
  const statusLabel = ORDER_STATUS_LABEL[order.status];
  const title = order.product?.name ?? order.seller?.storeName ?? `Order ${order.orderNumber}`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
        <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="Proforma" value={order.proformaInvoiceNumber} />
        <InfoRow label="Quantity" value={`${order.quantity}`} />
        <InfoRow label="Order no." value={order.orderNumber} />
        {order.proformaIssuedAt ? <InfoRow label="Issued" value={formatDate(order.proformaIssuedAt)} /> : null}
        {order.unitPricePaise ? <InfoRow label="Unit price" value={formatMoney(order.unitPricePaise)} /> : null}
        {order.subtotalPaise ? <InfoRow label="Subtotal" value={formatMoney(order.subtotalPaise)} /> : null}
        {order.proformaExpiresAt ? <InfoRow label="Expires" value={formatDate(order.proformaExpiresAt)} /> : null}
      </View>

      {order.purchaseOrderNumber ? (
        <View style={styles.poCard}>
          <Text style={styles.poLabel}>Purchase order</Text>
          <Text style={styles.poValue}>{order.purchaseOrderNumber}</Text>
          {order.purchaseOrderSubmittedAt ? (
            <Text style={styles.poDate}>{formatDate(order.purchaseOrderSubmittedAt)}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cardSpacer} />

      <Pressable style={styles.primaryBtn} onPress={() => openB2BWeb(`/b2b/orders/${order.orderNumber}`)}>
        <Text style={styles.primaryBtnText}>Open full order on web</Text>
      </Pressable>

      {order.events && order.events.length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>Recent updates</Text>
          {order.events.slice(0, 5).map((ev) => (
            <View key={ev.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineBody}>
                <Text style={styles.timelineStatus}>{ORDER_STATUS_LABEL[ev.status]}</Text>
                {ev.note ? <Text style={styles.timelineNote}>{ev.note}</Text> : null}
                {ev.createdAt ? (
                  <Text style={styles.timelineDate}>{formatDate(ev.createdAt)}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function B2BOrderDetailScreen() {
  const customerAuth = useMobileCustomerAuth();
  const params = useLocalSearchParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber ?? "";

  const orderQuery = useQuery({
    queryKey: ["b2b-order", customerAuth.authKey, orderNumber],
    queryFn: () => getB2BOrder(customerAuth.authHeaders, orderNumber),
    enabled: customerAuth.enabled && Boolean(orderNumber),
  });

  if (orderQuery.isLoading) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ headerShown: true, title: "B2B Order" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading order...</Text>
        </View>
      </Screen>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ headerShown: true, title: "B2B Order" }} />
        <EmptyState title="Could not load order" message="Check your connection and try again." />
        <Pressable style={styles.retryBtn} onPress={() => void orderQuery.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{ headerShown: true, title: orderQuery.data.proformaInvoiceNumber }}
      />
      <B2BAuthGate requireProfile={false}>
        <B2BOrderDetailContent order={orderQuery.data} />
      </B2BAuthGate>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatMoney(paise: number) {
  return `Rs. ${(paise / 100).toFixed(2)}`;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  loadingText: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: { fontSize: 14, fontWeight: "800" },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  infoValue: { color: colors.ink, fontSize: 13, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  poCard: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.md,
  },
  poLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 2 },
  poValue: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  poDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cardSpacer: { height: spacing.lg },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: spacing.md,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  timeline: { gap: spacing.sm },
  timelineTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  timelineItem: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  timelineBody: { flex: 1 },
  timelineStatus: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  timelineNote: { color: colors.muted, fontSize: 13, marginTop: 2 },
  timelineDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  retryBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  retryBtnText: { color: "#fff", fontWeight: "700" },
});
