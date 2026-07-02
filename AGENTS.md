# AGENTS.md - 1HandIndia Workspace Instructions

This workspace is for the 1HandIndia multi-vendor ecommerce marketplace. Treat it as a serious production portal project, not a small demo.
 


## First Read Order

Before making project decisions or writing code, read these files in order:

1. `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`
2. `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`
3. `docs/IndiHub_PROJECT_SCOPE_AND_REQUIREMENTS.md`
4. `docs/IndiHub_BUILD_BLUEPRINT_MNC_PORTAL.md`
5. `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`
6. `docs/IndiHub_TECH_STACK_DECISION.md`
7. `docs/IndiHub_REQUIREMENT_COLLECTION_CHECKLIST.md`
8. `docs/IndiHub_BRAND_DIRECTION.md`
9. `docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md`
10. `docs/WORKSPACE_SKILL_LOADING_GUIDE.md`
11. `.agents/skills/beeshub-marketplace/SKILL.md`

## Product Target

Build 1HandIndia as a professional marketplace portal with the operational depth of a large ecommerce platform:

- Customer storefront.
- Vendor/seller center.
- B2B buyer portal.
- Admin control panel.
- Mobile apps.
- Courier workflow.
- Seller payouts.
- Advanced analytics.
- Trust, safety, support, and audit controls.

Customer and seller experiences must be treated as separate applications, even when they share the same monorepo, backend, database, brand system, or web deployment. Plan screens, navigation, authentication entry points, QA flows, and future mobile apps separately for customer and seller.

Do not copy Flipkart branding, UI, protected content, or proprietary design. The requirement is only to match the seriousness, polish, and feature completeness expected from a large ecommerce marketplace.

## Scope Rule

The active implementation governance source is:

`docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`

Historical Phase 1 documents remain useful for budget, client approval, and earlier implementation context, but they no longer limit the completeness of selected features. If the user approves or asks for a feature, implement the complete production marketplace version across the required backend, UI, permissions, audit, settings, provider, and test surfaces.

## Skill Guidance

Use these skill types during future work:

- `technical-writer` for client-facing and internal documentation.
- `project-planner` for roadmap, milestones, dependencies, and work breakdown.
- `fullstack-developer` for architecture, APIs, database, auth, and integrations.
- `frontend-skill` for polished UI/UX expectations.
- `api-design-ks` for production API contracts.
- `next-best-practices` if Next.js is chosen.
- `react-best-practices` after editing multiple React/TSX components.
- `code-reviewer` for security, performance, and production-readiness reviews.
- `debugger` when fixing concrete runtime errors.
- `verification` when a dev server or full flow needs end-to-end validation.

## Engineering Rules

- Keep business scope and implementation scope aligned.
- Do not silently remove client-approved features.
- Mark third-party fees, account approvals, and provider delays separately from development work.
- Use role-based access control from the beginning.
- Use audit logs for admin, vendor, payout, product, order, and policy-sensitive actions.
- Validate all user and vendor inputs.
- Keep admin, seller, customer, and B2B experiences clearly separated.
- Make the UI polished, responsive, and operationally useful.
- Prefer structured documents and typed schemas over ad hoc notes.
- Before a major implementation step, confirm the chosen stack and generated app structure.
- Do not use generic Phase 1, basic-only, future-scope, or later-upgrade language to reduce an actively selected feature.
- Use `docs/IndiHub_FINAL_TECH_STACK_LOCK.md` as the current locked product technology source.

## Current Status

Last updated: 2026-06-08.

Foundation and scope:

- Documentation workspace is prepared.
- Historical Phase 1 documents are retained for budget and approval history.
- Active scope governance now requires full production implementation for any selected feature.
- The current product technology stack is locked.
- Approved project budget is INR 200,000.
- UI screen list and database plan are prepared.
- Brand palette is locked for all web portals: primary `#ED3500`, secondary `#FFFCFB`.
- Implementation uses the locked Turborepo, Next.js web app, NestJS API, worker app, shared packages, PostgreSQL, Prisma, and Clerk foundation.

Completed or substantially implemented:

- Auth foundation is implemented with Clerk frontend sessions for customer/seller/B2B flows, stale-token refresh/retry, production-safe session-expired UI copy, API token verification, app user sync, local-dev fallback headers for non-admin development, RBAC guards, and role checks.
- Admin now uses a standalone email/password login and DB-backed admin session tokens. Admin API routes do not accept Clerk sessions or local-dev user headers for admin-only access.
- Admin portal UI now uses an admin-only login gate: `/admin` shows the standalone admin login when signed out, signed-out admin subroutes return to the requested route after login, stored admin sessions are revalidated through `/api/admin/auth/me`, and the full admin sidebar/navigation only appears after standalone admin authentication.
- Clerk JWT verification was fixed for local development. Matching frontend/backend Clerk keys are required, and `CLERK_JWT_KEY` is supported.
- Customer module is implemented end to end: account overview, profile, addresses, wishlist, cart, checkout, order placement, order history/detail, cancellation, public order tracking, and support requests.
- Customer backend APIs are implemented for profile, addresses, wishlist, cart, checkout/orders, tracking, cancellation, and support.
- Customer bugs already fixed include concurrent customer/wishlist creation, default address promotion, suspended-seller checkout/wishlist blocks, stale stock decrement, unavailable variant selection, and read-only profile email.
- Storefront product listing/detail, cart, checkout, order success, tracking, CMS policy pages, CMS homepage banners/sections, and public support/contact flows are present.
- Buyer checkout platform fee is implemented separately from seller commission/settlement fees. Admin settings can enable percentage-of-subtotal or fixed-per-order buyer-facing platform fee through an atomic save, checkout/cart read server-priced totals, and orders store INR plus buyer-currency fee snapshots.
- Razorpay/COD payments are now wired beyond backend readiness: admins can configure Razorpay test/live mode, key ID, key secret, webhook secret, COD enablement, COD max order value/instructions, bank transfer, and manual payment from `/admin/payments`; Razorpay checkout orders are created server-side, the storefront opens Razorpay Checkout for Razorpay orders, checkout callback signatures are verified server-side before payment state refresh, verified captured Razorpay payments mark the order payment status as `PAID`, COD orders remain `PENDING`, webhook signatures use raw-body validation, late failed webhooks cannot downgrade an already paid payment, and duplicate checkout submits for the same cart are blocked transactionally.
- Finance Manager workspace is implemented as a back-office finance surface: `FINANCE` users sign into `/finance` with standalone credentials, admins can also access it, finance users are blocked from full admin-only routes, and the workspace covers dashboard metrics, COD collection verification, bank transfer verification with UTR/reference capture, payment status control, settlements, payouts, ledger, statements, reports, payment settings, and checkout platform fee controls.
- Seller/admin/B2B backend foundation is present: seller product submission, admin product approval, B2B enquiry/response flow, admin readback, CMS, support, settings, reports, audit logs, payment readiness, notification logs, and storage readiness.
- Seller center is implemented and verified for marketplace operations: authenticated onboarding/registration, pending/approved seller states, dashboard, viewport-aware seller sidebar/navigation, profile editing with normalized location selectors, asset-key-based logo/banner upload, product list/create/edit/archive with asset-key-based product images, seller order list/detail, seller-side order status updates, manual delivery updates, B2B enquiry response, and sales report screens.
- Seller order fulfilment is wired end to end: seller status changes update the seller split transactionally, roll up order/delivery status where appropriate, write seller/order/delivery timeline events, preserve the existing payment status during fulfilment updates, keep settlement eligibility aligned for delivered paid orders, and return only that seller's own order items/split in seller APIs.
- Delivery partner web workspace is implemented: admins can assign an active `DELIVERY_PARTNER` user from the admin order delivery form, delivery partners can open `/delivery`, `/delivery/orders`, and `/delivery/orders/[orderNumber]`, only assigned orders are visible, delivery progress/tracking/date/note updates roll into normal order/delivery/seller timelines, delivery partners can record COD cash collected with amount and note, and admin verifies/rejects the collection from the admin order detail before COD is marked `PAID`.
- Seller finance is implemented as a standalone module: admin-managed commission/GST/TDS/TCS/platform-fee rules, settlement drafts, payout approval/mark-paid flow, append-only seller ledger, and downloadable seller statements, with seller read-only wallet/payout/statement pages.
- Seller-requested manual payouts are implemented: sellers maintain private bank/UPI payout details, see eligible delivered/paid payout availability, request the full currently eligible manual payout, and the backend transactionally locks eligible order splits to prevent duplicate requests. Admin finance keeps approve/reject/mark-paid controls, manual payment references, audit logs, events, statements, and ledger posting.
- B2B buyer portal frontend is implemented: `/b2b`, `/b2b/register`, `/b2b/company-profile`, `/b2b/enquiries`, `/b2b/enquiries/new`, `/b2b/enquiries/[id]`, `/b2b/sign-in`, and `/b2b/sign-up`. It supports first-time business profile onboarding from a signed-in customer account, normalized procurement addresses, enquiry list/search/status filtering, product/seller enquiry creation, response detail display, buyer-side cancellation, buyer quotation confirmation, and admin approval/finalisation.
- B2B enquiry status workflow is now enforced end to end: seller/admin responses move enquiries to `RESPONDED`, buyers can confirm responded quotations as `BUYER_CONFIRMED`, admins can approve confirmed enquiries as `ADMIN_APPROVED`, and admins can finalise approved enquiries as `FINALISED`. Seller responses and buyer cancellations are locked after buyer confirmation.
- Public store pages are present through `/stores` and `/stores/[slug]`, so approved sellers can have customer-facing storefront pages.
- Admin control panel is implemented for marketplace operations: dashboard, customers, users/roles, sellers, seller approvals, products/product approvals, orders/order detail, B2B enquiries, business buyers, support, CMS pages/banners/sections, categories, reports, locations/import coverage, notifications, payment readiness, storage readiness, audit logs, and platform settings.
- Transactional email tracking is fully documented and surfaced in admin notifications: app-owned account, seller, product, order, payment, B2B, and support emails create notification logs with rendered subject/body, context variables, provider id/error, status, retry support, and a full event matrix in `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md`. Supported app providers are SMTP bridge/dev log, Brevo, Resend, and SendGrid. Clerk and provider-side emails remain outside app logs by design.
- Admin dashboard has been redesigned as a compact operations command center with a polished welcome header, tighter live KPI cards, operations chart, quick actions, recent orders, platform health, and sales analytics. The `/admin` route hides the normal page-title band so the dashboard has a dedicated executive layout while other admin pages keep breadcrumbs and actions.
- Admin homepage banner create/edit is structured for non-technical operation: title, subtitle, managed image upload/preview, link, status, and sort order. Published banners power the storefront hero through `GET /api/cms/banners`.
- Admin homepage section create/edit uses guided non-JSON fields for section type, title, small label, description, CTA, sort/status, and repeatable item rows, so non-technical admins do not need to write JSON for homepage blocks. Featured category/product/store sections load existing admin records dynamically for one-click selection, and published sections are read by the storefront through `GET /api/cms/homepage-sections`.
- Admin sidebar/navigation is now responsive, scrollable, and active-route aware for the larger admin surface.
- Admin remove/delete coverage is implemented with safe semantics: users/customers/business buyers can be disabled, sellers can be suspended, orders/B2B/support can be closed or cancelled through status workflows, categories and products can be archived, CMS pages can be archived, and CMS banners/homepage sections can be deleted with audit-backed admin APIs.
- Branded Headless UI confirmation modals now guard destructive or lifecycle-changing actions across customer cart/account actions, seller product archive, B2B buyer cancellation/quotation confirmation, admin seller/product/B2B/user/customer actions, admin finance payout/settlement actions, and admin location coverage toggles. Native browser `confirm`, `alert`, and `prompt` calls are absent from app source.
- Admin Users & Roles page has an explicit responsive role-management layout: assigned roles render as removable chips, new roles are added from remaining available roles, mutation errors are visible, and mobile users see stacked management cards.
- Admin report calculations exclude cancelled orders from sales/product/seller revenue metrics and use database aggregates for seller/product report totals instead of loading unbounded transaction rows into memory.
- Location infrastructure is implemented: DB-backed countries, states/provinces, cities, local areas, import/refresh runs, admin coverage view, and async local-area search selectors.
- India location data is loaded for current development DB: 36 states/union territories, 631 district/city nodes, and more than 154k local-area/pincode rows from the Department of Posts/data.gov.in CSV import path. The API path was rate-limited, so the supported bulk CSV fallback is used for now.
- Multi-country/currency readiness is implemented for the approved markets India, UAE, US, UK, and Singapore, with Frankfurter as the free FX provider and DB caching.
- Backend Prisma transaction cleanup is complete for application code: array-form `$transaction([ ... ])` usage was removed from `apps/api/src`, read-only finance collection listing no longer uses an interactive transaction, seller order status transactions avoid full relation fan-out reads, and API tests pass with Node deprecations treated as failures.

Latest verified gates:

- `pnpm.cmd db:validate` passes.
- `pnpm.cmd --filter @indihub/api typecheck` passes.
- `pnpm.cmd --filter @indihub/api lint` passes.
- `pnpm.cmd --filter @indihub/api test` passes with 20 test files and 75 tests.
- `pnpm.cmd --filter @indihub/web typecheck` passes.
- `pnpm.cmd --filter @indihub/web lint` passes.
- `pnpm.cmd --filter @indihub/web build` passes and includes customer, seller, B2B, delivery partner, admin, and finance routes, including delivery routes under `/delivery/*`, B2B routes under `/b2b/*`, admin finance routes under `/admin/finance/*`, finance manager routes under `/finance/*`, seller finance routes under `/seller/finance/*`, and `/admin/settings/general`.
- `pnpm.cmd --filter @indihub/web test` passes with 3 web test files and 6 tests covering stale Clerk bearer-token retry, user-facing auth error sanitisation, local-area display-label search normalization, and admin setting value coercion.
- Seller-side live DB readiness was checked: sellers exist, approved sellers exist, products exist, and India location coverage is available to seller profile/onboarding selectors.
- 2026-05-26 modal/docs refresh verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 payment admin/COD/concurrency verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 homepage CMS storefront verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers admin-created published homepage banners appearing in `GET /api/cms/banners` and published homepage sections appearing in `GET /api/cms/homepage-sections`, while draft records remain hidden.
- 2026-05-26 seller auth expiry polish verification: `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. Web unit coverage verifies stale Clerk bearer-token refresh and sanitized user-facing auth errors.
- 2026-05-26 seller manual payout request verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass.
- 2026-05-26 seller order status/timeline verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers seller accept/dispatched transitions, seller/order/delivery timeline events, and seller-only order item/split response filtering.
- 2026-05-26 customer payment and seller fulfilment verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, and `pnpm.cmd --filter @indihub/api build` pass. API integration covers COD order placement staying `PENDING`, Razorpay order placement staying `PENDING` until verified captured checkout payment, verified Razorpay payment marking the order `PAID`, and seller fulfilment status updates preserving `paymentStatus`.
- 2026-05-26 delivery partner workspace verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers admin delivery-partner assignment, delivery-partner-only order visibility, forbidden seller access to delivery routes, delivery progress updates rolling up to order/seller timelines, and COD staying `PENDING` after delivery.
- 2026-05-26 delivery COD collection verification: `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd --filter @indihub/api lint`, `pnpm.cmd --filter @indihub/api test`, `pnpm.cmd --filter @indihub/api build`, `pnpm.cmd --filter @indihub/web typecheck`, `pnpm.cmd --filter @indihub/web lint`, `pnpm.cmd --filter @indihub/web test`, and `pnpm.cmd --filter @indihub/web build` pass. API integration covers delivery partner COD collection recording, payment staying `PENDING` until admin verification, admin verification marking COD payment `PAID`, and delivered paid seller splits becoming settlement-eligible.
- 2026-05-26 admin dashboard/runtime export verification: fixed the `CodCollectionStatus` runtime export for `npm run dev`, smoke-started the API with `npm.cmd run dev` on temporary port 4011, then stopped it. `pnpm.cmd --filter @indihub/database typecheck`, database lint, API typecheck/lint/test/build, and web typecheck/lint/test/build pass. Web production build includes `/admin`.
- 2026-05-26 admin dashboard compact layout refresh: removed the dashboard Recent Activity panel, tightened dashboard spacing/card sizes, and kept the dashboard focused on KPIs, operations, quick actions, recent orders, platform health, and sales analytics. `pnpm.cmd --filter @indihub/web typecheck`, web lint, web test, and web build pass.
- 2026-05-26 platform settings persistence verification: checkout platform fee settings now save atomically through `/api/admin/settings/checkout/platform-fee`, the admin UI clearly separates unsaved local changes from applied settings, and API integration verifies admin save/readback feeding cart checkout summary. `pnpm.cmd db:validate`, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 admin checkout/payment toggle UX refresh: `/admin/settings/general` checkout and payment toggles now stage changes locally, show an unsaved/saved status, and apply COD/Razorpay/bank-transfer/manual toggles together through the existing payment configuration save. Web typecheck/lint/test/build pass.
- 2026-05-26 email notification tracking verification: notification logs now persist rendered subject/body/context variables, retries reuse the stored variables, duplicate customer fulfilment emails are avoided when order and delivery statuses map to the same template, `/admin/notifications` shows subject/body/context/provider traceability, and `docs/IndiHub_EMAIL_NOTIFICATION_TRACKING.md` documents every app-owned email trigger. `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, `pnpm.cmd run db:push`, database typecheck, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 Finance Manager workspace verification: `FINANCE` users can sign into `/finance`, access finance/payment/platform-fee APIs, and are forbidden from full admin users/products/settings surfaces. Bank transfer checkout details and UTR/reference capture are wired through checkout, finance verification marks eligible offline payments/orders paid with audit/payment events, and finance reports summarize payment/settlement/payout state. `pnpm.cmd run db:generate`, `pnpm.cmd db:validate`, API typecheck/lint/test/build, web typecheck/lint/test/build, and a source scan for native `confirm`/`alert`/`prompt` calls pass.
- 2026-05-26 Brevo email provider verification: `brevo` is supported through the Brevo transactional email API using `BREVO_API_KEY`, admin email settings use a provider picker for SMTP/Brevo/Resend/SendGrid, and docs include Brevo setup. API typecheck/lint/test/build and web typecheck/lint/test/build pass.
- 2026-05-26 settings persistence hardening: `prisma/seed.ts` no longer overwrites existing platform `Setting` values or the existing `EmailSetting`, so admin-saved checkout/payment/platform-fee/email configuration survives seed reruns during local/dev/deploy bootstrap. Settings page form state now avoids overwriting unsaved checkout/payment toggle and platform-fee edits during background refetches. `pnpm.cmd db:validate`, API typecheck/lint/test/build, and web typecheck/lint/test/build pass.
- 2026-05-26 admin settings readback hardening: API and admin UI setting readers now coerce legacy string/number boolean values and string-stored numbers for checkout payment toggles, checkout platform fee, payout settings, payment readiness, and checkout pricing, so saved settings do not appear reset after dev-server restart or old DB rows. API tests include deprecations-as-errors and pass with 20 files/75 tests; web tests pass with 3 files/6 tests; `pnpm.cmd db:validate`, API typecheck/lint/build, web typecheck/lint/build pass.
- 2026-05-26 production seed safety hardening: `pnpm db:seed` now runs schema-only and creates or updates no data by default. Seed write modes are explicit through `pnpm db:seed:system` for RBAC reference rows and `pnpm db:seed:bootstrap` for local/dev bootstrap rows; production-like write modes are blocked unless `INDIHUB_ALLOW_PRODUCTION_SEED=true` is set for an approved one-time operation. Verification: `pnpm.cmd db:validate`, `pnpm.cmd --filter @indihub/api typecheck`, `pnpm.cmd db:seed` passed as no-write schema mode, and production-like `pnpm.cmd db:seed:bootstrap` refused to run before writes.
- 2026-05-26 local-area selector UX fix: selected local-area labels like `Mettu Street (636001)` now continue searching by area name/pincode instead of showing a false `No matching local areas` dropdown. The selected area is retained while async results refresh, and the public locations API also accepts display-label search terms. API/web typecheck, lint, test, and build pass.

Important caveats:

- This workspace is not currently a git checkout, so use direct file inspection instead of relying on `git status` or `git diff`.
- Do not print Clerk or provider secrets from `.env` files. Only report key names, lengths, or configuration presence when needed.
- Standalone admin login needs backend env `INDIHUB_FIRST_ADMIN_EMAIL` and `INDIHUB_FIRST_ADMIN_PASSWORD` for first setup, with optional `ADMIN_SESSION_TTL_HOURS`.
- `pnpm db:seed` is production-safe schema-only and creates no data by default. Use `pnpm db:seed:system` only for approved RBAC reference setup and `pnpm db:seed:bootstrap` only for local/dev or approved one-time bootstrap. Production-like write modes require `INDIHUB_ALLOW_PRODUCTION_SEED=true`.
- The currently connected DB may be pre-production/staging. Do not run DB-writing integration tests, bootstrap seed modes, location imports, cleanup scripts, or ad hoc mutation scripts against it unless the user explicitly approves that exact write operation. The backend integration suite is opt-in only and must use a local disposable PostgreSQL database whose name includes `test`, `e2e`, or `integration` with `INDIHUB_ALLOW_INTEGRATION_TEST_DB=true`.
- Local web normally runs at `http://localhost:3000`; local API normally runs at `http://localhost:4000/api`, but always verify running processes before assuming they are active.
- Browser/manual QA was not run in the latest verification pass because no web/API dev server pair was started for a full interactive session. The code/build/API gates are green.
- Razorpay keys and COD rules can be managed from `/admin/payments`; real Razorpay activation still requires an approved Razorpay account, valid test/live keys, Dashboard webhook URL/secret configuration for the deployed domain, and a real Razorpay test-mode transaction.

Recommended next work:

- Run browser-level end-to-end QA across auth sync, customer checkout, seller approval/product management, B2B enquiries, admin reports/settings, support, and location selectors after starting the web/API servers together.
- Configure real provider accounts only when the client is ready: Razorpay, email provider, public/private storage providers, production database, production Clerk keys, and production domain/CORS.

- When updating delivery statuses in `orders.service.ts` (e.g., in shared delivery update flows), ensure that both `orderShipment` and `orderShipmentPackage` statuses are updated together. Use `this.packageStatusFromDeliveryStatus` to derive the correct package status, as downstream workspaces (like Courier) depend on `orderShipmentPackage.status`.
