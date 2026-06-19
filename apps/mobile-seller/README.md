# 1HandIndia Seller Mobile App

Expo React Native seller workspace for seller registration, seller dashboard, products, orders, finance, and profile management.

## Validation

```powershell
pnpm.cmd --filter @indihub/mobile-seller typecheck
pnpm.cmd --filter @indihub/mobile-seller lint
pnpm.cmd --filter @indihub/mobile-seller test
```

The app uses Clerk mobile auth and the same backend API as the seller web center. Public product/profile images upload through `/api/storage/public-image/upload-request` and submit only returned portable asset keys.

## Razorpay Native Validation

Seller subscriptions use `react-native-razorpay@3.0.0`. This native module does not run in Expo Go; validate it with a prebuilt native project, Expo dev-client, or EAS build.

Native config is applied by `./plugins/with-razorpay-native-config` during prebuild:
- Android release builds receive Razorpay ProGuard/R8 keep rules.
- iOS receives UPI query schemes for GPay, PhonePe, and Paytm app switching.

Run before native validation:

```powershell
pnpm.cmd --filter @indihub/mobile-seller typecheck
pnpm.cmd --filter @indihub/mobile-seller lint
pnpm.cmd --filter @indihub/mobile-seller test
cd apps/mobile-seller
npx expo prebuild --clean
```

Build options:

```powershell
eas build --profile development --platform android
eas build --profile development --platform ios
```

Manual device matrix to record before release:
- Android physical device: card success, UPI intent success, user cancel, forced failure, network interruption, release build with minification.
- iOS physical device: card success, UPI intent success, user cancel, forced failure, network interruption.
- Confirm staging uses Razorpay test keys and production uses live keys from EAS/env configuration.

Validation log:

| Date | Build | Device / OS | Result | Notes |
| --- | --- | --- | --- | --- |
| Pending | Development / EAS | Android physical device | Pending | Native device validation required |
| Pending | Development / EAS | iOS physical device | Pending | Native device validation required |

## Push Notifications and Sentry Monitoring

Seller order and B2B enquiry alerts use Expo Push Service. The mobile app registers an Expo push token at `/api/seller/push-tokens`, revokes it at `/api/seller/push-tokens/revoke`, and opens tapped alerts directly to `/orders/[orderNumber]` or `/b2b-enquiries/[id]`.

Native config is generated from `app.config.js`:
- `expo-notifications` with Android channel `seller-alerts`.
- iOS `aps-environment` from `EXPO_PUBLIC_APP_ENV` (`development` unless it is `production`).
- Sentry source-map upload plugin is enabled only when `SENTRY_ORG` and `SENTRY_PROJECT` are provided, with public env fallbacks supported for local config inspection.
- Metro wraps with `withSentryConfig` so release bundles contain Sentry debug IDs for source-map matching.

Required EAS/Sentry secrets before release builds:

```powershell
eas secret:create --name SENTRY_AUTH_TOKEN --value <token>
eas secret:create --name SENTRY_ORG --value <org-slug>
eas secret:create --name SENTRY_PROJECT --value <project-slug>
eas secret:create --name EXPO_PUBLIC_EAS_PROJECT_ID --value <eas-project-id>
```

Manual E2E checklist still required on real builds/devices:
- Android and iOS notification permission prompt appears after seller sign-in.
- Push token row is created for the signed-in seller.
- New seller order push arrives foreground, background, and killed-app.
- New B2B enquiry push arrives foreground, background, and killed-app.
- Notification taps deep-link to the correct order/enquiry detail screen.
- Sign-out or revoked permission disables the device token.
- Production/staging Sentry crash appears with readable file/line stack trace and matching release/build number.
