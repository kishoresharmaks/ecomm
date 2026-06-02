# 1HandIndia In-Memory Storage, Search, and Database Wireflow

**Project:** 1HandIndia Multi-Vendor Ecommerce Marketplace  
**Scope:** Phase 1 implemented code and locked architecture notes  
**Generated From:** `prisma/schema.prisma`, `apps/api`, `apps/web`, `apps/worker`, and Phase 1 planning documents  
**Last Reviewed:** 2026-06-02

## 1. Short Answer

1HandIndia does not use in-memory storage as the main database.

The business source of truth is PostgreSQL through Prisma. Users, sellers, products, carts, orders, payments, payouts, B2B enquiries, CMS content, notification logs, settings, and audit logs are persisted in database tables.

In-memory storage is used only for temporary runtime work:

- Browser-side React Query cache.
- API process-local rate-limit buckets.
- Temporary Maps inside service methods for grouping, lookup, and calculations.
- Redis-backed BullMQ jobs when `REDIS_URL` is configured.

Search is currently PostgreSQL-backed. Public product search uses PostgreSQL full-text ranking plus `ILIKE` fallback. Admin, seller, B2B, support, finance, HSN, CMS, and location searches use filtered Prisma queries over indexed columns.

## 2. In-Memory Storage Usage

### 2.1 Browser Memory

The web app uses TanStack React Query in `apps/web/src/components/providers.tsx`.

Current behavior:

- Query results are cached in browser memory.
- Default stale time is `30_000` ms.
- `refetchOnWindowFocus` is disabled.
- Cache is lost on full page reload or browser close.
- This is not a database and not shared between users.

Used for:

- Storefront product/cart/account queries.
- Seller dashboard/profile/products/orders.
- Admin, finance, B2B, delivery, CMS, locations, and notifications pages.

Wireflow:

```mermaid
flowchart LR
  UI[Next.js Client Component] --> RQ[React Query Memory Cache]
  RQ -->|cache hit inside stale time| UI
  RQ -->|cache miss or invalidation| API[NestJS API]
  API --> DB[(PostgreSQL)]
  DB --> API --> RQ --> UI
```

### 2.2 API Process Memory

`apps/api/src/rate-limit/request-rate-limiter.ts` uses a process-local `Map<string, RateLimitEntry>`.

What it stores:

- A hashed identity key.
- Current request count.
- Reset timestamp.

Policies include:

| Policy | Current Purpose |
|---|---|
| `auth` | Login/auth endpoints |
| `admin` | Back-office/admin and finance endpoints |
| `checkout` | Cart, checkout, customer order endpoints |
| `productDetail` | Product detail reads |
| `searchAnonymous` | Anonymous product search |
| `searchAuthenticated` | Authenticated product search |
| `public` | Other public API traffic |

Important limitation:

- This Map is per running API process.
- It clears on API restart.
- It does not automatically share counters across multiple API instances.
- The locked stack says Redis should be used for production-grade distributed rate limits, but the current implementation is process-local.

Wireflow:

```mermaid
flowchart LR
  Request[Incoming API Request] --> Limiter[RequestRateLimiter]
  Limiter --> Bucket[In-process Map Bucket]
  Bucket -->|allowed| Controller[NestJS Controller]
  Bucket -->|limit exceeded| TooMany[429 Too Many Requests]
```

### 2.3 Redis and BullMQ

Redis is used only when `REDIS_URL` is configured.

Current implemented queue:

- `email.notifications`

Worker scaffold also lists future queue names:

- `reports.basic`
- `audit.rollups`
- `future.search-index`
- `future.integration-retries`

Current important behavior:

- API creates a BullMQ queue through `NotificationQueueService`.
- The queued email payload removes provider config before adding the job.
- Worker reads jobs from Redis.
- Worker reads the durable `NotificationLog` from PostgreSQL.
- Worker updates `NotificationLog` status in PostgreSQL.
- Duplicate delivery protection uses a DB delivery lock in `providerMessageId`.

Redis is queue memory, not the permanent notification database.

Wireflow:

```mermaid
flowchart LR
  Event[Order/Seller/B2B/Support Event] --> Notify[NotificationsService]
  Notify --> Log[(NotificationLog table)]
  Notify --> Queue[Redis BullMQ: email.notifications]
  Queue --> Worker[apps/worker Email Worker]
  Worker --> Log
  Worker --> Provider[SMTP/Brevo/Resend/SendGrid]
  Provider --> Worker --> Log
```

### 2.4 Temporary Service Maps

Several services use `Map` as temporary function-level lookup tables. These are not storage layers.

Examples:

| Area | Map Usage |
|---|---|
| Payment/settings/storage services | Convert DB settings rows into quick lookup maps |
| Products/storefront | Preserve product ordering after raw SQL returns ranked IDs |
| Orders/delivery routing | Calculate partner workload, COD exposure, and recent assignment |
| Finance calculator | Cache commission-rule lookup inside one calculation |
| Location importers | Deduplicate CSV-derived states, cities, and areas during import |
| Notifications | Group last sent/failure counts by trigger |

These Maps are safe for short-lived computation, but they are not persistent and should not hold business-critical state.

### 2.5 Data Not Stored In Memory

These must remain PostgreSQL-backed:

- Users, roles, permissions, admin sessions.
- Customer profiles, addresses, carts, wishlist.
- Sellers, seller profile, seller documents, payout profile.
- Products, variants, stock, inventory movement.
- Orders, payments, delivery, status events.
- COD collection and finance verification.
- Settlements, payouts, ledger, statements.
- B2B enquiries and responses.
- CMS pages, banners, homepage sections, SEO entries.
- Notification logs and email settings.
- Platform settings and audit logs.

## 3. Search Implementation

### 3.1 Public Storefront Product Search

Public product search starts from the web search page:

```text
/search?q=keyword
```

The web page renders `ProductListingClient`, then calls:

```text
GET /api/products?search=keyword&pagination=cursor&limit=24
```

Backend path:

```text
ProductsController.listProducts
  -> ProductsService.listPublicProducts
  -> ProductsService.listPublicProductsByFullTextSearch
  -> PostgreSQL raw SQL
```

Search SQL uses:

- `to_tsvector('simple', product.name + product.description + product.search_text)`
- `plainto_tsquery('simple', search)`
- `ts_rank(...)` for result ranking
- `ILIKE` fallback on `name`, `description`, and `search_text`

Only valid public products are returned:

- Product is not deleted.
- Product is `ACTIVE`.
- Product approval is `APPROVED`.
- Seller is not deleted.
- Seller status is `APPROVED`.
- Seller approval is `APPROVED`.
- Category is not deleted.
- Category is `ACTIVE`.
- Resale/sold condition products without active stock are filtered out.

Search order:

```text
rank DESC, product.created_at DESC, product.id DESC
```

Cursor pagination encodes:

```text
rank + createdAt + id
```

Wireflow:

```mermaid
flowchart LR
  Header[Storefront Header Search] --> SearchPage[/search?q=keyword]
  SearchPage --> Listing[ProductListingClient]
  Listing --> API[GET /api/products?search=keyword]
  API --> Service[ProductsService]
  Service --> SQL[PostgreSQL full-text SQL]
  SQL --> Rank[Rank product IDs]
  Rank --> Hydrate[Fetch product cards by IDs]
  Hydrate --> Listing
```

### 3.2 Product Search Text

The `Product.searchText` column is generated when sellers create or update products.

It is built from:

- Product name.
- Product description.
- String and number product attributes.

It is trimmed and capped to 1000 characters.

Purpose:

- Keep product attributes searchable without adding a separate search engine in Phase 1.
- Allow future migration to Meilisearch/OpenSearch with a ready search document shape.

### 3.3 Seller and Admin Product Search

Seller and admin product list pages do not use the public full-text raw SQL path.

They use Prisma filters:

```text
name contains search OR
description contains search OR
searchText contains search
```

They also apply page-specific filters such as seller ID, category ID, product status, and approval status.

### 3.4 Location Search

Location search is backed by location tables:

- `LocationCountry`
- `LocationSubdivision`
- `LocationCity`
- `LocationArea`

Local-area search normalizes display labels. For example:

```text
Mettu Street (636001)
```

becomes search terms:

```text
Mettu Street
636001
```

Then the API searches:

- Area name.
- Postal code.
- Area code.

### 3.5 Other Search Surfaces

Other searches are filtered list queries, mainly `contains` filters over indexed fields.

| Area | Search Fields |
|---|---|
| Orders | Order number |
| Delivery partners | Email, phone, full name |
| Courier shipments | AWB number, provider order ID, shipment number, order number |
| COD remittances | AWB, remittance reference, report reference, shipment number, order number |
| Admin users | Email, phone, full name |
| Admin customers | Display name, email, phone |
| Admin sellers | Store name, slug, email, contact name, legal name, GST, PAN |
| B2B buyers | Company name, GST, contact name, email |
| B2B enquiries | Message, company, product, store |
| Finance payouts | Payout number, store name, transaction reference |
| Finance ledger | Description, reference ID, payout number |
| Seller statements | Statement number, store name, payout number |
| HSN master | HSN code, description, category |
| CMS and SEO | Title, slug, route path, public ID, focus keyword |
| Support | Name, email, subject |
| Email templates/logs | Code, name, subject, recipient |

### 3.6 Future Search Upgrade Path

The locked stack keeps Meilisearch as a future upgrade.

Recommended future flow:

```mermaid
flowchart LR
  ProductChange[Product Create/Update/Approval] --> DB[(PostgreSQL)]
  ProductChange --> Job[Redis BullMQ future.search-index]
  Job --> SearchIndex[Meilisearch/OpenSearch]
  CustomerSearch[Customer Search] --> API[NestJS Search API]
  API --> SearchIndex
  API --> DB
```

Do not add Meilisearch in Phase 1 unless it becomes an approved change request.

## 4. Complete Database Design Wireflow

The diagrams below combine real Prisma relationships with business-flow arrows. The table registry in each section lists the actual schema tables; arrows such as checkout to order or country to currency rate describe the application flow, not always a direct foreign-key column.

### 4.1 Full Business Flow

```mermaid
flowchart TB
  User[User] --> Customer[Customer]
  User --> Seller[Seller]
  User --> BusinessBuyer[BusinessBuyer]
  User --> AdminSession[AdminSession]
  User --> DeliveryPartnerProfile[DeliveryPartnerProfile]
  User --> UserRole[UserRole]
  UserRole --> Role[Role]
  Role --> RolePermission[RolePermission]
  RolePermission --> Permission[Permission]

  Seller --> SellerProfile[SellerProfile]
  Seller --> SellerAddress[SellerAddress]
  Seller --> SellerDocument[SellerDocument]
  Seller --> Product[Product]
  Seller --> SellerPayoutProfile[SellerPayoutProfile]
  Seller --> SellerSubscription[SellerSubscription]

  Category --> Product
  ProductTemplate --> Category
  ProductTemplate --> ProductTemplateField[ProductTemplateField]
  HsnMaster --> Product
  Product --> ProductImage[ProductImage]
  Product --> ProductVariant[ProductVariant]
  ProductVariant --> InventoryMovement[InventoryMovement]

  Customer --> CustomerAddress[CustomerAddress]
  Customer --> Wishlist[Wishlist]
  Wishlist --> WishlistItem[WishlistItem]
  Product --> WishlistItem
  Customer --> Cart[Cart]
  Cart --> CartItem[CartItem]
  ProductVariant --> CartItem
  Cart --> CheckoutSession[CheckoutSession]
  Customer --> Order[Order]

  Order --> OrderItem[OrderItem]
  Order --> OrderSellerSplit[OrderSellerSplit]
  Order --> OrderShipment[OrderShipment]
  Order --> DeliveryDetail[DeliveryDetail]
  Order --> Payment[Payment]
  Order --> OrderStatusEvent[OrderStatusEvent]
  Payment --> PaymentEvent[PaymentEvent]

  OrderSellerSplit --> SellerPayout[SellerPayout]
  SellerPayout --> SellerPayoutEvent[SellerPayoutEvent]
  SellerPayout --> SellerLedgerEntry[SellerLedgerEntry]
  SellerPayout --> SellerStatement[SellerStatement]
  SellerSettlementRun[SellerSettlementRun] --> SellerPayout

  BusinessBuyer --> BusinessBuyerAddress[BusinessBuyerAddress]
  BusinessBuyer --> B2BEnquiry[B2BEnquiry]
  Product --> B2BEnquiry
  Seller --> B2BEnquiry
  B2BEnquiry --> B2BEnquiryResponse[B2BEnquiryResponse]

  NotificationTemplate[NotificationTemplate] --> EmailTriggerRule[EmailTriggerRule]
  EmailTheme[EmailTheme] --> NotificationTemplate
  EmailTriggerRule --> NotificationLog[NotificationLog]
  User --> NotificationLog

  User --> SupportRequest[SupportRequest]
  User --> AuditLog[AuditLog]
```

### 4.2 Identity and Access

```mermaid
flowchart LR
  User --> UserRole --> Role --> RolePermission --> Permission
  User --> AdminCredential --> AdminSession
  User --> Customer
  User --> Seller
  User --> BusinessBuyer
  User --> DeliveryPartnerProfile
```

Tables:

| Table | Purpose |
|---|---|
| `User` | Platform user mapped to Clerk where applicable |
| `Role` | Role codes such as customer, seller, admin, finance, delivery |
| `Permission` | Fine-grained permission records |
| `UserRole` | Many-to-many user-role assignment |
| `RolePermission` | Many-to-many role-permission assignment |
| `AdminCredential` | Standalone admin/finance password credentials |
| `AdminSession` | DB-backed admin/finance session tokens |

### 4.3 Customer, Wishlist, Cart, and Checkout

```mermaid
flowchart LR
  User --> Customer
  Customer --> CustomerAddress
  Customer --> Wishlist --> WishlistItem --> Product
  Customer --> Cart --> CartItem --> ProductVariant
  Cart --> CheckoutSession
  CheckoutSession --> Order
```

Tables:

| Table | Purpose |
|---|---|
| `Customer` | Customer profile linked to `User` |
| `CustomerAddress` | Delivery address and normalized country/state/city/local area codes |
| `Wishlist` | One wishlist per customer |
| `WishlistItem` | Product saved by customer |
| `Cart` | Active/completed cart |
| `CartItem` | Product variant, seller, quantity, price snapshot |
| `CheckoutSession` | Checkout progress and address/payment snapshots |

### 4.4 Seller, KYC, Subscription, and Payout Profile

```mermaid
flowchart LR
  User --> Seller
  Seller --> SellerProfile
  Seller --> SellerAddress
  Seller --> SellerDocument
  Seller --> SellerPayoutProfile
  Seller --> SellerCourierProviderSetting
  SellerSubscriptionPlan --> SellerSubscription
  Seller --> SellerSubscription
  SellerSubscription --> SellerSubscriptionPayment
  SellerSubscription --> SellerSubscriptionProviderEvent
```

Tables:

| Table | Purpose |
|---|---|
| `Seller` | Store identity, approval, commission, subscription summary |
| `SellerProfile` | Logo, banner, business/KYC contact details |
| `SellerAddress` | Pickup/store address and location codes |
| `SellerDocument` | KYC document references |
| `SellerPayoutProfile` | Bank/UPI payout details |
| `SellerCourierProviderSetting` | Seller-specific courier provider setup |
| `SellerSubscriptionPlan` | Admin-managed seller plans |
| `SellerSubscription` | Seller plan subscription lifecycle |
| `SellerSubscriptionPayment` | Seller recurring plan payment records |
| `SellerSubscriptionProviderEvent` | Provider webhook/event audit for subscriptions |

### 4.5 Catalogue and Inventory

```mermaid
flowchart LR
  Category --> CategoryChild[Category children]
  ProductTemplate --> ProductTemplateField
  ProductTemplate --> Category
  Category --> Product
  Seller --> Product
  HsnMaster --> Product
  Product --> ProductImage
  Product --> ProductVariant
  ProductVariant --> InventoryMovement
```

Tables:

| Table | Purpose |
|---|---|
| `Category` | Category tree, tax defaults, product template link |
| `HsnMaster` | HSN/GST catalog suggestions |
| `ProductTemplate` | Dynamic product field template |
| `ProductTemplateField` | Field definitions for template attributes |
| `Product` | Seller product listing, approval, search text, tax fields |
| `ProductImage` | Product images and primary image ordering |
| `ProductVariant` | SKU, price, MRP, stock, package dimensions |
| `InventoryMovement` | Stock movement history |

### 4.6 Orders, Payments, Delivery, and Courier

```mermaid
flowchart TB
  Order --> OrderItem
  Order --> OrderSellerSplit
  OrderSellerSplit --> OrderShipment
  Order --> DeliveryDetail
  Order --> Payment --> PaymentEvent
  Order --> OrderStatusEvent

  DeliveryDetail --> DeliveryAssignmentAttempt
  DeliveryDetail --> DeliveryAttempt
  DeliveryDetail --> DeliveryEvent
  DeliveryPartnerProfile --> DeliveryPartnerServiceArea

  OrderShipment --> CourierShipment
  CourierShipment --> CourierCodRemittance
  CourierProviderSetting --> CourierShipment
  CourierProviderSetting --> CourierCodRemittance
  CourierWebhookEvent --> CourierShipment
```

Tables:

| Table | Purpose |
|---|---|
| `Order` | Customer order header, totals, FX snapshot, fee snapshot |
| `OrderItem` | Item-level product, variant, seller, price snapshot |
| `OrderSellerSplit` | Per-seller financial split and settlement eligibility |
| `OrderShipment` | Per-seller shipment, delivery mode, assignment, COD status |
| `OrderStatusEvent` | Order/seller/delivery timeline event |
| `DeliveryDetail` | Order-level delivery assignment and tracking |
| `DeliveryAssignmentAttempt` | Assignment attempt to delivery partner |
| `DeliveryPartnerProfile` | Delivery partner capacity, location, COD limits |
| `DeliveryPartnerServiceArea` | Detailed partner service area rules |
| `DeliveryAttempt` | Failed/rescheduled delivery attempt |
| `DeliveryTrackingCounter` | Date-based tracking number sequence |
| `DeliveryEvent` | Delivery status timeline |
| `Payment` | Payment provider, method, amount, state, provider IDs |
| `PaymentEvent` | Payment state changes and raw provider payloads |
| `ShippingRateCard` | Manual shipping and COD surcharge rules |
| `CourierProviderSetting` | Future/live courier provider settings |
| `CourierShipment` | Courier booking/tracking data |
| `CourierWebhookEvent` | Raw courier webhook records |
| `CourierCodRemittance` | Courier COD settlement/remittance verification |

### 4.7 Finance, Settlement, and Ledger

```mermaid
flowchart LR
  CommissionRule --> OrderSellerSplit
  OrderSellerSplit --> SellerPayout
  SellerSettlementRun --> SellerPayout
  SellerPayout --> SellerPayoutEvent
  SellerPayout --> SellerLedgerEntry
  SellerPayout --> SellerStatement
  Seller --> SellerLedgerEntry
  Seller --> SellerStatement
```

Tables:

| Table | Purpose |
|---|---|
| `CommissionRule` | Seller/category/global commission, GST, TDS, TCS, platform fee rules |
| `SellerSettlementRun` | Batch settlement summary |
| `SellerPayout` | Seller payout request/approval/payment record |
| `SellerPayoutEvent` | Payout lifecycle timeline |
| `SellerLedgerEntry` | Append-only seller ledger entries |
| `SellerStatement` | Seller statement snapshots |

### 4.8 B2B Buyer and Enquiry Flow

```mermaid
flowchart LR
  User --> BusinessBuyer
  BusinessBuyer --> BusinessBuyerAddress
  BusinessBuyer --> B2BEnquiry
  Product --> B2BEnquiry
  Seller --> B2BEnquiry
  B2BEnquiry --> B2BEnquiryResponse
  User --> B2BEnquiryResponse
```

Tables:

| Table | Purpose |
|---|---|
| `BusinessBuyer` | Company buyer profile linked to `User` |
| `BusinessBuyerAddress` | Procurement address |
| `B2BEnquiry` | Product/store/bulk enquiry and status |
| `B2BEnquiryResponse` | Seller/admin response and quoted price |

### 4.9 Locations and Market Currency

```mermaid
flowchart LR
  LocationCountry --> LocationSubdivision --> LocationCity --> LocationArea
  LocationImportSource --> LocationImportRun
  LocationCountry -. currency lookup .-> CurrencyRate
```

Tables:

| Table | Purpose |
|---|---|
| `LocationCountry` | Enabled countries, currency, locale, postal-code rules |
| `LocationSubdivision` | State/province records |
| `LocationCity` | City/district records |
| `LocationArea` | Local area and pincode/postal-code records |
| `LocationImportSource` | Data source configuration |
| `LocationImportRun` | Import run metrics and status |
| `CurrencyRate` | DB-backed FX cache, not in-memory cache |

### 4.10 CMS, Support, Notifications, Settings, and Audit

```mermaid
flowchart LR
  Banner --> StorefrontCMS[Storefront CMS]
  HomepageSection --> StorefrontCMS
  CmsPage --> StorefrontCMS
  SeoEntry --> StorefrontCMS
  CmsRedirect --> StorefrontCMS
  CmsMediaAsset --> StorefrontCMS
  CmsRevision --> StorefrontCMS
  CmsMenuItem --> StorefrontCMS

  User --> SupportRequest
  EmailTheme --> NotificationTemplate
  NotificationTemplate --> EmailTriggerRule
  EmailTriggerRule --> NotificationLog
  EmailSetting --> NotificationLog
  Setting --> AppConfig[Runtime App Config]
  User --> AuditLog
```

Tables:

| Table | Purpose |
|---|---|
| `Banner` | Homepage hero/banner records |
| `CmsPage` | Policy and content pages |
| `HomepageSection` | Configured storefront homepage sections |
| `SeoEntry` | SEO metadata by entity/route |
| `CmsRedirect` | Redirect rules |
| `CmsMediaAsset` | CMS media records |
| `CmsRevision` | CMS revision snapshots |
| `CmsMenuItem` | Header/footer menu tree |
| `SupportRequest` | Contact/support submissions |
| `NotificationTemplate` | Email template content |
| `EmailTriggerRule` | Event-to-template routing |
| `EmailTheme` | Email template theme tokens |
| `NotificationLog` | Durable email/notification log |
| `EmailSetting` | Email provider and sender configuration |
| `Setting` | Platform settings as typed JSON |
| `AuditLog` | Sensitive action audit trail |

## 5. Main End-To-End Wireflows

### 5.1 Seller Product Approval

```mermaid
flowchart LR
  SellerUser[Seller User] --> SellerOnboarding[Seller Onboarding]
  SellerOnboarding --> SellerTables[Seller/Profile/Address/Documents]
  Admin[Admin] --> SellerApproval[Approve Seller]
  SellerApproval --> SellerStatus[Seller APPROVED]
  SellerStatus --> ProductCreate[Seller Creates Product]
  ProductCreate --> ProductDraft[Product PENDING_APPROVAL]
  Admin --> ProductApproval[Approve Product]
  ProductApproval --> ProductActive[Product ACTIVE + APPROVED]
  ProductActive --> Searchable[Visible in Storefront/Search]
```

### 5.2 Customer Order and Seller Split

```mermaid
flowchart LR
  Customer --> Cart
  Cart --> CheckoutSession
  CheckoutSession --> Order
  Order --> OrderItem
  Order --> OrderSellerSplit
  Order --> Payment
  Payment --> PaymentEvent
  OrderSellerSplit --> SettlementEligibility[Delivered and Paid Eligibility]
  SettlementEligibility --> SellerPayout
  SellerPayout --> SellerLedgerEntry
  SellerPayout --> SellerStatement
```

### 5.3 Delivery and COD Verification

```mermaid
flowchart LR
  Order --> DeliveryDetail
  Admin --> AssignPartner[Assign Delivery Partner]
  AssignPartner --> DeliveryAssignmentAttempt
  DeliveryPartner[Delivery Partner] --> UpdateDelivery[Update Delivery Progress]
  UpdateDelivery --> DeliveryEvent
  DeliveryPartner --> RecordCOD[Record COD Cash]
  RecordCOD --> PendingCOD[COD Still Pending]
  Admin --> VerifyCOD[Verify COD Collection]
  VerifyCOD --> PaymentPaid[Payment PAID]
  PaymentPaid --> SettlementEligible[Seller Split Settlement Eligible]
```

### 5.4 Notification Queue

```mermaid
flowchart LR
  BusinessEvent[Business Event] --> EmailTriggerRule
  EmailTriggerRule --> NotificationTemplate
  NotificationTemplate --> NotificationLog
  NotificationLog --> RedisQueue[Redis BullMQ Queue]
  RedisQueue --> Worker
  Worker --> EmailProvider
  Worker --> NotificationLog
```

## 6. Practical Explanation For The Project

Use this wording when explaining the architecture:

```text
The project uses PostgreSQL as the permanent source of truth. In-memory state is limited to temporary runtime caches, browser query caching, API rate-limit buckets, and Redis/BullMQ queue memory for background email jobs. Product search in Phase 1 is handled directly in PostgreSQL using full-text ranking and indexed filters. The database is designed around multi-role users, sellers, products, carts, orders split by sellers, payments, manual delivery, COD verification, B2B enquiries, finance settlement, CMS, notifications, settings, and audit logs.
```

## 7. Production Notes

- Do not store user, seller, payment, payout, cart, order, or approval state only in memory.
- Move process-local rate limits to Redis if the API runs on multiple instances.
- Keep Redis queue payloads minimal and non-secret.
- Keep provider secrets in environment variables or admin-managed secure settings, not in public responses.
- Keep search source data in PostgreSQL first.
- Add Meilisearch only after Phase 1 if typo tolerance, facets, and large-catalog ranking become required.
- Keep all money fields in minor units, such as paise, as the schema already does.
- Keep audit logs for admin, seller, product, order, delivery, finance, settings, and policy-sensitive actions.
