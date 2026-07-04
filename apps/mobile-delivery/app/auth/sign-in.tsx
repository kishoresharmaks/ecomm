import { useAuth, useSignIn, useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { mobileDeliveryAuthErrorMessage, useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";
import { Button, Card, Field, Screen } from "../../src/components/screen";
import { webBaseUrl } from "../../src/lib/api";

export default function DeliverySignInScreen() {
  const router = useRouter();
  const deliveryAuth = useMobileDeliveryAuth();
  const { isSignedIn, signOut } = useAuth();
  const signIn = useSignIn();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | "sign-out" | null>(null);
  const hasClerkKey = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  useEffect(() => {
    if (isSignedIn && deliveryAuth.enabled) router.replace("/(tabs)");
  }, [deliveryAuth.enabled, isSignedIn, router]);

  async function handleSignIn() {
    if (!signIn.isLoaded) return;
    setError(null);
    setBusy("email");
    try {
      const result = await signIn.signIn.create({ identifier: email.trim(), password });
      if (result.createdSessionId) {
        await signIn.setActive({ session: result.createdSessionId });
        return;
      }
      setError("Additional verification is required for this account.");
    } catch (caught) {
      setError(mobileDeliveryAuthErrorMessage(caught));
    } finally {
      setBusy(null);
    }
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
    setBusy("sign-out");
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  }

  function openRegistration() {
    void Linking.openURL(`${webBaseUrl()}/delivery/register`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Delivery sign in" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Card>
          <Text style={{ color: "#ED3500", fontSize: 34, fontWeight: "900" }}>1HI</Text>
          <Text style={{ color: "#123A5A", fontSize: 28, fontWeight: "900" }}>Delivery partner sign in</Text>
          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
            Sign in with the approved account assigned to delivery operations.
          </Text>
        </Card>

        {!hasClerkKey ? (
          <Card>
            <Text style={{ color: "#D64545", fontWeight: "900" }}>Clerk setup required</Text>
            <Text style={{ color: "#6B7280" }}>Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before sign in.</Text>
          </Card>
        ) : null}

        {isSignedIn && !deliveryAuth.enabled ? (
          <Card>
            <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>Account sync in progress</Text>
            <Text style={{ color: "#6B7280" }}>{deliveryAuth.error ?? "Preparing your 1HandIndia account."}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button title="Retry" tone="secondary" onPress={deliveryAuth.refresh} />
              <Button title="Sign out" tone="danger" loading={busy === "sign-out"} onPress={handleSignOut} />
            </View>
          </Card>
        ) : null}

        <Card>
          <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />
          {error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{error}</Text> : null}
          <Button title="Sign in" loading={busy === "email"} disabled={!email.trim() || !password || busy !== null} onPress={handleSignIn} />
          <Button title="Continue with Google" tone="secondary" loading={busy === "google"} disabled={busy !== null} onPress={handleGoogleSignIn} />
          <Button title="Register as delivery partner" tone="secondary" onPress={openRegistration} />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

