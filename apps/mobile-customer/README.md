# 1HandIndia Customer Mobile App

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
