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
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { formatOrderDisplayTotal } from "../../src/features/market/mobile-market";
import { listCustomerOrders, type MobileOrderSummary } from "../../src/features/storefront/storefront-api";
import { accountErrorMessage, formatStatus } from "../../src/features/account/account-ui";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

type OrderFilter = "all" | "placed" | "processing" | "shipped" | "delivered";
type TimelineStep = {
  color: string;
  completed: boolean;
  dateLabel: string;
  icon: IconSvgElement;
  label: string;
  tone: "primary" | "warning" | "purple" | "success" | "danger";
};

const textColor = "#111827";
const mutedColor = "#6B7280";
const borderColor = "#F3E7E2";
const successColor = "#22C55E";
const warningColor = "#F59E0B";
const purpleColor = "#8B5CF6";
const dangerColor = "#EF4444";
const cardShadow = {
  shadowColor: colors.primary,
  shadowOffset: { height: 8, width: 0 },
  shadowOpacity: 0.06,
  shadowRadius: 30,
  elevation: 2,
};

const filterOptions: Array<{ icon: IconSvgElement; label: string; value: OrderFilter }> = [
  { icon: ShoppingCart01Icon, label: "All Orders", value: "all" },
  { icon: PackageIcon, label: "Placed", value: "placed" },
  { icon: PackageIcon, label: "Processing", value: "processing" },
  { icon: DeliveryBox01Icon, label: "Shipped", value: "shipped" },
  { icon: CheckmarkCircle02Icon, label: "Delivered", value: "delivered" },
];

export default function OrdersScreen() {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const ordersQuery = useQuery({
    queryKey: ["mobile-orders", customerAuth.authKey],
    queryFn: () => listCustomerOrders(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    refetchOnMount: "always",
    staleTime: 0,
  });
  const orders = ordersQuery.data?.items ?? [];
  const visibleOrders = useMemo(() => orders.filter((order) => matchesOrderFilter(order, activeFilter)), [activeFilter, orders]);

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || ordersQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="Loading your orders..." />
      </SafeAreaView>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.signedOutScreen}>
          <OrdersTitleBlock />
          <View style={styles.emptyPanel}>
            <EmptyState title="Sign in to view orders" message="Your order history, tracking, and support requests are linked to your 1HandIndia account." />
            <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/sign-in")}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (ordersQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.signedOutScreen}>
          <OrdersTitleBlock />
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
        ListEmptyComponent={
          <PremiumEmptyState
            activeFilter={activeFilter}
            hasOrders={orders.length > 0}
            onReset={() => setActiveFilter("all")}
          />
        }
        ListFooterComponent={<SupportCard />}
        ListHeaderComponent={
          <OrdersHeader
            activeFilter={activeFilter}
            isFetching={ordersQuery.isFetching}
            orderCount={visibleOrders.length}
            totalCount={orders.length}
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

function OrdersHeader({
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
      <View style={styles.headerTopRow}>
        <OrdersTitleBlock />
        <View style={styles.headerActionRow}>
          <Pressable accessibilityRole="button" style={styles.iconButton} onPress={onRefresh}>
            {isFetching ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={22} strokeWidth={2.2} />
            )}
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.filterButton} onPress={onOpenFilter}>
            <HugeiconsIcon color={colors.primary} icon={FilterHorizontalIcon} size={20} strokeWidth={2.2} />
            <Text style={styles.filterButtonText}>Filter</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {filterOptions.map((option) => (
          <FilterChip
            active={activeFilter === option.value}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onPress={() => onFilterChange(option.value)}
          />
        ))}
      </ScrollView>

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

function FilterChip({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IconSvgElement;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active ? styles.filterChipActive : null]} onPress={onPress}>
      <HugeiconsIcon color={active ? colors.primary : mutedColor} icon={icon} size={18} strokeWidth={2.1} />
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function OrderCard({ order }: { order: MobileOrderSummary }) {
  const router = useRouter();
  const firstItem = order.items?.[0];
  const imageUrl = resolveImageUrl(firstItem?.product?.imageUrl);
  const totalQuantity = (order.items ?? []).reduce((total, item) => total + item.quantity, 0);
  const extraItems = Math.max(0, (order.items?.length ?? 0) - 1);
  const isCancelled = order.orderStatus === "CANCELLED";
  const primaryActionLabel = isCancelled ? "View Reason" : "Buy Again";

  function openOrder() {
    router.push(`/orders/${order.orderNumber}` as never);
  }

  function handlePrimaryAction() {
    if (isCancelled || !firstItem?.product?.slug) {
      openOrder();
      return;
    }

    router.push(`/product/${firstItem.product.slug}` as never);
  }

  return (
    <View style={styles.orderCard}>
      <Pressable style={styles.orderTopRow} onPress={openOrder}>
        <View style={styles.orderIcon}>
          <HugeiconsIcon color={colors.primary} icon={PackageIcon} size={25} strokeWidth={2.15} />
        </View>
        <View style={styles.orderHead}>
          <Text numberOfLines={1} style={styles.orderNumber}>
            {order.orderNumber}
          </Text>
          <Text style={styles.orderDate}>{formatOrderDateTime(order.createdAt)}</Text>
        </View>
        <View style={styles.totalWrap}>
          <Text style={styles.orderTotal}>{formatOrderDisplayTotal(order)}</Text>
          <HugeiconsIcon color={textColor} icon={ArrowRight02Icon} size={22} strokeWidth={2.2} />
        </View>
      </Pressable>

      {firstItem ? (
        <View style={styles.itemRow}>
          <RemoteImage fallbackLabel={firstItem.productNameSnapshot} resizeMode="cover" style={styles.itemImage} uri={imageUrl} />
          <View style={styles.itemBody}>
            <Text numberOfLines={2} style={styles.itemName}>
              {firstItem.productNameSnapshot}
            </Text>
            <Text numberOfLines={1} style={styles.itemMeta}>
              Qty {totalQuantity || firstItem.quantity}
              {firstItem.seller?.storeName ? ` - ${firstItem.seller.storeName}` : ""}
            </Text>
            {extraItems ? (
              <Text style={styles.extraItemText}>
                +{extraItems} more {extraItems === 1 ? "item" : "items"} in this order
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <OrderTimeline order={order} />

      <View style={styles.cardActionRow}>
        <Pressable style={styles.detailsButton} onPress={openOrder}>
          <HugeiconsIcon color={textColor} icon={PackageIcon} size={20} strokeWidth={2.05} />
          <Text style={styles.detailsButtonText}>Order Details</Text>
        </Pressable>
        <Pressable style={styles.buyAgainButton} onPress={handlePrimaryAction}>
          <HugeiconsIcon color={colors.primary} icon={isCancelled ? PackageIcon : RefreshIcon} size={20} strokeWidth={2.2} />
          <Text style={styles.buyAgainText}>{primaryActionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OrderTimeline({ order }: { order: MobileOrderSummary }) {
  const steps = buildTimelineSteps(order);

  return (
    <View style={styles.timelineRow}>
      {steps.map((step, index) => (
        <View key={`${step.label}-${index}`} style={styles.timelineStepWrap}>
          <View style={styles.stepTopLine}>
            <TimelineIcon step={step} />
            {index < steps.length - 1 ? <View style={[styles.timelineConnector, step.completed ? styles.timelineConnectorActive : null]} /> : null}
          </View>
          <Text numberOfLines={1} style={styles.timelineLabel}>
            {step.label}
          </Text>
          <Text numberOfLines={1} style={styles.timelineDate}>
            {step.dateLabel}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TimelineIcon({ step }: { step: TimelineStep }) {
  return (
    <View style={[styles.timelineIcon, step.completed ? timelineIconTone(step.tone) : styles.timelineIconPending]}>
      <HugeiconsIcon color={step.completed ? step.color : "#8A94A6"} icon={step.icon} size={21} strokeWidth={2.15} />
    </View>
  );
}

function SupportCard() {
  const router = useRouter();

  return (
    <View style={styles.supportCard}>
      <View style={styles.supportIcon}>
        <HugeiconsIcon color={colors.primary} icon={HeadsetIcon} size={28} strokeWidth={2.1} />
      </View>
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle}>Need help with your order?</Text>
        <Text style={styles.supportText}>Our support team is here to help you.</Text>
      </View>
      <Pressable style={styles.supportButton} onPress={() => router.push("/account/support" as never)}>
        <Text style={styles.supportButtonText}>Contact Support</Text>
      </Pressable>
    </View>
  );
}

function PremiumEmptyState({
  activeFilter,
  hasOrders,
  onReset,
}: {
  activeFilter: OrderFilter;
  hasOrders: boolean;
  onReset: () => void;
}) {
  return (
    <View style={styles.emptyPanel}>
      <EmptyState
        title={hasOrders ? `No ${filterLabel(activeFilter).toLowerCase()} orders` : "No orders yet"}
        message={hasOrders ? "Try another status filter to see more orders." : "Orders placed from checkout will appear here with tracking and support options."}
      />
      {hasOrders ? (
        <Pressable style={styles.secondaryButton} onPress={onReset}>
          <Text style={styles.secondaryButtonText}>Show all orders</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.centerState}>
      <View style={styles.loadingIcon}>
        <ActivityIndicator color={colors.primary} />
      </View>
      <Text style={styles.stateText}>{label}</Text>
    </View>
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
            {filterOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.sheetOption, activeFilter === option.value ? styles.sheetOptionActive : null]}
                onPress={() => onSelect(option.value)}
              >
                <View style={[styles.sheetOptionIcon, activeFilter === option.value ? styles.sheetOptionIconActive : null]}>
                  <HugeiconsIcon
                    color={activeFilter === option.value ? colors.surface : colors.primary}
                    icon={option.icon}
                    size={22}
                    strokeWidth={2.15}
                  />
                </View>
                <View style={styles.sheetOptionCopy}>
                  <Text style={[styles.sheetOptionTitle, activeFilter === option.value ? styles.sheetOptionTitleActive : null]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.sheetOptionText, activeFilter === option.value ? styles.sheetOptionTextActive : null]}>
                    {filterDescription(option.value)}
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

function matchesOrderFilter(order: MobileOrderSummary, filter: OrderFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "placed") {
    return order.orderStatus === "PLACED" || order.orderStatus === "CONFIRMED";
  }
  if (filter === "processing") {
    return order.orderStatus === "PROCESSING";
  }
  if (filter === "shipped") {
    return order.orderStatus === "SHIPPED" || order.deliveryStatus === "DISPATCHED" || order.deliveryStatus === "IN_TRANSIT";
  }

  return order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED";
}

function buildTimelineSteps(order: MobileOrderSummary): TimelineStep[] {
  const dateLabel = shortOrderDate(order.createdAt);

  if (order.orderStatus === "CANCELLED") {
    return [
      { color: dangerColor, completed: true, dateLabel, icon: PackageIcon, label: "Cancelled", tone: "danger" },
      {
        color: warningColor,
        completed: true,
        dateLabel: order.paymentStatus === "NOT_REQUIRED" ? "-" : dateLabel,
        icon: RefreshIcon,
        label: order.paymentStatus === "NOT_REQUIRED" ? "Not Required" : formatStatus(order.paymentStatus),
        tone: "warning",
      },
      { color: successColor, completed: true, dateLabel, icon: CheckmarkCircle02Icon, label: "Closed", tone: "success" },
    ];
  }

  const rank = orderStatusRank(order);
  const steps = [
    { color: colors.primary, icon: ShoppingCart01Icon, key: 1, label: "Placed", tone: "primary" as const },
    { color: warningColor, icon: PackageIcon, key: 2, label: "Processing", tone: "warning" as const },
    { color: purpleColor, icon: DeliveryBox01Icon, key: 3, label: "Shipped", tone: "purple" as const },
    { color: successColor, icon: CheckmarkCircle02Icon, key: 4, label: "Delivered", tone: "success" as const },
  ];

  return steps.map((step) => ({
    color: step.color,
    completed: rank >= step.key,
    dateLabel: rank >= step.key ? dateLabel : "-",
    icon: step.icon,
    label: step.label,
    tone: step.tone,
  }));
}

function orderStatusRank(order: MobileOrderSummary) {
  if (order.orderStatus === "DELIVERED" || order.deliveryStatus === "DELIVERED") {
    return 4;
  }
  if (order.orderStatus === "SHIPPED" || order.deliveryStatus === "DISPATCHED" || order.deliveryStatus === "IN_TRANSIT") {
    return 3;
  }
  if (order.orderStatus === "PROCESSING") {
    return 2;
  }

  return 1;
}

function timelineIconTone(tone: TimelineStep["tone"]) {
  if (tone === "warning") {
    return styles.timelineIconWarning;
  }
  if (tone === "purple") {
    return styles.timelineIconPurple;
  }
  if (tone === "success") {
    return styles.timelineIconSuccess;
  }
  if (tone === "danger") {
    return styles.timelineIconDanger;
  }

  return styles.timelineIconPrimary;
}

function filterLabel(filter: OrderFilter) {
  return filterOptions.find((option) => option.value === filter)?.label.replace("All Orders", "Recent") ?? "Recent";
}

function filterDescription(filter: OrderFilter) {
  if (filter === "placed") {
    return "Orders received and waiting for seller action.";
  }
  if (filter === "processing") {
    return "Orders currently being prepared.";
  }
  if (filter === "shipped") {
    return "Orders dispatched or in transit.";
  }
  if (filter === "delivered") {
    return "Orders successfully delivered.";
  }

  return "Show every order in your account.";
}

function formatOrderDateTime(value?: string | null) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function shortOrderDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
}

const styles = StyleSheet.create({
  buyAgainButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
  },
  buyAgainText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  cardActionRow: {
    alignItems: "center",
    borderTopColor: borderColor,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  detailsButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
  },
  detailsButtonText: {
    color: textColor,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyPanel: {
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    ...cardShadow,
  },
  extraItemText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 17,
  },
  filterButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginRight: 12,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  filterChipActive: {
    backgroundColor: "#FFF8F5",
    borderColor: colors.primary,
  },
  filterChipText: {
    color: textColor,
    fontSize: 14,
    fontWeight: "900",
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  filterRail: {
    paddingRight: 18,
  },
  filterSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  header: {
    gap: 22,
    paddingBottom: 18,
  },
  headerActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  headerTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...cardShadow,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemImage: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    height: 84,
    width: 84,
  },
  itemMeta: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 8,
  },
  itemName: {
    color: textColor,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  itemRow: {
    borderTopColor: borderColor,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 16,
    paddingTop: 16,
  },
  listContent: {
    padding: 18,
    paddingBottom: 128,
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
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(17,24,39,0.22)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 20,
    padding: 18,
    ...cardShadow,
  },
  orderDate: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 4,
  },
  orderHead: {
    flex: 1,
    minWidth: 0,
  },
  orderIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  orderNumber: {
    color: textColor,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  orderTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  orderTotal: {
    color: colors.primary,
    fontSize: 19,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 54,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  safeArea: {
    backgroundColor: "#FFFCFB",
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeading: {
    color: textColor,
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
  },
  sheetCloseButton: {
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sheetCloseText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
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
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  sheetOption: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    minHeight: 76,
    padding: 14,
  },
  sheetOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetOptionIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2ED",
    borderRadius: 999,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  sheetOptionIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  sheetOptions: {
    gap: 12,
    marginTop: 20,
  },
  sheetOptionText: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
  sheetOptionTextActive: {
    color: "rgba(255,255,255,0.82)",
  },
  sheetOptionTitle: {
    color: textColor,
    fontSize: 16,
    fontWeight: "900",
  },
  sheetOptionTitleActive: {
    color: colors.surface,
  },
  sheetSubtitle: {
    color: mutedColor,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  sheetTitle: {
    color: textColor,
    fontSize: 22,
    fontWeight: "900",
  },
  sheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  signedOutScreen: {
    flex: 1,
    gap: 22,
    padding: 18,
  },
  stateText: {
    color: mutedColor,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  subtitle: {
    color: mutedColor,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    marginTop: 2,
  },
  supportButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#FFD4C6",
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  supportButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  supportCard: {
    alignItems: "center",
    backgroundColor: "#FFF6F2",
    borderColor: "#FFD9CC",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
    padding: 18,
    ...cardShadow,
  },
  supportCopy: {
    flex: 1,
    minWidth: 0,
  },
  supportIcon: {
    alignItems: "center",
    backgroundColor: "#FFE9E1",
    borderRadius: 18,
    height: 62,
    justifyContent: "center",
    width: 62,
  },
  supportText: {
    color: mutedColor,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 3,
  },
  supportTitle: {
    color: textColor,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 21,
  },
  timelineConnector: {
    borderColor: "#D7DDE8",
    borderStyle: "dashed",
    borderTopWidth: 1,
    flex: 1,
    marginHorizontal: 8,
    marginTop: 22,
  },
  timelineConnectorActive: {
    borderColor: "#C6CEDA",
  },
  timelineDate: {
    color: mutedColor,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    marginTop: 2,
  },
  timelineIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  timelineIconDanger: {
    backgroundColor: "#FEE2E2",
  },
  timelineIconPending: {
    backgroundColor: "#F3F4F6",
  },
  timelineIconPrimary: {
    backgroundColor: "#FFF2ED",
  },
  timelineIconPurple: {
    backgroundColor: "#F3E8FF",
  },
  timelineIconSuccess: {
    backgroundColor: "#DCFCE7",
  },
  timelineIconWarning: {
    backgroundColor: "#FEF3C7",
  },
  timelineLabel: {
    color: textColor,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    marginTop: 8,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 0,
    marginTop: 18,
  },
  timelineStepWrap: {
    flex: 1,
    minWidth: 0,
  },
  stepTopLine: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  title: {
    color: textColor,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 38,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  totalWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
});
