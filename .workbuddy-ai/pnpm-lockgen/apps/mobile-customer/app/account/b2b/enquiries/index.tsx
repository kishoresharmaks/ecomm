import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../../src/components/screen";
import { EmptyState } from "../../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import {
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
} from "../../../../src/features/b2b/b2b-enquiry-status";
import { listB2BEnquiries } from "../../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../../src/theme";
import type { B2BEnquiryStatus } from "../../../../src/features/b2b/b2b-types";

const STATUS_FILTERS: Array<{ label: string; value: B2BEnquiryStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Open", value: "SUBMITTED" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Responded", value: "RESPONDED" },
  { label: "Confirmed", value: "BUYER_CONFIRMED" },
  { label: "Finalised", value: "FINALISED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function EnquiryListContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<B2BEnquiryStatus | "">("");
  const [page, setPage] = useState(1);

  const enquiriesQuery = useQuery({
    queryKey: ["b2b-enquiries", customerAuth.authKey, search, statusFilter, page],
    queryFn: () =>
      listB2BEnquiries(customerAuth.authHeaders, {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        page,
        limit: 20,
      }),
    enabled: customerAuth.enabled,
  });

  const items = enquiriesQuery.data?.items ?? [];
  const total = enquiriesQuery.data?.total ?? 0;
  const hasMore = items.length < total;

  return (
    <View style={{ flex: 1 }}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={18} strokeWidth={2} />
          <TextInput
            onChangeText={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search enquiries..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
        </View>
      </View>

      {/* Status filter chips */}
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
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {enquiriesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <EmptyState
              title="No enquiries yet"
              message="Tap the button below to send your first B2B enquiry."
            />
          ) : (
            items.map((enq) => (
              <Pressable
                key={enq.id}
                style={styles.card}
                onPress={() => router.push(`/account/b2b/enquiries/${enq.id}` as never)}
              >
                <View style={styles.cardBody}>
                  <Text numberOfLines={1} style={styles.cardTitle}>
                    {enq.product?.name ?? enq.seller?.storeName ?? "General enquiry"}
                  </Text>
                  <Text style={styles.cardMeta}>Qty: {enq.quantity}</Text>
                  {enq.createdAt ? (
                    <Text style={styles.cardDate}>{formatDate(enq.createdAt)}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: ENQUIRY_STATUS_COLOR[enq.status] + "22" },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: ENQUIRY_STATUS_COLOR[enq.status] }]}>
                    {ENQUIRY_STATUS_LABEL[enq.status]}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          {hasMore && (
            <Pressable
              style={styles.loadMoreBtn}
              onPress={() => setPage((p) => p + 1)}
            >
              <Text style={styles.loadMoreText}>Load more</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <Pressable
        style={styles.fabBtn}
        onPress={() => router.push("/account/b2b/enquiries/new" as never)}
      >
        <Text style={styles.fabText}>+ New Enquiry</Text>
      </Pressable>
    </View>
  );
}

export default function B2BEnquiryListScreen() {
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "My Enquiries" }} />
      <B2BAuthGate>
        <EnquiryListContent />
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
  filterRow: { gap: spacing.sm, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
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
  list: { gap: spacing.sm, paddingBottom: 100, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
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
  fabBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 30,
    bottom: spacing.xl,
    elevation: 4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    position: "absolute",
    right: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
