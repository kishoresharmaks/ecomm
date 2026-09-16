import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  DeliveryBox01Icon,
  FilterHorizontalIcon,
  HeadsetIcon,
  PackageIcon,
  RefreshIcon,
  ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RemoteImage } from "../../src/components/remote-image";
import { EmptyState } from "../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { formatOrderDisplayTotal } from "../../src/features/market/mobile-market";
import { listCustomerOrders, type MobileOrderSummary } from "../../src/features/storefront/storefront-api";
import { accountErrorMessage, formatStatus, RequireAuthGate } from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

type OrderFilter = "all" | "placed" | "processing" | "shipped" | "delivered";

const textColor = "#111827";
const mutedColor = "#6B7280";
const borderColor = "#F3E7E2";

const orderStatusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof PackageIcon }> = {
  PLACED: { label: "Placed", bg: "#FFF8F0", text: "#C2410C", icon: PackageIcon },
  CONFIRMED: { label: "Confirmed", bg: "#FFF8F0", text: "#C2410C", icon: PackageIcon },
  PROCESSING: { label: "Processing", bg: "#FEF3C7", text: "#92400E", icon: PackageIcon },
  SHIPPED: { label: "Shipped", bg: "#F3E8FF", text: "#6B21A8", icon: DeliveryBox01Icon },
  DISPATCHED: { label: "In Transit", bg: "#F3E8FF", text: "#6B21A8", icon: DeliveryBox01Icon },
  IN_TRANSIT: { label: "In Transit", bg: "#F3E8FF", text: "#6B21A8", icon: DeliveryBox01Icon },
  DELIVERED: { label: "Delivered", bg: "#DCFCE7", text: "#15803D", icon: CheckmarkCircle02Icon },
  CANCELLED: { label: "Cancelled", bg: "#FEE2E2", text: "#991B1B", icon: PackageIcon },
};

const ordersPageSize = 20;

export default function OrdersScreen() {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const ordersQuery = useInfiniteQuery({
    queryKey: ["mobile-orders", customerAuth.authKey],
    queryFn: ({ pageParam }) => listCustomerOrders(customerAuth.authHeaders, ordersPageSize, pageParam),
    enabled: customerAuth.enabled,
    refetchOnMount: "always",
    staleTime: 0,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.items.length >= ordersPageSize ? lastPageParam + 1 : undefined,
  });

  const orders = useMemo(
    () => ordersQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ordersQuery.data?.pages],
  );

  const totalOrderCount = ordersQuery.data?.pages[0]?.total ?? orders.length;
  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesOrderFilter(order, activeFilter)),
    [orders, activeFilter],
  );

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || ordersQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OrdersTitleBlock />
        <View style={styles.centerState}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator color={colors.primary} />
          </View>
          <Text style={styles.stateText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customerAuth.enabled) {
    return <RequireAuthGate title="Sign in to view orders" message="Your order history, tracking, and support requests are linked to your 1HandIndia account." />;
  }

  if (ordersQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OrdersTitleBlock />
        <View style={styles.emptyPanelWrap}>
          <View style={styles.emptyPanel}>
            <EmptyState title="Orders could not load" message={accountErrorMessage(ordersQuery.error, "Check your connection and refresh orders.")} />
            <Pressable style={styles.primaryButton} onPress={() => void ordersQuery.refetch()}>
              <Text style={styles.primaryButtonText}>Retry orders</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlashList
        contentContainerStyle={styles.listContent}
        data={visibleOrders}
        keyExtractor={(order) => order.id}
        onEndReached={() => {
          if (ordersQuery.hasNextPage && !ordersQuery.isFetchingNextPage) {
            void ordersQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.emptyPanel}>
            <EmptyState
              title={orders.length > 0 ? `No ${filterLabel(activeFilter).toLowerCase()} orders` : "No orders yet"}
              message={orders.length > 0 ? "Try another status filter to see more orders." : "Orders placed from checkout will appear here with tracking and support options."}
            />
            {orders.length > 0 ? (
              <Pressable style={styles.secondaryButton} onPress={() => setActiveFilter("all")}>
                <Text style={styles.secondaryButtonText}>Show all orders</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <>
            {ordersQuery.isFetchingNextPage ? (
              <View style={styles.loadingMoreRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.loadingMoreText}>Loading more orders...</Text>
              </View>
            ) : null}
            <SupportCard />
          </>
        }
        ListHeaderComponent={
          <OrdersListHeader
            activeFilter={activeFilter}
            isFetching={ordersQuery.isFetching && !ordersQuery.isFetchingNextPage}
            orderCount={visibleOrders.length}
            totalCount={totalOrderCount}
            onFilterChange={setActiveFilter}
            onOpenFilter={() => setFilterOpen(true)}
            onRefresh={() => void ordersQuery.refetch()}
            onViewAll={() => setActiveFilter("all")}
          />
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
      <OrderFilterModal
        activeFilter={activeFilter}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onSelect={(value) => {
          setActiveFilter(value);
          setFilterOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function OrdersListHeader({
  activeFilter,
  isFetching,
  orderCount,
  totalCount,
  onFilterChange,
  onOpenFilter,
  onRefresh,
  onViewAll,
}: {
  activeFilter: OrderFilter;
  isFetching: boolean;
  orderCount: number;
  totalCount: number;
  onFilterChange: (filter: OrderFilter) => void;
  onOpenFilter: () => void;
  onRefresh: () => void;
  onViewAll: () => void;
}) {
  return (
    <View style={styles.header}>
      {/* Consistent header row matching Categories */}
      <View style={styles.headerTopRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerMark}>
            <HugeiconsIcon color="#FFFFFF" icon={PackageIcon} size={24} strokeWidth={2.2} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Track and manage your orders</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" style={styles.iconButton} onPress={onRefresh}>
            {isFetching ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={22} strokeWidth={2.2} />
            )}
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.iconButton} onPress={onOpenFilter}>
            <HugeiconsIcon color={colors.primary} icon={FilterHorizontalIcon} size={22} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {filterChips.map((chip) => (
          <Pressable
            key={chip.value}
            style={[styles.filterChip, activeFilter === chip.value ? styles.filterChipActive : null]}
            onPress={() => onFilterChange(chip.value)}
          >
            <Text style={[styles.filterChipText, activeFilter === chip.value ? styles.filterChipTextActive : null]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Results summary */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>
          {orderCount} {activeFilter === "all" ? "Recent" : filterLabel(activeFilter)} {orderCount === 1 ? "Order" : "Orders"}
        </Text>
        {activeFilter !== "all" ? (
          <Pressable onPress={onViewAll}>
            <Text style={styles.viewAllText}>View all orders</Text>
          </Pressable>
        ) : (
          <Text style={styles.viewAllText}>{totalCount} total</Text>
        )}
      </View>
    </View>
  );
}

function OrdersTitleBlock() {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>My Orders</Text>
      <Text style={styles.subtitle}>Track and manage your orders</Text>
    </View>
  );
}

function OrderCard({ order }: { order: MobileOrderSummary }) {
  const router = useRouter();
  const firstItem = order.items?.[0];
  const extraItems = Math.max(0, (order.items?.length ?? 0) - 1);
  const isCancelled = order.orderStatus === "CANCELLED";
  const statusConfig = (orderStatusConfig[order.orderStatus] ?? orderStatusConfig[order.deliveryStatus] ?? orderStatusConfig.PLACED)!;
  const StatusIcon = statusConfig.icon;

  function openOrder() {
    router.push(`/orders/${order.orderNumber}` as never);
  }

  function handleBuyAgain() {
    if (isCancelled || !firstItem?.product?.slug) {
      openOrder();
      return;
    }
    router.push(`/product/${firstItem.product.slug}` as never);
  }

  return (
    <View style={styles.orderCard}>
      {/* Top row: order number + status badge + total */}
      <Pressable style={styles.orderHeaderRow} onPress={openOrder}>
        <View style={styles.orderHeaderLeft}>
          <View style={styles.orderNumberBox}>
            <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={20} strokeWidth={2.1} />
          </View>
          <View style={styles.orderHeaderText}>
            <Text numberOfLines={1} style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.orderHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <HugeiconsIcon color={statusConfig.text} icon={StatusIcon} size={13} strokeWidth={2.2} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
          </View>
          <Text style={styles.orderTotal}>{formatOrderDisplayTotal(order)}</Text>
        </View>
      </Pressable>

      {/* Product photo + name + actions */}
      <Pressable style={styles.orderBody} onPress={openOrder}>
        {firstItem ? (
          <View style={styles.itemSection}>
            {/* Product image */}
            <View style={styles.itemImageWrap}>
              <RemoteImage
                fallbackLabel={firstItem.productNameSnapshot}
                resizeMode="cover"
                style={styles.itemImage}
                uri={resolveImageUrl(firstItem.product?.imageUrl ?? firstItem.product?.images?.[0]?.url ?? null)}
              />
              {extraItems > 0 && (
                <View style={styles.extraItemsBadge}>
                  <Text style={styles.extraItemsText}>+{extraItems}</Text>
                </View>
              )}
            </View>

            {/* Product details */}
            <View style={styles.itemDetails}>
              <Text numberOfLines={2} style={styles.itemName}>
                {firstItem.productNameSnapshot}
              </Text>
              <Text style={styles.itemMeta}>
                Qty {firstItem.quantity}
                {firstItem.seller?.storeName ? ` · ${firstItem.seller.storeName}` : ""}
              </Text>
              <Text style={styles.itemPrice}>
                {formatMoney(firstItem.lineTotalPaise, order.currency)}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <Pressable style={styles.detailsButton} onPress={openOrder}>
          <Text style={styles.detailsButtonText}>Order Details</Text>
          <HugeiconsIcon color={mutedColor} icon={ArrowRight02Icon} size={18} strokeWidth={2.2} />
        </Pressable>
        {!isCancelled ? (
          <Pressable style={styles.buyAgainButton} onPress={handleBuyAgain}>
            <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={18} strokeWidth={2.2} />
            <Text style={styles.buyAgainText}>Buy Again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function SupportCard() {
  const router = useRouter();
  return (
    <Pressable style={styles.supportCard} onPress={() => router.push("/account/support" as never)}>
      <View style={styles.supportIcon}>
        <HugeiconsIcon color={colors.primary} icon={HeadsetIcon} size={26} strokeWidth={2.1} />
      </View>
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle}>Need help with your order?</Text>
        <Text style={styles.supportText}>Our support team is here to help you.</Text>
      </View>
      <HugeiconsIcon color={mutedColor} icon={ArrowRight02Icon} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

function OrderFilterModal({
  activeFilter,
  open,
  onClose,
  onSelect,
}: {
  activeFilter: OrderFilter;
  open: boolean;
  onClose: () => void;
  onSelect: (filter: OrderFilter) => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleBlock}>
              <Text style={styles.sheetTitle}>Filter orders</Text>
              <Text style={styles.sheetSubtitle}>Choose the order stage you want to review.</Text>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <Text style={styles.sheetCloseText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.sheetOptions}>
            {filterChips.map((chip) => (
              <Pressable
                key={chip.value}
                style={[styles.sheetOption, activeFilter === chip.value ? styles.sheetOptionActive : null]}
                onPress={() => onSelect(chip.value)}
              >
                <View style={[styles.sheetOptionIcon, activeFilter === chip.value ? styles.sheetOptionIconActive : null]}>
                  <HugeiconsIcon
                    color={activeFilter === chip.value ? colors.surface : colors.primary}
                    icon={chip.icon}
                    size={22}
                    strokeWidth={2.15}
                  />
                </View>
                <View style={styles.sheetOptionCopy}>
                  <Text style={[styles.sheetOptionTitle, activeFilter === chip.value ? styles.sheetOptionTitleActive : null]}>
                    {chip.label}
                  </Text>
                  <Text style={[styles.sheetOptionText, activeFilter === chip.value ? styles.sheetOptionTextActive : null]}>
                    {chip.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const filterChips: Array<{ icon: typeof PackageIcon; label: string; value: OrderFilter; description: string }> = [
  { icon: ShoppingCart01Icon, label: "All Orders", value: "all", description: "Show every order in your account." },
  { icon: PackageIcon, label: "Placed", value: "placed", description: "Orders received and waiting for seller action." },
  { icon: PackageIcon, label: "Processing", value: "processing", description: "Orders currently being prepared." },
  { icon: DeliveryBox01Icon, label: "Shipped", value: "shipped", description: "Orders dispatched or in transit." },
  { icon: CheckmarkCircle02Icon, label: "Delivered", value: "delivered", description: "Orders successfully delivered." },
];

function matchesOrderFilter(order: MobileOrderSummary, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "placed") return order.orderStatus === "PLACED" || order.orderStatus === "CONFIRMED";
  if (filter === "processing") return order.orderStatus === "PROCESSING";
  if (filter === "shipped") return order.orderStatus === "SHIPPED" || order.deliveryStatus === "DISPATCHED" || order.deliveryStatus === "IN_TRANSIT";
  return order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
}

function formatOrderDate(value?: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatMoney(paise: number | undefined, currency: string) {
  if (typeof paise !== "number") return "";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(rupees);
}

function filterLabel(filter: OrderFilter) {
  return filterChips.find((c) => c.value === filter)?.label.replace("All Orders", "Recent") ?? "Recent";
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFCFB",
    flex: 1,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  loadingIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 58,
    justifyContent: "center",
    marginBottom: 12,
    width: 58,
  },
  stateText: {
    color: mutedColor,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },

  /* ── Header ── */
  header: {
    backgroundColor: colors.secondary,
    gap: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  headerMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 48,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 28,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    width: 48,
  },

  /* ── Filter chips ── */
  filterRail: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: borderColor,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: "#FFF8F5",
    borderColor: colors.primary,
  },
  filterChipText: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: "900",
  },

  /* ── Section header ── */
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionHeading: {
    color: textColor,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  /* ── Order card ── */
  listContent: {
    padding: 16,
    paddingBottom: 140,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderColor: borderColor,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: "#111827",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
    overflow: "hidden",
  },
  orderHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    paddingBottom: 12,
  },
  orderHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  orderNumberBox: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  orderHeaderText: {
    flex: 1,
  },
  orderNumber: {
    color: textColor,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  orderDate: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  orderHeaderRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  /* ── Product section ── */
  orderBody: {
    borderTopColor: borderColor,
    borderTopWidth: 1,
  },
  itemSection: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  itemImageWrap: {
    position: "relative",
  },
  itemImage: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    height: 88,
    width: 88,
  },
  extraItemsBadge: {
    alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.7)",
    borderRadius: 999,
    bottom: -4,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: -4,
    width: 22,
  },
  extraItemsText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  itemDetails: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  itemName: {
    color: textColor,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  itemMeta: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  itemPrice: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 6,
  },

  /* ── Actions ── */
  cardActions: {
    borderTopColor: borderColor,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
    paddingTop: 12,
  },
  detailsButton: {
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderColor: borderColor,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 48,
  },
  detailsButtonText: {
    color: textColor,
    fontSize: 13,
    fontWeight: "900",
  },
  buyAgainButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 14,
    borderColor: colors.primary,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 48,
  },
  buyAgainText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },

  /* ── Empty ── */
  emptyPanelWrap: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  emptyPanel: {
    backgroundColor: colors.surface,
    borderColor: borderColor,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: textColor,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
  },
  subtitle: {
    color: mutedColor,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 2,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 54,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },

  /* ── Support ── */
  supportCard: {
    alignItems: "center",
    backgroundColor: "#FFF6F2",
    borderColor: "#FFD9CC",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
    padding: 18,
  },
  supportIcon: {
    alignItems: "center",
    backgroundColor: "#FFE9E1",
    borderRadius: 16,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  supportCopy: {
    flex: 1,
  },
  supportTitle: {
    color: textColor,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  supportText: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 2,
  },

  /* ── Loading more ── */
  loadingMoreRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  loadingMoreText: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "800",
  },

  /* ── Filter modal ── */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17,24,39,0.25)",
  },
  filterSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#E8DAD4",
    borderRadius: 999,
    height: 5,
    marginBottom: 16,
    width: 46,
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitleBlock: {
    flex: 1,
  },
  sheetTitle: {
    color: textColor,
    fontSize: 22,
    fontWeight: "900",
  },
  sheetSubtitle: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  sheetCloseButton: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sheetCloseText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  sheetOptions: {
    gap: 10,
    marginTop: 20,
  },
  sheetOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: borderColor,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 72,
    padding: 14,
  },
  sheetOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetOptionCopy: {
    flex: 1,
  },
  sheetOptionIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sheetOptionIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  sheetOptionTitle: {
    color: textColor,
    fontSize: 15,
    fontWeight: "900",
  },
  sheetOptionTitleActive: {
    color: colors.surface,
  },
  sheetOptionText: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 3,
  },
  sheetOptionTextActive: {
    color: "rgba(255,255,255,0.8)",
  },
});
