import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import { listB2BOrders } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";
import type { B2BOrderStatus } from "../../../../src/features/b2b/b2b-types";
import { useRef, useState } from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";

const STATUS_FILTERS: Array<{ label: string; value: B2BOrderStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Proforma", value: "PROFORMA_ISSUED" },
  { label: "PO Submitted", value: "PO_SUBMITTED" },
  { label: "PO Accepted", value: "PO_ACCEPTED" },
  { label: "In Fulfilment", value: "IN_FULFILMENT" },
  { label: "Fulfilled", value: "FULFILLED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function OrderListContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<B2BOrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(text: string) {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(text.trim());
      setPage(1);
    }, 300);
  }

  const ordersQuery = useQuery({
    queryKey: ["b2b-orders", customerAuth.authKey, statusFilter, debouncedSearch, page],
    queryFn: () =>
      listB2BOrders(customerAuth.authHeaders, {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        page,
        limit: 20,
      }),
    enabled: customerAuth.enabled,
  });

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const hasMore = items.length < total;

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={18} strokeWidth={2} />
          <TextInput
            onChangeText={handleSearchChange}
            placeholder="Search orders, proforma, PO..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
        </View>
      </View>
      <ScrollView
        horizontal
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => { setStatusFilter(f.value); setPage(1); }}
          >
            <Text
              style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {ordersQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <EmptyState title="No B2B orders yet" message="Confirmed enquiries will appear here as B2B orders." />
          ) : (
            items.map((order) => {
              const statusColor = ORDER_STATUS_COLOR[order.status];
              return (
                <Pressable
                  key={order.id}
                  style={styles.card}
                  onPress={() => router.push(`/account/b2b/orders/${order.orderNumber}` as never)}
                >
                  <View style={styles.cardBody}>
                    <Text numberOfLines={1} style={styles.cardTitle}>
                      {order.proformaInvoiceNumber}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {order.product?.name ?? "B2B Order"} · Qty {order.quantity}
                    </Text>
                    {order.createdAt ? (
                      <Text style={styles.cardDate}>{formatDate(order.createdAt)}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}

          {hasMore ? (
            <Pressable style={styles.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

export default function B2BOrderListScreen() {
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "B2B Orders" }} />
      <B2BAuthGate>
        <OrderListContent />
      </B2BAuthGate>
    </Screen>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  searchRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 15 },
  filterRow: { gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  filterChip: {
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  cardDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  loadMoreBtn: { alignItems: "center", padding: spacing.lg },
  loadMoreText: { color: colors.primary, fontWeight: "700" },
});
