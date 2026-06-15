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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mobileAuthErrorMessage, useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { Screen } from "../../src/components/screen";
import { colors } from "../../src/theme";

type AuthMode = "sign-in" | "sign-up" | "verify-email";
type SubmitAction = "email" | "google" | "sign-out" | "sync" | null;

const MAX_ACCOUNT_SYNC_RETRIES = 3;

export default function SignInScreen() {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
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
    mode === "sign-up" ? "Create your account" : mode === "verify-email" ? "Verify email" : "Sign in";

  useEffect(() => {
    if (customerAuth.enabled) {
      setSyncRetryCount(0);
    }
  }, [customerAuth.enabled]);

  useEffect(() => {
    if (isSignedIn && customerAuth.enabled && shouldAutoContinue) {
      router.replace("/account");
    }
  }, [customerAuth.enabled, isSignedIn, router, shouldAutoContinue]);

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
      setError(mobileAuthErrorMessage(caught));
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
      // SETUP REQUIRED: Enable Google OAuth in Clerk Dashboard and add onehandindia:// as the mobile redirect/deep link.
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
      setError(mobileAuthErrorMessage(caught));
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
      setError(mobileAuthErrorMessage(caught));
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
      setError(mobileAuthErrorMessage(caught));
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
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  function retryAccountSync() {
    setError(null);
    setSubmitAction("sync");
    setSyncRetryCount((current) => current + 1);
    customerAuth.refresh();
    setTimeout(() => setSubmitAction(null), 350);
  }

  const signedInButNotSynced = Boolean(isSignedIn && !customerAuth.enabled);
  const syncRetryLimitReached = syncRetryCount >= MAX_ACCOUNT_SYNC_RETRIES;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>1HI</Text>
            </View>
            <Text style={styles.kicker}>1HandIndia account</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Secure Clerk authentication for cart, orders, wishlist, addresses, and support.</Text>
          </View>

          {!hasClerkKey ? (
            <Notice
              tone="danger"
              title="Clerk setup required"
              message="EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Add it to the mobile environment before sign in can work."
            />
          ) : null}

          {signedInButNotSynced ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {customerAuth.status === "syncing" || customerAuth.status === "loading"
                  ? "Syncing your account"
                  : "Account sync needs attention"}
              </Text>
              <Text style={styles.cardText}>
                {customerAuth.status === "syncing" || customerAuth.status === "loading"
                  ? "Clerk sign in worked. We are preparing your 1HandIndia customer account."
                  : "Signed in with Clerk, but your 1HandIndia account could not sync. Retry account sync."}
              </Text>
              {customerAuth.error ? <Text style={styles.error}>{customerAuth.error}</Text> : null}
              {customerAuth.status === "syncing" || customerAuth.status === "loading" ? (
                <View style={styles.syncRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.syncText}>Connecting securely...</Text>
                </View>
              ) : (
                <>
                  {syncRetryLimitReached ? (
                    <Text style={styles.limitText}>Sync was retried 3 times. Sign out and try again when the API is reachable.</Text>
                  ) : null}
                  <Pressable
                    disabled={submitAction === "sync"}
                    style={[styles.primaryButton, syncRetryLimitReached ? styles.secondaryRecoveryButton : null]}
                    onPress={syncRetryLimitReached ? () => void handleSignOut() : retryAccountSync}
                  >
                    {submitAction === "sync" || submitAction === "sign-out" ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{syncRetryLimitReached ? "Sign out and retry later" : "Retry account sync"}</Text>
                    )}
                  </Pressable>
                  {syncRetryLimitReached ? (
                    <Pressable disabled={submitAction === "sync"} style={styles.secondaryButton} onPress={retryAccountSync}>
                      <Text style={styles.secondaryButtonText}>Try sync once more</Text>
                    </Pressable>
                  ) : (
                    <Pressable disabled={submitAction === "sign-out"} style={styles.secondaryButton} onPress={() => void handleSignOut()}>
                      <Text style={styles.secondaryButtonText}>Sign out</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ) : isSignedIn ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>You are signed in</Text>
              <Text style={styles.cardText}>Your Clerk session and 1HandIndia customer account are ready.</Text>
              <Pressable style={styles.primaryButton} onPress={() => router.replace("/account")}>
                <Text style={styles.primaryButtonText}>Go to account</Text>
              </Pressable>
              <Pressable disabled={isSubmitting} style={styles.secondaryButton} onPress={() => void handleSignOut()}>
                <Text style={styles.secondaryButtonText}>Sign out</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Pressable
                disabled={isSubmitting || !hasClerkKey}
                style={[styles.googleButton, isSubmitting || !hasClerkKey ? styles.disabledButton : null]}
                onPress={() => void handleGoogleSignIn()}
              >
                {submitAction === "google" ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <>
                    <View style={styles.googleMark}>
                      <Text style={styles.googleMarkText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or use email</Text>
                <View style={styles.dividerLine} />
              </View>

              {mode === "sign-up" ? (
                <Field autoCapitalize="words" label="Full name" onChangeText={setFullName} placeholder="Your name" value={fullName} />
              ) : null}

              {mode === "verify-email" ? (
                <Field inputMode="numeric" label="Email code" onChangeText={setCode} placeholder="Enter code" value={code} />
              ) : (
                <>
                  <Field
                    autoCapitalize="none"
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    value={email}
                  />
                  <Field label="Password" onChangeText={setPassword} placeholder="Password" secureTextEntry value={password} />
                </>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                disabled={isSubmitting || !hasClerkKey}
                style={[styles.primaryButton, isSubmitting || !hasClerkKey ? styles.disabledButton : null]}
                onPress={() => {
                  if (mode === "sign-up") {
                    void handleSignUp();
                    return;
                  }
                  if (mode === "verify-email") {
                    void handleVerifyEmail();
                    return;
                  }
                  void handleSignIn();
                }}
              >
                {submitAction === "email" ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === "sign-up" ? "Create account" : mode === "verify-email" ? "Verify and continue" : "Sign in"}
                  </Text>
                )}
              </Pressable>

              {mode === "verify-email" ? (
                <Pressable style={styles.switchButton} onPress={() => setMode("sign-up")}>
                  <Text style={styles.switchText}>Change email address</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.switchButton}
                  onPress={() => {
                    setError(null);
                    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  }}
                >
                  <Text style={styles.switchText}>
                    {mode === "sign-in" ? "New customer? Create account" : "Already have an account? Sign in"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  inputMode?: "text" | "numeric";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
};

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  autoCapitalize,
  inputMode,
  keyboardType,
  secureTextEntry,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        inputMode={inputMode}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Notice({ message, title, tone }: { message: string; title: string; tone: "danger" }) {
  return (
    <View style={[styles.notice, tone === "danger" ? styles.noticeDanger : null]}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 48,
    paddingTop: 18,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 16,
    padding: 22,
    shadowColor: "#ED3500",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 72,
    justifyContent: "center",
    marginBottom: 18,
    width: 72,
  },
  brandMarkText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: "900",
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: 7,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#ED3500",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  cardText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: "#F3E7E2",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    minHeight: 56,
  },
  googleMark: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  googleMarkText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  googleButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  field: {
    marginBottom: 13,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 54,
    paddingHorizontal: 15,
  },
  error: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F7C6C6",
    borderRadius: 18,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    marginTop: 4,
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryRecoveryButton: {
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.55,
  },
  switchButton: {
    alignItems: "center",
    marginTop: 16,
    padding: 10,
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  notice: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  noticeDanger: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F7C6C6",
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },
  syncRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  syncText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  limitText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 12,
  },
});
