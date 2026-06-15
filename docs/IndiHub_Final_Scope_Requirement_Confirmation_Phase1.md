# 1HandIndia Multi-Vendor Ecommerce Marketplace

## Final Scope & Requirement Confirmation - Phase 1 Feature Freeze

**Document Type:** Final Scope and Feature Freeze Confirmation  
**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Client Name:** Vignesh  
**Prepared By:** Kishoresharma  
**Document Date:** 22-05-2026  
**Feature Freeze Date:** 23-05-2026  
**Approved Budget:** INR 200,000  
**Brand Name:** 1HandIndia  
**Logo Status:** To be designed later  
**Brand Colors:** See `docs/IndiHub_BRAND_DIRECTION.md`  
**Technology Stack:** Locked in `docs/IndiHub_FINAL_TECH_STACK_LOCK.md`  
**Document Status:** Historical Phase 1 approval and budget record. Scope update on 26-05-2026 added a manual delivery partner web workspace and admin assignment workflow. Scope update on 08-06-2026 added admin-controlled product ratings and reviews for verified delivered/paid purchases. Active development governance moved on 08-06-2026 to `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`.

## 1. Document Purpose

This document records the original Phase 1 feature scope for the 1HandIndia ecommerce marketplace.

The features listed under the original included scope remain useful for budget and approval traceability.

As of 08-06-2026, this document no longer limits implementation completeness for selected features. Active work follows `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`: when a feature is selected, build the full production-ready feature across the required backend, UI, permissions, audit, settings, provider, and test surfaces.

## 1A. Active Full Implementation Amendment

From 08-06-2026 onward, do not use generic Phase 1, basic-only, future-scope, or later-upgrade language to reduce the completeness of an approved feature.

Historical exclusions in this document are retained for context only. If the user selects one of those areas for development, treat it as a full implementation item rather than a partial add-on.

## 2. Original Build Direction

The original approved build was a **web-first multi-vendor ecommerce marketplace**.

The first build will focus on:

- Customer shopping website.
- Seller onboarding for marketplace sellers, hyperlocal stores, and wholesale distributors.
- Hyperlocal store selling support.
- Product catalogue management.
- Cart, checkout, and order management.
- B2B enquiry and quotation request flow.
- Admin control panel.
- Payment gateway readiness.
- Manual delivery and order tracking workflow.
- Manual delivery partner/courier detail tracking.
- Delivery partner web workspace for admin-assigned manual delivery tasks.
- Transactional email notifications.
- Reports, CMS pages, and audit records.

Native Android app, native iOS app, seller mobile app, automated payouts, courier API live tracking, chatbot, advanced analytics, and other heavy automation features are no longer dismissed as generic future upgrades. If any of them is selected for development, it must be scoped and implemented as a complete production feature.

For the 08-06-2026 ratings and reviews scope update, the active rule is the same: if review dispute handling, seller replies, review photos, abuse automation, or mobile review flows are selected, implement them completely.

## 3. Original Included Scope

The following features were locked for the original approved scope.

### 3.1 Customer Storefront

- Responsive ecommerce website.
- Homepage.
- Category browsing.
- Product listing page.
- Product search.
- Marketplace filters by category, price, and seller/store where applicable.
- Product detail page.
- Product image display.
- Product description display.
- Product price display.
- Product stock status display.
- Seller/store details on product pages.
- Seller/store profile page.
- Product ratings and reviews, limited to verified delivered and paid customer purchases, with admin approval before public display.
- Wishlist or saved products.
- Cart management.
- Checkout flow.
- Order placement.
- Customer order history.
- Order tracking using admin/seller-updated order status.
- Mobile-friendly website layout.

### 3.2 Customer Account

- Customer registration.
- Customer login.
- Customer profile fields.
- Customer address details.
- Customer order history.
- Customer support/contact request option.

### 3.3 Seller Operational Types

- Seller registration.
- Seller operational type selection: marketplace seller, hyperlocal store, or wholesale distributor.
- Business entity type remains separate for KYC, GST, invoicing, taxation, and payouts.
- Seller login.
- Seller profile creation.
- Store name setup.
- Store logo upload placeholder or later upload support.
- Store banner upload placeholder or later upload support.
- Store address, area, and city details.
- Store contact details.
- Business information collection.
- Seller subscription plan selection during onboarding.
- Default seller subscription plan assignment if the seller does not choose a specific plan.
- Approved scope update on 31-05-2026: paid monthly/yearly seller subscription plans use Razorpay recurring payment authorisation after admin approval.
- Failed seller subscription renewals get a 7-day grace period before new product and seller B2B growth actions are restricted.
- Admin approval before selling.
- Seller dashboard.
- Add product.
- Edit product.
- Remove or disable product.
- Upload product images.
- Manage product price.
- Manage product stock.
- Manage product description.
- View received orders.
- Update order status.
- View sales summary.
- View B2B enquiries related to seller products where applicable.
- Seller/store profile page.

### 3.4 Product and Catalogue Management

- Category management.
- Subcategory support where needed.
- Product management.
- Product image management.
- Product price management.
- Product stock management.
- Product status management.
- Product approval or moderation by admin.
- Product search-ready data structure.

### 3.5 Cart, Checkout, and Orders

- Add to cart.
- Update cart quantity.
- Remove item from cart.
- Checkout form.
- Delivery address selection or entry.
- Shipping charge rule if client confirms it before development.
- Order placement.
- Order number generation.
- Order item details.
- Order status tracking.
- Seller order view.
- Admin order view.
- Cancellation handling if finalized before development.

### 3.6 B2B Enquiry Flow

- Business buyer registration.
- Business buyer login.
- Company details collection.
- GST or business details collection if required by client.
- Bulk order enquiry option.
- Product-wise quotation request option.
- Admin can view B2B enquiries.
- Seller can view B2B enquiries for their products.
- Manual seller/admin response support.
- Enquiry status tracking.

### 3.7 Admin Panel

- Admin login.
- Admin dashboard.
- Website summary.
- Customer management.
- Seller management.
- Business buyer management.
- Seller approval.
- Seller rejection.
- Seller suspension.
- Seller subscription plan management.
- Default seller subscription plan selection for onboarding.
- Category management.
- Product management.
- Product approval or rejection.
- Banner management.
- Homepage content management.
- Policy page management.
- Order management.
- Order status management.
- Sales report.
- Seller report.
- Product report.
- Enquiry report.
- Manual commission setup.
- Support enquiry management.
- Audit log records for sensitive admin actions.

### 3.8 Content and Policy Pages

- Homepage content sections.
- Contact page.
- About page, if content is provided.
- Privacy policy page.
- Terms and conditions page.
- Refund or return policy page.
- Shipping policy page, if content is provided.
- Seller policy page, if content is provided.
- Support information.

### 3.9 Payment and Billing Readiness

- Payment gateway readiness in the code structure.
- Razorpay-ready payment flow can be prepared if client provides approved test/live account keys.
- Online payment activation only after payment provider approval.
- Cash on delivery can be enabled only if the client confirms it before development.
- Manual bank transfer can be enabled only if the client confirms it before development.
- Finance workspace was added as a scope update: Admin and Finance Manager users can verify COD and bank transfer collections, mark eligible offline payments paid/rejected, review seller settlements/payouts/ledger/statements, and manage payment settings.
- Bank transfer settings include platform bank/UPI destination, instructions, and customer UTR/reference capture. Automated bank reconciliation is a selectable full implementation area.
- Approved scope update on 31-05-2026: Razorpay recurring billing is included for paid seller subscription plans. Production use still depends on Razorpay account approval, valid keys, webhook setup, and provider subscription support.
- Order receipt.
- Tax/GST fields where required for product/order records.
- Payment gateway transaction charges are not included in development cost.
- Payment provider setup charges are not included in development cost.

### 3.10 Delivery and Shipping

- Manual delivery status management.
- Admin/seller order status updates.
- Delivery mode selection is limited to store pickup, local delivery partner, and third-party courier service.
- Manual delivery partner or courier name entry.
- Manual delivery partner contact number entry, if applicable.
- Manual tracking ID, docket number, or reference number entry, if applicable.
- Estimated delivery date entry, if applicable.
- Delivery note entry for admin/seller reference.
- Customer-facing delivery status display from manual updates.
- Shipping charge rules if finalized before development.
- Store pickup or click-and-collect option if client confirms it before development.
- Courier provider details can be stored for provider integration.
- Admin can assign an active user with the Delivery Partner role to an order.
- Delivery partners can log in to the web workspace to view only assigned orders.
- Delivery partners can view order items, customer delivery address, payment visibility, and delivery timeline.
- Delivery partners can update manual delivery progress, tracking reference, estimated date, and delivery note.
- Delivery partner updates roll into order/delivery/seller timelines and preserve payment status.
- Delivery partners can record COD cash collected with amount and note for assigned COD orders.
- Admin can verify or reject delivery partner COD collection from the admin order detail screen.
- COD payments remain pending after delivery until admin verifies collected cash and marks payment paid.

Delivery partner web support is implemented. Delivery mobile app, GPS tracking, courier API tracking, delivery OTP verification, proof-of-delivery upload, and delivery partner payout settlement are selectable full implementation areas when chosen.

### 3.11 Roles, Access, and Audit

- Separate customer, seller, business buyer, and admin access.
- Separate finance workspace access for Finance Manager users.
- Role-based access control foundation.
- Sellers can access only their own products and orders.
- Business buyers can access only their own enquiries and orders.
- Admin can manage platform data.
- Finance Manager can access finance/payment APIs and cannot access full admin management surfaces.
- Audit log records for seller approval, seller subscription changes, product approval, order status changes, commission changes, and policy updates.

### 3.12 Transactional Email Notifications

The application includes transactional email notifications.

Email provider charges, domain email setup charges, SMTP charges, and third-party email service charges are separate from the development budget.

Application email types:

- Customer account created email.
- Customer login/security notification if supported by the selected auth provider.
- Password reset email if supported by the selected auth provider.
- Seller account registration received email.
- Seller operational type registration received email for marketplace sellers, hyperlocal stores, and wholesale distributors.
- Seller approval email.
- Seller rejection email.
- Product submitted for approval email to admin.
- Product approved email to seller.
- Product rejected email to seller.
- Order placed email to customer.
- New order received email to seller.
- New order alert email to admin.
- Payment pending email, if online payment is enabled.
- Payment success email, if online payment is enabled.
- Payment failed email, if online payment is enabled.
- Order confirmed email.
- Order packed/processing email.
- Order shipped/dispatched email using manual status update.
- Order delivered email.
- Order cancelled email, if cancellation is enabled.
- Refund/update email, if refund handling is enabled.
- B2B enquiry submitted email to business buyer.
- B2B enquiry alert email to admin.
- B2B enquiry alert email to seller where applicable.
- Manual B2B enquiry response email.
- Contact/support request received email.
- Contact/support request alert email to admin.

Email templates use the 1HandIndia name and approved brand colors. Advanced marketing campaigns, abandoned cart automation, newsletter systems, segmentation, and bulk promotional emails are selectable full implementation areas when chosen.

## 4. Historical Exclusions Now Treated As Selectable Full Implementations

The following features were not included in the original INR 200,000 frozen build.

As of 08-06-2026, if the user selects any of these, implement it as a complete production feature under `docs/IndiHub_FULL_IMPLEMENTATION_SCOPE_GOVERNANCE.md`.

- Native Android customer app.
- Native iOS customer app.
- Dedicated seller mobile app.
- Play Store publishing.
- App Store publishing.
- Advanced buyer-seller real-time chat.
- Courier API integration.
- Live delivery tracking through courier API.
- Delivery partner mobile app.
- GPS/location tracking.
- Delivery OTP verification.
- Proof-of-delivery photo/signature upload.
- Delivery partner payout or settlement workflow.
- Automated seller payouts.
- Seller payout provider integration.
- Advanced seller billing beyond Razorpay recurring subscriptions, such as custom invoicing, multi-provider recurring billing, or offline reconciliation automation.
- Paid seller promotions.
- Advanced B2B RFQ workflow.
- Quotation comparison engine.
- PO upload workflow.
- B2B approval workflow.
- Special business pricing rules engine.
- Automated GST invoice generation.
- Advanced tax reports.
- Chatbot.
- Abandoned cart reminders.
- Loyalty and reward system.
- Advanced analytics dashboard.
- Support ticket system with staff workflow.
- Multi-language support.
- Multi-currency support.
- Advanced data backup automation.
- Advanced email marketing automation.
- Newsletter system.
- Bulk promotional email campaigns.
- SMS automation.
- WhatsApp automation.
- Push notifications.
- Advanced review and dispute workflow.
- Advanced fraud, trust, and safety automation.

## 5. Original Confirmed User Types

The original approved build supported the following user types:

- Customer / B2C Buyer.
- Seller, including marketplace seller, hyperlocal store, and wholesale distributor operational types.
- Business Buyer / B2B Buyer for enquiry flow.
- Delivery Partner for admin-assigned manual delivery tasks.
- Admin Team.

Delivery Partner / Courier Partner is a web workspace role for assigned delivery tasks. Dedicated support staff logins and delivery mobile apps are selectable full implementation areas.

## 6. Third-Party Services and Client Responsibilities

The following are separate from the development budget:

- Domain purchase or renewal.
- Hosting or server charges.
- Database hosting charges.
- Storage charges.
- Payment gateway transaction charges.
- Payment provider setup cost.
- SMS service charges.
- WhatsApp service charges.
- Email service charges.
- OTP service charges.
- Courier API service charges.
- Logistics partner charges.
- Google Play developer account charges.
- Apple App Store developer account charges.
- Payment gateway merchant account approval delays.
- Courier partner account approval delays.
- App Store or Play Store approval delays.
- Third-party API subscription fees.

## 7. Required Details From Client Before Development

The client must provide or confirm the following before development starts:

- Business name.
- Legal business name, if available.
- Business owner name.
- Contact number.
- Email address.
- Official sender email address.
- Email provider or SMTP details.
- Required email notification wording, if the client wants custom text.
- Business address.
- GST number, if available.
- Final logo, or approval to use a temporary text logo.
- Product categories.
- Sample product list.
- Product images.
- Product prices.
- Product stock details.
- Initial seller details and operational type.
- Seller approval rules.
- Commission rules.
- Payment method decision.
- Razorpay account details, if online payment is required.
- Razorpay subscription/recurring billing support enabled on the merchant account if paid seller plans are used.
- Cash on delivery decision.
- Manual bank transfer decision.
- Shipping charge rules.
- Delivery mode rules.
- Delivery partner/courier names and contact details, if manual delivery partners are used.
- Who will update delivery status: admin, seller, or both.
- Store pickup decision.
- Return and refund policy.
- Seller terms.
- Privacy policy content, if available.
- Terms and conditions content, if available.
- Social media links, if required.
- Homepage banner content, if available.

## 8. Historical Estimated Timeline

The original estimated timeline was **8 to 12 weeks** after:

- Advance payment is received.
- Required client details are provided.
- UI direction is approved.
- Product/category sample data is available.
- Payment/shipping decisions are confirmed.

### Suggested Milestone Plan

| Milestone | Work |
|---|---|
| Milestone 1 | Requirement freeze, UI direction, project setup |
| Milestone 2 | Auth, roles, database, base layouts |
| Milestone 3 | Customer storefront, products, categories |
| Milestone 4 | Seller dashboard and product management |
| Milestone 5 | Cart, checkout, order flow |
| Milestone 6 | Admin panel, reports, CMS, policies |
| Milestone 7 | B2B enquiry flow, payment readiness, shipping rules |
| Milestone 8 | Testing, corrections, deployment preparation |

Timeline can change if client content, product data, provider approvals, or feedback are delayed.

## 9. Payment Terms

Total historical approved budget: **INR 200,000**

- 40% advance payment to start the project: **INR 80,000**
- 30% after UI design and first working demo approval: **INR 60,000**
- 30% before final deployment and handover: **INR 60,000**

## 10. Historical Change Request Rule

The original feature freeze treated new work as a change request.

As of 08-06-2026, active development uses the full implementation governance rule. User-approved feature requests are no longer reduced by the historical Phase 1 boundary.

Change requests may affect:

- Project cost.
- Project timeline.
- Development priority.
- Testing scope.
- Final delivery date.

No extra feature will be added without client discussion and approval.

## 11. Current Acceptance Rule

Selected product work is ready for final review when:

- The selected customer storefront flow is working.
- Seller onboarding and product management are working.
- Admin can manage sellers, products, orders, content, and reports.
- B2B enquiry flow is working.
- Cart, checkout, and order placement are working.
- Payment readiness is completed based on available provider details.
- Delivery/order status workflow is working.
- Manual delivery partner/courier details can be stored and shown on orders where applicable.
- Admin can assign delivery partners to orders and delivery partners can update assigned delivery progress without changing payment status.
- Transactional email notifications are configured for the selected events.
- Policy and content pages are available.
- Role access rules are checked.
- Audit log records are available.
- Final corrections from the agreed review cycle are completed.

## 12. Client Confirmation

By approving this document, the client confirms:

- The brand name is 1HandIndia.
- The historical approved budget is INR 200,000.
- The original approved build was web-first.
- The features listed in Section 3 were included in the original frozen scope.
- The features listed in Section 4 are now selectable full implementation areas when chosen.
- Seller operational types are marketplace seller, hyperlocal store, and wholesale distributor; legal business entity type remains separate.
- Delivery Partner / Courier Partner is handled through a web workspace for assigned orders, while live courier API/mobile tracking can be selected for full implementation.
- Transactional email notifications are included, but third-party email service charges are separate.
- Additional selected features follow the active full implementation governance rule.
- Third-party fees, provider approvals, hosting, domain, and account charges are separate from development cost.

## 13. Approval Sign-Off

**Client Name:** Vignesh  
**Approved Budget:** INR 200,000  
**Client Signature:** ______________________________  
**Date:** ______________________________  

**Prepared By:** Kishoresharma  
**Prepared By Signature:** ______________________________  
**Date:** 23-05-2026
