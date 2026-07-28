import { useAuth, useSignIn, useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  canResendSecondFactor,
  preferredSecondFactor,
  secondFactorAttemptParams,
  secondFactorKey,
  secondFactorOptions,
  secondFactorPrepareParams,
  type SecondFactorOption,
  type SupportedSecondFactor,
} from "../../src/auth/clerk-second-factor";
import { mobileDeliveryAuthErrorMessage, useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";
import { revokeCurrentDeliveryPushToken } from "../../src/features/delivery/use-delivery-push-notifications";
import { webBaseUrl } from "../../src/lib/api";

WebBrowser.maybeCompleteAuthSession();

const colors = {
  primary: "#ED3500",
  primaryDark: "#C92A00",
  primaryLight: "#FF6B42",
  primaryMuted: "#FFF4EF",
  navy: "#123A5A",
  navyLight: "#1A4F76",
  ink: "#111827",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",
  border: "#F3E7E2",
  surface: "#FFFFFF",
  softSurface: "#FFFCFB",
  bg: "#FFF9F7",
  success: "#0F8A5F",
  danger: "#D64545",
  dangerLight: "#FEF2F2",
};

type ClerkSignInResource = {
  status?: string | null;
  createdSessionId?: string | null;
  supportedSecondFactors?: SupportedSecondFactor[] | null;
  prepareSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  attemptSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
};

export default function DeliverySignInScreen() {
  const router = useRouter();
  const deliveryAuth = useMobileDeliveryAuth();
  const { isSignedIn, signOut } = useAuth();
  const signIn = useSignIn();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | "sign-out" | null>(null);
  const [availableSecondFactors, setAvailableSecondFactors] = useState<SecondFactorOption[]>([]);
  const [selectedSecondFactor, setSelectedSecondFactor] = useState<SecondFactorOption | null>(null);
  // No fallback here on purpose: a missing env var should surface the setup
  // warning below instead of being masked by a hardcoded key.
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const hasClerkKey = Boolean(clerkPublishableKey);
  const verificationMode = selectedSecondFactor !== null;

  useEffect(() => {
    if (isSignedIn && deliveryAuth.enabled) router.replace("/(tabs)");
  }, [deliveryAuth.enabled, isSignedIn, router]);

  async function activateSession(resource: ClerkSignInResource) {
    if (!resource.createdSessionId || !signIn.setActive) {
      return false;
    }

    await signIn.setActive({ session: resource.createdSessionId });
    return true;
  }

  async function prepareSecondFactor(resource: ClerkSignInResource, option: SecondFactorOption) {
    const params = secondFactorPrepareParams(option);
    if (params) {
      await resource.prepareSecondFactor(params);
    }
  }

  async function beginSecondFactor(resource: ClerkSignInResource) {
    const options = secondFactorOptions(resource.supportedSecondFactors);
    const preferred = preferredSecondFactor(options);
    if (!preferred) {
      setError("This account requires a verification method that is not supported in the app. Contact support for help.");
      return;
    }

    await prepareSecondFactor(resource, preferred);
    setAvailableSecondFactors(options);
    setSelectedSecondFactor(preferred);
    setCode("");
    setNotice(secondFactorNotice(preferred));
  }

  async function continueSignIn(resource: ClerkSignInResource) {
    if (await activateSession(resource)) {
      return;
    }
    if (resource.status === "needs_second_factor") {
      await beginSecondFactor(resource);
      return;
    }

    setError(
      resource.status === "needs_new_password"
        ? "This account requires a new password before sign in. Reset the password and try again."
        : "Sign in could not be completed. Please try again.",
    );
  }

  async function handleSignIn() {
    if (!signIn.isLoaded) return;
    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      const result = await signIn.signIn.create({ identifier: email.trim(), password });
      await continueSignIn(result as unknown as ClerkSignInResource);
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleSecondFactor() {
    if (!signIn.isLoaded || !selectedSecondFactor) {
      return;
    }
    if (!code.trim()) {
      setError(selectedSecondFactor.strategy === "backup_code" ? "Enter a backup code." : "Enter the verification code.");
      return;
    }

    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).attemptSecondFactor(
        secondFactorAttemptParams(selectedSecondFactor, code),
      );
      await continueSignIn(resource);
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function selectSecondFactor(option: SecondFactorOption) {
    if (
      !signIn.isLoaded
      || (selectedSecondFactor && secondFactorKey(option) === secondFactorKey(selectedSecondFactor))
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, option);
      setSelectedSecondFactor(option);
      setCode("");
      setNotice(secondFactorNotice(option));
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function resendSecondFactor() {
    if (!signIn.isLoaded || !selectedSecondFactor || !canResendSecondFactor(selectedSecondFactor)) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusy("email");
    try {
      await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, selectedSecondFactor);
      setNotice(secondFactorNotice(selectedSecondFactor, true));
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function returnToSignIn() {
    setCode("");
    setError(null);
    setNotice(null);
    setAvailableSecondFactors([]);
    setSelectedSecondFactor(null);
  }

  async function handleGoogleSignIn() {
    if (!hasClerkKey) {
      setError("Clerk publishable key is missing.");
      return;
    }
    setError(null);
    setBusy("google");
    try {
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("sso-callback"),
      });
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        return;
      }
      if (result.authSessionResult?.type === "cancel") setError("Google sign in was cancelled.");
      else setError("Google sign in could not be completed.");
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOut() {
    setError(null);
    setBusy("sign-out");
    try {
      await revokeCurrentDeliveryPushToken();
      await signOut();
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  function openRegistration() {
    void Linking.openURL(`${webBaseUrl()}/delivery/register`);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.bg, flex: 1 }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          backgroundColor: colors.bg,
          flexGrow: 1,
          paddingBottom: 40,
          paddingHorizontal: 28,
          paddingTop: 60,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Brand header ────────────────────────────── */}
        <View style={{ marginBottom: 36 }}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandLogo}>1HI</Text>
          </View>
          <Text style={styles.heroTitle}>{verificationMode ? "Verify sign in" : "Delivery Partner"}</Text>
          <Text style={styles.heroSubtitle}>
            {verificationMode
              ? secondFactorInstruction(selectedSecondFactor)
              : "Sign in to manage your assigned deliveries and track orders in real time."}
          </Text>
        </View>

        {/* ─── Clerk key warning ───────────────────────── */}
        {!hasClerkKey ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Clerk setup required</Text>
            <Text style={styles.warningText}>Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before sign in.</Text>
          </View>
        ) : null}

        {/* ─── Sync-in-progress card ───────────────────── */}
        {isSignedIn && !deliveryAuth.enabled ? (
          <View style={styles.syncCard}>
            <View style={{ alignItems: "center" as const, flexDirection: "row" as const, gap: 12, marginBottom: 8 }}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.syncTitle}>Account sync in progress</Text>
            </View>
            <Text style={styles.syncText}>{deliveryAuth.error ?? "Preparing your 1HandIndia account."}</Text>
            <View style={{ flexDirection: "row" as const, gap: 12, marginTop: 12 }}>
              <Pressable
                onPress={deliveryAuth.refresh}
                style={[styles.pillButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={styles.pillButtonText}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={handleSignOut}
                disabled={busy === "sign-out"}
                style={[styles.pillButton, { borderColor: colors.danger, backgroundColor: colors.dangerLight }]}
              >
                {busy === "sign-out" ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Text style={[styles.pillButtonText, { color: colors.danger }]}>Sign out</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ─── Sign-in form card ───────────────────────── */}
        <View style={styles.formCard}>
          <Text style={styles.formSectionTitle}>
            {verificationMode ? "Complete secure verification" : "Sign in with credentials"}
          </Text>

          {verificationMode ? (
            <>
              {availableSecondFactors.length > 1 ? (
                <View style={styles.factorSection}>
                  <Text style={styles.fieldLabel}>Verify with</Text>
                  {availableSecondFactors.map((factor) => {
                    const active = selectedSecondFactor
                      ? secondFactorKey(factor) === secondFactorKey(selectedSecondFactor)
                      : false;
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        disabled={busy !== null}
                        key={secondFactorKey(factor)}
                        onPress={() => void selectSecondFactor(factor)}
                        style={[styles.factorButton, active ? styles.factorButtonActive : null]}
                      >
                        <Text style={[styles.factorButtonText, active ? styles.factorButtonTextActive : null]}>
                          {factor.label}
                        </Text>
                        {factor.destination ? <Text style={styles.factorDestination}>{factor.destination}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {selectedSecondFactor?.strategy === "backup_code" ? "Backup code" : "Verification code"}
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    accessibilityLabel={selectedSecondFactor?.strategy === "backup_code" ? "Backup code" : "Verification code"}
                    autoCapitalize="none"
                    autoComplete="one-time-code"
                    keyboardType={selectedSecondFactor?.strategy === "backup_code" ? "default" : "number-pad"}
                    maxLength={selectedSecondFactor?.strategy === "backup_code" ? 32 : 6}
                    onChangeText={(value) => setCode(
                      selectedSecondFactor?.strategy === "backup_code" ? value : value.replace(/\D/g, ""),
                    )}
                    placeholder={selectedSecondFactor?.strategy === "backup_code" ? "Enter backup code" : "6-digit code"}
                    placeholderTextColor={colors.mutedLight}
                    selectionColor={colors.primary}
                    style={[styles.inputField, { flex: 1 }]}
                    textContentType="oneTimeCode"
                    value={code}
                  />
                </View>
              </View>
            </>
          ) : null}

          <View style={[styles.fieldGroup, verificationMode ? styles.hidden : null]}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>✉</Text>
              <TextInput
                autoCapitalize="none"
                editable
                keyboardType="email-address"
                placeholder="name@example.com"
                placeholderTextColor={colors.mutedLight}
                selectionColor={colors.primary}
                style={[styles.inputField, { flex: 1 }]}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={[styles.fieldGroup, verificationMode ? styles.hidden : null]}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>🔒</Text>
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedLight}
                secureTextEntry
                selectionColor={colors.primary}
                style={[styles.inputField, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {notice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={verificationMode ? handleSecondFactor : handleSignIn}
            disabled={verificationMode ? !code.trim() || busy !== null : !email.trim() || !password || busy !== null}
            style={[
              styles.primaryButton,
              (verificationMode ? !code.trim() || busy !== null : !email.trim() || !password || busy !== null)
                ? styles.primaryButtonDisabled
                : null,
            ]}
          >
            {busy === "email" ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>{verificationMode ? "Verify and sign in" : "Sign in"}</Text>
            )}
          </Pressable>

          {verificationMode && canResendSecondFactor(selectedSecondFactor) ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={resendSecondFactor}
              style={[styles.secondaryAction, busy !== null ? styles.primaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryActionText}>Resend code</Text>
            </Pressable>
          ) : null}

          {verificationMode ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={returnToSignIn}
              style={[styles.backAction, busy !== null ? styles.primaryButtonDisabled : null]}
            >
              <Text style={styles.backActionText}>Back to sign in</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ─── Divider ──────────────────────────────────── */}
        <View style={[styles.dividerRow, verificationMode ? styles.hidden : null]}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ─── Google SSO ──────────────────────────────── */}
        <Pressable
          onPress={handleGoogleSignIn}
          disabled={busy !== null}
          style={[styles.googleButton, busy !== null ? styles.googleButtonDisabled : null, verificationMode ? styles.hidden : null]}
        >
          {busy === "google" ? (
            <ActivityIndicator color={colors.navy} size="small" />
          ) : (
            <View style={{ alignItems: "center" as const, flexDirection: "row" as const, gap: 12 }}>
              <View style={styles.googleIconCircle}>
                <Text style={{ fontSize: 18, fontWeight: "700" }}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>

        {/* ─── Register link ────────────────────────────── */}
        <View style={[{ alignItems: "center" as const, marginTop: 28 }, verificationMode ? styles.hidden : null]}>
          <Text style={styles.footerPrompt}>New delivery partner?</Text>
          <Pressable onPress={openRegistration}>
            <Text style={styles.footerLink}>Register your account →</Text>
          </Pressable>
        </View>

        <LegalFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const styles = StyleSheet.create({
  brandBadge: {
    alignSelf: "flex-start" as const,
    alignItems: "center" as const,
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 64,
    justifyContent: "center" as const,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    width: 64,
  },
  brandLogo: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  heroTitle: { color: colors.navy, fontSize: 32, fontWeight: "900", lineHeight: 38, marginBottom: 8 },
  heroSubtitle: { color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22 },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 18,
    padding: 24,
    shadowColor: colors.navy,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  formSectionTitle: { color: colors.navy, fontSize: 17, fontWeight: "900", marginBottom: 2 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.navy, fontSize: 12, fontWeight: "900", textTransform: "uppercase" as const },
  inputWrapper: {
    alignItems: "center" as const,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row" as const,
    height: 52,
    paddingHorizontal: 16,
  },
  inputPrefix: { fontSize: 16, marginRight: 8 },
  inputField: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    height: "100%" as const,
    includeFontPadding: false,
    padding: 0,
  },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderColor: "#FECACA",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  noticeBanner: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: { color: colors.success, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  factorSection: { gap: 8 },
  factorButton: {
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center" as const,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  factorButtonActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  factorButtonText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  factorButtonTextActive: { color: colors.primary },
  factorDestination: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  primaryButton: {
    alignItems: "center" as const,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 54,
    justifyContent: "center" as const,
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  secondaryAction: {
    alignItems: "center" as const,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center" as const,
    minHeight: 48,
  },
  secondaryActionText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  backAction: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: 44,
  },
  backActionText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  dividerRow: { alignItems: "center" as const, flexDirection: "row" as const, gap: 16, marginVertical: 20, paddingHorizontal: 12 },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerLabel: { color: colors.mutedLight, fontSize: 12, fontWeight: "700" },
  googleButton: {
    alignItems: "center" as const,
    backgroundColor: colors.surface,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 54,
    justifyContent: "center" as const,
  },
  googleButtonDisabled: { opacity: 0.5 },
  googleIconCircle: {
    alignItems: "center" as const,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    height: 32,
    justifyContent: "center" as const,
    width: 32,
  },
  googleButtonText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
  pillButton: {
    alignItems: "center" as const,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    height: 42,
    justifyContent: "center" as const,
  },
  pillButtonText: { color: colors.navy, fontSize: 14, fontWeight: "800" },
  footerPrompt: { color: colors.muted, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  footerLink: { color: colors.primary, fontSize: 15, fontWeight: "900" },
  warningCard: {
    backgroundColor: colors.dangerLight,
    borderColor: "#FECACA",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 20,
    padding: 16,
  },
  warningTitle: { color: colors.danger, fontSize: 15, fontWeight: "900" },
  warningText: { color: colors.danger, fontSize: 13, fontWeight: "600", lineHeight: 19, opacity: 0.85 },
  syncCard: {
    backgroundColor: colors.primaryMuted,
    borderColor: "#FFD6C4",
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginBottom: 20,
    padding: 16,
  },
  syncTitle: { color: colors.navy, fontSize: 15, fontWeight: "900" },
  syncText: { color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  hidden: { display: "none" as const },
});

function secondFactorInstruction(option: SecondFactorOption | null) {
  if (option?.destination) {
    return `Enter the code sent to ${option.destination}.`;
  }
  if (option?.strategy === "totp") {
    return "Enter the current code from your authenticator app.";
  }
  if (option?.strategy === "backup_code") {
    return "Enter one of your unused backup codes.";
  }
  return "Enter the verification code required for this account.";
}

function secondFactorNotice(option: SecondFactorOption, resent = false) {
  if (option.strategy === "email_code") {
    return resent ? "A new code was sent to your email." : "We sent a sign-in code to your email.";
  }
  if (option.strategy === "phone_code") {
    return resent ? "A new code was sent by text message." : "We sent a sign-in code by text message.";
  }
  if (option.strategy === "totp") {
    return "Open your authenticator app to get the current code.";
  }
  return "Use one of the backup codes saved when verification was enabled.";
}

function LegalFooter() {
  return (
    <View style={{ marginTop: 24, paddingHorizontal: 16, alignItems: "center" }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 18 }}>
        By continuing, you agree to 1HandIndia's{" "}
        <Text style={{ color: colors.primary, fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/terms-and-conditions")}>Terms of Service</Text>,{" "}
        <Text style={{ color: colors.primary, fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/privacy-policy")}>Privacy Policy</Text>,{" "}
        <Text style={{ color: colors.primary, fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/refund-return-policy")}>Return Policy</Text>,{" "}
        <Text style={{ color: colors.primary, fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/shipping-policy")}>Shipping Policy</Text>, and{" "}
        <Text style={{ color: colors.primary, fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/seller-policy")}>Seller Policy</Text>.
      </Text>
    </View>
  );
}
