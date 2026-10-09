# AGENTS.md - 1HandIndia Workspace Instructions

Production multi-vendor ecommerce marketplace. Treat it as a serious production portal, not a demo.
Current build status, completed modules and verification history live in `docs/STATUS.md` (read it when you need to know what exists; do not copy it back into this file).

## 1. First Read Order

Read these before making project decisions or writing code (skip ones irrelevant to a pure question or doc-only task):

1. `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md` (active scope source)
2. `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`
3. `docs/IndiHub_PROJECT_SCOPE_AND_REQUIREMENTS.md`
4. `docs/IndiHub_BUILD_BLUEPRINT_MNC_PORTAL.md`
5. `docs/IndiHub_FINAL_TECH_STACK_LOCK.md` (locked tech stack source)
6. `docs/IndiHub_TECH_STACK_DECISION.md`
7. `docs/IndiHub_REQUIREMENT_COLLECTION_CHECKLIST.md`
8. `docs/IndiHub_BRAND_DIRECTION.md`
9. `docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md`
10. `docs/WORKSPACE_SKILL_LOADING_GUIDE.md`
11. `.agents/skills/beeshub-marketplace/SKILL.md`

**Naming note:** the product is **1HandIndia**. `IndiHub` survives in doc filenames, the package scope (`@indihub/*`) and env var prefixes; `beeshub-marketplace` is the skill folder name. Do not rename these without approval.

## 2. Product Target

A professional marketplace with the operational depth of a large ecommerce platform:
customer storefront, vendor/seller center, B2B buyer portal, admin control panel, finance workspace, delivery partner workspace, mobile apps, courier workflow, seller payouts, analytics, and trust/safety/support/audit controls.

- Customer and seller experiences are **separate applications** even when they share the monorepo, backend, database, brand system or web deployment. Plan screens, navigation, auth entry points, QA flows and mobile apps separately.
- Keep admin, seller, customer, B2B, finance and delivery experiences clearly separated.
- Do not copy Flipkart/Amazon (or any competitor) branding, UI, text or protected content. Extract the functional requirement only (e.g. "mobile app download promo") and implement it with 1HandIndia's brand, typography and original copy.

## 3. Scope Rules

- Active governance: `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`. Phase 1 documents are history (budget, approvals) and no longer limit the completeness of a selected feature.
- If the user approves or asks for a feature, implement the complete production version **of that feature** across backend, UI, permissions, audit, settings, provider and test surfaces. Do not use "Phase 1", "basic only", "future scope" or "later upgrade" language to shrink a selected feature.
- Do not silently remove client-approved features.
- Mark third-party fees, account approvals and provider delays separately from development work.
- **Scope precedence (resolves "complete feature" vs "minimal edit"):** be complete *within the requested feature and its own files*; touch nothing outside it. If finishing properly requires changing another subsystem, shared file, or DB schema outside the request, explain why and get explicit user approval first.

## 4. Mandatory Prompt Execution Protocol

For every prompt, in order:

1. **Analyze & extract constraints** - parse requirements, bug reports, attached visuals; note explicit constraints (e.g. "don't push to git", exact colors, behavior to preserve).
2. **Inspect existing code first** - read the current implementation, component structure and data flow before editing. Diagnose the concrete root cause before changing anything.
3. **Minimal scope** - touch only the files/lines the request needs. Do not remove, redesign, refactor or add unrelated features, elements or styles. Cross-subsystem changes need approval (see Scope precedence).
4. **Apply domain skills** from `.agents/skills/` (see section 5).
5. **Precise execution** - surgical, targeted edits. Preserve type safety, accessibility and error handling.
6. **Verify, scaled to the change:**
   - Questions, explanations, doc-only edits: no gate.
   - Code changes: run typecheck, lint and tests for the affected package(s) once per logical unit of completed work (`pnpm --filter <pkg> typecheck|lint|test`; add `build` for web/API changes that affect routes or build output; `pnpm db:validate` for schema changes). Do not run commands speculatively.
   - Report any failure honestly; never claim a gate passed without running it.
7. **Report concisely** - exact changes, modified files, verification outcome. Honor all workspace rules and user instructions.

## 5. Skill Guidance

- `beeshub-marketplace` - marketplace scope, architecture, governance.
- `backend-db-architecture` - PostgreSQL, Prisma, transactions, indexing, concurrency, ledger integrity.
- `backend-api-design` - NestJS REST contracts, DTO validation, multi-tier RBAC, webhook security, rate limiting.
- `ecommerce-operations` - order split lifecycle, pricing security, statutory taxes (1% TDS / 1% TCS), payouts, courier logistics.
- `frontend-craftsmanship` - Next.js App Router, React performance, TanStack Query, accessibility, brand UI discipline.
- `frontend-design` - visual direction, typography, UX layout, distinct portal identities.
- `technical-writer`, `project-planner`, `code-reviewer`, `debugger`, `verification` - docs, roadmaps, reviews, runtime bug fixing, end-to-end validation.

## 6. Repo Map & Environment

- Turborepo monorepo: `apps/web` (Next.js **16.2.6**), `apps/api` (NestJS), `apps/worker` (plain Node polling app), `apps/mobile` (Expo/React Native), `packages/*` (shared, incl. `@indihub/database` Prisma client), `prisma/`.
- Next.js 15+ async `params`/`searchParams` APIs apply (`const { requestNumber } = await params;`). Account for this when diagnosing related bugs.
- Local web: `http://localhost:3000`. Local API: `http://localhost:4000/api`. Always verify running processes before assuming they are active.
- This workspace may not be a git checkout - use direct file inspection rather than relying on `git status`/`git diff`.
- **Windows PowerShell:** chain dependent commands with `; if ($LASTEXITCODE -eq 0) { next } else { exit 1 }`. Never use `&&`. Use `pnpm.cmd` where `pnpm` is not resolved. Batch typecheck/test/lint into one pipeline.
- Standalone admin login needs backend env `INDIHUB_FIRST_ADMIN_EMAIL` and `INDIHUB_FIRST_ADMIN_PASSWORD` for first setup; optional `ADMIN_SESSION_TTL_HOURS`.
- Clerk: matching frontend/backend keys are required; `CLERK_JWT_KEY` is supported.

## 7. Data Safety & Secrets

- Never print Clerk or provider secrets from `.env` files. Report only key names, lengths or presence.
- The connected DB may be pre-production/staging. Do **not** run DB-writing integration tests, bootstrap seed modes, location imports, cleanup scripts or ad hoc mutation scripts against it without explicit approval of that exact write.
- Backend integration tests are opt-in: local disposable PostgreSQL whose name contains `test`, `e2e` or `integration`, with `INDIHUB_ALLOW_INTEGRATION_TEST_DB=true`.
- Seeding: `pnpm db:seed` is schema-only (no data). `pnpm db:seed:system` = RBAC reference rows. `pnpm db:seed:bootstrap` = local/dev bootstrap only. Production-like write modes require `INDIHUB_ALLOW_PRODUCTION_SEED=true` for an approved one-time operation. Seeds must never overwrite existing platform `Setting` values or `EmailSetting`.

## 8. Engineering Rules

### 8.1 General
- Role-based access control from the start; audit logs for admin, vendor, payout, product, order and policy-sensitive actions.
- Validate all user and vendor input. Prefer structured documents and typed schemas over ad hoc notes.
- Confirm the chosen stack and generated app structure before a major implementation step.
- **Prevent literal widening:** when returning default/fallback objects from hooks, type them explicitly or use `as const` (`status: "signed-out" as const`) so unions are not widened to `string`.
- **Strict fallback semantics:** fallback/default values replace only missing, null or zero values. Never use `Math.max()` or similar to override an explicit, valid user input with a fallback.
- **Transparent Redis fallback:** anything using Redis/BullMQ (cache, queue, rate limit) must silently fall back to synchronous execution, DB polling or in-memory `Map` when `REDIS_URL` is undefined or unavailable. The app must bootstrap and work in fallback mode.
- **Authenticated file downloads:** never use `<a href download>` for endpoints needing the `Authorization` header. `fetch` with auth headers -> `Blob` -> `URL.createObjectURL` -> programmatic click on a hidden anchor.
- **Worker/API boundary:** `apps/worker` is not NestJS (no `@nestjs/schedule`, no API DI providers). Simple DB updates: use the shared `@indihub/database` Prisma client directly. Complex domain operations (geospatial, assignment, state machines): do not duplicate API logic - add an `@Controller("internal/...")` endpoint in `apps/api`, protect it with an internal secret header, and have the worker call it via `fetch`.
- **API payload hygiene:** never expose internal diagnostics, `snapshot` fields or routing/audit traces in public/customer API responses. Keep them in the DB or authenticated admin APIs; trim public responses to what the UI renders.
- **Type-safe DTO propagation:** when adding a DB field (e.g. `maxWeightKg`), add it explicitly to the relevant `Prisma.select` (e.g. `checkoutSummaryItems`) before passing it onward, to avoid silent `any` widening or `undefined` at runtime.
- **Delivery status updates:** when changing delivery status in `orders.service.ts` (including shared delivery update flows), update `orderShipment` **and** `orderShipmentPackage` together, deriving the package status with `this.packageStatusFromDeliveryStatus`. Courier and other workspaces depend on `orderShipmentPackage.status`.
- **Domain-strict querying:** never filter operational queries on status alone (`UNASSIGNED`, `PACKED`). Always scope by the domain discriminator (e.g. `deliveryMode: LOCAL_DELIVERY_PARTNER`) so one domain's records never leak into another's workspace.

### 8.2 UI, Brand & Copy
- **Locked palette:** primary `#ED3500`, secondary `#FFFCFB`, text `#101828`. Never introduce unapproved primary theme colors (deep navy, black themes, generic dark modes) on large surfaces, marketing, landing or structural elements.
- **Production-ready language:** no internal system terms in UI copy ("Admin review workflow", "Capability-based menus"). Use customer/seller-facing language ("Quality assured marketplace", "Tailored dashboard").
- **Portal identity:** seller/vendor UI copy and headers use **"1HandIndia Seller Hub"**, never the bare marketplace name ("Welcome to 1HandIndia").
- UI must be polished, responsive and operationally useful. Use branded Headless UI confirmation modals for destructive/lifecycle actions; no native `confirm`/`alert`/`prompt`.
- **Admin technical fields:** any field using a technical financial unit needs an inline Info tooltip or helper text. For BPS fields always state `100 BPS = 1%` and one sentence on what the field does (e.g. "Reduces the marketplace commission for sellers on this plan"). Do not assume admins know financial jargon.

### 8.3 Database & Indexing
1. **Index every foreign key.** Every `@relation(fields: [...])` needs an index (hot paths like `cart_items.product_variant_id`, `order_items.product_variant_id`, and audit/admin FKs like `cancelled_by`, `verified_by`). A composite index that *starts with* the FK is sufficient; otherwise add `@@index([foreignKeyId])`.
2. **No redundant single-column indexes.** Skip `@@index([status])` if a composite starting with that column (e.g. `[status, createdAt]`) or a `@unique` exists. Avoid write amplification on high-churn tables (orders, order items, notification logs).
3. **Specialized index types:**
   - Full-text: index `tsvector` columns with GIN: `@@index([searchVector], type: Gin)`.
   - Fuzzy search (`products.name`, `sellers.storeName`): `pg_trgm`, with `postgresqlExtensions` in `previewFeatures` and `@@index([name(ops: raw("gin_trgm_ops"))], type: Gin)`.
   - JSONB filtering (`@>`): `@@index([attributes(ops: raw("jsonb_path_ops"))], type: Gin)`.
- Prisma: no array-form `$transaction([...])` in application code; use interactive transactions, and avoid interactive transactions for read-only listings.

### 8.4 Payments & Razorpay
- Checkout totals are server-priced. Verify Razorpay callback signatures server-side; webhooks use raw-body signature validation; a late failed webhook must never downgrade an already paid payment; block duplicate checkout submits transactionally.
- **Subscription signature (if subscription flows exist):** HMAC payload is always `payment_id + "|" + subscription_id` (not the standard order).
- **Auto-healing test data:** before returning a stored Razorpay ID (e.g. `sub_xxxx`) to the client, verify it via Razorpay `GET`; on 404/dead status generate a fresh ID to avoid "The id provided does not exist" crashes after test-environment resets.
- Settings readers must coerce legacy string/number boolean and numeric values so saved settings never appear reset.

### 8.5 Finance & Money
- **Strict financial assertions:** incoming financial amounts from external parties (e.g. delivery partner COD cash collected) must equal the expected `amountPaise` with strict `===`. Reject partial submissions entirely; never accept "greater than zero".
- **Net Projected Exposure** (COD exposure, credit limits, etc.): never compare a static/lifetime gross amount to a limit. Compute inside a transactional row lock (`SELECT ... FOR UPDATE`):
  `Net Projected Exposure = (Unsettled Gross Value) + (Assigned/Pending Future Liabilities) - (Prepaid/Deposit Wallet Balances)`
  - Always add the value of the new assignment being evaluated.
  - Negative net exposure is valid headroom; do not floor it to `0`.
  - Any withdrawal flow for prepaid/offset wallets must enforce the same Net Projected Exposure check.
- **Finance report derivation:** for seller tax/finance/sales summaries never read `_sum.netPayablePaise` (stale stamped values). Re-derive:
  `netPayablePaise = grossSales - commission - gstOnCommission - tds - tcs - platformFee - couponSellerFundedDiscount + couponAdjustment + refundAdjustment`
  This must match `FinanceCalculatorService.calculateSplit()`.
- **Formula transparency:** when explaining financial reports, wallet balances or payouts, give the exact formula used in code and map backend names (`netPayablePaise`) to UI labels ("Net payable"). Do not summarize without the formula.
- **Date filters:** when a seller/finance API `queryString()` helper receives `dateFrom`/`dateTo` as 10-char `YYYY-MM-DD`, convert to local-time ISO (`dateFrom` -> `T00:00:00.000`, `dateTo` -> `T23:59:59.999`) then `.toISOString()` for correct UTC bounds. Already applied to all 14 seller/finance API client files - do not revert.
- **Reconciliation direction:** *new* high-volume financial handovers (e.g. COD collections) must be designed as zero-touch automated pipelines (Virtual Accounts such as Razorpay Smart Collect, webhooks, FIFO auto-reconciliation), not manual screenshot-approval flows. Existing manual COD/bank-transfer verification (admin/finance) is the current implementation, not the target design.

### 8.6 Delivery, Routing & Checkout
- **Enforce physical origins:** never assume a seller has a valid origin. Adding products, accepting orders or initiating shipments must first require at least one seller address with saved `latitude` and `longitude`. Hard-block instead of falling back to arbitrary "base" distances.
- **Weight-based delivery boundaries:** restrict assignment at checkout, not via partner rejections. `Product.weightKg` (existing products default to `0kg`); `ShippingRateCard.maxWeightKg`; checkout pricing sums cart weight and, if it exceeds a rate card's `maxWeightKg`, that mode (e.g. Local Delivery) is unavailable, forcing Manual Transport or a heavy Courier.
- **Single-pass routing:** evaluate all delivery modes in one batch (`resolveAllDeliveryOptions`) when computing `availableDeliveryOptions`. Never fan out concurrent `resolveDelivery`/routing calls via `Promise.all` where they share location, proximity or courier DB queries.
- **Explicit unavailable states:** when a choice (delivery mode, payment method) is restricted by business rules (pincode coverage, weight limit, basket size, no local partners), return/render it as disabled with `available: false` and a clear `reason` (e.g. "Exceeds 5kg limit"). Do not silently filter it out.
- **Delivery partner payouts:** static, predictable model (Base Pay + Per KM with a minimum floor). No surge pricing, milestone gamification or weather incentives unless explicitly requested.

### 8.7 Mobile (`apps/mobile`)
- **Domain boundaries:** tab content stays in its domain. B2B tabs: only B2B Enquiries and B2B Orders. Subscriptions live in Profile/Account. Returns live in Orders. Reviews, Coupons and Deals live in Sales or Products. Do not group unrelated features.
- **Images:** render user-uploaded assets (logos, banners) with `expo-image` or RN `<Image>`, never text initials or "Ready" placeholders. Build the full URL from the API base URL plus the asset key.
- **Aesthetics:** modern, professional spacing, shadows and premium card layouts; no minimum-viable styling.
- **Banners/carousels:** no left/right arrow navigation; auto-slide every 3 seconds when more than one item; glassmorphism - backend-provided (especially dark) background colors rendered semi-transparent (e.g. `rgba(..., 0.8)`) or over a native blur view, never flat opaque.

## 9. Definition of Done

- Request satisfied within minimal scope; no unrelated changes.
- Relevant gates (section 4, step 6) run and passing, or failures reported plainly.
- No secrets printed, no writes to the staging DB without approval.
- If the change alters what exists or how it was verified, add a short dated entry to `docs/STATUS.md` (not to this file).