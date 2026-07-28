import {
  ArrowRight01Icon,
  TruckReturnIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  OperationsEmptyState,
  OperationsFilters,
  OperationsHeader,
  OperationsInlineError,
  OperationsSearch,
} from "../../src/components/operations-ui";
import {
  Button,
  QueryErrorState,
  Screen,
  Skeleton,
  StatusChip,
} from "../../src/components/screen";
import {
  formatOperationDate,
  operationStatus,
} from "../../src/features/seller/operations-presentation";
import {
  listSellerReturns,
  type SellerReturn,
} from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

const PAGE_SIZE = 30;
const TABLET_BREAKPOINT = 700;
type ReturnFilter = "ALL" | SellerReturn["status"];

const RETURN_FILTERS: ReadonlyArray<{ label: string; value: ReturnFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Needs review", value: "PENDING_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Pickup pending", value: "PICKUP_PENDING" },
  { label: "In transit", value: "IN_TRANSIT" },
  { label: "Received", value: "RECEIVED" },
  { label: "QC passed", value: "QC_PASSED" },
  { label: "QC failed", value: "QC_FAILED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function ReturnsScreen() {
  const auth = useMobileSellerAuth();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<ReturnFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const returnsQuery = useInfiniteQuery({
    queryKey: ["seller-returns", auth.authKey, debouncedSearch, filter],
    queryFn: ({ pageParam }) =>
      listSellerReturns(auth.authHeaders, {
        limit: PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filter !== "ALL" ? { status: filter } : {}),
      }),
    enabled: auth.enabled,
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });

  const returns = useMemo(
    () => returnsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [returnsQuery.data?.pages],
  );
  const summary = returnsQuery.data?.pages[0]?.summary;
  const columns = width >= TABLET_BREAKPOINT ? 2 : 1;
  const updating =
    returnsQuery.isFetching
    && !returnsQuery.isFetchingNextPage
    && !refreshing
    && returns.length > 0;

  async function refreshReturns() {
    setRefreshing(true);
    try {
      await returnsQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (!auth.enabled || (returnsQuery.isLoading && !returnsQuery.data)) {
    return <ReturnsSkeleton />;
  }

  if (returnsQuery.isError && !returnsQuery.data) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <OperationsHeader
          title="Returns"
          subtitle="Review customer evidence, make seller decisions, and follow reverse pickup and QC."
        />
        <QueryErrorState
          title="Returns could not be loaded"
          message={returnsQuery.error instanceof Error ? returnsQuery.error.message : undefined}
          onRetry={() => {
            void returnsQuery.refetch();
          }}
          retrying={returnsQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      <FlatList
        key={`return-grid-${columns}`}
        data={returns}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          returns.length === 0 ? styles.emptyListContent : null,
        ]}
        {...(columns > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => {
              void refreshReturns();
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <OperationsHeader
              countLabel={
                updating
                  ? "Updating returns..."
                  : filter === "ALL" && !debouncedSearch && summary
                    ? `${summary.total} ${summary.total === 1 ? "return" : "returns"}`
                    : `${returns.length} loaded in this view`
              }
              title="Returns"
              subtitle="Review customer evidence, make seller decisions, and follow reverse pickup and QC."
            />
            {summary && filter === "ALL" && !debouncedSearch ? (
              <View style={styles.summaryRow}>
                <SummaryValue label="Needs review" value={summary.pending} warning />
                <SummaryValue label="Approved" value={summary.approved} />
                <SummaryValue label="Resolved" value={summary.refunded} />
              </View>
            ) : null}
            <OperationsSearch
              onChangeText={setSearchValue}
              placeholder="Search return or order number"
              value={searchValue}
            />
            <OperationsFilters
              onChange={setFilter}
              options={RETURN_FILTERS}
              value={filter}
            />
            {returnsQuery.isError && !returnsQuery.isFetchNextPageError ? (
              <OperationsInlineError
                message={
                  returnsQuery.error instanceof Error
                    ? returnsQuery.error.message
                    : "Check your connection and try again."
                }
                onRetry={() => {
                  void returnsQuery.refetch();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <OperationsEmptyState
            action={
              filter !== "ALL" || debouncedSearch
                ? {
                    label: "Clear filters",
                    onPress: () => {
                      setFilter("ALL");
                      setSearchValue("");
                      setDebouncedSearch("");
                    },
                  }
                : undefined
            }
            icon={TruckReturnIcon}
            title={filter !== "ALL" || debouncedSearch ? "No matching returns" : "No return requests"}
            message={
              filter !== "ALL" || debouncedSearch
                ? "Try another reference or clear the selected return status."
                : "Customer return requests for your products will appear here."
            }
          />
        }
        ListFooterComponent={
          <ReturnsFooter
            hasNextPage={Boolean(returnsQuery.hasNextPage)}
            isError={returnsQuery.isFetchNextPageError}
            loading={returnsQuery.isFetchingNextPage}
            onLoadMore={() => {
              void returnsQuery.fetchNextPage();
            }}
            returnCount={returns.length}
          />
        }
        ItemSeparatorComponent={ReturnSeparator}
        renderItem={({ item }) => (
          <View style={[styles.itemCell, columns > 1 ? styles.tabletCell : null]}>
            <ReturnRow
              item={item}
              onPress={() =>
                router.push(`/returns/${encodeURIComponent(item.requestNumber)}` as Href)
              }
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function SummaryValue({
  label,
  value,
  warning,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <View style={[styles.summaryTile, warning && value > 0 ? styles.summaryWarning : null]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ReturnRow({ item, onPress }: { item: SellerReturn; onPress: () => void }) {
  const status = operationStatus(item.status);
  const firstItem = item.items[0];
  const productLabel = firstItem
    ? `${firstItem.productName}${item.items.length > 1 ? ` +${item.items.length - 1} more` : ""}`
    : "Return item";
  const customer = item.customer?.name ?? item.customerName ?? "Customer";
  const amount = item.approvedAmountPaise ?? item.requestedAmountPaise;

  return (
    <Pressable
      accessibilityLabel={`Open return ${item.requestNumber}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.returnRow, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowHeader}>
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.requestNumber}>{item.requestNumber}</Text>
          <Text style={styles.date}>{formatOperationDate(item.createdAt)}</Text>
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={19} strokeWidth={2} />
      </View>
      <StatusChip label={status.label} tone={status.tone} />
      <View style={styles.returnCopy}>
        <Text numberOfLines={2} style={styles.product}>{productLabel}</Text>
        <Text numberOfLines={1} style={styles.meta}>Customer: {customer}</Text>
        <Text numberOfLines={1} style={styles.meta}>Order: {item.order.orderNumber}</Text>
        <Text numberOfLines={2} style={styles.reason}>{item.reason}</Text>
      </View>
      <View style={styles.returnFooter}>
        <Text style={styles.quantity}>{item.totalQuantity} {item.totalQuantity === 1 ? "item" : "items"}</Text>
        {typeof amount === "number" ? (
          <Text style={styles.amount}>{formatMoney(amount, item.currency ?? "INR")}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ReturnsFooter({
  hasNextPage,
  isError,
  loading,
  onLoadMore,
  returnCount,
}: {
  hasNextPage: boolean;
  isError: boolean;
  loading: boolean;
  onLoadMore: () => void;
  returnCount: number;
}) {
  if (!returnCount) return null;
  if (isError) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerError}>More returns could not be loaded.</Text>
        <Button title="Retry" tone="secondary" onPress={onLoadMore} style={styles.footerButton} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.footerText}>Loading more returns...</Text>
      </View>
    );
  }
  if (hasNextPage) {
    return (
      <Button title="Load more returns" tone="secondary" onPress={onLoadMore} style={styles.loadMore} />
    );
  }
  return <Text style={styles.endText}>All returns in this view are shown.</Text>;
}

function ReturnsSkeleton() {
  return (
    <Screen contentContainerStyle={styles.skeletonScreen}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonEyebrow}><Skeleton height={12} /></View>
        <View style={styles.skeletonTitle}><Skeleton height={34} /></View>
        <Skeleton height={58} />
        <Skeleton height={48} />
        <Skeleton height={44} />
      </View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <Skeleton height={28} />
          <Skeleton height={42} />
          <Skeleton height={52} />
        </View>
      ))}
    </Screen>
  );
}

function ReturnSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    padding: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  summaryTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 64,
    padding: spacing.sm,
  },
  summaryWarning: {
    borderColor: "#F0B8A8",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  columnRow: {
    gap: spacing.sm,
  },
  itemCell: {
    flex: 1,
  },
  tabletCell: {
    flexBasis: "48%",
    maxWidth: "49.4%",
  },
  separator: {
    height: spacing.sm,
  },
  returnRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minHeight: 244,
    padding: spacing.md,
  },
  rowHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  requestNumber: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  date: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  returnCopy: {
    gap: 3,
  },
  product: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  reason: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  returnFooter: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: spacing.sm,
  },
  quantity: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  amount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    backgroundColor: colors.softSurface,
    opacity: 0.78,
  },
  footer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  footerError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  footerButton: {
    minWidth: 120,
  },
  loadingMore: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingTop: spacing.sm,
  },
  footerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  loadMore: {
    alignSelf: "center",
    marginTop: spacing.lg,
    minWidth: 180,
  },
  endText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    paddingTop: spacing.lg,
    textAlign: "center",
  },
  errorScreen: {
    gap: spacing.lg,
  },
  skeletonScreen: {
    gap: spacing.sm,
  },
  skeletonHeader: {
    gap: spacing.md,
  },
  skeletonEyebrow: {
    width: 150,
  },
  skeletonTitle: {
    width: 180,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
});
