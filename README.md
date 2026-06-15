# 1HandIndia Multi-Vendor Ecommerce Marketplace

1HandIndia is planned as a large multi-vendor ecommerce marketplace with B2C shopping, B2B business buying, marketplace seller, hyperlocal store, and wholesale distributor selling, admin control, mobile apps, logistics, payouts, analytics, and advanced marketplace features.

The target quality is a professional marketplace portal similar in seriousness and operational depth to large ecommerce platforms such as Flipkart, without copying any brand identity, UI, content, or proprietary behavior.

## Current Workspace Status

- This workspace has moved from preparation into active product implementation.
- Client approval and scope documents are available under `docs/`.
- Historical Phase 1 scope and budget documents are retained for approval history.
- Active implementation now follows `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`: selected features must be completed as production marketplace features.
- The current technology stack is locked in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`.
- Application source code has been implemented across the web, API, worker, shared packages, Prisma schema, customer, seller, B2B, admin, finance, CMS, support, reports, and location surfaces.
- The approved project budget is now INR 200,000.
- Final client details, product data, policy content, Razorpay account activation, email settings, and hosting/provider accounts must still be confirmed before launch.

## Important Documents

| Document | Purpose |
|---|---|
| `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md` | Active rule: selected features are implemented fully, not limited by generic Phase 1 scope. |
| `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md` | Historical client scope confirmation and budget record. |
| `docs/IndiHub_WhatsApp_Feature_List.md` | WhatsApp-ready feature summary for client sharing. |
| `docs/IndiHub_PROJECT_SCOPE_AND_REQUIREMENTS.md` | Complete product scope and requirements reference. |
| `docs/IndiHub_BUILD_BLUEPRINT_MNC_PORTAL.md` | Recommended architecture and build blueprint. |
| `docs/IndiHub_FINAL_TECH_STACK_LOCK.md` | Official locked product technology stack for development. |
| `docs/IndiHub_VPS_PRODUCTION_SETUP_RUNBOOK.md` | Complete VPS hosting, production setup, feature configuration, QA, monitoring, backup, and troubleshooting runbook. |
| `docs/IndiHub_TECH_STACK_DECISION.md` | Expanded technology decision notes and future-ready architecture guidance. |
| `docs/IndiHub_REQUIREMENT_COLLECTION_CHECKLIST.md` | Details to collect from the client before development. |
| `docs/IndiHub_BRAND_DIRECTION.md` | Working brand name, logo status, and elegant color palette. |
| `docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md` | Product UI screen inventory and database planning document. |
| `docs/ui-screen-images/index.html` | Generated planning image gallery for client review. |
| `docs/IndiHub_IMPLEMENTATION_START_PHASE1.md` | First implementation milestone note and local run/verification status. |
| `docs/IndiHub_PHASE1_END_TO_END_CHECKLIST.md` | Historical implementation checklist and progress tracker. |
| `docs/WORKSPACE_SKILL_LOADING_GUIDE.md` | Skills and working process for future Codex sessions. |
| `AGENTS.md` | Future-agent operating instructions for this workspace. |

## Active Full Implementation Rule

- If a feature is selected for development, implement the complete production marketplace version.
- Do not use generic Phase 1, basic-only, future-scope, or later-upgrade language to reduce an approved feature.
- Complete means backend, database, UI, permissions, audit logs, admin controls, relevant role surfaces, edge cases, tests, and documentation.
- Historical Phase 1 documents still explain the original budget and approval history, but the active implementation rule is full-feature completion.

## Recommended Build Direction

The current product stack is locked in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`. Summary:

- Monorepo: Turborepo + pnpm.
- Web: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: NestJS API with REST and OpenAPI.
- Database: PostgreSQL with Prisma ORM.
- Auth: Clerk for identity, PostgreSQL-backed RBAC for business permissions.
- Cache/jobs: no Redis in the current VPS deployment mode; PostgreSQL-backed indexing and direct/DB-audited notification delivery are used now. Redis/BullMQ can be added later only for an explicitly selected queued workflow.
- Search: PostgreSQL indexed search is the current implementation; Meilisearch can be added when selected for full catalogue search.
- Storage: portable asset keys in the database, with ImageKit or S3-compatible storage configurable for public images and S3-compatible storage for private files if needed.
- Payments: admin-managed Razorpay Checkout configuration, server-side checkout signature verification, signed webhook handling, COD limits/instructions, bank transfer, manual toggles, and duplicate-checkout protection.
- Delivery: Current delivery tracking and partner workflows are implemented in the web stack; any selected logistics expansion should be implemented end to end.
- Observability: Sentry, Pino logs, audit logs.

Native mobile apps, automated payouts, Shiprocket/Delhivery live courier integration, SMS/WhatsApp automation, PostHog analytics, and advanced B2B workflows are not excluded by default. When selected, they should be scoped and implemented as complete production features.

## Next Step

Run browser-level end-to-end QA with the web and API servers running together, then prepare deployment once hosting, production database, domain, Clerk, public image provider/base URL, Razorpay, email, backup, and monitoring details are confirmed.
