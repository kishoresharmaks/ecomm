import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { B2BCustomerAuthGate } from "../../../src/features/b2b/b2b-customer-auth-gate";
import { MobileApiError } from "../../../src/lib/api";
import { getB2BProfile, upsertB2BProfile } from "../../../src/lib/mobile-b2b-api";
import { colors, spacing } from "../../../src/theme";

function B2BProfileContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", customerAuth.authKey],
    queryFn: () => getB2BProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: (failureCount, error) =>
      !(error instanceof MobileApiError && [404, 401, 403].includes(error.status)) &&
      failureCount < 2,
  });

  const isNewProfile = profileQuery.isError &&
    profileQuery.error instanceof MobileApiError &&
    profileQuery.error.status === 404;

  const existing = profileQuery.data;

  const [companyName, setCompanyName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (existing && hydratedKey !== existing.id) {
      setCompanyName(existing.companyName);
      setGstNumber(existing.gstNumber ?? "");
      setContactName(existing.contactName);
      setContactPhone(existing.contactPhone);
      setHydratedKey(existing.id);
      return;
    }

    const newProfileKey = `new:${customerAuth.authKey}`;
    if (isNewProfile && hydratedKey !== newProfileKey) {
      setCompanyName("");
      setGstNumber("");
      setContactName(customerAuth.userProfile.fullName ?? "");
      setContactPhone(customerAuth.userProfile.phone ?? "");
      setHydratedKey(newProfileKey);
    }
  }, [
    customerAuth.authKey,
    customerAuth.userProfile.fullName,
    customerAuth.userProfile.phone,
    existing,
    hydratedKey,
    isNewProfile,
  ]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertB2BProfile(customerAuth.authHeaders, {
        companyName: companyName.trim(),
        ...(gstNumber.trim() ? { gstNumber: gstNumber.trim() } : {}),
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["b2b-profile", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-profile-gate", customerAuth.authKey] });
      router.replace("/account/b2b" as never);
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : "Could not save profile.");
    },
  });

  function validate() {
    const errors: Record<string, string> = {};
    if (!companyName.trim()) errors.companyName = "Company name is required.";
    if (!contactName.trim()) errors.contactName = "Contact name is required.";
    if (!contactPhone.trim()) errors.contactPhone = "Contact phone is required.";
    else if (!/^\d{7,15}$/.test(contactPhone.trim().replace(/\s/g, "")))
      errors.contactPhone = "Enter a valid phone number.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    setSaveError("");
    if (!validate()) return;
    saveMutation.mutate();
  }

  if (profileQuery.isLoading && !isNewProfile) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Business Profile" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const isPending = existing?.status === "PENDING" || existing?.status === "UNDER_REVIEW";

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{ headerShown: true, title: isNewProfile ? "Complete Business Profile" : "Business Profile" }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isNewProfile && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Complete your business profile to start sending B2B enquiries.
              </Text>
            </View>
          )}

          {isPending && (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingBannerTitle}>Profile under review</Text>
              <Text style={styles.pendingBannerText}>
                Your profile is being reviewed. You can update details below while waiting for approval.
              </Text>
            </View>
          )}

          <Field
            error={fieldErrors.companyName || null}
            label="Company name *"
            onChangeText={setCompanyName}
            placeholder="Enter your company name"
            value={companyName}
          />
          <Field
            label="GST number (optional)"
            onChangeText={setGstNumber}
            placeholder="e.g. 27AAPFU0939F1ZV"
            value={gstNumber}
          />
          <Field
            error={fieldErrors.contactName || null}
            label="Contact person *"
            onChangeText={setContactName}
            placeholder="Full name of contact person"
            value={contactName}
          />
          <Field
            error={fieldErrors.contactPhone || null}
            keyboardType="phone-pad"
            label="Contact phone *"
            onChangeText={setContactPhone}
            placeholder="10-digit mobile number"
            value={contactPhone}
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
              <Text style={styles.saveBtnText}>{isNewProfile ? "Create profile" : "Save changes"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function B2BProfileScreen() {
  return (
    <B2BCustomerAuthGate>
      <B2BProfileContent />
    </B2BCustomerAuthGate>
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
  keyboardType?: "default" | "phone-pad";
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
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  content: { gap: spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  infoBanner: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  infoBannerText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  pendingBanner: {
    backgroundColor: "#FFF9E6",
    borderColor: colors.warning + "66",
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  pendingBannerTitle: { color: colors.warning, fontSize: 14, fontWeight: "700" },
  pendingBannerText: { color: "#7A5C00", fontSize: 13, lineHeight: 18, marginTop: 4 },
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
