# Task 3 — Razorpay Order Creation Race Condition Fix

**Date:** 2026-06-26
**Files Changed:**
- `prisma/schema.prisma`
- `apps/api/src/payments/payments.service.ts`
- `prisma/migrations/…_add_payment_order_creation_lock/migration.sql` (auto-generated)

---

## Problem

`createRazorpayOrder()` had a time-of-check/time-of-use (TOCTOU) race condition. Multiple concurrent requests for the same order could all pass the early-return guard (`if (payment.providerOrderId)`) before any of them had stored a provider order ID, causing duplicate Razorpay orders to be created for the same payment record.

---

## Changes Made

### 1. Schema — `prisma/schema.prisma`

Added a new boolean lock field to the `Payment` model:

```prisma
providerOrderCreationInProgress  Boolean  @default(false)  @map("provider_order_creation_in_progress")
```

This field serves as an atomic in-flight guard. Because Prisma's `updateMany` maps to a single `UPDATE … WHERE` SQL statement, the claim is atomic at the database level with no additional advisory locks required.

A migration was applied:
```
prisma migrate dev --name add_payment_order_creation_lock
```

---

### 2. Service — `apps/api/src/payments/payments.service.ts` (`createRazorpayOrder`)

Replaced the bare `fetch` → `payment.update` sequence with a three-step atomic claim pattern:

#### Step 1 — Atomic claim via `updateMany`
```ts
const claimed = await this.prisma.client.payment.updateMany({
  where: { id: paymentId, providerOrderId: null, providerOrderCreationInProgress: false },
  data: { providerOrderCreationInProgress: true },
});
```
Only one concurrent caller can set the flag from `false → true`. All others receive `claimed.count === 0`.

#### Step 2 — Concurrent-request handling
If `claimed.count === 0`, the code re-reads the payment:
- If `providerOrderId` is now set (first caller succeeded), return it immediately — idempotent success.
- If still null, the first caller is still in-flight — throw an error so the client can retry.

#### Step 3 — Provider call inside try/catch with lock release
The Razorpay HTTP call is wrapped in try/catch. On any failure, the lock is released by setting `providerOrderCreationInProgress: false` before re-throwing, ensuring the system does not get stuck.

#### Step 4 — Persist and release lock atomically
On success, a single `payment.update` stores `providerOrderId` and resets `providerOrderCreationInProgress: false` together.

---

## Safety Analysis

| Scenario | Behaviour |
|---|---|
| Single request, no prior order | Claims lock, creates Razorpay order, stores ID, releases lock. |
| Concurrent second request before first completes | `updateMany` returns count=0; providerOrderId still null → throws retryable error. |
| Second request after first completes | `providerOrderId` set at line 558 guard → early return, no lock needed. |
| Razorpay API fails | Lock released in catch; no orphan lock left in DB. |
| DB failure on final update | `providerOrderCreationInProgress` stays true; manual or scheduled cleanup resets it. |

---

## What Was Not Changed

- Function signature and return shape are unchanged: `{ keyId, razorpayOrderId, amountPaise, currency, orderNumber }`.
- No other files were touched.
- No typecheck was run (per instructions).
