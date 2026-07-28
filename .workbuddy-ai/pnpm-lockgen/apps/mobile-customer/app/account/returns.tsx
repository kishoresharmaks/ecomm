import {
  ArrowRight02Icon,
  DeliveryReturn01Icon,
  PackageIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage, formatDate, StatusPill, SignInRequiredState } from "../../src/features/account/account-ui";
import { useMobileMarket } from "../../src/features/market/mobile-market";
import { isMobileReturnsEnabled } from "../../src/features/returns/return-feature";
import { returnsCopy } from "../../src/features/returns/return-copy";
import { returnStatusPresentationFor } from "../../src/features/returns/return-status";
import { listCustomerReturns, type MobileReturnRequest } from "../../src/features/storefront/storefront-api";
import { captureMobileException, trackMobileEvent } from "../../src/lib/mobile-telemetry";
import { colors } from "../../src/theme";

const PAGE_LIMIT = 25;
const RETURN_LIST_STALE_MS = 30_000;
const RETURN_LIST_GC_MS = 5 * 60_000;

export default function AccountReturnsScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const market = useMobileMarket();
  const copy = returnsCopy(market.market.locale);
  const featureEnabled = isMobileReturnsEnabled(customerAuth.authKey);

  const returnsQuery = useInfiniteQuery({
    queryKey: ["mobile-returns", customerAuth.authKey],
    queryFn: ({ pageParam }) =>
      listCustomerReturns(customerAuth.authHeaders, {
        cursor: pageParam,
        limit: PAGE_LIMIT,
      }),
    enabled: customerAuth.enabled && featureEnabled,
    gcTime: RETURN_LIST_GC_MS,
    getNextPageParam: (page) => page.pageInfo?.nextCursor ?? page.nextCursor ?? null,
    initialPageParam: null as string | null,
    retry: false,
    staleTime: RETURN_LIST_STALE_MS,
  });

  useEffect(() => {
    if (customerAuth.enabled && featureEnabled) {
      trackMobileEvent("returns_list_viewed", { source: "account" });
    }
  }, [customerAuth.enabled, featureEnabled]);

  useEffect(() => {
    if (returnsQuery.isError) {
      captureMobileException(returnsQuery.error, "returns_list_load_failed", {
        status: "list_error",
      });
    }
  }, [returnsQuery.error, returnsQuery.isError]);

  const items = returnsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const refreshing = returnsQuery.isRefetching && !returnsQuery.isFetchingNextPage;

  if (!featureEnabled) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <EmptyState title={copy.disabledTitle} message={copy.disabledMessage} />
      </Screen>
    );
  }

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>{copy.listPreparing}</Text>
        </View>
      </Screen>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
        <SignInRequiredState title={copy.listSignInTitle} message={copy.listSignInMessage} />
      </>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: copy.listTitle }} />
      <FlatList
        ListEmptyComponent={
          returnsQuery.isLoading ? (
            <ReturnListSkeleton />
          ) : returnsQuery.isError ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={copy.listLoadErrorTitle}
                message={accountErrorMessage(returnsQuery.error, copy.genericRetryMessage)}
              />
              <Pressable
                accessibilityHint="Reload your return requests"
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => void returnsQuery.refetch()}
              >
                <HugeiconsIcon color={colors.surface} icon={RefreshIcon} size={19} strokeWidth={2.1} />
                <Text style={styles.primaryButtonText}>{copy.retry}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState title={copy.emptyListTitle} message={copy.emptyListMessage} />
              <Pressable
                accessibilityHint="Open your orders to start a return"
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => router.push("/(tabs)/orders" as never)}
              >
                <HugeiconsIcon color={colors.surface} icon={PackageIcon} size={19} strokeWidth={2.1} />
                <Text style={styles.primaryButtonText}>{copy.emptyListAction}</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          items.length ? (
            <View style={styles.footer}>
              {returnsQuery.hasNextPage ? (
                <Pressable
                  accessibilityHint="Load older return requests"
                  accessibilityRole="button"
                  disabled={returnsQuery.isFetchingNextPage}
                  style={[styles.loadMoreButton, returnsQuery.isFetchingNextPage ? styles.disabledButton : null]}
                  onPress={() => void returnsQuery.fetchNextPage()}
                >
                  {returnsQuery.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
                  <Text style={styles.loadMoreText}>
                    {returnsQuery.isFetchingNextPage ? copy.listLoadingMore : copy.listLoadMore}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.endText}>{copy.caughtUp}</Text>
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
            onRefresh={() => void returnsQuery.refetch()}
          />
        }
        renderItem={({ item }) => <ReturnRequestCard copy={copy} item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function ReturnRequestCard({ copy, item }: { copy: ReturnType<typeof returnsCopy>; item: MobileReturnRequest }) {
  const presentation = returnStatusPresentationFor(item.status);
  const firstItem = item.items[0];
  const itemCount = item.items.length;

  return (
    <Link href={`/account/returns/${encodeURIComponent(item.requestNumber)}` as never} asChild>
      <Pressable
        accessibilityHint={`Open return request ${item.requestNumber}`}
        accessibilityLabel={`Return ${item.requestNumber}, ${presentation.label}`}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      >
        <View style={styles.cardTop}>
          <View style={styles.iconWrap}>
            <HugeiconsIcon color={colors.primary} icon={DeliveryReturn01Icon} size={25} strokeWidth={2.1} />
          </View>
          <View style={styles.cardBody}>
            <Text numberOfLines={1} style={styles.cardTitle}>{item.requestNumber}</Text>
            <Text numberOfLines={1} style={styles.cardMeta}>
              Order {item.order.orderNumber} - {formatDate(item.createdAt)}
            </Text>
          </View>
          <StatusPill label={presentation.label} tone={presentation.tone} />
        </View>
        <Text numberOfLines={2} style={styles.itemText}>
          {firstItem?.productName ?? copy.fallbackReturnItem}
          {itemCount > 1 ? ` +${itemCount - 1} more` : ""}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.quantityText}>Qty {item.totalQuantity}</Text>
          <View style={styles.openRow}>
            <Text style={styles.openText}>{copy.detailsAction}</Text>
            <HugeiconsIcon color={colors.primary} icon={ArrowRight02Icon} size={18} strokeWidth={2.2} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function ReturnListSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonTop}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonLines}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineShort} />
            </View>
          </View>
          <View style={styles.skeletonLineFull} />
          <View style={styles.skeletonLineShort} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    padding: 18,
    paddingBottom: 128,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyWrap: {
    paddingTop: 24,
  },
  endText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  footer: {
    paddingVertical: 18,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#FFF1EB",
    borderRadius: 18,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  itemText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 14,
  },
  loadMoreButton: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  openRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  openText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  quantityText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  skeletonIcon: {
    backgroundColor: "#FFE7DE",
    borderRadius: 18,
    height: 50,
    width: 50,
  },
  skeletonLineFull: {
    backgroundColor: "#F7E7E1",
    borderRadius: 999,
    height: 13,
    marginTop: 18,
    width: "92%",
  },
  skeletonLineShort: {
    backgroundColor: "#F7E7E1",
    borderRadius: 999,
    height: 12,
    marginTop: 8,
    width: "45%",
  },
  skeletonLineWide: {
    backgroundColor: "#F7E7E1",
    borderRadius: 999,
    height: 15,
    width: "68%",
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
});
