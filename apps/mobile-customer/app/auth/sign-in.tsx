import {
  ArrowLeft02Icon,
  GoogleIcon,
  LockPasswordIcon,
  Mail01Icon,
  SmartPhone01Icon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { mobileAuthErrorMessage, useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { Screen } from "../../src/components/screen";
import { useCustomerPushNotificationStatus } from "../../src/features/notifications/use-customer-push-notifications";
import { colors } from "../../src/theme";
import logoSource from "../../assets/splash-logo.png";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "sign-in" | "sign-up" | "verify-email" | "verify-phone" | "forgot-password" | "reset-password";
type IdentifierMode = "email" | "phone";
type SubmitAction = "password" | "google" | "sign-out" | "sync" | "reset" | null;

type ClerkSignInResource = {
  create: (params: Record<string, unknown>) => Promise<{ createdSessionId?: string | null }>;
  attemptFirstFactor?: (params: Record<string, unknown>) => Promise<{ createdSessionId?: string | null; status?: string | null }>;
};

const MAX_ACCOUNT_SYNC_RETRIES = 3;

export default function SignInScreen() {
  const router = useRouter();
  const customerAuth = useMobileCustomerAuth();
  const { isSignedIn, signOut } = useAuth();
  const pushStatus = useCustomerPushNotificationStatus();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const { startSSOFlow } = useSSO();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifierMode, setIdentifierMode] = useState<IdentifierMode>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [code, setCode] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);
  const [syncRetryCount, setSyncRetryCount] = useState(0);
  const [shouldAutoContinue, setShouldAutoContinue] = useState(false);
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "pk_live_Y2xlcmsuMWhhbmRpbmRpYS5jb20k";
  const hasClerkKey = Boolean(clerkPublishableKey);
  const isSubmitting = submitAction !== null;
  const screenTitle = titleForMode(mode);
  const primaryLabel = primaryLabelForMode(mode);
  const subtitle =
    mode === "forgot-password" || mode === "reset-password"
      ? "Reset your password securely with Clerk verification."
      : "Secure Clerk authentication for cart, orders, wishlist, addresses, and support.";
  const showIdentifierTabs = mode === "sign-in" || mode === "sign-up" || mode === "forgot-password";

  const identifier = useMemo(
    () => (identifierMode === "phone" ? normalizePhoneIdentifier(phone) : email.trim()),
    [email, identifierMode, phone],
  );

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

    const validation = validatePasswordAuth(identifierMode, identifier, password);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("password");
    try {
      const result = await signIn.signIn.create({
        identifier,
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
    setNotice(null);
    setSubmitAction("google");
    try {
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

    const validation = validateSignUp(identifierMode, identifier, password, fullName);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("password");
    try {
      const names = fullName.trim().split(/\s+/).filter(Boolean);
      await signUp.signUp.create({
        ...(identifierMode === "phone" ? { phoneNumber: identifier } : { emailAddress: identifier }),
        password,
        ...(names[0] ? { firstName: names[0] } : {}),
        ...(names.length > 1 ? { lastName: names.slice(1).join(" ") } : {}),
      });

      if (identifierMode === "phone") {
        await signUp.signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        setMode("verify-phone");
      } else {
        await signUp.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setMode("verify-email");
      }
      setCode("");
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleVerifySignUp() {
    if (!signUp.isLoaded) {
      return;
    }

    if (!code.trim()) {
      setError("Enter the verification code.");
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("password");
    try {
      const result =
        mode === "verify-phone"
          ? await signUp.signUp.attemptPhoneNumberVerification({ code: code.trim() })
          : await signUp.signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.createdSessionId) {
        await signUp.setActive({ session: result.createdSessionId });
        setShouldAutoContinue(true);
        return;
      }

      setError("Verification is not complete yet. Check the code and try again.");
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleForgotPassword() {
    if (!signIn.isLoaded) {
      return;
    }

    const validation = validateIdentifier(identifierMode, identifier);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("reset");
    try {
      await (signIn.signIn as unknown as ClerkSignInResource).create({
        identifier,
        strategy: resetPasswordStrategy(identifierMode),
      });
      setCode("");
      setResetPassword("");
      setMode("reset-password");
      setNotice(identifierMode === "phone" ? "We sent a reset code to your phone." : "We sent a reset code to your email.");
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleResetPassword() {
    if (!signIn.isLoaded) {
      return;
    }

    if (!code.trim()) {
      setError("Enter the reset code.");
      return;
    }
    if (resetPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("reset");
    try {
      const signInResource = signIn.signIn as unknown as ClerkSignInResource;
      if (!signInResource.attemptFirstFactor) {
        throw new Error("Password reset is not available in this Clerk session.");
      }

      const result = await signInResource.attemptFirstFactor({
        code: code.trim(),
        password: resetPassword,
        strategy: resetPasswordStrategy(identifierMode),
      });

      if (result.createdSessionId) {
        await signIn.setActive({ session: result.createdSessionId });
        setShouldAutoContinue(true);
        return;
      }

      setError("Password reset needs another verification step. Please try signing in again.");
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
      await pushStatus.revoke();
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

  function switchMode(nextMode: AuthMode) {
    setError(null);
    setNotice(null);
    setCode("");
    setMode(nextMode);
  }

  const signedInButNotSynced = Boolean(isSignedIn && !customerAuth.enabled);
  const syncRetryLimitReached = syncRetryCount >= MAX_ACCOUNT_SYNC_RETRIES;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Go back" hitSlop={12} style={styles.backButton} onPress={() => router.back()}>
              <HugeiconsIcon color={colors.ink} icon={ArrowLeft02Icon} size={24} strokeWidth={2.4} />
            </Pressable>
            <Text numberOfLines={1} style={styles.headerTitle}>{screenTitle}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.logoStage}>
            <View style={[styles.logoPlate, mode === "sign-up" ? styles.logoPlateActive : null]}>
              <Image resizeMode="contain" source={logoSource} style={styles.logoImage} />
            </View>
          </View>

          {!hasClerkKey ? (
            <Notice
              tone="danger"
              title="Clerk setup required"
              message="EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Add it to the mobile environment before sign in can work."
            />
          ) : null}

          {signedInButNotSynced ? (
            <AuthPanel>
              <Text style={styles.kicker}>1HandIndia account</Text>
              <Text style={styles.title}>
                {customerAuth.status === "syncing" || customerAuth.status === "loading"
                  ? "Syncing your account"
                  : "Account sync needs attention"}
              </Text>
              <Text style={styles.subtitle}>
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
                  <PrimaryButton
                    disabled={submitAction === "sync" || submitAction === "sign-out"}
                    label={syncRetryLimitReached ? "Sign out and retry later" : "Retry account sync"}
                    loading={submitAction === "sync" || submitAction === "sign-out"}
                    onPress={syncRetryLimitReached ? () => void handleSignOut() : retryAccountSync}
                  />
                  <SecondaryButton
                    disabled={submitAction === "sync" || submitAction === "sign-out"}
                    label={syncRetryLimitReached ? "Try sync once more" : "Sign out"}
                    onPress={syncRetryLimitReached ? retryAccountSync : () => void handleSignOut()}
                  />
                </>
              )}
            </AuthPanel>
          ) : isSignedIn ? (
            <AuthPanel>
              <Text style={styles.kicker}>1HandIndia account</Text>
              <Text style={styles.title}>You are signed in</Text>
              <Text style={styles.subtitle}>Your Clerk session and 1HandIndia customer account are ready.</Text>
              <PrimaryButton label="Go to account" onPress={() => router.replace("/account")} />
              <SecondaryButton disabled={isSubmitting} label="Sign out" onPress={() => void handleSignOut()} />
            </AuthPanel>
          ) : (
            <AuthPanel>
              <Text style={styles.kicker}>1HandIndia account</Text>
              <Text style={styles.title}>{headlineForMode(mode)}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              {mode !== "verify-email" && mode !== "verify-phone" && mode !== "reset-password" ? (
                <Pressable
                  disabled={isSubmitting || !hasClerkKey}
                  style={[styles.googleButton, isSubmitting || !hasClerkKey ? styles.disabledButton : null]}
                  onPress={() => void handleGoogleSignIn()}
                >
                  {submitAction === "google" ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <>
                      <HugeiconsIcon color="#4285F4" icon={GoogleIcon} size={24} strokeWidth={2.1} />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>
              ) : null}

              {mode !== "verify-email" && mode !== "verify-phone" && mode !== "reset-password" ? <Divider /> : null}

              {showIdentifierTabs ? (
                <View style={styles.segmentRow}>
                  <SegmentButton active={identifierMode === "email"} label="Email" onPress={() => setIdentifierMode("email")} />
                  <SegmentButton active={identifierMode === "phone"} label="Phone" onPress={() => setIdentifierMode("phone")} />
                </View>
              ) : null}

              {mode === "sign-up" ? (
                <Field
                  autoCapitalize="words"
                  icon={UserIcon}
                  label="Full name"
                  onChangeText={setFullName}
                  placeholder="Your name"
                  value={fullName}
                />
              ) : null}

              {mode === "verify-email" || mode === "verify-phone" ? (
                <Field
                  inputMode="numeric"
                  icon={LockPasswordIcon}
                  label={mode === "verify-phone" ? "Phone code" : "Email code"}
                  onChangeText={setCode}
                  placeholder="Enter code"
                  value={code}
                />
              ) : mode === "reset-password" ? (
                <>
                  <Field
                    inputMode="numeric"
                    icon={LockPasswordIcon}
                    label="Reset code"
                    onChangeText={setCode}
                    placeholder="Enter code"
                    value={code}
                  />
                  <Field
                    icon={LockPasswordIcon}
                    label="New password"
                    onChangeText={setResetPassword}
                    onToggleSecure={() => setResetPasswordVisible((current) => !current)}
                    placeholder="New password"
                    secureTextEntry={!resetPasswordVisible}
                    showSecureToggle
                    value={resetPassword}
                  />
                </>
              ) : (
                <>
                  <Field
                    autoCapitalize="none"
                    icon={identifierMode === "phone" ? SmartPhone01Icon : Mail01Icon}
                    keyboardType={identifierMode === "phone" ? "phone-pad" : "email-address"}
                    label={identifierMode === "phone" ? "Phone number" : "Email"}
                    onChangeText={identifierMode === "phone" ? setPhone : setEmail}
                    placeholder={identifierMode === "phone" ? "+91 98765 43210" : "you@example.com"}
                    value={identifierMode === "phone" ? phone : email}
                  />
                  {mode !== "forgot-password" ? (
                    <Field
                      icon={LockPasswordIcon}
                      label="Password"
                      onChangeText={setPassword}
                      onToggleSecure={() => setPasswordVisible((current) => !current)}
                      placeholder="Password"
                      secureTextEntry={!passwordVisible}
                      showSecureToggle
                      value={password}
                    />
                  ) : null}
                </>
              )}

              {mode === "sign-up" ? (
                <Text style={styles.passwordHint}>Use at least 8 characters with a mix of letters, numbers and symbols.</Text>
              ) : null}

              {mode === "sign-in" ? (
                <Pressable style={styles.forgotButton} onPress={() => switchMode("forgot-password")}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              ) : null}

              {notice ? <Text style={styles.noticeInline}>{notice}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                disabled={isSubmitting || !hasClerkKey}
                label={primaryLabel}
                loading={submitAction === "password" || submitAction === "reset"}
                onPress={() => {
                  if (mode === "sign-up") {
                    void handleSignUp();
                    return;
                  }
                  if (mode === "verify-email" || mode === "verify-phone") {
                    void handleVerifySignUp();
                    return;
                  }
                  if (mode === "forgot-password") {
                    void handleForgotPassword();
                    return;
                  }
                  if (mode === "reset-password") {
                    void handleResetPassword();
                    return;
                  }
                  void handleSignIn();
                }}
              />

              <FooterSwitch mode={mode} onSwitch={switchMode} />
            </AuthPanel>
          )}
          <LegalFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AuthPanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or use email or phone</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function FooterSwitch({ mode, onSwitch }: { mode: AuthMode; onSwitch: (mode: AuthMode) => void }) {
  if (mode === "verify-email" || mode === "verify-phone") {
    return (
      <Pressable style={styles.switchButton} onPress={() => onSwitch("sign-up")}>
        <Text style={styles.switchText}>Change account details</Text>
      </Pressable>
    );
  }

  if (mode === "forgot-password" || mode === "reset-password") {
    return (
      <Pressable style={styles.switchButton} onPress={() => onSwitch("sign-in")}>
        <Text style={styles.switchMuted}>Remembered password? <Text style={styles.switchAccent}>Sign in</Text></Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.switchButton} onPress={() => onSwitch(mode === "sign-in" ? "sign-up" : "sign-in")}>
      <Text style={styles.switchMuted}>
        {mode === "sign-in" ? "New customer? " : "Already have an account? "}
        <Text style={styles.switchAccent}>{mode === "sign-in" ? "Create account" : "Sign in"}</Text>
      </Text>
    </Pressable>
  );
}

type SegmentButtonProps = {
  active: boolean;
  label: string;
  onPress: () => void;
};

function SegmentButton({ active, label, onPress }: SegmentButtonProps) {
  return (
    <Pressable style={[styles.segmentButton, active ? styles.segmentButtonActive : null]} onPress={onPress}>
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  inputMode?: "text" | "numeric";
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  showSecureToggle?: boolean;
  onToggleSecure?: () => void;
};

function Field({
  autoCapitalize,
  icon,
  inputMode,
  keyboardType,
  label,
  onChangeText,
  onToggleSecure,
  placeholder,
  secureTextEntry,
  showSecureToggle,
  value,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <HugeiconsIcon color={colors.muted} icon={icon} size={21} strokeWidth={2.2} />
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
        {showSecureToggle ? (
          <Pressable accessibilityLabel={secureTextEntry ? "Show password" : "Hide password"} hitSlop={10} onPress={onToggleSecure}>
            <HugeiconsIcon color={colors.muted} icon={secureTextEntry ? ViewIcon : ViewOffSlashIcon} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  loading,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.primaryButton, disabled ? styles.disabledButton : null]} onPress={onPress}>
      {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable disabled={disabled} style={[styles.secondaryButton, disabled ? styles.disabledButton : null]} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
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

function titleForMode(mode: AuthMode) {
  if (mode === "sign-up" || mode === "verify-email" || mode === "verify-phone") {
    return "Create your account";
  }
  if (mode === "forgot-password" || mode === "reset-password") {
    return "Reset password";
  }

  return "Sign in";
}

function headlineForMode(mode: AuthMode) {
  if (mode === "sign-up") {
    return "Create your account";
  }
  if (mode === "verify-email") {
    return "Verify your email";
  }
  if (mode === "verify-phone") {
    return "Verify your phone";
  }
  if (mode === "forgot-password") {
    return "Forgot password";
  }
  if (mode === "reset-password") {
    return "Create new password";
  }

  return "Welcome back";
}

function primaryLabelForMode(mode: AuthMode) {
  if (mode === "sign-up") {
    return "Create account";
  }
  if (mode === "verify-email" || mode === "verify-phone") {
    return "Verify and continue";
  }
  if (mode === "forgot-password") {
    return "Send reset code";
  }
  if (mode === "reset-password") {
    return "Reset password";
  }

  return "Sign in";
}

function validatePasswordAuth(identifierMode: IdentifierMode, identifier: string, password: string) {
  return validateIdentifier(identifierMode, identifier) || (!password ? "Enter your password." : null);
}

function validateSignUp(identifierMode: IdentifierMode, identifier: string, password: string, fullName: string) {
  if (!fullName.trim()) {
    return "Enter your full name.";
  }

  return validateIdentifier(identifierMode, identifier) || (password.length < 8 ? "Password must be at least 8 characters." : null);
}

function validateIdentifier(identifierMode: IdentifierMode, identifier: string) {
  if (identifierMode === "phone") {
    return /^\+\d{8,15}$/.test(identifier) ? null : "Enter a valid phone number with country code.";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) ? null : "Enter a valid email address.";
}

function normalizePhoneIdentifier(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return digits ? `+${digits}` : "";
}

function resetPasswordStrategy(identifierMode: IdentifierMode) {
  return identifierMode === "phone" ? "reset_password_phone_code" : "reset_password_email_code";
}

function LegalFooter() {
  return (
    <View style={styles.legalFooter}>
      <Text style={styles.legalFooterText}>
        By continuing, you agree to 1HandIndia's{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/terms-and-conditions")}>Terms of Service</Text>,{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/privacy-policy")}>Privacy Policy</Text>,{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/refund-return-policy")}>Return Policy</Text>,{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/shipping-policy")}>Shipping Policy</Text>, and{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/seller-policy")}>Seller Policy</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 44,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 46,
  },
  backButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    marginLeft: 8,
  },
  headerSpacer: {
    width: 44,
  },
  logoStage: {
    alignItems: "center",
    height: 156,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  logoPlate: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#FFE1D7",
    borderRadius: 30,
    borderWidth: 1,
    elevation: 10,
    height: 126,
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    transform: [{ rotate: "-6deg" }],
    width: 126,
  },
  logoPlateActive: {
    backgroundColor: "#FF6A00",
    transform: [{ rotate: "7deg" }],
  },
  logoImage: {
    height: 106,
    width: 106,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: "#F5E4DC",
    borderRadius: 28,
    borderWidth: 1,
    elevation: 6,
    marginTop: -8,
    padding: 20,
    shadowColor: "#ED3500",
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#E8E1DD",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginTop: 28,
    minHeight: 58,
  },
  googleButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginVertical: 22,
  },
  dividerLine: {
    backgroundColor: "#E8E1DD",
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  segmentRow: {
    backgroundColor: "#FFF8F5",
    borderColor: "#F3E7E2",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
    padding: 5,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 14,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: colors.surface,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: "#E8E1DD",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 56,
    paddingVertical: 0,
  },
  passwordHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 14,
    marginTop: -4,
  },
  forgotButton: {
    alignItems: "flex-end",
    marginBottom: 24,
    marginTop: -4,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  noticeInline: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderRadius: 16,
    borderWidth: 1,
    color: "#0F8A5F",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  error: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F7C6C6",
    borderRadius: 16,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginBottom: 12,
    padding: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 20,
    elevation: 5,
    justifyContent: "center",
    minHeight: 60,
    paddingHorizontal: 18,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 18,
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
  disabledButton: {
    opacity: 0.55,
  },
  switchButton: {
    alignItems: "center",
    marginTop: 22,
    padding: 10,
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  switchMuted: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  switchAccent: {
    color: colors.primary,
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
  legalFooter: {
    marginTop: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  legalFooterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  legalFooterLink: {
    color: colors.primary,
    fontWeight: "800",
  },
});
