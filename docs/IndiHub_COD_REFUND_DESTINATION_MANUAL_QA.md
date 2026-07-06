# COD And Offline Refund Destination Manual QA

## Scope

Use this checklist to manually verify the uncommitted return/refund changes for COD and offline refunds.

Covered changes:

- Customer web return form collects refund destination for COD/offline refund requests.
- Customer mobile return form collects the same destination.
- Refund destination supports only `UPI` and `BANK_TRANSFER`.
- Cash refund is not available in UI and is rejected by API.
- Return/refund records store destination snapshots.
- Finance/Admin refund workspace shows masked destination details.
- Finance/Admin can adjust payable refund amount within the approved cap.
- Seller deduction math uses the adjusted payable amount after refund success.
- Finance workspace includes the refunds screen.

## Test Data Needed

Prepare these orders before testing:

- COD delivered order with at least one returnable item.
- Bank-transfer or manual-payment delivered order with at least one returnable item.
- Razorpay paid delivered order with at least one returnable item.
- Store-pickup delivered order, to confirm store-pickup remains final and does not enter return/refund flow.
- Seller/admin/finance accounts:
  - Customer account that owns the test orders.
  - Seller account for approving returns.
  - Admin or Finance account for refund processing.

Do not run seed/bootstrap or DB-writing scripts against staging/production unless approved.

## Pre-Flight Checks

1. Confirm the migration exists:
   - `prisma/migrations/20260706143000_cod_refund_destination_finance_adjustments/migration.sql`
2. Confirm Prisma schema contains:
   - `ReturnRequest.refundDestinationSnapshot`
   - `RefundRequest.approvedAmountPaise`
   - `RefundRequest.refundDestinationSnapshot`
   - `RefundRequest.amountAdjustmentNote`
   - `RefundRequest.amountAdjustedAt`
   - `RefundRequest.amountAdjustedById`
3. Confirm finance nav includes:
   - `/finance/refunds`
4. Confirm refund UI method options do not show cash refund.

## Customer Web QA

### 1. COD Refund Requires Destination

Steps:

1. Sign in as customer on web.
2. Open a delivered COD order.
3. Click `Request refund`.
4. Select one returnable item.
5. Leave reason blank and submit.

Expected:

- UI blocks submit and asks for a return reason.

Continue:

1. Add a valid reason.
2. Keep refund destination blank.
3. Submit.

Expected:

- UI blocks submit and asks for refund account holder or UPI/bank details.
- No return request is created.

### 2. COD Refund With UPI Destination

Steps:

1. On the same COD order, select `Refund`.
2. Choose `UPI`.
3. Enter account holder name.
4. Enter UPI ID.
5. Submit return request.

Expected:

- Return request submits successfully.
- Customer sees success message.
- The request appears in customer returns.
- No cash refund option is shown.

### 3. COD Refund With Bank Destination

Steps:

1. Open another COD delivered order.
2. Select returnable item.
3. Choose `Refund`.
4. Choose `Bank`.
5. Enter account holder name, bank name, account number, and IFSC.
6. Submit.

Expected:

- Return request submits successfully.
- IFSC is normalized to uppercase.
- No cash refund option is shown.

### 4. Replacement Does Not Require Refund Destination

Steps:

1. Open a COD delivered order.
2. Click `Request replacement`.
3. Select returnable item.
4. Add reason.
5. Submit without UPI/bank details.

Expected:

- Replacement request submits successfully.
- Refund destination fields are not required.

### 5. Razorpay Refund Does Not Require Manual Destination

Steps:

1. Open a delivered Razorpay-paid order.
2. Click `Request refund`.
3. Select returnable item.
4. Add reason.
5. Submit without UPI/bank details.

Expected:

- Return request submits successfully.
- UPI/bank refund destination section should not be required.

## Customer Mobile QA

### 6. Mobile COD Refund Requires UPI/Bank

Steps:

1. Sign in to the customer mobile app.
2. Open a delivered COD order.
3. Start a return.
4. Select `Refund`.
5. Select an item.
6. Add reason.
7. Submit without refund destination.

Expected:

- Mobile form blocks submit with a clear validation message.
- No return request is created.

### 7. Mobile COD Refund With UPI

Steps:

1. Select `UPI`.
2. Enter account holder name and UPI ID.
3. Submit.

Expected:

- Return request submits successfully.
- App navigates to the return detail screen.

### 8. Mobile COD Refund With Bank Transfer

Steps:

1. Start a return for another COD/offline order.
2. Select `Bank`.
3. Enter account holder name, bank name, account number, and IFSC.
4. Submit.

Expected:

- Return request submits successfully.
- IFSC is uppercase.

## Seller Return Approval QA

### 9. Seller Approves Return

Steps:

1. Sign in as seller.
2. Open seller returns.
3. Open the customer COD return request.
4. Approve the return.

Expected:

- Return moves to the expected approved/pickup/QC flow based on existing return workflow.
- Seller note behavior still works.
- No `note: undefined` error occurs.

## Admin/Finance Refund QA

### 10. Refund Request Contains Approved Cap

Steps:

1. Complete the existing return QC/approval steps until a refund request is created.
2. Sign in as Admin or Finance.
3. Open `/admin/refunds` or `/finance/refunds`.
4. Select the refund.

Expected:

- Refund amount is visible.
- Approved cap is visible.
- Destination is visible in masked format.
- Destination does not expose raw account JSON.

### 11. Finance Workspace Refunds Screen

Steps:

1. Sign in as Finance user.
2. Open `/finance`.
3. Click `Refunds`.

Expected:

- `/finance/refunds` opens.
- Refund queue loads.
- Finance user can view refund detail.
- Finance user does not need full admin workspace access.

### 12. Cash Refund Is Not Available

Steps:

1. Open a refund detail in admin or finance refunds.
2. Open the refund method dropdown.

Expected:

- `COD Cash` / `Cash refund` is not listed.
- Valid manual options are `BANK_TRANSFER`, `UPI`, and `MANUAL`.

### 13. Manual Cash Refund API Is Rejected

Steps:

1. Use API client or browser devtools to call manual refund record endpoint with `method: "COD_CASH"`.

Expected:

- API rejects the request.
- Error says cash refunds are not supported and UPI/bank transfer should be used.
- Refund remains unpaid.

### 14. Adjust Payable Amount Within Cap

Steps:

1. Open a pending/approved refund.
2. Enter a payable amount lower than or equal to approved cap.
3. Enter an adjustment note.
4. Click `Adjust payable amount`.

Expected:

- Refund detail refreshes.
- `Refund amount` changes to the adjusted amount.
- `Approved cap` remains unchanged.
- Last adjustment note is visible.
- Audit log records `refund.amount_adjusted`.

### 15. Adjust Payable Amount Above Cap

Steps:

1. Open a pending/approved refund.
2. Enter a payable amount greater than approved cap.
3. Enter an adjustment note.
4. Submit.

Expected:

- API rejects the change.
- Refund amount remains unchanged.
- No payment transaction is created.

### 16. Adjustment Note Is Required

Steps:

1. Enter a valid payable amount.
2. Leave adjustment note blank.
3. Submit.

Expected:

- UI keeps the button disabled, or API rejects if called manually.
- Refund amount remains unchanged.

### 17. Manual UPI Refund Record

Steps:

1. Open a COD refund with UPI destination.
2. Confirm method defaults to `UPI`.
3. Enter UTR/reference.
4. Enter paid date/time.
5. Mark manual refund paid.

Expected:

- Refund status becomes `SUCCESS`.
- Refund transaction is created with method `UPI`.
- Transaction amount equals adjusted payable amount.
- Seller deduction impact is applied only after success.

### 18. Manual Bank Refund Record

Steps:

1. Open a COD/offline refund with bank destination.
2. Confirm method defaults to `BANK_TRANSFER`.
3. Enter bank transfer reference and paid date/time.
4. Mark manual refund paid.

Expected:

- Refund status becomes `SUCCESS`.
- Refund transaction method is `BANK_TRANSFER`.
- Transaction amount equals adjusted payable amount.

### 19. Destination Method Mismatch Is Rejected

Steps:

1. Open a refund with UPI destination.
2. Try to manually record payment using `BANK_TRANSFER`.

Expected:

- API rejects the request.
- Error says refund must be recorded through the stored destination method.
- Refund remains unpaid.

## Regression QA

### 20. Razorpay Refund Still Uses Gateway Flow

Steps:

1. Open a Razorpay refund request.
2. Approve the refund.
3. Initiate Razorpay refund.

Expected:

- Razorpay initiation still works.
- Manual destination is not required.
- Gateway transaction is created.

### 21. Completed Refund Cannot Be Adjusted

Steps:

1. Open a `SUCCESS` refund.
2. Try to adjust amount through UI or API.

Expected:

- UI disables adjustment or API rejects it.
- Completed transaction remains unchanged.

### 22. Store Pickup Remains Final After Delivered

Steps:

1. Open a delivered store-pickup order on web and mobile.

Expected:

- Return/refund buttons do not appear.
- Cancel/return/refund actions are not shown after store pickup is delivered.

### 23. Existing Return Quality Images Still Work

Steps:

1. Submit a return with quality images.

Expected:

- Up to 2 images upload.
- Return request stores quality image keys.
- Refund destination behavior still works with uploaded images.

## Database Spot Checks

Run read-only checks against a safe local/dev database:

```sql
SELECT request_number, refund_destination_snapshot
FROM return_requests
WHERE refund_destination_snapshot IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

Expected:

- COD/offline refund requests store UPI or bank destination JSON.

```sql
SELECT refund_number, amount_paise, approved_amount_paise, refund_destination_snapshot, amount_adjustment_note
FROM refund_requests
WHERE refund_destination_snapshot IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

Expected:

- `approved_amount_paise` holds the original approved cap.
- `amount_paise` holds the current payable amount.
- Adjusted refunds have `amount_adjustment_note`.

## Manual Sign-Off

Record results:

| Area | Result | Notes |
| --- | --- | --- |
| Web COD UPI return | Pending | |
| Web COD bank return | Pending | |
| Mobile COD UPI return | Pending | |
| Mobile COD bank return | Pending | |
| Seller approval | Pending | |
| Finance refund queue | Pending | |
| Amount adjustment within cap | Pending | |
| Amount adjustment above cap rejected | Pending | |
| Manual UPI refund success | Pending | |
| Manual bank refund success | Pending | |
| Cash refund rejected | Pending | |
| Razorpay regression | Pending | |
| Store pickup regression | Pending | |

