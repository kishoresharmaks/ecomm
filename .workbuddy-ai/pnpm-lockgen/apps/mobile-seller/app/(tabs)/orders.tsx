import {
  ArrowRight01Icon,
  PackageIcon,
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
  SELLER_ORDER_FILTERS,
  formatOperationDate,
  matchesSellerOrderFilter,
  operationStatus,
  sellerOrderStage,
  type SellerOrderViewFilter,
} from "../../src/features/seller/operations-presentation";
import {
  listSellerOrders,
  type SellerOrder,
} from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

const PAGE_SIZE = 30;
const TABLET_BREAKPOINT = 700;

export default function SellerOrdersScreen() {
  const auth = useMobileSellerAuth();
  const { width } = useWindowDimensions();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<SellerOrderViewFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const ordersQuery = useInfiniteQuery({
    queryKey: ["seller-orders", auth.authKey, debouncedSearch],
    queryFn: ({ pageParam }) =>
      listSellerOrders(auth.authHeaders, {
        page: pageParam,
        limit: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: auth.enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });

  const loadedOrders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data?.pages],
  );
  const orders = useMemo(
    () => loadedOrders.filter((order) => matchesSellerOrderFilter(order, filter)),
    [filter, loadedOrders],
  );
  const total = ordersQuery.data?.pages[0]?.total ?? loadedOrders.length;
  const columns = width >= TABLET_BREAKPOINT ? 2 : 1;
  const updating =
    ordersQuery.isFetching
    && !ordersQuery.isFetchingNextPage
    && !refreshing
    && loadedOrders.length > 0;

  async function refreshOrders() {
    setRefreshing(true);
    try {
      await ordersQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (!auth.enabled || (ordersQuery.isLoading && !ordersQuery.data)) {
    return <OrderListSkeleton />;
  }

  if (ordersQuery.isError && !ordersQuery.data) {
    return (
      <Screen contentContainerStyle={styles.errorScreen}>
        <OperationsHeader
          title="Orders"
          subtitle="Accept, prepare, dispatch, track, and complete seller fulfilment."
        />
        <QueryErrorState
          title="Orders could not be loaded"
          message={ordersQuery.error instanceof Error ? ordersQuery.error.message : undefined}
          onRetry={() => {
            void ordersQuery.refetch();
          }}
          retrying={ordersQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      <FlatList
        key={`order-grid-${columns}`}
        data={orders}
        keyExtractor={(order) => order.id}
        numColumns={columns}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          orders.length === 0 ? styles.emptyListContent : null,
        ]}
        {...(columns > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => {
              void refreshOrders();
            }}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <OperationsHeader
              action={{
                icon: TruckReturnIcon,
                label: "Returns",
                onPress: () => router.push("/returns" as Href),
              }}
              countLabel={
                updating
                  ? "Updating orders..."
                  : filter === "all"
                    ? `${total} ${total === 1 ? "order" : "orders"}`
                    : `${orders.length} matching in ${loadedOrders.length} loaded`
              }
              title="Orders"
              subtitle="Accept, prepare, dispatch, track, and complete seller fulfilment."
            />
            <OperationsSearch
              onChangeText={setSearchValue}
              placeholder="Search by order number"
              value={searchValue}
            />
            <OperationsFilters
              onChange={setFilter}
              options={SELLER_ORDER_FILTERS}
              value={filter}
            />
            {ordersQuery.isError && !ordersQuery.isFetchNextPageError ? (
              <OperationsInlineError
                message={
                  ordersQuery.error instanceof Error
                    ? ordersQuery.error.message
                    : "Check your connection and try again."
                }
                onRetry={() => {
                  void ordersQuery.refetch();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <OperationsEmptyState
            action={
              filter !== "all" || debouncedSearch
                ? {
                    label: "Clear filters",
                    onPress: () => {
                      setFilter("all");
                      setSearchValue("");
                      setDebouncedSearch("");
                    },
                  }
                : undefined
            }
            icon={PackageIcon}
            title={filter !== "all" || debouncedSearch ? "No matching orders" : "No seller orders yet"}
            message={
              filter !== "all" || debouncedSearch
                ? "Try another order number or clear the selected fulfilment filter."
                : "Orders containing your products will appear here after customer checkout."
            }
          />
        }
        ListFooterComponent={
          <OrderListFooter
            hasNextPage={Boolean(ordersQuery.hasNextPage)}
            isError={ordersQuery.isFetchNextPageError}
            loading={ordersQuery.isFetchingNextPage}
            onLoadMore={() => {
              void ordersQuery.fetchNextPage();
            }}
            orderCount={loadedOrders.length}
          />
        }
        ItemSeparatorComponent={OrderSeparator}
        renderItem={({ item }) => (
          <View style={[styles.itemCell, columns > 1 ? styles.tabletCell : null]}>
            <OrderRow
              order={item}
              onPress={() =>
                router.push(`/orders/${encodeURIComponent(item.orderNumber)}` as Href)
              }
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function OrderRow({ onPress, order }: { onPress: () => void; order: SellerOrder }) {
  const stage = operationStatus(sellerOrderStage(order));
  const delivery = operationStatus(order.deliveryStatus ?? "PENDING");
  const payment = operationStatus(order.paymentStatus ?? "PENDING");
  const sellerAmount =
    order.sellerSplits?.[0]?.sellerSubtotalPaise
    ?? order.totalPaise
    ?? 0;
  const itemCount = (order.items ?? []).reduce(
    (total, item) => total + (item.quantity ?? 1),
    0,
  );
  const firstItem = order.items?.[0]?.productNameSnapshot ?? "Seller order";

  return (
    <Pressable
      accessibilityLabel={`Open order ${order.orderNumber}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.orderRow, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowHeader}>
        <View style={styles.orderIdentity}>
          <Text numberOfLines={1} style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text numberOfLines={1} style={styles.orderDate}>{formatOperationDate(order.createdAt)}</Text>
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={19} strokeWidth={2} />
      </View>
      {order.orderKind === "REPLACEMENT" ? (
        <Text style={styles.replacement}>
          Replacement{order.parentOrder?.orderNumber ? ` for ${order.parentOrder.orderNumber}` : ""}
        </Text>
      ) : null}
      <View style={styles.statusRow}>
        <StatusChip label={stage.label} tone={stage.tone} />
        <StatusChip label={delivery.label} tone={delivery.tone} />
        <StatusChip label={payment.label} tone={payment.tone} />
      </View>
      <View style={styles.orderMeta}>
        <View style={styles.itemCopy}>
          <Text numberOfLines={1} style={styles.itemTitle}>{firstItem}</Text>
          <Text style={styles.itemMeta}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Text>
        </View>
        <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.amount}>
          {formatMoney(sellerAmount, order.currency ?? "INR")}
        </Text>
      </View>
    </Pressable>
  );
}

function OrderListFooter({
  hasNextPage,
  isError,
  loading,
  onLoadMore,
  orderCount,
}: {
  hasNextPage: boolean;
  isError: boolean;
  loading: boolean;
  onLoadMore: () => void;
  orderCount: number;
}) {
  if (!orderCount) return null;
  if (isError) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerError}>More orders could not be loaded.</Text>
        <Button title="Retry" tone="secondary" onPress={onLoadMore} style={styles.footerButton} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.footerText}>Loading more orders...</Text>
      </View>
    );
  }
  if (hasNextPage) {
    return (
      <Button title="Load more orders" tone="secondary" onPress={onLoadMore} style={styles.loadMore} />
    );
  }
  return <Text style={styles.endText}>All loaded orders are shown.</Text>;
}

function OrderListSkeleton() {
  return (
    <Screen contentContainerStyle={styles.skeletonScreen}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonEyebrow}><Skeleton height={12} /></View>
        <View style={styles.skeletonTitle}><Skeleton height={34} /></View>
        <Skeleton height={48} />
        <Skeleton height={44} />
      </View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <Skeleton height={28} />
          <Skeleton height={44} />
          <Skeleton height={38} />
        </View>
      ))}
    </Screen>
  );
}

function OrderSeparator() {
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
  orderRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minHeight: 190,
    padding: spacing.md,
  },
  rowHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  orderIdentity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  orderNumber: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  orderDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  replacement: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  orderMeta: {
    alignItems: "flex-end",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: "auto",
    paddingTop: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  amount: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    maxWidth: 130,
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
