import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Notification02Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { RemoteImage } from "../../src/components/remote-image";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage, formatDateTime, formatStatus, SignInRequiredState } from "../../src/features/account/account-ui";
import { openCustomerNotification, routeForCustomerNotification } from "../../src/features/notifications/customer-notification-routing";
import {
  getCustomerNotificationUnreadCount,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  type CustomerNotification,
} from "../../src/features/notifications/customer-notifications-api";
import { resolveImageUrl } from "../../src/lib/image-url";
import { colors } from "../../src/theme";

const PAGE_LIMIT = 20;

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

  useEffect(() => {
    if (inboxQuery.isError) {
      // Rendered inline; this effect keeps parity with other account screens that observe failures.
    }
  }, [inboxQuery.isError]);

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
                <HugeiconsIcon color={colors.primary} icon={Notification02Icon} size={30} strokeWidth={2.1} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Notification inbox</Text>
                <Text style={styles.subtitle}>
                  {unreadQuery.data?.count ? `${unreadQuery.data.count} unread updates` : "All caught up"}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.secondaryButton} onPress={() => router.push("/account/notification-preferences" as never)}>
                <HugeiconsIcon color={colors.primary} icon={Settings02Icon} size={18} strokeWidth={2.1} />
                <Text style={styles.secondaryButtonText}>Preferences</Text>
              </Pressable>
              <Pressable
                disabled={markAllMutation.isPending}
                style={[styles.primaryButton, markAllMutation.isPending ? styles.disabledButton : null]}
                onPress={() => markAllMutation.mutate()}
              >
                <HugeiconsIcon color={colors.surface} icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.1} />
                <Text style={styles.primaryButtonText}>Mark all read</Text>
              </Pressable>
            </View>
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
              <EmptyState title="No notifications yet" message="Order updates and alerts will appear here." />
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
  const target = routeForCustomerNotification({ href: item.href });

  return (
    <Pressable
      accessibilityHint={`Open ${item.title}`}
      accessibilityLabel={`${item.title}, ${unread ? "unread" : "read"}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, unread ? styles.unreadCard : null, pressed ? styles.cardPressed : null]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <RemoteImage fallbackLabel={item.title} style={styles.thumbnail} uri={imageUrl} />
        <View style={styles.cardCopy}>
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text numberOfLines={2} style={styles.cardBody}>{item.body}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.metaText}>{formatStatus(item.type)} - {formatDateTime(item.createdAt)}</Text>
        <View style={styles.openRow}>
          <Text numberOfLines={1} style={styles.openText}>{String(target)}</Text>
          <HugeiconsIcon color={colors.primary} icon={ArrowRight02Icon} size={18} strokeWidth={2.2} />
        </View>
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 6,
  },
  cardBottom: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 128,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyWrap: {
    paddingVertical: 36,
  },
  endText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  footer: {
    paddingVertical: 16,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  loadMoreButton: {
    alignItems: "center",
    alignSelf: "center",
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
    fontWeight: "900",
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  openRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  openText: {
    color: colors.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
  },
  thumbnail: {
    borderRadius: 16,
    height: 64,
    overflow: "hidden",
    width: 64,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  unreadCard: {
    borderColor: "#FFD9CC",
    backgroundColor: "#FFF8F5",
  },
  unreadDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 9,
    width: 9,
  },
});
