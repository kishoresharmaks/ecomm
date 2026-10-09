# 1HandIndia - Project Status

Moved out of `AGENTS.md` so the rules file stays short. Update this file (not AGENTS.md) when features land or verification changes.
Last carried over from AGENTS.md: 2026-06-08 (entries below dated 2026-05-26 are historical; refresh the "Known gaps" section after the next verification pass).

## Foundation & Scope

- Documentation workspace prepared; Phase 1 documents retained for budget/approval history.
- Active governance requires full production implementation of any selected feature.
- Product technology stack is locked. Approved project budget: INR 200,000.
- UI screen list and database plan prepared.
- Brand palette locked for all web portals: primary `#ED3500`, secondary `#FFFCFB`.
- Stack: Turborepo, Next.js web app, NestJS API, worker app, shared packages, PostgreSQL, Prisma, Clerk.

## Implemented Modules

### Auth
- Clerk frontend sessions for customer/seller/B2B with stale-token refresh/retry and production-safe session-expired copy; API token verification, app user sync, local-dev fallback headers (non-admin only), RBAC guards and role checks.
- Clerk JWT verification fixed for local dev (matching keys required; `CLERK_JWT_KEY` supported).
- Admin uses standalone email/password login with DB-backed admin session tokens. Admin-only API routes do not accept Clerk sessions or local-dev headers.
- `/admin` shows the standalone login when signed out, returns to the requested route after login, revalidates stored sessions via `/api/admin/auth/me`, and shows the full sidebar only after admin authentication.

### Customer
- Account overview, profile, addresses, wishlist, cart, checkout, order placement, order history/detail, cancellation, public order tracking, support requests - frontend and backend.
- Fixed: concurrent customer/wishlist creation, default address promotion, suspended-seller checkout/wishlist blocks, stale stock decrement, unavailable variant selection, read-only profile email.
- Storefront: product listing/detail, cart, checkout, order success, tracking, CMS policy pages, CMS homepage banners/sections, public support/contact, public stores (`/stores`, `/stores/[slug]`).

### Payments
- Buyer checkout platform fee (percentage-of-subtotal or fixed-per-order) is separate from seller commission/settlement fees; saved atomically via admin settings; checkout/cart read server-priced totals; orders store INR plus buyer-currency fee snapshots.
- `/admin/payments`: Razorpay test/live mode, key ID/secret, webhook secret, COD enablement/max value/instructions, bank transfer, manual payment.
- Razorpay orders created server-side; storefront opens Razorpay Checkout; callback signatures verified server-side; verified captured payments mark order `PAID`; COD stays `PENDING`; webhook raw-body signature validation; late failed webhooks cannot downgrade a paid payment; duplicate checkout submits blocked transactionally.

### Finance Manager workspace (`/finance`)
- `FINANCE` users sign in with standalone credentials; admins can also access; finance users are blocked from admin-only routes.
- Covers dashboard metrics, COD collection verification, bank transfer verification (UTR/reference), payment status control, settlements, payouts, ledger, statements, reports, payment settings, platform fee controls.

### Seller center
- Onboarding/registration, pending/approved states, dashboard, viewport-aware sidebar, profile editing with normalized location selectors, asset-key-based logo/banner/product images, product list/create/edit/archive, order list/detail, seller order status updates, manual delivery updates, B2B enquiry response, sales reports.
- Fulfilment: status changes update the seller split transactionally, roll up order/delivery status, write seller/order/delivery timeline events, preserve payment status, keep settlement eligibility aligned for delivered paid orders, and return only that seller's own items/split.
- Seller finance: admin-managed commission/GST/TDS/TCS/platform-fee rules, settlement drafts, payout approval/mark-paid, append-only seller ledger, downloadable statements, read-only wallet/payout/statement pages.
- Seller-requested manual payouts: private bank/UPI details, eligible delivered/paid availability, request of the full eligible amount, transactional locking of order splits to prevent duplicates; admin approve/reject/mark-paid with references, audit logs, events, statements, ledger posting.

### Delivery partner workspace (`/delivery/*`)
- Admin assigns an active `DELIVERY_PARTNER` from the order delivery form; partners see only assigned orders; progress/tracking/date/note updates roll into order/delivery/seller timelines.
- Partners record COD cash collected (amount + note); admin verifies/rejects from admin order detail before COD becomes `PAID`.

### B2B buyer portal (`/b2b/*`)
- `/b2b`, register, company-profile, enquiries (list/new/detail), sign-in, sign-up. First-time business profile onboarding from a signed-in customer account, normalized procurement addresses, enquiry search/filter, creation, response display, buyer cancellation and quotation confirmation.
- Status workflow enforced: seller/admin response -> `RESPONDED`; buyer confirm -> `BUYER_CONFIRMED`; admin approve -> `ADMIN_APPROVED`; admin finalise -> `FINALISED`. Seller responses and buyer cancellations lock after buyer confirmation.

### Admin control panel
- Dashboard (compact command-center layout; `/admin` hides the normal page-title band), customers, users/roles (chip-based role management, responsive), sellers, seller approvals, products/approvals, orders/detail, B2B enquiries, business buyers, support, CMS pages/banners/sections, categories, reports, locations/import coverage, notifications, payment readiness, storage readiness, audit logs, platform settings.
- Homepage banners and sections use guided non-JSON forms (managed image upload/preview; featured category/product/store pickers); published items feed the storefront via `GET /api/cms/banners` and `GET /api/cms/homepage-sections`.
- Remove/delete semantics: users/customers/business buyers disabled, sellers suspended, orders/B2B/support closed or cancelled via status workflows, categories/products archived, CMS pages archived, CMS banners/sections deleted (audit-backed).
- Branded Headless UI confirmation modals guard destructive/lifecycle actions across customer, seller, B2B, admin and finance flows; no native `confirm`/`alert`/`prompt` in app source.
- Reports exclude cancelled orders from revenue metrics and use DB aggregates for seller/product totals.

### Notifications / email
- App-owned account, seller, product, order, payment, B2B and support emails create notification logs (rendered subject/body, context variables, provider id/error, status, retry). Providers: SMTP bridge/dev log, Brevo, Resend, SendGrid. Clerk/provider-side emails stay outside app logs by design. Event matrix: `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md`.

### Locations & currency
- DB-backed countries, states, cities, local areas, import/refresh runs, admin coverage view, async local-area search selectors (selected labels like `Mettu Street (636001)` keep searching by name/pincode).
- India data loaded in the dev DB: 36 states/UTs, 631 district/city nodes, 154k+ local-area/pincode rows via the CSV import path (API path was rate-limited).
- Multi-country/currency readiness for India, UAE, US, UK, Singapore; Frankfurter FX provider with DB caching.

### Backend hygiene
- Array-form `$transaction([...])` removed from `apps/api/src`; read-only finance collection listing no longer uses an interactive transaction; seller order status transactions avoid full relation fan-out reads; API tests pass with Node deprecations as failures.
- Seeds are production-safe (schema-only by default); seed no longer overwrites existing `Setting`/`EmailSetting` rows; settings readers coerce legacy value types.

## Verification History (condensed)

Standard gate set used throughout (all passing at last run):
`pnpm db:validate`, `pnpm --filter @indihub/api typecheck|lint|test|build`, `pnpm --filter @indihub/web typecheck|lint|test|build`.
Last recorded counts: API 20 test files / 75 tests; web 3 test files / 6 tests (stale Clerk token retry, auth error sanitisation, local-area label search normalization, admin setting value coercion).

Dated passes (2026-05-26 unless noted): modal/docs refresh; payment admin/COD/concurrency; homepage CMS storefront (draft records stay hidden); seller auth expiry polish; seller manual payout request (`db:generate`, `db:push` also run); seller order status/timeline; customer payment and seller fulfilment; delivery partner workspace; delivery COD collection (collection recorded, payment stays `PENDING` until admin verification, then `PAID` and settlement-eligible); admin dashboard/runtime export fix (`CodCollectionStatus`, API smoke-started on port 4011); admin dashboard compact layout; platform settings persistence; admin checkout/payment toggle UX; email notification tracking; Finance Manager workspace; Brevo provider; settings persistence hardening; settings readback hardening; production seed safety; local-area selector UX fix.
- 2026-10-09: Storefront & SEO Indexability Hardening — removed root-layout hardcoded canonical URL collision that caused search crawler deduplication back to homepage; enriched Schema.org JSON-LD (`Store`, `LocalBusiness`, `OnlineStore`, `Product`, `BreadcrumbList`); configured Google Search Console environment identifier fallback; added SSR initialData hydration for store (`/stores/[slug]`) and product (`/products/[slug]`) pages to deliver full markup to web crawlers; expanded sitemap limits to 1000 items each; verified `@indihub/web` (228 tests passing) and `@indihub/api` typecheck & lint.

## Known Gaps / Caveats

- Browser/manual QA was not run in the latest recorded pass (no web+API dev server pair started for a full interactive session). Code/build/API gates were green.
- Real Razorpay activation needs an approved account, valid test/live keys, Dashboard webhook URL/secret for the deployed domain, and a real test-mode transaction.
- Provider accounts (Razorpay, email provider, public/private storage, production DB, production Clerk keys, production domain/CORS) are configured only when the client is ready.

## Recommended Next Work

- Browser-level end-to-end QA across auth sync, customer checkout, seller approval/product management, B2B enquiries, admin reports/settings, support and location selectors, with web and API servers running together.
- Provider account configuration as above.