import { LockPasswordIcon, Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useUser } from "@clerk/clerk-expo";
import { useMutation } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileAuthErrorMessage, useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { EmptyState } from "../../src/components/empty-state";
import { Screen } from "../../src/components/screen";
import { AccountLoadingState, SignInRequiredState } from "../../src/features/account/account-ui";
import { colors } from "../../src/theme";

type PasswordCapableUser = {
  updatePassword?: (params: {
    currentPassword: string;
    newPassword: string;
    signOutOfOtherSessions?: boolean;
  }) => Promise<unknown>;
};

export default function ChangePasswordScreen() {
  const customerAuth = useMobileCustomerAuth();
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const passwordUser = user as PasswordCapableUser | null | undefined;

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const updatePassword = passwordUser?.updatePassword;
      if (!updatePassword) {
        throw new Error("Password change is not available for this sign-in method.");
      }
      await updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });
    },
    onMutate: () => {
      setFormError("");
      setSavedMessage("");
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSavedMessage("Password updated successfully.");
    },
  });

  if (customerAuth.status === "loading" || customerAuth.status === "syncing") {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Change password" }} />
        <AccountLoadingState title="Preparing account..." />
      </>
    );
  }

  if (!customerAuth.enabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Change password" }} />
        <SignInRequiredState title="Sign in to change password" />
      </>
    );
  }

  if (!customerAuth.userProfile.canChangePassword) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Change password" }} />
        <EmptyState
          title="Password change unavailable"
          message={customerAuth.userProfile.hasGoogleAccount ? "This account signs in with Google, so password changes are managed by Google." : "This sign-in method does not support an in-app password change."}
        />
      </Screen>
    );
  }

  function submit() {
    const current = currentPassword;
    const next = newPassword;
    const confirm = confirmPassword;

    if (!current || !next || !confirm) {
      setFormError("Enter your current password and new password.");
      return;
    }

    if (next.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }

    if (next !== confirm) {
      setFormError("New password and confirmation do not match.");
      return;
    }

    changePasswordMutation.mutate();
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "Change password" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <HugeiconsIcon color={colors.primary} icon={LockPasswordIcon} size={32} strokeWidth={2.1} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.title}>Change password</Text>
            <Text style={styles.subtitle}>Use a strong password you do not use on other apps.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Label text="Current password" />
          <TextInput
            autoCapitalize="none"
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={currentPassword}
          />

          <Label text="New password" />
          <TextInput
            autoCapitalize="none"
            onChangeText={setNewPassword}
            placeholder="Minimum 8 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={newPassword}
          />

          <Label text="Confirm new password" />
          <TextInput
            autoCapitalize="none"
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />

          <View style={styles.secureHint}>
            <HugeiconsIcon color={colors.success} icon={Shield01Icon} size={18} strokeWidth={2.1} />
            <Text style={styles.secureHintText}>Your active 1HandIndia session stays protected after this update.</Text>
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
          {changePasswordMutation.isError ? (
            <Text style={styles.errorText}>{mobileAuthErrorMessage(changePasswordMutation.error)}</Text>
          ) : null}
          {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}

          <Pressable
            disabled={changePasswordMutation.isPending}
            style={[styles.primaryButton, changePasswordMutation.isPending ? styles.buttonDisabled : null]}
            onPress={submit}
          >
            {changePasswordMutation.isPending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Update password</Text>
            )}
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
  secureHint: {
    alignItems: "center",
    backgroundColor: "#F7FBF9",
    borderColor: "#CFEFE2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  secureHintText: {
    color: colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 12,
  },
  savedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 50,
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
