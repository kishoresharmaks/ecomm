import { PlusSignIcon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../src/components/screen";
import { EmptyState } from "../../../src/components/empty-state";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../src/features/b2b/b2b-auth-gate";
import { deleteB2BAddress, listB2BAddresses } from "../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../src/theme";
import type { BusinessBuyerAddress } from "../../../src/features/b2b/b2b-types";

function B2BAddressesContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState("");

  const addressesQuery = useQuery({
    queryKey: ["b2b-addresses", customerAuth.authKey],
    queryFn: () => listB2BAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteB2BAddress(customerAuth.authHeaders, id),
    onSuccess: () => {
      setDeleteError("");
      void queryClient.invalidateQueries({ queryKey: ["b2b-addresses", customerAuth.authKey] });
    },
    onError: (error) => {
      setDeleteError(error instanceof Error ? error.message : "Could not delete address.");
    },
  });

  const addresses: BusinessBuyerAddress[] = addressesQuery.data ?? [];

  return (
    <>
      {addressesQuery.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

          {addresses.length === 0 ? (
            <EmptyState
              title="No addresses yet"
              message="Add procurement addresses for your B2B orders."
            />
          ) : (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressCard}>
                <Pressable
                  style={styles.addressBody}
                  onPress={() =>
                    router.push(`/account/b2b/address-form?addressId=${addr.id}` as never)
                  }
                >
                  <Text style={styles.addressLine}>{addr.line1}</Text>
                  {addr.line2 ? <Text style={styles.addressMeta}>{addr.line2}</Text> : null}
                  <Text style={styles.addressMeta}>
                    {[addr.area, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                  </Text>
                  {addr.country ? <Text style={styles.addressMeta}>{addr.country}</Text> : null}
                </Pressable>
                <Pressable
                  disabled={deleteMutation.isPending}
                  style={styles.deleteBtn}
                  onPress={() => deleteMutation.mutate(addr.id)}
                >
                  <HugeiconsIcon color={colors.danger} icon={Delete02Icon} size={20} strokeWidth={2} />
                </Pressable>
              </View>
            ))
          )}

          <Pressable
            style={styles.addBtn}
            onPress={() => router.push("/account/b2b/address-form" as never)}
          >
            <HugeiconsIcon color={colors.primary} icon={PlusSignIcon} size={20} strokeWidth={2.2} />
            <Text style={styles.addBtnText}>Add procurement address</Text>
          </Pressable>
        </ScrollView>
      )}
    </>
  );
}

export default function B2BAddressesScreen() {
  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Procurement Addresses",
          headerRight: () => <HeaderAddButton />,
        }}
      />
      <B2BAuthGate>
        <B2BAddressesContent />
      </B2BAuthGate>
    </Screen>
  );
}

function HeaderAddButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/account/b2b/address-form" as never)}
      style={{ marginRight: spacing.md }}
    >
      <HugeiconsIcon color={colors.primary} icon={PlusSignIcon} size={24} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  addressCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  addressBody: { flex: 1 },
  addressLine: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  addressMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: spacing.sm },
  addBtn: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    padding: spacing.md,
  },
  addBtnText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
});
