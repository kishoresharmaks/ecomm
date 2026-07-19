# Play Store Release Checklist — 1HandIndia Mobile Apps

Covers all three Expo apps in this monorepo:

| App | Package | Slug |
|---|---|---|
| Customer | `com.onehandindia.customer` | `onehandindia-customer` |
| Delivery | `com.onehandindia.delivery` | `onehandindia-delivery` |
| Seller | `com.onehandindia.seller` | `onehandindia-seller` |

Work through Part 1 once, then Part 2 per app, then Part 3 per release.

---

## Part 1 — One-time security cleanup (do FIRST, before any release)

- [ ] **Commit the delivery-app fixes** currently in the working tree (`git status` shows them under `apps/mobile-delivery/`).
- [ ] **Purge keystores from git history.** Four `.jks` files were tracked in git (now untracked but still in history):
  ```bash
  git commit -m "chore: untrack Android keystores"
  pip install git-filter-repo
  git filter-repo --path-glob "*.jks" --invert-paths --force
  git push --force --all   # coordinate with anyone who has clones first
  ```
- [ ] **Rotate signing keys.** Treat the leaked keystores as dead. Since no app is published yet, generate fresh keystores per app with `eas credentials` (choose "Set up a new keystore") and enroll in **Play App Signing** when creating each Play Console listing — Google then holds the release key and a leaked upload key can be reset without losing the app.
- [ ] **Move the Firebase Admin SDK key out of the repo folder.** `apps/mobile-customer/onehandindia-firebase-adminsdk-*.json` is a **server-side admin credential** sitting in a mobile app directory. It is not git-tracked, but it must never ship in a build or be committed. Move it to a secrets manager (or at minimum outside the repo), and rotate it in the Firebase console since it has been sitting on developer machines.
- [ ] **Confirm `google-services.json` strategy.** Each app's `google-services.json` is gitignored, so EAS cloud builds (which build from git) will not see it. For each app, upload it as an EAS file secret:
  ```bash
  eas env:create --environment production --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file --scope project
  ```
  and make sure `app.config.js` reads `process.env.GOOGLE_SERVICES_JSON` (delivery already does; verify customer/seller).

---

## Part 2 — Per-app pre-release checks (repeat for each of the 3 apps)

### 2.1 Code health
- [ ] `npx tsc --noEmit` passes (delivery: ✅ clean as of 2026-07-18)
- [ ] `npx eslint .` passes (delivery: ✅)
- [ ] `npm test` passes (delivery: ✅ 5/5)
- [ ] All `expo-*` dependencies match the app's Expo SDK major version (`npx expo install --check`). Delivery had a mismatched `expo-web-browser@57` — fixed. Check customer and seller.
- [ ] No hardcoded fallback secrets/keys in code — a missing env var should fail loudly. (Delivery's hardcoded Clerk key fallback was removed; check customer/seller for the same pattern.)

### 2.2 Permissions & store policy
- [ ] Every Android permission and iOS `UIBackgroundModes` entry in `app.config.js` maps to a feature that actually exists in the code. Google rejects or flags apps declaring `ACCESS_BACKGROUND_LOCATION` without in-app justification and a policy declaration. (Delivery: background-location permissions removed and blocked; check customer/seller for unused permissions.)
- [ ] If any app truly uses background location later: complete the Play Console **Location permissions declaration**, add an in-app prominent disclosure dialog, and record a demo video for review.
- [ ] Camera/photos/notification permission strings are user-friendly and accurate.

### 2.3 Versioning
- [ ] `eas.json` production profile has `autoIncrement: true` and `cli.appVersionSource: "remote"` (delivery: ✅).
- [ ] Any in-app version gate reads the **native** build number (`expo-application`'s `nativeBuildVersion`), not `Constants.expoConfig` (delivery: ✅ fixed; check if customer/seller have gates).
- [ ] Set `version` in `app.config.js` to the marketing version you want on the listing (e.g. `1.0.0`).

### 2.4 Environment & services
- [ ] All `EXPO_PUBLIC_*` values in `eas.json` production profile point to production URLs.
- [ ] Sentry configured per app (delivery still needs these set):
  ```bash
  eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "<dsn>"
  eas env:create --environment production --name SENTRY_ORG --value "<org>"
  eas env:create --environment production --name SENTRY_PROJECT --value "<project>"
  eas env:create --environment production --name SENTRY_AUTH_TOKEN --value "<token>" --type secret
  ```
  Repeat with `--environment preview` where relevant.
- [ ] Push notifications: `expo-notifications` is in plugins, but verify there is actual push-token registration code calling your API. Delivery currently has **none** — either wire it up or accept launch without push.
- [ ] Clerk production instance: publishable key set via env in every profile; production domain verified in the Clerk dashboard; Google OAuth redirect URLs include the app schemes.

### 2.5 Backend readiness
- [ ] Production API (`api.1handindia.com`) deployed with the endpoints each app calls; run the API integration test suite.
- [ ] Razorpay Smart Collect (COD handover for delivery partners) live-mode webhooks configured and tested.
- [ ] Rate limiting / abuse protection on auth endpoints.

### 2.6 Manual QA on a real Android device (per app)
- [ ] Fresh install → sign in (email + Google SSO) → sign out → sign in again.
- [ ] Kill the app mid-session, reopen — session restores without forced logout.
- [ ] Airplane-mode test: every screen shows a readable error and a retry path, not a blank screen or crash.
- [ ] Delivery-specific: accept assignment → progress statuses → upload proof → record COD → verify forms don't lose typed input while a background refresh happens (fixed; verify on device).
- [ ] Deep links / app scheme (`onehandindia-*://`) open correctly, including the SSO callback.

---

## Part 3 — Play Store submission, step by step (per app)

### Step 1 — Play Console setup (first time only)
1. Create the app in [Play Console](https://play.google.com/console) (₹ one-time $25 developer fee already paid presumably).
2. **App content** section — complete ALL of: privacy policy URL (must be live on 1handindia.com), ads declaration (No), app access (provide a **demo login** for reviewers — Clerk test account with DELIVERY_PARTNER / SELLER role as applicable), content rating questionnaire, target audience (18+ for delivery/seller work apps), data safety form.
3. **Data safety form** — declare: email/phone/name (account), precise location (delivery app: while-in-use only, for delivery operations), photos (proof uploads), and Sentry crash data. Declare encryption in transit and account deletion path.
4. Store listing: title, short + full description, icon 512×512, feature graphic 1024×500, at least 4 phone screenshots (take from the preview build).
5. Enroll in **Play App Signing** when prompted for the first upload.

### Step 2 — Build
```bash
cd apps/<app>
npx expo install --check          # verify SDK alignment
eas build --profile production --platform android   # produces .aab
```
(Ensure keystore credentials were freshly generated in Part 1 — `eas credentials` to inspect.)

### Step 3 — Internal testing track
1. Upload the `.aab` to **Internal testing** (or use `eas submit --platform android --latest` after configuring a Play service account key).
2. Add tester email lists (your team + a couple of real delivery partners / sellers).
3. Test the *store-installed* build for 2–3 days — Play-delivered builds behave differently from dev builds (ProGuard, signing, no dev client).
4. Watch Sentry for crashes during this window.

### Step 4 — Closed testing (required for new personal accounts)
> If the Play developer account was created after Nov 2023 as a personal account, Google **requires 12+ testers opted in for 14 continuous days** on Closed testing before production access is granted. Organization accounts skip this. Budget for it in the timeline.

### Step 5 — Production rollout
1. Promote the tested release to **Production** with a **staged rollout at 10%**.
2. Monitor for 48h: Sentry crash-free rate, Play Console ANR/crash vitals, partner complaints.
3. Increase 10% → 50% → 100% over ~a week if healthy.
4. Only after 100% + stable: raise `EXPO_PUBLIC_DELIVERY_MIN_ANDROID_VERSION_CODE` if you need to force-retire old builds (the version gate now reads the real native versionCode, so this is safe).

### Step 6 — Post-launch
- [ ] Tag the release in git (`git tag delivery-v1.0.0 && git push --tags`).
- [ ] Record the Play App Signing certificate SHA-256 in Firebase (for Google sign-in) — the *Play-signed* certificate differs from your upload key.
- [ ] Set up Play Console email alerts for vitals thresholds.
- [ ] Document the rollout in this file (date, versionCode, notable issues).

---

## Suggested order of app launches

1. **Delivery** — smallest user base (your own partners), all 18 audit bugs now fixed; use it to shake out the release pipeline.
2. **Seller** — has its own `PRODUCTION_CHECKLIST.md`; reconcile it with this document first.
3. **Customer** — largest audience, launch last once API + payments are proven under real load.

## Known gaps accepted for delivery v1 (revisit later)

- No push-notification token registration (notifications configured but inert).
- No live location tracking (dead queue code was removed; permissions were pared back to match — re-add both together, with the Play policy declaration, as a planned feature).
- Mutations are `retry: 0` with no offline queue — flaky-network UX relies on manual retry.
- Test coverage is thin (5 tests); auth context and API retry logic are untested.
