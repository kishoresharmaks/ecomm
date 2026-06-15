import { Delete02Icon, Home01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/empty-state";
import {
  MobileAddressForm,
  emptyMobileAddressForm,
  mobileAddressFormFromAddress,
} from "../../src/components/mobile-address-form";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { cleanMobileCustomerAddressForm } from "../../src/features/storefront/checkout-validation";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  updateCustomerAddress,
  type MobileCustomerAddress,
  type MobileCustomerAddressPayload,
} from "../../src/features/storefront/storefront-api";
import { AccountLoadingState, accountErrorMessage, RetryState, SignInRequiredState } from "../../src/features/account/account-ui";
import { colors } from "../../src/theme";

export default function AddressesScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MobileCustomerAddressPayload>(() => emptyMobileAddressForm());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const addressesQuery = useQuery({
    queryKey: ["mobile-account-addresses", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: MobileCustomerAddressPayload) =>
      editingId
        ? updateCustomerAddress(customerAuth.authHeaders, editingId, payload)
        : createCustomerAddress(customerAuth.authHeaders, payload),
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-addresses", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
  });

  const defaultMutation = useMutation({
    mutationFn: (addressId: string) => updateCustomerAddress(customerAuth.authHeaders, addressId, { isDefault: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-addresses", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (addressId: string) => deleteCustomerAddress(customerAuth.authHeaders, addressId),
    onSuccess: async () => {
      setConfirmDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-addresses", customerAuth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || addressesQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
        <AccountLoadingState title="Loading addresses..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
        <SignInRequiredState title="Sign in to manage addresses" />
      </>
    );
  }

  if (addressesQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
        <RetryState
          title="Addresses could not load"
          message={accountErrorMessage(addressesQuery.error, "Check your connection and refresh addresses.")}
          onRetry={() => void addressesQuery.refetch()}
        />
      </>
    );
  }

  const addresses = addressesQuery.data ?? [];

  function resetForm() {
    setForm(emptyMobileAddressForm());
    setEditingId(null);
    setFormOpen(false);
    setFormError("");
  }

  function startEdit(address: MobileCustomerAddress) {
    setForm(mobileAddressFormFromAddress(address));
    setEditingId(address.id);
    setFormOpen(true);
    setFormError("");
  }

  function submitAddress() {
    try {
      setFormError("");
      saveMutation.mutate(cleanMobileCustomerAddressForm(form, { isDefaultFallback: addresses.length === 0 }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Check the address fields and try again.");
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
      <FlashList
        contentContainerStyle={styles.listContent}
        data={addresses}
        keyExtractor={(address) => address.id}
        ListHeaderComponent={
          <View>
            <View style={styles.headerCard}>
              <View style={styles.headerIcon}>
                <HugeiconsIcon color={colors.primary} icon={Home01Icon} size={29} strokeWidth={2.1} />
              </View>
              <View style={styles.headerBody}>
                <Text style={styles.title}>Address book</Text>
                <Text style={styles.subtitle}>Manage delivery addresses used at checkout.</Text>
              </View>
              <Pressable style={styles.addIconButton} onPress={() => setFormOpen(true)}>
                <HugeiconsIcon color={colors.surface} icon={PlusSignIcon} size={20} strokeWidth={2.2} />
              </Pressable>
            </View>

            {formOpen ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{editingId ? "Edit address" : "Add address"}</Text>
                <MobileAddressForm value={form} onChange={setForm} disabled={saveMutation.isPending} />
                {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                {saveMutation.isError ? <Text style={styles.errorText}>{accountErrorMessage(saveMutation.error, "Address could not be saved.")}</Text> : null}
                <View style={styles.formActions}>
                  <Pressable style={styles.secondaryButton} onPress={resetForm}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable disabled={saveMutation.isPending} style={[styles.primaryButton, saveMutation.isPending ? styles.buttonDisabled : null]} onPress={submitAddress}>
                    {saveMutation.isPending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Save</Text>}
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState title="No saved addresses" message="Add a delivery address for faster checkout." />
          </View>
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            busy={defaultMutation.isPending || deleteMutation.isPending}
            confirmDelete={confirmDeleteId === item.id}
            onConfirmDelete={() => deleteMutation.mutate(item.id)}
            onDelete={() => setConfirmDeleteId(item.id)}
            onEdit={() => startEdit(item)}
            onSetDefault={() => defaultMutation.mutate(item.id)}
          />
        )}
      />
    </>
  );
}

function AddressCard({
  address,
  busy,
  confirmDelete,
  onConfirmDelete,
  onDelete,
  onEdit,
  onSetDefault,
}: {
  address: MobileCustomerAddress;
  busy: boolean;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View>
          <Text style={styles.addressTitle}>{address.label || address.fullName}</Text>
          {address.isDefault ? <Text style={styles.defaultText}>Default</Text> : null}
        </View>
        <Pressable disabled={busy} style={styles.deleteIconButton} onPress={confirmDelete ? onConfirmDelete : onDelete}>
          <HugeiconsIcon color={colors.danger} icon={Delete02Icon} size={18} strokeWidth={2.1} />
        </Pressable>
      </View>
      <Text style={styles.addressText}>{address.fullName} · {address.phone}</Text>
      <Text style={styles.addressText}>{[address.line1, address.line2, address.area].filter(Boolean).join(", ")}</Text>
      <Text style={styles.addressText}>{[address.city, address.state, address.pincode].filter(Boolean).join(" - ")}</Text>
      <View style={styles.cardActions}>
        <Pressable style={styles.actionButton} onPress={onEdit}>
          <Text style={styles.actionButtonText}>Edit</Text>
        </Pressable>
        {!address.isDefault ? (
          <Pressable disabled={busy} style={styles.actionButton} onPress={onSetDefault}>
            <Text style={styles.actionButtonText}>Set default</Text>
          </Pressable>
        ) : null}
        {confirmDelete ? <Text style={styles.confirmText}>Tap delete again to confirm.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
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
    marginBottom: 14,
    padding: 14,
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  headerBody: {
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
  addIconButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  formTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 10,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
  },
  compactInputWrap: {
    flex: 1,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  checkbox: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#FFD7CA",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: {
    backgroundColor: "#A8AFBA",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  addressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addressTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  defaultText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  deleteIconButton: {
    alignItems: "center",
    backgroundColor: "#FEF3F2",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  addressText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 5,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    borderColor: "#FFD7CA",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  confirmText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 31,
  },
});
