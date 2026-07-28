import {
  ArrowRight02Icon,
  CalendarCheckIn01Icon,
  CheckmarkCircle02Icon,
  DiscountTag02Icon,
  Megaphone01Icon,
  Message02Icon,
  Notification02Icon,
  PackageDeliveredIcon,
  PackageIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage, formatDateTime, formatStatus, SignInRequiredState } from "../../src/features/account/account-ui";
import { openCustomerNotification } from "../../src/features/notifications/customer-notification-routing";
import {
  getCustomerNotificationUnreadCount,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  type CustomerNotification,
  type CustomerNotificationType,
} from "../../src/features/notifications/customer-notifications-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

const PAGE_LIMIT = 20;

type NotificationTypeMeta = {
  icon: IconSvgElement;
  tint: string;
  background: string;
  label: string;
};

const NOTIFICATION_TYPE_META: Record<CustomerNotificationType, NotificationTypeMeta> = {
  ORDER_PLACED: { icon: PackageIcon, tint: "#2563EB", background: "#EFF4FF", label: "Order update" },
  ORDER_DELIVERED: { icon: PackageDeliveredIcon, tint: "#16A34A", background: "#EDFAF1", label: "Delivered" },
  DEAL_PUBLISHED: { icon: DiscountTag02Icon, tint: colors.primary, background: colors.softSurface, label: "Deal alert" },
  B2B_ENQUIRY_MESSAGE: { icon: Message02Icon, tint: "#7C3AED", background: "#F4EFFE", label: "Enquiry reply" },
  SERVICE_BOOKING: { icon: CalendarCheckIn01Icon, tint: "#0D9488", background: "#E9F8F6", label: "Service booking" },
  CAMPAIGN: { icon: Megaphone01Icon, tint: "#DB2777", background: "#FDEFF6", label: "Announcement" },
};

const FALLBACK_TYPE_META: NotificationTypeMeta = {
  icon: Notification02Icon,
  tint: colors.primary,
  background: colors.softSurface,
  label: "Update",
};

function notificationTypeMeta(type: CustomerNotification["type"]): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? { ...FALLBACK_TYPE_META, label: formatStatus(type) };
}

export default function AccountNotificationsScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inboxQuery = useInfiniteQuery({
    queryKey: ["mobile-notifications", customerAuth.authKey],
    queryFn: ({ pageParam }) =>
      listCustomerNotifications(customerAuth.authHeaders, {
        cursor: pageParam,
        limit: PAGE_LIMIT,
      }),
    enabled: customerAuth.enabled,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? null,
    initialPageParam: null as string | null,
    retry: false,
  });
  const unreadQuery = useQuery({
    queryKey: ["mobile-notification-unread-count", customerAuth.authKey],
    queryFn: () => getCustomerNotificationUnreadCount(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });
  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markCustomerNotificationRead(customerAuth.authHeaders, notificationId),
    onSuccess: () => invalidateNotificationQueries(queryClient, customerAuth.authKey),
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllCustomerNotificationsRead(customerAuth.authHeaders),
    onSuccess: () => invalidateNotificationQueries(queryClient, customerAuth.authKey),
  });

  const items = inboxQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const refreshing = inboxQuery.isRefetching && !inboxQuery.isFetchingNextPage;

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Preparing inbox...</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
        <SignInRequiredState title="Sign in to view notifications" message="See order updates, deal alerts, and campaign messages." />
      </>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
      <FlatList
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.headerIcon}>
                <HugeiconsIcon color={colors.primary} icon={Notification02Icon} size={26} strokeWidth={2} />
                {unreadQuery.data?.count ? (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {unreadQuery.data.count > 99 ? "99+" : unreadQuery.data.count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Notifications</Text>
                <Text style={styles.subtitle}>
                  {unreadQuery.data?.count
                    ? `${unreadQuery.data.count} unread update${unreadQuery.data.count === 1 ? "" : "s"}`
                    : "You're all caught up"}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Notification preferences"
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.settingsButton, pressed ? styles.pressedAction : null]}
                onPress={() => router.push("/account/notification-preferences" as never)}
              >
                <HugeiconsIcon color={colors.ink} icon={Settings02Icon} size={20} strokeWidth={2} />
              </Pressable>
            </View>
            {unreadQuery.data?.count ? (
              <Pressable
                disabled={markAllMutation.isPending}
                style={({ pressed }) => [
                  styles.markAllButton,
                  pressed ? styles.pressedAction : null,
                  markAllMutation.isPending ? styles.disabledButton : null,
                ]}
                onPress={() => markAllMutation.mutate()}
              >
                {markAllMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={17} strokeWidth={2.1} />
                )}
                <Text style={styles.markAllText}>Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          inboxQuery.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : inboxQuery.isError ? (
            <View style={styles.emptyWrap}>
              <EmptyState title="Inbox could not load" message={accountErrorMessage(inboxQuery.error, "Please try again.")} />
              <Pressable style={styles.primaryButton} onPress={() => void inboxQuery.refetch()}>
                <Text style={styles.primaryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <HugeiconsIcon color={colors.primary} icon={Notification02Icon} size={34} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>Order updates, deal alerts, and announcements will appear here.</Text>
            </View>
          )
        }
        ListFooterComponent={
          items.length ? (
            <View style={styles.footer}>
              {inboxQuery.hasNextPage ? (
                <Pressable
                  disabled={inboxQuery.isFetchingNextPage}
                  style={[styles.loadMoreButton, inboxQuery.isFetchingNextPage ? styles.disabledButton : null]}
                  onPress={() => void inboxQuery.fetchNextPage()}
                >
                  {inboxQuery.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
                  <Text style={styles.loadMoreText}>{inboxQuery.isFetchingNextPage ? "Loading..." : "Load more"}</Text>
                </Pressable>
              ) : (
                <Text style={styles.endText}>You are caught up.</Text>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              void inboxQuery.refetch();
              void unreadQuery.refetch();
            }}
          />
        }
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            onPress={() => {
              if (!item.readAt) {
                markReadMutation.mutate(item.id);
              }
              openCustomerNotification({ href: item.href });
            }}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function NotificationCard({ item, onPress }: { item: CustomerNotification; onPress: () => void }) {
  const unread = !item.readAt;
  const imageUrl = resolveImageUrl(item.imageUrl);
  const meta = notificationTypeMeta(item.type);

  return (
    <Pressable
      accessibilityHint={`Open ${item.title}`}
      accessibilityLabel={`${item.title}, ${unread ? "unread" : "read"}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, unread ? styles.unreadCard : null, pressed ? styles.cardPressed : null]}
      onPress={onPress}
    >
      {imageUrl ? (
        <RemoteImage fallbackLabel={item.title} style={styles.thumbnail} uri={imageUrl} />
      ) : (
        <View style={[styles.typeIcon, { backgroundColor: meta.background }]}>
          <HugeiconsIcon color={meta.tint} icon={meta.icon} size={24} strokeWidth={2} />
        </View>
      )}
      <View style={styles.cardCopy}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={[styles.cardTitle, unread ? styles.unreadTitle : null]}>
            {item.title}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text numberOfLines={2} style={styles.cardBody}>{item.body}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.typePill, { backgroundColor: meta.background }]}>
            <Text style={[styles.typePillText, { color: meta.tint }]}>{meta.label}</Text>
          </View>
          <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.chevron}>
        <HugeiconsIcon color="#C9CDD4" icon={ArrowRight02Icon} size={18} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>, authKey: string) {
  void queryClient.invalidateQueries({ queryKey: ["mobile-notifications", authKey] });
  void queryClient.invalidateQueries({ queryKey: ["mobile-notification-unread-count", authKey] });
}

const styles = StyleSheet.create({
  card: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  cardBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 3,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  chevron: {
    alignSelf: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 128,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 260,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 16,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
  },
  endText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  footer: {
    paddingVertical: 16,
  },
  headerBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: "center",
    minWidth: 20,
    paddingHorizontal: 4,
    height: 20,
    position: "absolute",
    right: -5,
    top: -5,
  },
  headerBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
  },
  headerCard: {
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  loadMoreButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  markAllButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  metaText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  pressedAction: {
    opacity: 0.7,
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },
  settingsButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  thumbnail: {
    borderRadius: 14,
    height: 48,
    overflow: "hidden",
    width: 48,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  typeIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  unreadCard: {
    backgroundColor: "#FFFBF9",
    borderColor: "#FFE1D6",
  },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  unreadTitle: {
    fontWeight: "800",
  },
});
