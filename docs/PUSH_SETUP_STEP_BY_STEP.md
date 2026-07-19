# Push Notifications — Operational Setup Guide (Code is DONE, this is the rest)

**Status:** All code is implemented, tested, and committed for all three apps
(customer, seller, delivery — commits `2f61810` + `28d1406`). Nothing in this
guide requires writing code. It is the external configuration — Firebase, Expo/EAS,
database, and verification — needed before a real device receives a notification.

**Follow the parts in order.** Estimated total time: 1–2 hours (+ build time).

The three apps:

| App | Package name | Expo slug | EAS projectId |
|---|---|---|---|
| Customer | `com.onehandindia.customer` | `onehandindia-customer` | `beab5054-3e1d-46a5-aeb0-11767e1bbdb0` |
| Seller | `com.onehandindia.seller` | `onehandindia-seller` | `e017cb61-41d7-4e0f-9268-573106ddd729` |
| Delivery | `com.onehandindia.delivery` | `onehandindia-delivery` | `9e885388-f7f2-4ca6-bfec-0cbbc58eebb8` |

How a push flows (so the steps below make sense):

```
API server ──POST──▶ Expo Push API (exp.host) ──▶ FCM (Google) ──▶ Android device
                          ▲
                          │ needs: FCM service-account key uploaded to EACH Expo project
                          │ (this is Part 2 — the step most often missed)
```

The API server itself needs **no Firebase credentials** — it only talks to Expo.

---

## Part 0 — Database (5 minutes, do first)

The delivery push code needs its table and regenerated Prisma client.

```bash
cd "e:\PROJECT WORKS\Clients\ecomm"

# 1. Regenerate the Prisma client (adds prisma.client.deliveryPushToken)
pnpm db:generate

# 2. Apply the migration to your database (creates delivery_push_tokens table)
#    Requires DATABASE_URL in your environment / .env
pnpm db:migrate

# 3. Confirm the API now typechecks clean (5 errors disappear)
cd apps/api && npm run typecheck
```

For the **production** database, apply the migration during your next deploy
(`prisma migrate deploy` in your release pipeline, or however previous
migrations reached production).

Push the commits if you haven't:

```bash
git push
```

---

## Part 1 — Firebase Console (15 minutes)

Push on Android goes through FCM, so each app must be registered in Firebase.
All three apps can (and should) live in ONE Firebase project.

1. Open https://console.firebase.google.com and select your existing project
   (the one whose `google-services.json` files are already in each app folder).
   If you don't have one: **Add project** → name it `onehandindia` → disable
   Analytics (not needed) → Create.

2. Check which Android apps are already registered: **Project settings (gear
   icon) → General → Your apps**. You need all three package names listed:
   - `com.onehandindia.customer`
   - `com.onehandindia.seller`
   - `com.onehandindia.delivery`

3. For any missing app: **Add app → Android**, enter the package name exactly,
   nickname it (e.g. "Delivery"), skip the SHA-1 for now → **Register app** →
   **Download google-services.json** → place it at the ROOT of that app's
   folder (e.g. `apps/mobile-delivery/google-services.json`). Skip the
   remaining "add SDK" wizard steps — Expo handles that.

   > All three apps already have a `google-services.json` on disk. Open each and
   > verify the `package_name` inside matches the app's package above. A file
   > copied from another app will build fine but silently break FCM.

4. Generate the **service-account key** Expo needs to send through FCM:
   **Project settings → Service accounts → Firebase Admin SDK → Generate new
   private key** → Confirm. A JSON file downloads.

   ⚠️ **Handle this file like a password:**
   - Save it OUTSIDE the repo (e.g. `C:\secrets\onehandindia-fcm.json`).
   - Never commit it. (Your `.gitignore` already blocks `*adminsdk*.json` and
     `*service-account*.json` — good.)
   - The old key sitting at `apps/mobile-customer/onehandindia-firebase-adminsdk-*.json`
     should be deleted from disk AND revoked: Google Cloud Console → IAM &
     Admin → Service Accounts → `firebase-adminsdk-...` → Keys → delete the
     old key ID.

---

## Part 2 — Upload the FCM key to Expo (10 minutes) ← THE CRITICAL STEP

Expo relays your pushes to FCM using this key. **Each of the three Expo
projects needs it** (they are separate projects; the same key file works for
all three because they share the Firebase project).

Log in as the Expo account that owns the projects first: `npx expo whoami`
(log in with `npx expo login` if needed).

For **each** app directory (`apps/mobile-customer`, `apps/mobile-seller`,
`apps/mobile-delivery`):

```bash
cd "e:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"   # repeat per app
eas credentials
```

In the interactive menu:

1. Platform: **Android**
2. Build profile: **production** (repeat later for **preview** if you want push
   in preview builds — recommended, since that's what you test with)
3. Choose **Google Service Account**
4. Choose **Manage your Google Service Account Key for Push Notifications (FCM V1)**
5. Choose **Set up a Google Service Account Key** → **Upload a new key** →
   give it the path to the JSON you saved in Part 1 (e.g. `C:\secrets\onehandindia-fcm.json`)
6. Exit the menu.

Verify: rerun `eas credentials` → Android → production → Google Service
Account — it should now show the key as configured.

> **Symptom if you skip this:** everything works in code, tokens register in
> your DB, Expo accepts the send, and the device receives nothing (or Expo
> returns `InvalidCredentials`/`DeviceNotRegistered` errors in `notification_logs`).

---

## Part 3 — Make google-services.json available to EAS builds (10 minutes)

The file is gitignored and EAS builds from git, so cloud builds won't have it
unless you provide it as a **file environment variable**. Each app has its own
file — don't mix them up.

For **each** app directory:

```bash
cd "e:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"   # repeat per app

eas env:create --environment production --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file --visibility secret
eas env:create --environment preview    --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file --visibility secret
eas env:create --environment development --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file --visibility secret
```

Verify per app: `eas env:list --environment production` shows `GOOGLE_SERVICES_JSON`.

All three `app.config.js` files already resolve
`process.env.GOOGLE_SERVICES_JSON` with a local-file fallback, so no config
change is needed.

---

## Part 4 — Android notification icon & channel sanity (already done — just verify)

Nothing to do here normally; verify once per app:

- `app.config.js` → `expo-notifications` plugin exists with a `defaultChannel`
  matching the code: `customer-alerts` / `seller-alerts` / `delivery-alerts`. ✅ (all three configured)
- The plugin `icon` is set (used as the small status-bar icon). ✅
- `POST_NOTIFICATIONS` permission declared (Android 13+ prompt). ✅ all three.

---

## Part 5 — Build and install a test build (30–60 min, mostly waiting)

Push does NOT work in Expo Go or on emulators without Google Play. You need a
**preview (or production) build on a physical Android device**.

For the app you want to test (start with **seller or customer** — they were
already battle-tested; then delivery):

```bash
cd "e:\PROJECT WORKS\Clients\ecomm\apps\mobile-delivery"
eas build --profile preview --platform android
```

When the build finishes, install the APK on a real Android phone (download
link/QR from the EAS build page), sign in with a real account of the right
role (delivery partner / seller / customer).

Accept the notification permission prompt when it appears.

---

## Part 6 — Verification checklist (15 minutes per app)

### 6.1 Token registered?

After signing in on the device, check the DB (psql / Prisma Studio / your DB tool):

```sql
-- delivery app
SELECT token, platform, enabled, last_seen_at FROM delivery_push_tokens ORDER BY created_at DESC LIMIT 5;
-- seller app
SELECT token, platform, enabled FROM seller_push_tokens ORDER BY created_at DESC LIMIT 5;
-- customer app
SELECT token, platform, enabled FROM customer_push_tokens ORDER BY created_at DESC LIMIT 5;
```

You should see a row with `enabled = true` and a token like `ExponentPushToken[xxxxxxxx]`.

❌ No row? → the app-side state will tell you why. The hooks expose it:
permission denied, Expo Go, emulator, or API failure (check API logs for
`POST /delivery/push-tokens`).

### 6.2 Raw send works? (bypasses your backend — isolates Expo/FCM config)

Copy the token from 6.1 and run (any machine, no auth needed):

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"ExponentPushToken[PASTE-HERE]\",\"title\":\"Test\",\"body\":\"Hello from setup\",\"channelId\":\"delivery-alerts\"}"
```

(Use the channel matching the app: `customer-alerts` / `seller-alerts` / `delivery-alerts`.)

- Notification arrives on the phone → **Parts 1–3 are correct.** Continue.
- Response contains `"status":"error"`:
  - `InvalidCredentials` → Part 2 key not uploaded to THIS app's Expo project.
  - `DeviceNotRegistered` → wrong `google-services.json` package (Part 1.3) or
    the build predates Part 3 — rebuild and retry.

### 6.3 End-to-end domain event?

Trigger the real event from the admin panel / apps:

| App | Trigger | Expected notification → tap opens |
|---|---|---|
| Delivery | Admin assigns an order to the test partner | "New delivery assigned" → order detail screen |
| Delivery | Admin assigns a return pickup | "Return pickup assigned" → return detail screen |
| Seller | Place a test order containing that seller's product | "New order received" → order screen |
| Customer | Place a test order as that customer | "Order placed" → order screen |

Test the tap in three app states: foreground, backgrounded, and fully killed —
all three routes are implemented.

Then confirm the server recorded it:

```sql
SELECT event_code, status, error_message, sent_at
FROM notification_logs
WHERE channel = 'PUSH'
ORDER BY created_at DESC LIMIT 10;
```

`status = SENT` with a `provider_message_id` → done.

### 6.4 Sign-out revokes?

Sign out in the app → the token row should get `enabled = false` and a
`revoked_at` timestamp. Re-run the 6.2 curl → nothing should arrive.

### 6.5 Dead-token hygiene?

Uninstall the app from the phone → trigger a domain event → the send fails with
DeviceNotRegistered and the backend automatically sets `enabled = false` on
that token. Verify in the token table. (This prevents log spam forever after.)

---

## Part 7 — Production rollout notes

- **Repeat nothing per release** — Parts 1–3 are one-time. New builds
  automatically use the stored credentials.
- **iOS later:** when you ship iOS, run `eas credentials` → iOS → Push
  Notifications → let EAS create/manage the APNs key. Zero code changes.
- **Play Console Data safety** (all three apps): declare *Device or other IDs*
  (push token) — collected, linked to account, not shared, encrypted in transit.
- **Expo access token (optional hardening):** if you enable "Enhanced push
  security" in the Expo dashboard, sends require an auth header. The current
  code doesn't send one, so leave that feature OFF unless you also add
  `Authorization: Bearer <EXPO_ACCESS_TOKEN>` to `ExpoPushService` (one-line
  change — ask when needed).
- **Volume:** current implementation sends one HTTP request per token, fine for
  launch. Past ~100 recipients per event, batch up to 100 messages per request
  to `exp.host/--/api/v2/push/send` (code change in `ExpoPushService`).
- **Receipts (later):** Expo ticket IDs are stored as `provider_message_id`.
  A worker cron calling `/--/api/v2/push/getReceipts` would catch FCM-level
  failures that tickets don't show. Not needed at launch volume.

---

## Quick reference — what lives where

| Thing | Location |
|---|---|
| FCM service-account key | Expo servers (per project, via `eas credentials`) + your secrets store |
| `google-services.json` | App folder locally (gitignored) + EAS file env var |
| Push tokens | `customer_push_tokens` / `seller_push_tokens` / `delivery_push_tokens` tables |
| Send + delivery logs | `notification_logs` table (`channel = 'PUSH'`) |
| Send code | `apps/api/src/notifications/expo-push.service.ts` |
| Register/revoke endpoints | `/customer/push-tokens` · `/seller/push-tokens` · `/delivery/push-tokens` |
| Client hooks | `use-customer-push-notifications.ts` / `use-seller-push-notifications.ts` / `use-delivery-push-notifications.ts` |
| Channels | `customer-alerts` / `seller-alerts` / `delivery-alerts` (must stay in sync in 3 places: app.config.js, hook, ExpoPushService) |

## Troubleshooting quick table

| Symptom | Cause | Fix |
|---|---|---|
| No permission prompt on Android 13+ | Old build without POST_NOTIFICATIONS | Rebuild after Part 3 |
| Token registers, nothing arrives | FCM key not on this Expo project | Part 2 for that app |
| `InvalidCredentials` from curl | Same as above | Part 2 |
| `DeviceNotRegistered` immediately | Wrong google-services.json package / stale build | Part 1.3 + rebuild |
| Works in preview, not production build | Env vars only set for preview | Part 3 production environment |
| notification_logs stuck PENDING | API can't reach exp.host | Server egress/firewall |
| Tap opens app but wrong screen | Payload `data` malformed | Falls back to dashboard by design; check event wiring |
