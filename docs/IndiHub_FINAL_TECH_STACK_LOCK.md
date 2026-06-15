# 1HandIndia Final Technology Stack Lock

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Current Product Technology Stack Lock  
**Lock Date:** 23-05-2026  
**Scope Governance:** `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`  
**Historical Approved Budget:** INR 200,000  
**Status:** Locked for current product development

## 1. Lock Purpose

This document locks the technology stack for 1HandIndia product development.

After this lock, development should not switch framework, database, auth method, API architecture, or deployment direction unless the user/client explicitly approves the change.

The stack is chosen for a serious marketplace portal and must support full production implementation of selected features.

## 2. Final Product Stack

| Area | Locked Technology | Product Decision |
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
| Cache and jobs | No Redis in the current VPS deployment mode | Current production setup runs without Redis. PostgreSQL-backed indexing, direct/DB-audited notification delivery, Nginx/CDN limits, and application safeguards are used now. Redis/BullMQ can be added later only for an explicitly selected queued workflow. |
| Product search | PostgreSQL indexed search | Use PostgreSQL search and indexed filters as the current implementation. Keep a search service boundary so Meilisearch can be added for full advanced catalogue search without rewriting screens. |
| Public images | Portable asset keys + ImageKit or S3-compatible provider | Store only asset keys in the database and resolve public URLs through the configured provider/base URL for product images, seller logos, seller banners, homepage banners, and responsive delivery. |
| Private files | S3-compatible storage if private documents are collected | Use for seller KYC, support attachments, private documents, proofs, or other selected workflows that require private files. |
| Payments | Razorpay-ready adapter + COD/manual toggles | Code should be Razorpay-ready, but live online payments activate only after approved keys are provided. COD/manual bank transfer are toggles if the client confirms them. |
| Delivery | Delivery, courier, and partner workflow | Store partner/courier name, phone, tracking reference, delivery notes, estimate, status, and assignment data. Live courier API integration should be implemented end to end when selected. |
| Email | Adapter-based transactional email using Resend, SendGrid, or SMTP | Build templates and logs for account, seller, product, order, B2B, and support emails. Provider depends on client account/domain readiness. |
| Reports | PostgreSQL aggregate reports | Build operational sales, seller, product, enquiry, finance, and admin reports from platform data. |
| Audit logs | PostgreSQL audit log table | Record seller approval, product approval, order updates, delivery updates, payment status updates, settings, CMS, and role changes. |
| Logging | Pino structured logs | Use JSON logs for API and worker services. |
| Error tracking | Sentry-ready | Add Sentry configuration if client provides account/project details; otherwise keep environment-ready integration points. |
| Testing | Vitest + Supertest + Playwright | Use unit tests, API tests, and browser flow tests for critical marketplace paths. |
| CI/CD | GitHub Actions | Run lint, typecheck, build, tests, Prisma checks, and deployment gates. |
| Deployment | Vercel or VPS web hosting + VPS API/worker | Production database target is the client's own PostgreSQL server on the VPS or private VPS network. Managed/Postgres test providers such as Neon are acceptable for development or staging only. Use environment variables for all secrets. |

## 3. Repository Structure

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

Do not half-scaffold native mobile apps. If a mobile app is selected, add the required app workspace and implement the complete app experience.

## 4. Active App Surfaces

The locked web app must support these separate areas:

- Public customer storefront.
- Customer account.
- Seller center for marketplace sellers, hyperlocal stores, and wholesale distributors.
- B2B buyer portal.
- Admin control panel.
- CMS and policy pages.

The UI must keep customer, seller, B2B, and admin experiences clearly separated.

## 5. Selectable Expansion Stack

These technologies are approved directions for selectable product expansion. If selected, they must be implemented as complete production features:

| Area | Technology Direction | Product Status |
|---|---|---|
| Native customer app | React Native + Expo | Selectable full implementation. |
| Seller mobile app | React Native + Expo | Selectable full implementation. |
| Delivery partner mobile app | React Native + Expo | Selectable full implementation. |
| Push notifications | Firebase Cloud Messaging or Expo Notifications | Selectable full implementation with mobile/app notification flows. |
| Advanced product search | Meilisearch, later OpenSearch if needed | Selectable full catalogue search implementation. |
| Live courier tracking | Shiprocket first, Delhivery adapter later | Selectable full logistics implementation. |
| Automated seller payouts | RazorpayX or Cashfree Payouts | Selectable full payout implementation after provider approval. |
| SMS alerts | MSG91, Twilio, or client-approved provider | Selectable provider-backed implementation. |
| WhatsApp automation | Meta WhatsApp Cloud API | Selectable provider-backed implementation after template/business approval. |
| Product analytics | PostHog | Selectable full analytics implementation. |
| Advanced B2B RFQ/PO workflow | Extended B2B modules | Selectable full B2B workflow implementation. |
| Realtime chat | NestJS WebSockets + Socket.IO; shared adapter only if selected | Selectable full realtime communication implementation. Do not add Redis for chat unless realtime chat and horizontal WebSocket scale are explicitly selected. |

## 6. Non-Negotiable Engineering Rules

- Use UUID primary keys.
- Store money in paise as integer fields where practical.
- Keep currency fields even if the current launch uses INR.
- Keep identity and business authorization separate.
- Use database-backed roles and permissions from the beginning.
- Add audit logs for sensitive admin, seller, order, product, delivery, payment, CMS, and role actions.
- Use provider adapters for payment, email, delivery, storage, and future notification services.
- Never store provider secrets in source code.
- Use Prisma migrations for database changes.
- Keep public image storage separate from private document storage.
- Treat all third-party fees, provider approvals, domains, hosting, email, SMS, WhatsApp, payment, courier, and storage charges as separate from the INR 200,000 development budget.

## 7. Product Build Order After Stack Lock

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

The locked 1HandIndia product stack is:

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
No Redis in the current VPS launch; PostgreSQL-backed indexing, direct/DB-audited notifications, Nginx/CDN limits, and application safeguards are the active operating mode
PostgreSQL indexed search
Portable asset-key public image storage with configurable ImageKit or S3-compatible delivery
S3-compatible private storage only if needed
Razorpay-ready payment adapter
Delivery/courier tracking and partner assignment workflow
Email adapter with templates and logs
Pino logs + audit logs + Sentry-ready hooks
Vitest + Supertest + Playwright
GitHub Actions
Vercel web deployment + managed API/worker hosting
```

This stack is now locked for current product development. New feature selections should follow the full implementation governance rule.
