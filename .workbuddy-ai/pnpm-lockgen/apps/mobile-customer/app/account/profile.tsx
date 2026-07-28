import { CheckmarkCircle02Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { Screen } from "../../src/components/screen";
import {
  getCustomerProfile,
  updateCustomerProfile,
  type MobileCustomerProfilePayload,
} from "../../src/features/storefront/storefront-api";
import { AccountLoadingState, accountErrorMessage, RetryState, SignInRequiredState } from "../../src/features/account/account-ui";
import { colors } from "../../src/theme";

const phonePattern = /^[6-9]\d{9}$/;

export default function ProfileEditScreen() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ displayName: "", fullName: "", phone: "" });
  const [formError, setFormError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["mobile-account-profile", customerAuth.authKey],
    queryFn: () => getCustomerProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) {
      return;
    }

    setForm({
      displayName: profile.displayName ?? "",
      fullName: profile.user?.fullName ?? "",
      phone: profile.user?.phone ?? "",
    });
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: MobileCustomerProfilePayload) => updateCustomerProfile(customerAuth.authHeaders, payload),
    onSuccess: async () => {
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] });
    },
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing" || profileQuery.isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Edit profile" }} />
        <AccountLoadingState title="Loading profile..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Edit profile" }} />
        <SignInRequiredState title="Sign in to edit profile" />
      </>
    );
  }

  if (profileQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Edit profile" }} />
        <RetryState
          title="Profile could not load"
          message={accountErrorMessage(profileQuery.error, "Check your connection and refresh profile.")}
          onRetry={() => void profileQuery.refetch()}
        />
      </>
    );
  }

  const email = profileQuery.data?.user?.email ?? customerAuth.userProfile.email ?? "";

  function submit() {
    const phone = form.phone.trim();
    if (phone && !phonePattern.test(phone)) {
      setFormError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    updateMutation.mutate({
      fullName: form.fullName.trim() || null,
      displayName: form.displayName.trim() || null,
      phone: phone || null,
    });
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Edit profile" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <HugeiconsIcon color={colors.primary} icon={UserCircleIcon} size={32} strokeWidth={2.1} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Name and phone are stored in 1HandIndia. Email stays managed by sign-in.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Label text="Email" />
          <TextInput editable={false} style={[styles.input, styles.inputReadOnly]} value={email} />

          <Label text="Full name" />
          <TextInput
            onChangeText={(value) => setForm((current) => ({ ...current, fullName: value }))}
            placeholder="Full name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.fullName}
          />

          <Label text="Display name" />
          <TextInput
            onChangeText={(value) => setForm((current) => ({ ...current, displayName: value }))}
            placeholder="Display name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.displayName}
          />

          <Label text="Phone" />
          <TextInput
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={(value) => setForm((current) => ({ ...current, phone: value.replace(/\D/g, "") }))}
            placeholder="9876543210"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.phone}
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {updateMutation.isError ? (
            <Text style={styles.errorText}>{accountErrorMessage(updateMutation.error, "Profile could not be saved.")}</Text>
          ) : null}
          {updateMutation.isSuccess ? (
            <View style={styles.savedRow}>
              <HugeiconsIcon color={colors.success} icon={CheckmarkCircle02Icon} size={18} strokeWidth={2.1} />
              <Text style={styles.savedText}>Profile saved</Text>
            </View>
          ) : null}

          <Pressable disabled={updateMutation.isPending} style={[styles.primaryButton, updateMutation.isPending ? styles.buttonDisabled : null]} onPress={submit}>
            {updateMutation.isPending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>Save profile</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: {
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
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  label: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 12,
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
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputReadOnly: {
    color: colors.muted,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
  },
  savedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  savedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 16,
    minHeight: 50,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    backgroundColor: "#A8AFBA",
  },
});
