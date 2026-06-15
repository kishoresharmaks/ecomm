import "dotenv/config";
import {
  CategoryStatus,
  ContentStatus,
  EmailRecipientType,
  EmailTemplateCategory,
  NotificationChannel,
  prisma,
  ProductAttributeFieldType,
  ProductAttributeScope,
  ProductListingMode,
  ProductTemplateStatus,
  RoleCode,
  SellerSubscriptionBillingCycle,
  SellerSubscriptionStatus,
  SettingValueType,
  UserStatus,
} from "../packages/database/src/index";
import { hashAdminPassword } from "../apps/api/src/auth/admin-password";
import { bundledLocationDataset } from "../apps/api/src/locations/bundled-location-data";

const roleSeeds = [
  { code: RoleCode.CUSTOMER, name: "Customer", description: "B2C buyer account." },
  {
    code: RoleCode.SELLER,
    name: "Seller",
    description: "Marketplace seller, hyperlocal store, or wholesale distributor.",
  },
  {
    code: RoleCode.BUSINESS_BUYER,
    name: "Business Buyer",
    description: "B2B buyer account for enquiries.",
  },
  { code: RoleCode.ADMIN, name: "Admin", description: "Platform admin and operations team." },
  {
    code: RoleCode.FINANCE,
    name: "Finance Manager",
    description: "Finance workspace user for payments, settlements, payouts, and reports.",
  },
  {
    code: RoleCode.COURIER_MANAGER,
    name: "Courier Manager",
    description: "Courier and delivery operations workspace user.",
  },
];

const permissionSeeds = [
  ["admin.dashboard.read", "Read admin dashboard", "admin"],
  ["auth.user.sync", "Sync authenticated users", "auth"],
  [
    "customer.account.manage",
    "Manage own customer profile, address book, and wishlist",
    "customers",
  ],
  ["cart.manage", "Manage own shopping cart", "cart"],
  ["order.place", "Place and read own orders", "orders"],
  ["seller.order.manage", "Manage seller-side order status", "orders"],
  ["b2b.profile.manage", "Manage own business buyer profile", "b2b"],
  ["b2b.enquiry.manage", "Submit and read own B2B enquiries", "b2b"],
  ["seller.b2b.respond", "Read and respond to seller B2B enquiries", "b2b"],
  ["admin.b2b.manage", "Manage all B2B enquiries", "b2b"],
  ["category.manage", "Manage categories", "catalogue"],
  ["seller.product.manage", "Manage seller products", "products"],
  ["seller.approve", "Approve or reject sellers", "sellers"],
  ["admin.users.manage", "Manage users and role assignments", "users"],
  ["product.approve", "Approve or reject products", "products"],
  ["product.read", "Read product catalogue", "products"],
  ["order.manage", "Manage platform orders", "orders"],
  ["delivery.update", "Update delivery records", "delivery"],
  ["cms.manage", "Manage CMS pages and banners", "cms"],
  ["support.manage", "Manage support requests", "support"],
  ["reports.read", "Read operational reports", "reports"],
  ["settings.manage", "Manage platform settings", "settings"],
  ["payments.manage", "Manage payment readiness and webhooks", "payments"],
  ["finance.workspace.manage", "Manage finance workspace operations", "finance"],
  ["storage.manage", "Manage upload provider readiness", "storage"],
  ["notifications.read", "Read and retry notification logs", "notifications"],
  ["audit.read", "Read audit logs", "audit"],
] as const;

const cmsPages = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    content:
      "1HandIndia collects customer, seller, and business buyer information only for marketplace operations such as account access, order processing, seller approvals, support, delivery updates, and compliance records.\n\nPayment, identity, email, storage, and delivery providers may process information when those services are enabled. Provider charges, account approvals, and production credentials remain separate client responsibilities.\n\nUsers can contact 1HandIndia support for account, order, or data correction requests. Final legal wording should be reviewed before production launch.",
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    content:
      "1HandIndia is a multi-vendor marketplace where customers, marketplace sellers, hyperlocal stores, wholesale distributors, and business buyers use separate account areas. Users must provide accurate information, follow marketplace policies, and use the platform only for lawful transactions.\n\nSellers are responsible for product accuracy, stock, pricing, fulfilment, and manual delivery updates. 1HandIndia admin may moderate sellers, products, orders, content, and B2B enquiries to protect marketplace trust.\n\nFinal commercial, legal, tax, payment, and dispute terms should be reviewed and approved before production launch.",
  },
  {
    slug: "refund-return-policy",
    title: "Refund / Return Policy",
    content:
      "Refund, return, and cancellation handling depends on the product, seller policy, payment method, and order status approved for launch. Customers should raise support requests with order details when a correction is needed.\n\nAdmin and seller teams can update order, payment, cancellation, and delivery status manually during Phase 1. Online payment refunds become active only after the payment provider account and rules are approved.\n\nFinal client-approved refund, return, replacement, and cancellation wording should be published before production launch.",
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    content:
      "1HandIndia Phase 1 supports three delivery modes: store pickup, local delivery partner, and third-party courier service. Local delivery partner orders can be auto-assigned after packing, store pickup orders are collected from the seller/store, and third-party courier orders can record courier name, contact number, tracking reference, estimated delivery date, and notes.\n\nCustomer-facing tracking uses the latest order and delivery status updated by the platform team, seller, or assigned delivery partner. Live courier API tracking remains a future upgrade unless separately approved.\n\nFinal delivery zones, charges, pickup rules, and carrier responsibilities should be confirmed before production launch.",
  },
  {
    slug: "seller-policy",
    title: "Seller Policy",
    content:
      "Marketplace sellers, hyperlocal stores, and wholesale distributors must complete onboarding and admin approval before active selling. Product submissions, images, pricing, stock, and delivery updates must be accurate and may be reviewed by admin.\n\n1HandIndia can reject, archive, or suspend sellers and products that break marketplace quality, trust, fulfilment, or policy requirements. Seller finance, commissions, settlements, payouts, and ledger records are managed through the admin finance workflow.\n\nFinal seller commercial terms, commission rules, KYC requirements, and dispute handling should be approved before production launch.",
  },
] as const;

const defaultCategories = [
  ["groceries", "Groceries"],
  ["fashion", "Fashion"],
  ["electronics", "Electronics"],
  ["home-kitchen", "Home & Kitchen"],
  ["hyperlocal-stores", "Hyperlocal Stores"],
] as const;

const defaultCategoryTemplateCodes: Record<(typeof defaultCategories)[number][0], string> = {
  groceries: "STANDARD",
  fashion: "FASHION",
  electronics: "ELECTRONICS",
  "home-kitchen": "HOME",
  "hyperlocal-stores": "STANDARD",
};

const defaultCategoryTaxProfiles: Partial<
  Record<
    (typeof defaultCategories)[number][0],
    {
      defaultHsnCode: string;
      defaultGstRatePercent: number;
      defaultTaxDescription: string;
    }
  >
> = {
  groceries: {
    defaultHsnCode: "1006",
    defaultGstRatePercent: 5,
    defaultTaxDescription: "Rice, cereals, and common grocery staples.",
  },
  fashion: {
    defaultHsnCode: "6109",
    defaultGstRatePercent: 5,
    defaultTaxDescription: "Knitted or crocheted T-shirts and basic apparel.",
  },
  electronics: {
    defaultHsnCode: "8517",
    defaultGstRatePercent: 18,
    defaultTaxDescription: "Phones, communication equipment, and common mobile accessories.",
  },
  "home-kitchen": {
    defaultHsnCode: "7323",
    defaultGstRatePercent: 12,
    defaultTaxDescription: "Household, kitchen, and table articles.",
  },
};

const productTemplateSeeds = [
  {
    code: "STANDARD",
    name: "Standard product",
    description: "General catalogue fields for simple products.",
    listingMode: ProductListingMode.CART,
    sortOrder: 10,
    fields: [] as const,
  },
  {
    code: "FASHION",
    name: "Fashion",
    description: "Clothing, footwear, and style products with size and color variants.",
    listingMode: ProductListingMode.CART,
    sortOrder: 20,
    fields: [
      productField("Gender", "gender", ProductAttributeFieldType.SELECT, {
        options: ["Men", "Women", "Kids", "Unisex"],
        filterable: true,
        searchable: true,
      }),
      productField("Fabric", "fabric", ProductAttributeFieldType.TEXT, {
        placeholder: "Cotton, silk, denim",
        searchable: true,
      }),
      productField("Fit", "fit", ProductAttributeFieldType.SELECT, {
        options: ["Regular", "Slim", "Relaxed", "Oversized"],
        filterable: true,
      }),
      variantField("Size", "size", ProductAttributeFieldType.SELECT, {
        required: true,
        options: ["XS", "S", "M", "L", "XL", "XXL", "Free Size"],
        filterable: true,
      }),
      variantField("Color", "color", ProductAttributeFieldType.TEXT, {
        required: true,
        placeholder: "Black, blue, red",
        filterable: true,
        searchable: true,
      }),
    ],
  },
  {
    code: "BEAUTY",
    name: "Beauty",
    description: "Beauty, wellness, and care products with skin type and expiry data.",
    listingMode: ProductListingMode.CART,
    sortOrder: 30,
    fields: [
      productField("Brand", "brand", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Skin type", "skinType", ProductAttributeFieldType.MULTI_SELECT, {
        options: ["Normal", "Dry", "Oily", "Combination", "Sensitive"],
        filterable: true,
      }),
      productField("Expiry date", "expiryDate", ProductAttributeFieldType.DATE),
      productField("Ingredients", "ingredients", ProductAttributeFieldType.TEXTAREA, { searchable: true }),
    ],
  },
  {
    code: "MOBILES",
    name: "Mobiles",
    description: "Mobile phones and accessories with RAM, storage, battery, and warranty fields.",
    listingMode: ProductListingMode.CART,
    sortOrder: 40,
    fields: [
      productField("Brand", "brand", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Model", "model", ProductAttributeFieldType.TEXT, { required: true, searchable: true }),
      productField("Battery", "battery", ProductAttributeFieldType.TEXT, { placeholder: "5000 mAh" }),
      productField("Warranty", "warranty", ProductAttributeFieldType.TEXT, { placeholder: "1 year manufacturer warranty" }),
      productField("Network type", "networkType", ProductAttributeFieldType.SELECT, {
        options: ["4G", "5G", "Wi-Fi only"],
        filterable: true,
      }),
      variantField("RAM", "ram", ProductAttributeFieldType.SELECT, {
        options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"],
        filterable: true,
      }),
      variantField("Storage", "storage", ProductAttributeFieldType.SELECT, {
        options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"],
        filterable: true,
      }),
      variantField("Color", "color", ProductAttributeFieldType.TEXT, { filterable: true, searchable: true }),
    ],
  },
  {
    code: "ELECTRONICS",
    name: "Electronics",
    description: "Electronics and gadgets with brand, model, warranty, and specifications.",
    listingMode: ProductListingMode.CART,
    sortOrder: 50,
    fields: [
      productField("Brand", "brand", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Model", "model", ProductAttributeFieldType.TEXT, { searchable: true }),
      productField("Warranty", "warranty", ProductAttributeFieldType.TEXT, { placeholder: "1 year warranty" }),
      productField("Power", "power", ProductAttributeFieldType.TEXT, { placeholder: "1200 W, 220 V" }),
      productField("Key specs", "keySpecs", ProductAttributeFieldType.TEXTAREA, { searchable: true }),
    ],
  },
  {
    code: "HOME",
    name: "Home",
    description: "Home and kitchen products with material, usage, and care details.",
    listingMode: ProductListingMode.CART,
    sortOrder: 60,
    fields: [
      productField("Brand", "brand", ProductAttributeFieldType.TEXT, { searchable: true, filterable: true }),
      productField("Material", "material", ProductAttributeFieldType.TEXT, { searchable: true, filterable: true }),
      productField("Dimensions", "dimensions", ProductAttributeFieldType.TEXT),
      productField("Care instructions", "careInstructions", ProductAttributeFieldType.TEXTAREA),
    ],
  },
  {
    code: "APPLIANCES",
    name: "Appliances",
    description: "Home appliances with model, capacity, energy rating, and warranty.",
    listingMode: ProductListingMode.CART,
    sortOrder: 70,
    fields: [
      productField("Brand", "brand", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Model", "model", ProductAttributeFieldType.TEXT, { searchable: true }),
      productField("Capacity", "capacity", ProductAttributeFieldType.TEXT, { placeholder: "7 kg, 250 L" }),
      productField("Energy rating", "energyRating", ProductAttributeFieldType.SELECT, {
        options: ["1 Star", "2 Star", "3 Star", "4 Star", "5 Star"],
        filterable: true,
      }),
      productField("Warranty", "warranty", ProductAttributeFieldType.TEXT),
    ],
  },
  {
    code: "BOOKS",
    name: "Books",
    description: "Books and study material with author, publisher, edition, and ISBN.",
    listingMode: ProductListingMode.CART,
    sortOrder: 80,
    fields: [
      productField("Author", "author", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Publisher", "publisher", ProductAttributeFieldType.TEXT, { searchable: true, filterable: true }),
      productField("Language", "language", ProductAttributeFieldType.SELECT, {
        options: ["English", "Tamil", "Hindi", "Malayalam", "Telugu", "Kannada", "Other"],
        filterable: true,
      }),
      productField("Edition", "edition", ProductAttributeFieldType.TEXT),
      productField("ISBN", "isbn", ProductAttributeFieldType.TEXT, { searchable: true }),
    ],
  },
  {
    code: "FURNITURE",
    name: "Furniture",
    description: "Furniture listings with material, dimensions, room type, and assembly details.",
    listingMode: ProductListingMode.CART,
    sortOrder: 90,
    fields: [
      productField("Material", "material", ProductAttributeFieldType.TEXT, { required: true, searchable: true, filterable: true }),
      productField("Dimensions", "dimensions", ProductAttributeFieldType.TEXT, { required: true }),
      productField("Room type", "roomType", ProductAttributeFieldType.SELECT, {
        options: ["Living room", "Bedroom", "Dining", "Office", "Outdoor", "Kids room"],
        filterable: true,
      }),
      productField("Assembly required", "assemblyRequired", ProductAttributeFieldType.BOOLEAN),
      productField("Warranty", "warranty", ProductAttributeFieldType.TEXT),
    ],
  },
  {
    code: "AGRI",
    name: "Agriculture and bulk",
    description: "Agriculture products with units, pack size, organic, and bulk enquiry data.",
    listingMode: ProductListingMode.CART_AND_ENQUIRY,
    sortOrder: 100,
    fields: [
      productField("Unit type", "unitType", ProductAttributeFieldType.SELECT, {
        required: true,
        options: ["kg", "gram", "bag", "ton", "piece", "box", "litre"],
        filterable: true,
      }),
      productField("Organic", "organic", ProductAttributeFieldType.BOOLEAN, { filterable: true }),
      productField("Bulk available", "bulkAvailable", ProductAttributeFieldType.BOOLEAN, { filterable: true }),
      productField("Minimum bulk quantity", "minimumBulkQuantity", ProductAttributeFieldType.NUMBER),
      variantField("Pack size", "packSize", ProductAttributeFieldType.TEXT, { required: true, placeholder: "5 kg bag" }),
    ],
  },
  {
    code: "PROPERTY",
    name: "Property and houses",
    description: "Property listings with location, sale/rent, area, bedrooms, and enquiry notes.",
    listingMode: ProductListingMode.ENQUIRY_ONLY,
    sortOrder: 110,
    fields: [
      productField("Property type", "propertyType", ProductAttributeFieldType.SELECT, {
        required: true,
        options: ["House", "Apartment", "Villa", "Land", "Commercial", "Rental room"],
        filterable: true,
      }),
      productField("Sale or rent", "saleOrRent", ProductAttributeFieldType.SELECT, {
        required: true,
        options: ["Sale", "Rent", "Lease"],
        filterable: true,
      }),
      productField("Location", "location", ProductAttributeFieldType.TEXT, { required: true, searchable: true }),
      productField("Area sqft", "areaSqft", ProductAttributeFieldType.NUMBER, { required: true, filterable: true }),
      productField("Bedrooms", "bedrooms", ProductAttributeFieldType.NUMBER, { filterable: true }),
      productField("Bathrooms", "bathrooms", ProductAttributeFieldType.NUMBER, { filterable: true }),
      productField("Furnishing", "furnishing", ProductAttributeFieldType.SELECT, {
        options: ["Unfurnished", "Semi furnished", "Fully furnished"],
        filterable: true,
      }),
      productField("Enquiry notes", "enquiryNotes", ProductAttributeFieldType.TEXTAREA),
    ],
  },
] as const;

const defaultHeaderMenuItems = [
  { label: "Categories", href: "/categories", sortOrder: 10 },
  { label: "Stores", href: "/stores", sortOrder: 20 },
  { label: "Track", href: "/track-order", sortOrder: 30 },
  { label: "Contact", href: "/contact", sortOrder: 40 },
  { label: "Seller", href: "/seller", sortOrder: 50 },
  { label: "B2B", href: "/b2b", sortOrder: 60 },
] as const;

const emailTemplates = [
  {
    code: "CUSTOMER_ACCOUNT_CREATED",
    name: "Customer welcome email",
    category: EmailTemplateCategory.CUSTOMER,
    subject: "Welcome to 1HandIndia",
  },
  {
    code: "SELLER_REGISTRATION_RECEIVED",
    name: "Seller registration received",
    category: EmailTemplateCategory.SELLER,
    subject: "Seller registration received",
  },
  {
    code: "SELLER_APPROVED",
    name: "Seller approved",
    category: EmailTemplateCategory.SELLER,
    subject: "Your 1HandIndia seller account is approved",
  },
  {
    code: "SELLER_REJECTED",
    name: "Seller rejected or suspended",
    category: EmailTemplateCategory.SELLER,
    subject: "Your 1HandIndia seller registration update",
  },
  {
    code: "PRODUCT_SUBMITTED",
    name: "Product submitted",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Product submitted for approval",
  },
  {
    code: "PRODUCT_APPROVED",
    name: "Product approved",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Your product is approved",
  },
  {
    code: "PRODUCT_REJECTED",
    name: "Product rejected",
    category: EmailTemplateCategory.PRODUCT,
    subject: "Your product needs changes",
  },
  {
    code: "ORDER_PLACED_CUSTOMER",
    name: "Order placed customer receipt",
    category: EmailTemplateCategory.ORDER,
    subject: "Your 1HandIndia order is placed",
  },
  {
    code: "ORDER_RECEIVED_SELLER",
    name: "Order received by seller",
    category: EmailTemplateCategory.ORDER,
    subject: "New order received",
  },
  {
    code: "ORDER_ALERT_ADMIN",
    name: "New order admin alert",
    category: EmailTemplateCategory.ORDER,
    subject: "New order alert",
  },
  {
    code: "PAYMENT_PENDING",
    name: "Payment pending",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment pending for your 1HandIndia order",
  },
  {
    code: "PAYMENT_SUCCESS",
    name: "Payment successful",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment received for your 1HandIndia order",
  },
  {
    code: "PAYMENT_FAILED",
    name: "Payment failed",
    category: EmailTemplateCategory.PAYMENT,
    subject: "Payment failed for your 1HandIndia order",
  },
  {
    code: "ORDER_CONFIRMED",
    name: "Order confirmed",
    category: EmailTemplateCategory.ORDER,
    subject: "Your order is confirmed",
  },
  {
    code: "ORDER_PROCESSING",
    name: "Order processing",
    category: EmailTemplateCategory.ORDER,
    subject: "Your order is processing",
  },
  {
    code: "ORDER_DISPATCHED",
    name: "Order dispatched",
    category: EmailTemplateCategory.ORDER,
    subject: "Your order is dispatched",
  },
  {
    code: "ORDER_DELIVERED",
    name: "Order delivered",
    category: EmailTemplateCategory.ORDER,
    subject: "Your order is delivered",
  },
  {
    code: "ORDER_CANCELLED",
    name: "Order cancelled",
    category: EmailTemplateCategory.ORDER,
    subject: "Your order is cancelled",
  },
  {
    code: "B2B_ENQUIRY_SUBMITTED",
    name: "B2B enquiry submitted",
    category: EmailTemplateCategory.B2B,
    subject: "B2B enquiry submitted",
  },
  {
    code: "B2B_ENQUIRY_ALERT",
    name: "B2B enquiry alert",
    category: EmailTemplateCategory.B2B,
    subject: "New B2B enquiry",
  },
  {
    code: "B2B_ENQUIRY_RESPONSE",
    name: "B2B enquiry response",
    category: EmailTemplateCategory.B2B,
    subject: "B2B enquiry response",
  },
  {
    code: "SUPPORT_REQUEST_RECEIVED",
    name: "Support request received",
    category: EmailTemplateCategory.SUPPORT,
    subject: "Support request received",
  },
  {
    code: "SUPPORT_REQUEST_ALERT",
    name: "Support request admin alert",
    category: EmailTemplateCategory.SUPPORT,
    subject: "New support request",
  },
  {
    code: "SUPPORT_REQUEST_RESPONDED",
    name: "Support request response",
    category: EmailTemplateCategory.SUPPORT,
    subject: "Response to your support request",
  },
] as const;

const emailTriggerRules = [
  [
    "CUSTOMER_REGISTERED",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.CUSTOMER,
    "CUSTOMER_ACCOUNT_CREATED",
  ],
  [
    "SELLER_REGISTRATION_SUBMITTED_SELLER",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.SELLER,
    "SELLER_REGISTRATION_RECEIVED",
  ],
  [
    "SELLER_REGISTRATION_SUBMITTED_ADMIN",
    EmailRecipientType.ADMIN,
    EmailTemplateCategory.SELLER,
    "SELLER_REGISTRATION_RECEIVED",
  ],
  ["SELLER_APPROVED", EmailRecipientType.SELLER, EmailTemplateCategory.SELLER, "SELLER_APPROVED"],
  ["SELLER_REJECTED", EmailRecipientType.SELLER, EmailTemplateCategory.SELLER, "SELLER_REJECTED"],
  [
    "PRODUCT_SUBMITTED_SELLER",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.PRODUCT,
    "PRODUCT_SUBMITTED",
  ],
  [
    "PRODUCT_SUBMITTED_ADMIN",
    EmailRecipientType.ADMIN,
    EmailTemplateCategory.PRODUCT,
    "PRODUCT_SUBMITTED",
  ],
  [
    "PRODUCT_APPROVED",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.PRODUCT,
    "PRODUCT_APPROVED",
  ],
  [
    "PRODUCT_REJECTED",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.PRODUCT,
    "PRODUCT_REJECTED",
  ],
  [
    "ORDER_PLACED_CUSTOMER",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.ORDER,
    "ORDER_PLACED_CUSTOMER",
  ],
  [
    "ORDER_RECEIVED_SELLER",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.ORDER,
    "ORDER_RECEIVED_SELLER",
  ],
  [
    "ORDER_PLACED_ADMIN",
    EmailRecipientType.ADMIN,
    EmailTemplateCategory.ORDER,
    "ORDER_ALERT_ADMIN",
  ],
  ["ORDER_CONFIRMED", EmailRecipientType.CUSTOMER, EmailTemplateCategory.ORDER, "ORDER_CONFIRMED"],
  [
    "ORDER_PROCESSING",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.ORDER,
    "ORDER_PROCESSING",
  ],
  [
    "ORDER_DISPATCHED",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.ORDER,
    "ORDER_DISPATCHED",
  ],
  ["ORDER_DELIVERED", EmailRecipientType.CUSTOMER, EmailTemplateCategory.ORDER, "ORDER_DELIVERED"],
  ["ORDER_CANCELLED", EmailRecipientType.CUSTOMER, EmailTemplateCategory.ORDER, "ORDER_CANCELLED"],
  [
    "PAYMENT_PENDING",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.PAYMENT,
    "PAYMENT_PENDING",
  ],
  [
    "PAYMENT_SUCCESS",
    EmailRecipientType.CUSTOMER,
    EmailTemplateCategory.PAYMENT,
    "PAYMENT_SUCCESS",
  ],
  ["PAYMENT_FAILED", EmailRecipientType.CUSTOMER, EmailTemplateCategory.PAYMENT, "PAYMENT_FAILED"],
  [
    "B2B_ENQUIRY_SUBMITTED_BUYER",
    EmailRecipientType.BUSINESS_BUYER,
    EmailTemplateCategory.B2B,
    "B2B_ENQUIRY_SUBMITTED",
  ],
  [
    "B2B_ENQUIRY_SUBMITTED_SELLER",
    EmailRecipientType.SELLER,
    EmailTemplateCategory.B2B,
    "B2B_ENQUIRY_ALERT",
  ],
  [
    "B2B_ENQUIRY_SUBMITTED_ADMIN",
    EmailRecipientType.ADMIN,
    EmailTemplateCategory.B2B,
    "B2B_ENQUIRY_ALERT",
  ],
  [
    "B2B_ENQUIRY_RESPONSE_BUYER",
    EmailRecipientType.BUSINESS_BUYER,
    EmailTemplateCategory.B2B,
    "B2B_ENQUIRY_RESPONSE",
  ],
  [
    "SUPPORT_REQUEST_RECEIVED",
    EmailRecipientType.SUPPORT_REQUESTER,
    EmailTemplateCategory.SUPPORT,
    "SUPPORT_REQUEST_RECEIVED",
  ],
  [
    "SUPPORT_REQUEST_ADMIN_ALERT",
    EmailRecipientType.ADMIN,
    EmailTemplateCategory.SUPPORT,
    "SUPPORT_REQUEST_ALERT",
  ],
  [
    "SUPPORT_REQUEST_RESPONDED",
    EmailRecipientType.SUPPORT_REQUESTER,
    EmailTemplateCategory.SUPPORT,
    "SUPPORT_REQUEST_RESPONDED",
  ],
] as const;

const defaultSettings = [
  ["platform.name", "general", SettingValueType.STRING, "1HandIndia"],
  ["platform.currency", "general", SettingValueType.STRING, "INR"],
  ["market.enabled_countries", "market", SettingValueType.JSON, ["IN", "AE", "US", "GB", "SG"]],
  ["market.default_country", "market", SettingValueType.STRING, "IN"],
  ["fx.provider", "market", SettingValueType.STRING, "frankfurter"],
  ["fx.base_currency", "market", SettingValueType.STRING, "INR"],
  ["fx.cache_ttl_minutes", "market", SettingValueType.NUMBER, 360],
  ["checkout.cod.enabled", "checkout", SettingValueType.BOOLEAN, false],
  ["payments.razorpay.enabled", "payments", SettingValueType.BOOLEAN, false],
  ["payments.razorpay.mode", "payments", SettingValueType.STRING, "TEST"],
  ["payments.razorpay.key_id", "payments", SettingValueType.STRING, ""],
  ["payments.razorpay.key_secret", "payments", SettingValueType.STRING, ""],
  ["payments.razorpay.webhook_secret", "payments", SettingValueType.STRING, ""],
  [
    "payments.cod.instructions",
    "payments",
    SettingValueType.STRING,
    "Pay cash to the delivery partner when the order is delivered.",
  ],
  ["payments.cod.max_order_paise", "payments", SettingValueType.NUMBER, 0],
  ["payments.bank_transfer.enabled", "payments", SettingValueType.BOOLEAN, false],
  ["payments.bank_transfer.account_holder_name", "payments", SettingValueType.STRING, ""],
  ["payments.bank_transfer.bank_name", "payments", SettingValueType.STRING, ""],
  ["payments.bank_transfer.account_number", "payments", SettingValueType.STRING, ""],
  ["payments.bank_transfer.ifsc_code", "payments", SettingValueType.STRING, ""],
  ["payments.bank_transfer.branch", "payments", SettingValueType.STRING, ""],
  ["payments.bank_transfer.upi_id", "payments", SettingValueType.STRING, ""],
  [
    "payments.bank_transfer.instructions",
    "payments",
    SettingValueType.STRING,
    "Transfer the order amount to the platform bank or UPI account and enter the UTR/reference for finance verification.",
  ],
  ["payments.bank_transfer.reference_required", "payments", SettingValueType.BOOLEAN, true],
  ["payments.manual.enabled", "payments", SettingValueType.BOOLEAN, false],
  ["checkout.platform_fee.enabled", "checkout", SettingValueType.BOOLEAN, false],
  ["checkout.platform_fee.type", "checkout", SettingValueType.STRING, "PERCENTAGE"],
  ["checkout.platform_fee.value_bps", "checkout", SettingValueType.NUMBER, 0],
  ["checkout.platform_fee.fixed_paise", "checkout", SettingValueType.NUMBER, 0],
  ["shipping.default_charge_paise", "shipping", SettingValueType.NUMBER, 0],
  ["seller.commission.default_type", "commissions", SettingValueType.STRING, "MANUAL"],
  ["seller.commission.default_value", "commissions", SettingValueType.NUMBER, 0],
] as const;

const defaultSubscriptionPlans = [
  {
    code: "STARTER_FREE",
    name: "Starter Free",
    description:
      "Default onboarding plan for new sellers. Suitable for basic catalogue setup and manual marketplace approval.",
    pricePaise: 0,
    currency: "INR",
    billingCycle: SellerSubscriptionBillingCycle.MONTHLY,
    productLimit: 25,
    featuredProductLimit: 0,
    b2bEnquiryLimit: 25,
    commissionDiscountBps: 0,
    isDefault: true,
    isActive: true,
    sortOrder: 10,
  },
  {
    code: "GROWTH_MONTHLY",
    name: "Growth Monthly",
    description:
      "Operational plan for sellers that need more catalogue capacity and B2B enquiry handling.",
    pricePaise: 99900,
    currency: "INR",
    billingCycle: SellerSubscriptionBillingCycle.MONTHLY,
    productLimit: 250,
    featuredProductLimit: 5,
    b2bEnquiryLimit: 250,
    commissionDiscountBps: 0,
    isDefault: false,
    isActive: true,
    sortOrder: 20,
  },
  {
    code: "PRO_YEARLY",
    name: "Pro Yearly",
    description: "Higher-capacity seller plan for established marketplace sellers, hyperlocal store chains, and wholesale distributors.",
    pricePaise: 999900,
    currency: "INR",
    billingCycle: SellerSubscriptionBillingCycle.YEARLY,
    productLimit: 1000,
    featuredProductLimit: 25,
    b2bEnquiryLimit: null,
    commissionDiscountBps: 0,
    isDefault: false,
    isActive: true,
    sortOrder: 30,
  },
] as const;

const seedModes = ["schema", "system", "bootstrap"] as const;
type SeedMode = (typeof seedModes)[number];

function readSeedMode(): SeedMode {
  const modeArgIndex = process.argv.findIndex((arg) => arg === "--mode");
  const explicitMode =
    process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ??
    (modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : undefined) ??
    (process.argv.includes("--system") ? "system" : undefined) ??
    (process.argv.includes("--bootstrap") ? "bootstrap" : undefined) ??
    (process.argv.includes("--schema") ? "schema" : undefined) ??
    process.env.INDIHUB_SEED_MODE ??
    "schema";

  const normalizedMode = explicitMode.trim().toLowerCase();
  if (seedModes.includes(normalizedMode as SeedMode)) {
    return normalizedMode as SeedMode;
  }

  throw new Error(
    `Invalid seed mode "${explicitMode}". Use one of: ${seedModes.join(", ")}. Default mode is schema, which performs no writes.`,
  );
}

function isProductionLikeEnvironment() {
  return (
    process.env.NODE_ENV === "production" ||
    isProtectedDeploymentEnv(process.env.VERCEL_ENV) ||
    isProtectedDeploymentEnv(process.env.INDIHUB_ENV) ||
    process.env.INDIHUB_PRODUCTION === "true" ||
    process.env.INDIHUB_STAGING === "true" ||
    process.env.INDIHUB_PREPRODUCTION === "true"
  );
}

function isProtectedDeploymentEnv(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ["production", "prod", "staging", "stage", "preproduction", "preprod", "uat"].includes(
    value.toLowerCase().replace(/[^a-z0-9]+/g, ""),
  );
}

function assertSeedWritesAllowed(mode: SeedMode) {
  if (mode === "schema") {
    return;
  }

  if (isProductionLikeEnvironment() && process.env.INDIHUB_ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      `Refusing to run "${mode}" seed in a production/staging/pre-production-like environment. ` +
        "Run schema/migrations separately, or set INDIHUB_ALLOW_PRODUCTION_SEED=true only for an approved one-time bootstrap.",
    );
  }
}

async function main() {
  const seedMode = readSeedMode();
  assertSeedWritesAllowed(seedMode);

  if (seedMode === "schema") {
    await verifySchemaOnly();
    return;
  }

  await seedSystemReferenceData();

  if (seedMode === "system") {
    console.log(
      "Seed mode system completed. Only RBAC system reference rows were created or updated.",
    );
    return;
  }

  await seedBootstrapData();
  console.log(
    "Seed mode bootstrap completed. Default bootstrap content/settings were created only where missing.",
  );
}

async function verifySchemaOnly() {
  await prisma.role.count();
  console.log(
    "Seed mode schema completed. Database schema is reachable; no data was created or updated.",
  );
}

async function seedSystemReferenceData() {
  for (const role of roleSeeds) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
      },
      create: role,
    });
  }

  for (const [code, name, module] of permissionSeeds) {
    await prisma.permission.upsert({
      where: { code },
      update: { name, module },
      create: { code, name, module },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } });
  const sellerRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SELLER } });
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.CUSTOMER } });
  const businessBuyerRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.BUSINESS_BUYER },
  });
  const financeRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.FINANCE } });
  const adminPermissions = await prisma.permission.findMany();

  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const code of [
    "seller.product.manage",
    "seller.order.manage",
    "seller.b2b.respond",
    "product.read",
  ]) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: sellerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: sellerRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const code of ["customer.account.manage", "cart.manage", "order.place", "product.read"]) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: customerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: customerRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const code of ["b2b.profile.manage", "b2b.enquiry.manage", "product.read"]) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: businessBuyerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: businessBuyerRole.id,
        permissionId: permission.id,
      },
    });
  }

  for (const code of ["finance.workspace.manage", "payments.manage", "reports.read"]) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: financeRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: financeRole.id,
        permissionId: permission.id,
      },
    });
  }
}

async function seedBootstrapData() {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.ADMIN } });
  const productTemplateIds = await seedBootstrapProductTemplates();

  for (const page of cmsPages) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        content: page.content,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  for (const [slug, name] of defaultCategories) {
    const templateId = productTemplateIds.get(defaultCategoryTemplateCodes[slug]) ?? productTemplateIds.get("STANDARD");
    const taxProfile = defaultCategoryTaxProfiles[slug];
    await prisma.category.upsert({
      where: { slug },
      update: {
        name,
        status: CategoryStatus.ACTIVE,
        ...(taxProfile
          ? {
              defaultHsnCode: taxProfile.defaultHsnCode,
              defaultGstRatePercent: taxProfile.defaultGstRatePercent,
              defaultTaxDescription: taxProfile.defaultTaxDescription,
            }
          : {}),
      },
      create: {
        slug,
        name,
        status: CategoryStatus.ACTIVE,
        ...(taxProfile
          ? {
              defaultHsnCode: taxProfile.defaultHsnCode,
              defaultGstRatePercent: taxProfile.defaultGstRatePercent,
              defaultTaxDescription: taxProfile.defaultTaxDescription,
            }
          : {}),
        ...(templateId ? { productTemplateId: templateId } : {}),
      },
    });

    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, productTemplateId: true },
    });
    if (category && !category.productTemplateId && templateId) {
      await prisma.category.update({
        where: { id: category.id },
        data: { productTemplateId: templateId },
      });
    }
    if (category && taxProfile) {
      await prisma.hsnMaster.upsert({
        where: {
          hsnCode_categoryId: {
            hsnCode: taxProfile.defaultHsnCode,
            categoryId: category.id,
          },
        },
        update: {
          description: taxProfile.defaultTaxDescription,
          gstRatePercent: taxProfile.defaultGstRatePercent,
          isActive: true,
        },
        create: {
          hsnCode: taxProfile.defaultHsnCode,
          description: taxProfile.defaultTaxDescription,
          gstRatePercent: taxProfile.defaultGstRatePercent,
          categoryId: category.id,
          isActive: true,
        },
      });
    }
  }

  await seedBootstrapCmsMenus();

  for (const templateSeed of emailTemplates) {
    const existingTemplate = await prisma.notificationTemplate.findUnique({
      where: { code: templateSeed.code },
    });

    if (existingTemplate) {
      await prisma.notificationTemplate.update({
        where: { code: templateSeed.code },
        data: {
          name: existingTemplate.name || templateSeed.name,
          category:
            existingTemplate.category === EmailTemplateCategory.SYSTEM
              ? templateSeed.category
              : existingTemplate.category,
        },
      });
    } else {
      await prisma.notificationTemplate.create({
        data: {
          code: templateSeed.code,
          name: templateSeed.name,
          category: templateSeed.category,
          channel: NotificationChannel.EMAIL,
          subject: templateSeed.subject,
          body: `Hello, this is a 1HandIndia notification for ${templateSeed.subject}.`,
          status: ContentStatus.PUBLISHED,
        },
      });
    }
  }

  for (const [eventCode, recipientType, category, defaultTemplateCode] of emailTriggerRules) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { code: defaultTemplateCode },
      select: { id: true },
    });

    await prisma.emailTriggerRule.upsert({
      where: {
        eventCode_recipientType: {
          eventCode,
          recipientType,
        },
      },
      update: {
        category,
      },
      create: {
        eventCode,
        recipientType,
        category,
        isEnabled: true,
        delayMinutes: 0,
        ...(template ? { template: { connect: { id: template.id } } } : {}),
      },
    });
  }

  for (const [key, group, valueType, value] of defaultSettings) {
    await prisma.setting.upsert({
      where: { key },
      update: {
        group,
        valueType,
      },
      create: {
        key,
        group,
        valueType,
        value,
      },
    });
  }

  await seedSellerSubscriptionPlans();

  await seedLocationBootstrap();

  await prisma.emailSetting.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      provider: "smtp",
      senderName: "1HandIndia",
      senderEmail: "no-reply@example.com",
      adminRecipients: null,
      isEnabled: false,
      providerConfig: {},
    },
  });

  const firstAdminEmail = process.env.INDIHUB_FIRST_ADMIN_EMAIL;
  const firstAdminPassword = process.env.INDIHUB_FIRST_ADMIN_PASSWORD;
  const firstAdminName = process.env.INDIHUB_FIRST_ADMIN_NAME ?? "1HandIndia Admin";

  if (firstAdminEmail) {
    const firstAdmin = await prisma.user.upsert({
      where: { email: firstAdminEmail },
      update: {
        fullName: firstAdminName,
        status: UserStatus.ACTIVE,
      },
      create: {
        email: firstAdminEmail,
        fullName: firstAdminName,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: firstAdmin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: firstAdmin.id,
        roleId: adminRole.id,
      },
    });

    if (firstAdminPassword) {
      const hashed = await hashAdminPassword(firstAdminPassword);
      await prisma.adminCredential.upsert({
        where: { userId: firstAdmin.id },
        update: {
          passwordHash: hashed.hash,
          passwordSalt: hashed.salt,
          passwordAlgorithm: "scrypt",
          passwordUpdatedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
        create: {
          userId: firstAdmin.id,
          passwordHash: hashed.hash,
          passwordSalt: hashed.salt,
          passwordAlgorithm: "scrypt",
        },
      });
    }
  }
}

function productField(
  label: string,
  fieldKey: string,
  fieldType: ProductAttributeFieldType,
  options: {
    required?: boolean;
    options?: string[];
    placeholder?: string;
    helpText?: string;
    filterable?: boolean;
    searchable?: boolean;
  } = {},
) {
  return templateField(label, fieldKey, fieldType, ProductAttributeScope.PRODUCT, options);
}

function variantField(
  label: string,
  fieldKey: string,
  fieldType: ProductAttributeFieldType,
  options: {
    required?: boolean;
    options?: string[];
    placeholder?: string;
    helpText?: string;
    filterable?: boolean;
    searchable?: boolean;
  } = {},
) {
  return templateField(label, fieldKey, fieldType, ProductAttributeScope.VARIANT, options);
}

function templateField(
  label: string,
  fieldKey: string,
  fieldType: ProductAttributeFieldType,
  scope: ProductAttributeScope,
  options: {
    required?: boolean;
    options?: string[];
    placeholder?: string;
    helpText?: string;
    filterable?: boolean;
    searchable?: boolean;
  },
) {
  return {
    label,
    fieldKey,
    fieldType,
    scope,
    isRequired: Boolean(options.required),
    options: options.options ?? [],
    placeholder: options.placeholder,
    helpText: options.helpText,
    isFilterable: Boolean(options.filterable),
    isSearchable: Boolean(options.searchable),
  };
}

async function seedBootstrapProductTemplates() {
  const templateIds = new Map<string, string>();

  for (const templateSeed of productTemplateSeeds) {
    const existing = await prisma.productTemplate.findUnique({
      where: { code: templateSeed.code },
      select: { id: true, status: true },
    });

    const template = existing
      ? await prisma.productTemplate.update({
          where: { id: existing.id },
          data: {
            name: templateSeed.name,
            description: templateSeed.description,
            listingMode: templateSeed.listingMode,
            sortOrder: templateSeed.sortOrder,
            status:
              existing.status === ProductTemplateStatus.ARCHIVED
                ? ProductTemplateStatus.ARCHIVED
                : ProductTemplateStatus.ACTIVE,
          },
          select: { id: true },
        })
      : await prisma.productTemplate.create({
          data: {
            code: templateSeed.code,
            name: templateSeed.name,
            description: templateSeed.description,
            listingMode: templateSeed.listingMode,
            sortOrder: templateSeed.sortOrder,
            status: ProductTemplateStatus.ACTIVE,
          },
          select: { id: true },
        });

    templateIds.set(templateSeed.code, template.id);

    for (const [index, field] of templateSeed.fields.entries()) {
      await prisma.productTemplateField.upsert({
        where: {
          productTemplateId_fieldKey_scope: {
            productTemplateId: template.id,
            fieldKey: field.fieldKey,
            scope: field.scope,
          },
        },
        update: {
          label: field.label,
          fieldType: field.fieldType,
          isRequired: field.isRequired,
          options: field.options,
          placeholder: field.placeholder ?? null,
          helpText: field.helpText ?? null,
          isFilterable: field.isFilterable,
          isSearchable: field.isSearchable,
          sortOrder: index * 10,
        },
        create: {
          productTemplateId: template.id,
          label: field.label,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          scope: field.scope,
          isRequired: field.isRequired,
          options: field.options,
          placeholder: field.placeholder ?? null,
          helpText: field.helpText ?? null,
          isFilterable: field.isFilterable,
          isSearchable: field.isSearchable,
          sortOrder: index * 10,
        },
      });
    }
  }

  return templateIds;
}

async function seedBootstrapCmsMenus() {
  const headerRoots = new Map<string, { id: string; status: ContentStatus }>();

  for (const menuItem of defaultHeaderMenuItems) {
    const existing = await prisma.cmsMenuItem.findFirst({
      where: {
        area: "header",
        href: menuItem.href,
        parentId: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existing) {
      if (existing.status !== ContentStatus.ARCHIVED) {
        headerRoots.set(menuItem.href, existing);
      }
      continue;
    }

    const created = await prisma.cmsMenuItem.create({
      data: {
        area: "header",
        label: menuItem.label,
        href: menuItem.href,
        status: ContentStatus.PUBLISHED,
        sortOrder: menuItem.sortOrder,
      },
      select: {
        id: true,
        status: true,
      },
    });

    headerRoots.set(menuItem.href, created);
  }

  const categoriesRoot = headerRoots.get("/categories");
  if (!categoriesRoot) {
    return;
  }

  for (const [index, [slug, fallbackName]] of defaultCategories.entries()) {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        status: true,
        sortOrder: true,
      },
    });

    if (category?.status !== CategoryStatus.ACTIVE) {
      continue;
    }

    const href = `/categories/${category.slug}`;
    const existing = await prisma.cmsMenuItem.findFirst({
      where: {
        area: "header",
        href,
        parentId: categoriesRoot.id,
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.cmsMenuItem.create({
      data: {
        area: "header",
        label: category.name || fallbackName,
        href,
        parentId: categoriesRoot.id,
        status: ContentStatus.PUBLISHED,
        sortOrder: category.sortOrder || 100 + index * 10,
      },
    });
  }
}

async function seedSellerSubscriptionPlans() {
  for (const plan of defaultSubscriptionPlans) {
    if (plan.isDefault) {
      await prisma.sellerSubscriptionPlan.updateMany({
        where: {
          code: { not: plan.code },
        },
        data: {
          isDefault: false,
        },
      });
    }

    await prisma.sellerSubscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        pricePaise: plan.pricePaise,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        productLimit: plan.productLimit,
        featuredProductLimit: plan.featuredProductLimit,
        b2bEnquiryLimit: plan.b2bEnquiryLimit,
        commissionDiscountBps: plan.commissionDiscountBps,
        isDefault: plan.isDefault,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
  }

  const defaultPlan = await prisma.sellerSubscriptionPlan.findFirst({
    where: {
      isDefault: true,
      isActive: true,
    },
  });

  if (!defaultPlan) {
    return;
  }

  const sellersWithoutPlan = await prisma.seller.findMany({
    where: {
      subscriptionPlanId: null,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  for (const seller of sellersWithoutPlan) {
    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        subscriptionPlanId: defaultPlan.id,
        subscriptionStatus: SellerSubscriptionStatus.ACTIVE,
        subscriptionStartedAt: seller.createdAt,
      },
    });

    await prisma.sellerSubscription.create({
      data: {
        sellerId: seller.id,
        planId: defaultPlan.id,
        status: SellerSubscriptionStatus.ACTIVE,
        isCurrent: true,
        startedAt: seller.createdAt,
        note: "Default plan assigned by seed.",
      },
    });
  }
}

async function seedLocationBootstrap() {
  for (const countrySeed of bundledLocationDataset.countries) {
    await prisma.locationCountry.upsert({
      where: { code: countrySeed.code },
      update: {
        name: countrySeed.name,
        currency: countrySeed.currency,
        locale: countrySeed.locale,
        phoneCode: countrySeed.phoneCode,
        postalCodeLabel: countrySeed.postalCodeLabel,
        postalCodePattern: countrySeed.postalCodePattern,
        enabled: true,
        sortOrder: countrySeed.sortOrder,
      },
      create: {
        code: countrySeed.code,
        name: countrySeed.name,
        currency: countrySeed.currency,
        locale: countrySeed.locale,
        phoneCode: countrySeed.phoneCode,
        postalCodeLabel: countrySeed.postalCodeLabel,
        postalCodePattern: countrySeed.postalCodePattern,
        enabled: true,
        sortOrder: countrySeed.sortOrder,
      },
    });
  }

  await prisma.locationImportSource.upsert({
    where: { code: bundledLocationDataset.source.code },
    update: {
      name: bundledLocationDataset.source.name,
      provider: bundledLocationDataset.source.provider,
      sourceType: bundledLocationDataset.source.sourceType,
      countryCode: bundledLocationDataset.source.countryCode ?? null,
      sourceUrl: bundledLocationDataset.source.sourceUrl ?? null,
      licenseNote: bundledLocationDataset.source.licenseNote ?? null,
      enabled: true,
    },
    create: {
      code: bundledLocationDataset.source.code,
      name: bundledLocationDataset.source.name,
      provider: bundledLocationDataset.source.provider,
      sourceType: bundledLocationDataset.source.sourceType,
      countryCode: bundledLocationDataset.source.countryCode ?? null,
      sourceUrl: bundledLocationDataset.source.sourceUrl ?? null,
      licenseNote: bundledLocationDataset.source.licenseNote ?? null,
      enabled: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
