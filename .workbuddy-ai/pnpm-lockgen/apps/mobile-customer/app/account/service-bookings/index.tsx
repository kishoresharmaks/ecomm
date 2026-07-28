import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../../src/components/empty-state";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { AccountLoadingState, RetryState, SignInRequiredState, accountErrorMessage } from "../../../src/features/account/account-ui";
import { serviceKeys } from "../../../src/features/services/service-query-keys";
import { BookingCard } from "../../../src/features/services/service-ui";
import { listCustomerServiceBookings } from "../../../src/features/services/services-api";
import {
  isActiveServiceBookingStatus,
  isClosedServiceBookingStatus,
  isCompletedServiceBookingStatus,
} from "../../../src/features/services/utils/bookingActions";
import type { MobileServiceBooking } from "../../../src/features/services/types";
import { colors } from "../../../src/theme";

type BookingTab = "all" | "active" | "completed" | "cancelled";

const tabs: Array<{ id: BookingTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export default function ServiceBookingsScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const [tab, setTab] = useState<BookingTab>("all");

  const bookingsQuery = useQuery({
    queryKey: serviceKeys.bookings(customerAuth.authKey, null),
    queryFn: () => listCustomerServiceBookings(customerAuth.authHeaders, { limit: 100 }),
    enabled: customerAuth.enabled,
  });

  const bookings = bookingsQuery.data?.items ?? [];
  const filtered = useMemo(() => filterBookings(bookings, tab), [bookings, tab]);

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || (customerAuth.enabled && bookingsQuery.isLoading)) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Service Bookings" }} />
        <AccountLoadingState title="Loading service bookings..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Service Bookings" }} />
        <SignInRequiredState title="Sign in to view service bookings" message="Service bookings are linked to your 1HandIndia account." />
      </>
    );
  }

  if (bookingsQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Service Bookings" }} />
        <RetryState
          title="Service bookings could not load"
          message={accountErrorMessage(bookingsQuery.error, "Check your connection and refresh bookings.")}
          onRetry={() => void bookingsQuery.refetch()}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Service Bookings" }} />
      <Screen padded={false}>
        <FlashList
          contentContainerStyle={styles.content}
          data={filtered}
          keyExtractor={(booking) => booking.id}
          ListHeaderComponent={
            <View>
              <View style={styles.headerCard}>
                <View style={styles.headerIcon}>
                  <HugeiconsIcon color={colors.primary} icon={Calendar03Icon} size={28} strokeWidth={2.2} />
                </View>
                <View style={styles.headerBody}>
                  <Text style={styles.title}>Service Bookings</Text>
                  <Text style={styles.subtitle}>Track quotes, visits, completion, disputes and reviews.</Text>
                </View>
              </View>
              <View style={styles.tabs}>
                {tabs.map((item) => (
                  <Pressable key={item.id} style={[styles.tab, tab === item.id ? styles.tabActive : null]} onPress={() => setTab(item.id)}>
                    <Text style={[styles.tabText, tab === item.id ? styles.tabTextActive : null]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState title={emptyTitle(tab)} message="New service requests and quotes will appear here." />
            </View>
          }
          renderItem={({ item }) => (
            <BookingCard booking={item} onPress={() => router.push(`/account/service-bookings/${item.bookingNumber}` as never)} />
          )}
        />
      </Screen>
    </>
  );
}

function filterBookings(bookings: MobileServiceBooking[], tab: BookingTab) {
  if (tab === "active") {
    return bookings.filter((booking) => isActiveServiceBookingStatus(booking.status));
  }
  if (tab === "completed") {
    return bookings.filter((booking) => isCompletedServiceBookingStatus(booking.status));
  }
  if (tab === "cancelled") {
    return bookings.filter((booking) => isClosedServiceBookingStatus(booking.status));
  }
  return bookings;
}

function emptyTitle(tab: BookingTab) {
  if (tab === "active") return "No active bookings yet";
  if (tab === "completed") return "No completed bookings yet";
  if (tab === "cancelled") return "No cancelled bookings yet";
  return "No service bookings yet";
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 110,
  },
  headerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "#FFF2EE",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headerBody: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: "#FFF2EE",
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  tabTextActive: {
    color: colors.primary,
  },
  emptyWrap: {
    marginTop: 14,
  },
});
