import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { RetryState, accountErrorMessage } from "../../src/features/account/account-ui";
import { serviceKeys } from "../../src/features/services/service-query-keys";
import { ServiceCard } from "../../src/features/services/service-ui";
import { listPublicServices } from "../../src/features/services/services-api";
import type { MobileServiceListing } from "../../src/features/services/types";
import { useLocationStore } from "../../src/state/location-store";
import { colors } from "../../src/theme";

const SEARCH_DEBOUNCE_MS = 300;

export default function ServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string }>();
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const initialSearch = Array.isArray(params.search) ? params.search[0] : params.search;
  const [searchText, setSearchText] = useState(initialSearch ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch ?? "");
  const locationKey = locationKeyFor(selectedLocation);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    router.setParams(q ? { search: q } : { search: undefined });
  }, [debouncedSearch, router]);

  const servicesQuery = useQuery({
    queryKey: serviceKeys.list(debouncedSearch, locationKey),
    queryFn: () => listPublicServices({ search: debouncedSearch, location: selectedLocation, limit: 40 }),
  });

  const services = servicesQuery.data?.items ?? [];
  const categoryChips = useMemo(() => uniqueCategories(services), [services]);

  if (servicesQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Services" }} />
        <RetryState
          title="Services could not load"
          message={accountErrorMessage(servicesQuery.error, "Something went wrong. Tap to try again.")}
          onRetry={() => void servicesQuery.refetch()}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Services" }} />
      <Screen padded={false}>
        <FlashList
          contentContainerStyle={styles.content}
          data={services}
          keyExtractor={(service) => service.id}
          ListHeaderComponent={
            <View>
              <View style={styles.searchWrap}>
                <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={21} strokeWidth={2.1} />
                <TextInput
                  autoCapitalize="none"
                  placeholder="Search services"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>
              {categoryChips.length ? (
                <View style={styles.chips}>
                  {categoryChips.map((category) => (
                    <Pressable key={category} style={styles.chip} onPress={() => setSearchText(category)}>
                      <Text style={styles.chipText}>{category}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {servicesQuery.isLoading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>Finding services...</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !servicesQuery.isLoading ? (
              <View style={styles.emptyWrap}>
                <EmptyState title="No services found" message="Try a different search or browse all categories." />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ServiceCard service={item} onPress={() => router.push(`/services/${item.slug}` as never)} />
          )}
        />
      </Screen>
    </>
  );
}

function uniqueCategories(services: MobileServiceListing[]) {
  return Array.from(new Set(services.map((service) => service.categoryName).filter((value): value is string => Boolean(value)))).slice(0, 8);
}

function locationKeyFor(location: { countryCode?: string; stateCode?: string; cityCode?: string; localAreaCode?: string; pincode?: string }) {
  return [location.countryCode, location.stateCode, location.cityCode, location.localAreaCode, location.pincode].filter(Boolean).join(":") || null;
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 110,
  },
  searchWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    minHeight: 34,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: "#FFF2EE",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  loadingState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  emptyWrap: {
    marginTop: 14,
  },
});
