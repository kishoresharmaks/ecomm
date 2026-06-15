# 1HandIndia Technology Stack Decision

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Technology Decision Note  
**Current Authority:** `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`  
**Status:** Superseded by final stack lock, retained for workspace read-order continuity

## Decision Summary

The current product technology stack is locked in:

`docs/IndiHub_FINAL_TECH_STACK_LOCK.md`

This file exists so future sessions can follow the documented read order without a missing-file blocker. Do not treat this document as a separate or newer stack source. Active scope governance is now `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`.

## Locked Product Direction

- Monorepo: Turborepo with pnpm.
- Web app: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui-ready structure.
- Backend API: NestJS REST API with OpenAPI/Swagger.
- Database: PostgreSQL with Prisma ORM.
- Authentication: Clerk for identity, PostgreSQL-backed RBAC for platform permissions.
- Jobs and cache: Redis with BullMQ.
- Search: PostgreSQL indexed search as the current implementation.
- Media storage: portable asset keys in the database, with ImageKit or S3-compatible storage configurable for public product and marketplace images.
- Payments: Razorpay-ready adapter with provider activation only after client account approval.
- Delivery: Delivery/courier tracking and partner workflow, expandable to full provider integrations when selected.
- Notifications: Adapter-based transactional email with logs and retry support.
- Observability and controls: Structured logs, audit logs, provider readiness checks, and production environment documentation.

## Full Implementation Boundary

Native mobile apps, live courier API integration, automated seller payouts, realtime chat, advanced B2B RFQ/PO workflows, SMS/WhatsApp automation, multi-language, multi-currency, and advanced analytics are selectable feature groups. If selected, they must be implemented as complete production features.

## Implementation Rule

When decisions differ between older notes and the locked stack file, follow:

1. `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`
2. `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`
3. `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`
4. Current implemented code under `apps/`, `packages/`, and `prisma/`
