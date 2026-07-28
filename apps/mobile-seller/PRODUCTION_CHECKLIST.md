# 1HandIndia Seller Mobile App Production Release Guide

This is the single production-readiness and Google Play release document for the 1HandIndia Seller mobile app.

Use it for every preview, internal, closed-testing, and production release. Do not approve a release because the code builds locally. Approval requires the automated, deployment, policy, signed-build, and physical-device gates in this document.

## 1. Application Identity

| Item | Production value |
|---|---|
| Product name | 1HandIndia Seller |
| Portal identity | 1HandIndia Seller Hub |
| Workspace package | `@indihub/mobile-seller` |
| Expo slug | `onehandindia-seller` |
| Expo owner | `onehandindiasteam` |
| EAS project ID | `e017cb61-41d7-4e0f-9268-573106ddd729` |
| Android package | `com.onehandindia.seller` |
| URL scheme | `onehandindia-seller` |
| Marketing version | `1.0.0` |
| Production API | `https://api.1handindia.com/api` |
| Seller web portal | `https://1handindia.com` |
| Privacy policy | `https://1handindia.com/privacy-policy` |
| Account deletion | `https://1handindia.com/account-deletion` |
| Primary release workflow | GitHub Actions: `EAS Build (Android)` |
| Production artifact | Android App Bundle (`.aab`) |

The production EAS profile uses remote app versioning with automatic Android build-number increments. Never reuse a Play Store `versionCode`.

## 2. Current Readiness Status

Last reviewed: **July 26, 2026**

### Verified

- [x] Seller TypeScript typecheck passes.
- [x] Seller lint passes.
- [x] Seller unit suite passes: 20 files and 85 tests.
- [x] `npx expo install --check` reports aligned dependencies.
- [x] Expo Doctor passes all 21 checks.
- [x] A clean Expo Android prebuild completes.
- [x] Expo Continuous Native Generation is configured through `.easignore`.
- [x] Android backup is disabled.
- [x] Camera, microphone, and system-overlay permissions are blocked.
- [x] Android notification icon and channel are configured.
- [x] Firebase Android configuration is available.
- [x] The seller EAS project ID is pinned in `app.config.js` and every EAS profile.
- [x] Mobile seller subscription purchase and Razorpay checkout have been removed.
- [x] Account-deletion request UI and public account-deletion page are implemented.
- [x] GitHub Actions runs seller typecheck, lint, tests, Expo dependency checks, Expo Doctor, and public-config validation before EAS Build.
- [x] GitHub Actions waits for EAS Build to finish before reporting success.

### Release Blockers

- [ ] The privacy policy returns HTTP `200`.
- [ ] The account-deletion page returns HTTP `200`.
- [ ] The production API health endpoint returns HTTP `200`.
- [ ] GitHub Actions completes a `mobile-seller` production EAS build.
- [ ] The resulting AAB is inspected for package, version, target SDK, permissions, and signing.
- [ ] Play App Signing and the upload key are configured.
- [ ] Play Console app-content and Data Safety forms are complete.
- [ ] Internal or closed testing is complete.
- [ ] Physical-device QA is complete.
- [ ] Foreground, background, and killed-app push delivery is verified.
- [ ] Sentry source-map and release reporting are verified.
- [ ] Store listing text, images, screenshots, and contact details are approved.

On July 26, 2026, the privacy policy, account-deletion page, and API health endpoint returned Cloudflare `522`. Recheck them before starting the production EAS build.

## 3. Release Roles

Assign one person to each role before release.

| Role | Responsibility | Approval |
|---|---|---|
| Release owner | Coordinates the release and records evidence | Required |
| Mobile engineer | Confirms code, Expo, EAS, and AAB configuration | Required |
| Backend owner | Confirms API, database, storage, auth, notifications, and compatibility | Required |
| QA owner | Runs device, workflow, regression, and notification testing | Required |
| Security/privacy owner | Reviews permissions, Data Safety, deletion, and policy declarations | Required |
| Play Console owner | Manages signing, testing tracks, listing, declarations, and rollout | Required |
| Business owner | Approves listing content, countries, support contact, and launch timing | Required |

## 4. Environment And Credentials

### Public Build Variables

These values may be embedded in the application. They are not private secrets.

- [ ] `EXPO_PUBLIC_APP_ENV=production`
- [ ] `EXPO_PUBLIC_API_URL=https://api.1handindia.com/api`
- [ ] `EXPO_PUBLIC_SELLER_PORTAL_URL=https://1handindia.com`
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` matches the production Clerk instance.
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID=e017cb61-41d7-4e0f-9268-573106ddd729`
- [ ] `EXPO_PUBLIC_SENTRY_DSN` is set when production monitoring is enabled.
- [ ] `EXPO_PUBLIC_SENTRY_TUNNEL_URL` is set only when the configured Sentry tunnel is deployed.

Never place a private key, Clerk secret key, database URL, API secret, signing password, Sentry auth token, or provider credential in an `EXPO_PUBLIC_*` variable.

### GitHub And EAS Secrets

- [ ] GitHub secret `EXPO_TOKEN` can access the `onehandindiasteam` Expo account.
- [ ] EAS has the Android upload keystore and passwords.
- [ ] EAS has valid Firebase/FCM credentials for `com.onehandindia.seller`.
- [ ] `SENTRY_AUTH_TOKEN` is stored as an EAS secret.
- [ ] `SENTRY_ORG` and `SENTRY_PROJECT` identify the correct seller-app project.
- [ ] No credential values are printed in GitHub Actions logs.
- [ ] Signing keys and recovery information are stored in an approved secure backup.

Local `.env` files are ignored and are not the production source of truth.

## 5. Automated Release Gates

Run lightweight checks locally when practical. The GitHub EAS workflow repeats the seller release gates.

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @indihub/mobile-seller typecheck
pnpm --filter @indihub/mobile-seller lint
pnpm --filter @indihub/mobile-seller test
```

From `apps/mobile-seller`:

```powershell
npx expo install --check
npx expo-doctor
npx expo config --type public --json
```

Optional clean native-generation check:

```powershell
npx expo prebuild --clean --no-install --platform android
```

Do not run the local prebuild or Gradle build when the development machine does not have enough free disk space. Use GitHub Actions and EAS Build instead.

### Expected Automated Results

- [ ] Frozen-lockfile installation succeeds.
- [ ] Typecheck exits with code `0`.
- [ ] Lint exits with code `0`.
- [ ] All seller tests pass.
- [ ] Expo dependencies are aligned.
- [ ] Expo Doctor reports no failed checks.
- [ ] Public Expo config contains the expected package, version, backup setting, and EAS project ID.
- [ ] The production EAS build finishes successfully.

## 6. Build Through GitHub Actions

Use this path when local Android build space is limited.

1. Push the approved source and lockfile to the release branch.
2. Open **GitHub Actions**.
3. Open **EAS Build (Android)**.
4. Select **Run workflow**.
5. Choose app `mobile-seller`.
6. Choose profile `production`.
7. Start the workflow.
8. Confirm the seller verification step passes.
9. Wait for the EAS build step to finish.
10. Open the EAS build URL from the workflow log.
11. Download or submit the generated `.aab`.
12. Record the workflow and EAS build URLs in the release record.

The workflow must be red when verification or EAS Build fails. A queued build is not release evidence.

### Direct EAS Alternative

Use this only when GitHub Actions is unavailable:

```powershell
cd apps/mobile-seller
eas build --platform android --profile production --non-interactive --wait
```

## 7. Signed AAB Inspection

The final EAS artifact, not the source manifest, is authoritative.

- [ ] File type is `.aab`, not a development APK.
- [ ] Package is `com.onehandindia.seller`.
- [ ] Marketing version is the approved version.
- [ ] `versionCode` is higher than every previously uploaded bundle.
- [ ] Build targets API 36 for releases submitted on or after August 31, 2026.
- [ ] Minimum SDK matches the supported-device decision.
- [ ] Bundle is signed with the approved upload key, not a debug certificate.
- [ ] Play App Signing is enabled.
- [ ] Firebase includes the Play App Signing SHA-1/SHA-256 certificates when required by Google sign-in or Firebase services.
- [ ] `android:allowBackup` is `false`.
- [ ] Camera permission is absent.
- [ ] Microphone permission is absent.
- [ ] System overlay permission is absent.
- [ ] Notification permission is present.
- [ ] Every remaining merged-manifest permission has a real app feature and an accurate Play declaration.
- [ ] No native Razorpay seller-subscription checkout package is present.
- [ ] Bundle size and native libraries are reasonable for the app.
- [ ] Play Console accepts the AAB without package, signing, SDK, or policy errors.

## 8. Production Service Readiness

Verify these from an external network, not only from the production server.

- [ ] `https://api.1handindia.com/api/health` returns HTTP `200`.
- [ ] `https://1handindia.com/privacy-policy` returns HTTP `200`.
- [ ] `https://1handindia.com/account-deletion` returns HTTP `200`.
- [ ] TLS certificates are valid and complete.
- [ ] Production CORS accepts the seller app's API requests.
- [ ] Clerk production sessions are accepted by the API.
- [ ] Database migrations are deployed.
- [ ] Storage upload and read URLs work.
- [ ] Firebase/Expo push credentials are active.
- [ ] Transactional email provider is active.
- [ ] Sentry production project is receiving events.
- [ ] Backend remains compatible with the previously published app version.
- [ ] No bootstrap seed, integration test, data import, or ad hoc mutation script runs against production during release.

## 9. Authentication And Account Lifecycle QA

- [ ] Fresh install opens the correct signed-out screen.
- [ ] Email/password sign-in completes inside the app.
- [ ] Additional Clerk verification completes inside the app.
- [ ] Google sign-in returns to the seller app.
- [ ] Invalid credentials show safe user-facing text.
- [ ] Expired sessions refresh or return to sign-in safely.
- [ ] Sign-out revokes the local session and push token.
- [ ] Restarting the app restores a valid session.
- [ ] Suspended or blocked sellers see the correct restricted state.
- [ ] Seller onboarding works for a new account.
- [ ] Pending approval state works.
- [ ] Approved seller state opens the dashboard.
- [ ] Account and privacy screen opens both policy URLs.
- [ ] Account-deletion request creates the expected support request.
- [ ] The public account-deletion flow works without requiring app access.

Prepare a stable reviewer account for Play App Access. Document every sign-in and verification step in Play Console.

## 10. Seller Feature Regression Checklist

### Dashboard

- [ ] Retail dashboard metrics and actions are correct.
- [ ] Service dashboard metrics and actions are correct.
- [ ] Hybrid dashboard keeps product and service figures distinct.
- [ ] Today, 7-day, and month periods work.
- [ ] Pull-to-refresh works without losing prior data.
- [ ] Low-stock, payout, and notification warnings open the correct screen.
- [ ] Recent orders and bookings open the correct detail screen.

### Products

- [ ] Product search and filters work.
- [ ] Pagination and pull-to-refresh work.
- [ ] Product images and fallbacks render.
- [ ] Product status and approval labels are accurate.
- [ ] Price, variants, and stock summaries are accurate.
- [ ] Add product works.
- [ ] Product image upload works.
- [ ] Product edit works.
- [ ] Product archive requires confirmation and refreshes the catalogue.

### Orders And Returns

- [ ] Order list and search work.
- [ ] Order details show only the seller's items.
- [ ] Accept, process, pack, dispatch, deliver, and cancel transitions follow backend rules.
- [ ] Package dimensions and readiness save correctly.
- [ ] Shipping label and tracking actions work.
- [ ] Returns list and return details load.
- [ ] Return accept/reject and QC notes work.
- [ ] Payment status is not incorrectly changed by fulfilment updates.

### Services

- [ ] Service listing search and status filters work.
- [ ] Add and edit service work.
- [ ] Booking/job list and details work.
- [ ] Accept, reschedule, quote, start, and complete actions work.
- [ ] Service payment or collected cash recording works.
- [ ] Technician assignment and availability calendar work.
- [ ] Customer reviews display correctly.

### Finance, Reports, And Subscription

- [ ] Wallet and payout availability are accurate.
- [ ] Bank/UPI payout details save and remain private.
- [ ] Payout request locks eligible amounts against duplicates.
- [ ] Ledger and payout history load.
- [ ] Seller statements download with authenticated requests.
- [ ] Sales, inventory, finance, and returns reports load.
- [ ] GST reports hand off to the web Seller Hub correctly.
- [ ] Current subscription plan and renewal state load.
- [ ] Payment history loads.
- [ ] Subscription cancellation works.
- [ ] No plan-purchase or external-payment action appears in Android.

### B2B

- [ ] Enquiry list and details load.
- [ ] Negotiation messages and transport quote details are readable in the enquiry detail.
- [ ] Seller quotation response works only in allowed states.
- [ ] Confirmed enquiries are locked as expected.
- [ ] B2B orders show current payment, settlement, transport, and fulfilment statuses.
- [ ] Purchase order, proforma invoice, and tax invoice documents open when available.
- [ ] Complex enquiry and order actions show a confirmation before opening the exact Seller Hub detail page.
- [ ] Notification deep links open the correct enquiry.

## 11. Push Notification QA

Use an EAS development, preview, or store-installed build. Expo Go is not sufficient for final verification.

- [ ] Permission prompt appears after seller sign-in.
- [ ] Denied permission shows the in-app warning.
- [ ] Device receives an Expo push token.
- [ ] Backend stores the token against the signed-in seller.
- [ ] Sign-out or permission removal revokes/deactivates the token.
- [ ] New seller order notification arrives in the foreground.
- [ ] New seller order notification arrives in the background.
- [ ] New seller order notification arrives when the app is killed.
- [ ] New B2B enquiry notification passes all three app states.
- [ ] Order notification opens `/orders/[orderNumber]`.
- [ ] B2B notification opens `/b2b-enquiries/[id]`.
- [ ] Notification icon renders white on transparent.
- [ ] Notification channel is `seller-alerts`.
- [ ] Stale tokens are disabled after `DeviceNotRegistered`.
- [ ] Notification payloads contain no unnecessary personal or financial information.

## 12. Sentry And Observability

- [ ] Sentry is disabled during normal local development.
- [ ] Production DSN points to the seller project.
- [ ] Sentry config plugin is included in the production build.
- [ ] Source maps upload successfully.
- [ ] A controlled test error appears in Sentry.
- [ ] Stack trace shows readable source file and line information.
- [ ] Event release and build number match the installed app.
- [ ] Authentication tokens, payout values, documents, and personal data are scrubbed.
- [ ] Alerts exist for new fatal errors and significant regression spikes.
- [ ] API and notification logs provide enough evidence to trace failed seller actions.

## 13. Device And UX Test Matrix

Test at minimum:

- [ ] One device on the minimum Android version supported by the final AAB.
- [ ] One mid-range phone on Android 13 or 14.
- [ ] One current phone on Android 15 or 16.
- [ ] Phone layout near `360x800`.
- [ ] Phone layout near `390x844`.
- [ ] Tablet layout near `768x1024`.
- [ ] Fresh installation.
- [ ] Upgrade from the previous release.
- [ ] Low storage condition.
- [ ] Slow network.
- [ ] Offline and reconnect.
- [ ] Denied notification permission.
- [ ] Background and killed-app restore.
- [ ] Long seller/store names.
- [ ] Zero-data, partial-data, loading, refresh, and API-error states.

Confirm there is no overlapping text, clipped action, shifting metric tile, unusable keyboard state, blank screen, or raw provider error.

## 14. Security And Privacy Checklist

- [ ] All API traffic uses HTTPS.
- [ ] Clerk tokens use secure storage.
- [ ] No private credential is embedded in the bundle.
- [ ] Android backup remains disabled.
- [ ] Seller, admin, customer, delivery, and B2B permissions remain separated.
- [ ] Payout information is masked in UI and protected by the backend.
- [ ] File uploads validate type, size, ownership, and storage key.
- [ ] API errors do not expose stack traces or provider secrets.
- [ ] Account deletion explains verification, retention, legal obligations, and operational impact.
- [ ] Privacy policy accurately describes Clerk, Expo/Firebase notifications, Sentry, storage, support, seller operations, and payout data.
- [ ] Dependency and SDK data collection is reviewed before completing Data Safety.
- [ ] Final AAB permissions match the Play Console declarations.
- [ ] Play Integrity is evaluated as a fraud and authenticity control; do not claim it is enabled unless verified.

## 15. Google Play Console Checklist

### Application Setup

- [ ] Developer identity verification is complete.
- [ ] App is created as `1HandIndia Seller`.
- [ ] Package is `com.onehandindia.seller`.
- [ ] Default language and distribution countries are approved.
- [ ] Play App Signing is enabled.
- [ ] Support email, website, and privacy policy are configured.

### App Content

- [ ] Privacy policy URL is live.
- [ ] Account-deletion URL is entered where required.
- [ ] Ads declaration is accurate.
- [ ] App Access contains working seller reviewer credentials and instructions.
- [ ] Content-rating questionnaire is complete.
- [ ] Target audience is accurate for a seller/business operations app.
- [ ] News, health, financial, government, and other declarations are answered accurately.
- [ ] No declaration is copied from another 1HandIndia app without checking seller-specific behavior.

### Data Safety Review

Audit actual behavior and SDKs before selecting answers. Review at least:

- [ ] Name, email address, phone number, and account identifiers.
- [ ] Seller business identity and address.
- [ ] Product, order, service, B2B, and support activity.
- [ ] Bank/UPI payout information.
- [ ] Images and uploaded seller documents.
- [ ] Push token and device identifiers.
- [ ] Crash logs and diagnostics sent to Sentry.
- [ ] Authentication processing by Clerk.
- [ ] Notification processing by Expo/Firebase.
- [ ] Data encryption in transit.
- [ ] Account-deletion and retention practices.
- [ ] Whether each data type is collected, shared, optional, required, or ephemeral.

The seller app does not request device location permission. Manually entered business or delivery addresses are still user data and must be declared accurately.

### Store Listing

- [ ] App title fits the Play limit.
- [ ] Short description is approved.
- [ ] Full description is approved.
- [ ] 512x512 app icon is approved.
- [ ] 1024x500 feature graphic is approved.
- [ ] At least two representative phone screenshots are uploaded.
- [ ] Additional screenshots cover dashboard, products, orders, services, and finance.
- [ ] Tablet screenshots are uploaded when the tablet experience is distributed.
- [ ] Category is approved, normally Business.
- [ ] Listing text contains no unverified performance, earnings, ranking, or marketplace claims.
- [ ] Screenshots contain no real personal, order, payout, or customer information.

### Subscription And Payments Policy

The Android seller app is consumption-only for seller subscriptions.

- [ ] It may display current plan, renewal status, payment history, plan benefits, and cancellation.
- [ ] It does not sell a seller plan.
- [ ] It does not launch Razorpay or another external checkout for a digital seller plan.
- [ ] It does not direct the user to an external plan-purchase page.
- [ ] New seller onboarding receives the backend-configured default plan.
- [ ] Any future in-app digital subscription purchase uses Google Play Billing or an approved program.

## 16. Testing Tracks

### Internal Testing

- [ ] Upload the production-signed AAB.
- [ ] Add engineering, QA, support, finance, and seller-operations testers.
- [ ] Install through Google Play, not through a development client.
- [ ] Run the full regression checklist.
- [ ] Review Play pre-launch report findings.
- [ ] Review Sentry and backend logs.

### Closed Testing

For personal Play developer accounts created after November 13, 2023:

- [ ] At least 12 testers remain opted in.
- [ ] Testing runs continuously for at least 14 days.
- [ ] Production-access questions are completed honestly.
- [ ] Testing evidence and feedback are retained.

Organization accounts and older accounts must follow the requirements shown in their own Play Console.

## 17. Production Rollout

Do not start production rollout while any release blocker is open.

Suggested staged rollout:

1. Release to 10%.
2. Monitor for at least 24 to 48 hours.
3. Increase to 25% when stable.
4. Increase to 50% when stable.
5. Increase to 100% after final approval.

At every stage:

- [ ] Check Play crashes and ANRs.
- [ ] Check Sentry fatal and high-frequency errors.
- [ ] Check sign-in and session-refresh failures.
- [ ] Check API error rates and latency.
- [ ] Check push-token registration and delivery.
- [ ] Check seller support requests and Play reviews.
- [ ] Check product, order, service, payout, and B2B mutations.
- [ ] Confirm no previous app version lost backend compatibility.

## 18. Halt, Rollback, And Hotfix

Google Play cannot publish an older `versionCode` over a newer release.

If a serious issue appears:

1. Halt the staged rollout.
2. Record the affected version, scope, and first detection time.
3. Disable the affected backend/provider feature when a safe operational toggle exists.
4. Restore a compatible backend deployment when the server caused the regression.
5. Create a minimal mobile hotfix.
6. Increase the remote Android build number.
7. Repeat automated gates and targeted regression.
8. Submit the replacement AAB.
9. Resume rollout only after QA and business approval.

Do not delete audit, order, payout, subscription, or seller data as a rollback method.

## 19. Final Go/No-Go Decision

Release is **GO** only when every item below is true:

- [ ] Automated seller gates pass from a clean GitHub checkout.
- [ ] Production EAS AAB build passes.
- [ ] Final AAB identity, SDK, permissions, and signing are verified.
- [ ] Production API and both policy URLs return HTTP `200`.
- [ ] Play Console declarations and listing are complete.
- [ ] Internal/closed testing requirements are complete.
- [ ] Full physical-device regression passes.
- [ ] Push notification E2E passes.
- [ ] Sentry source-map validation passes.
- [ ] No open critical or high-severity defect affects authentication, seller data, products, orders, services, payouts, subscriptions, account deletion, or authorization.
- [ ] Release, QA, backend, privacy, Play Console, and business owners approve.

Any unchecked item means **NO-GO**, unless the business owner and security/privacy owner document a specific accepted risk that does not violate platform policy or expose user data.

## 20. Release Record Template

Copy this section for each release.

```text
Release name:
Marketing version:
Android versionCode:
Release date:
Source branch:
Source commit SHA:
GitHub Actions run:
EAS build URL:
AAB SHA-256:
Upload certificate SHA-256:
Play App Signing certificate SHA-256:
Target SDK:
Minimum SDK:
Production API:
Play track:
Rollout percentage:
Internal testers:
Closed-testing dates:
Known accepted risks:
Automated checks:
Physical devices tested:
Push E2E result:
Sentry validation result:
Pre-launch report result:
Release owner approval:
QA approval:
Backend approval:
Security/privacy approval:
Play Console approval:
Business approval:
Incidents:
Rollback/hotfix:
Final outcome:
```

## 21. Official References

- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google Play store listing assets](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Android app signing](https://developer.android.com/studio/publish/app-signing)
- [Expo EAS build profiles](https://docs.expo.dev/build/eas-json/)
- [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)

## 22. iOS Note

This document approves Android and Google Play releases only. The app includes iOS configuration, notification entitlements, and tablet support, but an App Store release requires separate Apple signing, App Store Connect, privacy-manifest, TestFlight, review, and production sign-off.
