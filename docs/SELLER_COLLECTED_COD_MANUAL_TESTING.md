# Seller-Collected COD Manual Testing Guide

Last updated: 2026-07-13

## Purpose

Use this document to manually test Store Pickup COD and Manual Transport COD before production release.

The expected business behavior is:

- The customer pays cash to the seller for Store Pickup COD and Manual Transport COD.
- The seller keeps the customer cash.
- The platform opens a seller cash receivable only for the platform-due amount.
- The platform-due amount is recovered from the seller wallet or future payouts.
- The seller must not receive another normal payout for cash already collected.
- COD payment becomes `PAID` only when every active COD collection path for the order is accounted.

## Portal Navigation Map

Customer web:

- Product browsing: `/`
- Cart: `/cart`
- Checkout: `/checkout`
- Checkout success: `/checkout/success/[orderNumber]`
- Customer order list: `/account/orders`
- Customer order detail: `/account/orders/[orderNumber]`

Seller web:

- Seller orders: `/seller/orders`
- Seller order detail: `/seller/orders/[orderNumber]`
- Seller logistics view: `/seller/orders/[orderNumber]/delivery`
- Seller wallet: `/seller/finance/wallet`
- Seller payouts: `/seller/finance/payouts`
- Seller statements: `/seller/finance/statements`

Seller mobile app:

- Orders tab
- Order detail screen
- Delivery mode selector on order detail
- Manual transport COD fields on order detail
- Finance tab

Admin web:

- Admin orders: `/admin/orders`
- Admin order detail: `/admin/orders/[orderNumber]`
- Admin seller COD dues: `/admin/finance/seller-cash-receivables`
- Admin payouts: `/admin/finance/payouts`
- Admin statements: `/admin/finance/statements`
- Admin ledger: `/admin/finance/ledger`
- Admin delivery operations: `/admin/delivery`

Finance workspace:

- Finance login: `/finance/login`
- Finance dashboard: `/finance`
- Seller COD dues: `/finance/seller-cash-receivables`
- Payouts: `/finance/payouts`
- Statements: `/finance/statements`
- Ledger: `/finance/ledger`
- Payment status: `/finance/payment-status`

Delivery partner negative checks:

- Delivery orders: `/delivery/orders`
- Delivery order detail: `/delivery/orders/[orderNumber]`

## Required Test Users

Prepare these users in staging or a disposable local environment:

- Customer user with working address.
- Approved seller A with verified payout profile.
- Approved seller B with verified payout profile.
- Admin user.
- Finance user.
- Delivery partner user for negative mixed-mode checks.

Do not run these tests against a production database unless the release owner explicitly approves it.

## Required Test Data

Prepare products:

- Product A owned by seller A.
- Product B owned by seller B.
- Both products in stock.
- Both products enabled for COD checkout.
- At least one product eligible for Store Pickup.
- At least one product can be routed as Manual Transport.

Prepare settings:

- COD enabled.
- Buyer platform fee enabled, preferably with a value that can create rounding cases.
- Seller payout requests enabled.
- Seller payout profile verified for seller A and seller B.

Capture these values for every order:

| Field | Value |
| --- | --- |
| Order number | |
| Seller | |
| Delivery mode | |
| Payment method | COD |
| Seller subtotal | |
| Shipping charge | |
| COD surcharge | |
| Buyer platform fee allocation | |
| Expected cash collected by seller | |
| Platform due receivable | |
| Receivable number | |
| Payout number | |
| Statement number | |

Expected seller cash formula:

```text
sellerSubtotalPaise
+ shipment.shippingPaise
+ shipment.codSurchargePaise
+ allocatedBuyerPlatformFeePaise
= expectedSellerCashPaise
```

Expected platform due formula:

```text
(seller gross sales - seller net payable)
+ allocatedBuyerPlatformFeePaise
= platformDuePaise
```

## Pass Criteria

The feature passes only if all of these are true:

- Store Pickup COD creates one seller cash receivable when seller marks the package delivered.
- Manual Transport COD creates one seller cash receivable only after seller enters the exact collected amount.
- Repeating the same delivered action does not create duplicate receivables.
- Seller-collected COD order splits are not paid again as normal earnings.
- Future payout deducts open seller cash receivables.
- Partial offset leaves the remaining due open for a later payout.
- Statement exports show seller-collected COD offsets.
- Admin settle and waive actions are blocked while a receivable is linked to a payout.
- Customer payment becomes `PAID` only after all COD collection paths for the order are accounted.

## Test Group A: Configuration And Readiness

### A1 - COD Checkout Is Enabled

Steps:

1. Sign in as admin.
2. Open `/admin/payments` or payment settings if available in the admin sidebar.
3. Confirm Cash on Delivery is enabled.
4. Confirm COD order limit allows the planned test cart.
5. Sign in as customer.
6. Add test product to cart.
7. Open `/checkout`.

Expected:

- COD appears as a payment method.
- Checkout pricing shows platform fee if enabled.
- No COD unavailable warning appears for the test cart.

### A2 - Seller Payout Profile Is Verified

Steps:

1. Sign in as admin or finance.
2. Open `/admin/finance/payouts` or `/finance/payouts`.
3. Find seller A and seller B payout details.
4. Verify payout details if the UI shows pending verification.

Expected:

- Seller payout details show as verified.
- Payout approval is not blocked later by missing payout profile.

## Test Group B: Store Pickup COD Happy Path

### B1 - Customer Places Store Pickup COD Order

Steps:

1. Sign in as customer.
2. Add seller A product to cart.
3. Open `/checkout`.
4. Choose Store Pickup delivery preference.
5. Choose Cash on Delivery.
6. Place order.
7. Copy the order number from `/checkout/success/[orderNumber]`.
8. Open `/account/orders/[orderNumber]`.

Expected:

- Customer order exists.
- Payment status is `PENDING`.
- Delivery mode is Store Pickup.
- No seller cash receivable exists yet.

### B2 - Seller Marks Store Pickup Delivered

Steps:

1. Sign in as seller A on web.
2. Open `/seller/orders`.
3. Open `/seller/orders/[orderNumber]`.
4. Confirm mode shows Store pickup.
5. Click the seller action that marks the package delivered.
6. Confirm the action.

Expected:

- Seller fulfilment becomes `DELIVERED`.
- Order delivery becomes delivered if all splits are delivered.
- A seller cash receivable is created automatically.
- Seller is not asked to enter COD amount for Store Pickup.
- Customer payment becomes `PAID` if this is the only COD collection path.

### B3 - Admin/Finance Receivable Readback

Steps:

1. Sign in as finance or admin.
2. Open `/finance/seller-cash-receivables` or `/admin/finance/seller-cash-receivables`.
3. Search by order number.
4. Open or inspect the receivable row.

Expected:

- One receivable exists.
- Source is `STORE_PICKUP_COD`.
- Gross cash collected equals seller expected cash.
- Platform due equals commission/tax/platform deductions plus allocated buyer platform fee.
- Outstanding equals platform due.
- Linked order, seller, payment, and shipment are visible.

### B4 - Store Pickup Idempotency

Steps:

1. Stay as seller A.
2. Reopen `/seller/orders/[orderNumber]`.
3. Refresh the page.
4. Try to repeat the delivered action if the UI still exposes it.
5. Recheck `/finance/seller-cash-receivables`.

Expected:

- No duplicate receivable is created.
- Receivable count for the seller split remains one.
- Payment status remains `PAID`.
- No second seller ledger opening entry is created.

## Test Group C: Manual Transport COD Happy Path

### C1 - Create Or Route Manual Transport COD Order

Steps:

1. Sign in as customer.
2. Place a COD order for seller A product.
3. If checkout does not expose Manual Transport directly, sign in as admin.
4. Open `/admin/orders/[orderNumber]`.
5. Set the seller shipment or delivery mode to Manual transport.
6. Save the delivery/shipment update.

Expected:

- Order payment status is `PENDING`.
- Seller shipment delivery mode is `MANUAL_TRANSPORT`.
- Seller order appears in `/seller/orders`.

### C2 - Seller Web Requires COD Amount

Steps:

1. Sign in as seller A.
2. Open `/seller/orders/[orderNumber]`.
3. Click Logistics view if available: `/seller/orders/[orderNumber]/delivery`.
4. Select status `DELIVERED`.
5. Leave COD collection fields blank.
6. Save.

Expected:

- Save is blocked.
- Error says Manual Transport COD requires collected COD amount.
- No receivable is created.
- Order payment remains `PENDING`.

### C3 - Seller Web Rejects Wrong COD Amount

Steps:

1. Stay on seller delivery view.
2. Enter a COD amount lower than expected by INR 1.
3. Save.
4. Enter a COD amount higher than expected by INR 1.
5. Save.

Expected:

- Both saves are rejected.
- Error says collected COD must exactly match the seller package amount.
- No receivable is created.
- Order payment remains `PENDING`.

### C4 - Seller Web Accepts Exact COD Amount

Steps:

1. Calculate expected seller cash:
   - Seller subtotal.
   - Plus shipping.
   - Plus COD surcharge.
   - Plus allocated buyer platform fee.
2. Enter the exact amount.
3. Mark COD collected.
4. Save delivery as `DELIVERED`.

Expected:

- Seller shipment becomes delivered.
- Receivable is created.
- Source is `MANUAL_TRANSPORT_COD`.
- Gross cash collected equals entered amount.
- Customer payment becomes `PAID` if all COD collection paths are accounted.
- Admin notification/log appears if configured.

## Test Group D: Seller Mobile Manual Transport COD

### D1 - Mobile Shows Manual COD Fields

Steps:

1. Open seller mobile app.
2. Sign in as seller A.
3. Open Orders tab.
4. Open the Manual Transport COD order.
5. Set delivery mode to Manual transport if editable.
6. Select delivered status.

Expected:

- The form shows `Manual transport COD collected`.
- Amount field appears only when COD collected is selected.
- The expected amount displayed or validation matches backend amount.

### D2 - Mobile Blocks Missing Or Wrong Amount

Steps:

1. Try delivery without selecting COD collected.
2. Try with zero amount.
3. Try with wrong amount.

Expected:

- Missing COD collected is blocked.
- Zero amount is blocked.
- Wrong amount is blocked.
- No receivable is created.

### D3 - Mobile Accepts Exact Amount

Steps:

1. Enter exact expected amount.
2. Add optional COD collection note.
3. Save delivery.
4. Open Finance tab.

Expected:

- Delivery saves.
- Receivable appears in order detail.
- Finance tab shows seller-collected COD platform due.
- Web finance receivable list also shows the same record.

## Test Group E: Blocking Unsupported COD Collection Paths

### E1 - Seller Cannot Record COD For Local Delivery Partner

Steps:

1. Create COD order using Local Delivery Partner mode.
2. Sign in as seller.
3. Open `/seller/orders/[orderNumber]`.
4. Try to mark delivered or enter seller COD collection.

Expected:

- Seller cannot record COD collection.
- Delivery partner flow owns COD collection.
- No seller cash receivable is created.

### E2 - Seller Cannot Record COD For Third-Party Courier

Steps:

1. Create COD order using Third Party Courier mode.
2. Sign in as seller.
3. Open seller order detail and logistics view.
4. Try to record seller COD collection.

Expected:

- Seller COD fields are not available.
- Courier COD verification remains under courier/finance flow.
- No seller cash receivable is created.

### E3 - Store Pickup Does Not Show Manual COD Input

Steps:

1. Open Store Pickup COD order as seller.
2. Open order detail and logistics views.

Expected:

- No manual COD input is shown.
- Store Pickup delivered action auto-opens receivable.

## Test Group F: Multi-Seller And Mixed-Mode Orders

### F1 - Multi-Seller Store Pickup COD

Steps:

1. Customer adds product A from seller A and product B from seller B.
2. Choose COD and Store Pickup if supported for both sellers.
3. Place order.
4. Seller A marks delivered.
5. Check payment status.
6. Seller B marks delivered.
7. Check payment status again.

Expected:

- Seller A creates exactly one receivable.
- Payment remains `PENDING` until seller B collection is also accounted.
- Seller B creates exactly one receivable.
- Payment becomes `PAID` after all active seller COD collections are accounted.

### F2 - Mixed Store Pickup And Local Delivery Partner COD

Steps:

1. Create multi-seller COD order.
2. Configure seller A shipment as Store Pickup.
3. Configure seller B shipment as Local Delivery Partner.
4. Seller A marks Store Pickup delivered.
5. Delivery partner completes seller B delivery and records COD.
6. Finance/admin verifies delivery partner COD.

Expected:

- Seller A receivable opens.
- Payment remains `PENDING` until partner COD is verified.
- After finance/admin verifies partner COD, payment becomes `PAID`.
- Seller A split is not paid as normal payout.
- Seller B follows normal delivered paid settlement eligibility if applicable.

### F3 - Mixed Manual Transport And Courier COD

Steps:

1. Create multi-seller COD order.
2. Configure seller A as Manual Transport.
3. Configure seller B as Third Party Courier.
4. Seller A records exact Manual Transport COD.
5. Courier COD remains unverified.
6. Verify courier COD remittance later.

Expected:

- Seller A receivable opens.
- Payment remains `PENDING` until courier COD is verified.
- Payment becomes `PAID` only after courier COD verification.

### F4 - Buyer Platform Fee Rounding

Steps:

1. Create multi-seller COD order where buyer platform fee does not divide evenly across seller subtotals.
2. Record expected seller cash for each seller.
3. Complete seller-collected COD for each seller.

Expected:

- Each seller can enter the exact backend-expected amount.
- Sum of buyer platform fee allocations equals total buyer platform fee.
- No one-paise mismatch blocks seller delivery.
- Receivable platform due totals are auditable.

## Test Group G: Payout Offset Behavior

### G1 - Seller-Collected COD Split Is Not Paid Again

Steps:

1. Complete Store Pickup or Manual Transport COD order.
2. Open `/seller/finance/wallet`.
3. Open `/seller/finance/payouts`.
4. Compare eligible payout count and order list.

Expected:

- The seller-collected COD order split is not included as normal payout earnings.
- Wallet shows platform due.
- Payout availability deducts seller cash receivable from future eligible payouts.

### G2 - Full Offset Against Future Payout

Steps:

1. Seller has open platform due of INR X.
2. Create a new normal prepaid or platform-collected paid order with seller payout greater than X.
3. Complete delivery.
4. Seller requests payout from `/seller/finance/payouts`.
5. Admin approves from `/admin/finance/payouts`.
6. Admin marks paid.

Expected:

- Payout net is reduced by INR X.
- Seller cash receivable becomes `SETTLED`.
- Outstanding becomes zero.
- Ledger includes `SELLER_CASH_RECEIVABLE_OFFSET`.
- Statement export shows seller-collected COD offset.

### G3 - Partial Offset Against Smaller Future Payout

Steps:

1. Seller has open platform due of INR X.
2. Create future eligible payout smaller than X.
3. Seller requests payout.
4. Admin approves payout.
5. Admin marks payout paid.
6. Reopen `/finance/seller-cash-receivables`.
7. Create another future eligible payout.

Expected:

- First payout net becomes zero or reduced to available amount.
- Receivable becomes `PARTIALLY_OFFSET`.
- Outstanding remains greater than zero.
- After payout is marked paid, remaining receivable is available for future payout recovery.
- The first payout still shows the applied offset through ledger/statement history.
- Second payout can recover the remaining outstanding balance.

### G4 - No Future Payout

Steps:

1. Complete seller-collected COD order.
2. Do not create any future eligible payout.
3. Open seller wallet and finance receivable list.

Expected:

- Wallet shows outstanding platform due.
- Receivable remains open.
- Seller cannot receive normal payout for that cash-collected split.
- Admin/finance can manually settle or waive if needed.

### G5 - Reject Payout With Scheduled Offset

Steps:

1. Open seller cash receivable.
2. Create a payout request that schedules an offset.
3. Before mark-paid, admin rejects payout.
4. Reopen receivable.

Expected:

- Scheduled fresh receivable returns to `OPEN`.
- Previously partially recovered receivable returns to `PARTIALLY_OFFSET`.
- Offset amount resets for the rejected payout.
- Outstanding remains correct.
- Receivable can be scheduled in a later payout.

## Test Group H: Admin Settle And Waive

### H1 - Manual Settle Open Receivable

Steps:

1. Open `/finance/seller-cash-receivables`.
2. Select an `OPEN` receivable not linked to payout.
3. Enter settlement amount less than outstanding.
4. Submit settle.
5. Repeat with remaining amount.

Expected:

- Partial settle changes status to `PARTIALLY_OFFSET`.
- Full settle changes status to `SETTLED`.
- Ledger includes settlement entries.
- Outstanding decreases correctly.

### H2 - Manual Waive Requires Note

Steps:

1. Select an open receivable.
2. Try waive without note.
3. Try waive with note and partial amount.
4. Try waive remaining amount.

Expected:

- Waive without note is blocked.
- Partial waive reduces outstanding.
- Full waive changes status to `WAIVED`.
- Ledger and audit entries are created.

### H3 - Settle/Waive Blocked While Payout-Linked

Steps:

1. Create payout request that schedules seller cash offset.
2. Open `/finance/seller-cash-receivables`.
3. Try settle.
4. Try waive.

Expected:

- Both actions are blocked.
- UI shows payout lock message.
- API does not mutate receivable.
- After payout rejection, settle/waive becomes available again.
- After payout paid and partial release, settle/waive is available only for remaining unlinked outstanding balance.

## Test Group I: Statements And Ledger

### I1 - Statement Shows Seller-Collected COD Offset

Steps:

1. Complete payout with seller cash receivable offset.
2. Admin opens `/admin/finance/payouts`.
3. Generate statement.
4. Open `/admin/finance/statements`.
5. Download CSV.
6. Download PDF.

Expected:

- CSV contains `Seller-collected COD offsets`.
- CSV contains receivable number, order number, shipment number, delivery mode, platform due, offset amount, outstanding, and status.
- PDF summary contains seller-collected COD offset total.
- Statement net payable matches payout net payable.

### I2 - Ledger Trace

Steps:

1. Open `/finance/ledger` or `/admin/finance/ledger`.
2. Search by payout number or receivable number.

Expected:

- Receivable opening entry exists.
- Payout offset entry exists.
- Settlement or waiver entry exists if manually used.
- Ledger balances move in expected direction.

## Test Group J: Cancellation And Return Boundaries

### J1 - Cancel Before Delivery

Steps:

1. Create Store Pickup COD or Manual Transport COD order.
2. Cancel before seller marks delivered.
3. Open seller COD dues.

Expected:

- No seller cash receivable is created.
- Payment does not become `PAID`.
- Cancelled split is not payout eligible.

### J2 - Delivered Seller-Collected COD Cannot Return To Unpaid State

Steps:

1. Complete seller-collected COD delivery.
2. Confirm payment is `PAID`.
3. Try admin/seller status changes that would effectively undo delivery or payment.

Expected:

- System blocks invalid rollback or keeps payment accounted.
- Receivable remains auditable.
- No duplicate receivable is created.

### J3 - Customer Return After Seller-Collected COD

Steps:

1. Complete seller-collected COD order.
2. Customer opens `/account/orders/[orderNumber]`.
3. Create return/refund request where policy allows.
4. Process return through admin/seller workflow.
5. Review seller cash receivable and payout state.

Expected:

- Refund/return does not create a duplicate seller payout for already collected cash.
- Platform due remains auditable.
- Any refund adjustment is visible in finance records.

## Test Group K: Security And Permissions

### K1 - Seller Cannot See Another Seller Receivable

Steps:

1. Sign in as seller B.
2. Try to locate seller A order in `/seller/orders`.
3. Try direct URL `/seller/orders/[sellerAOrderNumber]`.

Expected:

- Seller B cannot access seller A order.
- Seller B cannot see seller A receivable in wallet or payout views.

### K2 - Customer Cannot Access Seller COD Dues

Steps:

1. Sign in as customer.
2. Try opening `/finance/seller-cash-receivables`.
3. Try opening `/admin/finance/seller-cash-receivables`.

Expected:

- Access is blocked or redirected to the correct login.

### K3 - Finance User Cannot Use Full Admin-Only Actions

Steps:

1. Sign in as finance user.
2. Open `/finance/seller-cash-receivables`.
3. Confirm finance actions work.
4. Try full admin-only pages outside finance scope.

Expected:

- Finance can manage finance receivables.
- Finance cannot access unrelated full admin control pages.

## Test Group L: Regression Checks

### L1 - Razorpay Or Prepaid Orders Are Unchanged

Steps:

1. Create a Razorpay/prepaid order.
2. Complete seller delivery.
3. Review payout availability.

Expected:

- No seller cash receivable is created.
- Normal seller payout works as before.

### L2 - Delivery Partner COD Is Unchanged

Steps:

1. Create Local Delivery Partner COD order.
2. Delivery partner records COD.
3. Admin/finance verifies COD collection.

Expected:

- No seller cash receivable is created.
- COD payment becomes `PAID` only after admin/finance verification.
- Delivery partner COD reports still work.

### L3 - Third-Party Courier COD Is Unchanged

Steps:

1. Create Third Party Courier COD order.
2. Courier/remittance flow records collection.
3. Finance verifies courier COD.

Expected:

- No seller cash receivable is created.
- Courier COD remittance verification controls payment accounting.

## Bug Hunt Checklist

During every test, watch for:

- Duplicate receivables for one seller split.
- Payment marked `PAID` before every COD path is accounted.
- Seller cash-collected split appearing again as normal payout earning.
- Payout approval changing totals unexpectedly.
- Partial receivable not available for later recovery.
- Statement missing seller-collected COD offset after partial payout is marked paid.
- Store Pickup asking seller for COD amount.
- Manual Transport allowing delivery without exact COD amount.
- Seller seeing another seller's receivable.
- One-paise mismatch in multi-seller platform fee allocation.
- Admin settle/waive allowed while receivable is payout-linked.
- Ledger missing opening, offset, settle, or waive entries.

## Final Release Sign-Off Table

| Area | Tester | Result | Notes |
| --- | --- | --- | --- |
| Store Pickup COD | | | |
| Manual Transport COD web | | | |
| Manual Transport COD mobile | | | |
| Multi-seller COD | | | |
| Mixed-mode COD | | | |
| Full payout offset | | | |
| Partial payout offset | | | |
| Payout rejection | | | |
| Admin settle/waive | | | |
| Statements CSV/PDF | | | |
| Ledger | | | |
| Permissions | | | |
| Regression: prepaid orders | | | |
| Regression: delivery partner COD | | | |
| Regression: courier COD | | | |

Production sign-off:

```text
Feature:
Environment:
Build/commit:
Tester:
Date:
Decision: PASS / FAIL
Blocking issues:
Non-blocking issues:
Approved for production by:
```
