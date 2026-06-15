# 1HandIndia Project Scope and Requirements

## 1. Purpose

This document explains the complete 1HandIndia marketplace scope in one place so development can start with clear business and product requirements.

1HandIndia is not a simple ecommerce site. It is a multi-vendor marketplace with customer shopping, marketplace seller onboarding, hyperlocal store onboarding, wholesale distributor support, B2B buying, mobile apps, admin operations, courier workflow, seller payout handling, analytics, and trust controls.

## 2. Product Vision

1HandIndia should become a professional marketplace portal where:

- Customers can buy products online.
- Hyperlocal stores can sell products online.
- Marketplace sellers and wholesale distributors can manage products, stock, orders, and payouts.
- Business buyers can request quotations and place bulk orders.
- Admin can control users, sellers, products, orders, payments, commissions, reports, policies, and platform operations.
- Mobile apps can support customers and sellers.
- The system can grow into a large ecommerce platform with MNC-level discipline.

## 3. Quality Target

The product should feel serious, polished, and scalable like a large ecommerce portal.

The target is not to copy Flipkart. The target is to build a professional marketplace with similar operational depth:

- Strong search and category browsing.
- Clean product and seller pages.
- Reliable ordering.
- Clear seller management.
- B2B quotation workflow.
- Admin-level control.
- Trust and safety.
- Scalable architecture.
- Auditability.
- Monitoring-ready design.

## 4. Confirmed User Roles

### Customer / B2C Buyer

- Browses products.
- Searches products.
- Adds products to cart.
- Places orders.
- Tracks orders.
- Saves wishlist items.
- Reviews products and sellers.
- Uses the responsive website. If a native customer mobile app is selected, it must be implemented as a complete customer app experience.

### Seller / Marketplace Seller / Hyperlocal Store / Wholesale Distributor

- Registers as a seller.
- Chooses an operational seller type: marketplace seller, hyperlocal store, or wholesale distributor.
- Keeps legal business entity type separate for GST, invoicing, KYC, taxation, and payouts.
- Creates store profile.
- Lists products.
- Manages stock and pricing.
- Processes received orders.
- Handles enquiries.
- Views sales summary.
- Uses seller dashboard. If a seller mobile app is selected, it must be implemented as a complete seller operations experience.
- Joins as a hyperlocal store when local radius delivery, store pickup, or nearby discovery applies.
- Adds store location and contact details.
- Sells through 1HandIndia.
- Can support nearby discovery.
- Can support store pickup or click-and-collect.

### Business Buyer / B2B Buyer

- Registers company details.
- Requests bulk pricing.
- Sends RFQ requests.
- Uploads PO documents.
- Compares quotations.
- Uses business purchase workflow.

### Admin Team

- Controls complete platform operations.
- Approves sellers.
- Manages users, categories, products, orders, payouts, reports, and policies.
- Monitors disputes, tickets, chat, reviews, and audit logs.

### Support / Operations Team

- Handles support tickets.
- Tracks courier issues.
- Assists buyers and sellers.
- Escalates disputes to admin.

## 5. Current Product Feature Groups

Historical Phase 1 documents are retained for approval and budget traceability.

The active implementation source of truth is `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`. When a feature is selected, build the complete production marketplace version across the required backend, UI, permissions, audit, settings, provider, and test surfaces.

### Marketplace Website

- Homepage.
- Categories.
- Product listings.
- Product detail pages.
- Seller/store pages.
- Search and filters.
- Cart and checkout.
- Order placement.
- Order history.
- Tracking through admin/seller status updates.

### B2C Shopping

- Customer registration and login.
- Product browsing.
- Wishlist.
- Cart.
- Checkout.
- Order tracking.
- Customer support.
- Support/contact request.

### Seller Center

- Seller registration and login.
- Store profile.
- Product management.
- Stock management.
- Order management.
- Sales summary.
- Sales summary.

### Hyperlocal Store Flow

- Hyperlocal store onboarding under the seller flow.
- Address, area, and city collection.
- Nearby discovery.
- Store pickup or click-and-collect.
- Store-level customer trust signals.

### B2B Workflow

- Business buyer registration.
- Company and GST details.
- Product-wise enquiry/request quotation workflow.
- Product-wise quotation request.
- Manual seller/admin response support.

### Admin Panel

- Admin dashboard.
- User management.
- Seller management.
- Business buyer management.
- Product moderation.
- Category management.
- Order management.
- Commission management.
- Manual commission management.
- Report management.
- Policy page management.
- Audit logs.

### Mobile Apps

- The website must be mobile-friendly and responsive.
- Native Android, iOS, and seller mobile apps are selectable product surfaces. If selected, they must be implemented as complete mobile app experiences with auth, navigation, role workflows, API integration, error states, and release readiness.

### Courier and Delivery

- Manual shipping status.
- Manual order and delivery status updates.
- Manual delivery partner/courier details on orders.
- Delivery mode selection is limited to store pickup, local delivery partner, and third-party courier service.
- Delivery partner web workspace for admin-assigned manual delivery tasks.
- Admin can assign active delivery partner users to orders.
- Delivery partners can update assigned delivery progress without changing payment state.
- Courier provider integrations can be added when selected and must include provider adapter setup, admin configuration, shipment booking/tracking flows, failure handling, and operational visibility.
- Store pickup or click-and-collect.

### Payment, Commission, and Payouts

- Payment gateway readiness.
- Online payment support after provider approval.
- Cash on delivery if approved.
- Manual bank transfer if approved.
- Commission rules.
- Order receipt.
- Tax/GST fields if required.

### Communication

- Transactional email notifications.
- Customer account created email.
- Seller registration and approval emails.
- Order placed, order status update, and order delivered emails.
- Seller/admin new order alert emails.
- B2B enquiry submitted and alert emails.
- Contact/support request received emails.
- Manual support communication.

### Analytics and Reports

- Sales report.
- Seller report.
- Product report.
- Enquiry report.

### Platform Safety

- Seller KYC.
- Product moderation.
- Role-based permissions.
- Audit logs.

### Selectable Full Implementation Feature Groups

The following areas are no longer labelled as generic future upgrades. If selected, each must be planned and implemented as a complete production feature:

- Native Android customer app.
- Native iOS customer app.
- Dedicated seller mobile app.
- Courier API and live tracking.
- Delivery partner mobile app.
- GPS/location tracking.
- Delivery OTP or proof-of-delivery upload.
- Automated seller payouts.
- Seller subscriptions and paid promotions.
- Advanced B2B RFQ, quotation comparison, PO upload, and approval workflows.
- Automated GST invoices and advanced tax reports.
- Buyer-seller realtime chat.
- Support ticket staff workflow.
- Chatbot.
- Abandoned cart reminders.
- Loyalty and reward system.
- Advanced analytics.
- Multi-language support.
- Multi-currency support.
- Advanced backup automation.

## 6. Non-Functional Requirements

### Security

- Use role-based access control.
- Separate customer, seller, B2B, support, and admin permissions.
- Validate all input.
- Protect payment and payout workflows.
- Log sensitive admin and seller actions.
- Avoid storing raw payment secrets.
- Store provider keys in environment variables.

### Performance

- Product listing pages must load quickly.
- Search and filters must be optimized.
- Images must be optimized and lazy-loaded.
- Database indexes must be planned for products, categories, orders, sellers, and search.
- Admin reports must be paginated and filterable.

### Reliability

- Orders must not be duplicated accidentally.
- Payment and payout state changes must be traceable.
- Courier updates must be logged.
- Failed notifications must be retryable.
- Backups must be planned before production.

### Scalability

- Keep marketplace modules separated.
- Design database entities for multi-vendor operations.
- Avoid hardcoding one seller or one category flow.
- Use queues for heavy jobs such as notifications, reports, payouts, and courier sync.

### User Experience

- Customer flow must be simple and fast.
- Seller dashboard must be operationally clear.
- Admin dashboard must support repeated daily work.
- Mobile-responsive website screens must match real user workflows.
- Avoid marketing-only pages as the primary experience.

### Compliance and Trust

- Provide privacy policy.
- Provide terms and conditions.
- Provide refund and return policy.
- Provide seller policy.
- Support GST invoice requirements if confirmed.
- Keep audit logs for sensitive operations.

## 7. Main Data Areas

- Users.
- Roles and permissions.
- Customers.
- Sellers.
- Seller KYC.
- Business buyers.
- Categories.
- Products.
- Product variants.
- Product images.
- Inventory.
- Carts.
- Wishlists.
- Orders.
- Order items.
- Payments.
- Refunds.
- Seller commissions.
- Seller payouts.
- RFQs.
- Quotations.
- Purchase orders.
- Courier shipments.
- Tracking events.
- Reviews and ratings.
- Support tickets.
- Chat messages.
- Notifications.
- Coupons.
- Promotions.
- Subscriptions.
- Loyalty points.
- Reports.
- Audit logs.
- CMS pages.
- Settings.

## 8. Third-Party Integrations

The project may require:

- Payment gateway.
- Courier provider.
- SMS provider.
- WhatsApp provider.
- Email provider.
- Push notification provider.
- Image storage provider.
- Map/location provider, if nearby discovery uses maps.
- App store developer accounts.
- Analytics/monitoring provider.

All third-party fees, approval delays, and provider limitations must be treated separately from development work.

## 9. Open Decisions Before Coding

- Confirm final technology stack details before major structure changes.
- Confirm the active full implementation scope for the selected feature.
- Confirm whether native Android, iOS, or seller apps are part of the selected implementation.
- Payment provider name.
- Courier provider name.
- Delivery partner user onboarding process for admin-assigned manual delivery tasks.
- Delivery status update owner: admin, seller, delivery partner, or a combination by business rule.
- SMS/WhatsApp/email provider names.
- Product categories for first launch.
- Number of initial sellers by operational type.
- Whether marketplace stock is seller-managed only.
- Whether COD is allowed.
- Whether store pickup is allowed at launch.
- Seller commission model.
- Seller subscription model.
- Return and refund rules.
- B2B quotation approval rules.
- GST invoice rules.
- Languages required for multi-language support, if selected.
- Currencies required for multi-currency support, if selected.
- Hosting provider.
- Final timeline for the selected full implementation scope.

## 10. Definition of Ready

Development should start only after:

- Final scope is approved.
- Budget and timeline are reconfirmed.
- Technology stack is selected.
- Client requirement checklist is filled.
- Initial product categories are available.
- Initial vendor data is available.
- Brand assets are available.
- Payment and shipping decisions are known.
- Development repository structure is approved.
