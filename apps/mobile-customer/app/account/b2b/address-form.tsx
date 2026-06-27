import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../src/auth/mobile-auth-context";
import { MobileApiError } from "../../../src/lib/api";
import { createB2BAddress, listB2BAddresses, updateB2BAddress } from "../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../src/theme";
import type { BusinessBuyerAddressPayload } from "../../../src/features/b2b/b2b-types";

const EMPTY: BusinessBuyerAddressPayload = {
  line1: "",
  line2: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  countryCode: "IN",
};

export default function B2BAddressFormScreen() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ addressId?: string }>();
  const addressId = params.addressId;
  const isEdit = Boolean(addressId);

  const addressesQuery = useQuery({
    queryKey: ["b2b-addresses", customerAuth.authKey],
    queryFn: () => listB2BAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled && isEdit,
  });

  const existing = addressesQuery.data?.find((a) => a.id === addressId);

  const [form, setForm] = useState<BusinessBuyerAddressPayload>(() => {
    if (!existing) return EMPTY;
    const payload: BusinessBuyerAddressPayload = {
      line1: existing.line1,
      city: existing.city,
      state: existing.state,
      pincode: existing.pincode,
    };
    if (existing.line2) payload.line2 = existing.line2;
    if (existing.area) payload.area = existing.area;
    if (existing.country) payload.country = existing.country;
    if (existing.countryCode) payload.countryCode = existing.countryCode;
    if (existing.stateCode) payload.stateCode = existing.stateCode;
    if (existing.cityCode) payload.cityCode = existing.cityCode;
    if (existing.localAreaCode) payload.localAreaCode = existing.localAreaCode;
    return payload;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");

  const saveMutation = useMutation({
    mutationFn: () =>
      isEdit && addressId
        ? updateB2BAddress(customerAuth.authHeaders, addressId, form)
        : createB2BAddress(customerAuth.authHeaders, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["b2b-addresses", customerAuth.authKey] });
      router.back();
    },
    onError: (error) => {
      if (error instanceof MobileApiError && error.status === 409) {
        setSaveError("This address already exists.");
      } else {
        setSaveError(error instanceof Error ? error.message : "Could not save address.");
      }
    },
  });

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.line1?.trim()) errors.line1 = "Street address is required.";
    if (!form.city?.trim()) errors.city = "City is required.";
    if (!form.state?.trim()) errors.state = "State is required.";
    if (!form.pincode?.trim()) errors.pincode = "Pincode is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function update(key: keyof BusinessBuyerAddressPayload, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setSaveError("");
    if (!validate()) return;
    saveMutation.mutate();
  }

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{ headerShown: true, title: isEdit ? "Edit Address" : "Add Address" }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field
            error={fieldErrors.line1 || null}
            label="Street address *"
            onChangeText={(v) => update("line1", v)}
            placeholder="House / building, street"
            value={form.line1 ?? ""}
          />
          <Field
            label="Line 2 (optional)"
            onChangeText={(v) => update("line2", v)}
            placeholder="Apartment, landmark, etc."
            value={form.line2 ?? ""}
          />
          <Field
            label="Area / locality (optional)"
            onChangeText={(v) => update("area", v)}
            placeholder="Area or locality"
            value={form.area ?? ""}
          />
          <Field
            error={fieldErrors.city || null}
            label="City *"
            onChangeText={(v) => update("city", v)}
            placeholder="City"
            value={form.city ?? ""}
          />
          <Field
            error={fieldErrors.state || null}
            label="State *"
            onChangeText={(v) => update("state", v)}
            placeholder="State"
            value={form.state ?? ""}
          />
          <Field
            error={fieldErrors.pincode || null}
            keyboardType="number-pad"
            label="Pincode *"
            onChangeText={(v) => update("pincode", v)}
            placeholder="6-digit pincode"
            value={form.pincode ?? ""}
          />
          <Field
            label="Country"
            onChangeText={(v) => update("country", v)}
            placeholder="Country"
            value={form.country ?? "India"}
          />

          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

          <Pressable
            disabled={saveMutation.isPending}
            style={[styles.saveBtn, saveMutation.isPending && styles.saveBtnDisabled]}
            onPress={handleSave}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{isEdit ? "Save changes" : "Add address"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  error,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string | null;
  keyboardType?: "default" | "number-pad";
  label: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType ?? "default"}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.fieldInput, error ? styles.fieldInputError : null]}
        value={value}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  fieldInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  fieldInputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12 },
  saveError: { color: colors.danger, fontSize: 14, textAlign: "center" },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
