# Push Notifications Setup — All Three Mobile Apps

This document covers the complete push notification setup for the three Expo apps
(customer, seller, delivery). It is based on what already exists in this repo —
**customer and seller are already fully implemented end-to-end; only the delivery
app is missing its implementation** — so Part 3 is the main work item.

Architecture used by all three apps (already proven in customer/seller):

```
App (expo-notifications)                       API (NestJS)                      Expo Push Service
────────────────────────                       ────────────                      ─────────────────
getExpoPushTokenAsync()  ──register token──▶  POST /<role>/push-tokens  ──┐
                                              stores in *PushToken table  │
                                                                          │
Domain event (order assigned, etc.) ──▶ ExpoPushService.notifyX() ──POST──▶ exp.host/--/api/v2/push/send
                                        logs to notificationLog                     │
                                        auto-revokes dead tokens                    ▼
                                                                          FCM (Android) / APNs (iOS)
                                                                                    │
App: addNotificationResponseReceivedListener ◀──────── tap opens deep link ◀────────┘
```

The backend talks only to **Expo's push API** (`apps/api/src/notifications/expo-push.service.ts`);
Expo relays to FCM/APNs. This means the server needs **no** Firebase Admin SDK for
push — FCM credentials live in the **Expo project**, not in API code.

> The `onehandindia-firebase-adminsdk-*.json` file found in `apps/mobile-customer/`
> is NOT needed for this architecture. Remove and rotate it (see release checklist Part 1).

---

## Part 1 — Current state (verified 2026-07-18)

| Piece | Customer | Seller | Delivery |
|---|---|---|---|
| `expo-notifications` plugin in app.config.js | ✅ (`customer-alerts`) | ✅ (`seller-alerts`) | ✅ (`delivery-alerts`) — configured but unused |
| Client registration hook | ✅ `use-customer-push-notifications.ts` | ✅ `use-seller-push-notifications.ts` (+ test) | ❌ missing |
| DB token model (prisma/schema.prisma) | ✅ `CustomerPushToken` | ✅ `SellerPushToken` | ❌ missing |
| API register/revoke endpoints | ✅ `customers.controller.ts` | ✅ `seller-push.controller.ts` | ❌ missing |
| Backend send path | ✅ `ExpoPushService.notifyCustomer` | ✅ `ExpoPushService.notifySeller` | ❌ missing |
| Notification tap → deep link routing | ✅ `customer-notification-routing.ts` | ✅ | ❌ missing |
| `google-services.json` present locally | ✅ | ✅ | ❌ verify — file was not present |

---

## Part 2 — Firebase / credential setup (once per app)

Expo push on Android requires each app to be registered in Firebase and its
**FCM V1 service account key** uploaded to the Expo project. Do this for each of
the three Expo projects (each app has its own `slug` + EAS `projectId`).

### 2.1 Firebase console

1. In the [Firebase console](https://console.firebase.google.com), use one project
   (e.g. `onehandindia`) and add **three Android apps** to it, one per package name:
   - `com.onehandindia.customer`
   - `com.onehandindia.seller`
   - `com.onehandindia.delivery`
2. For each, download the app-specific `google-services.json` into the matching
   `apps/mobile-*/` directory. The file is gitignored — that is correct.
3. After Play launch: add each app's **Play App Signing SHA-256** certificate in
   Firebase (Project settings → your app → Add fingerprint). Without this, Google
   sign-in and some FCM features break on the Play-delivered build.

### 2.2 Upload FCM credentials to Expo (per app)

```bash
cd apps/mobile-customer   # then repeat in mobile-seller, mobile-delivery
eas credentials
# → Android → <production build profile> → Google Service Account
# → "Manage your Google Service Account Key for Push Notifications (FCM V1)"
# → upload the service-account JSON from Firebase project settings → Service accounts
```

The FCM V1 service account JSON is generated in Firebase console → Project
settings → Service accounts → "Generate new private key". One key can serve all
three apps since they share a Firebase project — upload the same key to each
Expo project. **Store this key in your secrets manager; never commit it.**

### 2.3 Make google-services.json available to EAS builds (per app)

The file is gitignored, and EAS builds from git, so each app needs it as a file env var:

```bash
cd apps/<app>
eas env:create --environment production --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file
eas env:create --environment preview    --name GOOGLE_SERVICES_JSON --value ./google-services.json --type file
```

Each `app.config.js` must resolve it (delivery already does this — copy the same
pattern to customer/seller if absent):

```js
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);
```

### 2.4 iOS (when you ship iOS)

`eas credentials` → iOS → Push Notifications key: let EAS generate/manage the
APNs key on your Apple Developer account. No code changes needed.

---

## Part 3 — Implement delivery-app push (the missing piece)

Mirror the seller implementation — same table shape, same endpoints, same hook.
Reference files: `prisma/schema.prisma:1495` (SellerPushToken),
`apps/api/src/sellers/seller-push.controller.ts`,
`apps/mobile-seller/src/features/seller/use-seller-push-notifications.ts`.

### 3.1 Database — add `DeliveryPushToken` to `prisma/schema.prisma`

```prisma
model DeliveryPushToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  token      String    @unique
  platform   String
  deviceId   String?   @map("device_id")
  appVersion String?   @map("app_version")
  enabled    Boolean   @default(true)
  lastSeenAt DateTime  @default(now()) @map("last_seen_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, enabled])
  @@index([lastSeenAt])
  @@map("delivery_push_tokens")
}
```

(Delivery partners are `User`s with the DELIVERY_PARTNER role — there is no
separate DeliveryPartner entity like Seller, so the token hangs off `userId`
only.) Add the matching relation field on `User`, then:

```bash
npx prisma migrate dev --name add-delivery-push-tokens
```

### 3.2 API — register/revoke endpoints

Create `apps/api/src/orders/delivery-push.controller.ts` (delivery endpoints live
in the orders module), modeled on `seller-push.controller.ts`:

- `POST /delivery/push-tokens` — `@Roles(RoleCode.DELIVERY_PARTNER)`, upserts by
  `token` (update `userId`, `lastSeenAt`, `enabled: true`, `revokedAt: null` on
  conflict — a device can change owners).
- `POST /delivery/push-tokens/revoke` — sets `enabled: false`, `revokedAt: now()`.
  Must be tolerant: revoking an unknown token returns success.

DTOs: copy `RegisterSellerPushTokenDto` / `RevokeSellerPushTokenDto`
(`token`, `platform` ("android" | "ios"), optional `deviceId`, `appVersion`).

### 3.3 API — send path

Add to `ExpoPushService` (`apps/api/src/notifications/expo-push.service.ts`):

```ts
export type DeliveryPushPayload = {
  userId: string;         // delivery partner user id
  templateCode: string;
  eventCode: string;
  title: string;
  body: string;
  data: Record<string, string>;   // include e.g. { orderNumber } for deep links
};

async notifyDeliveryPartner(input: DeliveryPushPayload) {
  const tokens = await this.prisma.client.deliveryPushToken.findMany({
    where: { userId: input.userId, enabled: true, revokedAt: null },
  });
  await Promise.allSettled(tokens.map((token) => this.deliverDelivery(input, token)));
}
```

`deliverDelivery` is a copy of the existing seller `deliver` with
`channelId: "delivery-alerts"` (must match the channel in the app's
app.config.js and the client hook) and the DeviceNotRegistered auto-revoke
pointed at `deliveryPushToken`.

### 3.4 API — wire domain events

Call `notifyDeliveryPartner` where the partner-facing email events already fire
(all in `apps/api/src/orders/orders.service.ts` and returns service):

| Event | Where | Suggested payload data |
|---|---|---|
| Order assigned | `DELIVERY_ASSIGNED_PARTNER` email site (~orders.service.ts:8636) | `{ kind: "order", orderNumber }` |
| Order reassigned/revoked | auto-reassign path | `{ kind: "order", orderNumber }` |
| Return pickup assigned | returns service assignment site | `{ kind: "return", requestNumber }` |
| COD verification result | finance verification path | `{ kind: "wallet" }` |
| Payout processed | wallet payout path | `{ kind: "wallet" }` |

### 3.5 Delivery app — client hook

Create `apps/mobile-delivery/src/features/delivery/use-delivery-push-notifications.ts`
by copying the seller hook (it already handles: Expo Go guard, emulator guard,
Android channel creation, permission request, `getExpoPushTokenAsync` with
projectId, register/revoke API calls, token-rotation revoke, and the
Clerk-token-rotation pitfall documented in the customer hook — key registration
off `authKey`, not the headers object). Changes:

1. Channel id `"delivery-alerts"`, name "Delivery alerts" (matches app.config.js).
2. API module `delivery-push-api.ts` calling `POST /delivery/push-tokens` and
   `/delivery/push-tokens/revoke` via `postNoContent`.
3. Tap routing: create `delivery-notification-routing.ts`:
   - `data.kind === "order"` → `router.push(`/orders/${data.orderNumber}`)`
   - `data.kind === "return"` → `router.push(`/returns/${data.requestNumber}`)`
   - `data.kind === "wallet"` → `router.push("/(tabs)/wallet")`
   - unknown → `/(tabs)` (never crash on malformed data).
4. Mount the hook once in `app/_layout.tsx` inside `DeliveryRouteGate` (it needs
   `useMobileDeliveryAuth()`), gated on `auth.enabled` so registration happens
   only after the partner is approved.
5. On sign-out (auth context `handleUnauthorized` sign-out path and the manual
   sign-out button): call the revoke helper first, best-effort, exactly like
   `revokeCurrentCustomerPushToken()` does for the customer app.

### 3.6 `POST_NOTIFICATIONS` permission

Already declared in delivery's app.config.js. On Android 13+ the runtime prompt
appears when the hook calls `requestPermissionsAsync()` — no extra config.
Handle the "denied" state in the UI: show a card on the profile tab with an
"Enable notifications" button that calls the hook's `refresh()`, and
`Linking.openSettings()` when permanently denied.

---

## Part 4 — Customer & seller apps: verification checklist

Implementation exists; verify configuration before release.

- [ ] `eas credentials` shows an FCM V1 service-account key for **each** Expo
      project (customer, seller, delivery) — this is the most common reason
      "everything is coded but no notification arrives".
- [ ] `GOOGLE_SERVICES_JSON` file env var exists for production AND preview
      profiles in all three apps (`eas env:list --environment production`).
- [ ] Channel ids are consistent per app across the three places they appear:
      app.config.js plugin config, the client `setNotificationChannelAsync`, and
      the server `channelId` in ExpoPushService (`customer-alerts` /
      `seller-alerts` / `delivery-alerts`).
- [ ] Sign-out revokes the token (customer: `revokeCurrentCustomerPushToken`;
      seller: equivalent; delivery: build it per 3.5).
- [ ] Push-token endpoints are covered by the API rate limiter.
- [ ] `notificationLog` table is being written with SENT status in production
      (query it after the first test push).

---

## Part 5 — Testing procedure (per app)

Push cannot be tested in Expo Go or emulators without Google Play services.
Use a **development or preview build on a physical Android device**.

1. **Build & install**: `eas build --profile preview --platform android`, install
   the APK on a real device.
2. **Register**: sign in, accept the permission prompt. Verify a row appears in
   the app's push-token table with `enabled = true`.
3. **Manual send** (bypasses your backend — isolates Expo/FCM config):
   ```bash
   curl -X POST https://exp.host/--/api/v2/push/send \
     -H "Content-Type: application/json" \
     -d '{"to":"ExpoPushToken[xxxx]","title":"Test","body":"Hello","channelId":"delivery-alerts"}'
   ```
   - Received → Expo/FCM credentials are good.
   - `DeviceNotRegistered` → FCM key missing in `eas credentials` or wrong
     google-services.json package name.
4. **End-to-end**: trigger the real domain event (assign an order to the test
   partner from the admin panel) and confirm: notification arrives → tapping it
   deep-links to the right screen → `notificationLog` row is SENT.
5. **Background states**: test tap-routing with the app foregrounded,
   backgrounded, and fully killed (the killed case uses
   `getLastNotificationResponseAsync` — already handled in the hooks).
6. **Revoke**: sign out, verify the token row gets `revokedAt` set, send the
   manual curl again, confirm nothing arrives.
7. **Token hygiene**: uninstall the app, trigger an event, verify the backend
   auto-disables the token (DeviceNotRegistered path) rather than erroring forever.

---

## Part 6 — Production rollout notes

- Expo's push API is free and needs no additional key for sending from the
  server (an Expo access token is only needed if you enable "Enhanced push
  security" in the Expo dashboard — if you do, add
  `Authorization: Bearer ${EXPO_ACCESS_TOKEN}` in `ExpoPushService` and store
  the token as an API env secret).
- Add delivery/receipt monitoring later: Expo returns ticket ids (already stored
  as `providerMessageId`); a follow-up receipt check
  (`/--/api/v2/push/getReceipts`) catches APNs/FCM-level failures. Worth adding
  to the `worker` app as a cron once volume grows.
- Update the Play **Data safety** form for all three apps: "Push notification
  device identifiers" are collected, linked to the account, not shared.
- Batch sends: the current per-token `fetch` is fine at launch volume. Past
  ~100 sends/event, switch to Expo's batch endpoint (up to 100 messages per
  request) inside `ExpoPushService`.

## Suggested execution order

1. Part 2 credential setup for all three apps (unblocks everything, ~30 min).
2. Part 5 test on **seller** (code complete → validates credentials fastest).
3. Part 5 test on **customer**.
4. Part 3 delivery implementation (schema → API → hook → wiring → test).
5. Part 4 checklist sweep + Part 6 data-safety updates before store submission.
