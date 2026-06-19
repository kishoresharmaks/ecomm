# 1HandIndia Phase 1 End-to-End Implementation Checklist

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Historical End-to-End Build Checklist and Progress Tracker  
**Prepared Date:** 23-05-2026  
**Scope Source:** `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`  
**Active Scope Governance:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`  
**Implementation Source:** `docs/IndiHub_IMPLEMENTATION_START_PHASE1.md`  
**Approved Phase 1 Budget:** INR 200,000  
**Current Build Direction:** Full production implementation for selected features  

> This checklist is retained for historical build progress. From 08-06-2026 onward, selected features follow the full implementation governance rule and must not be reduced to Phase 1-only or basic-only scope.

## 1. Status Legend

| Status | Meaning |
|---|---|
| DONE | Implemented and passed available validation/build checks. |
| PARTIAL | Some foundation exists, but more work is required before launch. |
| NEXT | Recommended immediate implementation item. |
| TODO | Not yet implemented in the application. |
| CLIENT | Waiting for client/provider details, content, account approval, or decision. |
| SELECTABLE | Not currently implemented, but available for full implementation when selected. |

## 2. Current Project Snapshot

| Area | Current Status | Notes |
|---|---|---|
| Historical scope record | DONE | Original Phase 1 budget/scope record is retained for INR 200,000 approval history. |
| Brand name | DONE | Brand name is locked as 1HandIndia. |
| Logo | CLIENT | Logo will be designed later. Temporary text logo can be used. |
| Brand colors | DONE | Elegant color palette is documented in `docs/IndiHub_BRAND_DIRECTION.md`. |
| Tech stack | DONE | Current product stack is locked. |
| UI screen plan | DONE | UI screen list and database plan are documented. |
| UI mockup images | DONE | Planning images exist under `docs/ui-screen-images/`. |
| Monorepo scaffold | DONE | Turborepo + pnpm workspace exists. |
| Backend foundation | DONE | NestJS API, Prisma, auth guard, RBAC, modules, provider readiness, notifications, and core APIs are implemented. |
| Backend logic audit | DONE | 23-05-2026 audit completed; patched Razorpay raw-body webhook verification, disabled-user auth blocking, seller/product/B2B/category edge cases. |
| Frontend foundation | DONE | Storefront, customer account, seller center, B2B buyer portal, admin operations, finance, locations, CMS, support, reports, and shared branded confirmation dialogs are implemented. |
| Worker foundation | DONE | Worker scaffold and email notification queue processor are wired. |
| Local database | DONE | Local PostgreSQL `indihub_test` is reachable; `pnpm db:push` passed. `pnpm db:seed` is now production-safe schema-only and creates no data by default. |
| API verification | DONE | Latest backend typecheck, lint, unit tests, and PostgreSQL-backed API integration tests passed. |
| Full E2E QA | TODO | Code/build/API gates are green; browser-level QA with the web and API servers running together is still pending before client demo. |

## 3. Documentation and Planning Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Final Phase 1 scope confirmation | DONE | `IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md` |
| 2 | Approved budget record | DONE | INR 200,000 locked in scope document. |
| 3 | Brand direction document | DONE | Brand name, colors, logo status documented. |
| 4 | UI screen list and database plan | DONE | Public, customer, seller, B2B, and admin screens mapped. |
| 5 | Final tech stack lock | DONE | Next.js, NestJS, PostgreSQL, Prisma, Clerk, Redis, portable asset-key image storage, Razorpay/COD-ready. |
| 6 | Implementation milestone notes | DONE | Current progress tracked in implementation document. |
| 7 | Workspace skill/instruction setup | DONE | Project-specific skill and AGENTS instructions exist. |
| 8 | End-to-end checklist | DONE | This document. |
| 9 | Client content collection checklist | PARTIAL | Required details are documented; actual client values still pending. |
| 10 | Launch handover checklist | TODO | Create after browser QA and deployment provider details are confirmed. |

## 4. Repository and Tooling Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Turborepo workspace | DONE | Root monorepo created. |
| 2 | pnpm workspace | DONE | `pnpm-workspace.yaml` exists. |
| 3 | Next.js web app | DONE | App scaffolded in `apps/web`. |
| 4 | NestJS API app | DONE | App scaffolded in `apps/api`. |
| 5 | Worker app | DONE | App scaffolded in `apps/worker`. |
| 6 | Shared config package | DONE | `packages/config` exists. |
| 7 | Shared UI package | DONE | `packages/ui` exists. |
| 8 | Shared types package | DONE | `packages/shared-types` exists. |
| 9 | Shared validators package | DONE | `packages/validators` exists. |
| 10 | Database package | DONE | `packages/database` exists. |
| 11 | Shared TypeScript config | DONE | `packages/tsconfig` exists. |
| 12 | Shared ESLint config | DONE | `packages/eslint-config` exists. |
| 13 | Environment template | DONE | Base env structure exists. |
| 14 | GitHub Actions CI skeleton | DONE | CI skeleton created. |
| 15 | Production environment variable documentation | PARTIAL | `.env.example` now includes core provider keys; deployment-specific values still pending. |
| 16 | Deployment scripts/checklist | TODO | Needed before launch. |

## 5. Database and Prisma Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Prisma schema foundation | DONE | Core marketplace entities are modeled. |
| 2 | Prisma 7 configuration | DONE | Config exists through `prisma.config.ts`. |
| 3 | Generated Prisma client | DONE | Client generated under database package. |
| 4 | UUID primary keys | DONE | Schema uses UUID IDs for business tables. |
| 5 | Money stored in paise | DONE | Order, product, payment, and quotation values use paise fields. |
| 6 | User, role, permission tables | DONE | RBAC schema exists. |
| 7 | Customer tables | DONE | Customer, address, wishlist tables exist. |
| 8 | Seller operational tables | DONE | Seller profile, address, document, operational type, and separate business entity fields exist. |
| 9 | Business buyer tables | DONE | Business buyer and address tables exist. |
| 10 | Catalogue tables | DONE | Categories, products, images, variants, inventory movement. |
| 11 | Cart and checkout tables | DONE | Cart, cart item, checkout session. |
| 12 | Order tables | DONE | Orders, order items, seller splits, status events. |
| 13 | Manual delivery tables | DONE | Delivery details and events. |
| 14 | Payment readiness tables | DONE | Payment and payment event tables. |
| 15 | B2B enquiry tables | DONE | Enquiry and response tables. |
| 16 | CMS tables | DONE | Banners, CMS pages, homepage sections. |
| 17 | Support request table | DONE | Support/contact request table exists. |
| 18 | Notification tables | DONE | Templates, logs, and email settings. |
| 19 | Settings table | DONE | Platform settings table exists. |
| 20 | Audit log table | DONE | Audit table exists. |
| 21 | Seed roles and permissions | DONE | Controlled by explicit `pnpm db:seed:system`; plain `pnpm db:seed` is schema-only and creates no data. |
| 22 | Seed default categories | DEV | Starter categories are available only through explicit `pnpm db:seed:bootstrap`, not production default seed. |
| 23 | Seed CMS policy pages | DEV | Policy placeholders are available only through explicit `pnpm db:seed:bootstrap`, not production default seed. |
| 24 | Seed notification templates | DEV | Core email template rows are available only through explicit `pnpm db:seed:bootstrap`, not production default seed. |
| 25 | Seed default platform settings | DEV | Default general/checkout/payment/shipping/commission settings are available only through explicit `pnpm db:seed:bootstrap`; admin-managed values are not overwritten. |
| 26 | Prisma migrations | TODO | Create migration history before deployment/testing database reset. |
| 27 | Real sample product seed | CLIENT | Needs client categories/products/images/prices/stock. |

## 6. Backend API Checklist

### 6.1 API Foundation

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | NestJS app module | DONE | Main module wires current backend modules. |
| 2 | Global `/api` prefix | DONE | API prefix configured. |
| 3 | CORS setup | DONE | Local web app allowed. |
| 4 | Validation pipe | DONE | DTO validation enabled. |
| 5 | Swagger/OpenAPI setup | DONE | API docs available at `/api/docs`. |
| 6 | Health endpoint | DONE | `/api/health` returns 200. |
| 7 | Pino logger integration | PARTIAL | Worker uses Pino; API structured logging can be hardened before deployment. |
| 8 | Sentry-ready integration | DONE | Web uses `@sentry/nextjs` with client/server/edge config, route transition capture, global error capture, masked replay, source-map upload hooks, and `/_1hi/relay` tunnel route. Native customer app uses `@sentry/react-native` with Expo plugin, root wrapper, sanitized telemetry helpers, optional tunnel URL, and non-crashing verification screen. Production still needs host/EAS secrets and live test-event confirmation. |

### 6.2 Auth, Users, RBAC, and Admin Bootstrap

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Public route decorator | DONE | `@Public` exists. |
| 2 | Role decorator | DONE | `@Roles` exists. |
| 3 | Current user decorator | DONE | `@CurrentUser` exists. |
| 4 | Global auth guard | DONE | Guard maps authenticated users. |
| 5 | Role guard | DONE | DB-backed role check exists. |
| 6 | Clerk/auth sync endpoint | DONE | `POST /api/auth/sync-user`. |
| 7 | First-admin bootstrap endpoint | DONE | `POST /api/admin/bootstrap/first-admin`. |
| 8 | First-admin seed support | DONE | Env-driven first admin seed exists only in explicit bootstrap mode; plain production seed creates no users. |
| 9 | Clerk/frontend and admin auth integration | DONE | Clerk customer/seller/B2B session sync, local dev auth bridge, and standalone admin login/session gate are wired. |
| 10 | Admin users and role assignment API | DONE | Admin user list/status/role APIs exist. |
| 11 | Role-change audit logs | DONE | Admin role add/remove actions are audited. |

### 6.3 Seller Operational Types

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Public seller registration API | DONE | `POST /api/sellers/register`. |
| 2 | Seller type support | DONE | Marketplace seller, hyperlocal store, and wholesale distributor handled through seller operational type. |
| 3 | Seller pending approval flow | DONE | New sellers are pending until admin approval. |
| 4 | Admin pending sellers API | DONE | `GET /api/admin/sellers/pending`. |
| 5 | Admin seller approval/rejection API | DONE | `PATCH /api/admin/sellers/:sellerId/approval`. |
| 6 | Seller approval audit logs | DONE | Approval actions are audited. |
| 7 | Seller suspension API | DONE | Admin seller suspension/unsuspension API exists. |
| 8 | Seller profile update API | DONE | Seller can read/update store profile and address. |
| 9 | Seller document upload flow | TODO | Implement fully if client collects KYC/private documents. |
| 10 | Seller sales summary API | DONE | `GET /api/seller/reports/sales` exists. |

### 6.4 Categories and Products

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Public categories API | DONE | `GET /api/categories`, `GET /api/categories/:slug`. |
| 2 | Admin categories API | DONE | List, create, update, archive/delete. |
| 3 | Public products API | DONE | Product listing and detail for active approved products. |
| 4 | Seller products API | DONE | Seller list/create/update/delete products. |
| 5 | Admin products API | DONE | Admin list and approval queue. |
| 6 | Product approval/rejection API | DONE | `PATCH /api/admin/products/:productId/approval`. |
| 7 | Product variants | DONE | Variants with SKU, price, MRP, stock, currency. |
| 8 | Product images | DONE | Product image model and DTO support. |
| 9 | Inventory movement on product stock | DONE | Stock changes create movement records. |
| 10 | Product search-ready data structure | DONE | Search text field and public query support. |
| 11 | Advanced search engine | SELECTABLE | Implement Meilisearch/OpenSearch fully when advanced catalogue search is selected. |
| 12 | Public image upload adapter | DONE | Upload request API exists; active provider credentials/base URL are still required for live use. |

### 6.5 Customer Account, Wishlist, Cart, Checkout, and Orders

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Customer profile API | DONE | `GET/PATCH /api/account/profile`. |
| 2 | Customer address API | DONE | List, create, update, delete. |
| 3 | Wishlist API | DONE | List, add, remove saved products. |
| 4 | Cart API | DONE | View, add, update, remove cart items. |
| 5 | Checkout/order placement API | DONE | `POST /api/account/orders`. |
| 6 | Customer order history API | DONE | `GET /api/account/orders`. |
| 7 | Customer order detail API | DONE | `GET /api/account/orders/:orderNumber`. |
| 7A | Public order tracking API | DONE | `POST /api/orders/track` validates order number plus customer email/phone and returns safe status/timeline details. |
| 8 | Stock check during cart/order | DONE | Only approved active products and available stock accepted. |
| 9 | Order number generation | DONE | Order number generated during checkout. |
| 10 | Payment placeholder record | DONE | Payment record created during order flow. |
| 11 | Seller split records | DONE | Order seller splits are created. |
| 12 | Order status event timeline | DONE | Status events are recorded. |
| 13 | Cancellation API | DONE | Customer cancellation API restores stock and updates order state. |
| 14 | Refund/update handling | TODO | Implement fully when refund handling is selected. |

### 6.6 Admin and Seller Order Management

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Admin order list API | DONE | `GET /api/admin/orders`. |
| 2 | Admin order detail API | DONE | `GET /api/admin/orders/:orderNumber`. |
| 3 | Admin order status update API | DONE | `PATCH /api/admin/orders/:orderNumber/status`. |
| 4 | Admin manual delivery update API | DONE | `PATCH /api/admin/orders/:orderNumber/delivery`. |
| 5 | Seller order list API | DONE | `GET /api/seller/orders`. |
| 6 | Seller order detail API | DONE | Seller sees only orders containing seller products. |
| 7 | Seller order status update API | DONE | `PATCH /api/seller/orders/:orderNumber/status`. |
| 8 | Seller manual delivery update API | DONE | `PATCH /api/seller/orders/:orderNumber/delivery`. |
| 9 | Manual courier/partner details | DONE | Partner name, phone, tracking reference, estimated date, note. |
| 10 | Customer-facing delivery status source | DONE | Delivery status exists in order/delivery records. |
| 11 | Delivery partner web workspace | DONE | `/delivery`, `/delivery/orders`, and `/delivery/orders/[orderNumber]` for assigned manual delivery tasks. |
| 12 | Delivery partner assignment API | DONE | Admin assigns active `DELIVERY_PARTNER` users to orders; partners see only assigned orders. |
| 13 | Live courier API tracking | SELECTABLE | Implement booking, tracking, webhook, failure handling, and admin visibility when selected. |

### 6.7 B2B Buyer and Enquiry Flow

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Business buyer profile API | DONE | `GET/PUT/PATCH /api/b2b/profile`. |
| 2 | Business buyer address API | DONE | List, create, update, delete. |
| 3 | Business buyer enquiry API | DONE | List, create, detail, cancel. |
| 4 | Product-wise enquiry support | DONE | Accepts product enquiries for approved active products. |
| 5 | Seller-wise enquiry support | DONE | Accepts enquiries for approved sellers. |
| 6 | General enquiry support | DONE | Enquiry can exist without product/seller. |
| 7 | Seller B2B enquiry API | DONE | Seller reads/responds to assigned enquiries. |
| 8 | Admin B2B enquiry API | DONE | Admin reads all, responds, updates status. |
| 9 | B2B audit logs | DONE | B2B actions create audit records. |
| 10 | Advanced RFQ/PO workflow | SELECTABLE | Implement the full B2B RFQ/PO workflow when selected. |
| 11 | Quotation comparison engine | SELECTABLE | Implement the full quotation comparison workflow when selected. |

### 6.8 CMS, Content, Support, Settings, Reports, and Audit

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Public CMS banner API | DONE | `GET /api/cms/banners`; storefront homepage hero renders published admin-managed banners from this endpoint. |
| 2 | Public homepage section API | DONE | `GET /api/cms/homepage-sections`; storefront homepage renders published admin-managed sections from this endpoint. |
| 3 | Public CMS page API | DONE | `GET /api/cms/pages/:slug`. |
| 4 | Admin CMS pages API | DONE | List, create, update, archive. |
| 5 | Admin banner API | DONE | List, create, update, delete. |
| 6 | Admin homepage section API | DONE | List, create, update, delete. |
| 7 | Public support request API | DONE | `POST /api/support-requests`. |
| 8 | Authenticated support request API | DONE | `POST /api/support-requests/authenticated`. |
| 9 | Admin support list/update API | DONE | Admin can list and update support requests. |
| 10 | Admin settings API | DONE | List and update platform settings. |
| 11 | Admin email settings API | DONE | Read/update email provider setting. |
| 12 | Admin reports overview API | DONE | Overview, sales, sellers, products, enquiries. |
| 13 | Admin audit log read API | DONE | `GET /api/admin/audit-logs`. |
| 14 | Public CMS smoke with live DB | CLIENT | Requires local PostgreSQL running. |
| 15 | Report export downloads | DONE | Admin report CSV export actions are wired for sales, seller, product, B2B, and support report data. |

### 6.9 Payments, Storage, Email, and Jobs

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Payment database readiness | DONE | Payment/payment event tables and order placeholders exist. |
| 2 | Razorpay checkout integration | DONE | Admin-managed Razorpay mode/keys/webhook secret, provider order creation/reuse, Razorpay Checkout handoff, server-side signature verification, and payment-state refresh are wired; real keys required for live/test transactions. |
| 3 | COD/manual bank transfer toggles | DONE | `/admin/payments` and `/finance/settings` manage COD enablement, COD max order value/instructions, bank transfer destination/reference requirements, and manual payment; checkout UI and server enforcement follow the configured methods. |
| 4 | Payment success/failure webhook | DONE | Razorpay webhook endpoint verifies raw-body signatures, updates payment/order status, and ignores duplicate/late downgrade events after payment is paid. |
| 5 | Public image upload adapter | DONE | Upload request API exists. |
| 6 | S3-compatible private file adapter | CLIENT | Only if private seller documents/support files are collected. |
| 7 | Notification template seed | DONE | Template rows exist. |
| 8 | Notification log table | DONE | Send history structure exists. |
| 9 | Email setting API | DONE | Provider settings can be stored. |
| 10 | Email service adapter | DONE | Resend, SendGrid, SMTP bridge/dev-log provider path exists. |
| 11 | Email queue jobs | DONE | API enqueues BullMQ jobs when Redis is configured; worker processes them. |
| 12 | Seller/product/order/B2B/support event emails | DONE | Core backend events trigger notification logs/jobs. |
| 13 | SMS/WhatsApp automation | SELECTABLE | Implement provider-backed notifications completely when selected. |
| 14 | Push notifications | SELECTABLE | Implement with mobile/app notification flows when selected. |

## 7. Frontend UI Checklist

### 7.1 Frontend Foundation

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Next.js app shell | DONE | App exists under `apps/web`. |
| 2 | Global layout | DONE | Base layout exists. |
| 3 | Global styles | DONE | Tailwind/global style foundation exists. |
| 4 | API helper | DONE | Auth-aware API helper exists with backend error parsing. |
| 5 | Storefront homepage shell | DONE | `/` route exists. |
| 6 | Customer account shell | DONE | `/account` route exists. |
| 7 | Seller center shell | DONE | `/seller` route exists. |
| 8 | B2B buyer shell | DONE | `/b2b` route exists. |
| 9 | Admin panel shell | DONE | `/admin` route exists. |
| 10 | Seller registration page | DONE | `/seller/register` exists. |
| 11 | Admin seller approval page | DONE | `/admin/sellers/approvals` exists. |
| 12 | Clerk frontend provider/session wiring | DONE | Clerk provider/sign-in/sign-up, customer/seller/B2B bearer-token sync, local dev auth bridge, and standalone admin login gate are wired. |
| 13 | TanStack Query setup | DONE | App-level query provider is wired for API-backed screens. |
| 14 | Shared dashboard layouts | DONE | Admin, seller, B2B, customer account, and finance shells are wired with responsive navigation/layout patterns. |
| 15 | Form system | DONE | Customer, seller, B2B, admin settings, checkout, support, and finance forms are implemented with typed payload handling and visible error states. |
| 16 | Operational table/list system | DONE | Admin tables, action menus, filters, mobile cards, seller lists, B2B lists, and finance record panels are implemented. |
| 17 | Customer mobile Clerk Google OAuth readiness | OPS | Before mobile production release, enable Google OAuth in Clerk, add `onehandindia://sso-callback`, set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, verify `/auth/sync-current-user`, and test in an Expo dev-client or standalone Android build. |

### 7.2 Public Storefront Screens

| # | Screen | Route | Status | Notes |
|---|---|---|---|---|
| 1 | Homepage | `/` | PARTIAL | Live category and product sections are wired; CMS banner/admin homepage content integration is pending. |
| 2 | Category listing | `/categories` | DONE | Active public categories load from the categories API. |
| 3 | Category product list | `/categories/[slug]` | DONE | Category detail and approved product listing are wired to public APIs. |
| 4 | Search results | `/search` | DONE | Product search UI is wired to the public product search query. |
| 5 | Product detail | `/products/[slug]` | DONE | Images, variants, stock, seller info, add-to-cart, wishlist action, and B2B bulk quote CTA are wired. |
| 6 | Store profile | `/stores/[slug]` | DONE | Public approved seller profile and seller product listing are wired. |
| 7 | Cart | `/cart` | DONE | Customer cart API integration supports read, quantity update, remove, and checkout summary. |
| 8 | Checkout | `/checkout` | DONE | Saved-address selection, manual address fallback, delivery mode, payment method, order review, and order placement API are wired; provider/payment settings must be enabled in data. |
| 9 | Order success | `/checkout/success/[orderNumber]` | DONE | Placed order summary loads from the customer order detail API. |
| 10 | Track order public entry | `/track-order` | DONE | Public order tracking form is wired to the safe tracking endpoint. |
| 11 | About page | `/about` | DONE | CMS page route with pending-content fallback is wired. |
| 12 | Contact page | `/contact` | DONE | Public support request form is wired. |
| 13 | Privacy policy | `/privacy-policy` | DONE | CMS page route with pending-content fallback is wired. |
| 14 | Terms and conditions | `/terms-and-conditions` | DONE | CMS page route with pending-content fallback is wired. |
| 15 | Refund/return policy | `/refund-return-policy` | DONE | CMS page route with pending-content fallback is wired. |
| 16 | Shipping policy | `/shipping-policy` | DONE | CMS page route with pending-content fallback is wired. |
| 17 | Seller policy | `/seller-policy` | DONE | CMS page route with pending-content fallback is wired. |

### 7.3 Customer Account Screens

| # | Screen | Route | Status | Notes |
|---|---|---|---|---|
| 1 | Sign in | `/sign-in` | DONE | Clerk UI route is wired with local dev-auth fallback when Clerk keys are absent. |
| 2 | Sign up | `/sign-up` | DONE | Clerk UI route is wired with local dev-auth fallback when Clerk keys are absent. |
| 3 | Account dashboard | `/account` | DONE | Live profile summary, default address, and recent order data are wired. |
| 4 | Profile | `/account/profile` | DONE | Customer profile read/update API is wired. |
| 5 | Address book | `/account/addresses` | DONE | Address list/create/update/default/delete UI is wired. |
| 6 | Wishlist | `/account/wishlist` | DONE | Wishlist list/remove and add-to-cart actions are wired. |
| 7 | Order history | `/account/orders` | DONE | Customer order list and search are wired. |
| 8 | Order detail | `/account/orders/[orderNumber]` | DONE | Order item, payment, delivery, timeline, and cancellation UI is wired. |
| 9 | Support/contact requests | `/account/support` | DONE | Authenticated customer support request form is wired. |

### 7.4 Seller Center Screens

| # | Screen | Route | Status | Notes |
|---|---|---|---|---|
| 1 | Seller auth gate | `/seller` and `/seller/register` | DONE | Seller surfaces use authenticated session context with onboarding and approval-state handling. |
| 2 | Seller registration | `/seller/register` | DONE | Registration form is wired to seller onboarding APIs with normalized location fields. |
| 3 | Pending approval state | `/seller` | DONE | Pending/unapproved sellers see gated workspace states until admin approval. |
| 4 | Seller dashboard | `/seller` | DONE | Seller summary workspace is implemented. |
| 5 | Store profile | `/seller/profile` | DONE | Seller profile editing, location selectors, and logo/banner upload are wired. |
| 6 | Product list | `/seller/products` | DONE | Seller catalogue list, filters, product state, stock, edit, and archive controls are wired. |
| 7 | Add product | `/seller/products/new` and `/seller/products` | DONE | Product creation, variant details, and asset-key-based product image upload are wired. |
| 8 | Edit product | `/seller/products` | DONE | Product editing is handled inline in the seller catalogue surface. |
| 9 | Seller orders | `/seller/orders` | DONE | Seller order list is wired to seller order APIs. |
| 10 | Seller order detail | `/seller/orders/[orderNumber]` | DONE | Seller order item, status, and delivery detail screens are wired. |
| 11 | Delivery update | `/seller/orders/[orderNumber]` | DONE | Manual delivery/courier update form is available on seller order detail. |
| 12 | B2B enquiries | `/seller/b2b-enquiries` | DONE | Seller B2B enquiry list is wired. |
| 13 | B2B enquiry detail | `/seller/b2b-enquiries/[id]` | DONE | Seller response UI is wired and respects buyer-confirmed lock rules. |
| 14 | Sales summary | `/seller/reports/sales` | DONE | Seller sales report screen is wired. |

### 7.5 B2B Buyer Screens

| # | Screen | Route | Status | Notes |
|---|---|---|---|---|
| 1 | B2B registration | `/b2b/register` | DONE | Company profile onboarding form is wired. |
| 2 | B2B sign in/up | `/b2b/sign-in`, `/b2b/sign-up` | DONE | B2B auth entry routes exist and use the shared auth/session foundation. |
| 3 | B2B dashboard | `/b2b` | DONE | Dashboard summary, profile status, and enquiry metrics are wired. |
| 4 | Company profile | `/b2b/company-profile` | DONE | Business profile and procurement address management are wired. |
| 5 | Submit enquiry | `/b2b/enquiries/new` | DONE | Product/seller enquiry form is wired. |
| 6 | My enquiries | `/b2b/enquiries` | DONE | Search, status filter, list, and guarded cancellation are wired. |
| 7 | Enquiry detail | `/b2b/enquiries/[id]` | DONE | Response display, cancellation, and buyer quotation confirmation are wired. |

### 7.6 Admin Panel Screens

| # | Screen | Route | Status | Notes |
|---|---|---|---|---|
| 1 | Admin sign in | `/admin/login` | DONE | Standalone admin login uses DB-backed admin sessions and blocks Clerk/local-dev admin bypass. |
| 2 | Admin dashboard | `/admin` | DONE | Live dashboard, support, audit, and summary data are wired. |
| 3 | Customers | `/admin/customers` | DONE | Customer list, filters, status actions, and guarded disable modal are wired. |
| 4 | Customer detail | `/admin/customers` | DONE | Customer operations are covered in the customer list surface; add a full detail route when selected. |
| 5 | Sellers | `/admin/sellers` | DONE | Seller list, approval, rejection, suspension, and guarded modals are wired. |
| 6 | Seller detail | `/admin/sellers` | DONE | Seller operational data is surfaced in the seller list and approval screens; add a full detail route when selected. |
| 7 | Seller approval queue | `/admin/sellers/approvals` | DONE | Pending sellers load from the admin API and approval actions call the backend. |
| 8 | Business buyers | `/admin/business-buyers` | DONE | Business buyer list and status actions are wired. |
| 9 | Categories | `/admin/categories` | DONE | Category list, create, edit, archive, and parent clearing are wired. |
| 10 | Products | `/admin/products` | DONE | Product catalogue, approval actions, rejection, and archive controls are wired. |
| 11 | Product approval queue | `/admin/products/approvals` | DONE | Product approval queue is wired. |
| 12 | Orders | `/admin/orders` | DONE | Admin order list is wired. |
| 13 | Order detail | `/admin/orders/[orderNumber]` | DONE | Order detail, item summary, timeline, status, and delivery controls are wired. |
| 14 | Manual delivery update | `/admin/orders/[orderNumber]` | DONE | Manual courier/delivery update is handled on the order detail screen. |
| 15 | B2B enquiries | `/admin/b2b-enquiries` | DONE | B2B list, response, status, approve, and finalise actions are wired with guarded modals. |
| 16 | B2B enquiry detail | `/admin/b2b-enquiries` | DONE | B2B admin operations are covered in the list/action surface; add a full detail route when selected. |
| 17 | Banners | `/admin/cms` | DONE | Unified content management handles homepage banners. |
| 18 | Homepage content | `/admin/cms` and `/` | DONE | Unified content management handles homepage banners with upload/preview and sections with guided non-JSON create/edit fields, repeatable item rows, dynamic selection from existing categories, approved products, and approved stores, plus storefront rendering through `GET /api/cms/banners` and `GET /api/cms/homepage-sections`. |
| 19 | CMS pages | `/admin/cms` | DONE | Unified content management handles CMS pages with inline editing. |
| 20 | Support requests | `/admin/support` | DONE | Support management surface is wired. |
| 21 | Reports overview | `/admin/reports` | DONE | Sales, seller, product, B2B, and support reporting are available in one reports surface. |
| 22 | Sales report | `/admin/reports` | DONE | Sales metrics and export are wired. |
| 23 | Seller report | `/admin/reports` | DONE | Seller report metrics and export are wired. |
| 24 | Product report | `/admin/reports` | DONE | Product report metrics and export are wired. |
| 25 | Enquiry report | `/admin/reports` | DONE | B2B/support report metrics and export are wired. |
| 26 | Commission settings | `/admin/finance/commission-rules` | DONE | Commission/GST/TDS/TCS/platform-fee rule management is wired. |
| 27 | Shipping/settings | `/admin/settings/general` | DONE | General checkout, fee, and platform settings are wired; final business rules still need client confirmation. |
| 28 | Payment settings | `/admin/payments`, `/finance/settings` | DONE | Admins/finance can configure Razorpay readiness, COD enablement/max/instructions, platform bank/UPI transfer details, customer reference capture, and manual payment; secrets are masked in responses/settings/audit logs. |
| 29 | Email/notification settings | `/admin/notifications` | DONE | Notification logs and email settings are wired. |
| 30 | Admin users/roles | `/admin/users` | DONE | Role chips, add/remove role controls, status actions, and guarded removal modals are wired. |
| 31 | Audit logs | `/admin/audit-logs` | DONE | Audit log list is wired. |
| 32 | General settings | `/admin/settings/general` | DONE | Platform settings are wired. |
| 33 | Finance settlements/payouts/ledger/statements | `/admin/finance/*`, `/finance/*` | DONE | Settlement drafts, payout approval/mark-paid, ledger, statements, COD/bank transfer verification, payment status control, reports, and finance settings are wired with guarded finance modals. |
| 34 | Finance Manager workspace | `/finance/*` | DONE | `FINANCE` users sign into the standalone finance workspace, can access finance/payment APIs, and are blocked from full admin users/products/settings/CMS surfaces. |
| 35 | Locations/import coverage | `/admin/locations` | DONE | Country coverage, import runs, and guarded enable/disable market coverage are wired. |

## 8. Worker, Queue, and Background Job Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Worker app scaffold | DONE | `apps/worker` exists. |
| 2 | Worker logging | DONE | Pino logger exists. |
| 3 | Queue name map | DONE | Email, reports, audit, future search/integration queues listed. |
| 4 | Redis connection | DONE | BullMQ uses `REDIS_URL` when configured. |
| 5 | Email notification processor | DONE | Worker processes `email.notifications` jobs. |
| 6 | Notification retry handling | DONE | BullMQ retry attempts and admin notification retry API exist. |
| 7 | Report snapshot job | TODO | Optional after live reports are stable. |
| 8 | Audit rollup job | TODO | Optional; audit log table already works without rollup. |
| 9 | Search indexing job | SELECTABLE | Implement when Meilisearch/advanced search is selected. |

## 9. Client and Third-Party Dependency Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Business name | CLIENT | Needed for settings, footer, emails, legal pages. |
| 2 | Legal business name | CLIENT | Needed for policy pages and invoices/receipts if used. |
| 3 | Owner/contact details | CLIENT | Needed for support/contact and legal pages. |
| 4 | Official sender email | CLIENT | Needed before live email sending. |
| 5 | SMTP/Resend/SendGrid details | CLIENT | Email charges are separate from development budget. |
| 6 | Final logo | CLIENT | Logo can be added later. |
| 7 | Product categories | CLIENT | Starter categories exist; final data pending. |
| 8 | Product list, images, prices, stock | CLIENT | Needed for real storefront data. |
| 9 | Initial seller details | CLIENT | Needed for real seller onboarding, operational type selection, and test data. |
| 10 | Commission rules | CLIENT | Manual/default settings exist; final rules pending. |
| 11 | Payment method decision | CLIENT | Runtime toggles exist in `/admin/payments`; client still decides which methods to enable for launch. |
| 12 | Razorpay account keys | CLIENT | Admin panel accepts keys, but approved Razorpay account credentials and deployed webhook setup are client/provider dependencies. |
| 13 | Shipping charge rule | CLIENT | Default placeholder exists; final rule pending. |
| 14 | Delivery mode rules | CLIENT | Needed for checkout options. |
| 15 | Store pickup decision | CLIENT | Optional if confirmed. |
| 16 | Return/refund policy content | CLIENT | Placeholder CMS page exists. |
| 17 | Privacy/terms/seller/shipping policy content | CLIENT | Placeholder CMS pages exist. |
| 18 | Homepage banners/content | CLIENT | CMS API exists; final content pending. |
| 19 | Domain and hosting accounts | CLIENT | Separate from development budget. |
| 20 | Public image provider account/base URL | CLIENT | Needed for public image uploads. |

## 10. Testing and Verification Checklist

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Prisma schema validation | DONE | `pnpm db:validate` passed. |
| 2 | Prisma client generation | DONE | `pnpm db:generate` passed through typecheck/build. |
| 3 | TypeScript typecheck | DONE | `pnpm typecheck` passed. |
| 4 | Lint | DONE | `pnpm lint` passed. |
| 5 | Build | DONE | `pnpm build` passed. |
| 6 | Backend module logic audit | DONE | Auth/RBAC, seller/admin, products, categories, cart/order, payments, notifications, B2B, support, reports, settings, and worker modules reviewed. |
| 7 | Test command | DONE | Latest API suite passed with 15 test files and 59 tests. |
| 8 | Web smoke check | DONE | `http://localhost:3000` returned 200 in latest check. |
| 9 | API health smoke check | DONE | `http://localhost:4000/api/health` returned 200 in latest check. |
| 10 | Protected admin route smoke | DONE | New admin endpoints returned 401 without auth, as expected. |
| 11 | Public DB-backed route smoke | DONE | Supertest integration suite verifies public health, public CMS, and support APIs against PostgreSQL. |
| 12 | API unit tests | DONE | Unit suite covers auth sync, auth guard, roles guard, seller approval, product approval, payment webhook, and storage signing. |
| 13 | API integration tests | DONE | Supertest suite runs against PostgreSQL through the real Nest app, global guards, and Prisma services. |
| 14 | Role-based access tests | DONE | Route-level checks verify unauthenticated, customer, seller, B2B, and admin boundaries. |
| 15 | Cart and checkout flow tests | DONE | Customer cart, checkout, order creation, duplicate checkout-submit blocking, public tracking, seller delivery update, cancellation, and stock restoration are tested. |
| 16 | Seller product/order tests | DONE | Seller product submission, admin approval, public visibility, seller order ownership, and wrong-seller denial are tested. |
| 17 | B2B enquiry tests | DONE | B2B buyer submission, wrong-seller denial, seller response, and admin readback are tested. |
| 18 | CMS/support/settings tests | DONE | Public CMS/support and admin settings/reports/audit/notification/payment/storage boundaries are tested, including payment config masking. |
| 19 | Email event tests | DONE | Notification event paths are covered through product/order/B2B/support flows with disabled-provider log behavior; live provider sending remains deployment configuration. |
| 20 | Web frontend checks | DONE | `pnpm.cmd --filter @indihub/web typecheck`, `lint`, `test`, and production build passed again after the 2026-05-26 modal/docs refresh. |
| 21 | Branded confirmation dialog pass | DONE | Native browser `confirm`/`alert`/`prompt` calls are absent; high-impact customer, seller, B2B, admin, finance, and location actions use branded Headless UI confirmation modals. |
| 22 | Playwright frontend tests | TODO | Add as the final automated browser-regression layer after manual role and flow QA are accepted. |
| 23 | Mobile responsive QA | TODO | Required before client demo. |
| 24 | Security review | TODO | Required before launch. |
| 25 | Deployment readiness check | TODO | Required after hosting environment is selected. |

## 11. Recommended Next Implementation Order

| Order | Stage | Status | Why This Comes Next |
|---|---|---|---|
| 1 | Transactional email service and adapter | DONE | Notification backend is now wired. |
| 2 | Worker email queue processors | DONE | Worker can process email notification jobs when Redis is configured. |
| 3 | API tests for critical backend flows | DONE | Unit and PostgreSQL-backed integration tests cover the implemented backend surface. |
| 4 | Clerk/admin auth/session wiring | DONE | Clerk customer/seller/B2B sessions and standalone admin session flow are wired. |
| 5 | TanStack Query API layer | DONE | Query provider and auth-aware fetch helper are in place. |
| 6 | Storefront product browsing UI | DONE | Homepage, categories, category products, search, and product detail are wired to public APIs. |
| 7 | Cart, checkout, and order UI | DONE | Cart, saved-address checkout, order placement, order success, and public tracking screens are wired to customer APIs. |
| 8 | Customer account UI | DONE | Sign-in/sign-up routes, profile, addresses, wishlist, order history/detail, and support screens are wired. |
| 9 | Public store profile and CMS pages | DONE | Store profile, contact, about, and policy routes are wired. |
| 10 | Seller product/order/B2B UI | DONE | Seller center is operational for implemented flows. |
| 11 | Admin catalogue/order/CMS/report UI | DONE | Admin operations are implemented across the current surface. |
| 12 | B2B buyer UI | DONE | Business buyer flow is operational for the implemented quotation lifecycle. |
| 13 | Payment adapter and checkout method toggles | DONE | Admin-managed Razorpay, COD, bank transfer, and manual payment configuration, Razorpay Checkout handoff, server-side checkout signature verification, signed webhook handling, COD max enforcement, and checkout concurrency protection are implemented; live Razorpay use depends on client/provider keys and dashboard webhook setup. |
| 14 | Public image upload | DONE | Seller profile/product images and storage readiness paths are implemented; real provider credentials/base URL are deployment configuration. |
| 15 | Branded confirmation modal pass | DONE | High-impact destructive or lifecycle-changing actions use proper branded confirmation modals. |
| 16 | Full browser E2E test pass | NEXT | Required before client demo/final deployment. |
| 17 | Deployment setup | TODO | Needs hosting, database, Redis, env vars, domain decisions, provider accounts, and backups. |

## 12. Product Acceptance Checklist

The product surface can be called ready for final client review only when all selected items below are complete.

| # | Acceptance Item | Status | Notes |
|---|---|---|---|
| 1 | Customer storefront flow works end to end | PARTIAL | Browse, product detail, wishlist, cart, saved-address checkout, admin-driven payment methods, Razorpay Checkout handoff, order success, public tracking, and branded removal/cancellation modals are wired; seeded product/payment-setting browser QA is pending. |
| 2 | Customer account works | DONE | Sign-in/sign-up routes, Clerk customer bearer-token sync, profile, addresses, wishlist, order history/detail, support, and guarded destructive actions are wired. |
| 3 | Seller onboarding works | DONE | Seller registration, authenticated seller workspace, and pending/approved states are wired. |
| 4 | Admin seller approval works | DONE | Admin seller approvals, rejection, suspension, and guarded modals are wired. |
| 5 | Seller product management works | DONE | Seller product list/create/edit/archive and asset-key-based product image upload are wired. |
| 6 | Admin product approval works | DONE | Admin product catalogue, approval queue, rejection, archive, and guarded modals are wired. |
| 7 | Cart, checkout, and order placement work | PARTIAL | Backend and frontend screens exist with saved-address checkout, customer bearer-token auth, admin-driven COD/Razorpay/bank/manual availability, Razorpay Checkout handoff, pending/failed payment messaging, and duplicate checkout-submit protection; final live flow depends on product data, enabled settings, and provider test/live keys. |
| 8 | Admin and seller order management works | DONE | Admin/seller order list/detail, status updates, and delivery controls are wired. |
| 9 | Manual delivery/courier tracking works | DONE | Backend, public tracking, admin delivery update, and seller delivery update surfaces are wired. |
| 10 | B2B enquiry flow works | DONE | Buyer enquiry creation/list/detail, seller response, buyer confirmation, admin approval, and finalisation are wired. |
| 11 | CMS and policy pages are manageable | DONE | Admin content management and public CMS/policy fallback routes are wired; final client content is still a client dependency. |
| 12 | Support/contact flow works | DONE | Public contact, authenticated customer support, and admin support management are wired. |
| 13 | Reports are visible to admin | DONE | Admin reports are visible and exclude cancelled order revenue where required. |
| 14 | Audit logs are available | DONE | Admin audit log surface is wired. |
| 15 | Transactional email notifications are configured | DONE | Backend service, queue, logs, retries, and event triggers exist. |
| 16 | Payment readiness is completed | DONE | Admin/finance-managed Razorpay/COD/bank/manual configuration, bank-transfer destination/reference capture, Razorpay Checkout script handoff, server-side checkout signature verification, webhook handling, setting masking, COD max enforcement, and checkout concurrency protection exist; live Razorpay use still needs approved provider keys, deployed webhook configuration, and a test transaction. |
| 17 | Role access rules are verified | DONE | Backend/API route tests cover admin, finance, and core role guards; manual browser QA across logged-in roles was completed successfully. Automated Playwright role-regression tests remain a final hardening task. |
| 18 | Client content is loaded | CLIENT | Needs logo/content/products/policies/settings. |
| 19 | Full QA corrections are completed | TODO | Browser testing cycle and any resulting fixes are pending. |
| 20 | Deployment preparation is completed | TODO | Hosting/env/domain/provider setup pending. |

## 13. Selectable Full Implementation Backlog

These items were outside the original INR 200,000 build, but are now selectable full implementation areas under `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`.

| Item | Status | Notes |
|---|---|---|
| Native Android customer app | SELECTABLE | Full customer mobile app implementation when selected. |
| Native iOS customer app | SELECTABLE | Full customer mobile app implementation when selected. |
| Dedicated seller mobile app | SELECTABLE | Full seller operations app implementation when selected. |
| Play Store/App Store publishing | SELECTABLE | Requires store accounts and release workflow. |
| Live courier API tracking | SELECTABLE | Full courier provider workflow when selected. |
| Delivery partner mobile app | SELECTABLE | Full delivery partner app when selected. |
| GPS tracking, OTP delivery, proof of delivery | SELECTABLE | Full logistics proof and tracking workflow when selected. |
| Automated seller payouts | SELECTABLE | Full finance/provider workflow when selected. |
| Advanced B2B RFQ, PO upload, approval workflow | SELECTABLE | Full B2B procurement workflow when selected. |
| Realtime buyer-seller chat | SELECTABLE | Full communication workflow when selected. |
| Chatbot | SELECTABLE | Full support/sales automation workflow when selected. |
| Abandoned cart automation | SELECTABLE | Full marketing automation workflow when selected. |
| Loyalty/rewards | SELECTABLE | Full loyalty workflow when selected. |
| Advanced analytics | SELECTABLE | Full analytics workflow when selected. |
| Multi-language and multi-currency | SELECTABLE | Full localization/market workflow when selected. |
| SMS/WhatsApp automation | SELECTABLE | Full provider-backed notification workflow when selected. |
| Bulk promotional email/newsletter system | SELECTABLE | Full marketing email workflow when selected. |

## 14. Immediate Next Stage Definition

The next stage should be:

**Stage:** Browser E2E QA and launch readiness  
**Status:** NEXT  

Current implementation milestone:

- Customer storefront/account, seller center, B2B buyer portal, admin operations, finance, reports, CMS, support, locations, and admin-managed payment/provider-readiness surfaces are implemented.
- Branded confirmation modals now guard destructive or lifecycle-changing actions across customer, seller, B2B, admin, finance, and location management surfaces.
- Native browser `confirm`, `alert`, and `prompt` calls are not present in the app source.

Done criteria for the next stage:

- Start local API and web together.
- Verify customer browse, wishlist, cart, checkout, order detail, cancellation, and public tracking in browser.
- Verify seller registration, pending/approved state, profile, product upload/edit/archive, orders, delivery update, B2B responses, and reports in browser.
- Verify B2B registration, company profile, enquiry creation, cancellation, quotation confirmation, admin approval, and finalisation in browser.
- Verify admin dashboard, customers, users/roles, sellers, products, orders, B2B, support, CMS, categories, reports, finance, locations, notifications, storage, payment configuration/readiness, audit logs, and settings in browser.
- Verify mobile responsive behavior for customer, seller, B2B, and admin surfaces.
- Verify production Sentry readiness: web and mobile DSNs configured, Sentry auth token available only in CI/EAS secrets, source maps uploaded, example trigger flags disabled, web tunnel route reachable, mobile Expo Sentry plugin present, and one test event from web plus one test event from the native customer app visible in Sentry.
- Re-run `pnpm db:validate`, API typecheck/lint/test, and web typecheck/lint/test/build after QA fixes.
- Prepare deployment checklist after hosting, database, domain, Clerk, public image provider/base URL, Razorpay, email, backup, and monitoring details are confirmed.
