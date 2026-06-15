# 1HandIndia Build Blueprint - MNC-Like Marketplace Portal

## 1. Build Goal

Build 1HandIndia as a production-grade multi-vendor marketplace portal with a professional customer storefront, seller center, B2B workflow, admin panel, mobile apps, logistics workflow, payout system, reporting, and trust controls.

The system should be designed for long-term growth, not as a one-page ecommerce demo.

Follow the locked stack in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md` and the active scope rule in `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`. From 08-06-2026 onward, selected features are implemented as complete production marketplace features, not as generic Phase 1 shortcuts.

## 2. Current Locked Stack Direction

### Web Application

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Server components where useful.
- Client components for interactive shopping, seller, and admin flows.

### Backend

- NestJS with TypeScript.
- Separate backend API service from the web app.
- REST APIs by default.
- OpenAPI/Swagger documentation.
- Zod validation for request bodies.
- Centralized error handling.

### Database

- PostgreSQL.
- Prisma ORM.
- Database migrations.
- Seed scripts for demo categories and admin user.

### Cache and Jobs

- Redis for caching, queues, rate limits, and background jobs.
- BullMQ for queue processing.
- Queue workers for transactional emails, notification retries, reports, rate limits, and future integration jobs.

### File and Image Storage

- Portable asset keys in the database, resolved through ImageKit, S3-compatible storage, or another managed object storage base URL.
- Separate folders for product images, vendor documents, banners, policy files, and support attachments.

### Mobile Apps

- React Native with Expo is the recommended mobile direction when native customer, seller, or delivery partner apps are selected.
- The API should remain mobile-ready, with stable auth, pagination, errors, and role-specific endpoints.

### Search

- PostgreSQL indexed search is the current product search implementation.
- Meilisearch can be added through a search service boundary when advanced faceting, typo tolerance, and high-scale product navigation are selected.

### Authentication

- Clerk for identity and sessions.
- PostgreSQL-backed RBAC/ABAC for 1HandIndia business permissions.

### Integrations

- Payment gateway: Razorpay-ready adapter with admin-managed credentials and verification flows.
- Courier: current delivery/courier tracking exists; Shiprocket/Delhivery or another courier provider should be implemented end to end when selected.
- Email: Resend, SendGrid, SMTP, or client-approved provider.
- SMS/OTP: selectable provider-backed feature.
- WhatsApp: selectable provider-backed feature.
- Push notifications: selectable mobile/app notification feature.

## 3. Recommended App Structure

Use this locked product monorepo structure:

```text
indihub/
  apps/
    web/
    api/
    worker/
  packages/
    database/
    auth/
    ui/
    config/
    validators/
    shared-types/
  docs/
```

Native mobile apps can be added as `apps/mobile-customer/`, `apps/mobile-seller/`, or `apps/mobile-delivery/` when selected for full implementation.

## 4. Main Web Areas

### Customer Storefront

- Homepage.
- Category page.
- Product listing page.
- Product detail page.
- Seller/store page.
- Cart.
- Checkout.
- Account.
- Wishlist.
- Orders.
- Tracking.
- Reviews.
- Support.

### Seller Center

- Seller onboarding.
- Seller KYC.
- Seller dashboard.
- Product management.
- Inventory management.
- Order management.
- B2B enquiry management.
- Promotion management.
- Subscription view.
- Payout view.
- Analytics.
- Support.

### B2B Portal

- Business registration.
- Company profile.
- RFQ request.
- Quotation comparison.
- PO upload.
- Approval workflow.
- Bulk order history.
- B2B invoices.

### Admin Panel

- Dashboard.
- Users.
- Sellers.
- B2B buyers.
- Products.
- Categories.
- Orders.
- Payments.
- Commissions.
- Payouts.
- Courier.
- RFQs and quotations.
- Promotions.
- Subscriptions.
- Support tickets.
- Reviews.
- Reports.
- CMS pages.
- Policies.
- Settings.
- Audit logs.
- Backups.

## 5. Core Backend Modules

The main backend should be a NestJS modular monolith. Keep module boundaries clear, but do not start with many microservices.

- Authentication.
- Authorization.
- User management.
- Customer profile.
- Seller profile.
- Seller KYC.
- Business buyer profile.
- Category management.
- Product catalogue.
- Product variants.
- Inventory.
- Search and filters.
- Cart.
- Checkout.
- Orders.
- Payments.
- Refunds.
- Commissions.
- Payouts.
- Courier shipments.
- Tracking events.
- RFQ.
- Quotations.
- Purchase orders.
- Chat.
- Support tickets.
- Reviews and ratings.
- Coupons and promotions.
- Seller subscriptions.
- Loyalty.
- Notifications.
- Analytics.
- Reports.
- CMS pages.
- Audit logs.
- Backups.
- Settings.

## 6. API Groups

- `/api/auth/*`
- `/api/customers/*`
- `/api/sellers/*`
- `/api/business-buyers/*`
- `/api/admin/*`
- `/api/categories/*`
- `/api/products/*`
- `/api/cart/*`
- `/api/checkout/*`
- `/api/orders/*`
- `/api/payments/*`
- `/api/refunds/*`
- `/api/commissions/*`
- `/api/payouts/*`
- `/api/shipments/*`
- `/api/rfq/*`
- `/api/quotations/*`
- `/api/po/*`
- `/api/chat/*`
- `/api/support/*`
- `/api/reviews/*`
- `/api/promotions/*`
- `/api/subscriptions/*`
- `/api/loyalty/*`
- `/api/notifications/*`
- `/api/reports/*`
- `/api/cms/*`
- `/api/audit-logs/*`
- `/api/settings/*`

## 7. Database Planning Notes

The database must support:

- Multiple roles per user.
- Multiple sellers.
- Multiple products per seller.
- Multiple product variants.
- Orders split by seller.
- Payment state and order state separately.
- Commission and payout records.
- B2B RFQ and quotation history.
- Courier shipment and tracking events.
- Audit logs for sensitive changes.
- Soft delete or status-based disabling for important records.

## 8. UI Quality Rules

- Make dashboards dense but clean.
- Avoid marketing-only homepage as the first build priority.
- Build real shopping, seller, and admin flows first.
- Use clear tables, filters, tabs, status badges, and action buttons.
- Mobile layouts must be tested early.
- Customer product pages must feel trustworthy.
- Admin and seller screens must support daily repeated work.

## 9. Security Rules

- No admin route should be accessible without admin permission.
- Sellers must only access their own products, orders, payouts, and enquiries.
- B2B buyers must only access their own company requests and orders.
- Payment webhook endpoints must verify signatures.
- Courier webhook endpoints must verify source or signature where supported.
- File uploads must validate size, type, and ownership.
- Audit logs must record sensitive actions.

## 10. Development Milestones

### Milestone 1 - Foundation

- Choose stack.
- Scaffold repo.
- Set up TypeScript.
- Set up database and Prisma.
- Add auth and roles.
- Add base UI layout.
- Add environment config.

### Milestone 2 - Core Marketplace

- Categories.
- Products.
- Seller profile.
- Product listing.
- Product detail.
- Cart.
- Checkout.
- Orders.

### Milestone 3 - Seller and Admin

- Seller dashboard.
- Product management.
- Order management.
- Admin dashboard.
- User and seller management.
- Product moderation.
- Reports.

### Milestone 4 - B2B

- Business buyer registration.
- Company profile.
- RFQ.
- Quotations.
- PO upload.
- B2B approval flow.

### Milestone 5 - Payments, Shipping, Payouts

- Payment gateway.
- Courier API.
- Tracking.
- Commissions.
- Automated payouts.
- GST invoice automation.

### Milestone 6 - Advanced Marketplace

- Chat.
- Support tickets.
- Reviews.
- Promotions.
- Seller subscriptions.
- Loyalty.
- Chatbot.
- Abandoned cart reminders.
- Analytics.

### Milestone 7 - Mobile Apps

- Customer Android/iOS app.
- Seller mobile app.
- Push notifications.
- App publishing preparation.

### Milestone 8 - Production Readiness

- Security review.
- Performance review.
- Backup plan.
- Monitoring plan.
- End-to-end QA.
- Deployment checklist.

## 11. Verification Gates

Before production handoff:

- Build passes.
- Type checks pass.
- Lint passes.
- Database migrations apply cleanly.
- Core customer order flow works.
- Seller order flow works.
- Admin moderation flow works.
- B2B RFQ flow works.
- Payment test flow works.
- Courier test flow works.
- Payout test flow works.
- Mobile app build works.
- Role access is verified.
- Audit logs are verified.
- Backup and restore plan is documented.
