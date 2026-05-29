---
name: indihub-marketplace
description: Use for all work in the 1HandIndia multi-vendor ecommerce marketplace workspace, including scope review, architecture, implementation planning, full-stack development, mobile app planning, vendor/B2B/B2C/admin features, and production-readiness checks.
---

# 1HandIndia Marketplace Skill

## Purpose

Use this skill when working in `E:\PROJECT WORKS\Clients\ecomm`.

1HandIndia is planned as a large multi-vendor ecommerce marketplace with B2C, B2B, vendors/sellers, nearby stores, admin panel, mobile apps, courier integration, payouts, analytics, support, and trust controls.

## Required Read Order

Before planning or coding, read:

1. `AGENTS.md`
2. `README.md`
3. `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`
4. `docs/IndiHub_PROJECT_SCOPE_AND_REQUIREMENTS.md`
5. `docs/IndiHub_BUILD_BLUEPRINT_MNC_PORTAL.md`
6. `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`
7. `docs/IndiHub_TECH_STACK_DECISION.md`
8. `docs/IndiHub_REQUIREMENT_COLLECTION_CHECKLIST.md`
9. `docs/IndiHub_BRAND_DIRECTION.md`
10. `docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md`
11. `docs/WORKSPACE_SKILL_LOADING_GUIDE.md`

## Product Target

Build like a serious large ecommerce portal, similar in operational depth to Flipkart, without copying Flipkart branding, layout, text, or proprietary behavior.

Quality expectations:

- Professional customer storefront.
- Strong seller/vendor center.
- Dedicated B2B buyer workflow.
- Powerful admin panel.
- Mobile app-ready backend.
- Secure payments and seller payouts.
- Courier tracking workflow.
- Reports, audit logs, and production controls.

## Scope Source

The current final scope source is:

`docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`

If the user changes scope in chat, update this document or create a clear scope-change note before implementation.

## Current Frozen Phase 1 Includes

- Web-first multi-vendor marketplace.
- Customer storefront.
- Customer account basics.
- Vendor/seller/nearby-store onboarding.
- Seller dashboard.
- Product and catalogue management.
- Cart, checkout, and order placement.
- Manual order status and delivery tracking.
- Manual delivery partner/courier detail tracking.
- Manual delivery partner web workspace and admin assignment for assigned delivery tasks.
- Basic B2B enquiry and quotation request flow.
- Admin panel.
- Payment gateway readiness.
- Transactional email notifications.
- Basic reports.
- CMS and policy pages.
- Role-based access foundation.
- Basic audit logs.

## Future Upgrade Scope

- Native Android and iOS apps.
- Dedicated seller mobile app.
- Live courier API tracking.
- Delivery partner mobile app, GPS tracking, OTP, proof-of-delivery, and automated delivery partner payouts.
- Automated seller payouts.
- Advanced RFQ, quotation comparison, PO upload, and B2B approval workflows.
- Chatbot, buyer-seller realtime chat, loyalty, abandoned cart automation, advanced analytics, multi-language, and multi-currency.

## Locked Phase 1 Stack

- Monorepo: Turborepo + pnpm.
- Web: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui.
- API: NestJS REST API with OpenAPI.
- Database: PostgreSQL with Prisma.
- Auth: Clerk for identity, PostgreSQL-backed RBAC for app permissions.
- Cache/jobs: Redis + BullMQ.
- Search: PostgreSQL indexed search for Phase 1; Meilisearch later.
- Storage: portable asset keys in the database, with ImageKit or S3-compatible storage configurable for public images and S3-compatible storage for private documents.
- Payments: admin-managed Razorpay Checkout, server-side checkout signature verification, signed webhook handling, COD max/instructions, bank transfer, and manual toggles.
- Delivery: Manual delivery/courier records in Phase 1.
- Email: Adapter-based transactional emails with templates and logs.

Do not scaffold native mobile apps, live courier API, GPS tracking, delivery OTP/proof-of-delivery, automated payouts, SMS/WhatsApp automation, PostHog analytics, realtime chat, or advanced B2B RFQ/PO workflows in Phase 1 unless approved as change requests.

## Development Workflow

1. Confirm stack and implementation milestone.
2. Scaffold project only after scope and stack are clear.
3. Build auth and role model early.
4. Build database schema before feature UI.
5. Build customer, seller, B2B, and admin surfaces separately.
6. Keep third-party integrations behind provider adapters.
7. Add audit logs for sensitive actions.
8. Verify full flows end-to-end before claiming readiness.

## Current Implementation Status

Last updated: 2026-05-26.

Foundation:

- Phase 1 implementation is underway on the locked stack.
- Turborepo, Next.js web app, NestJS API, worker app, shared packages, PostgreSQL, Prisma, and Clerk foundation are in place.
- The current web portal palette is primary `#ED3500` and secondary `#FFFCFB`; keep storefront, customer, seller, B2B, and admin UI aligned to these shared tokens.
- Local web normally runs at `http://localhost:3000`.
- Local API health endpoint normally runs at `http://localhost:4000/api/health`.
- `pnpm db:seed` is production-safe schema-only and creates no data by default. Use `pnpm db:seed:system` only for approved RBAC reference setup and `pnpm db:seed:bootstrap` only for local/dev or approved one-time bootstrap. Production-like write modes require `INDIHUB_ALLOW_PRODUCTION_SEED=true`.
- This workspace is not currently a git checkout, so verify changes through file reads, package scripts, and direct command output.

Completed or substantially implemented:

- Clerk auth foundation for customer/seller/B2B flows, stale-token refresh/retry, production-safe session-expired UI copy, app user sync, RBAC guards, role checks, API token verification, and local-dev auth fallback for non-admin development.
- Standalone admin email/password login with DB-backed admin session tokens. Admin-only API routes require the standalone admin bearer token and do not accept Clerk sessions or local-dev user headers.
- Admin portal UI is gated by a minimal standalone admin login screen. `/admin` and signed-out admin subroutes no longer show the full sidebar; successful login opens the dashboard or returns to the originally requested admin page.
- Customer module Phase 1 end-to-end flow: account overview, profile, addresses, wishlist, cart, checkout, order placement, order history/detail, cancellation, public tracking, and support.
- Customer API coverage for profile, addresses, wishlist, cart, checkout/orders, tracking, cancellation, and support.
- Storefront pages for product browsing, product detail, cart, checkout, order success, tracking, policy pages, CMS homepage banners/sections, and public support/contact.
- Razorpay/COD payment flow is wired beyond readiness: admins manage Razorpay mode/keys/webhook secret and COD rules from `/admin/payments`; customer checkout opens Razorpay Checkout when Razorpay is selected, backend creates/reuses provider orders, verifies checkout signatures server-side, fetches provider payment state, captured Razorpay verification marks orders `PAID`, COD orders remain `PENDING`, signed webhooks update payment/order state without downgrading already-paid payments, COD availability follows admin limits, and duplicate checkout submits for the same cart are transactionally blocked.
- Buyer checkout platform fee is admin-managed separately from seller commission/settlement fees. The checkout platform-fee form saves enabled/type/value/fixed amount atomically, shows unsaved changes before they are applied, and cart/checkout/order totals read the server-priced fee settings.
- Finance Manager workspace is implemented as a manual Phase 1 finance surface: `FINANCE` users sign into `/finance` with standalone back-office credentials, admins can also access it, finance users are blocked from full admin-only routes, and the workspace covers dashboard metrics, COD collection verification, bank transfer verification with UTR/reference capture, payment status control, settlements, payouts, ledger, statements, reports, payment settings, and checkout platform fee controls.
- Seller/admin/B2B backend foundation: seller product submission, admin product approval, B2B enquiry and response, admin readback, CMS, support, settings, reports, audit logs, payment readiness, notification logs, and storage readiness.
- Seller center Phase 1 operations: authenticated onboarding/registration, pending/approved seller states, dashboard, viewport-aware seller sidebar/navigation, profile editing with normalized location selectors, asset-key-based logo/banner upload, product list/create/edit/archive with asset-key-based product images, seller order list/detail, seller-side status updates, manual delivery updates, B2B enquiry response, and sales report screens.
- Seller order fulfilment is wired end to end: seller status changes update the seller split transactionally, roll up order/delivery status where appropriate, write seller/order/delivery timeline events, preserve the existing payment status during fulfilment updates, keep settlement eligibility aligned for delivered paid orders, and return only that seller's own order items/split in seller APIs.
- Delivery partner web workspace is implemented as a Phase 1 scope update: admins assign active delivery partner users from admin order delivery controls, partners access `/delivery`, `/delivery/orders`, and `/delivery/orders/[orderNumber]`, assigned-order APIs are role-guarded, partner delivery updates roll up order/delivery/seller timelines, partners can record COD cash collected with amount and note, admin verifies or rejects the collection from order detail, and COD payment state remains admin/payment-flow controlled until verification.
- Seller-requested manual payouts are implemented for Phase 1: sellers maintain private bank/UPI payout details, see eligible delivered/paid payout availability, request the full currently eligible manual payout, and the backend transactionally locks eligible order splits to prevent duplicate requests. Admin finance keeps approve/reject/mark-paid controls, manual payment references, audit logs, events, statements, and ledger posting. RazorpayX/automated payouts are intentionally left as a future provider behind the same status flow.
- B2B buyer portal Phase 1 operations: business onboarding/registration, company profile, normalized procurement addresses, enquiry list/search/status filtering, product/seller enquiry creation, response detail display, buyer-side cancellation, buyer quotation confirmation, and admin approval/finalisation through `/b2b/*` and `/admin/b2b-enquiries`.
- B2B enquiry status workflow is enforced by backend transition rules: `RESPONDED -> BUYER_CONFIRMED -> ADMIN_APPROVED -> FINALISED`, with cancellation/closure rules and seller response locking after buyer confirmation.
- Public store pages through `/stores` and `/stores/[slug]` for approved sellers.
- Admin control panel Phase 1 operations: dashboard, customers, users and roles, sellers/seller approvals, products/product approvals, orders/order detail with status and delivery updates, B2B enquiries, business buyers, support requests, CMS pages/banners/homepage sections, categories, reports, location coverage/import runs, notification logs, payment readiness, storage readiness, audit logs, and platform settings.
- Transactional email tracking is fully documented and admin-auditable: account, seller, product, order, payment, B2B, and support emails create notification logs with rendered subject/body, context variables, provider id/error, status, and retry support. Supported app providers are SMTP bridge/dev log, Brevo, Resend, and SendGrid. The complete event matrix lives in `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md`; Clerk and provider-side emails remain separate from app logs.
- Admin dashboard is redesigned as a compact polished operations command center with tighter live KPI cards, operations chart, quick actions, recent orders, platform health, and sales analytics. The `/admin` route uses a dashboard-specific header while other admin pages keep the standard title/breadcrumb/action band.
- Homepage banner create/edit is non-technical: admins manage title, subtitle, managed image upload/preview, link, status, and sort order. Published banners are consumed by the storefront hero through `GET /api/cms/banners`.
- Homepage section create/edit is non-technical: admins use guided fields and repeatable item rows instead of raw JSON config, with dynamic one-click selection from existing categories, approved products, and approved stores where the section type supports it. Published sections are consumed by the storefront through `GET /api/cms/homepage-sections`.
- Admin sidebar/navigation is responsive, scrollable, and active-route aware.
- Admin removal controls use production-safe behavior: disable users/customers/business buyers, suspend sellers, archive products/categories/CMS pages, delete CMS banners/homepage sections, and rely on status workflows for orders, B2B enquiries, support requests, logs, and audit-sensitive records.
- Branded Headless UI confirmation modals guard destructive or lifecycle-changing actions across customer cart/account actions, seller product archive, B2B cancellation/quotation confirmation, admin seller/product/B2B/user/customer actions, admin finance payout/settlement actions, and admin location coverage toggles. Native browser `confirm`, `alert`, and `prompt` calls are absent from app source.
- Admin Users & Roles has a responsive operational layout with per-role remove chips, add-only-available role selection, visible role mutation errors, profile badges, and mobile management cards.
- Admin reporting logic excludes cancelled orders from sales/product/seller revenue metrics and uses DB aggregation for seller/product totals to avoid unbounded row loading.
- Customer bug pass completed: fixed concurrent customer/wishlist creation, default address behavior, suspended-seller checkout/wishlist blocks, stale stock decrement, unavailable variant selection, profile email read-only state, and pg transaction deprecation warnings.
- Multi-country/currency readiness for India, UAE, US, UK, and Singapore with Frankfurter free FX caching.
- DB-backed location infrastructure, admin coverage view, import/refresh tracking, async local-area search, all 36 India states/UTs, and India pincode/local-area import from Department of Posts/data.gov.in CSV. Current development DB has 36 India states/UTs, 631 district/city nodes, and more than 154k local-area/pincode rows.

Latest verified gates:

- DB schema validate passes.
- API typecheck passes.
- API lint passes.
- API tests pass: 20 files, 75 tests.
- Web typecheck passes.
- Web lint passes.
- Web production build passes and includes customer, seller, B2B, delivery partner, admin, and finance routes, including `/delivery`, `/delivery/orders`, `/delivery/orders/[orderNumber]`, `/b2b`, `/b2b/register`, `/b2b/company-profile`, `/b2b/enquiries`, `/b2b/enquiries/new`, `/b2b/enquiries/[id]`, `/b2b/sign-in`, `/b2b/sign-up`, `/finance/*`, admin finance routes, seller finance routes, and `/admin/settings/general`.
- Web tests pass with 3 web test files and 6 tests covering stale Clerk bearer-token retry, user-facing auth error sanitisation, local-area display-label search normalization, and admin setting value coercion.
- Seller-side DB readiness was checked: sellers exist, approved sellers exist, products exist, and India location coverage is available to profile/onboarding selectors.
- 2026-05-26 modal/docs refresh verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 payment admin/COD/concurrency verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 homepage CMS storefront verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers admin-created published homepage banners appearing in `GET /api/cms/banners` and published homepage sections appearing in `GET /api/cms/homepage-sections`, while draft records remain hidden.
- 2026-05-26 seller auth expiry polish verification: `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. Web unit coverage verifies stale Clerk bearer-token refresh and sanitized user-facing auth errors.
- 2026-05-26 seller manual payout request verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 seller order status/timeline verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers seller accept/dispatched transitions, seller/order/delivery timeline events, and seller-only order item/split response filtering.
- 2026-05-26 customer payment and seller fulfilment verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, and `pnpm.cmd --filter @indihub/api build` pass. API integration covers COD order placement staying `PENDING`, Razorpay order placement staying `PENDING` until verified captured checkout payment, verified Razorpay payment marking the order `PAID`, and seller fulfilment status updates preserving `paymentStatus`.
- 2026-05-26 delivery partner workspace verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers admin assignment, role-guarded assigned order visibility, partner delivery updates rolling into timelines, and COD staying pending after delivery.
- 2026-05-26 delivery COD collection verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers delivery partner COD collection recording, payment staying `PENDING` until admin verification, admin verification marking COD payment `PAID`, and delivered paid seller splits becoming settlement-eligible.
- 2026-05-26 admin dashboard/runtime export verification: fixed the `CodCollectionStatus` runtime export for `npm run dev`, smoke-started the API with `npm.cmd run dev` on temporary port 4011, then stopped it. `pnpm.cmd --filter @indihub/database typecheck`, database lint, API typecheck/lint/test/build, and web typecheck/lint/test/build pass. Web production build includes `/admin`.
- 2026-05-26 admin dashboard compact layout refresh: removed the dashboard Recent Activity panel, tightened dashboard spacing/card sizes, and kept the dashboard focused on KPIs, operations, quick actions, recent orders, platform health, and sales analytics. Web typecheck, lint, test, and production build pass.
- 2026-05-26 platform settings persistence verification: checkout platform fee settings now save atomically through `/api/admin/settings/checkout/platform-fee`, the admin UI clearly separates unsaved local changes from applied settings, and API integration verifies admin save/readback feeding cart checkout summary. DB validate, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 admin checkout/payment toggle UX refresh: `/admin/settings/general` checkout and payment toggles now stage changes locally, show an unsaved/saved status, and apply COD/Razorpay/bank-transfer/manual toggles together through the existing payment configuration save. Web typecheck/lint/test/build pass.
- 2026-05-26 Finance Manager workspace verification: `FINANCE` users can sign into `/finance`, access finance/payment/platform-fee APIs, and are forbidden from full admin users/products/settings surfaces. Bank transfer checkout details and UTR/reference capture are wired through checkout, finance verification marks eligible offline payments/orders paid with audit/payment events, and finance reports summarize payment/settlement/payout state. DB generate/validate, API typecheck/lint/test/build, web typecheck/lint/test/build, and a source scan for native `confirm`/`alert`/`prompt` calls pass.
- 2026-05-26 email notification tracking verification: notification logs persist rendered subject/body/context variables, retries reuse stored variables, duplicate customer fulfilment emails are avoided when order and delivery statuses map to the same template, `/admin/notifications` shows subject/body/context/provider traceability, and `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md` documents every app-owned email trigger. `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, database typecheck, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 Brevo email provider verification: `brevo` is supported through the Brevo transactional email API using `BREVO_API_KEY`, admin email settings use a provider picker for SMTP/Brevo/Resend/SendGrid, and docs include Brevo setup. API typecheck/lint/test/build and web typecheck/lint/test/build pass.
- 2026-05-26 settings persistence hardening: `prisma/seed.ts` no longer overwrites existing platform `Setting` values or the existing `EmailSetting`, so admin-saved checkout/payment/platform-fee/email configuration survives seed reruns during local/dev/deploy bootstrap. Settings page form state now avoids overwriting unsaved checkout/payment toggle and platform-fee edits during background refetches. `pnpm.cmd db:validate`, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 admin settings readback hardening: API and admin UI setting readers now coerce legacy string/number boolean values and string-stored numbers for checkout payment toggles, checkout platform fee, payout settings, payment readiness, and checkout pricing, so saved settings do not appear reset after dev-server restart or old DB rows. API tests include deprecations-as-errors and pass with 20 files/75 tests; web tests pass with 3 files/6 tests; DB validate, API typecheck/lint/build, and web typecheck/lint/build pass.
- 2026-05-26 production seed safety hardening: `pnpm db:seed` now runs schema-only and creates or updates no data by default. Seed write modes are explicit through `pnpm db:seed:system` for RBAC reference rows and `pnpm db:seed:bootstrap` for local/dev bootstrap rows; production-like write modes are blocked unless `INDIHUB_ALLOW_PRODUCTION_SEED=true` is set for an approved one-time operation. Verification: DB validate, API typecheck, `pnpm.cmd db:seed` passed as no-write schema mode, and production-like `pnpm.cmd db:seed:bootstrap` refused to run before writes.
- 2026-05-26 local-area selector UX fix: selected local-area labels like `Mettu Street (636001)` now continue searching by area name/pincode instead of showing a false `No matching local areas` dropdown. The selected area is retained while async results refresh, and the public locations API also accepts display-label search terms. API/web typecheck, lint, test, and build pass.

Recommended next implementation step:

- Run browser-level end-to-end verification across auth, customer checkout, seller approval/product management, B2B enquiries, admin reports/settings, support, and location selectors.
- Keep real provider setup separate from development work: Razorpay approved account/test/live keys, Razorpay Dashboard webhook URL/secret and test transaction, email provider, public/private storage providers, production database, production Clerk keys, and domain/CORS. Razorpay/COD toggles and secrets can be managed from `/admin/payments`.

## Risk Rules

- Do not add future-upgrade features into the INR 200,000 frozen Phase 1 without a change request.
- Do not silently remove advanced features.
- Do not hardcode one seller, one category, or one business.
- Do not mix customer, seller, B2B, and admin permissions.
- Do not store provider secrets in source code.
- Do not treat third-party account charges as development cost.
