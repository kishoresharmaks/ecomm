import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";

WebBrowser.maybeCompleteAuthSession();
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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
import { useMobileSellerAuth, mobileSellerAuthErrorMessage } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Field, Screen } from "../../src/components/screen";

type AuthMode = "sign-in" | "sign-up" | "verify-email" | "verify-sign-in";
type SubmitAction = "email" | "google" | "sign-out" | "sync" | null;

type ClerkSignInResource = {
  status?: string | null;
  createdSessionId?: string | null;
  supportedSecondFactors?: SupportedSecondFactor[] | null;
  prepareSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  attemptSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
};

const MAX_ACCOUNT_SYNC_RETRIES = 3;

export default function SellerSignInScreen() {
  const router = useRouter();
  const sellerAuth = useMobileSellerAuth();
  const { isSignedIn, signOut } = useAuth();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const { startSSOFlow } = useSSO();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);
  const [syncRetryCount, setSyncRetryCount] = useState(0);
  const [shouldAutoContinue, setShouldAutoContinue] = useState(false);
  const [availableSecondFactors, setAvailableSecondFactors] = useState<SecondFactorOption[]>([]);
  const [selectedSecondFactor, setSelectedSecondFactor] = useState<SecondFactorOption | null>(null);
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const hasClerkKey = Boolean(clerkPublishableKey);
  const isSubmitting = submitAction !== null;
  const title =
    mode === "sign-up"
      ? "Create seller account"
      : mode === "verify-email"
        ? "Verify email"
        : mode === "verify-sign-in"
          ? "Verify sign in"
          : "Seller sign in";

  useEffect(() => {
    if (sellerAuth.enabled) {
      setSyncRetryCount(0);
    }
  }, [sellerAuth.enabled]);

  useEffect(() => {
    if (isSignedIn && sellerAuth.enabled && shouldAutoContinue) {
      router.replace("/(tabs)");
    }
  }, [sellerAuth.enabled, isSignedIn, router, shouldAutoContinue]);

  async function activateSession(resource: ClerkSignInResource) {
    if (!resource.createdSessionId || !signIn.setActive) {
      return false;
    }

    await signIn.setActive({ session: resource.createdSessionId });
    setShouldAutoContinue(true);
    setSyncRetryCount(0);
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
    setMode("verify-sign-in");
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
    if (!signIn.isLoaded) {
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("email");
    try {
      const result = await signIn.signIn.create({
        identifier: email.trim(),
        password,
      });
      await continueSignIn(result as unknown as ClerkSignInResource);
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
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
    setSubmitAction("email");
    try {
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).attemptSecondFactor(
        secondFactorAttemptParams(selectedSecondFactor, code),
      );
      await continueSignIn(resource);
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
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
    setSubmitAction("email");
    try {
      await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, option);
      setSelectedSecondFactor(option);
      setCode("");
      setNotice(secondFactorNotice(option));
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function resendSecondFactor() {
    if (!signIn.isLoaded || !selectedSecondFactor || !canResendSecondFactor(selectedSecondFactor)) {
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("email");
    try {
      await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, selectedSecondFactor);
      setNotice(secondFactorNotice(selectedSecondFactor, true));
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  function returnToSignIn() {
    setMode("sign-in");
    setCode("");
    setError(null);
    setNotice(null);
    setAvailableSecondFactors([]);
    setSelectedSecondFactor(null);
  }

  async function handleGoogleSignIn() {
    if (!hasClerkKey) {
      setError("Clerk publishable key is missing. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before using sign in.");
      return;
    }

    setError(null);
    setSubmitAction("google");
    try {
      // SETUP REQUIRED: Enable Google OAuth in Clerk Dashboard and add onehandindia-seller:// as the mobile redirect/deep link.
      const result = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("sso-callback"),
      });

      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        setShouldAutoContinue(true);
        setSyncRetryCount(0);
        return;
      }

      if (result.authSessionResult?.type === "cancel") {
        setError("Google sign in was cancelled.");
        return;
      }

      setError("Google sign in could not be completed. Please try again.");
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleSignUp() {
    if (!signUp.isLoaded) {
      return;
    }

    setError(null);
    setSubmitAction("email");
    try {
      const names = fullName.trim().split(/\s+/).filter(Boolean);
      await signUp.signUp.create({
        emailAddress: email.trim(),
        password,
        ...(names[0] ? { firstName: names[0] } : {}),
        ...(names.length > 1 ? { lastName: names.slice(1).join(" ") } : {}),
      });
      await signUp.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify-email");
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleVerifyEmail() {
    if (!signUp.isLoaded) {
      return;
    }

    setError(null);
    setSubmitAction("email");
    try {
      const result = await signUp.signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.createdSessionId) {
        await signUp.setActive({ session: result.createdSessionId });
        setShouldAutoContinue(true);
        return;
      }

      setError("Email verification is not complete yet. Check the code and try again.");
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleSignOut() {
    setError(null);
    setSubmitAction("sign-out");
    try {
      await signOut();
      setShouldAutoContinue(false);
      setSyncRetryCount(0);
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  function retryAccountSync() {
    setError(null);
    setSubmitAction("sync");
    setSyncRetryCount((current) => current + 1);
    sellerAuth.refresh();
    setTimeout(() => setSubmitAction(null), 350);
  }

  const signedInButNotSynced = Boolean(isSignedIn && !sellerAuth.enabled);
  const syncRetryLimitReached = syncRetryCount >= MAX_ACCOUNT_SYNC_RETRIES;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={{ color: "#ED3500", fontSize: 32, fontWeight: "900" }}>1HI</Text>
            <Text style={{ color: "#111827", fontSize: 28, fontWeight: "900" }}>{title}</Text>
            <Text style={{ color: "#6B7280", fontSize: 14, lineHeight: 20 }}>
              Secure Clerk authentication for seller store management, products, orders, and payouts.
            </Text>
          </Card>

          {!hasClerkKey ? (
            <Card>
              <Text style={{ color: "#D64545", fontSize: 16, fontWeight: "900" }}>Clerk setup required</Text>
              <Text style={{ color: "#6B7280" }}>EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Add it to the mobile environment before sign in can work.</Text>
            </Card>
          ) : null}

          {signedInButNotSynced ? (
            <Card>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>
                {sellerAuth.status === "syncing" || sellerAuth.status === "loading"
                  ? "Syncing your account"
                  : "Account sync needs attention"}
              </Text>
              <Text style={{ color: "#6B7280" }}>
                {sellerAuth.status === "syncing" || sellerAuth.status === "loading"
                  ? "Clerk sign in worked. We are preparing your 1HandIndia seller account."
                  : "Signed in with Clerk, but your 1HandIndia account could not sync. Retry account sync."}
              </Text>
              {sellerAuth.error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{sellerAuth.error}</Text> : null}
              {sellerAuth.status === "syncing" || sellerAuth.status === "loading" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#ED3500" />
                  <Text style={{ color: "#6B7280" }}>Connecting securely...</Text>
                </View>
              ) : (
                <>
                  {syncRetryLimitReached ? (
                    <Text style={{ color: "#6B7280" }}>Sync was retried 3 times. Sign out and try again when the API is reachable.</Text>
                  ) : null}
                  <Button
                    disabled={submitAction === "sync"}
                    title="Retry account sync"
                    onPress={retryAccountSync}
                  />
                  <Button
                    disabled={submitAction === "sign-out"}
                    tone="secondary"
                    title="Sign out"
                    onPress={handleSignOut}
                  />
                </>
              )}
            </Card>
          ) : null}

          {mode === "sign-in" && !signedInButNotSynced ? (
            <>
              <Card>
                <Field
                  autoCapitalize="none"
                  keyboardType="email-address"
                  label="Email"
                  onChangeText={setEmail}
                  value={email}
                />
                <Field
                  label="Password"
                  onChangeText={setPassword}
                  secureTextEntry
                  value={password}
                />
                {error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text> : null}
                <Button
                  disabled={isSubmitting || !email || !password}
                  title={isSubmitting && submitAction === "email" ? "Signing in..." : "Sign in with email"}
                  onPress={handleSignIn}
                />
                {hasClerkKey ? (
                  <Button
                    disabled={isSubmitting}
                    tone="secondary"
                    title={isSubmitting && submitAction === "google" ? "Connecting to Google..." : "Sign in with Google"}
                    onPress={handleGoogleSignIn}
                  />
                ) : null}
              </Card>
              <Pressable onPress={() => { setError(null); setMode("sign-up"); }}>
                <Text style={{ color: "#ED3500", fontSize: 16, fontWeight: "900" }}>Create a seller account</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "sign-up" && !signedInButNotSynced ? (
            <>
              <Card>
              <Field
                autoCapitalize="words"
                label="Full name"
                onChangeText={setFullName}
                value={fullName}
              />
              <Field
                autoCapitalize="none"
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                value={email}
              />
              <Field
                label="Password"
                onChangeText={setPassword}
                secureTextEntry
                value={password}
              />
              {error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text> : null}
              <Button
                disabled={isSubmitting || !email || !password || !fullName}
                title={isSubmitting ? "Creating account..." : "Create account"}
                onPress={handleSignUp}
              />
              </Card>
              <Pressable onPress={() => { setError(null); setMode("sign-in"); }}>
                <Text style={{ color: "#6B7280", fontSize: 16, fontWeight: "900" }}>I already have an account</Text>
              </Pressable>
            </>
          ) : null}

          {mode === "verify-email" && !signedInButNotSynced ? (
            <>
              <Card>
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>Enter the verification code sent to your email</Text>
              <Field
                keyboardType="number-pad"
                label="Verification code"
                onChangeText={setCode}
                value={code}
              />
              {error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text> : null}
              <Button
                disabled={isSubmitting || !code}
                title={isSubmitting ? "Verifying..." : "Verify email"}
                onPress={handleVerifyEmail}
              />
              <Button
                disabled={isSubmitting}
                tone="secondary"
                title="Resend code"
                onPress={() => {
                  if (signUp.isLoaded) {
                    signUp.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
                  }
                }}
              />
            </Card>
            </>
          ) : null}

          {mode === "verify-sign-in" && !signedInButNotSynced ? (
            <>
              <Card>
                <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Complete secure verification</Text>
                <Text style={{ color: "#6B7280", fontSize: 14, lineHeight: 20 }}>
                  {secondFactorInstruction(selectedSecondFactor)}
                </Text>
                {availableSecondFactors.length > 1 ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: "#111827", fontSize: 13, fontWeight: "800" }}>Verify with</Text>
                    {availableSecondFactors.map((factor) => {
                      const active = selectedSecondFactor
                        ? secondFactorKey(factor) === secondFactorKey(selectedSecondFactor)
                        : false;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          disabled={isSubmitting}
                          key={secondFactorKey(factor)}
                          onPress={() => void selectSecondFactor(factor)}
                          style={{
                            backgroundColor: active ? "#FFF4EF" : "#FFFFFF",
                            borderColor: active ? "#ED3500" : "#E5E7EB",
                            borderRadius: 8,
                            borderWidth: 1,
                            justifyContent: "center",
                            minHeight: 48,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ color: active ? "#ED3500" : "#111827", fontSize: 14, fontWeight: "800" }}>
                            {factor.label}
                          </Text>
                          {factor.destination ? (
                            <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{factor.destination}</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                <Field
                  autoComplete="one-time-code"
                  keyboardType={selectedSecondFactor?.strategy === "backup_code" ? "default" : "number-pad"}
                  label={selectedSecondFactor?.strategy === "backup_code" ? "Backup code" : "Verification code"}
                  maxLength={selectedSecondFactor?.strategy === "backup_code" ? 32 : 6}
                  onChangeText={(value) => setCode(
                    selectedSecondFactor?.strategy === "backup_code" ? value : value.replace(/\D/g, ""),
                  )}
                  placeholder={selectedSecondFactor?.strategy === "backup_code" ? "Enter backup code" : "6-digit code"}
                  textContentType="oneTimeCode"
                  value={code}
                />
                {notice ? <Text style={{ color: "#0F7A4F", fontWeight: "700" }}>{notice}</Text> : null}
                {error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text> : null}
                <Button
                  disabled={isSubmitting || !code.trim()}
                  title={isSubmitting ? "Verifying..." : "Verify and sign in"}
                  onPress={handleSecondFactor}
                />
                {canResendSecondFactor(selectedSecondFactor) ? (
                  <Button
                    disabled={isSubmitting}
                    tone="secondary"
                    title="Resend code"
                    onPress={resendSecondFactor}
                  />
                ) : null}
              </Card>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={returnToSignIn}
                style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
              >
                <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "800" }}>Back to sign in</Text>
              </Pressable>
            </>
          ) : null}
          <LegalFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

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
      <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 18 }}>
        By continuing, you agree to 1HandIndia's{" "}
        <Text style={{ color: "#ED3500", fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/terms-and-conditions")}>Terms of Service</Text>,{" "}
        <Text style={{ color: "#ED3500", fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/privacy-policy")}>Privacy Policy</Text>,{" "}
        <Text style={{ color: "#ED3500", fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/refund-return-policy")}>Return Policy</Text>,{" "}
        <Text style={{ color: "#ED3500", fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/shipping-policy")}>Shipping Policy</Text>, and{" "}
        <Text style={{ color: "#ED3500", fontWeight: "800" }} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/seller-policy")}>Seller Policy</Text>.
      </Text>
    </View>
  );
}
