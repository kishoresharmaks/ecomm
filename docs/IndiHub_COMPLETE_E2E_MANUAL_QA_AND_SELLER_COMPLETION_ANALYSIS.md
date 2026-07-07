# 1HandIndia Complete E2E Manual QA and Seller Completion Analysis

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Complete manual E2E QA plan, release checklist, and seller feature completion analysis  
**Prepared Date:** 2026-07-07  
**Primary Scope Source:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`  
**Supporting QA Pack:** `docs/production/00_PRODUCTION_TESTING_INDEX.md`  
**Current Stack:** Turborepo, Next.js, NestJS, PostgreSQL, Prisma, Clerk, standalone admin auth, Razorpay/COD/offline payments, provider-adapter notifications  

## 1. Executive QA Verdict

The current 1HandIndia implementation has the seller-side web portal and supporting backend/API/admin/finance surfaces implemented for the selected production marketplace scope.

Seller-side implementation is feature-complete for the web portal across onboarding, approval state, profile/store management, subscriptions, products, orders, fulfilment, B2B, services, coupons/deals, reviews, returns, reports, wallet, payouts, statements, and role-protected ownership boundaries.

Final release sign-off still requires browser-level manual QA with web, API, worker, and the target database running together. Automated checks and source coverage are not a substitute for recording full manual E2E evidence.

## 2. Scope Rules for QA

Use these rules during testing:

- Test selected features as complete production workflows, not as demo flows.
- Keep customer, seller, B2B, delivery, finance, courier, and admin sessions separate.
- Do not expose Clerk, Razorpay, SMTP, storage, map, push, or database secrets in screenshots or notes.
- Do not run DB-writing seeds, location imports, cleanup scripts, integration tests, or ad hoc mutation scripts on staging or production without exact approval.
- Record real identifiers used in QA: order number, booking number, B2B enquiry ID, B2B order number, payout number, settlement ID, ticket ID, and notification log ID.
- Every sensitive workflow must be checked through UI result, API behavior, state transition, audit trail, and role boundary.

## 3. Required Test Environments

| Environment Item | Expected Setup | QA Status |
| --- | --- | --- |
| Web app | `http://localhost:3000` or staging domain |  |
| API | `http://localhost:4000/api` or staging API |  |
| Worker | Running if email/async notification checks are included |  |
| Database | Representative non-production DB with products, sellers, orders, services, B2B, finance, and location data |  |
| Clerk | Customer, seller, and B2B auth configured |  |
| Admin auth | Standalone admin login configured |  |
| Finance auth | Finance user login configured |  |
| Razorpay | Test mode keys and webhook secret configured when payment QA includes Razorpay |  |
| Email provider | Dev log, SMTP, Brevo, Resend, or SendGrid configured |  |
| Storage | Public image upload and private document/proof upload configured |  |
| Location data | India states, cities/districts, local areas, and pincodes loaded |  |

## 4. Required Test Accounts

| Role | Required State | Account / Notes | Status |
| --- | --- | --- | --- |
| Guest | No login | Browser profile 1 |  |
| Customer | Active customer with email/phone | Browser profile 2 |  |
| Customer blocked case | Disabled/suspended customer if available |  |  |
| Seller applicant | Newly registered, pending approval | Browser profile 3 |  |
| Approved seller | Active seller with product/service capability | Browser profile 4 |  |
| Suspended seller | Seller suspended by admin | Browser profile 5 |  |
| Service seller | Approved seller with service capability | Can be same as approved seller |  |
| B2B buyer | Business profile completed or approvable | Browser profile 6 |  |
| Delivery partner | Active and assignable | Browser profile 7 |  |
| Courier user | Courier operations role if enabled | Browser profile 8 |  |
| Finance user | FINANCE role | Browser profile 9 |  |
| Admin | Standalone admin session | Browser profile 10 |  |

## 5. Required Test Data

| Data | Required Condition | Status |
| --- | --- | --- |
| Active category | Public category with at least one approved product |  |
| Approved product | Has image, price, stock, variant, seller, category, search data |  |
| Low-stock product | Enough to test stock exhaustion and validation |  |
| Suspended seller product | Product from suspended seller for negative checkout/wishlist checks |  |
| Approved store page | Seller slug visible at `/stores/[slug]` |  |
| Service listing | Active service with coverage, mode, pricing, schedule, and media |  |
| Coupon | Valid seller coupon and invalid/expired coupon |  |
| Deal | Active seller deal and inactive/expired deal |  |
| Customer address | Covered pincode/local area and uncovered pincode/local area |  |
| B2B product enquiry target | Product and seller available for enquiry |  |
| COD settings | Enabled with max order value and instructions |  |
| Bank transfer settings | Instructions and UTR/reference capture enabled |  |
| Commission rules | Seller commission/GST/TDS/TCS/platform-fee rules configured |  |
| Payout details | Seller bank/UPI payout details available |  |
| Email templates | Core account, seller, product, order, payment, B2B, support templates available |  |

## 6. Preflight Automated Verification

Run these before manual QA on the local or staging branch. Do not run DB-writing integration suites unless the database is disposable and explicitly approved.

```powershell
pnpm.cmd db:validate
pnpm.cmd run db:generate
pnpm.cmd --filter @indihub/database typecheck
pnpm.cmd --filter @indihub/database lint
pnpm.cmd --filter @indihub/api typecheck
pnpm.cmd --filter @indihub/api lint
pnpm.cmd --filter @indihub/api test
pnpm.cmd --filter @indihub/api build
pnpm.cmd --filter @indihub/web typecheck
pnpm.cmd --filter @indihub/web lint
pnpm.cmd --filter @indihub/web test
pnpm.cmd --filter @indihub/web build
pnpm.cmd --filter @indihub/worker typecheck
pnpm.cmd --filter @indihub/worker lint
pnpm.cmd --filter @indihub/worker test
pnpm.cmd --filter @indihub/worker build
```

Record command evidence:

| Command | Environment | DB Target | Result | Notes |
| --- | --- | --- | --- | --- |
| `pnpm.cmd db:validate` |  |  |  |  |
| `pnpm.cmd --filter @indihub/api test` |  |  |  |  |
| `pnpm.cmd --filter @indihub/web build` |  |  |  |  |
| Worker commands |  |  |  |  |

## 7. Manual QA Evidence Template

Use this template for every failed or release-critical test:

```text
QA Case ID:
Tester:
Environment:
Browser/device:
Role/session:
Precondition:
Steps:
Expected result:
Actual result:
Status: PASS / FAIL / BLOCKED / NOT RUN
Severity: Critical / High / Medium / Low
Evidence link/screenshot:
Related ID: order / booking / enquiry / payout / notification / audit log
Owner:
Release decision:
```

## 8. Release Severity Rules

| Severity | Meaning | Release Decision |
| --- | --- | --- |
| Critical | Checkout, auth, payment, payout, data leak, admin access, or order corruption breaks | Block release |
| High | Major seller/customer/admin workflow fails or wrong role can access data | Block release unless explicitly waived |
| Medium | Workflow works but important UI, validation, notification, or report issue remains | Fix before production if user-facing |
| Low | Cosmetic, copy, spacing, or non-blocking edge issue | Can release with tracked follow-up |

## 9. E2E QA Execution Order

Run QA in this order:

1. Environment, auth, and role isolation.
2. Public storefront and customer account.
3. Seller onboarding, approval, subscription, profile, and catalogue.
4. Customer product checkout to seller fulfilment to delivery to finance payout.
5. Payments: COD, Razorpay test mode, bank transfer, and manual payment.
6. Returns, refunds, reviews, coupons, and deals.
7. Service marketplace booking, service payments, seller service operations, and receivables.
8. B2B buyer enquiry to seller response to admin approval/finalisation.
9. B2B order, proforma/PO, payment, fulfilment, settlement, and statement.
10. Admin operations, CMS, notifications, support, locations, search, settings.
11. Security, RBAC, ownership, audit, and negative tests.
12. Mobile/responsive browser pass.
13. Release sign-off and defect summary.

## 10. Auth and Role Isolation QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| AUTH-01 | Customer sign-in | Sign in through customer route. | Customer account opens and Clerk session syncs to app user. |  |
| AUTH-02 | Seller sign-in | Sign in through `/seller/sign-in`. | Seller workspace opens for approved seller. |  |
| AUTH-03 | Seller pending state | Sign in as pending seller. | Pending approval page appears; approved-only routes are blocked. |  |
| AUTH-04 | Suspended seller | Sign in as suspended seller. | Sensitive seller actions are blocked. |  |
| AUTH-05 | Admin standalone login | Open `/admin`, sign in with admin credentials. | Admin sidebar/dashboard opens only after admin session validation. |  |
| AUTH-06 | Finance login | Sign in at `/finance`. | Finance workspace opens; full admin-only routes are blocked. |  |
| AUTH-07 | Delivery partner login | Open `/delivery`. | Assigned delivery workspace opens. |  |
| AUTH-08 | Wrong-role route access | Try customer/seller/finance/delivery/admin routes from wrong roles. | Access denied with no data leak. |  |
| AUTH-09 | Session expiry | Expire/revoke auth token and retry protected request. | User sees safe session expired copy and no raw backend details. |  |

## 11. Public Storefront and Customer Account QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| STORE-01 | Homepage CMS | Publish banner and homepage section from admin, then open `/`. | Published content appears; draft content stays hidden. |  |
| STORE-02 | Categories | Open categories and category detail. | Active categories and products load with usable filters. |  |
| STORE-03 | Search | Search by product name/category/store keyword. | Relevant active approved products return. |  |
| STORE-04 | Product detail | Open approved product detail. | Images, seller, stock, price, variant, wishlist, cart, and B2B enquiry options render. |  |
| STORE-05 | Public store | Open `/stores` and `/stores/[slug]`. | Approved seller public store displays public profile and products. |  |
| STORE-06 | Policy pages | Open privacy, terms, refund/return, shipping, seller policy. | CMS content renders without broken page. |  |
| ACCT-01 | Profile | Update customer profile. | Editable fields save; email stays read-only where required. |  |
| ACCT-02 | Addresses | Add/edit/default/delete address with local area search. | Default promotion and address validation work. |  |
| ACCT-03 | Wishlist | Add and remove product. | Wishlist persists; suspended/unavailable products are blocked. |  |
| ACCT-04 | Cart | Add, update quantity, remove item. | Server-priced cart totals update correctly. |  |
| ACCT-05 | Orders | Open order list and detail. | Payment, delivery, seller split, timeline, and cancellation controls are correct. |  |
| ACCT-06 | Support | Submit support request and view account support history. | Admin receives request; customer view updates. |  |

## 12. Seller Portal QA

### 12.1 Seller Onboarding and Approval

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-ONB-01 | Registration | Open `/seller/register` and submit seller business details. | Seller application is created in pending state. |  |
| SELLER-ONB-02 | Seller type | Register marketplace seller, hyperlocal store, and wholesale distributor variants. | Operational seller type is saved separately from legal entity type. |  |
| SELLER-ONB-03 | Subscription plan | Select a seller subscription plan during registration. | Plan assignment or pending payment state is reflected. |  |
| SELLER-ONB-04 | Validation | Submit missing GST/contact/address/business fields. | Clear validation appears; no partial bad record is created. |  |
| SELLER-ONB-05 | Admin approval | Admin approves seller. | Seller dashboard and approved tools become available. |  |
| SELLER-ONB-06 | Admin rejection | Admin rejects another seller. | Seller cannot access approved tools and sees correct state. |  |
| SELLER-ONB-07 | Suspension | Admin suspends approved seller. | Seller sensitive operations and public commerce actions are blocked. |  |
| SELLER-ONB-08 | Audit | Review audit logs after approval/rejection/suspension. | Actor, entity, old/new state, and timestamp are logged. |  |

### 12.2 Seller Dashboard, Profile, Store, and Assets

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-PRO-01 | Dashboard | Open `/seller`. | KPIs, status, subscription summary, quick actions, and navigation load. |  |
| SELLER-PRO-02 | Profile | Edit legal/store/contact/GST fields. | Values persist and validation blocks invalid data. |  |
| SELLER-PRO-03 | Location selectors | Search state, city, local area, pincode. | Async search works and selected display label remains stable. |  |
| SELLER-PRO-04 | Logo/banner | Upload valid logo/banner assets. | Asset keys save and previews render. |  |
| SELLER-PRO-05 | Invalid upload | Upload invalid file type/size. | Upload is rejected with safe error text. |  |
| SELLER-PRO-06 | Public store sync | Update public store profile and open public store page. | Approved public data appears; private data remains hidden. |  |

### 12.3 Seller Subscription

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-SUB-01 | Seller view | Open `/seller/subscription`. | Current plan, status, limits, billing period, and recent payments render. |  |
| SELLER-SUB-02 | Admin plans | Admin creates/updates subscription plan and default plan. | Seller plan list and onboarding plan selection update. |  |
| SELLER-SUB-03 | Product limit | Try creating product above plan limit. | Product creation is blocked with upgrade message. |  |
| SELLER-SUB-04 | B2B access limit | Try responding to B2B when plan restricts it. | Response is blocked with upgrade message. |  |
| SELLER-SUB-05 | Paid authorization | Authorize paid plan with Razorpay test mode. | Subscription moves from pending payment to active after valid verification. |  |
| SELLER-SUB-06 | Invalid verification | Submit bad signature/payment callback. | Subscription does not become active. |  |
| SELLER-SUB-07 | Cancellation | Cancel recurring subscription at period end. | Cancel-at-period-end state appears and provider action is audited. |  |

### 12.4 Seller Product and Catalogue Management

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-CAT-01 | Product list | Open `/seller/products`. | Seller sees only own products with status and stock. |  |
| SELLER-CAT-02 | Create product | Add category, title, images, price, MRP, stock, variants, tax, description. | Product is created/submitted according to approval rules. |  |
| SELLER-CAT-03 | Edit product | Update own product price, stock, description, images. | Changes save and inventory movement/audit behavior is correct. |  |
| SELLER-CAT-04 | Archive product | Archive product after confirmation modal. | Product is removed from public storefront but history remains. |  |
| SELLER-CAT-05 | Approval | Admin approves/rejects seller product. | Seller product status updates; public storefront reflects approval. |  |
| SELLER-CAT-06 | Stock validation | Try cart/checkout with stale or insufficient stock. | Checkout blocks stale stock and prevents oversell. |  |
| SELLER-CAT-07 | Ownership | Try editing another seller product URL. | Request is forbidden. |  |

### 12.5 Seller Orders and Fulfilment

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-ORD-01 | Order list | Open `/seller/orders`. | Seller sees only orders containing own items. |  |
| SELLER-ORD-02 | Order detail | Open `/seller/orders/[orderNumber]`. | Only seller-owned items and split are visible. |  |
| SELLER-ORD-03 | Accept order | Move eligible split to accepted/processing. | Seller split, order rollup, and timeline update. |  |
| SELLER-ORD-04 | Dispatch | Add tracking/courier/manual delivery note. | Delivery/order/seller timelines update. |  |
| SELLER-ORD-05 | Delivery update page | Open `/seller/orders/[orderNumber]/delivery`. | Allowed delivery fields save and customer/admin tracking updates. |  |
| SELLER-ORD-06 | Payment preservation | Update fulfilment on pending and paid orders. | Payment status does not accidentally change. |  |
| SELLER-ORD-07 | Package status | Update delivery status. | Shipment and package statuses stay aligned. |  |
| SELLER-ORD-08 | Settlement eligibility | Deliver paid order. | Seller split becomes settlement eligible according to finance rules. |  |

### 12.6 Seller Finance, Wallet, Payouts, and Statements

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-FIN-01 | Wallet | Open `/seller/finance/wallet`. | Ledger balance, eligible earnings, deductions, and entries render. |  |
| SELLER-FIN-02 | Payout profile | Add bank/UPI payout details. | Details save privately and are visible to authorized finance/admin only. |  |
| SELLER-FIN-03 | Payout request | Request full eligible manual payout. | Eligible splits are locked and duplicate request is blocked. |  |
| SELLER-FIN-04 | Admin approval | Finance/admin approves payout. | Payout status changes to approved with audit log. |  |
| SELLER-FIN-05 | Mark paid | Finance/admin records payment mode/reference. | Ledger debit is posted and payout is marked paid. |  |
| SELLER-FIN-06 | Rejection | Finance/admin rejects payout. | Splits/balance become available according to rules. |  |
| SELLER-FIN-07 | Statements | Open `/seller/finance/statements` and download statement. | Statement reflects payout and ledger records. |  |
| SELLER-FIN-08 | Commission rules | Change commission/GST/TDS/TCS/settlement fee and create new settlement. | Net payable reflects active rule precedence. |  |

### 12.7 Seller B2B

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-B2B-01 | Enquiry list | Open `/seller/b2b-enquiries`. | Seller sees assigned/product-related enquiries only. |  |
| SELLER-B2B-02 | Response | Submit quotation response. | Enquiry moves to `RESPONDED`; buyer/admin see response. |  |
| SELLER-B2B-03 | Locked response | Buyer confirms quotation, then seller attempts change. | Mutation is blocked. |  |
| SELLER-B2B-04 | B2B orders | Open `/seller/b2b-orders`. | Seller sees relevant B2B orders only. |  |
| SELLER-B2B-05 | B2B order detail | Open seller B2B order detail. | Seller sees own commercial/order/fulfilment data only. |  |

### 12.8 Seller Services, Bookings, Calendar, and Reviews

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-SVC-01 | Services list | Open `/seller/services`. | Seller sees own service listings. |  |
| SELLER-SVC-02 | Create service | Add title, category, service modes, price, coverage, schedule, media. | Service saves/submits with validation. |  |
| SELLER-SVC-03 | Edit service | Update coverage, mode, price, schedule, availability. | Public service and booking rules update. |  |
| SELLER-SVC-04 | Bookings | Open `/seller/service-bookings`. | Seller sees own bookings only. |  |
| SELLER-SVC-05 | Booking action | Progress booking through allowed seller statuses. | Timeline, payment gating, and customer/admin views update. |  |
| SELLER-SVC-06 | Calendar | Open `/seller/service-calendar`. | Bookings appear in correct slots; blocked days/capacity are respected. |  |
| SELLER-SVC-07 | Service reviews | Open `/seller/service-reviews`. | Seller sees own service reviews only. |  |
| SELLER-SVC-08 | Proof/evidence | Upload completion or field proof where required. | File saves securely and access control is enforced. |  |

### 12.9 Seller Coupons, Deals, Reviews, Returns, and Reports

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SELLER-MKT-01 | Coupons | Create/edit seller coupon. | Dates, discount limits, usage rules, and seller scope validate. |  |
| SELLER-MKT-02 | Coupon checkout | Apply seller coupon from eligible/ineligible cart. | Discount applies only when rules match. |  |
| SELLER-MKT-03 | Deals | Create/edit seller deal. | Deal validates pricing/date/status and affects storefront only when active. |  |
| SELLER-MKT-04 | Product reviews | Open `/seller/reviews`. | Seller sees own product reviews and allowed actions only. |  |
| SELLER-MKT-05 | Returns | Open `/seller/returns`. | Seller sees return requests involving own items only. |  |
| SELLER-MKT-06 | Sales report | Open `/seller/reports/sales`. | Totals match seller-only non-cancelled completed/order data. |  |

## 13. Product Checkout to Seller Fulfilment to Finance QA

| Case ID | Steps | Expected Result | Status |
| --- | --- | --- | --- |
| FLOW-PROD-01 | Customer adds approved seller product to cart and places COD order. | One order is created; COD payment stays pending. |  |
| FLOW-PROD-02 | Seller accepts and dispatches order. | Seller split and timelines update; payment status unchanged. |  |
| FLOW-PROD-03 | Admin assigns delivery partner. | Delivery partner sees assigned order only. |  |
| FLOW-PROD-04 | Delivery partner marks delivered and records COD collection. | Delivery timeline updates; COD remains pending until verification. |  |
| FLOW-PROD-05 | Admin/finance verifies COD collection. | Payment becomes paid and seller split becomes settlement eligible. |  |
| FLOW-PROD-06 | Finance creates settlement and approves payout. | Settlement/payout/ledger records are correct. |  |
| FLOW-PROD-07 | Seller opens wallet and statements. | Eligible amount, payout, and statement match finance records. |  |
| FLOW-PROD-08 | Customer opens order detail/tracking. | Customer sees correct status timeline and no internal seller finance data. |  |

## 14. Payment QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| PAY-01 | COD enabled | Place eligible COD order below max value. | Order placed with pending payment and COD instructions. |  |
| PAY-02 | COD max | Try COD above configured max. | COD option is hidden or blocked. |  |
| PAY-03 | Razorpay checkout | Place Razorpay test order and complete payment. | Valid verification marks order/payment paid. |  |
| PAY-04 | Razorpay cancel/fail | Start checkout then cancel/fail. | Order/payment does not falsely become paid. |  |
| PAY-05 | Webhook valid | Send valid captured webhook in test environment. | Payment updates without duplicate/downgrade. |  |
| PAY-06 | Webhook invalid | Send invalid signature. | Request is rejected and payment state is unchanged. |  |
| PAY-07 | Bank transfer | Place bank transfer order and submit UTR/reference. | Finance can verify and mark paid. |  |
| PAY-08 | Manual payment | Admin/finance uses manual payment control. | Audit and payment events record the change. |  |
| PAY-09 | Duplicate checkout | Double-submit same cart/order request. | Duplicate order creation is blocked. |  |
| PAY-10 | Platform fee | Change platform fee settings and checkout again. | Cart/checkout/order store correct buyer fee snapshot. |  |

## 15. Returns, Refunds, and Reviews QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| RET-01 | Return request | Customer creates return for eligible delivered order. | Request is created with item/seller mapping. |  |
| RET-02 | Seller view | Seller opens `/seller/returns`. | Seller sees only own return lines. |  |
| RET-03 | Admin review | Admin approves/rejects return. | Status, audit, and customer/seller views update. |  |
| RET-04 | Refund destination | Process refund with configured destination/manual path. | Refund state, finance impact, and ledger effect are correct. |  |
| RET-05 | Paid payout impact | Refund after seller payout paid. | Seller ledger debit/adjustment is created. |  |
| REV-01 | Product review | Customer reviews delivered product. | Review appears according to moderation rules. |  |
| REV-02 | Seller review visibility | Seller opens reviews. | Seller sees own product reviews only. |  |
| REV-03 | Admin moderation | Admin approves/hides/rejects review. | Public and seller views reflect moderation. |  |

## 16. Service Marketplace QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SVC-01 | Public discovery | Customer browses service listing/detail. | Active approved services are visible. |  |
| SVC-02 | Coverage | Try covered and uncovered pincode/address. | Covered proceeds; uncovered is blocked. |  |
| SVC-03 | Remote mode | Book remote service. | Booking succeeds without customer address serviceability block. |  |
| SVC-04 | Provider-location mode | Book provider-location service. | Booking succeeds based on provider mode rules. |  |
| SVC-05 | Customer-location mode | Book covered address. | Booking created and seller sees it. |  |
| SVC-06 | Full payment | Pay full service amount online. | Payment verifies and booking can progress. |  |
| SVC-07 | Advance/inspection fee | Pay required advance or inspection fee. | Work progression is gated until payment is complete. |  |
| SVC-08 | Pay at visit | Create pay-at-visit booking. | Booking progresses with due amount tracked. |  |
| SVC-09 | Quote | Seller sends quote; customer accepts/rejects. | Status and due payment update correctly. |  |
| SVC-10 | Completion/proof | Seller completes with proof; customer confirms/disputes. | Settlement eligibility or dispute workflow updates. |  |
| SVC-11 | Cash receivable | Seller records service cash. | Platform receivable is tracked and not treated as seller payout money. |  |
| SVC-12 | Service settlement | Finance resolves service settlement/receivable. | Ledger, payout eligibility, and reports update. |  |

## 17. B2B QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| B2B-01 | Buyer profile | B2B buyer completes company profile and address. | Profile saves and buyer can create enquiry. |  |
| B2B-02 | Enquiry | Buyer creates product/seller enquiry. | Enquiry appears for buyer/admin/seller. |  |
| B2B-03 | Seller response | Seller responds with quotation. | Status becomes `RESPONDED`. |  |
| B2B-04 | Buyer confirmation | Buyer confirms quotation. | Status becomes `BUYER_CONFIRMED`; seller response is locked. |  |
| B2B-05 | Admin approval | Admin approves confirmed enquiry. | Status becomes `ADMIN_APPROVED`. |  |
| B2B-06 | Finalisation | Admin finalises approved enquiry. | Status becomes `FINALISED`; B2B order records appear where configured. |  |
| B2B-07 | PO upload | Buyer/admin uploads purchase order if enabled. | Private document storage and access controls work. |  |
| B2B-08 | B2B payment | Bank/manual/online payment flow is verified. | Payment state, seller payout mapping, and finance records update. |  |
| B2B-09 | B2B transport | Add transport/delivery details. | Buyer/seller/admin views show allowed fields. |  |
| B2B-10 | Negative state | Try cancelling/responding after locked states. | Invalid transition is blocked. |  |

## 18. Admin Portal QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| ADMIN-01 | Dashboard | Open `/admin`. | KPI command center loads with no signed-out sidebar leakage. |  |
| ADMIN-02 | Users/roles | Add/remove roles, disable user. | RBAC updates and audit logs record changes. |  |
| ADMIN-03 | Sellers | Approve/reject/suspend seller. | Seller state and public/product actions update. |  |
| ADMIN-04 | Products | Approve/reject/archive product. | Storefront visibility follows approval/status. |  |
| ADMIN-05 | Orders | Update order, delivery, assignment, payment action. | Timelines and audit records update correctly. |  |
| ADMIN-06 | Business buyers | Review/disable buyer. | B2B access follows status. |  |
| ADMIN-07 | Support | Update support request status. | Customer/admin views update. |  |
| ADMIN-08 | CMS | Create/edit/archive banners, sections, policy pages. | Public APIs show published content only. |  |
| ADMIN-09 | Categories | Create/edit/archive category. | Storefront/search behavior follows active state. |  |
| ADMIN-10 | Locations | Search coverage, toggle coverage where allowed. | Coverage and selector behavior update. |  |
| ADMIN-11 | Reports | Open sales, sellers, products, enquiries. | Cancelled orders are excluded from revenue reports. |  |
| ADMIN-12 | Settings | Change general/payment/checkout/platform/email/storage settings. | Settings persist after refresh/restart. |  |
| ADMIN-13 | Notifications | Open logs and retry failed notification. | Subject/body/context/provider status are visible. |  |
| ADMIN-14 | Audit logs | Filter sensitive actions. | Admin/seller/product/order/payment/payout actions are traceable. |  |

## 19. Finance QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| FIN-01 | Finance dashboard | Open `/finance`. | Metrics for COD, bank transfer, settlements, payouts load. |  |
| FIN-02 | COD verification | Verify/reject COD collection. | Payment state changes only after valid finance/admin action. |  |
| FIN-03 | Bank transfer | Verify UTR/reference. | Payment and order become paid after verification. |  |
| FIN-04 | Payment control | Change payment state through allowed finance control. | Audit/payment event is written. |  |
| FIN-05 | Settlement draft | Create seller settlement draft. | Eligible delivered/paid splits are included once. |  |
| FIN-06 | Payout approval | Approve/reject/mark paid seller payout. | Status, references, ledger, and statements update. |  |
| FIN-07 | Ledger adjustment | Add manual ledger adjustment. | Append-only ledger entry is created; old entries are not edited. |  |
| FIN-08 | Statements | Generate/download seller statement. | Statement matches ledger/payout data. |  |
| FIN-09 | Reports | Open finance reports. | Payment/settlement/payout summaries reconcile with test orders. |  |
| FIN-10 | Finance RBAC | Finance user opens full admin-only users/products/settings routes. | Access is forbidden. |  |

## 20. Delivery and Courier QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| DEL-01 | Delivery assignment | Admin assigns active delivery partner. | Partner sees assigned order only. |  |
| DEL-02 | Partner order list | Open `/delivery/orders`. | Only assigned work appears. |  |
| DEL-03 | Delivery detail | Open assigned order detail. | Items, address, payment visibility, and timeline render. |  |
| DEL-04 | Progress update | Partner updates delivery progress/date/note. | Order/delivery/seller timelines update. |  |
| DEL-05 | COD collection | Partner records COD amount and note. | COD remains pending until admin/finance verification. |  |
| DEL-06 | Reject/reassign | Reject or reassign delivery where enabled. | Assignment history and next owner are correct. |  |
| DEL-07 | Package status | Delivery status update changes shipment package status too. | Downstream courier/package view is aligned. |  |
| DEL-08 | Unauthorized order | Partner opens unassigned order URL. | Access is forbidden. |  |
| DEL-09 | Live courier | If selected, test label/booking/tracking/webhook. | Provider state syncs and failures are visible. |  |

## 21. CMS, Support, Notifications, Chat, Search, and Settings QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| MISC-01 | CMS banners | Publish/draft/delete homepage banner. | Storefront updates and deleted/draft content is hidden. |  |
| MISC-02 | Homepage sections | Create featured category/product/store section. | Storefront consumes published section correctly. |  |
| MISC-03 | Support | Customer submits support request; admin responds/status changes. | Request is traceable and status persists. |  |
| MISC-04 | Notifications | Trigger seller/order/payment/B2B/support emails. | Notification log stores rendered subject/body/context/provider ID or error. |  |
| MISC-05 | Retry notification | Retry failed notification. | Stored variables are reused and status updates. |  |
| MISC-06 | Chat/support | If enabled, exchange allowed messages. | Participant access and unread/state behavior are correct. |  |
| MISC-07 | Search | Product/store/service/B2B-relevant search paths. | Results are relevant and scoped to active/approved records. |  |
| MISC-08 | Market/currency | Switch supported country/currency where available. | Prices and cached FX display consistently. |  |
| MISC-09 | Settings persistence | Save checkout/payment/email/platform settings and restart/refetch. | Saved DB-backed values do not reset. |  |
| MISC-10 | Native dialogs | Scan major destructive actions. | Branded confirmation modal is used; no native `confirm`, `alert`, `prompt`. |  |

## 22. Responsive and Browser QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| RESP-01 | Mobile storefront | Test 360px, 390px, 430px widths. | Header, product cards, cart, checkout fit without overlap. |  |
| RESP-02 | Mobile seller | Test seller dashboard, nav, forms, tables. | Sidebar/nav is usable and forms do not overflow. |  |
| RESP-03 | Mobile admin | Test admin dashboard, forms, tables. | Responsive cards/table fallback are usable. |  |
| RESP-04 | Tablet | Test 768px to 1024px. | Layouts stay readable and actions remain visible. |  |
| RESP-05 | Desktop | Test 1366px and wide desktop. | Data-dense admin/seller pages remain aligned. |  |
| RESP-06 | Browsers | Chrome, Edge, Firefox, Safari where available. | No browser-specific blocking issue. |  |

## 23. Security, RBAC, Audit, and Negative QA

| Case ID | Area | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | Seller ownership | Seller opens another seller product/order/service/coupon/payout URL. | Forbidden with no data leak. |  |
| SEC-02 | Customer ownership | Customer opens another customer order/support URL. | Forbidden/not found safe response. |  |
| SEC-03 | Admin auth boundary | Clerk user tries admin APIs without admin token. | Admin APIs reject request. |  |
| SEC-04 | Finance boundary | Finance user tries full admin user/product/settings mutation. | Forbidden. |  |
| SEC-05 | Delivery boundary | Delivery partner opens unassigned order. | Forbidden. |  |
| SEC-06 | B2B boundary | Buyer opens another buyer enquiry/order. | Forbidden/not found safe response. |  |
| SEC-07 | Payment tamper | Modify payment amount/order ID/signature. | Verification fails and state is unchanged. |  |
| SEC-08 | Input validation | Submit invalid prices, quantities, dates, files, HTML/script strings. | Validation blocks or sanitizes safely. |  |
| SEC-09 | Audit sensitive actions | Change seller/product/order/payment/payout/settings. | Audit log includes actor, entity, old/new value, timestamp. |  |
| SEC-10 | Secret exposure | Inspect UI/API error states and logs shared with QA. | No provider secrets are shown. |  |

## 24. Seller Feature Completion Analysis

### 24.1 Completion Legend

| Status | Meaning |
| --- | --- |
| COMPLETE | Implemented in web/API/admin/finance surfaces for selected scope; ready for manual QA sign-off. |
| COMPLETE - PROVIDER DEPENDENT | Implemented, but real production behavior depends on provider account/key/webhook setup. |
| SELECTABLE | Not part of current selected web release unless client explicitly selects it as a full production feature. |
| QA PENDING | Browser-level evidence still needs to be recorded. |

### 24.2 Seller Feature Matrix

| Seller Feature Area | Implementation Verdict | Evidence Surface | Manual QA Cases |
| --- | --- | --- | --- |
| Seller sign-in | COMPLETE, QA PENDING | `/seller/sign-in`, Clerk seller session, app sync | AUTH-02 |
| Seller registration | COMPLETE, QA PENDING | `/seller/register`, seller registration API | SELLER-ONB-01 to 04 |
| Operational seller types | COMPLETE, QA PENDING | Marketplace seller, hyperlocal store, wholesale distributor | SELLER-ONB-02 |
| Pending approval state | COMPLETE, QA PENDING | `/seller/pending-approval`, admin approval flow | SELLER-ONB-05 |
| Seller rejection/suspension handling | COMPLETE, QA PENDING | Admin seller controls and seller route blocking | SELLER-ONB-06 to 08 |
| Seller dashboard | COMPLETE, QA PENDING | `/seller` | SELLER-PRO-01 |
| Seller profile/store profile | COMPLETE, QA PENDING | `/seller/profile`, `/seller/store-profile` | SELLER-PRO-02 to 06 |
| Location selectors | COMPLETE, QA PENDING | Async state/city/local-area/pincode selectors | SELLER-PRO-03 |
| Logo/banner/image upload | COMPLETE, QA PENDING | Asset-key upload and previews | SELLER-PRO-04 to 05 |
| Public seller/store page | COMPLETE, QA PENDING | `/stores`, `/stores/[slug]` | STORE-05, SELLER-PRO-06 |
| Seller subscription plan display | COMPLETE, QA PENDING | `/seller/subscription` | SELLER-SUB-01 |
| Admin seller subscription management | COMPLETE, QA PENDING | `/admin/seller-subscriptions` | SELLER-SUB-02 |
| Seller subscription product/B2B limits | COMPLETE, QA PENDING | Product create and B2B response guards | SELLER-SUB-03 to 04 |
| Razorpay seller subscription authorization | COMPLETE - PROVIDER DEPENDENT, QA PENDING | Seller subscription authorize/verify/cancel API | SELLER-SUB-05 to 07 |
| Seller product list/create/edit/archive | COMPLETE, QA PENDING | `/seller/products`, `/seller/products/new`, edit routes | SELLER-CAT-01 to 04 |
| Product variants, price, stock, images | COMPLETE, QA PENDING | Seller product form and product API | SELLER-CAT-02 to 06 |
| Admin product approval dependency | COMPLETE, QA PENDING | `/admin/products/approvals` | SELLER-CAT-05 |
| Seller-only product ownership | COMPLETE, QA PENDING | Seller product API guards | SELLER-CAT-07, SEC-01 |
| Seller order list/detail | COMPLETE, QA PENDING | `/seller/orders`, detail route | SELLER-ORD-01 to 02 |
| Seller fulfilment/status updates | COMPLETE, QA PENDING | Seller order status API and timeline | SELLER-ORD-03 to 06 |
| Seller manual delivery updates | COMPLETE, QA PENDING | `/seller/orders/[orderNumber]/delivery` | SELLER-ORD-05 to 07 |
| Settlement eligibility after fulfilment | COMPLETE, QA PENDING | Paid delivered split state | SELLER-ORD-08, FLOW-PROD |
| Seller wallet and ledger | COMPLETE, QA PENDING | `/seller/finance/wallet` | SELLER-FIN-01 |
| Seller payout details | COMPLETE, QA PENDING | Seller private payout profile | SELLER-FIN-02 |
| Seller manual payout request | COMPLETE, QA PENDING | `/seller/finance/payouts`, finance/admin payout APIs | SELLER-FIN-03 to 06 |
| Seller statements | COMPLETE, QA PENDING | `/seller/finance/statements` | SELLER-FIN-07 |
| Commission/GST/TDS/TCS/platform-fee deductions | COMPLETE, QA PENDING | Finance commission rules and settlements | SELLER-FIN-08 |
| Seller B2B enquiry list/detail/response | COMPLETE, QA PENDING | `/seller/b2b-enquiries` | SELLER-B2B-01 to 03 |
| Seller B2B order visibility | COMPLETE, QA PENDING | `/seller/b2b-orders` | SELLER-B2B-04 to 05 |
| Seller services | COMPLETE, QA PENDING | `/seller/services`, create/edit routes | SELLER-SVC-01 to 03 |
| Seller service bookings | COMPLETE, QA PENDING | `/seller/service-bookings` | SELLER-SVC-04 to 05 |
| Seller service calendar | COMPLETE, QA PENDING | `/seller/service-calendar` | SELLER-SVC-06 |
| Seller service reviews | COMPLETE, QA PENDING | `/seller/service-reviews` | SELLER-SVC-07 |
| Seller proof/evidence uploads | COMPLETE, QA PENDING | Service/return proof flows where enabled | SELLER-SVC-08, RET-04 |
| Seller coupons | COMPLETE, QA PENDING | `/seller/coupons` | SELLER-MKT-01 to 02 |
| Seller deals | COMPLETE, QA PENDING | `/seller/deals` | SELLER-MKT-03 |
| Seller product reviews | COMPLETE, QA PENDING | `/seller/reviews` | SELLER-MKT-04 |
| Seller returns | COMPLETE, QA PENDING | `/seller/returns` | SELLER-MKT-05 |
| Seller sales reports | COMPLETE, QA PENDING | `/seller/reports/sales` | SELLER-MKT-06 |
| Seller notifications | COMPLETE, QA PENDING | Notification logs for seller registration, approval, product, order, B2B | MISC-04 to 05 |
| Seller RBAC and ownership guards | COMPLETE, QA PENDING | API guards across seller-owned entities | SEC-01 |
| Seller auditability | COMPLETE, QA PENDING | Audit logs for seller/admin-sensitive actions | SEC-09 |
| Native seller mobile app | SELECTABLE | Not part of current web seller completion unless selected | Not in this release |
| Live courier API/GPS/OTP/POD for seller delivery | SELECTABLE | Full provider/mobile workflow required if selected | Not in this release |
| Fully automated provider-to-bank seller payouts | SELECTABLE | Current seller payout flow is manual/finance-controlled | Not in this release |

### 24.3 Final Seller-Side Analysis

The seller-side web implementation is complete for the currently selected marketplace release scope.

Implemented seller-side coverage includes:

- Seller authentication, registration, pending approval, approval, rejection, and suspension states.
- Marketplace seller, hyperlocal store, and wholesale distributor operational model.
- Seller dashboard, profile, store profile, normalized location selectors, logo/banner upload, and public store pages.
- Seller subscription plan selection, current subscription view, admin plan management, product/B2B limits, and Razorpay recurring authorization support where provider setup is available.
- Product catalogue management with seller-owned products, images, variants, price, stock, archive, admin approval, public storefront visibility, and ownership protection.
- Seller order management with seller-only order splits, fulfilment transitions, delivery updates, timelines, package status alignment, payment-status preservation, and settlement eligibility.
- Seller finance with wallet/ledger, payout details, manual payout request, finance/admin approval/rejection/mark-paid flow, statements, commission/tax/settlement fee deductions, and audit trails.
- B2B seller workflows with enquiry response, buyer-confirmation locking, and seller B2B order visibility.
- Service seller workflows with services, bookings, calendar, reviews, proof/evidence touchpoints, and service payment/receivable integration.
- Seller marketing and post-order tools: coupons, deals, product reviews, returns, sales reports, and seller notifications.
- RBAC, ownership boundaries, validation, audit logs, and sensitive workflow traceability.

The remaining work before claiming release-ready seller sign-off is not feature development. It is manual QA evidence collection using this document, especially:

- One full product order from customer checkout to seller fulfilment to delivery to finance payout.
- One full seller onboarding to admin approval to product approval to public storefront visibility.
- One full B2B enquiry from buyer creation to seller response to buyer confirmation to admin finalisation.
- One full seller service booking with payment/quote/booking state checks.
- One seller finance payout request through finance approval and statement verification.
- Negative ownership checks across seller products, orders, services, coupons, B2B, returns, reviews, wallet, and payouts.

## 25. Release Exit Criteria

Release or client-demo sign-off is allowed only when:

- All preflight automated commands pass or approved exceptions are logged.
- Critical and High manual QA cases pass or are explicitly waived by the decision owner.
- Customer purchase to seller fulfilment to delivery to finance payout passes.
- Seller onboarding, product approval, subscription, finance, B2B, service, and ownership tests pass.
- Payment flows used at launch pass in the target mode: COD, Razorpay test/live, bank transfer, or manual.
- Finance settlement, payout, ledger, and statement records reconcile with the test order data.
- Admin, finance, seller, customer, B2B, delivery, and courier role boundaries are verified.
- Audit logs exist for seller, product, order, payment, payout, settings, and policy-sensitive changes.
- Notification logs capture app-owned email events with subject/body/context/provider traceability.
- Responsive checks pass on mobile, tablet, and desktop.
- Any remaining failures have severity, owner, reproduction steps, and a release decision.

## 26. Supporting Documents

- `docs/production/00_PRODUCTION_TESTING_INDEX.md`
- `docs/production/01_CUSTOMER_STOREFRONT_AND_ACCOUNT_TESTING.md`
- `docs/production/02_CHECKOUT_ORDERS_RETURNS_TESTING.md`
- `docs/production/03_SELLER_PORTAL_TESTING.md`
- `docs/production/04_SERVICE_MARKETPLACE_TESTING.md`
- `docs/production/05_B2B_PORTAL_TESTING.md`
- `docs/production/06_ADMIN_PORTAL_TESTING.md`
- `docs/production/07_FINANCE_PAYMENTS_PAYOUTS_TESTING.md`
- `docs/production/08_DELIVERY_COURIER_TESTING.md`
- `docs/production/09_CMS_SUPPORT_NOTIFICATIONS_CHAT_TESTING.md`
- `docs/production/10_LOCATIONS_SEARCH_MARKET_SETTINGS_TESTING.md`
- `docs/production/11_SECURITY_RBAC_AUDIT_TESTING.md`
- `docs/production/12_PRODUCTION_E2E_REGRESSION_SMOKE_TESTING.md`
- `docs/production/13_AUTOMATED_TEST_COMMANDS.md`
- `docs/IndiHub_COD_REFUND_DESTINATION_MANUAL_QA.md`
- `docs/IndiHub_SERVICES_B2B_MANUAL_QA_CHECKLIST.md`
- `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md`
