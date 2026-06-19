# Mobile Seller Production Checklist

Use this checklist before marking the 1HandIndia seller mobile app ready for staging, pilot, or production release.

## 1. Environment Readiness

- [ ] `EXPO_PUBLIC_API_URL` points to the correct API for the build environment.
- [ ] `EXPO_PUBLIC_APP_ENV` is set to `development`, `staging`, or `production`.
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is configured for the same Clerk environment as the API.
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` is configured or the fallback project ID in `app.config.js` is correct.
- [ ] `EXPO_PUBLIC_SENTRY_DSN` is configured only for builds where monitoring should run.
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are configured in EAS for source-map upload.
- [ ] No private secrets are stored in `EXPO_PUBLIC_*` variables.

Cloud EAS builds do not automatically use local `.env` files. Add required values in Expo Dashboard or with:

```powershell
eas env:create --environment development --name EXPO_PUBLIC_API_URL --value "<api-url>"
eas env:create --environment development --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "<publishable-key>"
eas env:create --environment development --name EXPO_PUBLIC_APP_ENV --value "development"
eas env:create --environment development --name EXPO_PUBLIC_EAS_PROJECT_ID --value "e017cb61-41d7-4e0f-9268-573106ddd729"
```

## 2. Dependency And Config Gates

- [ ] `npx expo install --check` passes.
- [ ] `pnpm install --frozen-lockfile --lockfile-only` passes from the repo root.
- [ ] `pnpm --filter @indihub/mobile-seller typecheck` passes.
- [ ] `pnpm --filter @indihub/mobile-seller lint` passes.
- [ ] `pnpm --filter @indihub/mobile-seller test` passes.
- [ ] `npx expo config --json` includes the expected `extra.eas.projectId`.
- [ ] `npx expo prebuild --clean --no-install --platform android` passes.

## 3. Native Build Checklist

- [ ] Android development build completes through EAS.
- [ ] Android internal APK installs on a physical device.
- [ ] iOS development build completes through EAS.
- [ ] iOS internal build installs on a physical device through TestFlight or internal distribution.
- [ ] `expo-notifications` config plugin generates Android notification resources.
- [ ] Android notification icon renders as white-on-transparent, not a colored square.
- [ ] iOS `aps-environment` entitlement matches the build environment.
- [ ] Razorpay ProGuard/R8 rules exist in `android/app/proguard-rules.pro`.
- [ ] iOS UPI app query schemes are present after prebuild.

## 4. Seller Auth And API Access

- [ ] Seller can sign in with Clerk.
- [ ] Seller session syncs to the backend app user.
- [ ] Expired or invalid auth shows safe user-facing copy.
- [ ] Seller dashboard loads without leaking raw provider errors.
- [ ] Local API URL works only for local/dev builds.
- [ ] Staging/production builds use a public HTTPS API URL, not a LAN IP.

## 5. Push Notifications

- [ ] App requests notification permission after seller sign-in.
- [ ] Denied permission shows the in-app notification-off banner.
- [ ] Expo Go shows the unsupported message instead of crashing.
- [ ] Development/EAS build registers an Expo push token.
- [ ] Backend stores the token against the signed-in seller.
- [ ] Token is revoked on sign-out or permission removal.
- [ ] New seller order triggers a push notification.
- [ ] New B2B enquiry triggers a push notification.
- [ ] Foreground notification is received.
- [ ] Background notification is received.
- [ ] Killed-app notification is received.
- [ ] Tapping an order notification opens `/orders/[orderNumber]`.
- [ ] Tapping a B2B notification opens `/b2b-enquiries/[id]`.
- [ ] Stale Expo tokens are marked inactive when Expo returns `DeviceNotRegistered`.

## 6. Razorpay Native Payment Validation

- [ ] Development build does not show `Native module not found` for Razorpay.
- [ ] Test card successful payment works on Android.
- [ ] Test card failed payment shows a safe error.
- [ ] User-cancelled checkout returns to the app cleanly.
- [ ] UPI intent opens installed UPI app and returns to seller app.
- [ ] Network interruption does not create a false success.
- [ ] Android release build works with minification enabled.
- [ ] Staging uses Razorpay test keys.
- [ ] Production uses Razorpay live keys.

## 7. Sentry Monitoring

- [ ] Sentry is disabled during normal local development.
- [ ] Local Sentry can be enabled only with `EXPO_PUBLIC_ENABLE_SENTRY=true`.
- [ ] Sentry config plugin is included when `SENTRY_ORG` and `SENTRY_PROJECT` are provided.
- [ ] EAS has `SENTRY_AUTH_TOKEN` configured for source-map upload.
- [ ] Release build uploads source maps.
- [ ] Test crash appears in Sentry.
- [ ] Crash stack trace is readable and de-minified.
- [ ] Event release/build number matches the installed build.

## 8. Core Seller QA

- [ ] Seller onboarding works.
- [ ] Pending seller state works.
- [ ] Approved seller dashboard works.
- [ ] Profile edit works.
- [ ] Store logo/banner upload works.
- [ ] Product create works.
- [ ] Product image upload works.
- [ ] Product edit works.
- [ ] Product archive works.
- [ ] Seller order list works.
- [ ] Seller order detail works.
- [ ] Seller order status update works.
- [ ] B2B enquiry list works.
- [ ] B2B enquiry detail works.
- [ ] B2B response submit works.
- [ ] Seller finance wallet works.
- [ ] Seller payout request works.
- [ ] Seller statements load.

## 9. Performance And Reliability

- [ ] App starts without Expo Router route export warnings.
- [ ] Expo Go does not crash when push notifications are unavailable.
- [ ] Dev build starts without native module errors.
- [ ] Dashboard first load is acceptable on a mid-range Android device.
- [ ] Large product lists do not freeze scrolling.
- [ ] Image uploads show progress/error states.
- [ ] API timeouts show retryable errors.
- [ ] No raw internal stack traces appear in UI.

## 10. Release Decision

Do not approve release until these are true:

- [ ] Android physical-device QA is complete.
- [ ] iOS physical-device QA is complete.
- [ ] Push notification E2E is complete.
- [ ] Razorpay native payment E2E is complete.
- [ ] Sentry source-map validation is complete.
- [ ] Backend API URL is public HTTPS for staging/production.
- [ ] EAS env values are configured for the target environment.
- [ ] All automated gates pass on a clean checkout.
