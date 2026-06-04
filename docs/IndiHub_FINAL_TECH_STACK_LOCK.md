# 1HandIndia Final Technology Stack Lock

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Final Phase 1 Technology Stack Lock  
**Lock Date:** 23-05-2026  
**Scope Source:** `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`  
**Approved Phase 1 Budget:** INR 200,000  
**Status:** Locked for Phase 1 scaffolding and development

## 1. Lock Purpose

This document locks the technology stack for 1HandIndia Phase 1.

After this lock, development should not switch framework, database, auth method, API architecture, or deployment direction unless the client approves a change request.

The stack is chosen for a serious marketplace portal while keeping Phase 1 aligned with the frozen web-first scope and the approved INR 200,000 budget.

## 2. Final Phase 1 Stack

| Area | Locked Technology | Phase 1 Decision |
|---|---|---|
| Repository | Turborepo + pnpm workspaces | Use a TypeScript monorepo so web, API, worker, database, validators, UI, and shared types stay organized. |
| Main language | TypeScript | Use TypeScript across frontend, backend, workers, shared packages, and validation. |
| Web app | Next.js App Router + React | Build customer storefront, customer account, seller center, B2B buyer portal, and admin panel as one web app with separated route groups. |
| Styling and UI | Tailwind CSS + shadcn/ui + Radix UI + lucide-react | Use polished, accessible, fast-to-build UI components without copying any ecommerce brand. |
| API client/server state | TanStack Query | Use for all API-backed data in dashboards, products, orders, reports, and account pages. |
| Local UI state | Zustand | Use only for small UI state such as cart drawer, filters, selected layout, and temporary interface state. |
| Forms | React Hook Form + Zod | Use for customer, seller, B2B, admin, checkout, settings, and product forms. |
| Tables | TanStack Table | Use for seller/admin tables, reports, order lists, product lists, customer lists, and audit logs. |
| Backend API | NestJS + REST + OpenAPI | Use one structured API service with modules, guards, DTO validation, Swagger docs, and clean service boundaries. |
| Backend architecture | Modular monolith | Do not start with microservices. Build one API split into modules for users, sellers, products, orders, payments, delivery, reports, CMS, notifications, settings, and audit logs. |
| Database | PostgreSQL | Use relational consistency for users, sellers, products, carts, orders, payments, delivery records, B2B enquiries, email logs, settings, and audit logs. |
| ORM | Prisma ORM | Use Prisma schema, migrations, seed scripts, typed client, and transaction support. |
| Auth identity | Clerk | Clerk handles sign-in, sign-up, sessions, MFA-ready identity, and account security. |
| Authorization | PostgreSQL RBAC + NestJS Guards | 1HandIndia business permissions stay in the database. Clerk proves identity; 1HandIndia decides what each role can access. |
| Cache and jobs | Redis + BullMQ | Use for queued emails, notification retries, background jobs, rate limits, and future search/integration jobs. |
| Product search | PostgreSQL indexed search for Phase 1 | Use PostgreSQL search and indexed filters for the frozen basic search scope. Keep a search service boundary so Meilisearch can be added later without rewriting screens. |
| Public images | Portable asset keys + ImageKit or S3-compatible provider | Store only asset keys in the database and resolve public URLs through the configured provider/base URL for product images, seller logos, seller banners, homepage banners, and responsive delivery. |
| Private files | S3-compatible storage if private documents are collected | Use only if seller KYC, support attachments, or private documents are required during Phase 1. |
| Payments | Razorpay-ready adapter + COD/manual toggles | Code should be Razorpay-ready, but live online payments activate only after approved keys are provided. COD/manual bank transfer are toggles if the client confirms them. |
| Delivery | Manual delivery and courier details | Store manual partner/courier name, phone, tracking reference, delivery notes, estimate, and status. No live courier API in Phase 1. |
| Email | Adapter-based transactional email using Resend, SendGrid, or SMTP | Build templates and logs for account, seller, product, order, B2B, and support emails. Provider depends on client account/domain readiness. |
| Reports | PostgreSQL aggregate reports | Build sales, seller, product, enquiry, and basic admin reports from platform data. |
| Audit logs | PostgreSQL audit log table | Record seller approval, product approval, order updates, delivery updates, payment status updates, settings, CMS, and role changes. |
| Logging | Pino structured logs | Use JSON logs for API and worker services. |
| Error tracking | Sentry-ready | Add Sentry configuration if client provides account/project details; otherwise keep environment-ready integration points. |
| Testing | Vitest + Supertest + Playwright | Use unit tests, API tests, and browser flow tests for critical marketplace paths. |
| CI/CD | GitHub Actions | Run lint, typecheck, build, tests, Prisma checks, and deployment gates. |
| Phase 1 deployment | Vercel for web + Render/Railway/Fly/AWS for API and worker | Use managed PostgreSQL, managed Redis if jobs are deployed, configurable public/private storage providers, and environment variables for all secrets. |

## 3. Phase 1 Repository Structure

Use this structure when scaffolding starts:

```text
indihub/
  apps/
    web/
    api/
    worker/
  packages/
    database/
    config/
    validators/
    shared-types/
    ui/
    eslint-config/
    tsconfig/
  prisma/
  docs/
```

Do not scaffold native mobile apps in Phase 1 unless the client approves a separate mobile-app change request.

## 4. Phase 1 Active App Surfaces

The locked web app must support these separate areas:

- Public customer storefront.
- Customer account.
- Seller center for marketplace sellers, hyperlocal stores, and wholesale distributors.
- B2B buyer portal.
- Admin control panel.
- CMS and policy pages.

The UI must keep customer, seller, B2B, and admin experiences clearly separated.

## 5. Deferred Future Stack

These technologies are approved as future direction, but they are not active Phase 1 build requirements:

| Future Area | Future Technology Direction | Phase 1 Status |
|---|---|---|
| Native customer app | React Native + Expo | Future upgrade. |
| Seller mobile app | React Native + Expo | Future upgrade. |
| Push notifications | Firebase Cloud Messaging or Expo Notifications | Future upgrade with mobile app. |
| Advanced product search | Meilisearch, later OpenSearch if needed | Future upgrade after Phase 1 basic search. |
| Live courier tracking | Shiprocket first, Delhivery adapter later | Future upgrade. |
| Automated seller payouts | RazorpayX or Cashfree Payouts | Future upgrade after provider approval. |
| SMS alerts | MSG91, Twilio, or client-approved provider | Future upgrade. |
| WhatsApp automation | Meta WhatsApp Cloud API | Future upgrade after template/business approval. |
| Product analytics | PostHog | Future upgrade or optional add-on. |
| Advanced B2B RFQ/PO workflow | Extended B2B modules | Future upgrade. |
| Realtime chat | NestJS WebSockets + Socket.IO + Redis adapter | Future upgrade. |

## 6. Non-Negotiable Engineering Rules

- Use UUID primary keys.
- Store money in paise as integer fields where practical.
- Keep currency fields even if Phase 1 uses INR.
- Keep identity and business authorization separate.
- Use database-backed roles and permissions from the beginning.
- Add audit logs for sensitive admin, seller, order, product, delivery, payment, CMS, and role actions.
- Use provider adapters for payment, email, delivery, storage, and future notification services.
- Never store provider secrets in source code.
- Use Prisma migrations for database changes.
- Keep public image storage separate from private document storage.
- Treat all third-party fees, provider approvals, domains, hosting, email, SMS, WhatsApp, payment, courier, and storage charges as separate from the INR 200,000 development budget.

## 7. Phase 1 Build Order After Stack Lock

1. Scaffold Turborepo workspace.
2. Create Next.js web app, NestJS API app, and worker app.
3. Configure TypeScript, ESLint, Prettier, shared config, and environment structure.
4. Add Prisma, PostgreSQL connection, base schema, and seed structure.
5. Build auth mapping, users, roles, permissions, and guards.
6. Build admin base layout and settings.
7. Build seller registration and approval.
8. Build categories, products, variants, images, and inventory.
9. Build storefront browsing and product detail.
10. Build customer account, address book, cart, checkout, and orders.
11. Build seller order view and manual delivery updates.
12. Build transactional email templates, logs, and queue jobs.
13. Build B2B enquiry flow.
14. Build CMS pages, banners, reports, and audit logs.
15. Run full role-based QA and launch readiness checks.

## 8. Locked Decision Summary

The locked 1HandIndia Phase 1 stack is:

```text
Turborepo + pnpm
TypeScript
Next.js App Router + React web app
Tailwind CSS + shadcn/ui + Radix UI + lucide-react
TanStack Query + Zustand
React Hook Form + Zod
NestJS REST API + OpenAPI
PostgreSQL + Prisma ORM
Clerk authentication
PostgreSQL RBAC + NestJS Guards
Redis + BullMQ
PostgreSQL indexed search for Phase 1
Portable asset-key public image storage with configurable ImageKit or S3-compatible delivery
S3-compatible private storage only if needed
Razorpay-ready payment adapter
Manual delivery/courier tracking
Email adapter with templates and logs
Pino logs + audit logs + Sentry-ready hooks
Vitest + Supertest + Playwright
GitHub Actions
Vercel web deployment + managed API/worker hosting
```

This stack is now locked for Phase 1.
