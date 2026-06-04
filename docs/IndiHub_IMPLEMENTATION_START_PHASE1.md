# 1HandIndia Phase 1 Implementation Start

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Implementation Milestone Note  
**Start Date:** 23-05-2026  
**Scope Source:** `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`  
**Stack Source:** `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`  
**Status:** Implementation started

## 1. What Was Started

Implementation has started with the locked Phase 1 stack.

The first milestone creates the real project foundation:

- Turborepo + pnpm workspace.
- Next.js web app.
- NestJS API app.
- Worker app.
- PostgreSQL + Prisma schema foundation.
- Shared configuration package.
- Shared UI package.
- Shared type package.
- Shared validation package.
- Shared TypeScript and ESLint config packages.
- Environment template.
- GitHub Actions CI skeleton.

## 2. Created Application Structure

```text
apps/
  web/
  api/
  worker/
packages/
  config/
  database/
  eslint-config/
  shared-types/
  tsconfig/
  ui/
  validators/
prisma/
  schema.prisma
  seed.ts
prisma.config.ts
```

Native mobile apps were not scaffolded because they are future upgrades outside the locked INR 200,000 Phase 1 scope.

## 3. Web App Started

The web app currently includes initial shells for:

- Storefront homepage: `/`
- Customer account: `/account`
- Seller center: `/seller`
- B2B buyer portal: `/b2b`
- Admin control panel: `/admin`

These are foundation screens only. They establish layout, routing, brand direction, and separated surface structure before feature modules are added.

## 4. API Started

The API currently includes:

- NestJS app shell.
- Global `/api` prefix.
- CORS setup for the local web app.
- Validation pipe.
- Swagger/OpenAPI setup at `/api/docs`.
- Health endpoint at `/api/health`.

## 5. Worker Started

The worker currently includes the placeholder queue map for:

- Transactional emails.
- Basic reports.
- Audit rollups.
- Future search indexing.
- Future integration retries.

Actual queue processors will be added when the email/report/audit modules are built.

## 6. Prisma Database Foundation

The Prisma schema has been started with Phase 1 entities for:

- Users, roles, permissions, and role mapping.
- Customers and addresses.
- Sellers, seller profiles, addresses, and documents.
- Business buyers and addresses.
- Categories, products, variants, images, and inventory movements.
- Cart, checkout, orders, order items, and seller splits.
- Manual delivery details and delivery events.
- Payments and payment events.
- B2B enquiries and responses.
- CMS banners, pages, and homepage sections.
- Support requests.
- Notification templates and logs.
- Email settings.
- Settings and audit logs.

Prisma 7 is configured through `prisma.config.ts`, and the generated client is output under the database package.

## 7. Verification Completed

Completed checks:

- `pnpm install`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`
- Web local response check: `http://localhost:3000`
- API health check: `http://localhost:4000/api/health`

Known local environment note:

- The C drive has no free space, so Prisma engine temporary/cache paths were moved to the workspace during validation.

## 8. Running Locally

Start web:

```powershell
pnpm dev:web
```

Start API:

```powershell
pnpm dev:api
```

Start worker:

```powershell
pnpm dev:worker
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/health`
- API docs: `http://localhost:4000/api/docs`

## 9. Second Implementation Step Completed

After the initial scaffold, the next locked build step was started and completed:

- Added API Prisma service module.
- Added global auth guard foundation.
- Added role-based guard foundation.
- Added `@Public`, `@Roles`, and `@CurrentUser` decorators.
- Added request user typing for mapped 1HandIndia users.
- Added audit service foundation.
- Added public seller registration API endpoint:
  - `POST /api/sellers/register`
- Added admin seller approval API endpoints:
  - `GET /api/admin/sellers/pending`
  - `PATCH /api/admin/sellers/:sellerId/approval`
- Added admin dashboard summary API endpoint:
  - `GET /api/admin/dashboard`
- Added seller registration web page:
  - `/seller/register`
- Added admin seller approval page:
  - `/admin/sellers/approvals`

The admin endpoints are protected by database-backed role checks. The public seller registration endpoint creates a pending seller operational record for admin approval.

## 10. Next Implementation Step

The next recommended implementation step is now:

1. Add Clerk webhook/user sync endpoint.
2. Add admin user seed and first-admin setup workflow.
3. Connect admin approval page to real authenticated API calls after Clerk keys are configured.
4. Build category and product admin modules.
5. Build seller product creation and product approval workflow.

This matches the locked build order in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`.

## 11. Backend-First Catalogue Foundation Completed

After the decision to complete necessary backend work before expanding frontend screens, the next backend foundation slice was completed:

- Added Clerk/auth user sync API:
  - `POST /api/auth/sync-user`
  - Protected by `x-indihub-sync-secret`.
- Added first-admin bootstrap API:
  - `POST /api/admin/bootstrap/first-admin`
  - Protected by `x-indihub-bootstrap-secret`.
- Added first-admin seed support using:
  - `INDIHUB_FIRST_ADMIN_EMAIL`
  - `INDIHUB_FIRST_ADMIN_CLERK_ID`
  - `INDIHUB_FIRST_ADMIN_NAME`
- Expanded seed setup for:
  - Roles.
  - Permissions.
  - Admin role permission mapping.
  - Seller product permissions.
  - Default CMS pages.
  - Default sample categories.
  - Default transactional email templates.
- Added category backend APIs:
  - `GET /api/categories`
  - `GET /api/categories/:slug`
  - `GET /api/admin/categories`
  - `POST /api/admin/categories`
  - `PATCH /api/admin/categories/:categoryId`
  - `DELETE /api/admin/categories/:categoryId`
- Added product backend APIs:
  - `GET /api/products`
  - `GET /api/products/:slug`
  - `GET /api/seller/products`
  - `POST /api/seller/products`
  - `PATCH /api/seller/products/:productId`
  - `DELETE /api/seller/products/:productId`
  - `GET /api/admin/products`
  - `GET /api/admin/products/approvals`
  - `PATCH /api/admin/products/:productId/approval`

The catalogue APIs follow Phase 1 rules:

- Sellers can submit products only after admin approval.
- Seller-created products go into `PENDING_APPROVAL`.
- Public product APIs only expose `ACTIVE` and `APPROVED` products.
- Admin can approve or reject products.
- Product creation and stock updates create inventory movement records.
- Sensitive category and product changes create audit log records.

## 12. Remaining Backend Work Before Frontend Expansion

Continue backend-first implementation with:

1. Customer profile, address book, wishlist, cart, checkout, and order APIs.
2. Admin/seller order management and manual delivery update APIs.
3. B2B buyer registration and enquiry APIs.
4. CMS, banner, support request, settings, reports, and audit log read APIs.
5. Transactional email adapter/service wiring into seller, product, order, B2B, and support events.

## 13. Backend Customer Commerce Foundation Completed

The next backend-only implementation stage was completed before expanding frontend screens:

- Added customer account APIs:
  - `GET /api/account/profile`
  - `PATCH /api/account/profile`
- Added customer address APIs:
  - `GET /api/account/addresses`
  - `POST /api/account/addresses`
  - `PATCH /api/account/addresses/:addressId`
  - `DELETE /api/account/addresses/:addressId`
- Added customer wishlist APIs:
  - `GET /api/account/wishlist`
  - `POST /api/account/wishlist/items`
  - `DELETE /api/account/wishlist/items/:productId`
- Added cart APIs:
  - `GET /api/cart`
  - `POST /api/cart/items`
  - `PATCH /api/cart/items/:cartItemId`
  - `DELETE /api/cart/items/:cartItemId`
- Added customer checkout and order APIs:
  - `POST /api/account/orders`
  - `GET /api/account/orders`
  - `GET /api/account/orders/:orderNumber`
- Added admin order APIs:
  - `GET /api/admin/orders`
  - `GET /api/admin/orders/:orderNumber`
  - `PATCH /api/admin/orders/:orderNumber/status`
  - `PATCH /api/admin/orders/:orderNumber/delivery`
- Added seller order APIs:
  - `GET /api/seller/orders`
  - `GET /api/seller/orders/:orderNumber`
  - `PATCH /api/seller/orders/:orderNumber/status`
  - `PATCH /api/seller/orders/:orderNumber/delivery`
- Added delivery partner order APIs:
  - `GET /api/delivery/orders`
  - `GET /api/delivery/orders/:orderNumber`
  - `PATCH /api/delivery/orders/:orderNumber/delivery`

The commerce backend follows Phase 1 rules:

- Customer cart items only accept active, approved product variants.
- Cart quantity is checked against available stock.
- Checkout creates order records, seller splits, payment placeholder records, delivery details, order timeline events, inventory sale movements, and audit logs.
- Admin can update order/payment status and manual delivery details.
- Seller can view and update only orders containing their products.
- Admin can assign active delivery partner users to order-level delivery records.
- Delivery partners can view and update only assigned orders, and delivery updates do not mark COD payments paid.

## 14. Remaining Backend Work Before Frontend Expansion

Continue backend-first implementation with:

1. B2B buyer registration, company profile, enquiry, and seller/admin response APIs.
2. CMS pages, banners, homepage section, support request, settings, reports, and audit log read APIs.
3. Transactional email adapter/service wiring into seller, product, order, B2B, and support events.
4. API tests for customer cart/order, seller product/order, and admin moderation flows.

## 15. Backend B2B Enquiry Foundation Completed

The next backend-only implementation stage added the Phase 1 B2B buyer and enquiry workflow:

- Added business buyer profile APIs:
  - `GET /api/b2b/profile`
  - `PUT /api/b2b/profile`
  - `PATCH /api/b2b/profile`
- Added business buyer address APIs:
  - `GET /api/b2b/addresses`
  - `POST /api/b2b/addresses`
  - `PATCH /api/b2b/addresses/:addressId`
  - `DELETE /api/b2b/addresses/:addressId`
- Added business buyer enquiry APIs:
  - `GET /api/b2b/enquiries`
  - `POST /api/b2b/enquiries`
  - `GET /api/b2b/enquiries/:enquiryId`
  - `PATCH /api/b2b/enquiries/:enquiryId/cancel`
- Added seller B2B enquiry APIs:
  - `GET /api/seller/b2b-enquiries`
  - `GET /api/seller/b2b-enquiries/:enquiryId`
  - `POST /api/seller/b2b-enquiries/:enquiryId/responses`
- Added admin B2B enquiry APIs:
  - `GET /api/admin/b2b-enquiries`
  - `GET /api/admin/b2b-enquiries/:enquiryId`
  - `POST /api/admin/b2b-enquiries/:enquiryId/responses`
  - `PATCH /api/admin/b2b-enquiries/:enquiryId/status`
- Expanded seed permissions for:
  - Business buyer profile and enquiry access.
  - Seller B2B response access.
  - Admin B2B management.

The B2B backend follows Phase 1 rules:

- Business buyers can maintain company profile and address records.
- Business buyers can submit product-wise, seller-wise, or general B2B enquiries.
- Product-wise enquiries only accept active and approved products.
- Seller-wise enquiries only accept approved sellers.
- Sellers can view and respond only to enquiries assigned to their store.
- Admin can view all enquiries, add manual responses, and update enquiry status.
- B2B actions create audit log records.

## 16. Remaining Backend Work Before Frontend Expansion

Continue backend-first implementation with:

1. CMS pages, banners, homepage section, support request, settings, reports, and audit log read APIs.
2. Transactional email adapter/service wiring into seller, product, order, B2B, and support events.
3. API tests for customer cart/order, seller product/order, B2B enquiry, and admin moderation flows.

## 17. Backend Operations Foundation Completed

The next backend-only implementation stage added the Phase 1 operational control APIs:

- Added public CMS APIs:
  - `GET /api/cms/banners`
  - `GET /api/cms/homepage-sections`
  - `GET /api/cms/pages/:slug`
- Added admin CMS APIs for pages, banners, and homepage sections:
  - `GET /api/admin/cms/pages`
  - `POST /api/admin/cms/pages`
  - `PATCH /api/admin/cms/pages/:pageId`
  - `DELETE /api/admin/cms/pages/:pageId`
  - `GET /api/admin/cms/banners`
  - `POST /api/admin/cms/banners`
  - `PATCH /api/admin/cms/banners/:bannerId`
  - `DELETE /api/admin/cms/banners/:bannerId`
  - `GET /api/admin/cms/homepage-sections`
  - `POST /api/admin/cms/homepage-sections`
  - `PATCH /api/admin/cms/homepage-sections/:sectionId`
  - `DELETE /api/admin/cms/homepage-sections/:sectionId`
- Added support request APIs:
  - `POST /api/support-requests`
  - `POST /api/support-requests/authenticated`
  - `GET /api/support-requests/admin`
  - `PATCH /api/support-requests/admin/:requestId`
- Added admin settings APIs:
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings/:key`
  - `GET /api/admin/settings/email/current`
  - `PUT /api/admin/settings/email/current`
- Added admin report APIs:
  - `GET /api/admin/reports`
  - `GET /api/admin/reports/sales`
  - `GET /api/admin/reports/sellers`
  - `GET /api/admin/reports/products`
  - `GET /api/admin/reports/enquiries`
- Added admin audit log read API:
  - `GET /api/admin/audit-logs`
- Expanded seed setup for:
  - CMS, support, reports, settings, and audit permissions.
  - Default platform settings.

The operations backend follows Phase 1 rules:

- Public CMS only exposes published content.
- Admin CMS changes create audit logs.
- Public support requests are allowed, and authenticated support requests are linked to the current user.
- Settings and email provider changes create audit logs.
- Reports stay basic and operational for Phase 1.
- Audit logs are read-only through the admin API.

## 18. Remaining Backend Work Before Frontend Expansion

Continue backend-first implementation with:

1. Transactional email adapter/service wiring into seller, product, order, B2B, and support events.
2. API tests for customer cart/order, seller product/order, B2B enquiry, CMS, support, and admin moderation flows.
3. Frontend integration for the already-built backend surfaces after the API test layer is in place.

## 19. End-to-End Checklist Created

A complete Phase 1 tracking checklist has been created at:

- `docs/IndiHub_PHASE1_END_TO_END_CHECKLIST.md`

This checklist marks:

- What is completed.
- What is partially completed.
- What should be implemented next.
- What is still pending.
- What depends on the client or third-party providers.
- What is explicitly future scope and not part of the INR 200,000 frozen Phase 1 build.

## 20. Remaining Backend Feature Completion Completed

The remaining backend feature work before formal backend testing has been completed.

Added transactional notification backend:

- Added notification service, email provider adapter, notification logs, and retry support.
- Added Redis/BullMQ email queue producer in the API.
- Added worker email queue processor for `email.notifications`.
- Added provider-ready delivery for Resend, SendGrid, and SMTP bridge/dev logging.
- Added admin notification log APIs:
  - `GET /api/admin/notifications`
  - `POST /api/admin/notifications/:logId/retry`
- Wired transactional email events into:
  - Customer account creation.
  - Seller registration.
  - Seller approval/rejection/suspension updates.
  - Product submission/approval/rejection.
  - Order placed.
  - Order status updates.
  - Payment success/failure updates.
  - B2B enquiry submission and response.
  - Support request submission.

Added missing admin and seller backend controls:

- Added seller profile APIs:
  - `GET /api/seller/profile`
  - `PATCH /api/seller/profile`
- Added admin seller management APIs:
  - `GET /api/admin/sellers`
  - `GET /api/admin/sellers/:sellerId`
  - `PATCH /api/admin/sellers/:sellerId/suspension`
- Added admin customer management APIs:
  - `GET /api/admin/customers`
  - `GET /api/admin/customers/:customerId`
  - `PATCH /api/admin/customers/:customerId/status`
- Added admin business buyer management APIs:
  - `GET /api/admin/business-buyers`
  - `GET /api/admin/business-buyers/:businessBuyerId`
  - `PATCH /api/admin/business-buyers/:businessBuyerId/status`
- Added admin user and role management APIs:
  - `GET /api/admin/users`
  - `GET /api/admin/users/:userId`
  - `PATCH /api/admin/users/:userId/status`
  - `POST /api/admin/users/:userId/roles`
  - `PATCH /api/admin/users/:userId/roles/remove`
- Added seller sales report API:
  - `GET /api/seller/reports/sales`
- Added admin support route alias:
  - `GET /api/admin/support-requests`
  - `PATCH /api/admin/support-requests/:requestId`

Added payment and storage readiness:

- Added Razorpay-ready payment backend:
  - `GET /api/admin/payments/readiness`
  - `POST /api/payments/razorpay/orders/:orderNumber`
  - `POST /api/payments/razorpay/webhook`
- Added checkout payment method toggle enforcement through platform settings.
- Added public image upload readiness:
  - `GET /api/storage/readiness`
  - `POST /api/storage/public-image/upload-request`
- Added customer order cancellation API:
  - `PATCH /api/account/orders/:orderNumber/cancel`

Expanded seed and environment support:

- Added backend permissions for admin users, payments, storage, and notifications.
- Added payment method settings for Razorpay, COD, bank transfer, and manual payment.
- Added payment notification templates.
- Expanded `.env.example` for email provider, admin recipients, and API keys.

At this point, the next recommended stage is backend testing:

1. API unit tests.
2. API integration tests with PostgreSQL.
3. Role-based access tests.
4. Notification queue tests.
5. Payment/storage readiness tests.
6. Critical commerce flow tests.

## 21. Backend API Unit Test Foundation Started

The first backend testing slice has been added with Vitest unit tests for critical API logic.

Added test coverage for:

- Auth user sync for new customer users and existing business-buyer mapping.
- Global auth guard mapping, missing-auth rejection, and disabled-user blocking.
- Role guard permission enforcement.
- Admin seller approval audit and notification behavior.
- Seller product approval restrictions and admin product approval.
- Razorpay webhook signature verification and payment-status update flow.
- Public image upload request generation and missing-provider readiness errors.

Verification completed:

- `pnpm --filter @indihub/api test` passed with 7 test files and 19 tests.
- `pnpm --filter @indihub/api typecheck` passed.
- `pnpm --filter @indihub/api lint` passed.
- `pnpm typecheck` passed for the full monorepo after Prisma generation.

Next backend testing step:

1. Add PostgreSQL-backed API integration tests.
2. Add route-level role-separation tests for customer, seller, B2B, and admin APIs.
3. Add commerce flow tests for cart, checkout, cancellation, seller orders, B2B enquiries, CMS/support/settings, notification queue, payment readiness, and storage readiness.

## 22. Backend Testing Completion Completed

The backend testing stage has now been completed for the Phase 1 backend surface.

Added PostgreSQL-backed Nest/Supertest integration coverage:

- Public health route.
- Admin authentication and role-denial checks.
- Customer cart add, checkout, order creation, cancellation, and stock restoration.
- Seller order ownership, correct seller access, wrong-seller denial, and manual delivery update.
- Seller product submission, admin product approval, and public product listing visibility.
- B2B buyer enquiry creation, wrong-seller denial, seller response, and admin enquiry readback.
- Public CMS page read.
- Public support request creation.
- Admin-only settings, support, reports, audit logs, notification logs, payment readiness, and storage readiness.
- Storage readiness denial for non-admin seller access.

Added local test support:

- `apps/api/src/app/backend.integration.test.ts`
- `apps/api/src/types/supertest.d.ts`

Verification completed:

- `pnpm db:push` passed against local PostgreSQL `indihub_test`.
- `pnpm db:seed` passed.
- `pnpm db:validate` passed.
- `pnpm --filter @indihub/api test` passed with 8 test files and 24 tests.
- `pnpm --filter @indihub/api typecheck` passed.
- `pnpm --filter @indihub/api lint` passed.
- `pnpm --filter @indihub/api build` passed.
- `pnpm --filter @indihub/worker build` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed.

Backend status:

The Phase 1 backend is now code-complete and verification-complete for local development. Remaining backend-related launch items are configuration/provider tasks, not missing backend modules:

- Real Clerk keys and frontend session token wiring.
- Real Razorpay merchant keys and live/test payment account approval.
- Real public image provider credentials and base URL values.
- Real email provider or SMTP bridge configuration.
- Redis URL for live queue processing.
- Hosting/domain/environment setup.
- Final client payment, shipping, category, product, policy, and content decisions.

Next implementation stage:

1. Clerk frontend auth/session wiring.
2. TanStack Query API client layer.
3. Frontend screen integration for storefront, account, seller, B2B, and admin surfaces.

## 23. Frontend Integration Started

The first frontend integration slice has now started on top of the completed backend surface.

Added frontend foundation:

- App-level provider wrapper for TanStack Query.
- Optional Clerk provider wiring that does not break local development when public Clerk keys are not configured.
- Local development auth bridge for admin, seller, customer, and B2B user IDs.
- Auth-aware API helper that sends 1HandIndia platform user headers and surfaces backend error messages cleanly.
- Shared admin and seller portal navigation definitions.
- Header auth actions for Clerk-enabled and local-development modes.

Added first API-backed admin screens:

- `/admin` now loads live dashboard metrics from `GET /api/admin/dashboard`.
- `/admin/sellers/approvals` now loads pending seller records from `GET /api/admin/sellers/pending`.
- Seller approve/reject actions call `PATCH /api/admin/sellers/:sellerId/approval`.
- Admin screens show local dev auth controls, loading states, empty states, and backend error panels.

Updated environment documentation:

- Added optional local frontend user ID variables for admin, seller, customer, and B2B development flows.

Verification completed:

- `pnpm --filter @indihub/web typecheck` passed.
- `pnpm --filter @indihub/web lint` passed.
- `pnpm --filter @indihub/web test` passed.
- `pnpm --filter @indihub/web build` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm build` passed for the full monorepo after rerunning outside the sandbox because the sandbox blocked Next.js worker spawning with `EPERM`.

Current frontend status:

Frontend implementation has officially started. The backend is complete for local Phase 1 development, and the next frontend work should move into storefront browsing, product detail, cart, checkout, account, seller product/order screens, B2B buyer screens, and the remaining admin management pages.

## 24. Customer Storefront Integration Completed For First Slice

The customer storefront has moved from placeholder shell to API-backed shopping screens.

Added storefront API and UI foundation:

- Typed storefront API helper for categories, products, cart, checkout, and customer order detail.
- Shared storefront header with search, customer cart count, account/seller/B2B/admin navigation, and responsive mobile menu.
- Product card component with image display, seller label, stock badge, price, and add-to-cart action.
- Public image resolution for portable product image asset keys and the temporary marketplace hero image source.

Added customer shopping routes:

- `/` now shows a real marketplace homepage with live categories and approved product sections.
- `/categories` lists active categories from `GET /api/categories`.
- `/categories/[slug]` loads the selected category and products filtered by category ID.
- `/search` searches approved public products through `GET /api/products?search=...`.
- `/products/[slug]` shows product image, variants, stock, seller details, quantity control, and add-to-cart.
- `/cart` reads the customer cart, updates quantities, removes items, and shows checkout totals.
- `/checkout` collects delivery address, delivery mode, payment method, and places an order through `POST /api/account/orders`.
- `/checkout/success/[orderNumber]` reads the placed order summary from the customer order detail API.

Verification completed:

- `pnpm --filter @indihub/web typecheck` passed.
- `pnpm --filter @indihub/web lint` passed.
- `pnpm --filter @indihub/web test` passed.
- `pnpm --filter @indihub/web build` passed outside the sandbox because the sandbox blocks Next.js worker spawning with `EPERM`.
- `pnpm typecheck` passed for the full monorepo.
- `pnpm test` passed for the full monorepo.
- `pnpm build` passed for the full monorepo.
- Local API health check returned 200 at `http://localhost:4000/api/health`.
- Local web homepage returned 200 at `http://localhost:3000/`.

Current storefront limitations:

- Checkout can place orders only when the selected payment method is enabled in platform settings.
- Cart and checkout now support both local dev auth and Clerk bearer-token customer auth; live flow still needs real auth env values and data.
- Storefront product data depends on approved seller products existing in the database.
- B2B enquiry CTA on product detail is still pending outside the customer shopping/account slice.

Next implementation stage:

1. Customer account profile, addresses, wishlist, order history, and order detail screens.
2. Public store profile and CMS policy/contact pages.
3. Seller product/order/B2B screens.
4. Remaining admin catalogue, order, CMS, report, settings, users, and audit screens.

## 25. Customer Account And Public Storefront Pages Completed

The next frontend slice was completed in Phase 1 order.

Added customer account routes:

- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/wishlist`
- `/account/orders`
- `/account/orders/[orderNumber]`
- `/account/support`

These screens are wired to customer profile, address, wishlist, cart, order, cancellation, and authenticated support APIs.

Added public storefront routes:

- `/stores/[slug]`
- `/contact`
- `/about`
- `/privacy-policy`
- `/terms-and-conditions`
- `/refund-return-policy`
- `/shipping-policy`
- `/seller-policy`

Added public approved-store API support:

- `GET /api/sellers/:slug`

The store profile route shows approved seller details and seller-specific approved products. Contact and support requests write to the backend support workflow. CMS/policy routes use published CMS page APIs with a pending-content fallback when final client content is not published yet.

Verification completed:

- `pnpm --filter @indihub/web typecheck` passed.
- `pnpm --filter @indihub/web lint` passed.
- `pnpm --filter @indihub/web test` passed; no frontend tests exist yet.
- `pnpm --filter @indihub/web build` passed outside the sandbox because the sandbox blocks Next.js worker spawning with `EPERM`.
- `pnpm --filter @indihub/api typecheck` passed.
- `pnpm --filter @indihub/api lint` passed.
- `pnpm --filter @indihub/api build` passed.
- `pnpm --filter @indihub/api test` passed outside the sandbox with 8 test files and 24 tests; sandbox execution was blocked by Vitest worker `spawn EPERM`.

Next implementation stage:

1. Seller center dashboard data, profile, product list/create/edit, orders, delivery update, B2B enquiries, and sales summary.
2. Admin catalogue/order/CMS/report/settings/users/audit screens.
3. B2B buyer portal screens.
4. Seller/admin/B2B role-specific Clerk redirects and protected portal polish.

## 26. Customer Module Completion Pass Completed

The customer module is now complete for the current Phase 1 code surface across backend and frontend.

Added customer backend completion items:

- Public safe order tracking API:
  - `POST /api/orders/track`
- Tracking requires order number plus matching customer email or delivery phone.
- Tracking returns safe customer-facing order, payment, delivery, item, location, and timeline details.
- Backend integration coverage now verifies public tracking after seller delivery update and rejects wrong contact details.

Added customer frontend completion items:

- Customer auth routes:
  - `/sign-in`
  - `/sign-up`
- Clerk UI renders when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is configured.
- Local customer dev-auth fallback renders when Clerk keys are absent.
- Product detail wishlist action is wired to the customer wishlist API.
- Checkout now supports saved customer address selection with manual-address fallback.
- Public order tracking page:
  - `/track-order`
- Storefront navigation and order-success actions now link to order tracking.

Updated tracking/status documentation:

- `docs/IndiHub_PHASE1_END_TO_END_CHECKLIST.md`

Verification completed:

- `pnpm --filter @indihub/api typecheck` passed.
- `pnpm --filter @indihub/api lint` passed.
- `pnpm --filter @indihub/api build` passed.
- `pnpm --filter @indihub/api test` passed with 8 test files and 24 tests.
- `pnpm --filter @indihub/web typecheck` passed.
- `pnpm --filter @indihub/web lint` passed.
- `pnpm --filter @indihub/web test` passed; no frontend test files exist yet.
- `pnpm --filter @indihub/web build` passed.

Known remaining customer launch dependencies:

- Real customer/product/payment/shipping data.
- Browser QA with seeded data and provider settings enabled.

## 27. Customer Production Authentication Completion Completed

The customer module production authentication gap has now been closed for the Phase 1 customer code surface.

Added customer API auth completion items:

- Added `@clerk/backend` verification support in the API.
- Protected APIs now accept `Authorization: Bearer <Clerk session token>` and verify the token server-side.
- Local dev headers remain available only outside production, unless explicitly enabled with `INDIHUB_ALLOW_DEV_AUTH=true`.
- Added `POST /api/auth/sync-current-user` so a signed-in Clerk customer session can safely create/update the 1HandIndia user and customer role mapping before customer APIs are called.

Added customer web auth completion items:

- Added shared customer auth context for local dev mode and Clerk production mode.
- Clerk mode reads `getToken()`, syncs the current customer user with the API, and then exposes bearer-token auth headers to customer screens.
- Storefront, cart, checkout, order success, product detail, product listing, store profile, account overview, profile, addresses, wishlist, orders, order detail, and support screens now use the shared customer auth context.
- Customer screens no longer build raw local dev customer headers directly.

Updated tracking/status documentation:

- `docs/IndiHub_PHASE1_END_TO_END_CHECKLIST.md`

Verification completed in this pass:

- `pnpm --filter @indihub/api typecheck` passed.
- `pnpm --filter @indihub/api lint` passed.
- `pnpm --filter @indihub/api build` passed.
- `pnpm --filter @indihub/api test` passed outside the sandbox with 8 test files and 25 tests; sandbox execution was blocked by Vitest worker `spawn EPERM`.
- `pnpm --filter @indihub/web typecheck` passed.
- `pnpm --filter @indihub/web lint` passed.
- `pnpm --filter @indihub/web test` passed; no frontend test files exist yet.
- `pnpm --filter @indihub/web build` passed outside the sandbox because the sandbox blocks Next.js worker spawning with `EPERM`.

Known remaining customer launch dependencies:

- Real Clerk environment values:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY` or `CLERK_JWT_KEY`
  - Optional `CLERK_JWT_AUDIENCE`
  - Optional `CLERK_AUTHORIZED_PARTIES`
- Real customer/product/payment/shipping data.
- Browser QA with seeded data and provider settings enabled.
