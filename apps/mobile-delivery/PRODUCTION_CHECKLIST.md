# 1HandIndia Delivery App Production Release Checklist

This is the production-readiness and Google Play release guide for the 1HandIndia Delivery mobile app.

Use it for internal testing, closed testing, production submission, and every later Android release. A passing unit suite does not by itself make a signed mobile build production-ready; every required gate below must be completed and evidence retained.

## 1. Application Identity

| Item | Production value |
|---|---|
| App name | 1HandIndia Delivery |
| Workspace package | `@indihub/mobile-delivery` |
| Expo slug | `onehandindia-delivery` |
| Android package | `com.onehandindia.delivery` |
| URL scheme | `onehandindia-delivery` |
| Current marketing version | `1.0.0` |
| Current remote Android version code | `3` (no successful artifact yet) |
| EAS project ID | `e77779de-aa9a-447c-a0eb-91802cf2deb0` |
| Production API | `https://api.1handindia.com/api` |
| Production website | `https://1handindia.com` |
| Production artifact | Android App Bundle (`.aab`) |

The EAS production profile uses remote app versioning and `autoIncrement: true`. EAS must allocate a new Android version code for every production build. Never reuse a version code already uploaded to Google Play.

## 2. Current Readiness Status

Last reviewed: **July 26, 2026**

### Verified

- [x] TypeScript typecheck passes.
- [x] ESLint passes.
- [x] Unit tests pass: **3 test files and 8 tests**.
- [x] `npx expo install --check` reports dependencies are up to date.
- [x] Expo Doctor passes all **21/21 checks**.
- [x] Android production JavaScript/Hermes export completes successfully.
- [x] A clean Android Expo prebuild completes successfully.
- [x] Continuous Native Generation is configured through `.easignore`; generated `android/` and `ios/` folders are not release inputs.
- [x] Android package ID is `com.onehandindia.delivery`.
- [x] The production EAS profile creates an Android App Bundle by default.
- [x] Remote versioning and automatic Android version-code increments are enabled.
- [x] Production API, website, Clerk publishable key, version-gate values, and EAS project ID are configured.
- [x] Firebase Android client configuration is present locally and excluded from source control.
- [x] Foreground location, camera, and notification permissions are declared.
- [x] Background-location and location foreground-service permissions are blocked.
- [x] The Firebase Admin service-account key is not stored or imported inside the client application.
- [x] The EAS project is owned by `onehandindiasteam` and linked to the expected project ID.
- [x] EAS remote Android signing credentials and the `onehandindiaapps` keystore are configured.
- [x] `GOOGLE_SERVICES_JSON` is configured as a secret EAS file variable for production.

### Resolved Local Release Blockers

The July 26 dependency/native-config findings are resolved:

- [x] Removed the unused direct `expo-modules-core` dependency.
- [x] Added the Clerk peer dependencies `expo-auth-session` and `react-dom`.
- [x] Aligned the Expo SDK 56 dependency patch/minor versions.
- [x] Resolved duplicate delivery-app native-module installations.
- [x] Standardized the delivery app on Continuous Native Generation.
- [x] Removed the stale local `android.versionCode`; remote EAS versioning is the only Android version-code source.

### Remaining External Release Blockers

- [ ] Restore the production API health endpoint. `https://api.1handindia.com/api/health` returned Cloudflare HTTP `522` on July 26, 2026.
- [ ] Restore the privacy policy, account-deletion page, and delivery update page. Each returned Cloudflare HTTP `522` on July 26, 2026.
- [ ] Configure delivery-specific Sentry DSN, organization, project, and auth-token values in EAS; none were present during the July 26 verification.
- [ ] Complete a production EAS build. Signing and upload preparation passed, but Expo rejected the build because the account's free Android build quota is exhausted until **August 1, 2026**. Upgrade the Expo plan or rerun after the reset.
- [ ] Treat Android version code `3` as consumed by the failed build attempt and allow EAS to auto-increment the next build.
- [ ] The resulting AAB is inspected for package ID, version, target SDK, permissions, and signing.
- [ ] Physical-device QA passes on representative Android versions and manufacturers.
- [ ] Google Play app-content, privacy, Data Safety, and store-listing forms are complete.
- [ ] Internal testing passes before promotion to closed testing or production.
- [ ] The release owner approves a staged production rollout.

The local full-architecture Gradle release build was also attempted. It reached native compilation but the workstation JVM exhausted physical/virtual memory. The clean prebuild and production JS bundle pass; use the EAS cloud build as the authoritative signed-AAB gate.

**Current decision:** the mobile code and Expo configuration are production-ready, but the release remains **NO-GO** until the public 522 outage is fixed, Sentry is configured, a signed EAS AAB succeeds, and external QA/Play Console gates are complete.

## 3. Release Ownership

Assign an owner before starting a release.

| Role | Responsibility | Required |
|---|---|---|
| Release owner | Coordinates gates, evidence, and final go/no-go | Yes |
| Mobile engineer | Resolves Expo/EAS issues and validates the AAB | Yes |
| Backend owner | Confirms API, uploads, push, auth, and compatibility | Yes |
| QA owner | Runs device and delivery-workflow testing | Yes |
| Privacy owner | Reviews permissions, privacy policy, and Data Safety | Yes |
| Play Console owner | Manages app signing, tracks, listing, and rollout | Yes |
| Business owner | Approves listing copy, countries, and launch timing | Yes |

## 4. Production Environment And Credentials

### Public Application Configuration

Confirm the production EAS environment contains the intended values:

- [ ] `EXPO_PUBLIC_APP_ENV=production`
- [ ] `EXPO_PUBLIC_API_URL=https://api.1handindia.com/api`
- [ ] `EXPO_PUBLIC_WEB_URL=https://1handindia.com`
- [ ] `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` belongs to the production Clerk instance.
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID=e77779de-aa9a-447c-a0eb-91802cf2deb0`
- [ ] `EXPO_PUBLIC_DELIVERY_MIN_ANDROID_VERSION_CODE` matches the minimum supported production build.
- [ ] `EXPO_PUBLIC_DELIVERY_UPDATE_URL` opens a valid delivery-app update/help page.
- [ ] `EXPO_PUBLIC_ENABLE_SENTRY=true` only when Sentry is fully configured.
- [ ] `EXPO_PUBLIC_SENTRY_DSN` is configured for production monitoring.
- [ ] Sentry organization, project, and auth-token values required for source-map upload are stored as EAS secrets, not committed files.

Values prefixed with `EXPO_PUBLIC_` are bundled into the application and must never contain private secrets.

### Firebase And Push Notifications

- [ ] The Firebase Android app is registered with package `com.onehandindia.delivery`.
- [ ] The production `google-services.json` belongs to that exact Firebase application.
- [ ] Firebase client configuration remains ignored by source control and is supplied securely to EAS.
- [ ] Expo/EAS push credentials are configured for the production project.
- [ ] A real device receives foreground, background, and killed-app notifications.
- [ ] Notification taps open the intended route exactly once.
- [ ] A notification tapped while signed out resumes its intended destination after sign-in.

Never place a Firebase Admin service-account JSON, Play service-account JSON, Clerk secret key, database URL, storage secret, Sentry auth token, or API private key in the app bundle.

### Google Play Submission Credential

The Google Play service-account key used by EAS Submit is a release-system credential, not an Android app credential.

- [ ] Create a least-privilege Google Cloud service account for Play submission only.
- [ ] Grant only the Play Console permissions required to upload releases.
- [ ] Store the JSON key in a secure secret manager or approved local secret directory.
- [ ] Never commit the key or copy it into `assets/`, `android/`, or application source.
- [ ] Rotate and revoke the key immediately if it is exposed.

## 5. Google Play Console Prerequisites

- [ ] Use the approved 1HandIndia Google Play developer account. An organization account is preferred for a company-owned marketplace application.
- [ ] Complete developer identity, organization, contact, and any required payments-profile verification.
- [ ] Confirm the Play Console account owner and at least one backup administrator have access.
- [ ] Create the app as **1HandIndia Delivery**.
- [ ] Select the correct default language, app/game type, free/paid status, and required declarations.
- [ ] Use package name `com.onehandindia.delivery`. This cannot be changed after the first uploaded artifact establishes the app identity.
- [ ] Enable Play App Signing and securely retain the upload-key recovery information.
- [ ] Restrict production access to authorized release personnel.

### New Personal Account Testing Requirement

If the developer account is a personal account created after November 13, 2023, Google requires a closed test with at least **12 opted-in testers continuously for 14 days** before production access can be requested.

- [ ] Confirm whether this requirement applies to the selected developer account.
- [ ] If applicable, recruit more than 12 testers to allow for accidental opt-outs.
- [ ] Keep at least 12 testers continuously opted in for the full 14-day period.
- [ ] Record testing feedback and fixes for the production-access questionnaire.

## 6. Google Play Policy And App Content

Complete every Play Console item before requesting review.

- [ ] **Privacy policy:** publish a public HTTPS policy describing delivery-partner data collection, use, retention, sharing, security, and deletion.
- [ ] **Data Safety:** declare all collected, shared, encrypted, optional, required, and deletable data accurately.
- [ ] **App access:** explain that the app is restricted to approved delivery partners and provide stable reviewer credentials and exact navigation instructions.
- [ ] **Account deletion:** provide an in-app deletion/request path and public web URL if users can create or maintain an account in the app.
- [ ] **Ads:** declare accurately whether the app contains ads.
- [ ] **Content rating:** complete the questionnaire using actual app behavior.
- [ ] **Target audience:** select the operational adult audience; do not target children unless product policy explicitly changes.
- [ ] **News, health, financial, government, or other special categories:** answer accurately and provide documentation if Play Console identifies an applicable category.
- [ ] **Permissions:** justify foreground coarse/fine location, camera, media/image selection, and notifications using delivery workflow language.
- [ ] **Background location:** confirm it is not requested and not declared in the final AAB.
- [ ] **Data deletion:** document backend retention and deletion behavior so the policy, product, and Data Safety answers agree.

### Suggested Reviewer Instructions

Provide Play review with a dedicated, non-production-sensitive delivery-partner test account and concise steps:

1. Sign in with the supplied delivery-partner account.
2. Open the assigned test order.
3. Accept the assignment and progress through allowed statuses.
4. Test proof capture/upload using non-sensitive test data.
5. Open returns and wallet screens.
6. Explain any workflow requiring backend/admin preparation.

The reviewer account must remain active for the entire review period and must not expose real customer data.

## 7. Store Listing Assets

Prepare original 1HandIndia-branded assets and approved copy.

- [ ] App name: `1HandIndia Delivery`
- [ ] Short description.
- [ ] Full description covering assignments, navigation/location use, delivery proof, returns, COD, wallet, and notifications.
- [ ] High-resolution app icon: 512 × 512 PNG, within Google Play limits.
- [ ] Feature graphic: 1024 × 500 JPG or PNG.
- [ ] At least two representative phone screenshots; use additional screenshots to explain the workflow clearly.
- [ ] Screenshots contain test data only and reveal no customer personal information.
- [ ] Support email monitored by the operations team.
- [ ] Support website.
- [ ] Privacy-policy URL.
- [ ] Account-deletion URL where applicable.
- [ ] Release notes for the submitted version.
- [ ] Countries/regions approved by operations and legal owners.

Do not copy competitor branding, layouts, screenshots, or proprietary text.

## 8. Pre-Build Automated Gates

Run from PowerShell:

```powershell
cd "E:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npx.cmd expo install --check
npx.cmd --yes expo-doctor
```

Required result:

- [ ] Typecheck exits with code `0`.
- [ ] Lint exits with code `0`.
- [ ] All unit tests pass.
- [ ] Expo dependency check reports no required alignment changes.
- [ ] Expo Doctor passes all checks.

Do not suppress Expo Doctor findings merely to make the command green. Fix or deliberately document each finding with owner approval.

## 9. EAS Account And Project Verification

```powershell
cd "E:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest whoami
npx.cmd eas-cli@latest project:info
```

- [ ] Logged-in Expo account belongs to the approved 1HandIndia organization/team.
- [ ] Project information shows EAS project ID `e77779de-aa9a-447c-a0eb-91802cf2deb0`.
- [ ] Android application identifier is `com.onehandindia.delivery`.
- [ ] Production environment variables and secrets exist in EAS.
- [ ] Android signing credentials are backed up or managed by EAS under the approved account.
- [ ] No developer's personal Expo project or signing key is being used accidentally.

## 10. Build The Production AAB

```powershell
cd "E:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"
npx.cmd eas-cli@latest build --platform android --profile production
```

- [ ] Build uses the `production` profile.
- [ ] Build completes successfully on EAS.
- [ ] Download the `.aab` artifact from the EAS build page.
- [ ] Record EAS build ID, source revision/archive identifier, build time, marketing version, and Android version code.
- [ ] Keep the exact tested artifact; do not rebuild after QA and upload a different untested binary.

### AAB Inspection

Inspect the uploaded artifact in Play Console or with Android bundle tooling.

- [ ] Package: `com.onehandindia.delivery`
- [ ] Marketing version matches the approved release.
- [ ] Android version code is new and greater than all previous uploads.
- [ ] Target API meets Google Play requirements.
- [ ] Plan for **Android 16 / API 36 before August 31, 2026**, when it becomes required for new apps and updates.
- [ ] Only intended permissions are present.
- [ ] Background-location permission is absent.
- [ ] Debuggable mode is disabled.
- [ ] Production API and Clerk instance are embedded.
- [ ] Play App Signing/signing certificate is correct.
- [ ] Native libraries support required device architectures.

## 11. Physical-Device QA

Run against the exact release artifact distributed through Play internal testing. Test at least one recent Pixel/reference Android device and representative Samsung/Xiaomi/OnePlus-class devices used by delivery staff.

### Authentication And Access

- [ ] Fresh install and first launch.
- [ ] Clerk sign-in, sign-out, and session restoration.
- [ ] Token rotation during account synchronization does not hang the app.
- [ ] Invalid/expired session shows a recoverable user-facing state.
- [ ] Pending, rejected, suspended, and approved delivery-partner access states.
- [ ] Approval while the blocked screen is open becomes available after refresh/resume.
- [ ] Sign-out failure is visible and retryable.

### Orders And Delivery

- [ ] Assigned-order list loads, refreshes on foreground, and supports pull-to-refresh.
- [ ] Pagination loads and searches beyond the first server page.
- [ ] Dashboard totals remain consistent with server totals.
- [ ] Empty order state is clear and branded.
- [ ] Order detail loads correct customer/address/item data.
- [ ] Accept and reject actions cannot double-submit or conflict.
- [ ] Status progression follows server rules one step at a time.
- [ ] Delivery estimate rejects past date/time values.
- [ ] Failed-attempt date validates `YYYY-MM-DD` before submission.
- [ ] Delivery note can be updated and cleared.
- [ ] Delivered status requires receiver information and proof.
- [ ] Camera/gallery proof upload succeeds, retries safely, and handles cancellation.
- [ ] COD exact-amount validation works and duplicate submission is blocked.

### Returns And Wallet

- [ ] Return list refreshes and paginates beyond the first page.
- [ ] Return accept/reject mutations cannot conflict.
- [ ] Pickup and receipt notes remain separate and clear at the correct time.
- [ ] Return proof/receipt upload succeeds and handles failure.
- [ ] Wallet balance and ledger totals match the backend.
- [ ] Wallet ledger pagination loads the complete history.
- [ ] Payout/request states and error messages are correct.

### Push, Permissions, And Recovery

- [ ] Foreground push notification displays correctly.
- [ ] Background push notification opens the correct route once.
- [ ] Killed-app notification opens the correct route once.
- [ ] Signed-out notification destination resumes after successful sign-in.
- [ ] Notification permission denied, later granted, and permanently denied states are handled.
- [ ] Location permission denied, approximate, precise, and later granted states are handled.
- [ ] GPS/location services disabled state is recoverable.
- [ ] Camera/media permission denial does not crash the app.
- [ ] Airplane mode, slow network, timeout, reconnect, and API `401` retry behavior.
- [ ] App background/foreground refreshes stale queries.
- [ ] Forced minimum-version gate directs users to a valid update location.
- [ ] Sentry receives a test event with readable release/source-map information.

### Device Quality

- [ ] No clipped controls at common font/display scaling settings.
- [ ] Keyboard does not cover required form fields or actions.
- [ ] Search submits from the software keyboard.
- [ ] Back navigation is predictable after notification routing.
- [ ] No secrets, tokens, customer data, or private URLs appear in logs.
- [ ] Cold start, common navigation, and list scrolling remain responsive.

## 12. First Google Play Upload

Expo documents that the first Google Play upload must be completed manually before API-based EAS Submit uploads can work reliably for the app.

1. Open Google Play Console and select **1HandIndia Delivery**.
2. Complete the dashboard setup tasks and app-content declarations.
3. Open **Test and release → Testing → Internal testing**.
4. Create or select an internal-testing release.
5. Upload the production `.aab` downloaded from EAS.
6. Resolve every Play Console error; review warnings with an owner rather than ignoring them.
7. Confirm Play App Signing enrollment and certificates.
8. Add release notes.
9. Save and roll out the internal-testing release.
10. Add internal testers and verify installation from the Play opt-in link.
11. Run the full physical-device QA matrix against the Play-delivered build.

Do not upload an APK to production. Google Play production releases should use the AAB artifact.

## 13. Optional EAS Submit After The First Manual Upload

After the first manual Play Console upload and Google Play API/service-account setup, later builds may be submitted with EAS Submit.

```powershell
cd "E:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"
npx.cmd eas-cli@latest submit --platform android --profile production --latest
```

Alternatively, build and submit in one workflow only after the release process is proven:

```powershell
npx.cmd eas-cli@latest build --platform android --profile production --auto-submit
```

- [ ] The Play service account is linked to the correct Play Console developer account.
- [ ] The service account has least-privilege release permissions.
- [ ] Submission targets the intended testing track, not production by accident.
- [ ] A human still reviews Play Console warnings, release notes, countries, and rollout settings.

Do not add a local service-account path to `eas.json` unless the team intentionally adopts and secures that workflow. Prefer managed credentials/secrets in CI.

## 14. Promotion And Production Rollout

- [ ] Internal testing is complete.
- [ ] Closed testing is complete when required by account policy or release risk.
- [ ] Pre-launch report issues are reviewed.
- [ ] Android vitals show no blocking crashes or ANRs.
- [ ] Backend capacity, storage, notification delivery, and support coverage are ready.
- [ ] Release notes and rollout countries are approved.
- [ ] Start with a staged production rollout rather than immediate 100% availability.
- [ ] Suggested stages: 5% → 20% → 50% → 100%, pausing between stages long enough to review real usage.
- [ ] Define rollback/roll-forward ownership before the first production stage.

Monitor during rollout:

- Google Play Android vitals, crashes, and ANRs.
- Sentry errors, release health, and affected users.
- Clerk sign-in and account-sync failures.
- API latency, `401`, `403`, `409`, `422`, and `5xx` rates.
- Push registration and notification delivery failures.
- Upload/proof failures.
- Delivery assignment, COD, return, and wallet support tickets.

Stop or pause rollout for authentication lockouts, data exposure, corrupted workflow state, widespread crashes, broken push routing, or inability to complete delivery/COD proof.

## 15. Versioning And Later Releases

- [ ] Bump `expo.version` for each user-facing semantic release.
- [ ] Let EAS remote versioning auto-increment the Android version code.
- [ ] Never reuse an uploaded version code.
- [ ] Update `EXPO_PUBLIC_DELIVERY_MIN_ANDROID_VERSION_CODE` only after the replacement build is approved and broadly available.
- [ ] Keep the API backward-compatible with the previous supported mobile version during rollout.
- [ ] Repeat automated, AAB inspection, physical-device, policy, and staged-rollout gates for every release.
- [ ] Record release date, owner, build ID, version, version code, Play track, rollout percentage, and known issues.

## 16. Final Go/No-Go Sign-Off

| Gate | Owner | Evidence | Status |
|---|---|---|---|
| Typecheck, lint, and unit tests | Mobile engineer | Passing July 26 command output | Complete |
| Expo dependency check and Doctor | Mobile engineer | Dependencies current; Doctor 21/21 | Complete |
| Clean prebuild and production JS bundle | Mobile engineer | Passing July 26 command output | Complete |
| Production environment and secrets | Mobile/backend owners | Firebase file configured; Sentry missing | Blocked |
| Production AAB build and inspection | Mobile engineer | EAS quota resets August 1, 2026 | Blocked |
| API/auth/upload/push readiness | Backend owner | Public endpoints return HTTP 522 | Blocked |
| Physical-device QA | QA owner | Device matrix and results | Pending |
| Privacy/Data Safety/app content | Privacy owner | Play Console review | Pending |
| Store listing and countries | Business owner | Approved listing | Pending |
| Internal/closed testing | QA/Play owners | Track report and feedback | Pending |
| Production staged rollout | Release owner | Written approval | Pending |

**Release decision:** `NO-GO` until every required row is complete. Local code/configuration gates pass; remaining blockers are external infrastructure, monitoring credentials, signed cloud build, physical-device QA, and Play Console work.

Release owner: ____________________  Date: ____________________

QA owner: _________________________  Date: ____________________

Backend owner: ____________________  Date: ____________________

Business owner: ___________________  Date: ____________________

## 17. Official References

- Google Play: Create and set up an app — <https://support.google.com/googleplay/android-developer/answer/9859152>
- Google Play target API requirements — <https://developer.android.com/google/play/requirements/target-sdk>
- New personal developer account testing requirement — <https://support.google.com/googleplay/android-developer/answer/14151465>
- Google Play store listing assets — <https://support.google.com/googleplay/android-developer/answer/9866151>
- Expo EAS Build setup — <https://docs.expo.dev/build/setup/>
- Expo Android AAB/APK guidance — <https://docs.expo.dev/build-reference/apk/>
- Expo EAS Submit for Android — <https://docs.expo.dev/submit/android/>
