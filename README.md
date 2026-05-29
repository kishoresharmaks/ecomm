# 1HandIndia Multi-Vendor Ecommerce Marketplace

1HandIndia is planned as a large multi-vendor ecommerce marketplace with B2C shopping, B2B business buying, nearby-store/vendor selling, admin control, mobile apps, logistics, payouts, analytics, and advanced marketplace features.

The target quality is a professional marketplace portal similar in seriousness and operational depth to large ecommerce platforms such as Flipkart, without copying any brand identity, UI, content, or proprietary behavior.

## Current Workspace Status

- This workspace has moved from preparation into Phase 1 implementation.
- Client approval and scope documents are available under `docs/`.
- The final Phase 1 feature scope is frozen as a web-first marketplace build for INR 200,000.
- The final Phase 1 technology stack is locked in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`.
- Application source code has been implemented across the web, API, worker, shared packages, Prisma schema, customer, seller, B2B, admin, finance, CMS, support, reports, and location surfaces.
- The approved project budget is now INR 200,000.
- Final client details, product data, policy content, Razorpay account activation, email settings, and hosting/provider accounts must still be confirmed before launch.

## Important Documents

| Document | Purpose |
|---|---|
| `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md` | Final client scope confirmation for Phase 1. |
| `docs/IndiHub_WhatsApp_Feature_List.md` | WhatsApp-ready feature summary for client sharing. |
| `docs/IndiHub_PROJECT_SCOPE_AND_REQUIREMENTS.md` | Complete product scope and requirements reference. |
| `docs/IndiHub_BUILD_BLUEPRINT_MNC_PORTAL.md` | Recommended architecture and build blueprint. |
| `docs/IndiHub_FINAL_TECH_STACK_LOCK.md` | Official locked Phase 1 technology stack for scaffolding and development. |
| `docs/IndiHub_TECH_STACK_DECISION.md` | Expanded technology decision notes and future-ready architecture guidance. |
| `docs/IndiHub_REQUIREMENT_COLLECTION_CHECKLIST.md` | Details to collect from the client before development. |
| `docs/IndiHub_BRAND_DIRECTION.md` | Working brand name, logo status, and elegant color palette. |
| `docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md` | Phase 1 UI screen inventory and database planning document. |
| `docs/ui-screen-images/index.html` | Generated Phase 1 UI screen image gallery for client review. |
| `docs/IndiHub_IMPLEMENTATION_START_PHASE1.md` | First implementation milestone note and local run/verification status. |
| `docs/IndiHub_PHASE1_END_TO_END_CHECKLIST.md` | Complete Phase 1 done/pending checklist and next implementation order. |
| `docs/IndiHub_RENDER_NEON_TEST_DEPLOYMENT.md` | Render + Neon temporary testing deployment guide and environment checklist. |
| `docs/WORKSPACE_SKILL_LOADING_GUIDE.md` | Skills and working process for future Codex sessions. |
| `AGENTS.md` | Future-agent operating instructions for this workspace. |

## Frozen Phase 1 Scope Summary

- Multi-vendor ecommerce website.
- B2C customer shopping.
- Basic B2B enquiry and quotation request workflow.
- Vendor, seller, and nearby-store selling.
- Admin panel.
- Products, categories, cart, checkout, and orders.
- Seller dashboard and product management.
- Manual delivery/order status tracking with delivery partner/courier details.
- Payment gateway readiness.
- Transactional email notifications for accounts, orders, seller alerts, and B2B enquiries.
- Basic reports, content pages, policy pages, and audit records.
- Native mobile apps, live courier integration, automated payouts, chatbot, advanced analytics, advanced RFQ/PO workflows, multi-language, and multi-currency are future upgrades.

## Recommended Build Direction

The Phase 1 stack is locked in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`. Summary:

- Monorepo: Turborepo + pnpm.
- Web: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: NestJS API with REST and OpenAPI.
- Database: PostgreSQL with Prisma ORM.
- Auth: Clerk for identity, PostgreSQL-backed RBAC for business permissions.
- Cache/jobs: Redis + BullMQ.
- Search: PostgreSQL indexed search for Phase 1, Meilisearch later if needed.
- Storage: portable asset keys in the database, with ImageKit or S3-compatible storage configurable for public images and S3-compatible storage for private files if needed.
- Payments: admin-managed Razorpay Checkout configuration, server-side checkout signature verification, signed webhook handling, COD limits/instructions, bank transfer, manual toggles, and duplicate-checkout protection.
- Delivery: Manual delivery/courier tracking in Phase 1; live courier API later.
- Observability: Sentry, Pino logs, audit logs.

Native mobile apps, automated payouts, Shiprocket/Delhivery live courier integration, SMS/WhatsApp automation, PostHog analytics, and advanced B2B workflows remain future upgrades unless separately approved.

## Next Step

Run browser-level end-to-end QA with the web and API servers running together, then use `docs/IndiHub_RENDER_NEON_TEST_DEPLOYMENT.md` for temporary Render + Neon hosting while production database, Redis, domain, Clerk, public image provider/base URL, Razorpay, email, backup, and monitoring details are confirmed.
