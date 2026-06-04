# 1HandIndia UI Screen List and Database Plan

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Document Type:** Phase 1 UI and Database Planning  
**Prepared By:** Kishoresharma  
**Prepared Date:** 23-05-2026  
**Scope Source:** `docs/IndiHub_Final_Scope_Requirement_Confirmation_Phase1.md`  
**Phase 1 Budget:** INR 200,000  
**Build Direction:** Web-first marketplace  

## 1. Purpose

This document prepares the Phase 1 UI screen list and database plan before development starts.

It follows the frozen Phase 1 scope:

- Customer storefront.
- Customer account.
- Seller dashboard for marketplace sellers, hyperlocal stores, and wholesale distributors.
- Basic B2B enquiry flow.
- Admin control panel.
- Cart, checkout, and order flow.
- Manual delivery/courier tracking.
- Delivery partner web workspace for assigned manual delivery tasks.
- Payment readiness.
- Transactional email notifications.
- Basic reports, CMS pages, and audit logs.

Native mobile apps, delivery partner mobile app, live courier API, GPS/OTP/proof-of-delivery automation, automated payouts, chatbot, advanced analytics, advanced B2B workflows, SMS/WhatsApp automation, and multi-language/multi-currency are future upgrades.

## 2. UI Area Map

| Area | User Type | Phase 1 Purpose |
|---|---|---|
| Public storefront | Guest and customer | Browse products, stores, categories, and policies. |
| Customer account | Customer / B2C buyer | Manage profile, addresses, wishlist, orders, and support/contact requests. |
| Seller center | Marketplace Seller / Hyperlocal Store / Wholesale Distributor | Manage store profile, products, stock, orders, and B2B enquiries. |
| B2B buyer portal | Business buyer | Register company, submit product enquiries, and view enquiry status. |
| Delivery partner workspace | Delivery partner | View assigned delivery orders and update manual delivery progress. |
| Admin panel | Admin team | Manage users, sellers, products, orders, content, reports, settings, and audit records. |

## 3. Public Storefront Screens

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | Homepage | `/` | Must | Main shopping entry with banners, categories, featured products, and seller highlights. |
| 2 | Category Listing | `/categories` | Must | Show all active categories. |
| 3 | Category Detail / Product List | `/categories/[slug]` | Must | Show products under selected category with basic filters. |
| 4 | Product Search Results | `/search` | Must | Search products by keyword with filters and sorting. |
| 5 | Product Detail | `/products/[slug]` | Must | Product images, price, stock, seller info, add to cart, wishlist, B2B enquiry. |
| 6 | Seller / Store Profile | `/stores/[slug]` | Must | Public seller/local shop page with products and store details. |
| 7 | Cart | `/cart` | Must | Review cart items, update quantity, remove items. |
| 8 | Checkout | `/checkout` | Must | Address, delivery mode, payment method, order review. |
| 9 | Order Success | `/checkout/success/[orderNumber]` | Must | Confirm order placement and show next steps. |
| 10 | Track Order Public Entry | `/track-order` | Should | Optional lookup by order number and contact value. |
| 11 | About Page | `/about` | Should | Business intro if client provides content. |
| 12 | Contact Page | `/contact` | Must | Customer enquiry/contact form and support info. |
| 13 | Privacy Policy | `/privacy-policy` | Must | CMS-managed policy page. |
| 14 | Terms and Conditions | `/terms-and-conditions` | Must | CMS-managed policy page. |
| 15 | Refund / Return Policy | `/refund-return-policy` | Must | CMS-managed policy page. |
| 16 | Shipping Policy | `/shipping-policy` | Should | Shipping rules if content is provided. |
| 17 | Seller Policy | `/seller-policy` | Should | Seller rules if content is provided. |

## 4. Customer Account Screens

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | Customer Sign In | `/sign-in` | Must | Customer login through selected auth provider. |
| 2 | Customer Sign Up | `/sign-up` | Must | Customer registration. |
| 3 | Account Dashboard | `/account` | Must | Summary of orders, addresses, wishlist, and profile. |
| 4 | Profile | `/account/profile` | Must | Customer name, phone, email, and basic profile data. |
| 5 | Address Book | `/account/addresses` | Must | Add, edit, delete delivery addresses. |
| 6 | Wishlist | `/account/wishlist` | Must | Saved products. |
| 7 | Order History | `/account/orders` | Must | Customer orders with payment and delivery status. |
| 8 | Order Detail | `/account/orders/[orderNumber]` | Must | Order items, seller split, delivery details, status timeline. |
| 9 | Support / Contact Requests | `/account/support` | Should | Customer submitted contact/support requests. |

## 5. Seller Operational Screens

Marketplace sellers, hyperlocal stores, and wholesale distributors use the same seller center in Phase 1, while the operational type remains available for delivery, commission, SLA, and discovery rules.

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | Seller Sign In | `/seller/sign-in` | Must | Seller login. |
| 2 | Seller Registration | `/seller/register` | Must | Seller registration with operational type and separate legal business entity type. |
| 3 | Seller Pending Approval | `/seller/pending-approval` | Must | Message shown until admin approves seller. |
| 4 | Seller Dashboard | `/seller` | Must | Sales summary, product count, order count, enquiry count. |
| 5 | Store Profile | `/seller/store-profile` | Must | Store name, logo, banner, address, city, area, contact, business details. |
| 6 | Product List | `/seller/products` | Must | Seller product table with status and stock. |
| 7 | Add Product | `/seller/products/new` | Must | Create product with images, category, price, stock, description. |
| 8 | Edit Product | `/seller/products/[id]/edit` | Must | Update seller-owned product. |
| 9 | Seller Orders | `/seller/orders` | Must | Orders containing seller's products. |
| 10 | Seller Order Detail | `/seller/orders/[orderNumber]` | Must | Seller items, customer delivery info, status updates allowed by rules. |
| 11 | Delivery Update | `/seller/orders/[orderNumber]/delivery` | Must | Manual delivery partner/courier details and delivery status update. |
| 12 | B2B Enquiries | `/seller/b2b-enquiries` | Must | Product-wise B2B enquiries visible to seller. |
| 13 | B2B Enquiry Detail | `/seller/b2b-enquiries/[id]` | Must | View enquiry and send manual response. |
| 14 | Sales Summary | `/seller/reports/sales` | Should | Basic sales summary for seller. |
| 15 | Seller Subscription | `/seller/subscription` | Must | Current seller plan, status, limits, and admin-managed subscription note. |

## 6. Delivery Partner Screens

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | Delivery Dashboard | `/delivery` | Must | Assigned order summary, active delivery count, delivered count, and COD pending visibility. |
| 2 | Assigned Orders | `/delivery/orders` | Must | Search and filter orders assigned by admin to the logged-in delivery partner. |
| 3 | Delivery Order Detail | `/delivery/orders/[orderNumber]` | Must | View items, address, payment visibility, timeline, and update delivery progress. |

## 7. B2B Buyer Screens

Phase 1 supports basic enquiry and request quotation flow only.

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | B2B Registration | `/b2b/register` | Must | Business buyer registration and company details. |
| 2 | B2B Sign In | `/b2b/sign-in` | Must | Business buyer login. |
| 3 | B2B Dashboard | `/b2b` | Must | Enquiry summary and profile status. |
| 4 | Company Profile | `/b2b/company-profile` | Must | Company name, GST, contact, address. |
| 5 | Submit Product Enquiry | `/b2b/enquiries/new` | Must | Create bulk/product enquiry. |
| 6 | My Enquiries | `/b2b/enquiries` | Must | List submitted enquiries and statuses. |
| 7 | Enquiry Detail | `/b2b/enquiries/[id]` | Must | View enquiry, seller/admin response, and status. |

## 8. Admin Panel Screens

| # | Screen | Suggested Route | Priority | Purpose |
|---|---|---|---|---|
| 1 | Admin Sign In | `/admin/sign-in` | Must | Admin login. |
| 2 | Admin Dashboard | `/admin` | Must | Orders, sellers, products, enquiries, sales summary. |
| 3 | Customers | `/admin/customers` | Must | View and manage customer records. |
| 4 | Customer Detail | `/admin/customers/[id]` | Should | Profile, addresses, order history. |
| 5 | Sellers | `/admin/sellers` | Must | Seller list, approval status, suspension status. |
| 6 | Seller Detail | `/admin/sellers/[id]` | Must | Store profile, documents, products, orders, actions. |
| 7 | Seller Approval Queue | `/admin/sellers/approvals` | Must | Approve/reject pending seller registrations. |
| 8 | Business Buyers | `/admin/business-buyers` | Must | B2B buyer list and company details. |
| 9 | Categories | `/admin/categories` | Must | Add/edit/deactivate categories and subcategories. |
| 10 | Products | `/admin/products` | Must | Product list, filters, approval status. |
| 11 | Product Approval Queue | `/admin/products/approvals` | Must | Approve/reject seller-submitted products. |
| 12 | Orders | `/admin/orders` | Must | All orders with statuses, payment, delivery mode. |
| 13 | Order Detail | `/admin/orders/[orderNumber]` | Must | Order items, seller split, customer, payment, delivery, audit. |
| 14 | Manual Delivery Update | `/admin/orders/[orderNumber]/delivery` | Must | Manual delivery partner/courier details and status update. |
| 15 | B2B Enquiries | `/admin/b2b-enquiries` | Must | View all B2B enquiries. |
| 16 | B2B Enquiry Detail | `/admin/b2b-enquiries/[id]` | Must | View enquiry, seller mapping, manual response, status. |
| 17 | Banners | `/admin/cms/banners` | Must | Manage homepage banners. |
| 18 | Homepage Content | `/admin/cms/homepage` | Must | Manage sections, featured categories/products. |
| 19 | CMS Pages | `/admin/cms/pages` | Must | Manage About, Contact, policies. |
| 20 | Support / Contact Requests | `/admin/support-requests` | Must | View and respond to contact/support requests. |
| 21 | Reports Overview | `/admin/reports` | Must | Basic sales, seller, product, and enquiry reports. |
| 22 | Sales Report | `/admin/reports/sales` | Must | Date-wise sales summary. |
| 23 | Seller Report | `/admin/reports/sellers` | Must | Seller-wise product/order summary. |
| 24 | Product Report | `/admin/reports/products` | Must | Product-wise stock and sales summary. |
| 25 | Enquiry Report | `/admin/reports/enquiries` | Must | B2B/contact enquiry summary. |
| 26 | Commission Settings | `/admin/settings/commissions` | Must | Manual commission or percentage setup. |
| 27 | Shipping Settings | `/admin/settings/shipping` | Must | Basic shipping charge rules and delivery modes. |
| 28 | Payment Settings | `/admin/settings/payments` | Should | Payment readiness settings and provider status. |
| 29 | Email Settings | `/admin/settings/email` | Must | Sender name, sender email, provider status, template toggles. |
| 30 | Admin Users / Roles | `/admin/settings/users` | Must | Basic admin users and role assignment. |
| 31 | Seller Subscriptions | `/admin/seller-subscriptions` | Must | Create seller plans, choose default onboarding plan, and assign plans to sellers. |
| 32 | Audit Logs | `/admin/audit-logs` | Must | Sensitive action history. |
| 33 | General Settings | `/admin/settings/general` | Must | Brand, contact, support, and business settings. |

## 9. Shared UI Components Needed

| Component | Used In |
|---|---|
| Site header | Storefront, account pages |
| Search bar | Storefront, category, product listing |
| Category navigation | Storefront |
| Product card | Storefront, seller/store profile, wishlist |
| Product gallery | Product detail |
| Cart drawer or cart summary | Storefront, checkout |
| Status badge | Orders, products, sellers, enquiries |
| Data table | Seller dashboard, admin panel |
| Filter panel | Product listing, admin tables |
| Pagination | Listing pages and admin tables |
| Form field set | Auth, checkout, seller, B2B, admin |
| Image upload field | Seller products, seller profile, banners |
| Empty state | Dashboards, lists |
| Confirmation dialog | Delete, disable, approve, reject |
| Toast / alert | Form and action feedback |
| Timeline component | Order status and audit history |
| Basic chart cards | Admin reports and seller sales summary |

## 10. Database Design Principles

Use PostgreSQL with Prisma ORM.

Core rules:

- Use UUID primary keys.
- Store money in paise as integer fields where practical.
- Store currency code even if Phase 1 uses only INR.
- Use explicit status fields instead of deleting important business records.
- Use soft delete fields for sellers, products, categories, and CMS pages.
- Keep payment status, order status, delivery status, and seller status separate.
- Add audit logs for sensitive changes.
- Keep Clerk identity separate from 1HandIndia authorization.
- Keep future-ready fields without building future UI where useful.

## 11. Core Database Tables

### 11.1 Identity and Roles

| Table | Purpose | Important Fields |
|---|---|---|
| `users` | Main platform user mapped to auth provider | `id`, `clerk_user_id`, `email`, `phone`, `full_name`, `status`, `created_at`, `updated_at` |
| `roles` | Role definitions | `id`, `code`, `name`, `description` |
| `permissions` | Permission definitions | `id`, `code`, `name`, `module` |
| `user_roles` | User-role mapping | `id`, `user_id`, `role_id` |
| `role_permissions` | Role-permission mapping | `id`, `role_id`, `permission_id` |

Initial roles:

- `customer`
- `seller`
- `business_buyer`
- `admin`

Future roles:

- `support_staff`
- `delivery_partner`
- `finance`

### 11.2 Customer

| Table | Purpose | Important Fields |
|---|---|---|
| `customers` | Customer profile | `id`, `user_id`, `display_name`, `status` |
| `customer_addresses` | Delivery addresses | `id`, `customer_id`, `label`, `full_name`, `phone`, `line1`, `line2`, `city`, `state`, `pincode`, `country`, `is_default` |
| `wishlists` | Saved product container | `id`, `customer_id` |
| `wishlist_items` | Saved products | `id`, `wishlist_id`, `product_id`, `created_at` |

### 11.3 Seller Operational Model

| Table | Purpose | Important Fields |
|---|---|---|
| `sellers` | Seller operational profile | `id`, `user_id`, `seller_type`, `store_name`, `slug`, `status`, `approval_status`, `commission_type`, `commission_value` |
| `seller_profiles` | Store presentation and contact details | `id`, `seller_id`, `logo_url`, `banner_url`, `description`, `contact_name`, `contact_phone`, `contact_email` |
| `seller_addresses` | Store address and area | `id`, `seller_id`, `line1`, `line2`, `area`, `city`, `state`, `pincode`, `latitude`, `longitude` |
| `seller_documents` | Basic seller KYC files if collected | `id`, `seller_id`, `document_type`, `file_url`, `status` |
| `seller_subscription_plans` | Admin-managed seller plan master | `id`, `code`, `name`, `price_paise`, `billing_cycle`, `is_default`, `is_active`, `product_limit` |
| `seller_subscriptions` | Seller plan assignment history | `id`, `seller_id`, `plan_id`, `status`, `is_current`, `started_at`, `current_period_end`, `created_by` |

Seller type enum:

- `MARKETPLACE_SELLER`
- `HYPERLOCAL_STORE`
- `WHOLESALE_DISTRIBUTOR`

Seller business entity type remains separate:

- `INDIVIDUAL`
- `PROPRIETORSHIP`
- `PARTNERSHIP`
- `LLP`
- `PRIVATE_LIMITED`
- `PUBLIC_LIMITED`
- `OTHER`

Seller status enum:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

### 11.4 Business Buyers

| Table | Purpose | Important Fields |
|---|---|---|
| `business_buyers` | Business buyer profile | `id`, `user_id`, `company_name`, `gst_number`, `contact_name`, `contact_phone`, `status` |
| `business_buyer_addresses` | Business addresses | `id`, `business_buyer_id`, `line1`, `line2`, `city`, `state`, `pincode`, `country` |

### 11.5 Catalogue

| Table | Purpose | Important Fields |
|---|---|---|
| `categories` | Product categories and subcategories | `id`, `parent_id`, `name`, `slug`, `description`, `image_url`, `status`, `sort_order` |
| `products` | Product master | `id`, `seller_id`, `category_id`, `name`, `slug`, `description`, `status`, `approval_status`, `is_featured` |
| `product_images` | Product images | `id`, `product_id`, `url`, `alt_text`, `sort_order`, `is_primary` |
| `product_variants` | Product price/stock variant | `id`, `product_id`, `sku`, `variant_name`, `price_paise`, `mrp_paise`, `currency`, `stock_quantity`, `status` |
| `inventory_movements` | Stock change history | `id`, `product_variant_id`, `movement_type`, `quantity`, `reason`, `reference_type`, `reference_id`, `created_by` |

Product approval status enum:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`

### 11.6 Cart and Checkout

| Table | Purpose | Important Fields |
|---|---|---|
| `carts` | Active customer cart | `id`, `customer_id`, `status` |
| `cart_items` | Cart line items | `id`, `cart_id`, `product_variant_id`, `seller_id`, `quantity`, `unit_price_paise` |
| `checkout_sessions` | Temporary checkout record | `id`, `customer_id`, `cart_id`, `status`, `shipping_address_snapshot`, `payment_method` |

### 11.7 Orders

| Table | Purpose | Important Fields |
|---|---|---|
| `orders` | Customer order header | `id`, `order_number`, `customer_id`, `order_status`, `payment_status`, `delivery_status`, `subtotal_paise`, `shipping_paise`, `total_paise`, `currency` |
| `order_items` | Product line items | `id`, `order_id`, `seller_id`, `product_id`, `product_variant_id`, `product_name_snapshot`, `variant_snapshot`, `quantity`, `unit_price_paise`, `line_total_paise` |
| `order_seller_splits` | Seller-wise order grouping | `id`, `order_id`, `seller_id`, `seller_subtotal_paise`, `commission_paise`, `seller_status` |
| `order_status_events` | Order timeline | `id`, `order_id`, `status_type`, `old_status`, `new_status`, `note`, `created_by`, `created_at` |

Order status enum:

- `PLACED`
- `CONFIRMED`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

Payment status enum:

- `PENDING`
- `PAID`
- `FAILED`
- `REFUNDED`
- `NOT_REQUIRED`

Delivery status enum:

- `NOT_ASSIGNED`
- `PENDING`
- `PACKED`
- `DISPATCHED`
- `IN_TRANSIT`
- `DELIVERED`
- `CANCELLED`

### 11.8 Manual Delivery and Courier Details

| Table | Purpose | Important Fields |
|---|---|---|
| `delivery_details` | Store pickup, local partner, or courier delivery info per order | `id`, `order_id`, `delivery_mode`, `partner_name`, `partner_phone`, `delivery_partner_user_id`, `tracking_reference`, `estimated_delivery_date`, `delivery_note`, `status` |
| `delivery_events` | Delivery timeline updates | `id`, `delivery_detail_id`, `old_status`, `new_status`, `note`, `updated_by`, `created_at` |

Delivery mode enum:

- `STORE_PICKUP`
- `LOCAL_DELIVERY_PARTNER`
- `THIRD_PARTY_COURIER`

Phase 1 supports `DELIVERY_PARTNER` users for local partner assignment. Third-party courier details remain manual order-level data until live courier integrations are separately approved.

### 11.9 Payment Readiness

| Table | Purpose | Important Fields |
|---|---|---|
| `payments` | Payment attempt record | `id`, `order_id`, `provider`, `method`, `amount_paise`, `currency`, `status`, `provider_order_id`, `provider_payment_id`, `raw_response` |
| `payment_events` | Payment timeline | `id`, `payment_id`, `event_type`, `old_status`, `new_status`, `payload`, `created_at` |

Payment provider enum:

- `RAZORPAY`
- `COD`
- `BANK_TRANSFER`
- `MANUAL`

### 11.10 Basic B2B Enquiry

| Table | Purpose | Important Fields |
|---|---|---|
| `b2b_enquiries` | B2B enquiry header | `id`, `business_buyer_id`, `product_id`, `seller_id`, `quantity`, `message`, `status` |
| `b2b_enquiry_responses` | Manual seller/admin response | `id`, `enquiry_id`, `responder_user_id`, `response_message`, `quoted_price_paise`, `created_at` |

B2B enquiry status enum:

- `SUBMITTED`
- `IN_REVIEW`
- `RESPONDED`
- `CLOSED`
- `CANCELLED`

### 11.11 CMS and Content

| Table | Purpose | Important Fields |
|---|---|---|
| `banners` | Homepage/banner content | `id`, `title`, `subtitle`, `image_url`, `link_url`, `status`, `sort_order` |
| `cms_pages` | Policy and content pages | `id`, `slug`, `title`, `content`, `status`, `published_at` |
| `homepage_sections` | Homepage controlled sections | `id`, `section_type`, `title`, `config`, `status`, `sort_order` |

### 11.12 Support / Contact Requests

| Table | Purpose | Important Fields |
|---|---|---|
| `support_requests` | Basic contact/support form submissions | `id`, `user_id`, `name`, `email`, `phone`, `subject`, `message`, `status`, `admin_note` |

Support request status enum:

- `OPEN`
- `IN_REVIEW`
- `RESPONDED`
- `CLOSED`

### 11.13 Notifications and Email

| Table | Purpose | Important Fields |
|---|---|---|
| `notification_templates` | Email template settings | `id`, `code`, `channel`, `subject`, `body`, `status` |
| `notification_logs` | Notification send history | `id`, `user_id`, `channel`, `template_code`, `recipient`, `status`, `provider_message_id`, `error_message`, `created_at` |
| `email_settings` | Email provider config reference | `id`, `provider`, `sender_name`, `sender_email`, `is_enabled` |

Phase 1 email template codes:

- `CUSTOMER_ACCOUNT_CREATED`
- `SELLER_REGISTRATION_RECEIVED`
- `SELLER_APPROVED`
- `SELLER_REJECTED`
- `PRODUCT_SUBMITTED`
- `PRODUCT_APPROVED`
- `PRODUCT_REJECTED`
- `ORDER_PLACED_CUSTOMER`
- `ORDER_RECEIVED_SELLER`
- `ORDER_ALERT_ADMIN`
- `PAYMENT_PENDING`
- `PAYMENT_SUCCESS`
- `PAYMENT_FAILED`
- `ORDER_CONFIRMED`
- `ORDER_PROCESSING`
- `ORDER_DISPATCHED`
- `ORDER_DELIVERED`
- `ORDER_CANCELLED`
- `B2B_ENQUIRY_SUBMITTED`
- `B2B_ENQUIRY_ALERT`
- `B2B_ENQUIRY_RESPONSE`
- `SUPPORT_REQUEST_RECEIVED`
- `SUPPORT_REQUEST_ALERT`

### 11.14 Reports, Settings, and Audit

| Table | Purpose | Important Fields |
|---|---|---|
| `settings` | Platform settings | `id`, `key`, `value`, `value_type`, `group` |
| `audit_logs` | Sensitive action trail | `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `ip_address`, `created_at` |
| `report_snapshots` | Optional cached report data | `id`, `report_type`, `date_from`, `date_to`, `payload`, `created_at` |

Audit actions required in Phase 1:

- Seller approved/rejected/suspended.
- Product approved/rejected.
- Product price changed.
- Product stock changed.
- Order status changed.
- Delivery status changed.
- Payment status changed.
- Commission setting changed.
- CMS/policy page changed.
- Admin role changed.

## 12. Important Relationships

```text
users -> customers
users -> sellers
users -> business_buyers
users -> user_roles -> roles -> role_permissions -> permissions

sellers -> seller_profiles
sellers -> seller_addresses
sellers -> seller_subscriptions -> seller_subscription_plans
sellers -> products -> product_variants -> inventory_movements
products -> product_images
categories -> products

customers -> customer_addresses
customers -> carts -> cart_items
customers -> orders -> order_items
orders -> order_seller_splits -> sellers
orders -> delivery_details -> delivery_events
orders -> payments -> payment_events
orders -> order_status_events

business_buyers -> b2b_enquiries -> b2b_enquiry_responses

users -> notification_logs
users -> audit_logs
```

## 13. Indexing Plan

Create indexes for:

- `users.email`
- `users.clerk_user_id`
- `sellers.slug`
- `sellers.status`
- `sellers.approval_status`
- `seller_addresses.city`
- `seller_addresses.area`
- `categories.slug`
- `products.slug`
- `products.seller_id`
- `products.category_id`
- `products.status`
- `products.approval_status`
- `product_variants.sku`
- `orders.order_number`
- `orders.customer_id`
- `orders.order_status`
- `orders.payment_status`
- `orders.delivery_status`
- `orders.created_at`
- `order_items.seller_id`
- `payments.order_id`
- `payments.provider_payment_id`
- `delivery_details.order_id`
- `b2b_enquiries.business_buyer_id`
- `b2b_enquiries.seller_id`
- `b2b_enquiries.status`
- `notification_logs.template_code`
- `audit_logs.entity_type`
- `audit_logs.entity_id`
- `audit_logs.created_at`

## 14. Data Seeding Plan

Initial seed data should include:

- Admin role and admin user placeholder.
- Customer, seller, business buyer roles.
- Core permissions.
- Default settings.
- Default email templates.
- CMS pages for privacy, terms, refund/return, shipping, and seller policy.
- Sample categories if client has not yet provided final category data.
- Basic homepage sections.

## 15. Build Order Recommendation

| Step | Build Area | Reason |
|---|---|---|
| 1 | Auth, users, roles, permissions | Every protected area depends on access control. |
| 2 | Admin base layout and settings | Admin needs to approve and manage everything. |
| 3 | Seller registration and approval | Products depend on approved sellers. |
| 4 | Categories and product catalogue | Storefront, cart, and search depend on products. |
| 5 | Storefront product browsing | Customer shopping starts here. |
| 6 | Customer account and addresses | Checkout depends on customer/address data. |
| 7 | Cart and checkout | Order creation depends on cart and address data. |
| 8 | Orders and seller order view | Seller/admin operations depend on order data. |
| 9 | Manual delivery details | Order tracking depends on delivery status. |
| 10 | Transactional emails | Trigger after auth, seller, product, order, and B2B events exist. |
| 11 | Basic B2B enquiry flow | Depends on users, products, sellers, and business buyers. |
| 12 | CMS pages and banners | Can be built parallel after admin base. |
| 13 | Reports and audit logs | Reports depend on real transactional data. |
| 14 | Final QA and launch preparation | Full role and flow verification. |

## 16. Screens To Approve Before UI Design

Before visual UI design starts, approve these screen groups:

- Storefront homepage, category page, product listing, product detail.
- Cart, checkout, and order success.
- Customer account dashboard and order detail.
- Seller dashboard, product form, order detail, delivery update.
- B2B registration, enquiry form, enquiry list/detail.
- Admin dashboard, seller approval, product approval, order detail, reports, settings.

Generated UI screen mockup images are available for review at:

- `docs/ui-screen-images/index.html`
- `docs/ui-screen-images/IndiHub_All_UI_Screens_Contact_Sheet.svg`

These files are planning images only. They are not screenshots from a coded application.

## 17. Database Decisions To Confirm Before Scaffolding

Confirm these decisions before creating Prisma schema:

- Use Clerk as auth provider, with app-owned roles in PostgreSQL.
- Use INR as Phase 1 currency.
- Store money as integer paise fields.
- Use seller-managed stock.
- Use basic product variants from the beginning.
- Marketplace seller, hyperlocal store, and wholesale distributor use the seller table with `seller_type`; legal business entity type remains separate.
- Delivery partner details are manual fields on order delivery records with optional assignment to an active delivery partner user.
- Delivery partner is a separate web role for assigned manual delivery tasks only.
- No automated seller payout tables are active in Phase 1.
- Keep audit logs from the first admin/seller actions.

## 18. Phase 1 Acceptance Checklist For This Plan

This UI and database plan is ready when:

- Every frozen Phase 1 feature maps to at least one screen.
- Every screen has supporting database entities.
- Marketplace seller, hyperlocal store, and wholesale distributor are handled under one seller operational model.
- Delivery partner details are manual and can be assigned to a delivery partner web role.
- Email notifications have template and log tables.
- Future upgrade features are not required for Phase 1 launch.
