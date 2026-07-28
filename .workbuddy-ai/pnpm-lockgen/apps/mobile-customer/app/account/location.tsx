import { Location01Icon, RefreshIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { Screen } from "../../src/components/screen";
import {
  clearBrowsingLocation,
  getBrowsingLocation,
  searchLocationAreas,
  updateBrowsingLocation,
} from "../../src/features/storefront/storefront-api";
import { accountErrorMessage, locationFromArea, SignInRequiredState } from "../../src/features/account/account-ui";
import { useLocationStore } from "../../src/state/location-store";
import type { LocationArea, SelectedLocation } from "../../src/types/storefront";
import { colors } from "../../src/theme";

export default function SavedLocationScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const setSelectedLocation = useLocationStore((state) => state.setSelectedLocation);
  const clearSelectedLocation = useLocationStore((state) => state.clearSelectedLocation);
  const [search, setSearch] = useState("");
  const selectedCountryCode = selectedLocation.countryCode?.trim().toUpperCase() || "IN";

  const serverLocationQuery = useQuery({
    queryKey: ["mobile-browsing-location", customerAuth.authKey],
    queryFn: () => getBrowsingLocation(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const normalizedSearch = search.trim();
  const areasQuery = useQuery({
    queryKey: ["mobile-location-areas", selectedCountryCode, normalizedSearch],
    queryFn: () => searchLocationAreas(normalizedSearch, selectedCountryCode),
    enabled: normalizedSearch.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (serverLocationQuery.data?.location) {
      setSelectedLocation(serverLocationQuery.data.location);
    }
  }, [serverLocationQuery.data?.location, setSelectedLocation]);

  const saveMutation = useMutation({
    mutationFn: (location: SelectedLocation) => updateBrowsingLocation(customerAuth.authHeaders, location),
    onSuccess: async (response) => {
      if (response.location) {
        setSelectedLocation(response.location);
      }
      await queryClient.invalidateQueries({ queryKey: ["mobile-browsing-location", customerAuth.authKey] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearBrowsingLocation(customerAuth.authHeaders),
    onSuccess: async () => {
      clearSelectedLocation();
      await queryClient.invalidateQueries({ queryKey: ["mobile-browsing-location", customerAuth.authKey] });
    },
  });

  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);

  if (!customerAuth.enabled && customerAuth.status !== "loading" && customerAuth.status !== "syncing") {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Saved location" }} />
        <SignInRequiredState title="Sign in to save location" message="Location is cached locally, and saved to your account after sign in." />
      </>
    );
  }

  function selectArea(area: LocationArea) {
    const location = locationFromArea(area);
    setSelectedLocation(location);
    if (customerAuth.enabled) {
      saveMutation.mutate(location);
    }
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Saved location" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={areas}
        keyExtractor={(area) => area.id}
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={30} strokeWidth={2.1} />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.title}>Saved location</Text>
                <Text style={styles.subtitle}>Used for nearby shops and local product discovery.</Text>
              </View>
            </View>

            <View style={styles.currentCard}>
              <Text style={styles.cardLabel}>Current browsing location</Text>
              <Text style={styles.currentLocation}>{selectedLocation.label}</Text>
              <View style={styles.currentActions}>
                <Pressable disabled={serverLocationQuery.isFetching} style={styles.actionButton} onPress={() => void serverLocationQuery.refetch()}>
                  {serverLocationQuery.isFetching ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <HugeiconsIcon color={colors.primary} icon={RefreshIcon} size={16} strokeWidth={2.2} />
                      <Text style={styles.actionButtonText}>Sync</Text>
                    </>
                  )}
                </Pressable>
                <Pressable disabled={clearMutation.isPending} style={styles.actionButton} onPress={() => clearMutation.mutate()}>
                  <Text style={styles.actionButtonText}>Clear</Text>
                </Pressable>
              </View>
              {serverLocationQuery.isError ? (
                <Text style={styles.errorText}>{accountErrorMessage(serverLocationQuery.error, "Saved location could not sync.")}</Text>
              ) : null}
              {saveMutation.isError ? <Text style={styles.errorText}>{accountErrorMessage(saveMutation.error, "Location could not be saved.")}</Text> : null}
            </View>

            <View style={styles.searchCard}>
              <View style={styles.searchRow}>
                <HugeiconsIcon color={colors.primary} icon={Search01Icon} size={21} strokeWidth={2} />
                <TextInput
                  onChangeText={setSearch}
                  placeholder="Search area or pincode"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={search}
                />
              </View>
              {normalizedSearch.length < 2 ? <Text style={styles.helpText}>Enter at least 2 characters to search.</Text> : null}
              {areasQuery.isFetching ? <Text style={styles.helpText}>Searching locations...</Text> : null}
              {areasQuery.isError ? <Text style={styles.errorText}>{accountErrorMessage(areasQuery.error, "Location search failed.")}</Text> : null}
              {normalizedSearch.length >= 2 && !areasQuery.isFetching && !areas.length ? (
                <Text style={styles.helpText}>No matching local areas found.</Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => <AreaRow area={item} busy={saveMutation.isPending} onPress={() => selectArea(item)} />}
      />
    </Screen>
  );
}

function AreaRow({ area, busy, onPress }: { area: LocationArea; busy: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={busy} style={styles.areaRow} onPress={onPress}>
      <View style={styles.areaIcon}>
        <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.areaBody}>
        <Text style={styles.areaTitle}>{area.name}</Text>
        <Text style={styles.areaMeta}>
          {area.city.name}, {area.city.subdivision.name}
          {area.postalCode ? ` - ${area.postalCode}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 110,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    padding: 14,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  currentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  currentLocation: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 6,
  },
  currentActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    alignItems: "center",
    borderColor: "#FFD7CA",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  searchCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },
  areaRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 12,
  },
  areaIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  areaBody: {
    flex: 1,
    minWidth: 0,
  },
  areaTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  areaMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
});
