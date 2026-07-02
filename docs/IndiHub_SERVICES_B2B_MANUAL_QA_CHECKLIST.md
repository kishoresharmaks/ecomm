# 1HandIndia Services + B2B Manual QA Checklist

Use this document before pushing recent Services and B2B changes to production. Mark each row as `PASS`, `FAIL`, or `BLOCKED`, and record the booking/order numbers used.

## 1. QA Setup

### Test Accounts

| Role | Required account state | Status | Notes |
| --- | --- | --- | --- |
| Customer | Normal customer with phone/email login |  |  |
| Business buyer | Approved B2B profile with at least one address |  |  |
| Seller | Approved seller with product capability |  |  |
| Service provider | Approved seller with service capability enabled |  |  |
| Admin | Admin role |  |  |
| Finance | Finance/admin role for payouts, payments, receivables |  |  |

### Test Data

| Data | Required | Status | Notes |
| --- | --- | --- | --- |
| Approved product | Product with stock available |  |  |
| Approved service listing | At least one active service with pricing/payment rules |  |  |
| Seller service area | Customer pincode/service area covered |  |  |
| Razorpay test/live keys | Correct env for environment being tested |  |  |
| Bank transfer settings | B2B bank payment instructions configured |  |  |
| Storage/upload config | Proof/evidence upload works |  |  |
| DB migrations | All new migrations applied locally/staging before prod |  |  |

## 2. Services QA

### 2.1 Service Listing - Seller Web

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Create service | Seller Center -> Services -> Create service | Service saves as draft/pending according to workflow |  |
| Edit service | Open existing service edit page | Seller can update title, price, category, service area, media/details |  |
| Resubmit service | Edit rejected/archived/pending listing and submit | Listing goes to correct review state |  |
| Archive service | Archive active service | Service no longer appears for customer booking |  |
| Validation | Submit missing required fields | Clear inline/API validation, no broken page |  |
| Service-only seller rules | Login as service-only provider | Product-only flows are hidden/blocked; service flows work |  |

### 2.2 Service Discovery + Booking - Customer Web

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Browse service | Open service listing page | Active service visible with correct price/provider/area |  |
| Area check | Try supported and unsupported pincode/address | Supported address proceeds; unsupported address blocked/warned |  |
| Create booking | Fill service booking form | Booking number generated; customer detail page opens |  |
| Booking details | Open `/account/service-bookings/[bookingNumber]` | Shows service, provider, status, payment due, quote if any |  |
| Customer notifications | Create/quote/payment/completion events | Notification appears where implemented |  |

### 2.3 Service Payment Modes - Customer + Seller + Admin

| Payment mode | Steps | Expected result | Status |
| --- | --- | --- | --- |
| FULL_PAYMENT | Customer pays full online amount | Razorpay opens, verifies, booking payment becomes paid |  |
| ADVANCE_PAYMENT | Customer pays advance online | Advance paid; remaining due is tracked and payable later |  |
| INSPECTION_FEE | Customer pays inspection fee | Booking can move to inspection/quote flow after fee payment |  |
| PAY_AT_VISIT | Create pay-at-visit booking | No Razorpay required initially; due/cash/online later tracked |  |
| Failed/cancelled Razorpay | Start checkout, cancel/fail | Booking/payment does not falsely become paid/in-progress |  |
| Retry online payment | Retry failed/pending payment | New valid payment attempt succeeds without duplicate paid amount |  |
| Remaining due online | Mark work complete/quote accepted with remaining due | Customer sees due amount and can pay online |  |
| Cash/COD collection | Seller records cash collected | Cash is tracked as provider cash, not added to seller wallet payout |  |
| Partial cash + online | Record mixed payments | Online payout and cash receivable totals remain separate |  |

### 2.4 Service Payment Gating

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Block unpaid full-payment work | Try seller move to in-progress before required payment | Backend/UI blocks or clearly warns |  |
| Block unpaid advance/inspection start | Try progressing before required advance/inspection fee | Block/warn according to payment mode rules |  |
| Allow pay-at-visit work | PAY_AT_VISIT booking progresses without online payment | Allowed, but payment due remains visible |  |
| Completion with remaining due | Seller completes work with outstanding balance | Customer due is visible; payout excludes unpaid/cash receivable portions |  |

### 2.5 Quote Workflow

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Send quote | Seller sends quote after inspection/request | Customer sees quote amount, expiry, notes |  |
| Accept quote | Customer accepts quote | Booking moves to quote accepted; payment due generated |  |
| Reject quote | Customer rejects quote | Booking moves to rejected/closed state correctly |  |
| Revise quote | Seller sends another quote where allowed | Latest quote is active; old quote visible/auditable if implemented |  |
| Quote expiry | Wait/force expiry worker condition | Expired quote cannot be accepted |  |
| Pay after quote | Customer pays final/remaining quote amount | Payment verified and booking can proceed |  |

### 2.6 Seller Service Calendar + Availability

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Working hours | Configure seller availability | Slots reflect working hours |  |
| Leave/blocked day | Add blocked window/leave | Customers cannot book blocked period |  |
| Slot capacity | Book same slot beyond capacity | Over-capacity booking blocked |  |
| Conflict prevention | Assign overlapping jobs/technician | Conflict blocked or warning shown |  |
| Reschedule | Change booking schedule | Old slot released; new slot reserved |  |

### 2.7 Technician / Field Ops

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Add technician | Seller creates technician/staff | Technician appears in assignment options |  |
| Assign technician | Assign technician to booking | Booking shows assigned technician details |  |
| Arrival status | Mark technician arrival status | Status visible on seller/admin/customer where intended |  |
| Check-in/check-out | Perform check-in and check-out | Times recorded; invalid sequence blocked |  |
| Technician notes | Add field notes | Notes persist and are visible to allowed roles |  |
| Field proof | Upload completion/field proof | Proof saves and is available for admin/dispute review |  |

### 2.8 Completion, Proof, Disputes

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Submit completion | Seller marks work completed/submits proof | Customer can confirm/dispute |  |
| Customer confirms | Customer confirms completion | Booking becomes completed; settlement eligibility calculated |  |
| Customer disputes | Customer disputes completion | Booking enters disputed state; admin can review evidence |  |
| Admin resolve complete | Admin force-confirms/complete outcome | Booking closes correctly; payout/ledger updated |  |
| Admin cancel/refund outcome | Admin resolves with cancellation/refund | Refund/ledger/hold/reversal records created correctly |  |
| Evidence access control | Try opening proof as wrong role | Unauthorized access blocked |  |

### 2.9 Refunds + Cancellation Policy

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Flexible policy | Cancel within allowed time | Correct fee/refund amount calculated |  |
| Moderate policy | Cancel near visit time | Correct partial fee/refund calculated |  |
| Strict policy | Cancel late/no-show case | Strict fee/refund rules applied |  |
| Razorpay refund | Admin/flow triggers online refund | Refund request/transaction recorded; payment status updated |  |
| Partial refund | Issue partial refund | Ledger reversal/hold reflects only partial amount |  |
| Refund after payout hold | Refund before seller payout | Payout held/reduced correctly |  |
| Refund after payout paid | Refund after payout already paid | Receivable/adjustment is created correctly |  |

### 2.10 Service Settlements, Wallet, Finance

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Online paid service settlement | Complete online-paid booking | Seller settlement/ledger eligible amount appears |  |
| Cash receivable open | Seller records cash | ServiceSellerReceivable opens; seller wallet does not get cash amount |  |
| Customer confirms cash | Customer confirms provider cash | Receivable moves to correct confirmed/open state |  |
| Customer disputes cash | Customer disputes cash | Admin resolution required; no final receivable leak |  |
| Admin verifies cash | Admin verifies cash | Receivable becomes payable to platform/settlement tracked |  |
| Receivable offset | If auto/manual offset enabled | Open receivable offsets next payout or remains manual per setting |  |
| Waiver request | Request/approve waiver | Approval trail and limits respected |  |
| Seller payout availability | Finance payout page | Service settlements included; cash excluded/offset as designed |  |
| Seller statement | Export/view seller statement | Service settlement lines and receivable offsets visible |  |
| Admin finance dashboard | Open finance dashboards/reports | Service revenue, refunds, receivables, payouts visible |  |

### 2.11 Reviews

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Customer review | Completed booking -> submit review | Review saved and visible as allowed |  |
| Seller reply | Seller replies to review | Reply visible and editable according to rules |  |
| Admin moderation | Admin approves/rejects/hides review | Moderation status reflected on customer/seller screens |  |
| Abuse/spam validation | Submit empty/invalid review | Validation blocks bad input |  |

### 2.12 Mobile Services

| App | Check | Expected result | Status |
| --- | --- | --- | --- |
| Customer app | Book service | Booking appears in account service bookings |  |
| Customer app | Pay online / retry payment | Payment status updates correctly |  |
| Customer app | View due/quote/completion | Minimal required fields visible |  |
| Seller app | View service bookings | Seller sees current bookings |  |
| Seller app | Basic booking action | Allowed status/payment actions work |  |
| Seller app | Reviews/services tab | No crashes; data loads |  |

## 3. B2B QA

### 3.1 Business Buyer Profile + Address

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Create/update profile | B2B -> Register/Profile | Company/GST/contact details save |  |
| Admin buyer review | Admin business buyers page | Buyer status can be reviewed/updated |  |
| Address CRUD | Add/edit/delete B2B address | Address changes persist and validation works |  |

### 3.2 B2B Enquiry - Buyer Web

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Product enquiry | Buyer submits product-specific enquiry | Enquiry created and linked to product/seller |  |
| Seller enquiry | Buyer submits seller/general enquiry | Enquiry created without product if allowed |  |
| Transport preference - delivery | Select seller-arranged transport with note | Enquiry stores transport mode/note |  |
| Transport preference - pickup | Select store pickup | Enquiry stores pickup mode; no transport charge expected |  |
| Validation | Missing quantity/message | Clear validation; no duplicate enquiry |  |
| Idempotency | Retry submit/network blip | Duplicate enquiry not created if idempotency used |  |

### 3.3 B2B Enquiry - Seller Web

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Seller sees enquiry | Seller Center -> B2B enquiries | Buyer enquiry appears |  |
| Seller quote product | Enter unit price/message | Quote appears in buyer enquiry detail |  |
| Seller quote transport | Enter B2B transport charge/ETA/note | Buyer sees transport charge and total |  |
| Store pickup quote | Buyer selected pickup; seller leaves charge 0 | Total excludes transport charge |  |
| Multiple quotes | Send revised quote | Latest quote is active; previous quotes visible |  |
| Messaging | Buyer/seller/admin sends chat | Messages persist and realtime updates where enabled |  |
| Locked status | Try respond after buyer confirmation/finalisation | Further seller responses blocked |  |

### 3.4 B2B Enquiry - Buyer Confirmation

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Confirm latest quote | Buyer confirms active/latest quote | Enquiry moves to buyer confirmed |  |
| Confirm old quote | Try confirming older quote | Conflict/block; asks to confirm latest |  |
| Cancel enquiry | Buyer cancels before lock | Enquiry cancelled; messages/quotes locked |  |
| Buyer total | Confirm quote with transport charge | Total = unit price * quantity + transport charge |  |

### 3.5 B2B Admin Approval + Finalisation

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Admin list | Admin -> B2B enquiries/orders | Enquiry/order appears with correct status |  |
| Admin approve enquiry | Approve buyer-confirmed enquiry | Status moves to admin approved |  |
| Admin finalise enquiry | Finalise approved enquiry | B2B order/proforma generated |  |
| Commission mapping | Check order commercial panel | Commission calculated on product subtotal only |  |
| Transport payable | Check buyer payable | Buyer payable includes transport charge |  |
| Proforma PDF | Open/download proforma | PDF includes product subtotal, transport charge, buyer payable |  |
| Admin detail page | Open admin B2B order detail | Summary, documents, payment, transport, timeline panels load |  |

### 3.6 B2B Purchase Order Flow

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Buyer upload PO | Buyer uploads signed PO file | Upload validates PDF/image and saves |  |
| Buyer submit PO | Submit PO number/file/note | Order moves to PO submitted |  |
| Open PO as buyer | Buyer opens PO document | Access works |  |
| Open PO as seller | Seller opens PO document | Access works after allowed state |  |
| Open PO as admin | Admin opens PO document | Access works |  |
| Unauthorized PO access | Wrong account opens PO URL | Access denied |  |
| Admin accept PO | Admin accepts PO | Order moves to PO accepted or fulfilment unlocked if payment cleared |  |

### 3.7 B2B Payment Flow

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Bank instructions | Buyer order payment panel | Correct bank/UPI/instructions visible |  |
| Submit proof | Buyer uploads bank receipt and reference | Proof status submitted for verification |  |
| Duplicate reference | Submit same reference twice | Duplicate blocked where applicable |  |
| Partial payment | Submit amount less than payable | Payment status partially paid/submitted as designed |  |
| Overpayment | Submit amount above payable | Overpayment tracked in proof |  |
| Admin verify proof | Admin/finance verifies | Paid amount updates; payment status paid/partial |  |
| Admin reject proof | Admin rejects with reason | Buyer sees rejection reason; payment not marked paid |  |
| Manual payment | Admin records manual payment | Payment proof/ledger/audit created |  |
| Payment not required | Admin sets payment not required | Fulfilment can unlock if PO accepted |  |
| Extend due date | Admin extends due date | Audit log created and due date updates |  |
| Overdue worker/path | Force overdue condition | Order becomes overdue without breaking payment proof flow |  |

### 3.8 B2B Fulfilment + Transport

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Fulfilment gating | Try unlock before PO/payment | Blocked unless admin override with reason |  |
| Unlock fulfilment | PO accepted + paid/not required | Order moves to in fulfilment |  |
| Seller transport update | Seller B2B order -> transport panel | Seller can update partner, phone, tracking, ETA, status |  |
| Transport charge before PO/payment | Seller changes charge while proforma only | Buyer payable updates and proforma file regenerates on next open |  |
| Transport charge after PO/payment | Try changing charge after PO/payment | Charge blocked; tracking/status still editable |  |
| Store pickup | Mode store pickup | Charge is 0; pickup/status details visible |  |
| Dispatch status | Seller marks dispatched/in transit | Timeline records transport event; buyer/admin can view tracking |  |
| Delivered status | Seller marks delivered | Delivered timestamp/status visible |  |
| Admin transport oversight | Admin order detail -> transport panel | Admin sees mode, status, charge, partner, tracking, ETA |  |

### 3.9 B2B Documents + Invoices

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Proforma access | Buyer/seller/admin opens proforma | Correct access by role; PDF readable |  |
| Regenerate proforma | Admin regenerates with reason | Revision history stores previous proforma |  |
| Final tax invoice before fulfilment | Try open before fulfilled | Blocked/not available |  |
| Fulfil order | Admin marks fulfilled | Tax invoice becomes available |  |
| Tax invoice transport | Open tax invoice | Includes transport details and buyer payable |  |

### 3.10 B2B Settlement + Finance

| Check | Steps | Expected result | Status |
| --- | --- | --- | --- |
| Seller payout amount | Verify seller payout | Product subtotal - commission; transport not commission base |  |
| Fulfilled paid order | Mark fulfilled after paid | Settlement becomes eligible |  |
| Seller payout request | Existing payout flow | B2B/service/order settlements included as designed |  |
| Finance dashboard | Open finance reports | B2B totals, payments, pending proof, refunds visible |  |
| Seller statement | Export/view statement | B2B lines appear correctly |  |
| Refund adjustment | Admin issues B2B refund | Payment/refund/audit records update correctly |  |

### 3.11 B2B Mobile Minimal Checks

| App | Check | Expected result | Status |
| --- | --- | --- | --- |
| Customer app | B2B enquiries list/detail | Existing fields load; no crash |  |
| Customer app | B2B orders list/detail | PO/payment/proforma basics load; no crash |  |
| Customer app | Submit B2B enquiry | Existing mobile form still works |  |
| Seller app | B2B enquiries list/detail | Existing quote/message flow still works |  |
| Seller app | B2B orders list/detail | Existing order/proforma/PO basics load |  |

## 4. Cross-Feature Regression Checks

| Area | Check | Expected result | Status |
| --- | --- | --- | --- |
| Normal product checkout | Place normal order with Razorpay | Existing checkout/payment/delivery flow unaffected |  |
| Normal seller delivery | Seller order delivery details | Existing delivery modes still work |  |
| Product stock | Cancel/failed payment | Stock restored/maintained correctly |  |
| Razorpay webhook | Send valid webhook | 2xx response; payment updates once |  |
| Razorpay invalid signature | Send invalid webhook | Rejected safely; no payment mutation |  |
| Auth/roles | Try seller/admin/buyer URLs as wrong role | Access denied/redirected correctly |  |
| Upload limits | Upload oversized/invalid files | Blocked with clear message |  |
| Notifications | Key order/service/B2B events | Email/push/in-app triggered where configured |  |

## 5. Production Go/No-Go Gates

Do not deploy to VPS until all mandatory gates are green.

| Gate | Command/check | Expected result | Status |
| --- | --- | --- | --- |
| Prisma generate | `pnpm.cmd run db:generate` | Pass |  |
| API typecheck | `pnpm.cmd --filter @indihub/api typecheck` | Pass |  |
| Web typecheck | `pnpm.cmd --filter @indihub/web typecheck` | Pass |  |
| Worker typecheck | `pnpm.cmd --filter @indihub/worker typecheck` | Pass |  |
| Mobile customer typecheck | `pnpm.cmd --filter @indihub/mobile-customer typecheck` | Pass if mobile changes are included |  |
| Mobile seller typecheck | `pnpm.cmd --filter @indihub/mobile-seller typecheck` | Pass if mobile changes are included |  |
| Migrations committed | `git status --short prisma/migrations` | All required migration files tracked |  |
| Admin pages committed | `git status --short apps/web/src/app apps/web/src/components/admin` | Required new admin pages tracked |  |
| Env values | VPS `.env`/process env | Razorpay, storage, DB, domain, webhook secrets correct |  |
| DB backup | VPS database backup | Backup completed before migration |  |
| Migration dry run/staging | Apply migrations on staging or clone | No migration failure |  |
| Manual QA | This checklist | Critical paths pass |  |

## 6. Production Smoke Test After Deploy

Run these immediately after VPS deployment.

| Smoke check | Expected result | Status |
| --- | --- | --- |
| API health/login | API responds; login works |  |
| Web home/account/seller/admin loads | No 500 errors |  |
| Service booking detail opens | Existing and new booking load |  |
| Service payment retry opens Razorpay | Checkout loads correctly |  |
| B2B enquiry page opens | Buyer can view enquiries |  |
| B2B order detail opens | Buyer/seller/admin can view order |  |
| B2B proforma opens | PDF access works |  |
| Razorpay webhook endpoint | Dashboard webhook enabled and recent deliveries 2xx |  |
| Worker process | Worker running without crash logs |  |
| Finance dashboard | Loads without API errors |  |

## 7. QA Sign-Off

| Area | Owner | Result | Notes |
| --- | --- | --- | --- |
| Services customer web/mobile |  |  |  |
| Services seller web/mobile |  |  |  |
| Services admin/finance |  |  |  |
| B2B buyer web/mobile |  |  |  |
| B2B seller web/mobile |  |  |  |
| B2B admin/finance |  |  |  |
| Payments/webhooks |  |  |  |
| DB migrations/VPS deploy |  |  |  |

