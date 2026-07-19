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
import { useQuery } from "@tanstack/react-query";
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
import logoSource from "../../assets/splash-logo.png";
import { getClerkAuthCapabilities } from "../../src/auth/clerk-auth-capabilities";
import {
  normalizePhoneIdentifier,
  resetPasswordStrategy,
  secondFactorAttemptParams,
  secondFactorOptions,
  secondFactorPrepareParams,
  validateIdentifier,
  validatePasswordAuth,
  validateSignUp,
  type IdentifierMode,
  type SecondFactorOption,
  type SupportedSecondFactor,
} from "../../src/auth/clerk-auth-flow";
import { mobileAuthErrorMessage, useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { Screen } from "../../src/components/screen";
import { useCustomerPushNotificationStatus } from "../../src/features/notifications/use-customer-push-notifications";
import { colors } from "../../src/theme";

WebBrowser.maybeCompleteAuthSession();

type AuthMode =
  | "sign-in"
  | "sign-up"
  | "verify-email"
  | "verify-phone"
  | "forgot-password"
  | "verify-reset-code"
  | "reset-password"
  | "verify-sign-in";
type SubmitAction = "password" | "google" | "sign-out" | "sync" | "reset" | "verification" | null;

type ClerkSignInResource = {
  status?: string | null;
  createdSessionId?: string | null;
  supportedSecondFactors?: SupportedSecondFactor[] | null;
  create: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  attemptFirstFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  prepareSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  attemptSecondFactor: (params: Record<string, unknown>) => Promise<ClerkSignInResource>;
  resetPassword: (params: { password: string; signOutOfOtherSessions?: boolean }) => Promise<ClerkSignInResource>;
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
  const [availableSecondFactors, setAvailableSecondFactors] = useState<SecondFactorOption[]>([]);
  const [selectedSecondFactor, setSelectedSecondFactor] = useState<SecondFactorOption | null>(null);
  const clerkCapabilitiesQuery = useQuery({
    queryKey: ["clerk-auth-capabilities"],
    queryFn: getClerkAuthCapabilities,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "pk_live_Y2xlcmsuMWhhbmRpbmRpYS5jb20k";
  const hasClerkKey = Boolean(clerkPublishableKey);
  const phoneAuthEnabled = clerkCapabilitiesQuery.data?.phoneEnabled === true;
  const isSubmitting = submitAction !== null;
  const screenTitle = titleForMode(mode);
  const primaryLabel = primaryLabelForMode(mode);
  const showIdentifierTabs = mode === "sign-in" || mode === "sign-up" || mode === "forgot-password";
  const showMainModeTabs = mode === "sign-in" || mode === "sign-up";

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

  useEffect(() => {
    if (clerkCapabilitiesQuery.isFetched && !phoneAuthEnabled && identifierMode === "phone") {
      setIdentifierMode("email");
      setPhone("");
    }
  }, [clerkCapabilitiesQuery.isFetched, identifierMode, phoneAuthEnabled]);

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
    if (!options.length) {
      setError("This account requires another verification method that is not available in the app. Contact support for help.");
      return;
    }

    const preferredStrategy = identifierMode === "phone" ? "phone_code" : "email_code";
    const preferred = options.find((option) => option.strategy === preferredStrategy) ?? options[0]!;
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

    if (resource.status === "needs_new_password") {
      setCode("");
      setResetPassword("");
      setMode("reset-password");
      setNotice("For your security, create a new password to finish signing in.");
      return;
    }

    setError("Sign in could not be completed. Please try again.");
  }

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
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).create({
        identifier,
        password,
        strategy: "password",
      });
      await continueSignIn(resource);
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

      await sendSignUpVerification();
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function sendSignUpVerification() {
    if (!signUp.isLoaded) {
      return;
    }

    if (identifierMode === "phone") {
      await signUp.signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      setMode("verify-phone");
      setNotice("We sent a verification code to your phone.");
    } else {
      await signUp.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify-email");
      setNotice("We sent a verification code to your email.");
    }
    setCode("");
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
    setSubmitAction("verification");
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
      setMode("verify-reset-code");
      setNotice(identifierMode === "phone" ? "We sent a reset code to your phone." : "We sent a reset code to your email.");
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleVerifyResetCode() {
    if (!signIn.isLoaded) {
      return;
    }

    if (!code.trim()) {
      setError("Enter the reset code.");
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("verification");
    try {
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).attemptFirstFactor({
        code: code.trim(),
        strategy: resetPasswordStrategy(identifierMode),
      });

      if (resource.status === "needs_new_password") {
        setResetPassword("");
        setMode("reset-password");
        setNotice("Code confirmed. Create a new password for your account.");
        return;
      }

      await continueSignIn(resource);
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

    if (resetPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("reset");
    try {
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).resetPassword({
        password: resetPassword,
        signOutOfOtherSessions: true,
      });
      await continueSignIn(resource);
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function handleSecondFactor(option = selectedSecondFactor) {
    if (!signIn.isLoaded || !option) {
      return;
    }

    if (!code.trim()) {
      setError(option.strategy === "backup_code" ? "Enter a backup code." : "Enter the verification code.");
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("verification");
    try {
      const resource = await (signIn.signIn as unknown as ClerkSignInResource).attemptSecondFactor(
        secondFactorAttemptParams(option, code),
      );
      await continueSignIn(resource);
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function selectSecondFactor(option: SecondFactorOption) {
    if (!signIn.isLoaded || secondFactorKey(option) === (selectedSecondFactor ? secondFactorKey(selectedSecondFactor) : null)) {
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitAction("verification");
    try {
      await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, option);
      setSelectedSecondFactor(option);
      setCode("");
      setNotice(secondFactorNotice(option));
    } catch (caught) {
      setError(mobileAuthErrorMessage(caught));
    } finally {
      setSubmitAction(null);
    }
  }

  async function resendCurrentCode() {
    setError(null);
    setNotice(null);
    setSubmitAction("verification");
    try {
      if (mode === "verify-email" || mode === "verify-phone") {
        await sendSignUpVerification();
      } else if (mode === "verify-reset-code") {
        await handleForgotPassword();
      } else if (mode === "verify-sign-in" && selectedSecondFactor) {
        await prepareSecondFactor(signIn.signIn as unknown as ClerkSignInResource, selectedSecondFactor);
        setNotice(secondFactorNotice(selectedSecondFactor, true));
      }
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
    setAvailableSecondFactors([]);
    setSelectedSecondFactor(null);
    setMode(nextMode);
  }

  const signedInButNotSynced = Boolean(isSignedIn && !customerAuth.enabled);
  const syncRetryLimitReached = syncRetryCount >= MAX_ACCOUNT_SYNC_RETRIES;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandStage onBack={() => router.back()} title={screenTitle} />

          <View style={styles.authWorkspace}>
            {!hasClerkKey ? (
              <Notice
                title="Sign in setup required"
                message="Customer sign in is temporarily unavailable. Please try again after the app configuration is updated."
              />
            ) : null}

            {signedInButNotSynced ? (
              <AuthPanel>
                <Text style={styles.eyebrow}>Customer account</Text>
                <Text style={styles.title}>
                  {customerAuth.status === "syncing" || customerAuth.status === "loading"
                    ? "Preparing your account"
                    : "Account connection needs attention"}
                </Text>
                <Text style={styles.subtitle}>
                  {customerAuth.status === "syncing" || customerAuth.status === "loading"
                    ? "Your secure sign in is complete. We are loading your 1HandIndia account."
                    : "Your sign in succeeded, but the customer account could not be loaded."}
                </Text>
                {customerAuth.error ? <InlineMessage tone="danger" message={customerAuth.error} /> : null}
                {customerAuth.status === "syncing" || customerAuth.status === "loading" ? (
                  <View style={styles.syncRow}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.syncText}>Connecting securely...</Text>
                  </View>
                ) : (
                  <>
                    {syncRetryLimitReached ? (
                      <InlineMessage tone="danger" message="Account sync was retried 3 times. Sign out and try again when the service is reachable." />
                    ) : null}
                    <PrimaryButton
                      disabled={submitAction === "sync" || submitAction === "sign-out"}
                      label={syncRetryLimitReached ? "Sign out" : "Retry account connection"}
                      loading={submitAction === "sync" || submitAction === "sign-out"}
                      onPress={syncRetryLimitReached ? () => void handleSignOut() : retryAccountSync}
                    />
                    <SecondaryButton
                      disabled={submitAction === "sync" || submitAction === "sign-out"}
                      label={syncRetryLimitReached ? "Try once more" : "Sign out"}
                      onPress={syncRetryLimitReached ? retryAccountSync : () => void handleSignOut()}
                    />
                  </>
                )}
              </AuthPanel>
            ) : isSignedIn ? (
              <AuthPanel>
                <Text style={styles.eyebrow}>Customer account</Text>
                <Text style={styles.title}>You are signed in</Text>
                <Text style={styles.subtitle}>Your 1HandIndia account is ready for shopping, orders, and support.</Text>
                <PrimaryButton label="Continue to account" onPress={() => router.replace("/account")} />
                <SecondaryButton disabled={isSubmitting} label="Sign out" onPress={() => void handleSignOut()} />
              </AuthPanel>
            ) : (
              <AuthPanel>
                {showMainModeTabs ? <MainModeTabs mode={mode} onSwitch={switchMode} /> : null}
                <Text style={styles.eyebrow}>{eyebrowForMode(mode)}</Text>
                <Text style={styles.title}>{headlineForMode(mode)}</Text>
                <Text style={styles.subtitle}>{subtitleForMode(mode, identifierMode, selectedSecondFactor, phoneAuthEnabled)}</Text>

                {showMainModeTabs ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmitting || !hasClerkKey}
                      style={({ pressed }) => [
                        styles.googleButton,
                        pressed ? styles.buttonPressed : null,
                        isSubmitting || !hasClerkKey ? styles.disabledButton : null,
                      ]}
                      onPress={() => void handleGoogleSignIn()}
                    >
                      {submitAction === "google" ? (
                        <ActivityIndicator color={colors.ink} />
                      ) : (
                        <>
                          <HugeiconsIcon color="#4285F4" icon={GoogleIcon} size={22} strokeWidth={2.1} />
                          <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </>
                      )}
                    </Pressable>
                    <Divider />
                  </>
                ) : null}

                {showIdentifierTabs && phoneAuthEnabled ? (
                  <View style={styles.segmentRow}>
                    <SegmentButton
                      active={identifierMode === "email"}
                      icon={Mail01Icon}
                      label="Email"
                      onPress={() => setIdentifierMode("email")}
                    />
                    <SegmentButton
                      active={identifierMode === "phone"}
                      icon={SmartPhone01Icon}
                      label="Phone"
                      onPress={() => setIdentifierMode("phone")}
                    />
                  </View>
                ) : null}

                {mode === "sign-up" ? (
                  <Field
                    autoCapitalize="words"
                    autoComplete="name"
                    icon={UserIcon}
                    label="Full name"
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    textContentType="name"
                    value={fullName}
                  />
                ) : null}

                {mode === "verify-email" || mode === "verify-phone" || mode === "verify-reset-code" || mode === "verify-sign-in" ? (
                  <>
                    {mode === "verify-sign-in" && availableSecondFactors.length > 1 ? (
                      <FactorPicker
                        factors={availableSecondFactors}
                        selected={selectedSecondFactor}
                        onSelect={(factor) => void selectSecondFactor(factor)}
                      />
                    ) : null}
                    <Field
                      autoComplete="one-time-code"
                      icon={LockPasswordIcon}
                      inputMode={selectedSecondFactor?.strategy === "backup_code" ? "text" : "numeric"}
                      keyboardType={selectedSecondFactor?.strategy === "backup_code" ? "default" : "number-pad"}
                      label={selectedSecondFactor?.strategy === "backup_code" ? "Backup code" : "Verification code"}
                      maxLength={selectedSecondFactor?.strategy === "backup_code" ? 32 : 6}
                      onChangeText={(value) => setCode(selectedSecondFactor?.strategy === "backup_code" ? value : value.replace(/\D/g, ""))}
                      placeholder={selectedSecondFactor?.strategy === "backup_code" ? "Enter backup code" : "6-digit code"}
                      textContentType="oneTimeCode"
                      value={code}
                    />
                    {canResendCode(mode, selectedSecondFactor) ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSubmitting}
                        hitSlop={8}
                        style={styles.inlineAction}
                        onPress={() => void resendCurrentCode()}
                      >
                        <Text style={styles.inlineActionText}>Resend code</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : mode === "reset-password" ? (
                  <Field
                    autoComplete="new-password"
                    icon={LockPasswordIcon}
                    label="New password"
                    onChangeText={setResetPassword}
                    onToggleSecure={() => setResetPasswordVisible((current) => !current)}
                    placeholder="At least 8 characters"
                    secureTextEntry={!resetPasswordVisible}
                    showSecureToggle
                    textContentType="newPassword"
                    value={resetPassword}
                  />
                ) : (
                  <>
                    <Field
                      autoCapitalize="none"
                      autoComplete={identifierMode === "phone" ? "tel" : "email"}
                      icon={identifierMode === "phone" ? SmartPhone01Icon : Mail01Icon}
                      keyboardType={identifierMode === "phone" ? "phone-pad" : "email-address"}
                      label={identifierMode === "phone" ? "Phone number" : "Email address"}
                      onChangeText={identifierMode === "phone" ? setPhone : setEmail}
                      placeholder={identifierMode === "phone" ? "+91 98765 43210" : "you@example.com"}
                      textContentType={identifierMode === "phone" ? "telephoneNumber" : "emailAddress"}
                      value={identifierMode === "phone" ? phone : email}
                    />
                    {identifierMode === "phone" ? <Text style={styles.fieldHint}>Indian mobile numbers can be entered without +91.</Text> : null}
                    {mode !== "forgot-password" ? (
                      <Field
                        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                        icon={LockPasswordIcon}
                        label="Password"
                        onChangeText={setPassword}
                        onToggleSecure={() => setPasswordVisible((current) => !current)}
                        placeholder={mode === "sign-up" ? "Create a strong password" : "Enter your password"}
                        secureTextEntry={!passwordVisible}
                        showSecureToggle
                        textContentType={mode === "sign-up" ? "newPassword" : "password"}
                        value={password}
                      />
                    ) : null}
                  </>
                )}

                {mode === "sign-up" || mode === "reset-password" ? (
                  <Text style={styles.passwordHint}>Use at least 8 characters. A longer, unique password is safer.</Text>
                ) : null}

                {mode === "sign-in" ? (
                  <Pressable accessibilityRole="button" hitSlop={8} style={styles.forgotButton} onPress={() => switchMode("forgot-password")}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                ) : null}

                {notice ? <InlineMessage tone="success" message={notice} /> : null}
                {error ? <InlineMessage tone="danger" message={error} /> : null}

                <PrimaryButton
                  disabled={isSubmitting || !hasClerkKey}
                  label={primaryLabel}
                  loading={submitAction === "password" || submitAction === "reset" || submitAction === "verification"}
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
                    if (mode === "verify-reset-code") {
                      void handleVerifyResetCode();
                      return;
                    }
                    if (mode === "reset-password") {
                      void handleResetPassword();
                      return;
                    }
                    if (mode === "verify-sign-in") {
                      void handleSecondFactor();
                      return;
                    }
                    void handleSignIn();
                  }}
                />

                <FooterSwitch mode={mode} onSwitch={switchMode} />
              </AuthPanel>
            )}

            <LegalFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function BrandStage({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.brandStage}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed ? styles.brandButtonPressed : null]}
          onPress={onBack}
        >
          <HugeiconsIcon color={colors.surface} icon={ArrowLeft02Icon} size={23} strokeWidth={2.4} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.brandIdentity}>
        <View style={styles.logoPlate}>
          <Image resizeMode="contain" source={logoSource} style={styles.logoImage} />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>1HandIndia</Text>
          <Text style={styles.brandTagline}>One account for trusted shopping across India.</Text>
        </View>
      </View>

      <View style={styles.securityLine}>
        <HugeiconsIcon color="#FFF3EE" icon={LockPasswordIcon} size={17} strokeWidth={2.3} />
        <Text style={styles.securityText}>Secure sign in powered by Clerk</Text>
      </View>
    </View>
  );
}

function AuthPanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

function MainModeTabs({ mode, onSwitch }: { mode: AuthMode; onSwitch: (mode: AuthMode) => void }) {
  return (
    <View style={styles.mainModeTabs}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === "sign-in" }}
        style={[styles.mainModeTab, mode === "sign-in" ? styles.mainModeTabActive : null]}
        onPress={() => onSwitch("sign-in")}
      >
        <Text style={[styles.mainModeText, mode === "sign-in" ? styles.mainModeTextActive : null]}>Sign in</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === "sign-up" }}
        style={[styles.mainModeTab, mode === "sign-up" ? styles.mainModeTabActive : null]}
        onPress={() => onSwitch("sign-up")}
      >
        <Text style={[styles.mainModeText, mode === "sign-up" ? styles.mainModeTextActive : null]}>Create account</Text>
      </Pressable>
    </View>
  );
}

function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or continue with</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function FooterSwitch({ mode, onSwitch }: { mode: AuthMode; onSwitch: (mode: AuthMode) => void }) {
  if (mode === "verify-email" || mode === "verify-phone") {
    return (
      <Pressable accessibilityRole="button" style={styles.switchButton} onPress={() => onSwitch("sign-up")}>
        <Text style={styles.switchText}>Change account details</Text>
      </Pressable>
    );
  }

  if (mode === "forgot-password" || mode === "verify-reset-code" || mode === "reset-password" || mode === "verify-sign-in") {
    return (
      <Pressable accessibilityRole="button" style={styles.switchButton} onPress={() => onSwitch("sign-in")}>
        <Text style={styles.switchMuted}>Back to <Text style={styles.switchAccent}>sign in</Text></Text>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="button" style={styles.switchButton} onPress={() => onSwitch(mode === "sign-in" ? "sign-up" : "sign-in")}>
      <Text style={styles.switchMuted}>
        {mode === "sign-in" ? "New to 1HandIndia? " : "Already have an account? "}
        <Text style={styles.switchAccent}>{mode === "sign-in" ? "Create account" : "Sign in"}</Text>
      </Text>
    </Pressable>
  );
}

type SegmentButtonProps = {
  active: boolean;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  onPress: () => void;
};

function SegmentButton({ active, icon, label, onPress }: SegmentButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.segmentButton, active ? styles.segmentButtonActive : null, pressed ? styles.buttonPressed : null]}
      onPress={onPress}
    >
      <HugeiconsIcon color={active ? colors.surface : colors.muted} icon={icon} size={18} strokeWidth={2.3} />
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function FactorPicker({
  factors,
  selected,
  onSelect,
}: {
  factors: SecondFactorOption[];
  selected: SecondFactorOption | null;
  onSelect: (factor: SecondFactorOption) => void;
}) {
  return (
    <View style={styles.factorSection}>
      <Text style={styles.factorLabel}>Verify with</Text>
      <View style={styles.factorList}>
        {factors.map((factor) => {
          const active = selected ? secondFactorKey(factor) === secondFactorKey(selected) : false;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              key={`${factor.strategy}-${factor.destination ?? "account"}`}
              style={[styles.factorButton, active ? styles.factorButtonActive : null]}
              onPress={() => onSelect(factor)}
            >
              <Text style={[styles.factorButtonText, active ? styles.factorButtonTextActive : null]}>{factor.label}</Text>
              {factor.destination ? <Text style={styles.factorDestination}>{factor.destination}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type FieldProps = {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  inputMode?: "text" | "numeric";
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  secureTextEntry?: boolean;
  showSecureToggle?: boolean;
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
  onToggleSecure?: () => void;
};

function Field({
  autoCapitalize,
  autoComplete,
  icon,
  inputMode,
  keyboardType,
  label,
  maxLength,
  onChangeText,
  onToggleSecure,
  placeholder,
  secureTextEntry,
  showSecureToggle,
  textContentType,
  value,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <HugeiconsIcon color={colors.muted} icon={icon} size={20} strokeWidth={2.2} />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          inputMode={inputMode}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          selectionColor={colors.primary}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        {showSecureToggle ? (
          <Pressable
            accessibilityLabel={secureTextEntry ? "Show password" : "Hide password"}
            accessibilityRole="button"
            hitSlop={10}
            onPress={onToggleSecure}
          >
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
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed ? styles.primaryButtonPressed : null,
        disabled ? styles.disabledButton : null,
      ]}
      onPress={onPress}
    >
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
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed ? styles.buttonPressed : null,
        disabled ? styles.disabledButton : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function InlineMessage({ message, tone }: { message: string; tone: "danger" | "success" }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.inlineMessage, tone === "danger" ? styles.inlineMessageDanger : styles.inlineMessageSuccess]}
    >
      <Text style={[styles.inlineMessageText, tone === "danger" ? styles.inlineMessageDangerText : styles.inlineMessageSuccessText]}>
        {message}
      </Text>
    </View>
  );
}

function Notice({ message, title }: { message: string; title: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

function titleForMode(mode: AuthMode) {
  if (mode === "sign-up" || mode === "verify-email" || mode === "verify-phone") {
    return "Create account";
  }
  if (mode === "forgot-password" || mode === "verify-reset-code" || mode === "reset-password") {
    return "Reset password";
  }
  if (mode === "verify-sign-in") {
    return "Verify sign in";
  }

  return "Customer sign in";
}

function eyebrowForMode(mode: AuthMode) {
  if (mode === "sign-up" || mode === "verify-email" || mode === "verify-phone") {
    return "New customer";
  }
  if (mode === "forgot-password" || mode === "verify-reset-code" || mode === "reset-password") {
    return "Account recovery";
  }
  if (mode === "verify-sign-in") {
    return "Secure verification";
  }
  return "Welcome back";
}

function headlineForMode(mode: AuthMode) {
  if (mode === "sign-up") {
    return "Create your shopping account";
  }
  if (mode === "verify-email") {
    return "Check your email";
  }
  if (mode === "verify-phone") {
    return "Check your messages";
  }
  if (mode === "forgot-password") {
    return "Find your account";
  }
  if (mode === "verify-reset-code") {
    return "Confirm your reset code";
  }
  if (mode === "reset-password") {
    return "Create a new password";
  }
  if (mode === "verify-sign-in") {
    return "One more security check";
  }

  return "Sign in to continue";
}

function subtitleForMode(
  mode: AuthMode,
  identifierMode: IdentifierMode,
  factor: SecondFactorOption | null,
  phoneAuthEnabled: boolean,
) {
  if (mode === "sign-up") {
    return "Save addresses, track orders, manage returns, and keep your wishlist in one place.";
  }
  if (mode === "verify-email" || mode === "verify-phone") {
    return "Enter the verification code to finish creating your customer account.";
  }
  if (mode === "forgot-password") {
    return `Enter the ${identifierMode === "phone" ? "phone number" : "email address"} connected to your account.`;
  }
  if (mode === "verify-reset-code") {
    return "Confirm the code first, then choose a new password.";
  }
  if (mode === "reset-password") {
    return "Your new password will be used for future email or phone sign ins.";
  }
  if (mode === "verify-sign-in") {
    return factor?.destination
      ? `Enter the code sent to ${factor.destination}.`
      : factor?.strategy === "totp"
        ? "Enter the current code from your authenticator app."
        : factor?.strategy === "backup_code"
          ? "Enter one of your unused backup codes."
          : "Complete the verification required for this account.";
  }

  return phoneAuthEnabled
    ? "Use your email, mobile number, or Google account."
    : "Use your email or Google account.";
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
  if (mode === "verify-reset-code") {
    return "Confirm code";
  }
  if (mode === "reset-password") {
    return "Save new password";
  }
  if (mode === "verify-sign-in") {
    return "Verify sign in";
  }

  return "Sign in";
}

function secondFactorNotice(option: SecondFactorOption, resent = false) {
  if (option.strategy === "phone_code") {
    return resent ? "A new code was sent by text message." : "We sent a sign-in code by text message.";
  }
  if (option.strategy === "email_code") {
    return resent ? "A new code was sent to your email." : "We sent a sign-in code to your email.";
  }
  if (option.strategy === "totp") {
    return "Open your authenticator app to get the current code.";
  }
  return "Use one of the backup codes saved when verification was enabled.";
}

function canResendCode(mode: AuthMode, factor: SecondFactorOption | null) {
  if (mode === "verify-email" || mode === "verify-phone" || mode === "verify-reset-code") {
    return true;
  }
  return mode === "verify-sign-in" && (factor?.strategy === "phone_code" || factor?.strategy === "email_code");
}

function secondFactorKey(factor: SecondFactorOption) {
  return `${factor.strategy}:${factor.phoneNumberId ?? factor.emailAddressId ?? factor.destination ?? "account"}`;
}

function LegalFooter() {
  return (
    <View style={styles.legalFooter}>
      <Text style={styles.legalFooterText}>
        By continuing, you agree to 1HandIndia's{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/terms-and-conditions")}>Terms</Text>,{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/privacy-policy")}>Privacy Policy</Text>, and{" "}
        <Text style={styles.legalFooterLink} onPress={() => void WebBrowser.openBrowserAsync("https://1handindia.com/refund-return-policy")}>Return Policy</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    backgroundColor: colors.secondary,
    flexGrow: 1,
  },
  brandStage: {
    backgroundColor: colors.primary,
    minHeight: 244,
    paddingBottom: 26,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  brandButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  headerTitle: {
    color: colors.surface,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  headerSpacer: {
    width: 42,
  },
  brandIdentity: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 28,
  },
  logoPlate: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  logoImage: {
    height: 68,
    width: 68,
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  brandTagline: {
    color: "#FFF0EB",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  securityLine: {
    alignItems: "center",
    borderTopColor: "rgba(255,255,255,0.22)",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    paddingTop: 14,
  },
  securityText: {
    color: "#FFF3EE",
    fontSize: 12,
    fontWeight: "800",
  },
  authWorkspace: {
    backgroundColor: colors.secondary,
    flex: 1,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  panel: {
    width: "100%",
  },
  mainModeTabs: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    marginBottom: 26,
  },
  mainModeTab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 3,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  mainModeTabActive: {
    borderBottomColor: colors.primary,
  },
  mainModeText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  mainModeTextActive: {
    color: colors.ink,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 33,
    marginTop: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    marginTop: 9,
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#DDD6D2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 54,
  },
  googleButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.78,
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  segmentRow: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
    padding: 5,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: colors.surface,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  inputShell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#DDD6D2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    minHeight: 56,
    paddingHorizontal: 14,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 54,
    paddingVertical: 0,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginBottom: 14,
    marginTop: -8,
  },
  passwordHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 14,
    marginTop: -5,
  },
  forgotButton: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -3,
    paddingVertical: 5,
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  inlineAction: {
    alignSelf: "flex-end",
    marginBottom: 18,
    marginTop: -7,
    paddingVertical: 5,
  },
  inlineActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  factorSection: {
    marginBottom: 18,
  },
  factorLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 9,
  },
  factorList: {
    gap: 8,
  },
  factorButton: {
    backgroundColor: colors.surface,
    borderColor: "#DDD6D2",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  factorButtonActive: {
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
  },
  factorButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  factorButtonTextActive: {
    color: colors.primary,
  },
  factorDestination: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  inlineMessage: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  inlineMessageDanger: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F7C6C6",
  },
  inlineMessageSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  inlineMessageText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  inlineMessageDangerText: {
    color: colors.danger,
  },
  inlineMessageSuccessText: {
    color: "#0F7A4F",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 18,
  },
  primaryButtonPressed: {
    backgroundColor: "#CF2E00",
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.52,
  },
  switchButton: {
    alignItems: "center",
    marginTop: 16,
    minHeight: 44,
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
    fontWeight: "700",
  },
  switchAccent: {
    color: colors.primary,
    fontWeight: "900",
  },
  notice: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F7C6C6",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 5,
  },
  syncRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  syncText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  legalFooter: {
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 8,
  },
  legalFooterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
  },
  legalFooterLink: {
    color: colors.primary,
    fontWeight: "800",
  },
});
