# 1HandIndia Customer Mobile App

## Clerk Customer Authentication

The customer app supports:

- Email and password sign in.
- Phone number and password sign in using E.164 phone identifiers.
- Google sign in.
- Email or phone account verification during sign up.
- Email or phone password recovery.
- Clerk-required email code, SMS code, authenticator app, and backup-code verification.
- Phone-only customer account sync into 1HandIndia customer and RBAC records.

The authentication screen reads Clerk's public environment configuration. Phone sign-in, phone sign-up, and phone password recovery controls are shown only when Clerk reports phone numbers enabled as a first-factor identifier. If the capability request fails or phone authentication is disabled, the app hides those controls and keeps email/Google authentication available.

The Clerk production instance must also enable the same methods. In the Clerk Dashboard:

1. Open **User & Authentication** and then **Email, phone, username**.
2. Enable **Phone number**.
3. Allow phone numbers for sign-up and sign-in.
4. Require phone verification at sign-up.
5. Keep **Password** enabled and confirm an SMS provider or Clerk SMS delivery is available.

The app can be released before SMS activation, but phone sign in and phone password recovery will not work until the Clerk production instance reports `phone_number` as enabled. Email/password and Google remain available independently.

## Razorpay Android Build Notes

The customer app uses `react-native-razorpay@3.0.0` for native Razorpay Checkout on Android.

This is a native React Native module. It will not run inside Expo Go. Use an Expo dev-client, EAS build, or a standalone Android build when validating online payments.

Recommended Android validation flow:

```powershell
pnpm.cmd --filter @indihub/mobile-customer typecheck
pnpm.cmd --filter @indihub/mobile-customer lint
pnpm.cmd --filter @indihub/mobile-customer test
cd apps/mobile-customer
npx expo prebuild --platform android
eas build --profile preview --platform android
```

Razorpay secrets must remain server-side. The app only receives the checkout `keyId`, Razorpay provider order id, amount, currency, and order number from the API.
