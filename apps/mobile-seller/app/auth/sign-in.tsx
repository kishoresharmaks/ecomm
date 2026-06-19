import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useMobileSellerAuth, mobileSellerAuthErrorMessage } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, Field, Screen } from "../../src/components/screen";

type AuthMode = "sign-in" | "sign-up" | "verify-email";
type SubmitAction = "email" | "google" | "sign-out" | "sync" | null;

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
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);
  const [syncRetryCount, setSyncRetryCount] = useState(0);
  const [shouldAutoContinue, setShouldAutoContinue] = useState(false);
  const hasClerkKey = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  const isSubmitting = submitAction !== null;
  const title =
    mode === "sign-up" ? "Create seller account" : mode === "verify-email" ? "Verify email" : "Seller sign in";

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

  async function handleSignIn() {
    if (!signIn.isLoaded) {
      return;
    }

    setError(null);
    setSubmitAction("email");
    try {
      const result = await signIn.signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.createdSessionId) {
        await signIn.setActive({ session: result.createdSessionId });
        setShouldAutoContinue(true);
        return;
      }

      setError("Additional verification is required for this account. Please complete it in Clerk.");
    } catch (caught) {
      setError(mobileSellerAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
