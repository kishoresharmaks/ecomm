# Mobile Customer Service Razorpay QA

Last updated: 2026-07-07

## What Was Implemented

- Mobile service booking payments now support Razorpay from the booking detail screen.
- The app creates or reuses the backend Razorpay provider order, opens native Razorpay Checkout, verifies on the API, and refreshes the booking.
- If Razorpay succeeds but API verification fails because of network/server timeout, the app stores the Razorpay checkout response in SecureStore and shows a verification-pending recovery flow instead of starting another payment.
- Service payment rows now support:
  - `Pay now` for pending Razorpay payments.
  - `Retry payment` for failed Razorpay payments.
  - `Verify payment` when Razorpay returned success but backend verification is still pending.
  - `Confirm cash paid` / `Dispute cash` for provider-cash service collections.
- Backend service provider-order creation now rejects stale payment attempts when the booking has no balance or the payment amount is obsolete.
- Backend service provider-order creation now sends a Razorpay idempotency header based on the service payment id.

## Payment Modes Coverage

Yes, advance payment and inspection-fee payments are covered, as long as the backend creates a pending `RAZORPAY` service payment row.

Backend behavior confirmed:

- `FULL_PAYMENT`
  - Initial payment purpose: `FULL_PAYMENT`.
  - Initial amount: full service payable amount.
  - Provider: `RAZORPAY`.
  - Mobile action: `Pay now` / `Retry payment`.

- `ADVANCE_PAYMENT`
  - Initial payment purpose: `ADVANCE_PAYMENT`.
  - Initial amount: listing advance amount.
  - Provider: `RAZORPAY`.
  - Mobile action: `Pay now` / `Retry payment`.

- `INSPECTION_FEE`
  - Initial payment purpose: `INSPECTION_FEE`.
  - Initial amount: listing inspection fee.
  - Provider: `RAZORPAY`.
  - Mobile action: `Pay now` / `Retry payment`.
  - If a final quote is later accepted and balance is due, backend creates a `FINAL_QUOTE` payment row. Mobile can pay that too when provider is `RAZORPAY`.

- `PAY_AT_VISIT`
  - Initial online Razorpay payment is not created.
  - Backend uses manual/offline/provider-cash style records.
  - Mobile supports customer confirmation/dispute when a provider-cash collection is recorded.

## Verification Already Run

- `pnpm.cmd --filter @indihub/mobile-customer typecheck` passed.
- `pnpm.cmd --filter @indihub/mobile-customer lint` passed.
- `pnpm.cmd --filter @indihub/mobile-customer test` passed: 23 files, 79 tests.
- `pnpm.cmd --filter @indihub/api typecheck` passed.
- `pnpm.cmd --filter @indihub/api lint` passed.
- `pnpm.cmd --filter @indihub/api test` passed: 55 files passed, 1 skipped, 283 tests passed.

## Manual QA Setup

Required:

- API running with Razorpay test mode enabled.
- Valid Razorpay test `key_id` and `key_secret` configured from admin payment settings or env.
- Mobile customer app running in a native/dev/preview build that includes `react-native-razorpay`.
- A signed-in customer account.
- Test service listings for:
  - Full payment.
  - Advance payment.
  - Inspection fee.
  - Quote-first with final quote.
  - Pay at visit.

Do not use a plain Expo Go build if the Razorpay native module is unavailable.

## Manual QA Checklist

### 1. Full Payment Service

1. Create or open a `FULL_PAYMENT` service listing.
2. Book the service from mobile customer.
3. Open `Account > Service bookings > booking detail`.
4. Confirm the payment row shows:
   - Provider: `RAZORPAY`
   - Purpose: `FULL_PAYMENT`
   - Status: `pending`
   - Button: `Pay now`
5. Tap `Pay now`.
6. Complete Razorpay test payment.
7. Expected:
   - Booking refreshes.
   - Payment status becomes `paid`.
   - Paid amount updates.
   - `Pay now` disappears.

### 2. Advance Payment Service

1. Create or open an `ADVANCE_PAYMENT` service listing with an advance amount.
2. Book the service.
3. Open booking detail.
4. Confirm payment row shows purpose `ADVANCE_PAYMENT`.
5. Complete Razorpay payment.
6. Expected:
   - Advance payment becomes `paid`.
   - Paid amount equals advance amount.
   - Remaining balance is not charged unless a later payment row exists.

### 3. Inspection Fee Service

1. Create or open an `INSPECTION_FEE` service listing with inspection fee.
2. Book the service.
3. Open booking detail.
4. Confirm payment row shows purpose `INSPECTION_FEE`.
5. Complete Razorpay payment.
6. Expected:
   - Inspection fee payment becomes `paid`.
   - Booking paid amount equals inspection fee.
   - If the provider later sends a quote and customer accepts it, a `FINAL_QUOTE` payment row appears for remaining due amount.

### 4. Final Quote Payment

1. Use a quote-first/inspection booking.
2. Have seller/provider send a quote.
3. Accept the quote as customer.
4. Open booking detail.
5. Confirm new payment row shows purpose `FINAL_QUOTE` and provider `RAZORPAY`, unless the service is `PAY_AT_VISIT`.
6. Complete payment.
7. Expected:
   - Final quote payment becomes `paid`.
   - Paid amount updates to match total due.

### 5. Pay At Visit

1. Create or open a `PAY_AT_VISIT` service listing.
2. Book the service.
3. Confirm no Razorpay `Pay now` action appears for initial payment.
4. Have provider record cash collection.
5. Open booking detail.
6. Expected:
   - Payment row shows provider-cash state.
   - Customer can tap `Confirm cash paid`.
   - Customer can tap `Dispute cash` and submit a reason.

### 6. Razorpay Cancel / Retry

1. Open any pending Razorpay service payment.
2. Tap `Pay now`.
3. Dismiss/cancel Razorpay checkout.
4. Expected:
   - Booking remains pending.
   - Retry action remains available.
   - No duplicate payment row is created.

### 7. Razorpay Success But Verification Interrupted

1. Start a Razorpay service payment.
2. Complete payment in Razorpay.
3. Immediately simulate network loss or kill the app before verification completes.
4. Reopen the same booking detail.
5. Expected:
   - App shows verification-pending recovery state.
   - Button says `Verify payment`.
   - App does not immediately start a new Razorpay checkout.
   - Tapping `Verify payment` completes backend verification if the provider payment is captured.

### 8. Double Tap Protection

1. On a pending service Razorpay payment, rapidly tap `Pay now`.
2. Expected:
   - Only one checkout flow opens.
   - Backend reuses/locks one provider order.
   - No duplicate Razorpay provider order or duplicate service payment row appears.

### 9. Stale Balance Protection

1. Open the same booking on two devices or two app sessions.
2. Pay from one session.
3. Try paying from stale second session.
4. Expected:
   - Backend rejects stale/obsolete payment attempt.
   - Mobile refreshes booking/error state.
   - No second charge is created.

## Known Limits

- The code gates pass, but native Razorpay sheet behavior must be checked manually on a real native build.
- Real Razorpay test success depends on valid Razorpay test keys and app build configuration.
- If webhook delivery is delayed, backend verification from the mobile checkout response should still update payment state.

## Security Note

The Codex auth token appeared in IDE/chat context earlier. Rotate/regenerate that token outside this code change.
