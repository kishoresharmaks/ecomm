"use client";

import Link from "next/link";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  ArrowRight,
  BadgePercent,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FolderOpen,
  KeyRound,
  Landmark,
  Mail,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserCog,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { Button, cn, StatusBadge, type StatusTone } from "@indihub/ui";
import {
  marketplaceProductAdminSummaryFields,
  marketplaceProductRequiredEssentialFields,
} from "@indihub/shared-types";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { EmailSettingsPanel } from "@/components/admin/admin-email-workspace";
import {
  AdminActionMenu,
  AdminConfirmationDialog as HeadlessAdminConfirmationDialog,
  AdminFilterPopover,
  AdminListbox,
  AdminPanel,
  AdminStatusNotice,
  AdminSwitch,
  AdminTabs,
  type AdminActionItem,
  type AdminSelectOption,
} from "@/components/admin/admin-ux";
import { CheckoutFeeSettings } from "@/components/admin/settings/checkout-fee-settings";
import { DeliveryPartnerPayoutSettings } from "@/components/admin/settings/delivery-partner-payout-settings";
import { MapRoutingSettings } from "@/components/admin/settings/map-routing-settings";
import { SellerPayoutSettings } from "@/components/admin/settings/seller-payout-settings";
import { readBooleanSettingValue } from "@/components/admin/settings/setting-value-utils";
import {
  roleRemovalHasBlockers,
  roleRemovalNoteError,
  visibleRoleRemovalCounts,
  type RoleRemovalImpact,
} from "@/components/admin/admin-role-removal-utils";
import { useLocationAreaStore, useLocationCatalog } from "@/components/locations/location-store";
import { formatLocalAreaLabel } from "@/components/locations/location-utils";
import { SellerImageUpload } from "@/components/seller/seller-ui";
import { IndihubApiError, indihubFetch, type IndihubAuthHeaders } from "@/lib/api";
import { resolveImageSource } from "@/lib/image-url";
import {
  type LocationArea,
  type LocationCity,
  type LocationCountry,
  type LocationSubdivision,
} from "@/lib/location-api";

const contentWorkflowStatusValues = ["DRAFT", "IN_REVIEW", "SCHEDULED", "PUBLISHED", "ARCHIVED"];
const bannerTextPositionValues = ["LEFT", "CENTER", "RIGHT"] as const;
const productTemplateStatusValues = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const productListingModeValues: ProductListingMode[] = ["CART", "CART_AND_ENQUIRY", "ENQUIRY_ONLY"];
const productTemplateFieldTypeValues: ProductTemplateFieldType[] = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "SELECT",
  "MULTI_SELECT",
  "BOOLEAN",
  "DATE",
];
const productTemplateFieldScopeValues: ProductTemplateFieldScope[] = ["PRODUCT", "VARIANT"];
const cmsMenuAreaOptions: AdminSelectOption[] = [
  { value: "header", label: "Header navigation" },
  { value: "footer", label: "Footer navigation" },
  { value: "legal", label: "Legal footer" },
  { value: "mobile", label: "Mobile shortcuts" },
];

type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type UserRecord = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  userRoles?: Array<{ role?: { code?: string; name?: string } }>;
  customer?: { id: string } | null;
  seller?: { id: string } | null;
  businessBuyer?: { id: string } | null;
  deliveryProfile?: DeliveryPartnerProfileRecord | null;
  activeWorkload?: number;
  pendingCodCashPaise?: number;
};

type DeliveryPartnerProfileRecord = {
  phone?: string | null;
  vehicleNumber?: string | null;
  isAvailable?: boolean;
  priority?: number;
  serviceCountryCode?: string | null;
  serviceStateCode?: string | null;
  serviceCityCode?: string | null;
  servicePincodes?: string[];
  serviceLocalAreaCodes?: string[];
  codCashLimitPaise?: number | null;
  notes?: string | null;
};

type CustomerRecord = {
  id: string;
  displayName?: string | null;
  status: string;
  createdAt?: string;
  user?: UserRecord;
  _count?: {
    addresses?: number;
    orders?: number;
  };
};

type SellerRecord = {
  id: string;
  storeName: string;
  slug: string;
  sellerType: string;
  status: string;
  approvalStatus: string;
  subscriptionStatus?: string;
  subscriptionPlan?: {
    id: string;
    name: string;
    code: string;
    pricePaise: number;
    currency: string;
    isDefault?: boolean;
  } | null;
  createdAt?: string;
  user?: UserRecord;
  profile?: {
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    logoUrl?: string | null;
    businessLegalName?: string | null;
    businessType?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
  } | null;
  documents?: Array<{
    id: string;
    documentType: string;
    fileUrl: string;
    status: string;
  }>;
  _count?: {
    products?: number;
    orderSplits?: number;
    b2bEnquiries?: number;
  };
};

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  approvalStatus: string;
  listingMode?: string;
  attributes?: Record<string, unknown> | null;
  hsnCode?: string | null;
  gstRatePercent?: number | string | null;
  hsnMaster?: HsnMasterRecord | null;
  createdAt?: string;
  category?: { name?: string | null; productTemplate?: ProductTemplateRecord | null } | null;
  seller?: SellerRecord | null;
  images?: Array<{ url: string; isPrimary?: boolean | null; sortOrder?: number | null }>;
  variants?: Array<{
    sku?: string | null;
    pricePaise: number;
    stockQuantity: number;
    status: string;
    attributes?: Record<string, unknown> | null;
  }>;
};

type HsnMasterRecord = {
  id: string;
  hsnCode: string;
  description: string;
  gstRatePercent: number | string;
  category?: { id: string; name: string; slug: string } | null;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  subtotalPaise: number;
  shippingPaise: number;
  platformFeePaise: number;
  totalPaise: number;
  currency: string;
  buyerCurrency?: string | null;
  buyerPlatformFeeMinor?: number | null;
  buyerTotalMinor?: number | null;
  buyerCountryCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
  customer?: { user?: UserRecord };
  items?: Array<{
    id: string;
    productNameSnapshot: string;
    quantity: number;
    lineTotalPaise: number;
    seller?: SellerRecord | null;
    product?: ProductRecord | null;
  }>;
  sellerSplits?: Array<{
    id: string;
    sellerStatus: string;
    sellerSubtotalPaise: number;
    seller?: SellerRecord | null;
  }>;
  shipments?: Array<{
    id: string;
    shipmentNumber: string;
    sellerId: string;
    seller?: SellerRecord | null;
    subtotalPaise: number;
    shippingPaise: number;
    codSurchargePaise?: number | null;
    deliveryMode: string;
    status: string;
    assignmentStatus?: string | null;
    partnerName?: string | null;
    partnerPhone?: string | null;
    deliveryPartnerUserId?: string | null;
    trackingReference?: string | null;
    courierProviderCode?: string | null;
    routingFailed?: boolean | null;
    routingFailureReason?: string | null;
    routingFailureNote?: string | null;
    routedAt?: string | null;
    routingFirstFailedAt?: string | null;
    routingLastAttemptAt?: string | null;
    routingRetryCount?: number | null;
    routingPermanentFailureAt?: string | null;
    routingSnapshot?: unknown;
    awbNumber?: string | null;
    courierTrackingStatus?: string | null;
    labelUrl?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    codCollectionStatus?: string | null;
    codCollectionSource?: string | null;
    codCollectedAmountPaise?: number | null;
    courierShipment?: {
      id: string;
      providerCode: string;
      providerOrderId?: string | null;
      awbNumber?: string | null;
      trackingStatus: string;
      trackingStatusLabel?: string | null;
      trackingUrl?: string | null;
      labelUrl?: string | null;
      bookedAt?: string | null;
      lastTrackedAt?: string | null;
    } | null;
    courierCodRemittance?: {
      id: string;
      providerCode: string;
      awbNumber?: string | null;
      expectedAmountPaise: number;
      collectedAmountPaise?: number | null;
      remittedAmountPaise?: number | null;
      remittanceReference?: string | null;
      reportReference?: string | null;
      status: string;
      notes?: string | null;
      verifiedAt?: string | null;
      verificationNote?: string | null;
    } | null;
  }>;
  payments?: Array<{
    id: string;
    provider: string;
    method: string;
    amountPaise: number;
    currency: string;
    status: string;
  }>;
  deliveryDetail?: {
    deliveryMode: string;
    partnerName?: string | null;
    partnerPhone?: string | null;
    deliveryPartnerUserId?: string | null;
    deliveryPartner?: UserRecord | null;
    courierProviderCode?: string | null;
    routingFailed?: boolean | null;
    routingFailureReason?: string | null;
    routingFailureNote?: string | null;
    routedAt?: string | null;
    assignmentStatus?: string | null;
    assignedAt?: string | null;
    acceptedAt?: string | null;
    rejectedAt?: string | null;
    assignmentNote?: string | null;
    trackingReference?: string | null;
    estimatedDeliveryDate?: string | null;
    deliveryNote?: string | null;
    receiverName?: string | null;
    proofNote?: string | null;
    proofReference?: string | null;
    status: string;
    codCollectionStatus?: string | null;
    codCollectedAmountPaise?: number | null;
    codCollectedAt?: string | null;
    codCollectionNote?: string | null;
    codVerifiedAt?: string | null;
    codVerificationNote?: string | null;
    codCollectedBy?: UserRecord | null;
    codVerifiedBy?: UserRecord | null;
    events?: Array<{
      id: string;
      oldStatus?: string | null;
      newStatus: string;
      note?: string | null;
      createdAt?: string;
    }>;
    attempts?: Array<{
      id: string;
      reason: string;
      note?: string | null;
      attemptedAt?: string | null;
      nextAttemptDate?: string | null;
      createdAt?: string;
      createdBy?: UserRecord | null;
    }>;
  } | null;
  statusEvents?: Array<{
    id: string;
    statusType: string;
    oldStatus?: string | null;
    newStatus: string;
    note?: string | null;
    createdAt?: string;
  }>;
};

type DeliveryCodHandoverReport = {
  items: Array<{
    partner: UserRecord;
    codCashLimitPaise?: number | null;
    collectedAmountPaise: number;
    verifiedAmountPaise: number;
    rejectedAmountPaise: number;
    pendingAmountPaise: number;
  }>;
  totals: {
    collectedAmountPaise: number;
    verifiedAmountPaise: number;
    rejectedAmountPaise: number;
    pendingAmountPaise: number;
  };
};

type ShippingRateCardRecord = {
  id: string;
  name: string;
  deliveryMode: string;
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  pincode?: string | null;
  localAreaCode?: string | null;
  minSubtotalPaise?: number | null;
  maxSubtotalPaise?: number | null;
  shippingChargePaise: number;
  freeAbovePaise?: number | null;
  codSurchargeType: string;
  codSurchargeFlatPaise: number;
  codSurchargeBps: number;
  priority: number;
  isActive: boolean;
  notes?: string | null;
};

type ShippingRateCardResponse = {
  items: ShippingRateCardRecord[];
};

type CourierProviderRecord = {
  id: string;
  providerCode: string;
  displayName: string;
  mode: string;
  isActive: boolean;
  serviceableCountryCodes: string[];
  credentialsConfigured: boolean;
  webhookSecretConfigured: boolean;
  adapterCode?: string | null;
  apiBaseUrl?: string | null;
  bookingEndpointPath?: string | null;
  trackingEndpointPath?: string | null;
  labelEndpointPath?: string | null;
  cancellationEndpointPath?: string | null;
  accountCode?: string | null;
  username?: string | null;
  apiKeyConfigured?: boolean;
  apiSecretConfigured?: boolean;
  passwordConfigured?: boolean;
  defaultPackage?: {
    weightGrams?: number | null;
    lengthCm?: number | null;
    breadthCm?: number | null;
    heightCm?: number | null;
  } | null;
  liveApiCallsEnabled?: boolean;
  notes?: string | null;
};

type CourierProviderResponse = {
  items: CourierProviderRecord[];
};

type RateFormState = {
  name: string;
  deliveryMode: string;
  isActive: boolean;
  countryCode: string;
  stateCode: string;
  cityCode: string;
  pincode: string;
  localAreaCode: string;
  minSubtotalRupees: string;
  maxSubtotalRupees: string;
  shippingRupees: string;
  freeAboveRupees: string;
  codFlatRupees: string;
  priority: string;
};

type RateCardSaveVariables = {
  targetId: string | null;
};

type RateCardSaveResponse = {
  item?: {
    id?: string;
  };
};

type CourierProviderFormState = {
  providerCode: string;
  displayName: string;
  mode: string;
  isActive: boolean;
  serviceableCountries: string[];
  adapterCode: string;
  apiBaseUrl: string;
  bookingEndpointPath: string;
  trackingEndpointPath: string;
  labelEndpointPath: string;
  cancellationEndpointPath: string;
  accountCode: string;
  username: string;
  apiKey: string;
  apiSecret: string;
  password: string;
  webhookSecret: string;
  defaultPackageWeightGrams: string;
  defaultPackageLengthCm: string;
  defaultPackageBreadthCm: string;
  defaultPackageHeightCm: string;
  credentialsConfigured: boolean;
  webhookSecretConfigured: boolean;
  notes: string;
};

type RoutingSimulatorResult = {
  deliveryPreference: string;
  deliveryMode: string;
  recommendedPartnerName?: string | null;
  partnerMatchLabel?: string | null;
  courierProviderCode?: string | null;
  matchedRateCardName?: string | null;
  shippingChargePaise: number;
  codSurchargePaise: number;
  totalDeliveryChargePaise: number;
  freeShippingApplied: boolean;
  routingFailed: boolean;
  routingFailureReason?: string | null;
  routingFailureNote?: string | null;
  fallbackReason?: string | null;
  warnings: string[];
  shipmentQuotes?: Array<{
    sellerId: string;
    sellerType: string;
    subtotalPaise: number;
    deliveryMode: string;
    totalDeliveryChargePaise: number;
    routingFailed: boolean;
    routingFailureNote?: string | null;
  }>;
  shipmentShippingTotalPaise?: number;
};

type BusinessBuyerRecord = {
  id: string;
  companyName: string;
  gstNumber?: string | null;
  contactName: string;
  contactPhone: string;
  status: string;
  createdAt?: string;
  user?: UserRecord;
  _count?: { enquiries?: number };
};

type B2BEnquiryRecord = {
  id: string;
  quantity: number;
  message?: string | null;
  status: string;
  createdAt?: string;
  businessBuyer?: BusinessBuyerRecord | null;
  seller?: SellerRecord | null;
  product?: ProductRecord | null;
  responses?: Array<{
    id: string;
    responseMessage: string;
    quotedPricePaise?: number | null;
    createdAt?: string;
    responder?: UserRecord | null;
  }>;
};

type SupportRequestRecord = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: string;
  adminNote?: string | null;
  createdAt?: string;
  user?: UserRecord | null;
};

type NotificationRecord = {
  id: string;
  channel: string;
  templateCode: string;
  recipient: string;
  subject?: string | null;
  body?: string | null;
  variables?: Record<string, unknown> | null;
  status: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  user?: UserRecord | null;
};

type AuditLogRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  createdAt?: string;
  actor?: UserRecord | null;
};

type SettingRecord = {
  id: string;
  key: string;
  value: unknown;
  valueType: string;
  group: string;
  updatedAt?: string;
};

type CmsPageRecord = {
  id: string;
  slug: string;
  title: string;
  content?: string | null;
  status: string;
  publishedAt?: string | null;
  updatedAt?: string;
};

type BannerRecord = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  eyebrow?: string | null;
  ctaLabel?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryLinkUrl?: string | null;
  mobileImageUrl?: string | null;
  imageAlt?: string | null;
  textPosition?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

type HomepageSectionRecord = {
  id: string;
  title: string;
  sectionType: string;
  config?: Record<string, unknown> | null;
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

type SeoEntryRecord = {
  id: string;
  entityType: string;
  entityId?: string | null;
  routePath?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsDirective: string;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageUrl?: string | null;
  focusKeyword?: string | null;
  structuredDataType?: string | null;
  seoScore: number;
  status: string;
  updatedAt?: string;
};

type SeoOverviewRecord = {
  total: number;
  published: number;
  draft: number;
  inReview: number;
  scheduled: number;
  lowScore: number;
  redirects: number;
  media: number;
  duplicateCount: number;
  duplicates?: Array<{ field: string; value: string; count: number }>;
};

type CmsRedirectRecord = {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: number;
  enabled: boolean;
  note?: string | null;
  updatedAt?: string;
};

type CmsMediaAssetRecord = {
  id: string;
  title?: string | null;
  url: string;
  publicId?: string | null;
  mediaType: string;
  altText?: string | null;
  caption?: string | null;
  usageContext?: string | null;
  width?: number | null | undefined;
  height?: number | null | undefined;
  updatedAt?: string;
};

type CmsMenuItemRecord = {
  id: string;
  area: string;
  label: string;
  href: string;
  parentId?: string | null;
  parent?: { id: string; label: string; area: string } | null;
  children?: CmsMenuItemRecord[];
  status: string;
  sortOrder: number;
  updatedAt?: string;
};

type CmsRevisionRecord = {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  action: string;
  note?: string | null;
  createdAt?: string;
};

type CmsSitemapOverviewRecord = {
  generatedAt: string;
  totalEntries: number;
  seoEntries: number;
  redirects: number;
  excludedRoutePrefixes: string[];
  entries: Array<{ path: string; source: string; lastModified?: string; priority?: number }>;
  health: { status: string; warnings: string[] };
};

type CategoryRecord = {
  id: string;
  parentId?: string | null;
  productTemplateId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  defaultHsnCode?: string | null;
  defaultGstRatePercent?: number | string | null;
  defaultTaxDescription?: string | null;
  status: string;
  sortOrder: number;
  productTemplate?: ProductTemplateRecord | null;
  parent?: { name?: string | null } | null;
  _count?: { children?: number; products?: number };
};

type ProductListingMode = "CART" | "ENQUIRY_ONLY" | "CART_AND_ENQUIRY";
type ProductTemplateFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "SELECT"
  | "MULTI_SELECT"
  | "BOOLEAN"
  | "DATE";
type ProductTemplateFieldScope = "PRODUCT" | "VARIANT";

type ProductTemplateFieldRecord = {
  id?: string;
  productTemplateId?: string;
  label: string;
  fieldKey: string;
  fieldType: ProductTemplateFieldType;
  scope: ProductTemplateFieldScope;
  isRequired: boolean;
  options?: string[] | null;
  placeholder?: string | null;
  helpText?: string | null;
  isFilterable?: boolean;
  isSearchable?: boolean;
  sortOrder: number;
};

type ProductTemplateRecord = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  listingMode: ProductListingMode;
  sortOrder: number;
  fields?: ProductTemplateFieldRecord[];
  _count?: { categories?: number };
};

type ReportsOverview = {
  totals: {
    revenuePaise: number;
    subtotalPaise: number;
    shippingPaise: number;
    orderCount: number;
    customers: number;
    sellers: number;
    products: number;
    b2bEnquiries: number;
    supportRequests: number;
  };
  ordersByStatus: Array<{ orderStatus: string; _count: { _all: number } }>;
};

type ReportRangePreset = "all" | "7d" | "30d" | "90d" | "custom";

type ReportRangeState = {
  preset: ReportRangePreset;
  dateFrom: string;
  dateTo: string;
};

type CountAggregate = number | { _all?: number | null } | null | undefined;

type AdminPaymentReportRow = {
  status: string;
  provider: string;
  _sum?: { amountPaise?: number | null } | null;
  _count?: CountAggregate;
};

type AdminSalesReport = {
  summary: {
    totalPaise: number;
    subtotalPaise: number;
    shippingPaise: number;
    orderCount: number;
  };
  payments: AdminPaymentReportRow[];
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    totalPaise: number;
    currency?: string | null;
    createdAt?: string | null;
    customer?: { user?: { email?: string | null; fullName?: string | null } | null } | null;
  }>;
};

type AdminSellerReport = {
  summary: {
    pendingSellers: number;
    approvedSellers: number;
  };
  sellers: Array<{
    sellerId: string;
    storeName: string;
    orderCount: number;
    salesPaise: number;
  }>;
};

type AdminProductReport = {
  summary: {
    pendingProducts: number;
    activeProducts: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    salesPaise: number;
  }>;
  lowStockProducts: Array<{
    id: string;
    sku: string;
    variantName?: string | null;
    stockQuantity: number;
    product?: { name?: string | null } | null;
  }>;
};

type AdminEnquiryReport = {
  b2bByStatus: Array<{ status: string; _count?: CountAggregate }>;
  supportByStatus: Array<{ status: string; _count?: CountAggregate }>;
  recentB2B: Array<{
    id: string;
    status: string;
    quantity: number;
    createdAt?: string | null;
    businessBuyer?: { companyName?: string | null } | null;
    product?: { name?: string | null } | null;
    seller?: { storeName?: string | null } | null;
  }>;
  recentSupport: Array<{
    id: string;
    subject?: string | null;
    email?: string | null;
    status: string;
    createdAt?: string | null;
  }>;
};

type PaymentReadiness = {
  razorpay: { configured: boolean; enabled: boolean; mode?: string; keyIdPreview?: string | null };
  cod: { enabled: boolean; maxOrderPaise?: number };
  bankTransfer: { enabled: boolean; configured?: boolean; destinationPreview?: string | null };
  manual: { enabled: boolean };
  webhook: { configured: boolean };
};

type PaymentConfiguration = {
  razorpay: {
    enabled: boolean;
    mode: "TEST" | "LIVE";
    configured: boolean;
    keyIdConfigured: boolean;
    keyIdPreview?: string | null;
    keySecretConfigured: boolean;
    webhookSecretConfigured: boolean;
    webhookPath: string;
  };
  cod: {
    enabled: boolean;
    instructions: string;
    maxOrderPaise: number;
  };
  bankTransfer: {
    enabled: boolean;
    configured?: boolean;
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    branch?: string;
    upiId?: string;
    instructions?: string;
    referenceRequired?: boolean;
  };
  manual: {
    enabled: boolean;
  };
};

type PaymentConfigurationFormState = {
  razorpayEnabled: boolean;
  razorpayMode: "TEST" | "LIVE";
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  clearRazorpayKeySecret: boolean;
  clearRazorpayWebhookSecret: boolean;
  codEnabled: boolean;
  codInstructions: string;
  codMaxOrderRupees: string;
  bankTransferEnabled: boolean;
  bankTransferAccountHolderName: string;
  bankTransferBankName: string;
  bankTransferAccountNumber: string;
  bankTransferIfscCode: string;
  bankTransferBranch: string;
  bankTransferUpiId: string;
  bankTransferInstructions: string;
  bankTransferReferenceRequired: boolean;
  manualEnabled: boolean;
};

type StorageReadiness = {
  publicImages?: {
    provider: PublicImageProvider;
    configured: boolean;
    baseUrl?: string | null;
    imageKitPublicKeyPreview?: string | null;
    s3Bucket?: string | null;
    s3Endpoint?: string | null;
    s3AccessKeyPreview?: string | null;
  };
  privateStorage: {
    enabled: boolean;
    configured: boolean;
    endpoint?: string | null;
    region?: string | null;
    bucket?: string | null;
    accessKeyPreview?: string | null;
  };
};

type PublicImageProvider = "IMAGEKIT" | "S3";

function publicImageProviderLabel(provider: PublicImageProvider | null | undefined) {
  return provider === "S3" ? "S3-compatible bucket" : "ImageKit";
}

type StorageConfiguration = {
  publicImages: {
    provider: PublicImageProvider;
    configured: boolean;
    baseUrl: string;
    imageKit: {
      configured: boolean;
      publicKey: string;
      publicKeyConfigured: boolean;
      publicKeyPreview?: string | null;
      privateKeyConfigured: boolean;
    };
    s3: {
      configured: boolean;
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      accessKeyIdConfigured: boolean;
      accessKeyPreview?: string | null;
      secretAccessKeyConfigured: boolean;
    };
  };
  privateStorage: {
    enabled: boolean;
    configured: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    accessKeyIdConfigured: boolean;
    accessKeyPreview?: string | null;
    secretAccessKeyConfigured: boolean;
  };
};

type StorageConfigurationFormState = {
  imageKitPublicKey: string;
  imageKitPrivateKey: string;
  clearImageKitPrivateKey: boolean;
  publicImageProvider: PublicImageProvider;
  publicImageBaseUrl: string;
  publicS3Endpoint: string;
  publicS3Region: string;
  publicS3Bucket: string;
  publicS3AccessKeyId: string;
  publicS3SecretAccessKey: string;
  clearPublicS3SecretAccessKey: boolean;
  privateEnabled: boolean;
  privateEndpoint: string;
  privateRegion: string;
  privateBucket: string;
  privateAccessKeyId: string;
  privateSecretAccessKey: string;
  clearPrivateSecretAccessKey: boolean;
};

type TableColumn<T> = {
  header: string;
  className?: string;
  cell: (item: T) => ReactNode;
};

const userStatuses = ["ACTIVE", "PENDING", "DISABLED"] as const;
type UserStatusValue = (typeof userStatuses)[number];
type UserStatusFilter = "ALL" | UserStatusValue;
const userStatusFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All status" },
  ...userStatuses.map((status) => ({ value: status, label: humanize(status) })),
];
type CustomerStatusFilter = "ALL" | "ACTIVE" | "PENDING" | "DISABLED";
const customerStatusFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All status" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "DISABLED", label: "Disabled" },
];
type CustomerActivityFilter =
  | "ALL"
  | "WITH_ORDERS"
  | "NO_ORDERS"
  | "WITH_ADDRESSES"
  | "NO_ADDRESSES";
const customerActivityFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All activity" },
  { value: "WITH_ORDERS", label: "With orders" },
  { value: "NO_ORDERS", label: "No orders" },
  { value: "WITH_ADDRESSES", label: "With addresses" },
  { value: "NO_ADDRESSES", label: "No addresses" },
];
const roleCodes = [
  "CUSTOMER",
  "SELLER",
  "BUSINESS_BUYER",
  "ADMIN",
  "SUPPORT_STAFF",
  "DELIVERY_PARTNER",
  "FINANCE",
  "COURIER_MANAGER",
] as const;
type PlatformRoleCode = (typeof roleCodes)[number];
type UserRoleFilter = "ALL" | PlatformRoleCode;
const userRoleFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All roles" },
  ...roleCodes.map((roleCode) => ({ value: roleCode, label: humanize(roleCode) })),
];
type UserProfileFilter = "ALL" | "CUSTOMER" | "SELLER" | "BUSINESS_BUYER";
const userProfileFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All profiles" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "SELLER", label: "Seller" },
  { value: "BUSINESS_BUYER", label: "B2B buyer" },
];
const orderStatuses = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED", "NOT_REQUIRED"];
const deliveryStatuses = [
  "NOT_ASSIGNED",
  "PENDING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];
const deliveryModeOptions: AdminSelectOption[] = [
  {
    value: "STORE_PICKUP",
    label: "Store pickup",
    description: "Customer collects from the seller or store after pickup confirmation.",
  },
  {
    value: "LOCAL_DELIVERY_PARTNER",
    label: "Local delivery partner (auto assign)",
    description: "Internal delivery partner assignment and accept/reject workflow.",
  },
  {
    value: "THIRD_PARTY_COURIER",
    label: "Courier service",
    description: "External courier services configured from Courier integrations.",
  },
  {
    value: "MANUAL_TRANSPORT",
    label: "Manual transport",
    description: "Offline transport coordination for bulky or wholesale packages.",
  },
];
const shippingRateModeOptions: AdminSelectOption[] = [
  {
    value: "LOCAL_DELIVERY_PARTNER",
    label: "Local delivery partner",
    description: "Used when checkout can route to an internal/local delivery partner.",
  },
  {
    value: "THIRD_PARTY_COURIER",
    label: "Third-party courier",
    description: "Used when checkout falls back to an admin-configured courier provider.",
  },
  {
    value: "MANUAL_TRANSPORT",
    label: "Manual transport",
    description: "Optional pricing rule for offline bulky or wholesale transport.",
  },
];
const courierProviderModeOptions: AdminSelectOption[] = [
  {
    value: "MANUAL",
    label: "Manual/provider-ready",
    description: "Routes orders to this provider without live booking calls.",
  },
  {
    value: "SANDBOX",
    label: "Sandbox",
    description: "Reserved for provider test API integration.",
  },
  {
    value: "LIVE",
    label: "Live",
    description: "Use only after live API credentials and webhook are configured.",
  },
];
const deliveryPartnerUnassignedValue = "__UNASSIGNED__";
const b2bManualAdminStatuses = ["IN_REVIEW", "CLOSED", "CANCELLED"];
const supportStatuses = ["OPEN", "IN_REVIEW", "RESPONDED", "CLOSED"];
const notificationStatuses = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
type NotificationStatusFilter = "ALL" | (typeof notificationStatuses)[number];
const notificationStatusFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All delivery status" },
  ...notificationStatuses.map((status) => ({ value: status, label: humanize(status) })),
];
const notificationTemplateCodes = [
  "CUSTOMER_ACCOUNT_CREATED",
  "SELLER_REGISTRATION_RECEIVED",
  "SELLER_APPROVED",
  "SELLER_REJECTED",
  "PRODUCT_SUBMITTED",
  "PRODUCT_APPROVED",
  "PRODUCT_REJECTED",
  "ORDER_PLACED_CUSTOMER",
  "ORDER_RECEIVED_SELLER",
  "ORDER_ALERT_ADMIN",
  "PAYMENT_PENDING",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_DISPATCHED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "DELIVERY_ASSIGNED_PARTNER",
  "DELIVERY_ASSIGNMENT_ACCEPTED_ADMIN",
  "DELIVERY_ASSIGNMENT_REJECTED_ADMIN",
  "DELIVERY_COD_COLLECTED_ADMIN",
  "B2B_ENQUIRY_SUBMITTED",
  "B2B_ENQUIRY_ALERT",
  "B2B_ENQUIRY_RESPONSE",
  "SUPPORT_REQUEST_RECEIVED",
  "SUPPORT_REQUEST_ALERT",
] as const;
type NotificationTemplateFilter = "ALL" | (typeof notificationTemplateCodes)[number];
const notificationTemplateFilterOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All templates" },
  ...notificationTemplateCodes.map((code) => ({ value: code, label: humanize(code) })),
];
type DeliveryFormState = {
  status: string;
  deliveryMode: string;
  deliveryPartnerUserId: string;
  partnerName: string;
  partnerPhone: string;
  trackingReference: string;
  estimatedDeliveryDate: string;
  deliveryNote: string;
  receiverName: string;
  proofNote: string;
  proofReference: string;
};
const databaseManagedConfigGroups = [
  {
    title: "Checkout and payments",
    detail:
      "Razorpay keys, webhook secret, COD, bank transfer, manual payment, and buyer platform fee.",
  },
  {
    title: "Email delivery",
    detail:
      "Provider choice, SMTP or API credentials, sender identity, admin recipients, templates, themes, and triggers.",
  },
  {
    title: "Storage providers",
    detail:
      "ImageKit or S3 public image settings plus optional private S3-compatible document storage.",
  },
  {
    title: "Seller finance",
    detail:
      "Manual payout request availability, minimum request value, commission rules, settlements, and payout records.",
  },
  {
    title: "Operational content",
    detail:
      "CMS pages, homepage banners, locations, categories, reports, audit records, and support workflows.",
  },
] as const;
const environmentOnlyConfigGroups = [
  {
    title: "Database and runtime URLs",
    keys: [
      "DATABASE_URL",
      "API_PORT",
      "API_CORS_ORIGINS",
      "NEXT_PUBLIC_WEB_URL",
      "NEXT_PUBLIC_API_URL",
    ],
    detail: "Required before the API and web app can start.",
  },
  {
    title: "Authentication bootstrap",
    keys: [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "CLERK_JWT_KEY",
      "CLERK_WEBHOOK_SECRET",
      "INDIHUB_FIRST_ADMIN_EMAIL",
      "INDIHUB_FIRST_ADMIN_PASSWORD",
      "INDIHUB_AUTH_SYNC_SECRET",
      "INDIHUB_BOOTSTRAP_SECRET",
    ],
    detail: "Needed for Clerk verification, first admin setup, and protected bootstrap actions.",
  },
  {
    title: "Queues and seed safety",
    keys: ["REDIS_URL", "INDIHUB_SEED_MODE", "INDIHUB_ENV", "INDIHUB_ALLOW_PRODUCTION_SEED"],
    detail: "Controls delayed jobs, worker queues, and safe database bootstrap behavior.",
  },
  {
    title: "Optional runtime integrations",
    keys: [
      "SENTRY_DSN",
      "DATAGOVINDIA_API_KEY",
      "FX_PROVIDER",
      "FX_BASE_CURRENCY",
      "FX_CACHE_TTL_MINUTES",
    ],
    detail:
      "Used by observability, location import, or FX reference-rate services when those integrations are enabled.",
  },
] as const;
const deliveryTextFields: Array<[keyof DeliveryFormState, string, string?]> = [
  ["partnerName", "Courier or partner name"],
  ["partnerPhone", "Partner phone"],
  ["trackingReference", "Tracking reference", "Auto-generated on partner assignment if left blank"],
  ["estimatedDeliveryDate", "Estimated delivery date"],
  ["deliveryNote", "Delivery note"],
  ["receiverName", "Receiver name"],
  ["proofNote", "Proof note"],
  ["proofReference", "Proof reference"],
];
const reportRangePresets: Array<{ value: ReportRangePreset; label: string; days?: number }> = [
  { value: "all", label: "All time" },
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
];
const reportChartColors = ["#ED3500", "#163B5C", "#0F8A5F", "#F59E0B", "#0EA5E9", "#7C3AED"];
const cmsPageTextFields: Array<[keyof Pick<CmsPageCreateFormState, "title" | "slug">, string]> = [
  ["title", "Title"],
  ["slug", "Slug"],
];
const homepageSectionTypeOptions: AdminSelectOption[] = [
  {
    value: "featured_categories",
    label: "Featured categories",
    description: "Category cards for the homepage.",
  },
  {
    value: "featured_products",
    label: "Featured products",
    description: "A product collection selected for promotion.",
  },
  {
    value: "featured_stores",
    label: "Featured stores",
    description: "Approved seller stores selected for the homepage.",
  },
  {
    value: "deal_strip",
    label: "Deal strip",
    description: "Short promotional row with a call to action.",
  },
  {
    value: "seller_cta",
    label: "Seller CTA",
    description: "Become-a-seller homepage callout with managed benefit cards.",
  },
  {
    value: "service_badges",
    label: "Service badges",
    description: "Small footer/storefront trust and service badges.",
  },
  {
    value: "trust_highlights",
    label: "Trust highlights",
    description: "Service, safety, delivery, or marketplace proof points.",
  },
  {
    value: "custom_links",
    label: "Custom links",
    description: "Manual links for campaigns, stores, or landing pages.",
  },
];
const homepageSectionKnownConfigKeys = new Set([
  "eyebrow",
  "subtitle",
  "description",
  "ctaLabel",
  "ctaUrl",
  "ctaHref",
  "startsAt",
  "endsAt",
  "timerEndsAt",
  "items",
]);
const emptyHomepageSectionDataSources: HomepageSectionDataSources = {
  categories: [],
  products: [],
  sellers: [],
  isLoading: false,
};

type CmsPageCreateFormState = {
  title: string;
  slug: string;
  content: string;
  status: string;
};

type BannerCreateFormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  eyebrow: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  secondaryLinkUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  textPosition: string;
  startsAt: string;
  endsAt: string;
  status: string;
  sortOrder: string;
};

type HomepageSectionCreateFormState = {
  sectionType: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  startsAt: string;
  endsAt: string;
  items: HomepageSectionItemFormState[];
  status: string;
  sortOrder: string;
  extraConfig: Record<string, unknown>;
};

type HomepageSectionItemFormState = {
  label: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  badge: string;
  sourceType: string;
  sourceId: string;
  slug: string;
};

type HomepageSectionDataSources = {
  categories: CategoryRecord[];
  products: ProductRecord[];
  sellers: SellerRecord[];
  isLoading: boolean;
};

type HomepageSectionDynamicOption = {
  sourceType: string;
  sourceId: string;
  slug: string;
  label: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  badge: string;
};

type ContentEditRequest =
  | { kind: "page"; item: CmsPageRecord }
  | { kind: "banner"; item: BannerRecord }
  | { kind: "section"; item: HomepageSectionRecord };

type RoleRemovalDialogRequest = {
  user: UserRecord;
  roleCode: PlatformRoleCode;
};

export function AdminCustomersPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("ALL");
  const [activityFilter, setActivityFilter] = useState<CustomerActivityFilter>("ALL");
  const confirmation = useAdminConfirmation();
  const query = useAdminList<CustomerRecord>(
    "admin-customers",
    "/api/admin/customers",
    auth.authHeaders,
    search,
  );
  const updateStatus = useMutation({
    mutationFn: ({ customerId, status }: { customerId: string; status: string }) =>
      adminRequest(`/api/admin/customers/${customerId}/status`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ status, note: "Updated from admin customer console." }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-customers"] }),
  });
  const items = listItems(query.data);
  const requestStatusUpdate = (customerId: string, status: string) => {
    const customer = items.find((item) => item.id === customerId);
    if (status === "DISABLED") {
      confirmation.requestConfirmation({
        title: "Disable customer account?",
        description: `${customer ? customerName(customer) : "This customer"} will be blocked from customer marketplace activity until an admin marks the account active again.`,
        confirmLabel: "Disable customer",
        onConfirm: () => updateStatus.mutate({ customerId, status }),
      });
      return;
    }
    updateStatus.mutate({ customerId, status });
  };

  return (
    <AdminResourceChrome
      title="Customer accounts"
      description="Review customer identity, order readiness, addresses, and account status."
      icon={<UsersRound className="h-5 w-5" />}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      {confirmation.dialog}
      <CustomerAccountsTable
        customers={items}
        isLoading={query.isLoading}
        total={totalItems(query.data, items.length)}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        activityFilter={activityFilter}
        setActivityFilter={setActivityFilter}
        onStatus={requestStatusUpdate}
        disabled={updateStatus.isPending}
      />
    </AdminResourceChrome>
  );
}

export function AdminUsersPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("ALL");
  const [profileFilter, setProfileFilter] = useState<UserProfileFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleRemovalRequest, setRoleRemovalRequest] =
    useState<RoleRemovalDialogRequest | null>(null);
  const [roleRemovalNote, setRoleRemovalNote] = useState("");
  const confirmation = useAdminConfirmation();
  const query = useAdminList<UserRecord>(
    "admin-users",
    "/api/admin/users",
    auth.authHeaders,
    search,
    "search",
    {
      roleCode: roleFilter === "ALL" ? undefined : roleFilter,
      profile: profileFilter === "ALL" ? undefined : profileFilter,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    },
    page,
    pageSize,
  );
  const updateStatus = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      adminRequest(`/api/admin/users/${userId}/status`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ status, note: "Updated from admin user console." }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const updateRole = useMutation({
    mutationFn: ({
      userId,
      roleCode,
      action,
      note,
    }: {
      userId: string;
      roleCode: PlatformRoleCode;
      action: "add" | "remove";
      note?: string | undefined;
    }) =>
      adminRequest(
        `/api/admin/users/${userId}/roles${action === "remove" ? "/remove" : ""}`,
        auth.authHeaders,
        {
          method: action === "remove" ? "PATCH" : "POST",
          body: JSON.stringify({
            roleCode,
            note: note?.trim() || "Updated from admin role console.",
          }),
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const previewRoleRemoval = useMutation({
    mutationFn: ({ userId, roleCode }: { userId: string; roleCode: PlatformRoleCode }) =>
      adminRequest<RoleRemovalImpact>(
        `/api/admin/users/${userId}/roles/${roleCode}/removal-impact`,
        auth.authHeaders,
      ),
  });
  const setBackOfficePassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminRequest(`/api/admin/users/${userId}/backoffice-password`, auth.authHeaders, {
        method: "PUT",
        body: JSON.stringify({ password, note: "Credential updated from admin user console." }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const updateDeliveryProfile = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Record<string, string> }) =>
      adminRequest(`/api/admin/users/${userId}/delivery-profile`, auth.authHeaders, {
        method: "PUT",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const items = listItems(query.data);
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, profileFilter, statusFilter, pageSize]);
  const requestUserStatus = (userId: string, status: string) => {
    const user = items.find((item) => item.id === userId);
    if (status === "DISABLED") {
      confirmation.requestConfirmation({
        title: "Disable platform user?",
        description: `${user?.email ?? "This user"} will lose access to assigned customer, seller, B2B, or admin profiles until reactivated.`,
        confirmLabel: "Disable user",
        onConfirm: () => updateStatus.mutate({ userId, status }),
      });
      return;
    }
    updateStatus.mutate({ userId, status });
  };
  const requestRoleRemoval = (userId: string, roleCode: PlatformRoleCode) => {
    const user = items.find((item) => item.id === userId);
    if (!user) {
      return;
    }
    setRoleRemovalRequest({ user, roleCode });
    setRoleRemovalNote("");
    previewRoleRemoval.mutate({ userId, roleCode });
  };
  const closeRoleRemovalDialog = () => {
    setRoleRemovalRequest(null);
    setRoleRemovalNote("");
    previewRoleRemoval.reset();
  };
  const confirmRoleRemoval = () => {
    if (!roleRemovalRequest || !previewRoleRemoval.data) {
      return;
    }
    const noteError = roleRemovalNoteError(previewRoleRemoval.data, roleRemovalNote);
    if (roleRemovalHasBlockers(previewRoleRemoval.data) || noteError) {
      return;
    }
    updateRole.mutate(
      {
        userId: roleRemovalRequest.user.id,
        roleCode: roleRemovalRequest.roleCode,
        action: "remove",
        note: roleRemovalNote,
      },
      { onSuccess: closeRoleRemovalDialog },
    );
  };

  return (
    <AdminResourceChrome
      title="Users & roles"
      description="Manage platform users, role assignments, and account status."
      icon={<UserCog className="h-5 w-5" />}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      {confirmation.dialog}
      <RoleRemovalImpactDialog
        request={roleRemovalRequest}
        impact={previewRoleRemoval.data ?? null}
        isLoading={previewRoleRemoval.isPending}
        error={previewRoleRemoval.error}
        removeError={roleRemovalRequest ? updateRole.error : null}
        note={roleRemovalNote}
        onNoteChange={setRoleRemovalNote}
        onClose={closeRoleRemovalDialog}
        onConfirm={confirmRoleRemoval}
        isRemoving={updateRole.isPending}
      />
      {updateStatus.error ||
      updateRole.error ||
      setBackOfficePassword.error ||
      updateDeliveryProfile.error ? (
        <PanelStatus
          tone="danger"
          title="User update failed"
          message={mutationErrorMessage(
            updateStatus.error ??
              updateRole.error ??
              setBackOfficePassword.error ??
              updateDeliveryProfile.error,
          )}
          {...(updateStatus.error instanceof IndihubApiError
            ? { status: updateStatus.error.status }
            : {})}
          {...(updateRole.error instanceof IndihubApiError
            ? { status: updateRole.error.status }
            : {})}
          {...(setBackOfficePassword.error instanceof IndihubApiError
            ? { status: setBackOfficePassword.error.status }
            : {})}
          {...(updateDeliveryProfile.error instanceof IndihubApiError
            ? { status: updateDeliveryProfile.error.status }
            : {})}
        />
      ) : null}

      <UsersRolesTable
        users={items}
        isLoading={query.isLoading}
        currentAdminId={auth.user?.id ?? null}
        total={totalItems(query.data, items.length)}
        search={search}
        setSearch={setSearch}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        profileFilter={profileFilter}
        setProfileFilter={setProfileFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
        onStatus={requestUserStatus}
        onAddRole={(userId, roleCode) => updateRole.mutate({ userId, roleCode, action: "add" })}
        onRemoveRole={requestRoleRemoval}
        onSetBackOfficePassword={(userId, password) =>
          setBackOfficePassword.mutate({ userId, password })
        }
        onUpdateDeliveryProfile={(userId, payload) =>
          updateDeliveryProfile.mutate({ userId, payload })
        }
        disabled={
          updateStatus.isPending ||
          updateRole.isPending ||
          setBackOfficePassword.isPending ||
          updateDeliveryProfile.isPending
        }
      />
    </AdminResourceChrome>
  );
}

export function AdminSellersPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const confirmation = useAdminConfirmation();
  const query = useAdminList<SellerRecord>(
    "admin-sellers",
    "/api/admin/sellers",
    auth.authHeaders,
    search,
  );
  const approve = useMutation({
    mutationFn: ({ sellerId, decision }: { sellerId: string; decision: "APPROVE" | "REJECT" }) =>
      adminRequest(`/api/admin/sellers/${sellerId}/approval`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          note: decision === "APPROVE" ? "Approved by admin." : "Rejected by admin.",
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-sellers"] }),
  });
  const suspend = useMutation({
    mutationFn: ({ sellerId, suspended }: { sellerId: string; suspended: boolean }) =>
      adminRequest(`/api/admin/sellers/${sellerId}/suspension`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({
          suspended,
          note: suspended ? "Suspended by admin." : "Seller suspension removed by admin.",
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-sellers"] }),
  });
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="Seller operations"
      description="Approve, reject, suspend, and review sellers before catalogue and order operations are unlocked."
      icon={<Store className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      {confirmation.dialog}
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No sellers found"
        columns={[
          {
            header: "Seller",
            cell: (item) => (
              <div className="flex items-center gap-3">
                <AvatarImage
                  src={item.profile?.logoUrl ?? null}
                  fallback={item.storeName.slice(0, 2)}
                />
                <EntityTitle
                  title={item.storeName}
                  subtitle={`${item.slug} / ${humanize(item.sellerType)}`}
                />
              </div>
            ),
          },
          {
            header: "Contact",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.profile?.contactName ?? item.user?.fullName ?? "Contact not set",
                  item.profile?.contactEmail ?? item.user?.email ?? "Email not set",
                  item.profile?.contactPhone ?? item.user?.phone ?? "Phone not set",
                ]}
              />
            ),
          },
          {
            header: "Verification",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.profile?.businessLegalName ?? "Legal name not set",
                  item.profile?.businessType
                    ? humanize(item.profile.businessType)
                    : "Business type not set",
                  [
                    item.profile?.gstNumber ? `GST ${item.profile.gstNumber}` : "GST not set",
                    item.profile?.panNumber ? `PAN ${item.profile.panNumber}` : "PAN not set",
                  ].join(" / "),
                  sellerDocumentSummary(item.documents),
                ]}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
                <StatusBadge tone={statusTone(item.approvalStatus)}>
                  {humanize(item.approvalStatus)}
                </StatusBadge>
                {item.subscriptionStatus ? (
                  <StatusBadge tone={statusTone(item.subscriptionStatus)}>
                    {humanize(item.subscriptionStatus)}
                  </StatusBadge>
                ) : null}
              </div>
            ),
          },
          {
            header: "Plan",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.subscriptionPlan?.name ?? "No plan assigned",
                  item.subscriptionPlan?.isDefault
                    ? "Default onboarding plan"
                    : (item.subscriptionPlan?.code ?? "Assign from subscriptions"),
                ]}
              />
            ),
          },
          {
            header: "Activity",
            cell: (item) => (
              <SmallStack
                lines={[
                  `${item._count?.products ?? 0} products`,
                  `${item._count?.orderSplits ?? 0} order splits`,
                  `${item._count?.b2bEnquiries ?? 0} B2B enquiries`,
                ]}
              />
            ),
          },
          {
            header: "Actions",
            className: "min-w-[260px]",
            cell: (item) => (
              <AdminActionMenu
                label="Seller actions"
                items={[
                  {
                    label: "Approve seller",
                    description: "Unlock catalogue and order operations",
                    icon: <CheckCircle2 className="h-4 w-4 text-[#0F8A5F]" />,
                    onSelect: () =>
                      confirmation.requestConfirmation({
                        title: "Approve seller?",
                        description: `${item.storeName} will be allowed to manage catalogue items and receive orders after approval.`,
                        confirmLabel: "Approve seller",
                        tone: "warning",
                        onConfirm: () => approve.mutate({ sellerId: item.id, decision: "APPROVE" }),
                      }),
                    disabled: approve.isPending,
                  },
                  {
                    label: "Reject seller",
                    description: "Keep seller out of live marketplace",
                    icon: <XCircle className="h-4 w-4 text-[#B42318]" />,
                    onSelect: () =>
                      confirmation.requestConfirmation({
                        title: "Reject seller?",
                        description: `${item.storeName} will stay out of live marketplace operations until a new approval decision is made.`,
                        confirmLabel: "Reject seller",
                        onConfirm: () => approve.mutate({ sellerId: item.id, decision: "REJECT" }),
                      }),
                    disabled: approve.isPending,
                    destructive: true,
                  },
                  {
                    label: item.status === "SUSPENDED" ? "Unsuspend seller" : "Suspend seller",
                    description:
                      item.status === "SUSPENDED"
                        ? "Restore seller operations"
                        : "Pause seller operations",
                    icon: <ShieldAlert className="h-4 w-4 text-[#ED3500]" />,
                    onSelect: () =>
                      confirmation.requestConfirmation({
                        title:
                          item.status === "SUSPENDED"
                            ? "Restore seller operations?"
                            : "Suspend seller?",
                        description:
                          item.status === "SUSPENDED"
                            ? `${item.storeName} will regain access to seller operations.`
                            : `${item.storeName} will be paused from active marketplace operations until unsuspended.`,
                        confirmLabel:
                          item.status === "SUSPENDED" ? "Unsuspend seller" : "Suspend seller",
                        tone: item.status === "SUSPENDED" ? "warning" : "danger",
                        onConfirm: () =>
                          suspend.mutate({
                            sellerId: item.id,
                            suspended: item.status !== "SUSPENDED",
                          }),
                      }),
                    disabled: suspend.isPending,
                    destructive: item.status !== "SUSPENDED",
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminProductsPageClient({
  mode = "catalogue",
}: {
  mode?: "catalogue" | "approvals";
}) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const confirmation = useAdminConfirmation();
  const isApprovalQueue = mode === "approvals";
  const productQueryKey = isApprovalQueue ? "admin-product-approvals" : "admin-products";
  const query = useAdminList<ProductRecord>(
    productQueryKey,
    "/api/admin/products",
    auth.authHeaders,
    search,
    "search",
    isApprovalQueue ? { approvalStatus: "PENDING_APPROVAL" } : undefined,
  );
  const approve = useMutation({
    mutationFn: ({ productId, decision }: { productId: string; decision: "APPROVE" | "REJECT" }) =>
      adminRequest(`/api/admin/products/${productId}/approval`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          note:
            decision === "APPROVE" ? "Product approved by admin." : "Product rejected by admin.",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-approvals"] });
    },
  });
  const archiveProduct = useMutation({
    mutationFn: (productId: string) =>
      adminRequest(`/api/admin/products/${productId}`, auth.authHeaders, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-product-approvals"] });
    },
  });
  const items = listItems(query.data);
  const title = isApprovalQueue ? "Product approval queue" : "Product catalogue";
  const description = isApprovalQueue
    ? "Review only seller-submitted products waiting for admin approval before they go live."
    : "Review all products, approval state, pricing, stock, seller ownership, and customer-visible status.";
  const emptyTitle = isApprovalQueue ? "No products waiting for approval" : "No products found";

  return (
    <AdminResourceChrome
      title={title}
      description={description}
      icon={<ShoppingBag className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      {confirmation.dialog}
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle={emptyTitle}
        columns={[
          {
            header: "Product",
            className: "min-w-[280px]",
            cell: (item) => (
              <div className="flex items-center gap-3">
                <ProductImage product={item} />
                <EntityTitle title={item.name} subtitle={item.category?.name ?? item.slug} />
              </div>
            ),
          },
          {
            header: "Essentials",
            className: "min-w-[260px]",
            cell: (item) => <ProductEssentialsReview product={item} />,
          },
          {
            header: "Seller",
            cell: (item) => (
              <EntityTitle
                title={item.seller?.storeName ?? "No seller"}
                subtitle={item.seller?.user?.email ?? ""}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
                <StatusBadge tone={statusTone(item.approvalStatus)}>
                  {humanize(item.approvalStatus)}
                </StatusBadge>
              </div>
            ),
          },
          {
            header: "Price and stock",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.variants?.[0] ? formatPaise(item.variants[0].pricePaise) : "No variant",
                  `${item.variants?.reduce((total, variant) => total + variant.stockQuantity, 0) ?? 0} units`,
                  `${item.images?.length ?? 0} images`,
                ]}
              />
            ),
          },
          {
            header: "Actions",
            className: "min-w-[220px]",
            cell: (item) => {
              const missingEssentials = productMissingEssentialLabels(item);

              return (
                <AdminActionMenu
                  label="Product actions"
                  items={[
                    {
                      label: "Approve product",
                      description: missingEssentials.length
                        ? `Seller must add ${missingEssentials.slice(0, 3).join(", ")} before approval.`
                        : "Make this item eligible for storefront display",
                      icon: <CheckCircle2 className="h-4 w-4 text-[#0F8A5F]" />,
                      onSelect: () =>
                        confirmation.requestConfirmation({
                          title: "Approve product?",
                          description: `"${item.name}" will become eligible for storefront display if the seller and product status are active.`,
                          confirmLabel: "Approve product",
                          tone: "warning",
                          onConfirm: () =>
                            approve.mutate({ productId: item.id, decision: "APPROVE" }),
                        }),
                      disabled: approve.isPending || missingEssentials.length > 0,
                    },
                    {
                      label: "Reject product",
                      description: "Return product to seller review",
                      icon: <XCircle className="h-4 w-4 text-[#B42318]" />,
                      onSelect: () =>
                        confirmation.requestConfirmation({
                          title: "Reject product?",
                          description: `"${item.name}" will not be eligible for storefront display until the seller edits and resubmits it.`,
                          confirmLabel: "Reject product",
                          onConfirm: () =>
                            approve.mutate({ productId: item.id, decision: "REJECT" }),
                        }),
                      disabled: approve.isPending,
                      destructive: true,
                    },
                    {
                      label: "Archive product",
                      description: "Remove from listings while preserving audit history",
                      icon: <Archive className="h-4 w-4 text-[#B42318]" />,
                      onSelect: () =>
                        confirmation.requestConfirmation({
                          title: "Archive product",
                          description: `"${item.name}" will be removed from storefront listings. This keeps the audit trail and avoids permanent deletion.`,
                          confirmLabel: "Archive product",
                          onConfirm: () => archiveProduct.mutate(item.id),
                        }),
                      disabled: archiveProduct.isPending,
                      destructive: true,
                    },
                  ]}
                />
              );
            },
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminOrdersPageClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const query = useAdminList<OrderRecord>(
    "admin-orders",
    "/api/admin/orders",
    auth.authHeaders,
    search,
  );
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="Orders"
      description="Monitor platform orders, seller splits, payment state, buyer currency, and delivery status."
      icon={<ClipboardList className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No orders found"
        columns={[
          {
            header: "Order",
            cell: (item) => (
              <EntityTitle
                title={item.orderNumber}
                subtitle={item.customer?.user?.email ?? formatDate(item.createdAt)}
                actionHref={`/admin/orders/${item.orderNumber}`}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone={statusTone(item.orderStatus)}>
                  {humanize(item.orderStatus)}
                </StatusBadge>
                <StatusBadge tone={statusTone(item.paymentStatus)}>
                  {humanize(item.paymentStatus)}
                </StatusBadge>
                <StatusBadge tone={statusTone(item.deliveryStatus)}>
                  {humanize(item.deliveryStatus)}
                </StatusBadge>
              </div>
            ),
          },
          {
            header: "Value",
            cell: (item) => (
              <SmallStack
                lines={[
                  formatPaise(item.totalPaise, item.currency),
                  item.buyerCurrency
                    ? `${formatMinor(item.buyerTotalMinor ?? 0, item.buyerCurrency)} buyer total`
                    : "INR buyer total",
                  item.buyerCountryCode ? `Market ${item.buyerCountryCode}` : "Default market",
                ]}
              />
            ),
          },
          {
            header: "Items",
            cell: (item) => (
              <SmallStack
                lines={[
                  `${item.items?.length ?? 0} order items`,
                  `${item.sellerSplits?.length ?? 0} seller splits`,
                  formatDate(item.updatedAt ?? item.createdAt),
                ]}
              />
            ),
          },
          {
            header: "Action",
            cell: (item) => (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/orders/${item.orderNumber}`}>Open order</Link>
              </Button>
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminDeliveryOperationsPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useAdminConfirmation();
  const [search, setSearch] = useState("");
  const [partnerFilterLocation, setPartnerFilterLocation] = useState<AdminLocationValue>(() => ({
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    pincode: "",
    localAreaCode: "",
  }));
  const [availability, setAvailability] = useState<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");
  const [autoAssignNotice, setAutoAssignNotice] = useState<{
    title: string;
    message: string;
    tone: StatusTone;
  } | null>(null);
  const [editingRateCardId, setEditingRateCardId] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<RateFormState>(() => defaultRateForm());
  const [simulatorForm, setSimulatorForm] = useState({
    deliveryPreference: "DELIVER_TO_ADDRESS",
    countryCode: "IN",
    stateCode: "IN-TN",
    cityCode: "",
    pincode: "",
    localAreaCode: "",
    subtotalRupees: "499",
    paymentMethod: "COD",
  });
  const [simulatorResult, setSimulatorResult] = useState<RoutingSimulatorResult | null>(null);
  const partnerParams = useMemo(
    () => ({
      status: "ACTIVE",
      cityCode: partnerFilterLocation.cityCode.trim() || undefined,
      pincode: partnerFilterLocation.pincode.trim() || undefined,
      isAvailable:
        availability === "AVAILABLE"
          ? "true"
          : availability === "UNAVAILABLE"
            ? "false"
            : undefined,
    }),
    [availability, partnerFilterLocation],
  );
  const partnersQuery = useAdminList<UserRecord>(
    "admin-delivery-partners",
    "/api/admin/delivery/partners",
    auth.authHeaders,
    search,
    "search",
    partnerParams,
  );
  const unassignedQuery = useAdminList<OrderRecord>(
    "admin-delivery-unassigned",
    "/api/admin/delivery/unassigned-orders",
    auth.authHeaders,
    "",
  );
  const reportQuery = useQuery({
    queryKey: ["admin-delivery-cod-handover", auth.authHeaders],
    enabled: Boolean(auth.authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<DeliveryCodHandoverReport>(
        "/api/admin/delivery/cod-handover-report",
        undefined,
        auth.authHeaders,
      ),
  });
  const rateCardsQuery = useQuery({
    queryKey: ["admin-shipping-rate-cards", auth.authHeaders],
    enabled: Boolean(auth.authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<ShippingRateCardResponse>("/api/admin/rate-cards", undefined, auth.authHeaders),
  });
  const courierProvidersQuery = useQuery({
    queryKey: ["admin-courier-providers", auth.authHeaders],
    enabled: Boolean(auth.authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<CourierProviderResponse>(
        "/api/admin/courier-providers",
        undefined,
        auth.authHeaders,
      ),
  });
  const saveRateCard = useMutation<RateCardSaveResponse, Error, RateCardSaveVariables>({
    mutationFn: ({ targetId }) =>
      adminRequest<RateCardSaveResponse>(
        targetId ? `/api/admin/rate-cards/${targetId}` : "/api/admin/rate-cards",
        auth.authHeaders,
        {
          method: targetId ? "PATCH" : "POST",
          body: JSON.stringify(rateCardPayloadFromForm(rateForm)),
        },
      ),
    onSuccess: async (response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-shipping-rate-cards"] });
      const savedRateCardId = variables.targetId ?? response.item?.id ?? null;
      setEditingRateCardId(savedRateCardId);
      setAutoAssignNotice({
        title: variables.targetId ? "Rate card updated" : "Rate card saved",
        message: variables.targetId
          ? "The existing shipping rule was updated and remains selected for further changes."
          : "Shipping charge rule is now available for checkout routing and simulator checks.",
        tone: "success",
      });
    },
    onError: (error) =>
      setAutoAssignNotice({
        title: "Rate card failed",
        message: error instanceof Error ? error.message : "Unable to save shipping rate card.",
        tone: "danger",
      }),
  });
  const updateRateCardActive = useMutation({
    mutationFn: ({ rateCardId, isActive }: { rateCardId: string; isActive: boolean }) =>
      adminRequest(`/api/admin/rate-cards/${rateCardId}/active`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-shipping-rate-cards"] });
      setAutoAssignNotice({
        title: variables.isActive ? "Rate card activated" : "Rate card turned off",
        message: variables.isActive
          ? "This shipping rule is active again for checkout routing."
          : "This rule is no longer used for new checkout routing.",
        tone: "success",
      });
    },
    onError: (error) =>
      setAutoAssignNotice({
        title: "Rate card update failed",
        message: error instanceof Error ? error.message : "Unable to update this shipping rule.",
        tone: "danger",
      }),
  });
  const deleteRateCard = useMutation({
    mutationFn: (rateCardId: string) =>
      adminRequest(`/api/admin/rate-cards/${rateCardId}`, auth.authHeaders, {
        method: "DELETE",
      }),
    onSuccess: async (_, rateCardId) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-shipping-rate-cards"] });
      if (editingRateCardId === rateCardId) {
        setEditingRateCardId(null);
        setRateForm(defaultRateForm());
      }
      setAutoAssignNotice({
        title: "Rate card removed",
        message:
          "This shipping rule is no longer available to checkout routing or simulator checks.",
        tone: "success",
      });
    },
    onError: (error) =>
      setAutoAssignNotice({
        title: "Rate card remove failed",
        message: error instanceof Error ? error.message : "Unable to remove this shipping rule.",
        tone: "danger",
      }),
  });
  const simulateRouting = useMutation({
    mutationFn: () =>
      adminRequest<RoutingSimulatorResult>("/api/admin/routing-simulator", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify({
          deliveryPreference: simulatorForm.deliveryPreference,
          subtotalPaise: rupeesInputToPaise(simulatorForm.subtotalRupees),
          paymentMethod: simulatorForm.paymentMethod,
          shippingAddress: {
            fullName: "Simulator Customer",
            phone: "9876543210",
            line1: "Simulator address",
            countryCode: simulatorForm.countryCode,
            stateCode: emptyToUndefined(simulatorForm.stateCode),
            cityCode: emptyToUndefined(simulatorForm.cityCode),
            pincode: emptyToUndefined(simulatorForm.pincode),
            localAreaCode: emptyToUndefined(simulatorForm.localAreaCode),
          },
        }),
      }),
    onSuccess: (result) => setSimulatorResult(result),
    onError: (error) =>
      setAutoAssignNotice({
        title: "Simulator failed",
        message: error instanceof Error ? error.message : "Unable to simulate this route.",
        tone: "danger",
      }),
  });
  const autoAssign = useMutation({
    mutationFn: (orderNumber: string) =>
      adminRequest<OrderRecord>(
        `/api/admin/delivery/orders/${orderNumber}/auto-assign`,
        auth.authHeaders,
        {
          method: "POST",
        },
      ),
    onSuccess: async (updated, orderNumber) => {
      const detail = updated.deliveryDetail;
      const assignedPartner =
        detail?.deliveryPartner?.fullName || detail?.deliveryPartner?.email || "delivery partner";
      setAutoAssignNotice(
        detail?.deliveryPartnerUserId
          ? {
              title: "Auto assigned",
              message:
                `${orderNumber} assigned to ${assignedPartner}. ${detail.assignmentNote ?? ""}`.trim(),
              tone: "success",
            }
          : {
              title: "No eligible partner",
              message:
                detail?.assignmentNote ??
                "No eligible delivery partner was found. Check partner availability, profile service area, and COD cash limit.",
              tone: "warning",
            },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-unassigned"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-partners"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-cod-handover"] });
    },
    onError: (error) => {
      setAutoAssignNotice({
        title: "Auto assign failed",
        message:
          error instanceof Error ? error.message : "Auto assignment failed. Please try again.",
        tone: "danger",
      });
    },
  });
  const partners = listItems(partnersQuery.data);
  const unassigned = listItems(unassignedQuery.data);
  const report = reportQuery.data;
  const rateCards = rateCardsQuery.data?.items ?? [];
  const courierProviders = courierProvidersQuery.data?.items ?? [];
  const editingRateCard = useMemo(
    () => rateCards.find((card) => card.id === editingRateCardId) ?? null,
    [editingRateCardId, rateCards],
  );
  const duplicateRateCardIds = useMemo(
    () => findDuplicateActiveRateCardIds(rateCards),
    [rateCards],
  );
  const rateFormConflict = useMemo(
    () => findRateFormConflict(rateCards, rateForm, editingRateCardId),
    [editingRateCardId, rateCards, rateForm],
  );
  const rateCardSaveTargetId = editingRateCardId ?? rateFormConflict?.id ?? null;
  const rateCardSaveBlocked = Boolean(editingRateCardId && rateFormConflict);

  const resetRateForm = () => {
    setEditingRateCardId(null);
    setRateForm(defaultRateForm());
  };

  const beginEditRateCard = (card: ShippingRateCardRecord) => {
    setEditingRateCardId(card.id);
    setRateForm({
      name: card.name,
      deliveryMode: card.deliveryMode,
      isActive: card.isActive,
      countryCode: card.countryCode ?? "",
      stateCode: card.stateCode ?? "",
      cityCode: card.cityCode ?? "",
      pincode: card.pincode ?? "",
      localAreaCode: card.localAreaCode ?? "",
      minSubtotalRupees: paiseToRupeesInput(card.minSubtotalPaise),
      maxSubtotalRupees: paiseToRupeesInput(card.maxSubtotalPaise),
      shippingRupees: paiseToRupeesInput(card.shippingChargePaise),
      freeAboveRupees: paiseToRupeesInput(card.freeAbovePaise),
      codFlatRupees:
        card.codSurchargeType === "FLAT" ? paiseToRupeesInput(card.codSurchargeFlatPaise) : "",
      priority: String(card.priority),
    });
  };

  const requestRateCardRemoval = (card: ShippingRateCardRecord) => {
    confirmation.requestConfirmation({
      title: "Remove shipping rate card?",
      description: `"${card.name}" will be permanently removed. New checkout routing will stop using this rule immediately.`,
      confirmLabel: "Remove rule",
      onConfirm: () => deleteRateCard.mutate(card.id),
    });
  };

  return (
    <AdminResourceChrome
      title="Delivery operations"
      description="Assign packed orders, monitor partner workload, and reconcile COD cash handovers."
      icon={<Truck className="h-5 w-5" />}
      query={partnersQuery}
      total={totalItems(partnersQuery.data, partners.length)}
    >
      {confirmation.dialog}
      <div className="grid gap-5">
        <div className="grid gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(16rem,1fr)_minmax(12rem,0.35fr)]">
            <label className="relative block">
              <span className="sr-only">Search delivery partners</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search partner name, email or phone"
                className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-11 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#667085] focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
              />
            </label>
            <AdminListbox
              value={availability}
              options={[
                { value: "ALL", label: "All availability" },
                { value: "AVAILABLE", label: "Available only" },
                { value: "UNAVAILABLE", label: "Inactive/unavailable" },
              ]}
              onChange={(value) => setAvailability(value as typeof availability)}
              compact
              buttonClassName="h-12 bg-white"
            />
          </div>
          <AdminLocationSelector
            value={partnerFilterLocation}
            onChange={setPartnerFilterLocation}
            allowAnyCountry
          />
        </div>
        {autoAssignNotice ? (
          <AdminStatusNotice
            title={autoAssignNotice.title}
            message={autoAssignNotice.message}
            tone={autoAssignNotice.tone}
            className="mb-0"
          />
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Panel title="Unassigned deliveries">
            <div className="grid gap-3">
              {unassignedQuery.isLoading ? (
                <p className="text-sm font-semibold text-[#667085]">
                  Loading unassigned deliveries...
                </p>
              ) : null}
              {unassigned.map((order) => (
                <div
                  key={order.id}
                  className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-black text-[#163B5C] hover:text-[#ED3500]"
                      >
                        {order.orderNumber}
                      </Link>
                      <StatusBadge tone="warning">
                        {humanize(order.deliveryDetail?.assignmentStatus ?? "UNASSIGNED")}
                      </StatusBadge>
                      <StatusBadge tone={statusTone(order.deliveryStatus)}>
                        {humanize(order.deliveryStatus)}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {order.customer?.user?.email ?? "Customer"} /{" "}
                      {formatPaise(order.totalPaise, order.currency)}
                    </p>
                    {order.deliveryDetail?.assignmentNote ? (
                      <p className="mt-2 rounded-md border border-[#FFD2C2] bg-[#FFF5F1] px-3 py-2 text-xs font-bold leading-5 text-[#8A2F15]">
                        {order.deliveryDetail.assignmentNote}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => autoAssign.mutate(order.orderNumber)}
                    disabled={autoAssign.isPending}
                  >
                    Auto assign
                  </Button>
                </div>
              ))}
              {!unassignedQuery.isLoading && unassigned.length === 0 ? (
                <p className="text-sm font-semibold text-[#667085]">
                  No packed deliveries are waiting for assignment.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="COD handover report">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Collected"
                  value={formatPaise(report?.totals.collectedAmountPaise ?? 0)}
                />
                <MetricCard
                  label="Pending"
                  value={formatPaise(report?.totals.pendingAmountPaise ?? 0)}
                />
                <MetricCard
                  label="Verified"
                  value={formatPaise(report?.totals.verifiedAmountPaise ?? 0)}
                />
                <MetricCard
                  label="Rejected"
                  value={formatPaise(report?.totals.rejectedAmountPaise ?? 0)}
                />
              </div>
              {(report?.items ?? []).slice(0, 8).map((row) => (
                <div
                  key={row.partner.id}
                  className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm"
                >
                  <p className="font-black text-[#1F2933]">
                    {row.partner.fullName || row.partner.email}
                  </p>
                  <p className="mt-1 font-semibold text-[#667085]">
                    Pending {formatPaise(row.pendingAmountPaise)} / verified{" "}
                    {formatPaise(row.verifiedAmountPaise)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Panel title="Shipping rate cards">
            <div className="grid gap-5">
              <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-xs font-bold leading-5 text-[#526173]">
                Create one active rule for each delivery mode and location. Checkout chooses the
                most specific match: local area, pincode, city, state, then country. If the same
                rule already exists, edit it or turn it off instead of adding another copy.
              </div>
              {editingRateCard ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#B7D7F2] bg-[#F2F8FF] p-3">
                  <div>
                    <p className="text-sm font-black text-[#0B3558]">
                      Editing {editingRateCard.name}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#526173]">
                      Update will modify this saved rule. It will not create a duplicate rate card.
                    </p>
                  </div>
                  <StatusBadge tone={editingRateCard.isActive ? "success" : "warning"}>
                    {editingRateCard.isActive ? "Active" : "Off"}
                  </StatusBadge>
                </div>
              ) : null}
              {rateFormConflict ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-md border p-4",
                    editingRateCardId
                      ? "border-[#FFD2C2] bg-[#FFF5F1]"
                      : "border-[#B7D7F2] bg-[#F2F8FF]",
                  )}
                >
                  <div>
                    <StatusBadge tone={editingRateCardId ? "warning" : "info"}>
                      {editingRateCardId ? "Another active rule" : "Existing rule will update"}
                    </StatusBadge>
                    <p className="mt-2 text-sm font-black text-[#1F2933]">
                      {editingRateCardId
                        ? `This route already overlaps "${rateFormConflict.name}".`
                        : `Saving now will update "${rateFormConflict.name}" instead of creating a duplicate.`}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#667085]">
                      {editingRateCardId
                        ? "Edit the matching rule, turn it off, or remove it before saving an active card for the same place and subtotal range."
                        : "You can change the shipping charge, COD fee, priority, or active state here and click Update rate card."}
                    </p>
                  </div>
                  {!editingRateCardId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => beginEditRateCard(rateFormConflict)}
                    >
                      Edit matching rule
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-3 lg:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">Rule name</span>
                  <input
                    value={rateForm.name}
                    onChange={(event) =>
                      setRateForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Example: Salem local delivery"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <AdminListbox
                  label="Applies to"
                  value={rateForm.deliveryMode}
                  options={shippingRateModeOptions}
                  onChange={(value) =>
                    setRateForm((current) => ({ ...current, deliveryMode: value }))
                  }
                  compact
                  buttonClassName="h-11 bg-white"
                />
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">Priority</span>
                  <input
                    value={rateForm.priority}
                    onChange={(event) =>
                      setRateForm((current) => ({ ...current, priority: event.target.value }))
                    }
                    placeholder="Lower number wins"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
              </div>
              <AdminLocationSelector
                value={rateForm}
                onChange={(nextLocation) =>
                  setRateForm((current) => ({
                    ...current,
                    ...nextLocation,
                  }))
                }
                allowAnyCountry
              />
              <AdminSwitch
                label="Active for checkout"
                description="Off cards stay saved in admin, but storefront checkout and simulator routing ignore them."
                checked={rateForm.isActive}
                onChange={(isActive) => setRateForm((current) => ({ ...current, isActive }))}
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {(
                  [
                    ["minSubtotalRupees", "Min subtotal Rs", "Optional"],
                    ["maxSubtotalRupees", "Max subtotal Rs", "Optional"],
                    ["shippingRupees", "Shipping charge Rs", "49"],
                    ["freeAboveRupees", "Free above Rs", "Optional"],
                    ["codFlatRupees", "COD fee Rs", "Optional"],
                  ] as Array<
                    [
                      (
                        | "minSubtotalRupees"
                        | "maxSubtotalRupees"
                        | "shippingRupees"
                        | "freeAboveRupees"
                        | "codFlatRupees"
                      ),
                      string,
                      string,
                    ]
                  >
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="grid gap-1.5">
                    <span className="text-xs font-black uppercase text-[#667085]">{label}</span>
                    <input
                      value={rateForm[key]}
                      onChange={(event) =>
                        setRateForm((current) => ({ ...current, [key]: event.target.value }))
                      }
                      placeholder={placeholder}
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold leading-5 text-[#667085]">
                  Store pickup is always free. These cards are for local delivery and courier
                  delivery charges only.
                </p>
                <div className="flex flex-wrap gap-2">
                  {editingRateCardId ? (
                    <Button type="button" variant="outline" onClick={resetRateForm}>
                      New rule
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => saveRateCard.mutate({ targetId: rateCardSaveTargetId })}
                    disabled={saveRateCard.isPending || rateCardSaveBlocked}
                  >
                    {rateCardSaveTargetId ? "Update rate card" : "Save rate card"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                {rateCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-black text-[#1F2933]">{card.name}</p>
                      <p className="text-xs font-bold text-[#667085]">
                        {humanize(card.deliveryMode)} / {rateCardScopeLabel(card)} /{" "}
                        {rateCardSubtotalLabel(card)} / priority {card.priority}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {duplicateRateCardIds.has(card.id) ? (
                        <StatusBadge tone="warning">Duplicate</StatusBadge>
                      ) : null}
                      <StatusBadge tone={card.isActive ? "success" : "warning"}>
                        {card.isActive ? "Active" : "Off"}
                      </StatusBadge>
                      <span className="text-sm font-black text-[#163B5C]">
                        {rateCardChargeLabel(card)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => beginEditRateCard(card)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateRateCardActive.mutate({
                            rateCardId: card.id,
                            isActive: !card.isActive,
                          })
                        }
                        disabled={updateRateCardActive.isPending}
                      >
                        {card.isActive ? "Turn off" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[#FECACA] text-[#B42318] hover:bg-[#FEF3F2]"
                        onClick={() => requestRateCardRemoval(card)}
                        disabled={deleteRateCard.isPending}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {!rateCardsQuery.isLoading && rateCards.length === 0 ? (
                  <p className="text-sm font-semibold text-[#667085]">
                    No rate cards yet. Fallback shipping setting is still used.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Courier providers">
            <div className="grid gap-4">
              <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-xs font-bold leading-5 text-[#526173]">
                Courier fallback is now configured from Settings so credentials, countries, and
                live/sandbox mode stay in one configuration center. This operations page only shows
                the current routing readiness.
              </div>
              <Button asChild variant="outline" className="w-fit">
                <Link href="/admin/settings/general">
                  <Settings className="h-4 w-4" /> Open courier integration settings
                </Link>
              </Button>
              {courierProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-[#1F2933]">{provider.displayName}</p>
                    <StatusBadge tone={provider.isActive ? "success" : "warning"}>
                      {provider.isActive ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#667085]">
                    {provider.providerCode} / {provider.mode} / countries{" "}
                    {provider.serviceableCountryCodes.join(", ") || "not configured"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#667085]">
                    Credentials {provider.credentialsConfigured ? "configured" : "pending"} /
                    webhook {provider.webhookSecretConfigured ? "configured" : "pending"}
                  </p>
                </div>
              ))}
              {!courierProvidersQuery.isLoading && courierProviders.length === 0 ? (
                <p className="text-sm font-semibold text-[#667085]">
                  No courier provider has been configured yet.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel title="Routing simulator">
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              <AdminListbox
                label="Customer choice"
                value={simulatorForm.deliveryPreference}
                options={[
                  { value: "STORE_PICKUP", label: "Store pickup" },
                  { value: "DELIVER_TO_ADDRESS", label: "Deliver to address" },
                ]}
                onChange={(value) =>
                  setSimulatorForm((current) => ({ ...current, deliveryPreference: value }))
                }
                compact
                buttonClassName="h-11 bg-white"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <AdminListbox
                  label="Payment"
                  value={simulatorForm.paymentMethod}
                  options={[
                    { value: "COD", label: "Cash on delivery" },
                    { value: "RAZORPAY", label: "Razorpay" },
                    { value: "BANK_TRANSFER", label: "Bank transfer" },
                    { value: "MANUAL", label: "Manual payment" },
                  ]}
                  onChange={(paymentMethod) =>
                    setSimulatorForm((current) => ({ ...current, paymentMethod }))
                  }
                  compact
                  buttonClassName="h-11 bg-white"
                />
              </div>
              <AdminLocationSelector
                value={simulatorForm}
                onChange={(nextLocation) =>
                  setSimulatorForm((current) => ({
                    ...current,
                    ...nextLocation,
                  }))
                }
              />
              <input
                value={simulatorForm.subtotalRupees}
                onChange={(event) =>
                  setSimulatorForm((current) => ({
                    ...current,
                    subtotalRupees: event.target.value,
                  }))
                }
                placeholder="Subtotal ₹"
                className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
              <Button
                type="button"
                onClick={() => simulateRouting.mutate()}
                disabled={simulateRouting.isPending}
              >
                Simulate
              </Button>
            </div>
            <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              {simulatorResult ? (
                <div className="space-y-2 text-sm">
                  <p className="font-black text-[#163B5C]">
                    {humanize(simulatorResult.deliveryMode)}
                  </p>
                  <p className="font-semibold text-[#667085]">
                    Shipping {formatPaise(simulatorResult.shippingChargePaise)} / COD{" "}
                    {formatPaise(simulatorResult.codSurchargePaise)}
                  </p>
                  <p className="font-semibold text-[#667085]">
                    Partner {simulatorResult.recommendedPartnerName ?? "not selected"} / Courier{" "}
                    {simulatorResult.courierProviderCode ?? "not selected"}
                  </p>
                  <p className="font-semibold text-[#667085]">
                    Rate card {simulatorResult.matchedRateCardName ?? "fallback setting"} /{" "}
                    {simulatorResult.freeShippingApplied
                      ? "free shipping applied"
                      : "paid shipping"}
                  </p>
                  {simulatorResult.routingFailed ? (
                    <p className="rounded-md border border-[#FFD2C2] bg-[#FFF5F1] px-3 py-2 text-xs font-bold text-[#8A2F15]">
                      {simulatorResult.routingFailureNote ?? simulatorResult.routingFailureReason}
                    </p>
                  ) : null}
                  {simulatorResult.warnings.length ? (
                    <p className="text-xs font-bold text-[#8A2F15]">
                      {simulatorResult.warnings.join(" ")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm font-semibold text-[#667085]">
                  Run a route to preview the exact live checkout result.
                </p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Partner workload">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {partners.map((partner) => (
              <div key={partner.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <PartnerWorkloadSummary partner={partner} />
              </div>
            ))}
            {!partnersQuery.isLoading && partners.length === 0 ? (
              <p className="text-sm font-semibold text-[#667085]">
                No delivery partners match these filters.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </AdminResourceChrome>
  );
}

export function AdminOrderDetailPageClient({ orderNumber }: { orderNumber: string }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useAdminConfirmation();
  const [deliveryActionNotice, setDeliveryActionNotice] = useState<{
    title: string;
    message: string;
    tone: StatusTone;
  } | null>(null);
  const [courierPackageForms, setCourierPackageForms] = useState<
    Record<
      string,
      {
        providerCode?: string;
        awbNumber?: string;
        providerOrderId?: string;
        trackingUrl?: string;
        labelUrl?: string;
        note?: string;
        remittedAmountRupees?: string;
        remittanceReference?: string;
        reportReference?: string;
        remittanceNote?: string;
        verificationNote?: string;
      }
    >
  >({});
  const query = useQuery({
    queryKey: ["admin-order", orderNumber, auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<OrderRecord>(`/api/admin/orders/${orderNumber}`, undefined, auth.authHeaders),
  });
  const courierProvidersQuery = useQuery({
    queryKey: ["admin-courier-providers", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<CourierProviderResponse>(
        "/api/admin/courier-providers?limit=100",
        undefined,
        auth.authHeaders,
      ),
  });
  const deliveryPartnersQuery = useAdminList<UserRecord>(
    "admin-delivery-partners",
    "/api/admin/delivery/partners",
    auth.authHeaders,
    "",
    "search",
    { status: "ACTIVE" },
  );
  const updateStatus = useMutation({
    mutationFn: (payload: { orderStatus?: string; paymentStatus?: string; note?: string }) =>
      adminRequest(`/api/admin/orders/${orderNumber}/status`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
  const updateDelivery = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminRequest(`/api/admin/orders/${orderNumber}/delivery`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
  const updateAssignment = useMutation({
    mutationFn: (payload: {
      deliveryPartnerUserId?: string | null;
      assignmentNote?: string | undefined;
    }) =>
      adminRequest(`/api/admin/delivery/orders/${orderNumber}/assignment`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-partners"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-unassigned"] });
    },
  });
  const autoAssignDelivery = useMutation({
    mutationFn: () =>
      adminRequest<OrderRecord>(
        `/api/admin/delivery/orders/${orderNumber}/auto-assign`,
        auth.authHeaders,
        {
          method: "POST",
        },
      ),
    onSuccess: async (updated) => {
      const detail = updated.deliveryDetail;
      const assignedPartner =
        detail?.deliveryPartner?.fullName || detail?.deliveryPartner?.email || "delivery partner";
      setDeliveryActionNotice(
        detail?.deliveryPartnerUserId
          ? {
              title: "Auto assigned",
              message:
                `${orderNumber} assigned to ${assignedPartner}. ${detail.assignmentNote ?? ""}`.trim(),
              tone: "success",
            }
          : {
              title: "No eligible partner",
              message:
                detail?.assignmentNote ??
                "No eligible delivery partner was found. Check partner availability, profile service area, and COD cash limit.",
              tone: "warning",
            },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-partners"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-delivery-unassigned"] });
    },
    onError: (error) => {
      setDeliveryActionNotice({
        title: "Auto assign failed",
        message:
          error instanceof Error ? error.message : "Auto assignment failed. Please try again.",
        tone: "danger",
      });
    },
  });
  const verifyCodCollection = useMutation({
    mutationFn: (payload: { decision: "VERIFY" | "REJECT"; note?: string }) =>
      adminRequest(`/api/admin/orders/${orderNumber}/cod-verification`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });
  const bookCourierShipment = useMutation({
    mutationFn: (payload: {
      shipmentNumber: string;
      providerCode: string;
      awbNumber?: string | undefined;
      providerOrderId?: string | undefined;
      trackingUrl?: string | undefined;
      labelUrl?: string | undefined;
      note?: string | undefined;
    }) =>
      adminRequest(
        `/api/admin/courier-shipments/${encodeURIComponent(payload.shipmentNumber)}/book`,
        auth.authHeaders,
        {
          method: "POST",
          body: JSON.stringify(
            emptyStringsToUndefined({
              providerCode: payload.providerCode,
              awbNumber: payload.awbNumber,
              providerOrderId: payload.providerOrderId,
              trackingUrl: payload.trackingUrl,
              labelUrl: payload.labelUrl,
              note: payload.note,
            }),
          ),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-payment-collections"] });
    },
  });
  const importCourierRemittance = useMutation({
    mutationFn: (payload: {
      shipmentNumber: string;
      awbNumber?: string | undefined;
      remittedAmountPaise: number;
      remittanceReference?: string | undefined;
      reportReference?: string | undefined;
      notes?: string | undefined;
    }) =>
      adminRequest("/api/admin/finance/courier-cod-remittances", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["finance-payment-collections"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-courier-cod-remittances"] });
    },
  });
  const verifyCourierRemittance = useMutation({
    mutationFn: (payload: {
      remittanceId: string;
      decision: "VERIFY" | "DISPUTE" | "REJECT";
      note?: string | undefined;
    }) =>
      adminRequest(
        `/api/admin/finance/courier-cod-remittances/${payload.remittanceId}/verify`,
        auth.authHeaders,
        {
          method: "PATCH",
          body: JSON.stringify(
            emptyStringsToUndefined({ decision: payload.decision, note: payload.note }),
          ),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-payment-collections"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-courier-cod-remittances"] });
    },
  });
  const order = query.data;
  const courierProviders = courierProvidersQuery.data?.items ?? [];
  const activeCourierProviders = courierProviders.filter((provider) => provider.isActive);
  const updateCourierPackageForm = (
    shipmentId: string,
    field: keyof NonNullable<(typeof courierPackageForms)[string]>,
    value: string,
  ) =>
    setCourierPackageForms((current) => ({
      ...current,
      [shipmentId]: {
        ...(current[shipmentId] ?? {}),
        [field]: value,
      },
    }));

  return (
    <AdminResourceChrome
      title={`Order ${orderNumber}`}
      description="Update order, payment, pickup, local delivery, and courier state while keeping an audit trail."
      icon={<ClipboardList className="h-5 w-5" />}
      query={query}
    >
      {order ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-[#1F2933]">{order.orderNumber}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    {order.customer?.user?.email ?? "Customer email unavailable"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone={statusTone(order.orderStatus)}>
                    {humanize(order.orderStatus)}
                  </StatusBadge>
                  <StatusBadge tone={statusTone(order.paymentStatus)}>
                    {humanize(order.paymentStatus)}
                  </StatusBadge>
                  <StatusBadge tone={statusTone(order.deliveryStatus)}>
                    {humanize(order.deliveryStatus)}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <MetricCard
                  label="INR total"
                  value={formatPaise(order.totalPaise, order.currency)}
                />
                <MetricCard
                  label="Buyer total"
                  value={formatMinor(
                    order.buyerTotalMinor ?? order.totalPaise,
                    order.buyerCurrency ?? order.currency,
                  )}
                />
                <MetricCard
                  label="Platform fee"
                  value={formatPaise(order.platformFeePaise ?? 0, order.currency)}
                />
                <MetricCard label="Seller splits" value={`${order.sellerSplits?.length ?? 0}`} />
                <MetricCard label="Packages" value={`${order.shipments?.length ?? 0}`} />
              </div>
            </Panel>

            <Panel title="Order items">
              <div className="divide-y divide-[#E5E7EB]">
                {(order.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <p className="font-black text-[#1F2933]">{item.productNameSnapshot}</p>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">
                        {item.seller?.storeName ?? "Seller"} / Qty {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-black text-[#163B5C]">
                      {formatPaise(item.lineTotalPaise)}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            {order.shipments?.length ? (
              <Panel title="Seller packages">
                <div className="grid gap-3">
                  {order.shipments.map((shipment) => {
                    const courierForm = courierPackageForms[shipment.id] ?? {};
                    const selectedProviderCode =
                      courierForm.providerCode ??
                      shipment.courierShipment?.providerCode ??
                      shipment.courierProviderCode ??
                      order.deliveryDetail?.courierProviderCode ??
                      activeCourierProviders[0]?.providerCode ??
                      "";
                    const awbNumber =
                      courierForm.awbNumber ??
                      shipment.courierShipment?.awbNumber ??
                      shipment.awbNumber ??
                      "";
                    const selectedCourierProvider = activeCourierProviders.find(
                      (provider) => provider.providerCode === selectedProviderCode,
                    );
                    const isCourierPackage = shipment.deliveryMode === "THIRD_PARTY_COURIER";
                    const isManualTransportPackage = shipment.deliveryMode === "MANUAL_TRANSPORT";
                    const remittance = shipment.courierCodRemittance;
                    const canVerifyRemittance = remittance?.status === "REMITTED";

                    return (
                      <div
                        key={shipment.id}
                        className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-[#1F2933]">{shipment.shipmentNumber}</p>
                            <p className="mt-1 text-sm font-semibold text-[#667085]">
                              {shipment.seller?.storeName ?? "Seller package"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge tone={statusTone(shipment.status)}>
                              {humanize(shipment.status)}
                            </StatusBadge>
                            <StatusBadge
                              tone={statusTone(shipment.assignmentStatus ?? "UNASSIGNED")}
                            >
                              {humanize(shipment.assignmentStatus ?? "UNASSIGNED")}
                            </StatusBadge>
                            {isCourierPackage ? (
                              <StatusBadge
                                tone={statusTone(
                                  shipment.courierShipment?.trackingStatus ??
                                    shipment.courierTrackingStatus ??
                                    "NOT_BOOKED",
                                )}
                              >
                                {humanize(
                                  shipment.courierShipment?.trackingStatus ??
                                    shipment.courierTrackingStatus ??
                                    "NOT_BOOKED",
                                )}
                              </StatusBadge>
                            ) : null}
                            {isManualTransportPackage ? (
                              <StatusBadge tone="warning">Manual transport</StatusBadge>
                            ) : null}
                            {shipment.routingFailed ? (
                              <StatusBadge tone="danger">Routing failed</StatusBadge>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                          <MetricCard label="Mode" value={humanize(shipment.deliveryMode)} />
                          <MetricCard
                            label="Subtotal"
                            value={formatPaise(shipment.subtotalPaise, order.currency)}
                          />
                          <MetricCard
                            label="Shipping"
                            value={formatPaise(shipment.shippingPaise, order.currency)}
                          />
                          <MetricCard
                            label="Tracking"
                            value={
                              shipment.trackingReference ?? shipment.awbNumber ?? "Not assigned"
                            }
                          />
                        </div>

                        {isCourierPackage ? (
                          <div className="mt-4 grid gap-3 rounded-md border border-[#D8E2EA] bg-white p-3">
                            <div className="grid gap-3 sm:grid-cols-4">
                              <MetricCard
                                label="Courier"
                                value={selectedProviderCode || "Not selected"}
                              />
                              <MetricCard
                                label="AWB"
                                value={
                                  shipment.courierShipment?.awbNumber ??
                                  shipment.awbNumber ??
                                  "Not booked"
                                }
                              />
                              <MetricCard
                                label="Courier COD"
                                value={remittance ? humanize(remittance.status) : "Not created"}
                              />
                              <MetricCard
                                label="Expected COD"
                                value={formatPaise(
                                  remittance?.expectedAmountPaise ?? 0,
                                  order.currency,
                                )}
                              />
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_1fr_auto] lg:items-end">
                              <label className="space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">
                                  Provider
                                </span>
                                <select
                                  value={selectedProviderCode}
                                  onChange={(event) =>
                                    updateCourierPackageForm(
                                      shipment.id,
                                      "providerCode",
                                      event.target.value,
                                    )
                                  }
                                  className="h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
                                >
                                  <option value="">Select provider</option>
                                  {activeCourierProviders.map((provider) => (
                                    <option
                                      key={provider.providerCode}
                                      value={provider.providerCode}
                                    >
                                      {provider.displayName} ({provider.providerCode})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <SmallInput
                                label="AWB number"
                                value={awbNumber}
                                onChange={(value) =>
                                  updateCourierPackageForm(shipment.id, "awbNumber", value)
                                }
                              />
                              <SmallInput
                                label="Provider order ID"
                                value={
                                  courierForm.providerOrderId ??
                                  shipment.courierShipment?.providerOrderId ??
                                  ""
                                }
                                onChange={(value) =>
                                  updateCourierPackageForm(shipment.id, "providerOrderId", value)
                                }
                              />
                              <SmallInput
                                label="Note"
                                value={courierForm.note ?? ""}
                                onChange={(value) =>
                                  updateCourierPackageForm(shipment.id, "note", value)
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={!selectedProviderCode || bookCourierShipment.isPending}
                                onClick={() =>
                                  bookCourierShipment.mutate({
                                    shipmentNumber: shipment.shipmentNumber,
                                    providerCode: selectedProviderCode,
                                    awbNumber,
                                    providerOrderId: courierForm.providerOrderId,
                                    trackingUrl: courierForm.trackingUrl,
                                    labelUrl: courierForm.labelUrl,
                                    note: courierForm.note,
                                  })
                                }
                              >
                                {selectedCourierProvider?.mode !== "MANUAL" &&
                                selectedCourierProvider?.credentialsConfigured &&
                                !awbNumber
                                  ? "Book live"
                                  : "Save courier"}
                              </Button>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
                              <SmallInput
                                label="Remitted amount Rs"
                                value={
                                  courierForm.remittedAmountRupees ??
                                  (remittance?.remittedAmountPaise
                                    ? String(remittance.remittedAmountPaise / 100)
                                    : "")
                                }
                                onChange={(value) =>
                                  updateCourierPackageForm(
                                    shipment.id,
                                    "remittedAmountRupees",
                                    value,
                                  )
                                }
                              />
                              <SmallInput
                                label="UTR/reference"
                                value={
                                  courierForm.remittanceReference ??
                                  remittance?.remittanceReference ??
                                  ""
                                }
                                onChange={(value) =>
                                  updateCourierPackageForm(
                                    shipment.id,
                                    "remittanceReference",
                                    value,
                                  )
                                }
                              />
                              <SmallInput
                                label="Report ID"
                                value={
                                  courierForm.reportReference ?? remittance?.reportReference ?? ""
                                }
                                onChange={(value) =>
                                  updateCourierPackageForm(shipment.id, "reportReference", value)
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={importCourierRemittance.isPending || !awbNumber}
                                onClick={() =>
                                  importCourierRemittance.mutate({
                                    shipmentNumber: shipment.shipmentNumber,
                                    awbNumber,
                                    remittedAmountPaise: rupeesInputToPaise(
                                      courierForm.remittedAmountRupees ?? "",
                                    ),
                                    remittanceReference: courierForm.remittanceReference,
                                    reportReference: courierForm.reportReference,
                                    notes: courierForm.remittanceNote,
                                  })
                                }
                              >
                                Save COD report
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={!canVerifyRemittance || verifyCourierRemittance.isPending}
                                onClick={() =>
                                  remittance
                                    ? confirmation.requestConfirmation({
                                        title: "Verify courier COD remittance?",
                                        description: `${shipment.shipmentNumber} will count toward COD payment verification after this.`,
                                        confirmLabel: "Verify remittance",
                                        tone: "info",
                                        onConfirm: () =>
                                          verifyCourierRemittance.mutate({
                                            remittanceId: remittance.id,
                                            decision: "VERIFY",
                                            note: courierForm.verificationNote,
                                          }),
                                      })
                                    : undefined
                                }
                              >
                                Verify COD
                              </Button>
                            </div>
                            {remittance?.verificationNote ? (
                              <p className="text-xs font-semibold text-[#667085]">
                                Finance note: {remittance.verificationNote}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ) : null}

            <Panel title="Timeline">
              <Timeline
                events={[
                  ...(order.deliveryDetail?.events ?? []).map((event) => ({
                    id: `delivery-${event.id}`,
                    label: `Delivery ${humanize(event.newStatus)}`,
                    note: event.note ?? null,
                    date: event.createdAt ?? null,
                  })),
                  ...(order.statusEvents ?? []).map((event) => ({
                    id: `status-${event.id}`,
                    label: `${humanize(event.statusType)} ${humanize(event.newStatus)}`,
                    note: event.note ?? null,
                    date: event.createdAt ?? null,
                  })),
                ]}
              />
            </Panel>
            <Panel title="Delivery attempts and proof">
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Receiver"
                    value={order.deliveryDetail?.receiverName ?? "Not recorded"}
                  />
                  <MetricCard
                    label="Proof ref"
                    value={order.deliveryDetail?.proofReference ?? "Not recorded"}
                  />
                  <MetricCard
                    label="Attempts"
                    value={`${order.deliveryDetail?.attempts?.length ?? 0}`}
                  />
                </div>
                {order.deliveryDetail?.proofNote ? (
                  <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold leading-6 text-[#667085]">
                    {order.deliveryDetail.proofNote}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  {(order.deliveryDetail?.attempts ?? []).map((attempt) => (
                    <div
                      key={attempt.id}
                      className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge tone="warning">{humanize(attempt.reason)}</StatusBadge>
                        <span className="text-xs font-bold text-[#667085]">
                          {formatDate(attempt.attemptedAt ?? attempt.createdAt)}
                        </span>
                      </div>
                      {attempt.note ? (
                        <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                          {attempt.note}
                        </p>
                      ) : null}
                      {attempt.nextAttemptDate ? (
                        <p className="mt-1 text-xs font-bold text-[#163B5C]">
                          Next attempt {formatDate(attempt.nextAttemptDate)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {(order.deliveryDetail?.attempts ?? []).length === 0 ? (
                    <p className="text-sm font-semibold text-[#667085]">No attempts recorded.</p>
                  ) : null}
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <OrderStatusForm
              currentOrderStatus={order.orderStatus}
              currentPaymentStatus={order.paymentStatus}
              onSubmit={(payload) => updateStatus.mutate(payload)}
              disabled={updateStatus.isPending}
            />
            {deliveryActionNotice ? (
              <AdminStatusNotice
                title={deliveryActionNotice.title}
                message={deliveryActionNotice.message}
                tone={deliveryActionNotice.tone}
                className="mb-0"
              />
            ) : null}
            <DeliveryForm
              delivery={order.deliveryDetail}
              deliveryPartners={listItems(deliveryPartnersQuery.data)}
              deliveryPartnersLoading={deliveryPartnersQuery.isLoading}
              deliveryPartnersError={
                deliveryPartnersQuery.error instanceof Error
                  ? deliveryPartnersQuery.error.message
                  : null
              }
              onSubmit={(payload) => updateDelivery.mutate(payload)}
              onAssign={(payload) => updateAssignment.mutate(payload)}
              onAutoAssign={() => autoAssignDelivery.mutate()}
              disabled={
                updateDelivery.isPending ||
                updateAssignment.isPending ||
                autoAssignDelivery.isPending
              }
            />
            <CodCollectionPanel
              order={order}
              disabled={verifyCodCollection.isPending}
              error={
                verifyCodCollection.error instanceof Error
                  ? verifyCodCollection.error.message
                  : null
              }
              onVerify={(note) =>
                confirmation.requestConfirmation({
                  title: "Verify COD cash?",
                  description:
                    "This marks the COD payment as paid and makes delivered paid seller splits eligible for settlement.",
                  confirmLabel: "Verify COD",
                  tone: "info",
                  onConfirm: () => verifyCodCollection.mutate({ decision: "VERIFY", note }),
                })
              }
              onReject={(note) =>
                confirmation.requestConfirmation({
                  title: "Reject COD collection?",
                  description:
                    "The delivery partner collection record stays visible, but payment remains pending until corrected and verified.",
                  confirmLabel: "Reject collection",
                  tone: "warning",
                  onConfirm: () => verifyCodCollection.mutate({ decision: "REJECT", note }),
                })
              }
            />
          </div>
        </div>
      ) : null}
      {confirmation.dialog}
    </AdminResourceChrome>
  );
}

export function AdminB2BEnquiriesPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const confirmation = useAdminConfirmation();
  const query = useAdminList<B2BEnquiryRecord>(
    "admin-b2b-enquiries",
    "/api/admin/b2b-enquiries",
    auth.authHeaders,
    search,
  );
  const updateStatus = useMutation({
    mutationFn: ({ enquiryId, status }: { enquiryId: string; status: string }) =>
      adminRequest(`/api/admin/b2b-enquiries/${enquiryId}/status`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ status, note: "Updated from admin B2B console." }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-b2b-enquiries"] }),
  });
  const respond = useMutation({
    mutationFn: ({
      enquiryId,
      responseMessage,
      quotedPricePaise,
    }: {
      enquiryId: string;
      responseMessage: string;
      quotedPricePaise?: number | undefined;
    }) =>
      adminRequest(`/api/admin/b2b-enquiries/${enquiryId}/responses`, auth.authHeaders, {
        method: "POST",
        body: JSON.stringify({ responseMessage, quotedPricePaise }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-b2b-enquiries"] }),
  });
  const approve = useMutation({
    mutationFn: (enquiryId: string) =>
      adminRequest(`/api/admin/b2b-enquiries/${enquiryId}/approve`, auth.authHeaders, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-b2b-enquiries"] }),
  });
  const finalise = useMutation({
    mutationFn: (enquiryId: string) =>
      adminRequest(`/api/admin/b2b-enquiries/${enquiryId}/finalise`, auth.authHeaders, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-b2b-enquiries"] }),
  });
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="B2B enquiries"
      description="Track business buyer requests, seller assignment, admin responses, and enquiry closure."
      icon={<Activity className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      {confirmation.dialog}
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No B2B enquiries found"
        columns={[
          {
            header: "Enquiry",
            cell: (item) => (
              <EntityTitle
                title={item.businessBuyer?.companyName ?? "Business buyer"}
                subtitle={item.product?.name ?? item.seller?.storeName ?? "General request"}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Request",
            cell: (item) => (
              <SmallStack
                lines={[
                  `Qty ${item.quantity}`,
                  item.message ?? "No message",
                  `${item.responses?.length ?? 0} responses`,
                ]}
              />
            ),
          },
          {
            header: "Actions",
            className: "min-w-[360px]",
            cell: (item) => (
              <B2BAction
                status={item.status}
                onStatus={(status) => {
                  if (["CLOSED", "CANCELLED"].includes(status)) {
                    confirmation.requestConfirmation({
                      title: `${humanize(status)} B2B enquiry?`,
                      description: `${item.businessBuyer?.companyName ?? "This buyer enquiry"} will move to ${humanize(status)} and stop normal quotation progress.`,
                      confirmLabel: humanize(status),
                      onConfirm: () => updateStatus.mutate({ enquiryId: item.id, status }),
                    });
                    return;
                  }
                  updateStatus.mutate({ enquiryId: item.id, status });
                }}
                onApprove={() =>
                  confirmation.requestConfirmation({
                    title: "Approve confirmed B2B enquiry?",
                    description: `${item.businessBuyer?.companyName ?? "This buyer"} has confirmed the quotation. Admin approval moves it to the finalisation step.`,
                    confirmLabel: "Approve enquiry",
                    tone: "warning",
                    onConfirm: () => approve.mutate(item.id),
                  })
                }
                onFinalise={() =>
                  confirmation.requestConfirmation({
                    title: "Finalise B2B enquiry?",
                    description: `${item.businessBuyer?.companyName ?? "This buyer"} will be marked finalised. This is the closing operational state for the Phase 1 quotation flow.`,
                    confirmLabel: "Finalise enquiry",
                    tone: "warning",
                    onConfirm: () => finalise.mutate(item.id),
                  })
                }
                onRespond={(responseMessage, quotedPricePaise) =>
                  respond.mutate({
                    enquiryId: item.id,
                    responseMessage,
                    ...(quotedPricePaise !== undefined ? { quotedPricePaise } : {}),
                  })
                }
                disabled={
                  updateStatus.isPending ||
                  respond.isPending ||
                  approve.isPending ||
                  finalise.isPending
                }
              />
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminBusinessBuyersPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useAdminList<BusinessBuyerRecord>(
    "admin-business-buyers",
    "/api/admin/business-buyers",
    auth.authHeaders,
    search,
  );
  const updateStatus = useMutation({
    mutationFn: ({ businessBuyerId, status }: { businessBuyerId: string; status: string }) =>
      adminRequest(`/api/admin/business-buyers/${businessBuyerId}/status`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ status, note: "Updated from admin business buyer console." }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-business-buyers"] }),
  });
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="Business buyers"
      description="Manage B2B buyer companies and their platform account status."
      icon={<Building2 className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No business buyers found"
        columns={[
          {
            header: "Company",
            cell: (item) => (
              <EntityTitle
                title={item.companyName}
                subtitle={item.gstNumber ?? item.user?.email ?? ""}
              />
            ),
          },
          {
            header: "Contact",
            cell: (item) => (
              <SmallStack lines={[item.contactName, item.contactPhone, item.user?.email ?? ""]} />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Enquiries",
            cell: (item) => (
              <span className="font-black text-[#163B5C]">{item._count?.enquiries ?? 0}</span>
            ),
          },
          {
            header: "Actions",
            cell: (item) => (
              <StatusButtons
                current={item.status}
                statuses={userStatuses}
                onPick={(status) => updateStatus.mutate({ businessBuyerId: item.id, status })}
                disabled={updateStatus.isPending}
              />
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminSupportPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useAdminList<SupportRequestRecord>(
    "admin-support",
    "/api/admin/support-requests",
    auth.authHeaders,
    search,
  );
  const updateSupport = useMutation({
    mutationFn: ({
      requestId,
      status,
      adminNote,
    }: {
      requestId: string;
      status: string;
      adminNote?: string | undefined;
    }) =>
      adminRequest(`/api/admin/support-requests/${requestId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-support"] }),
  });
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="Support desk"
      description="Handle customer, seller, and public support requests from one queue."
      icon={<ShieldAlert className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={items.length}
    >
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No support requests found"
        columns={[
          {
            header: "Requester",
            cell: (item) => <EntityTitle title={item.name} subtitle={item.email} />,
          },
          {
            header: "Subject",
            cell: (item) => <SmallStack lines={[item.subject, truncate(item.message, 100)]} />,
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Created",
            cell: (item) => (
              <span className="text-sm font-semibold text-[#667085]">
                {formatDate(item.createdAt)}
              </span>
            ),
          },
          {
            header: "Actions",
            className: "min-w-[300px]",
            cell: (item) => (
              <SupportAction
                status={item.status}
                note={item.adminNote ?? null}
                onSubmit={(status, adminNote) =>
                  updateSupport.mutate({
                    requestId: item.id,
                    status,
                    ...(adminNote !== undefined ? { adminNote } : {}),
                  })
                }
                disabled={updateSupport.isPending}
              />
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminNotificationsPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>("ALL");
  const [templateFilter, setTemplateFilter] = useState<NotificationTemplateFilter>("ALL");
  const fixedParams = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      templateCode: templateFilter === "ALL" ? undefined : templateFilter,
    }),
    [statusFilter, templateFilter],
  );
  const query = useAdminList<NotificationRecord>(
    "admin-notifications",
    "/api/admin/notifications",
    auth.authHeaders,
    search,
    "recipient",
    fixedParams,
  );
  const retry = useMutation({
    mutationFn: (logId: string) =>
      adminRequest(`/api/admin/notifications/${logId}/retry`, auth.authHeaders, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const items = listItems(query.data);
  const hasFilters = Boolean(search.trim()) || statusFilter !== "ALL" || templateFilter !== "ALL";

  return (
    <AdminResourceChrome
      title="Notification logs"
      description="Review transactional notification delivery and retry failed or skipped email logs."
      icon={<Bell className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      <div className="mb-4 grid gap-3 rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm xl:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.2fr)_auto]">
        <AdminListbox
          value={statusFilter}
          options={notificationStatusFilterOptions}
          onChange={(value) => setStatusFilter(value as NotificationStatusFilter)}
          compact
          buttonClassName="h-12 bg-white"
        />
        <AdminListbox
          value={templateFilter}
          options={notificationTemplateFilterOptions}
          onChange={(value) => setTemplateFilter(value as NotificationTemplateFilter)}
          compact
          buttonClassName="h-12 bg-white"
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5"
          onClick={() => {
            setSearch("");
            setStatusFilter("ALL");
            setTemplateFilter("ALL");
          }}
          disabled={!hasFilters}
        >
          Reset
        </Button>
      </div>
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No notification logs found"
        columns={[
          {
            header: "Template",
            cell: (item) => (
              <EntityTitle
                title={item.templateCode}
                subtitle={`${item.channel} / ${item.recipient}`}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Subject & context",
            className: "min-w-[280px]",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.subject ?? "No subject stored",
                  notificationBodyPreview(item.body),
                  ...notificationVariableLines(item.variables),
                ]}
              />
            ),
          },
          {
            header: "Provider",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.providerMessageId ?? "No provider id",
                  item.errorMessage ?? "No error",
                ]}
              />
            ),
          },
          {
            header: "Created",
            cell: (item) => (
              <span className="text-sm font-semibold text-[#667085]">
                {formatDate(item.createdAt)}
              </span>
            ),
          },
          {
            header: "Action",
            cell: (item) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retry.mutate(item.id)}
                disabled={retry.isPending || !["FAILED", "SKIPPED"].includes(item.status)}
              >
                Retry
              </Button>
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminAuditLogsPageClient() {
  const auth = useAdminAuth();
  const [search, setSearch] = useState("");
  const query = useAdminList<AuditLogRecord>(
    "admin-audit-logs",
    "/api/admin/audit-logs",
    auth.authHeaders,
    search,
    "action",
  );
  const items = listItems(query.data);

  return (
    <AdminResourceChrome
      title="Audit logs"
      description="Trace admin, seller, customer, product, order, settings, and support changes."
      icon={<ShieldCheck className="h-5 w-5" />}
      search={search}
      setSearch={setSearch}
      query={query}
      total={totalItems(query.data, items.length)}
    >
      <AdminTable
        items={items}
        isLoading={query.isLoading}
        emptyTitle="No audit logs found"
        columns={[
          {
            header: "Action",
            cell: (item) => <EntityTitle title={item.action} subtitle={item.entityId ?? item.id} />,
          },
          {
            header: "Entity",
            cell: (item) => <StatusBadge tone="info">{humanize(item.entityType)}</StatusBadge>,
          },
          {
            header: "Actor",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.actor?.email ?? item.actorUserId ?? "System",
                  item.actor?.fullName ?? "",
                ]}
              />
            ),
          },
          {
            header: "Created",
            cell: (item) => (
              <span className="text-sm font-semibold text-[#667085]">
                {formatDate(item.createdAt)}
              </span>
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminReportsPageClient() {
  const auth = useAdminAuth();
  const [range, setRange] = useState<ReportRangeState>(() => rangeForPreset("all"));
  const reportQueryString = useMemo(() => reportRangeQueryString(range), [range]);
  const reportScope = useMemo(() => reportRangeLabel(range), [range]);
  const overview = useQuery({
    queryKey: ["admin-reports-overview", auth.authHeaders, reportQueryString],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<ReportsOverview>(
        reportPath("/api/admin/reports", reportQueryString),
        undefined,
        auth.authHeaders,
      ),
  });
  const sales = useQuery({
    queryKey: ["admin-reports-sales", auth.authHeaders, reportQueryString],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<AdminSalesReport>(
        reportPath("/api/admin/reports/sales", reportQueryString),
        undefined,
        auth.authHeaders,
      ),
  });
  const sellers = useQuery({
    queryKey: ["admin-reports-sellers", auth.authHeaders, reportQueryString],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<AdminSellerReport>(
        reportPath("/api/admin/reports/sellers", reportQueryString),
        undefined,
        auth.authHeaders,
      ),
  });
  const products = useQuery({
    queryKey: ["admin-reports-products", auth.authHeaders, reportQueryString],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<AdminProductReport>(
        reportPath("/api/admin/reports/products", reportQueryString),
        undefined,
        auth.authHeaders,
      ),
  });
  const enquiries = useQuery({
    queryKey: ["admin-reports-enquiries", auth.authHeaders, reportQueryString],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<AdminEnquiryReport>(
        reportPath("/api/admin/reports/enquiries", reportQueryString),
        undefined,
        auth.authHeaders,
      ),
  });

  return (
    <AdminResourceChrome
      title="Reports"
      description="Sales, seller, product, enquiry, and support reporting."
      icon={<Activity className="h-5 w-5" />}
      query={overview}
    >
      <ReportControlPanel
        range={range}
        scopeLabel={reportScope}
        onRangeChange={setRange}
        exports={[
          {
            label: "Sales CSV",
            disabled: !sales.data,
            onSelect: () => sales.data && exportSalesReport(sales.data, range),
          },
          {
            label: "Sellers CSV",
            disabled: !sellers.data,
            onSelect: () => sellers.data && exportSellerReport(sellers.data, range),
          },
          {
            label: "Products CSV",
            disabled: !products.data,
            onSelect: () => products.data && exportProductReport(products.data, range),
          },
          {
            label: "B2B and support CSV",
            disabled: !enquiries.data,
            onSelect: () => enquiries.data && exportEnquiryReport(enquiries.data, range),
          },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Revenue" value={formatPaise(overview.data?.totals.revenuePaise ?? 0)} />
        <MetricCard label="Orders" value={`${overview.data?.totals.orderCount ?? 0}`} />
        <MetricCard label="Customers" value={`${overview.data?.totals.customers ?? 0}`} />
        <MetricCard label="Sellers" value={`${overview.data?.totals.sellers ?? 0}`} />
        <MetricCard label="B2B enquiries" value={`${overview.data?.totals.b2bEnquiries ?? 0}`} />
      </div>
      <AdminTabs
        className="mt-5"
        tabs={[
          {
            key: "sales",
            label: "Sales",
            panel: (
              <SalesReportPanel data={sales.data} isLoading={sales.isLoading} error={sales.error} />
            ),
          },
          {
            key: "sellers",
            label: "Sellers",
            panel: (
              <SellerReportPanel
                data={sellers.data}
                isLoading={sellers.isLoading}
                error={sellers.error}
              />
            ),
          },
          {
            key: "products",
            label: "Products",
            panel: (
              <ProductReportPanel
                data={products.data}
                isLoading={products.isLoading}
                error={products.error}
              />
            ),
          },
          {
            key: "enquiries",
            label: "Enquiries",
            panel: (
              <EnquiryReportPanel
                data={enquiries.data}
                isLoading={enquiries.isLoading}
                error={enquiries.error}
              />
            ),
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

export function AdminSettingsPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["admin-settings", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<SettingRecord[]>("/api/admin/settings", undefined, auth.authHeaders),
  });
  const settings = useMemo(() => settingsQuery.data ?? [], [settingsQuery.data]);
  const paymentReadinessQuery = useQuery({
    queryKey: ["admin-payments-readiness", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<PaymentReadiness>("/api/admin/payments/readiness", undefined, auth.authHeaders),
  });
  const paymentConfigQuery = useQuery({
    queryKey: ["admin-payments-config", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<PaymentConfiguration>("/api/admin/payments/config", undefined, auth.authHeaders),
  });
  const storageReadinessQuery = useQuery({
    queryKey: ["admin-storage-readiness", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<StorageReadiness>("/api/storage/readiness", undefined, auth.authHeaders),
  });
  const storageConfigQuery = useQuery({
    queryKey: ["admin-storage-configuration", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<StorageConfiguration>("/api/storage/configuration", undefined, auth.authHeaders),
  });

  const updatePaymentConfig = useMutation({
    mutationFn: (payload: unknown) =>
      adminRequest("/api/admin/payments/config", auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-payments-readiness"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-payments-config"] }),
        queryClient.invalidateQueries({ queryKey: ["checkout-payment-methods"] }),
        queryClient.invalidateQueries({ queryKey: ["checkout-summary"] }),
      ]);
    },
  });
  const updateStorageConfig = useMutation({
    mutationFn: (payload: unknown) =>
      indihubFetch<StorageConfiguration>(
        "/api/storage/configuration",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        auth.authHeaders,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-storage-readiness"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-storage-configuration"] }),
      ]);
    },
  });
  const paymentReadiness = paymentReadinessQuery.data;
  const storageReadiness = storageReadinessQuery.data;

  return (
    <AdminResourceChrome
      title="Configuration center"
      description="Manage operational configuration from the database. Keep .env limited to startup, auth, queue, and bootstrap values."
      icon={<Settings className="h-5 w-5" />}
      query={settingsQuery}
    >
      <AdminTabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            panel: (
              <SettingsOverviewPanel
                settings={settings}
                paymentReadiness={paymentReadiness}
                storageReadiness={storageReadiness}
                paymentLoading={paymentReadinessQuery.isLoading}
                storageLoading={storageReadinessQuery.isLoading}
              />
            ),
          },
          {
            key: "checkout-payments",
            label: "Checkout & payments",
            panel: (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <ReadinessCard
                    title="Razorpay keys"
                    ready={paymentReadiness?.razorpay.configured ?? false}
                    detail={paymentReadiness?.razorpay.keyIdPreview ?? "Saved in DB when set"}
                  />
                  <ReadinessCard
                    title="Razorpay webhook"
                    ready={paymentReadiness?.webhook.configured ?? false}
                    detail="Webhook secret check"
                  />
                  <ReadinessCard
                    title="Cash on delivery"
                    ready={paymentReadiness?.cod.enabled ?? false}
                    detail={
                      paymentReadiness?.cod.maxOrderPaise
                        ? `Limit ${formatPaise(paymentReadiness.cod.maxOrderPaise)}`
                        : "Checkout option"
                    }
                  />
                  <ReadinessCard
                    title="Bank transfer"
                    ready={Boolean(
                      paymentReadiness?.bankTransfer.enabled &&
                      paymentReadiness.bankTransfer.configured,
                    )}
                    detail={paymentReadiness?.bankTransfer.destinationPreview ?? "Bank/UPI details"}
                  />
                  <ReadinessCard
                    title="Manual payment"
                    ready={paymentReadiness?.manual.enabled ?? false}
                    detail="Checkout option"
                  />
                </div>
                {paymentConfigQuery.isLoading ? (
                  <div className="h-56 animate-pulse rounded-lg bg-[#F8FAFC]" />
                ) : null}
                {paymentReadinessQuery.isError || paymentConfigQuery.isError ? (
                  <PanelStatus
                    title="Payment config unavailable"
                    message={mutationErrorMessage(
                      paymentConfigQuery.error ?? paymentReadinessQuery.error,
                    )}
                    tone="danger"
                  />
                ) : null}
                {updatePaymentConfig.isError ? (
                  <PanelStatus
                    title="Payment config not saved"
                    message={mutationErrorMessage(updatePaymentConfig.error)}
                    tone="danger"
                  />
                ) : null}
                {updatePaymentConfig.isSuccess ? (
                  <AdminStatusNotice
                    title="Payment configuration saved"
                    message="Checkout methods and provider readiness now read from the saved database settings."
                    tone="success"
                  />
                ) : null}
                {paymentConfigQuery.data ? (
                  <PaymentConfigurationForm
                    config={paymentConfigQuery.data}
                    disabled={updatePaymentConfig.isPending}
                    onSubmit={(payload) => updatePaymentConfig.mutate(payload)}
                  />
                ) : null}
                <CheckoutFeeSettings settings={settings} />
              </div>
            ),
          },
          {
            key: "email",
            label: "Email",
            panel: <EmailSettingsPanel />,
          },
          {
            key: "courier-integrations",
            label: "Courier integrations",
            panel: (
              <div className="space-y-5">
                <MapRoutingSettings />
                <CourierProviderSettingsPanel authHeaders={auth.authHeaders} />
              </div>
            ),
          },
          {
            key: "storage",
            label: "Storage",
            panel: (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadinessCard
                    title="Public image uploads"
                    ready={storageReadiness?.publicImages?.configured ?? false}
                    detail={
                      storageReadiness?.publicImages?.provider === "S3"
                        ? (storageReadiness.publicImages.s3Bucket ?? "S3 bucket")
                        : publicImageProviderLabel(storageReadiness?.publicImages?.provider)
                    }
                  />
                  <ReadinessCard
                    title="Private document storage"
                    ready={storageReadiness?.privateStorage.configured ?? false}
                    detail={storageReadiness?.privateStorage.bucket ?? "S3-compatible storage"}
                  />
                </div>
                {storageConfigQuery.isLoading ? (
                  <div className="h-56 animate-pulse rounded-lg bg-[#F8FAFC]" />
                ) : null}
                {storageReadinessQuery.isError || storageConfigQuery.isError ? (
                  <PanelStatus
                    title="Storage config unavailable"
                    message={mutationErrorMessage(
                      storageConfigQuery.error ?? storageReadinessQuery.error,
                    )}
                    tone="danger"
                  />
                ) : null}
                {updateStorageConfig.isError ? (
                  <PanelStatus
                    title="Storage config not saved"
                    message={mutationErrorMessage(updateStorageConfig.error)}
                    tone="danger"
                  />
                ) : null}
                {updateStorageConfig.isSuccess ? (
                  <AdminStatusNotice
                    title="Storage configuration saved"
                    message="Upload readiness now reads from the saved database provider settings."
                    tone="success"
                  />
                ) : null}
                {storageConfigQuery.data ? (
                  <StorageConfigurationForm
                    config={storageConfigQuery.data}
                    disabled={updateStorageConfig.isPending}
                    onSubmit={(payload) => updateStorageConfig.mutate(payload)}
                  />
                ) : null}
                <Panel title="Storage tools">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
                      Provider credentials are managed here. Folder browsing and asset inspection
                      stay in the dedicated storage workspace.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/admin/storage">
                        <FolderOpen className="h-4 w-4" /> Open storage browser
                      </Link>
                    </Button>
                  </div>
                </Panel>
              </div>
            ),
          },
          {
            key: "payouts",
            label: "Payouts",
            panel: (
              <div className="space-y-5">
                <SellerPayoutSettings settings={settings} />
                <DeliveryPartnerPayoutSettings settings={settings} />
                <Panel title="Finance records">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
                      Commission rules, settlements, payout approvals, ledgers, and statements are
                      stored as finance records and managed in the finance workspace.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/admin/finance/commission-rules">
                        <Landmark className="h-4 w-4" /> Open commission rules
                      </Link>
                    </Button>
                  </div>
                </Panel>
              </div>
            ),
          },
          {
            key: "records",
            label: "DB records",
            badge: settings.length,
            panel: <SettingInventoryPanel settings={settings} />,
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

function CourierProviderSettingsPanel({ authHeaders }: { authHeaders: IndihubAuthHeaders }) {
  const queryClient = useQueryClient();
  const [selectedProviderCode, setSelectedProviderCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<CourierProviderFormState>(() => defaultCourierProviderForm());
  const providersQuery = useQuery({
    queryKey: ["admin-courier-providers", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<CourierProviderResponse>("/api/admin/courier-providers", undefined, authHeaders),
  });
  const locationCatalog = useLocationCatalog({ countryCode: "" });
  const providers = providersQuery.data?.items ?? [];
  const selectedProvider =
    providers.find((provider) => provider.providerCode === selectedProviderCode) ?? null;
  const countryChoices = countrySelectChoices(locationCatalog.countries, form.serviceableCountries);
  const saveProvider = useMutation({
    mutationFn: () =>
      adminRequest<CourierProviderRecord>("/api/admin/courier-providers", authHeaders, {
        method: "POST",
        body: JSON.stringify(courierProviderPayloadFromForm(form)),
      }),
    onSuccess: async (provider) => {
      setIsCreating(false);
      setSelectedProviderCode(provider.providerCode);
      setForm(courierProviderFormFromRecord(provider));
      await queryClient.invalidateQueries({ queryKey: ["admin-courier-providers"] });
    },
  });

  useEffect(() => {
    if (providersQuery.isLoading) {
      return;
    }
    if (!providers.length) {
      if (!isCreating) {
        setIsCreating(true);
        setSelectedProviderCode("");
        setForm(defaultCourierProviderForm());
      }
      return;
    }
    if (!selectedProviderCode && !isCreating) {
      setSelectedProviderCode(providers[0]?.providerCode ?? "");
    }
  }, [isCreating, providers, providersQuery.isLoading, selectedProviderCode]);

  useEffect(() => {
    if (!selectedProvider || isCreating) {
      return;
    }
    setForm(courierProviderFormFromRecord(selectedProvider));
  }, [isCreating, selectedProvider]);

  const providerOptions: AdminSelectOption[] = [
    {
      value: "__NEW__",
      label: "New courier provider",
      description: "Create another provider configuration.",
    },
    ...providers.map((provider) => ({
      value: provider.providerCode,
      label: provider.displayName,
      description: `${provider.providerCode} / ${provider.isActive ? "Active" : "Inactive"} / ${provider.mode}`,
    })),
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <ReadinessCard
          title="Configured providers"
          ready={providers.some((provider) => provider.isActive)}
          detail={`${providers.length} saved / ${providers.filter((provider) => provider.isActive).length} active`}
        />
        <ReadinessCard
          title="Credential readiness"
          ready={providers.some((provider) => provider.isActive && provider.credentialsConfigured)}
          detail={`${providers.filter((provider) => provider.credentialsConfigured).length} marked ready`}
        />
        <ReadinessCard
          title="Webhook readiness"
          ready={providers.some(
            (provider) => provider.isActive && provider.webhookSecretConfigured,
          )}
          detail={`${providers.filter((provider) => provider.webhookSecretConfigured).length} configured`}
        />
      </div>
      {saveProvider.isError ? (
        <PanelStatus
          title="Courier provider not saved"
          message={mutationErrorMessage(saveProvider.error)}
          tone="danger"
        />
      ) : null}
      {saveProvider.isSuccess ? (
        <AdminStatusNotice
          title="Courier provider saved"
          message="Checkout routing and delivery fallback now read this provider configuration from the database."
          tone="success"
        />
      ) : null}
      <Panel title="Third-party courier integrations">
        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="grid gap-3">
            <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3 text-xs font-bold leading-5 text-[#526173]">
              Select an existing provider to edit it, or create a new provider configuration.
              Routing never depends on a courier name hardcoded in the UI; it uses active provider
              records and serviceable countries.
            </div>
            <AdminListbox
              label="Provider"
              value={isCreating ? "__NEW__" : selectedProviderCode}
              options={providerOptions}
              onChange={(value) => {
                if (value === "__NEW__") {
                  setIsCreating(true);
                  setSelectedProviderCode("");
                  setForm(defaultCourierProviderForm());
                  return;
                }
                setIsCreating(false);
                setSelectedProviderCode(value);
              }}
              compact
              buttonClassName="h-11 bg-white"
            />
            <div className="grid gap-2">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedProviderCode(provider.providerCode);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition",
                    provider.providerCode === selectedProviderCode && !isCreating
                      ? "border-[#ED3500] bg-[#FFF5F1]"
                      : "border-[#E5E7EB] bg-white hover:border-[#D8E2EA]",
                  )}
                >
                  <span className="block font-black text-[#1F2933]">{provider.displayName}</span>
                  <span className="block text-xs font-bold text-[#667085]">
                    {provider.providerCode} /{" "}
                    {provider.serviceableCountryCodes.join(", ") || "no countries"}
                  </span>
                </button>
              ))}
              {!providersQuery.isLoading && !providers.length ? (
                <p className="text-sm font-semibold text-[#667085]">
                  No provider records yet. Create the first courier integration here.
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase text-[#667085]">Provider code</span>
                <input
                  value={form.providerCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      providerCode: normalizeProviderCodeInput(event.target.value),
                    }))
                  }
                  disabled={!isCreating}
                  placeholder="Example: PROVIDER_CODE"
                  className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500] disabled:bg-[#F8FAFC]"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase text-[#667085]">Display name</span>
                <input
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  placeholder="Provider display name"
                  className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <AdminListbox
                label="Provider mode"
                value={form.mode}
                options={courierProviderModeOptions}
                onChange={(mode) => setForm((current) => ({ ...current, mode }))}
                compact
                buttonClassName="h-11 bg-white"
              />
              <AdminSwitch
                label="Active for routing"
                description="When active, this provider can be chosen for countries selected below."
                checked={form.isActive}
                onChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
              />
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase text-[#667085]">
                Serviceable countries
              </span>
              <select
                multiple
                value={form.serviceableCountries}
                onChange={(event) => {
                  const selectedCountries = Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  );
                  setForm((current) => ({
                    ...current,
                    serviceableCountries: selectedCountries,
                  }));
                }}
                size={Math.min(8, Math.max(4, countryChoices.length))}
                className="min-h-32 rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500]"
              >
                {countryChoices.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
              <span className="text-xs font-bold text-[#667085]">
                Hold Ctrl to choose multiple countries. The list comes from the location database.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    serviceableCountries: countryChoices.map((country) => country.code),
                  }))
                }
              >
                Select all countries
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((current) => ({ ...current, serviceableCountries: [] }))}
              >
                Clear countries
              </Button>
            </div>
            <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
              <div className="mb-4">
                <h3 className="text-sm font-black text-[#1F2933]">Live API adapter</h3>
                <p className="mt-1 text-xs font-bold leading-5 text-[#667085]">
                  Configure the provider adapter and API credentials here. Leave secret fields blank
                  to keep the saved value; saved secrets are never shown back in the browser.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">Adapter code</span>
                  <input
                    value={form.adapterCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        adapterCode: normalizeProviderCodeInput(event.target.value),
                      }))
                    }
                    placeholder="GENERIC_REST"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">API base URL</span>
                  <input
                    value={form.apiBaseUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))
                    }
                    placeholder="https://api.provider.com"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Booking endpoint
                  </span>
                  <input
                    value={form.bookingEndpointPath}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bookingEndpointPath: event.target.value,
                      }))
                    }
                    placeholder="/v1/shipments/book"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Tracking endpoint
                  </span>
                  <input
                    value={form.trackingEndpointPath}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        trackingEndpointPath: event.target.value,
                      }))
                    }
                    placeholder="/v1/shipments/track"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Label endpoint
                  </span>
                  <input
                    value={form.labelEndpointPath}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, labelEndpointPath: event.target.value }))
                    }
                    placeholder="/v1/shipments/label"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Cancellation endpoint
                  </span>
                  <input
                    value={form.cancellationEndpointPath}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cancellationEndpointPath: event.target.value,
                      }))
                    }
                    placeholder="/v1/shipments/cancel"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Account / client code
                  </span>
                  <input
                    value={form.accountCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, accountCode: event.target.value }))
                    }
                    placeholder="Merchant account code"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">API username</span>
                  <input
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="Provider username"
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    API key / token
                  </span>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, apiKey: event.target.value }))
                    }
                    placeholder={
                      selectedProvider?.apiKeyConfigured
                        ? "Saved - leave blank to keep"
                        : "Paste API key"
                    }
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">API secret</span>
                  <input
                    type="password"
                    value={form.apiSecret}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, apiSecret: event.target.value }))
                    }
                    placeholder={
                      selectedProvider?.apiSecretConfigured
                        ? "Saved - leave blank to keep"
                        : "Paste API secret"
                    }
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Password / auth token
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder={
                      selectedProvider?.passwordConfigured
                        ? "Saved - leave blank to keep"
                        : "Optional"
                    }
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-[#667085]">
                    Webhook secret
                  </span>
                  <input
                    type="password"
                    value={form.webhookSecret}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, webhookSecret: event.target.value }))
                    }
                    placeholder={
                      selectedProvider?.webhookSecretConfigured
                        ? "Saved - leave blank to keep"
                        : "Tracking webhook secret"
                    }
                    className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                  />
                </label>
              </div>
              <div className="mt-4 rounded-md border border-[#E5E7EB] bg-white p-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Default package fallback
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase text-[#667085]">
                      Weight g
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.defaultPackageWeightGrams}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          defaultPackageWeightGrams: event.target.value,
                        }))
                      }
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase text-[#667085]">
                      Length cm
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.defaultPackageLengthCm}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          defaultPackageLengthCm: event.target.value,
                        }))
                      }
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase text-[#667085]">
                      Breadth cm
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.defaultPackageBreadthCm}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          defaultPackageBreadthCm: event.target.value,
                        }))
                      }
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-black uppercase text-[#667085]">
                      Height cm
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.defaultPackageHeightCm}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          defaultPackageHeightCm: event.target.value,
                        }))
                      }
                      className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <AdminSwitch
                label="Credentials configured"
                description="Auto enabled when API credentials, account code, or username are saved."
                checked={form.credentialsConfigured}
                onChange={(credentialsConfigured) =>
                  setForm((current) => ({ ...current, credentialsConfigured }))
                }
              />
              <AdminSwitch
                label="Webhook configured"
                description="Auto enabled when a webhook secret is saved."
                checked={form.webhookSecretConfigured}
                onChange={(webhookSecretConfigured) =>
                  setForm((current) => ({ ...current, webhookSecretConfigured }))
                }
              />
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-black uppercase text-[#667085]">Admin note</span>
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={3}
                placeholder="Credential location, account status, support contact, or provider setup note"
                className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-[#667085]">
                Live API booking can be connected behind this provider record without changing
                checkout routing rules.
              </p>
              <Button
                type="button"
                onClick={() => saveProvider.mutate()}
                disabled={
                  saveProvider.isPending || !form.providerCode.trim() || !form.displayName.trim()
                }
              >
                {isCreating ? "Create provider" : "Save provider"}
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SettingsOverviewPanel({
  settings,
  paymentReadiness,
  storageReadiness,
  paymentLoading,
  storageLoading,
}: {
  settings: SettingRecord[];
  paymentReadiness?: PaymentReadiness | undefined;
  storageReadiness?: StorageReadiness | undefined;
  paymentLoading?: boolean;
  storageLoading?: boolean;
}) {
  const platformFeeEnabled = settingBoolean(settings, "checkout.platform_fee.enabled", false);
  const platformFeeType = String(
    settingValue(settings, "checkout.platform_fee.type") ?? "PERCENTAGE",
  );
  const platformFeeBps =
    Number(settingValue(settings, "checkout.platform_fee.value_bps") ?? 0) || 0;
  const platformFeeFixedPaise =
    Number(settingValue(settings, "checkout.platform_fee.fixed_paise") ?? 0) || 0;
  const payoutRequestsEnabled = settingBoolean(settings, "seller.payout.requests_enabled", true);
  const payoutMinimumPaise =
    Number(settingValue(settings, "seller.payout.minimum_paise") ?? 0) || 0;
  const configuredPaymentMethods = [
    paymentReadiness?.razorpay.configured,
    paymentReadiness?.cod.enabled,
    paymentReadiness?.bankTransfer.enabled && paymentReadiness.bankTransfer.configured,
    paymentReadiness?.manual.enabled,
  ].filter(Boolean).length;
  const configuredStorageProviders = [
    storageReadiness?.publicImages?.configured,
    storageReadiness?.privateStorage.enabled && storageReadiness.privateStorage.configured,
  ].filter(Boolean).length;
  const platformFeeDetail = !platformFeeEnabled
    ? "Disabled"
    : platformFeeType === "PERCENTAGE"
      ? `${platformFeeBps / 100}% of subtotal`
      : platformFeeType === "FIXED"
        ? formatPaise(platformFeeFixedPaise)
        : "Manual fee mode";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SettingsSummaryCard
          icon={<Landmark className="h-5 w-5" />}
          title="Payments"
          status={
            paymentLoading
              ? "Checking"
              : configuredPaymentMethods
                ? `${configuredPaymentMethods} ready`
                : "Needs setup"
          }
          tone={configuredPaymentMethods ? "success" : paymentLoading ? "info" : "warning"}
          detail="DB-managed checkout methods and payment provider credentials."
        />
        <SettingsSummaryCard
          icon={<BadgePercent className="h-5 w-5" />}
          title="Platform fee"
          status={platformFeeEnabled ? "Applied" : "Disabled"}
          tone={platformFeeEnabled ? "success" : "warning"}
          detail={platformFeeDetail}
        />
        <SettingsSummaryCard
          icon={<Mail className="h-5 w-5" />}
          title="Email"
          status="DB managed"
          tone="success"
          detail="Provider, sender, credentials, templates, themes, triggers, and logs."
        />
        <SettingsSummaryCard
          icon={<Database className="h-5 w-5" />}
          title="Storage"
          status={
            storageLoading
              ? "Checking"
              : configuredStorageProviders
                ? `${configuredStorageProviders} ready`
                : "Needs setup"
          }
          tone={configuredStorageProviders ? "success" : storageLoading ? "info" : "warning"}
          detail="Public image and private document credentials saved in database settings."
        />
        <SettingsSummaryCard
          icon={<Store className="h-5 w-5" />}
          title="Seller payouts"
          status={payoutRequestsEnabled ? "Enabled" : "Disabled"}
          tone={payoutRequestsEnabled ? "success" : "warning"}
          detail={`Minimum request ${formatPaise(payoutMinimumPaise || 0)}`}
        />
      </div>

      <Panel title="Configuration ownership">
        <div className="grid gap-5 xl:grid-cols-2">
          <ConfigOwnershipList
            title="Saved in database"
            description="Admin-editable operational controls live in database rows or domain records, so restarts and seed safety do not reset them."
            items={databaseManagedConfigGroups}
            tone="success"
          />
          <ConfigOwnershipList
            title="Kept in .env"
            description="Only startup, identity, queue, and bootstrap values stay in environment files because the app needs them before the admin panel can load."
            items={environmentOnlyConfigGroups}
            tone="info"
          />
        </div>
      </Panel>

      <Panel title="Provider handling">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <KeyRound className="h-4 w-4" />,
              title: "Secrets are masked",
              detail:
                "Saved provider secrets are never printed in this page or the DB record table.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4" />,
              title: "Audit-backed changes",
              detail:
                "Sensitive admin saves flow through provider APIs that already write audit entries.",
            },
            {
              icon: <RefreshCw className="h-4 w-4" />,
              title: "Fallbacks stay compatible",
              detail:
                "Existing environment fallback keys still work for old deployments, but the normal admin path is DB-backed.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#1F2933]">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-[#ED3500]">
                  {item.icon}
                </span>
                {item.title}
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#667085]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SettingsSummaryCard({
  icon,
  title,
  status,
  detail,
  tone,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          {icon}
        </span>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
      <h3 className="mt-4 text-base font-black text-[#1F2933]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">{detail}</p>
    </article>
  );
}

function ConfigurationMovedPanel({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              {description}
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={href}>
            {actionLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function ConfigOwnershipList({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: ReadonlyArray<{ title: string; detail: string; keys?: readonly string[] | undefined }>;
  tone: StatusTone;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#1F2933]">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{description}</p>
        </div>
        <StatusBadge tone={tone}>{items.length} groups</StatusBadge>
      </div>
      <div className="mt-4 divide-y divide-[#E5E7EB] rounded-md border border-[#D8E2EA] bg-[#F8FAFC]">
        {items.map((item) => (
          <div key={item.title} className="p-4">
            <p className="font-black text-[#1F2933]">{item.title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{item.detail}</p>
            {item.keys?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.keys.map((key) => (
                  <code
                    key={key}
                    className="rounded-md border border-[#D8E2EA] bg-white px-2 py-1 text-xs font-black text-[#163B5C]"
                  >
                    {key}
                  </code>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingInventoryPanel({ settings }: { settings: SettingRecord[] }) {
  const groupedSettings = useMemo(() => {
    const groups = new Map<string, SettingRecord[]>();
    settings.forEach((setting) => {
      const group = setting.group || "platform";
      groups.set(group, [...(groups.get(group) ?? []), setting]);
    });
    return Array.from(groups.entries())
      .map(([group, items]) => ({
        group,
        items: items.slice().sort((first, second) => first.key.localeCompare(second.key)),
      }))
      .sort((first, second) => first.group.localeCompare(second.group));
  }, [settings]);

  return (
    <div className="space-y-5">
      <Panel title="Database setting records">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
            This inventory is for support and audit review. Values that look like credentials are
            masked even for admins.
          </p>
          <StatusBadge tone="info">{settings.length.toLocaleString("en-IN")} rows</StatusBadge>
        </div>
        {!settings.length ? (
          <p className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            No platform settings have been saved yet.
          </p>
        ) : null}
        <div className="space-y-4">
          {groupedSettings.map(({ group, items }) => (
            <section key={group} className="overflow-hidden rounded-lg border border-[#D8E2EA]">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] px-4 py-3">
                <h3 className="font-black text-[#1F2933]">{humanize(group)}</h3>
                <StatusBadge tone="neutral">{items.length} rows</StatusBadge>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#667085]">
                      <th className="px-4 py-3">Key</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white">
                    {items.map((setting) => (
                      <tr key={setting.id} className="align-top">
                        <td className="px-4 py-3 font-black text-[#1F2933]">{setting.key}</td>
                        <td className="px-4 py-3 text-xs font-black uppercase tracking-wide text-[#667085]">
                          {setting.valueType}
                        </td>
                        <td className="max-w-xl break-words px-4 py-3 font-semibold text-[#667085]">
                          {settingDisplayValue(setting)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#667085]">
                          {formatDate(setting.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function AdminPaymentsPageClient() {
  const auth = useAdminAuth();
  const readinessQuery = useQuery({
    queryKey: ["admin-payments-readiness", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<PaymentReadiness>("/api/admin/payments/readiness", undefined, auth.authHeaders),
  });
  const readiness = readinessQuery.data;

  return (
    <AdminResourceChrome
      title="Payment readiness"
      description="Monitor checkout payment readiness. Edit payment provider credentials and checkout methods from Settings."
      icon={<Landmark className="h-5 w-5" />}
      query={readinessQuery}
    >
      <div className="space-y-5">
        <ConfigurationMovedPanel
          title="Payment configuration lives in Settings"
          description="Razorpay keys, webhook secret, COD rules, bank transfer details, manual payment, and buyer platform fee are managed from the single configuration center."
          href="/admin/settings/general"
          actionLabel="Open Settings"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReadinessCard
            title="Razorpay keys"
            ready={readiness?.razorpay.configured ?? false}
            detail={readiness?.razorpay.keyIdPreview ?? "Keys not set"}
          />
          <ReadinessCard
            title="Razorpay webhook"
            ready={readiness?.webhook.configured ?? false}
            detail="Webhook secret check"
          />
          <ReadinessCard
            title="Cash on delivery"
            ready={readiness?.cod.enabled ?? false}
            detail={
              readiness?.cod.maxOrderPaise
                ? `Limit ${formatPaise(readiness.cod.maxOrderPaise)}`
                : "Checkout option"
            }
          />
          <ReadinessCard
            title="Bank transfer"
            ready={Boolean(readiness?.bankTransfer.enabled && readiness.bankTransfer.configured)}
            detail={readiness?.bankTransfer.destinationPreview ?? "Bank/UPI details"}
          />
          <ReadinessCard
            title="Manual payment"
            ready={readiness?.manual.enabled ?? false}
            detail="Checkout option"
          />
        </div>
      </div>
    </AdminResourceChrome>
  );
}

export function AdminStoragePageClient() {
  const auth = useAdminAuth();
  const query = useQuery({
    queryKey: ["admin-storage-readiness", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<StorageReadiness>("/api/storage/readiness", undefined, auth.authHeaders),
  });
  const readiness = query.data;

  return (
    <AdminResourceChrome
      title="Storage readiness"
      description="Monitor storage provider readiness. Edit storage provider credentials from Settings."
      icon={<Database className="h-5 w-5" />}
      query={query}
    >
      <div className="space-y-5">
        <ConfigurationMovedPanel
          title="Storage configuration lives in Settings"
          description="Public image provider credentials and optional private S3-compatible storage settings are managed from the single configuration center."
          href="/admin/settings/general"
          actionLabel="Open Settings"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <ReadinessCard
            title="Public image uploads"
            ready={readiness?.publicImages?.configured ?? false}
            detail={
              readiness?.publicImages?.provider === "S3"
                ? (readiness.publicImages.s3Bucket ?? "S3 bucket")
                : publicImageProviderLabel(readiness?.publicImages?.provider)
            }
          />
          <ReadinessCard
            title="Private document storage"
            ready={readiness?.privateStorage.configured ?? false}
            detail={readiness?.privateStorage.bucket ?? "S3-compatible private storage"}
          />
        </div>
      </div>
    </AdminResourceChrome>
  );
}

export function AdminCmsPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useAdminConfirmation();
  const [editingContent, setEditingContent] = useState<ContentEditRequest | null>(null);
  const [editingSeoEntry, setEditingSeoEntry] = useState<SeoEntryRecord | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<CmsMenuItemRecord | null>(null);
  const [menuAreaFilter, setMenuAreaFilter] = useState("header");
  const [seoProductSearch, setSeoProductSearch] = useState("");
  const pages = useAdminList<CmsPageRecord>(
    "admin-cms-pages",
    "/api/admin/cms/pages",
    auth.authHeaders,
  );
  const banners = useAdminList<BannerRecord>(
    "admin-cms-banners",
    "/api/admin/cms/banners",
    auth.authHeaders,
  );
  const sections = useAdminList<HomepageSectionRecord>(
    "admin-cms-homepage-sections",
    "/api/admin/cms/homepage-sections",
    auth.authHeaders,
  );
  const seoEntries = useAdminList<SeoEntryRecord>(
    "admin-cms-seo",
    "/api/admin/cms/seo",
    auth.authHeaders,
  );
  const redirects = useAdminList<CmsRedirectRecord>(
    "admin-cms-redirects",
    "/api/admin/cms/redirects",
    auth.authHeaders,
  );
  const mediaAssets = useAdminList<CmsMediaAssetRecord>(
    "admin-cms-media",
    "/api/admin/cms/media",
    auth.authHeaders,
  );
  const menuItems = useQuery({
    queryKey: ["admin-cms-menus", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<CmsMenuItemRecord[]>("/api/admin/cms/menus", undefined, auth.authHeaders),
  });
  const revisions = useAdminList<CmsRevisionRecord>(
    "admin-cms-revisions",
    "/api/admin/cms/revisions",
    auth.authHeaders,
  );
  const seoOverview = useQuery({
    queryKey: ["admin-cms-seo-overview", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<SeoOverviewRecord>("/api/admin/cms/seo/overview", undefined, auth.authHeaders),
  });
  const sitemapOverview = useQuery({
    queryKey: ["admin-cms-sitemap", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<CmsSitemapOverviewRecord>("/api/admin/cms/sitemap", undefined, auth.authHeaders),
  });
  const sectionCategories = useQuery({
    queryKey: ["admin-cms-section-categories", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<CategoryRecord[]>("/api/admin/categories", undefined, auth.authHeaders),
  });
  const sectionProducts = useAdminList<ProductRecord>(
    "admin-cms-section-products",
    "/api/admin/products",
    auth.authHeaders,
    "",
    "search",
    {
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    },
  );
  const seoProducts = useAdminList<ProductRecord>(
    "admin-cms-seo-products",
    "/api/admin/products",
    auth.authHeaders,
    seoProductSearch,
    "search",
    {
      status: "ACTIVE",
      approvalStatus: "APPROVED",
    },
  );
  const sectionSellers = useAdminList<SellerRecord>(
    "admin-cms-section-sellers",
    "/api/admin/sellers",
    auth.authHeaders,
    "",
    "search",
    {
      status: "APPROVED",
      approvalStatus: "APPROVED",
    },
  );
  const createPage = useMutation({
    mutationFn: (payload: { title: string; slug: string; content: string; status: string }) =>
      adminRequest("/api/admin/cms/pages", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });
  const updatePage = useMutation({
    mutationFn: ({
      pageId,
      payload,
    }: {
      pageId: string;
      payload: Partial<{ title: string; slug: string; content: string; status: string }>;
    }) =>
      adminRequest(`/api/admin/cms/pages/${pageId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });
  const archivePage = useMutation({
    mutationFn: (pageId: string) =>
      adminRequest(`/api/admin/cms/pages/${pageId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] }),
  });
  const createBanner = useMutation({
    mutationFn: (payload: {
      title: string;
      subtitle?: string | undefined;
      imageUrl?: string | undefined;
      linkUrl?: string | undefined;
      eyebrow?: string | undefined;
      ctaLabel?: string | undefined;
      secondaryCtaLabel?: string | undefined;
      secondaryLinkUrl?: string | undefined;
      mobileImageUrl?: string | undefined;
      imageAlt?: string | undefined;
      textPosition?: string | undefined;
      startsAt?: string | undefined;
      endsAt?: string | undefined;
      status: string;
      sortOrder: number;
    }) =>
      adminRequest("/api/admin/cms/banners", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-banners"] }),
  });
  const updateBanner = useMutation({
    mutationFn: ({
      bannerId,
      payload,
    }: {
      bannerId: string;
      payload: Partial<{
        title: string;
        subtitle: string;
        imageUrl: string;
        linkUrl: string;
        eyebrow: string;
        ctaLabel: string;
        secondaryCtaLabel: string;
        secondaryLinkUrl: string;
        mobileImageUrl: string;
        imageAlt: string;
        textPosition: string;
        startsAt: string;
        endsAt: string;
        status: string;
        sortOrder: number;
      }>;
    }) =>
      adminRequest(`/api/admin/cms/banners/${bannerId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-banners"] }),
  });
  const deleteBanner = useMutation({
    mutationFn: (bannerId: string) =>
      adminRequest(`/api/admin/cms/banners/${bannerId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-banners"] }),
  });
  const createHomepageSection = useMutation({
    mutationFn: (payload: {
      sectionType: string;
      title: string;
      config: Record<string, unknown>;
      status: string;
      sortOrder: number;
    }) =>
      adminRequest("/api/admin/cms/homepage-sections", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-homepage-sections"] }),
  });
  const updateHomepageSection = useMutation({
    mutationFn: ({
      sectionId,
      payload,
    }: {
      sectionId: string;
      payload: Partial<{
        sectionType: string;
        title: string;
        config: Record<string, unknown>;
        status: string;
        sortOrder: number;
      }>;
    }) =>
      adminRequest(`/api/admin/cms/homepage-sections/${sectionId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-homepage-sections"] }),
  });
  const deleteHomepageSection = useMutation({
    mutationFn: (sectionId: string) =>
      adminRequest(`/api/admin/cms/homepage-sections/${sectionId}`, auth.authHeaders, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-homepage-sections"] }),
  });
  const createSeoEntry = useMutation({
    mutationFn: (payload: Partial<SeoEntryRecord>) =>
      adminRequest("/api/admin/cms/seo", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo-overview"] });
      setEditingSeoEntry(null);
    },
  });
  const updateSeoEntry = useMutation({
    mutationFn: ({
      seoEntryId,
      payload,
    }: {
      seoEntryId: string;
      payload: Partial<SeoEntryRecord>;
    }) =>
      adminRequest(`/api/admin/cms/seo/${seoEntryId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo-overview"] });
      setEditingSeoEntry(null);
    },
  });
  const archiveSeoEntry = useMutation({
    mutationFn: (seoEntryId: string) =>
      adminRequest(`/api/admin/cms/seo/${seoEntryId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-seo-overview"] });
    },
  });
  const createRedirect = useMutation({
    mutationFn: (payload: Partial<CmsRedirectRecord>) =>
      adminRequest("/api/admin/cms/redirects", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-redirects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-sitemap"] });
    },
  });
  const createMedia = useMutation({
    mutationFn: (payload: Partial<CmsMediaAssetRecord>) =>
      adminRequest("/api/admin/cms/media", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-media"] }),
  });
  const deleteMedia = useMutation({
    mutationFn: (mediaId: string) =>
      adminRequest(`/api/admin/cms/media/${mediaId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cms-media"] }),
  });
  const createMenuItem = useMutation({
    mutationFn: (payload: Partial<CmsMenuItemRecord>) =>
      adminRequest("/api/admin/cms/menus", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-menus"] });
      setEditingMenuItem(null);
    },
  });
  const updateMenuItem = useMutation({
    mutationFn: ({
      menuItemId,
      payload,
    }: {
      menuItemId: string;
      payload: Partial<CmsMenuItemRecord>;
    }) =>
      adminRequest(`/api/admin/cms/menus/${menuItemId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-menus"] });
      setEditingMenuItem(null);
    },
  });
  const archiveMenuItem = useMutation({
    mutationFn: (menuItemId: string) =>
      adminRequest(`/api/admin/cms/menus/${menuItemId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cms-menus"] });
      setEditingMenuItem(null);
    },
  });
  const pageItems = listItems(pages.data);
  const bannerItems = listItems(banners.data);
  const sectionItems = listItems(sections.data);
  const seoItems = listItems(seoEntries.data);
  const redirectItems = listItems(redirects.data);
  const mediaItems = listItems(mediaAssets.data);
  const revisionItems = listItems(revisions.data);
  const menuItemList = menuItems.data ?? [];
  const menuItemsForArea = useMemo(
    () => menuItemList.filter((item) => item.area === menuAreaFilter),
    [menuAreaFilter, menuItemList],
  );
  const nextBannerSortOrder =
    bannerItems.reduce((max, banner) => Math.max(max, banner.sortOrder ?? 0), -10) + 10;
  const homepageSectionDataSources = useMemo<HomepageSectionDataSources>(
    () => ({
      categories: (sectionCategories.data ?? []).filter((category) => category.status === "ACTIVE"),
      products: listItems(sectionProducts.data).filter(
        (product) => product.status === "ACTIVE" && product.approvalStatus === "APPROVED",
      ),
      sellers: listItems(sectionSellers.data).filter(
        (seller) => seller.status === "APPROVED" && seller.approvalStatus === "APPROVED",
      ),
      isLoading:
        sectionCategories.isLoading || sectionProducts.isLoading || sectionSellers.isLoading,
    }),
    [
      sectionCategories.data,
      sectionCategories.isLoading,
      sectionProducts.data,
      sectionProducts.isLoading,
      sectionSellers.data,
      sectionSellers.isLoading,
    ],
  );
  const mutationError =
    createPage.error ??
    updatePage.error ??
    archivePage.error ??
    createBanner.error ??
    updateBanner.error ??
    deleteBanner.error ??
    createHomepageSection.error ??
    updateHomepageSection.error ??
    deleteHomepageSection.error ??
    createSeoEntry.error ??
    updateSeoEntry.error ??
    archiveSeoEntry.error ??
    createRedirect.error ??
    createMedia.error ??
    deleteMedia.error ??
    createMenuItem.error ??
    updateMenuItem.error ??
    archiveMenuItem.error;

  return (
    <AdminResourceChrome
      title="Content management"
      description="Manage policy pages, banners, and homepage content sections."
      icon={<BookOpen className="h-5 w-5" />}
      query={pages}
    >
      {confirmation.dialog}
      {mutationError ? (
        <PanelStatus
          tone="danger"
          title="Content update failed"
          message={mutationErrorMessage(mutationError)}
          {...(mutationError instanceof IndihubApiError ? { status: mutationError.status } : {})}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminDirectoryMetric
          label="CMS pages"
          value={pageItems.length.toLocaleString("en-IN")}
          actionLabel={`${contentPublishedCount(pageItems)} published`}
          icon={<BookOpen className="h-5 w-5" />}
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="Homepage banners"
          value={bannerItems.length.toLocaleString("en-IN")}
          actionLabel={`${contentPublishedCount(bannerItems)} published`}
          icon={<Bell className="h-5 w-5" />}
          tone="success"
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="Homepage sections"
          value={sectionItems.length.toLocaleString("en-IN")}
          actionLabel={`${contentPublishedCount(sectionItems)} published`}
          icon={<Settings className="h-5 w-5" />}
          tone="warning"
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="SEO entries"
          value={(seoOverview.data?.total ?? seoItems.length).toLocaleString("en-IN")}
          actionLabel={`${seoOverview.data?.published ?? contentPublishedCount(seoItems)} published`}
          icon={<Database className="h-5 w-5" />}
          tone="muted"
          onSelect={() => undefined}
        />
      </div>

      {editingContent ? (
        <ContentEditPanel
          request={editingContent}
          authHeaders={auth.authHeaders}
          sectionDataSources={homepageSectionDataSources}
          disabled={
            updatePage.isPending || updateBanner.isPending || updateHomepageSection.isPending
          }
          onCancel={() => setEditingContent(null)}
          onSavePage={(pageId, payload) =>
            updatePage.mutate({ pageId, payload }, { onSuccess: () => setEditingContent(null) })
          }
          onSaveBanner={(bannerId, payload) =>
            updateBanner.mutate({ bannerId, payload }, { onSuccess: () => setEditingContent(null) })
          }
          onSaveSection={(sectionId, payload) =>
            updateHomepageSection.mutate(
              { sectionId, payload },
              { onSuccess: () => setEditingContent(null) },
            )
          }
        />
      ) : null}

      <AdminTabs
        className="mt-5"
        tabs={[
          {
            key: "seo-overview",
            label: "SEO overview",
            badge: seoOverview.data?.lowScore ?? 0,
            panel: (
              <SeoOverviewPanel
                overview={seoOverview.data}
                sitemap={sitemapOverview.data}
                isLoading={seoOverview.isLoading || sitemapOverview.isLoading}
              />
            ),
          },
          {
            key: "commerce-seo",
            label: "Commerce SEO",
            badge: seoItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_460px]">
                <SeoEntryList
                  items={seoItems}
                  isLoading={seoEntries.isLoading}
                  disabled={archiveSeoEntry.isPending || updateSeoEntry.isPending}
                  onEdit={(entry) => setEditingSeoEntry(entry)}
                  onPublish={(entry) =>
                    updateSeoEntry.mutate({
                      seoEntryId: entry.id,
                      payload: { status: "PUBLISHED" },
                    })
                  }
                  onArchive={(entry) =>
                    confirmation.requestConfirmation({
                      title: "Archive SEO entry",
                      description: `"${entry.metaTitle ?? entry.routePath ?? entry.entityType}" will stop overriding public metadata.`,
                      confirmLabel: "Archive SEO",
                      onConfirm: () => archiveSeoEntry.mutate(entry.id),
                    })
                  }
                />
                <SeoEntryForm
                  entry={editingSeoEntry}
                  products={listItems(seoProducts.data)}
                  productsLoading={seoProducts.isLoading}
                  productSearch={seoProductSearch}
                  onProductSearchChange={setSeoProductSearch}
                  onCancel={() => setEditingSeoEntry(null)}
                  onSubmit={(payload) =>
                    editingSeoEntry
                      ? updateSeoEntry.mutate({ seoEntryId: editingSeoEntry.id, payload })
                      : createSeoEntry.mutate(payload)
                  }
                  disabled={createSeoEntry.isPending || updateSeoEntry.isPending}
                />
              </div>
            ),
          },
          {
            key: "pages",
            label: "CMS pages",
            badge: pageItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <CmsList
                  title="CMS pages"
                  description="Policy and public content pages resolved by slug."
                  items={pageItems}
                  isLoading={pages.isLoading}
                  removeLabel="Archive"
                  removeIcon={<Archive className="h-4 w-4" />}
                  disabled={archivePage.isPending || updatePage.isPending}
                  onEdit={(item) =>
                    setEditingContent({ kind: "page", item: item as CmsPageRecord })
                  }
                  onStatus={(item, status) =>
                    updatePage.mutate({ pageId: item.id, payload: { status } })
                  }
                  onRemove={(item) =>
                    confirmation.requestConfirmation({
                      title: "Archive CMS page",
                      description: `"${item.title}" will be removed from public CMS lookup but kept in admin history.`,
                      confirmLabel: "Archive page",
                      onConfirm: () => archivePage.mutate(item.id),
                    })
                  }
                />
                <CmsPageCreateForm
                  onSubmit={(payload) => createPage.mutate(payload)}
                  disabled={createPage.isPending}
                />
              </div>
            ),
          },
          {
            key: "banners",
            label: "Homepage banners",
            badge: bannerItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <CmsList
                  title="Homepage banners"
                  description="First published banner by sort order controls the storefront hero."
                  items={bannerItems}
                  isLoading={banners.isLoading}
                  removeLabel="Delete"
                  removeIcon={<Trash2 className="h-4 w-4" />}
                  disabled={deleteBanner.isPending || updateBanner.isPending}
                  onEdit={(item) =>
                    setEditingContent({ kind: "banner", item: item as BannerRecord })
                  }
                  onStatus={(item, status) =>
                    updateBanner.mutate({ bannerId: item.id, payload: { status } })
                  }
                  onRemove={(item) =>
                    confirmation.requestConfirmation({
                      title: "Delete homepage banner",
                      description: `"${item.title}" will be permanently removed from homepage banner records.`,
                      confirmLabel: "Delete banner",
                      onConfirm: () => deleteBanner.mutate(item.id),
                    })
                  }
                />
                <BannerCreateForm
                  authHeaders={auth.authHeaders}
                  nextSortOrder={nextBannerSortOrder}
                  onSubmit={(payload) => createBanner.mutate(payload)}
                  disabled={createBanner.isPending}
                />
              </div>
            ),
          },
          {
            key: "sections",
            label: "Homepage sections",
            badge: sectionItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <CmsList
                  title="Homepage sections"
                  description="Homepage blocks with guided fields for non-technical editing."
                  items={sectionItems}
                  isLoading={sections.isLoading}
                  removeLabel="Delete"
                  removeIcon={<Trash2 className="h-4 w-4" />}
                  disabled={deleteHomepageSection.isPending || updateHomepageSection.isPending}
                  onEdit={(item) =>
                    setEditingContent({ kind: "section", item: item as HomepageSectionRecord })
                  }
                  onStatus={(item, status) =>
                    updateHomepageSection.mutate({ sectionId: item.id, payload: { status } })
                  }
                  onRemove={(item) =>
                    confirmation.requestConfirmation({
                      title: "Delete homepage section",
                      description: `"${item.title}" will be permanently removed from homepage section records.`,
                      confirmLabel: "Delete section",
                      onConfirm: () => deleteHomepageSection.mutate(item.id),
                    })
                  }
                />
                <HomepageSectionCreateForm
                  dataSources={homepageSectionDataSources}
                  onSubmit={(payload) => createHomepageSection.mutate(payload)}
                  disabled={createHomepageSection.isPending}
                />
              </div>
            ),
          },
          {
            key: "menus",
            label: "Menus",
            badge: menuItemList.length,
            panel: (
              <CmsMenuManager
                items={menuItemsForArea}
                allItems={menuItemList}
                activeArea={menuAreaFilter}
                editingItem={editingMenuItem}
                isLoading={menuItems.isLoading}
                disabled={
                  createMenuItem.isPending || updateMenuItem.isPending || archiveMenuItem.isPending
                }
                onAreaChange={(area) => {
                  setMenuAreaFilter(area);
                  setEditingMenuItem(null);
                }}
                onEdit={setEditingMenuItem}
                onCancelEdit={() => setEditingMenuItem(null)}
                onSubmit={(payload) => {
                  if (editingMenuItem) {
                    updateMenuItem.mutate({ menuItemId: editingMenuItem.id, payload });
                  } else {
                    createMenuItem.mutate(payload);
                  }
                }}
                onArchive={(item) =>
                  confirmation.requestConfirmation({
                    title: "Archive menu item",
                    description: `"${item.label}" will be removed from published menu feeds.${item.children?.length ? " Child menu items stay in admin history and no longer render under this parent." : ""}`,
                    confirmLabel: "Archive menu item",
                    onConfirm: () => archiveMenuItem.mutate(item.id),
                  })
                }
              />
            ),
          },
          {
            key: "media",
            label: "Media",
            badge: mediaItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <CmsMediaList
                  items={mediaItems}
                  isLoading={mediaAssets.isLoading}
                  disabled={deleteMedia.isPending}
                  onRemove={(item) =>
                    confirmation.requestConfirmation({
                      title: "Delete media record",
                      description: `"${item.title ?? item.url}" will be removed from the CMS media library record. The provider asset itself is not deleted.`,
                      confirmLabel: "Delete record",
                      onConfirm: () => deleteMedia.mutate(item.id),
                    })
                  }
                />
                <CmsMediaCreateForm
                  onSubmit={(payload) => createMedia.mutate(payload)}
                  disabled={createMedia.isPending}
                />
              </div>
            ),
          },
          {
            key: "redirects",
            label: "Redirects",
            badge: redirectItems.length,
            panel: (
              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <CmsRedirectList items={redirectItems} isLoading={redirects.isLoading} />
                <CmsRedirectCreateForm
                  onSubmit={(payload) => createRedirect.mutate(payload)}
                  disabled={createRedirect.isPending}
                />
              </div>
            ),
          },
          {
            key: "sitemap",
            label: "Sitemap / robots",
            badge: sitemapOverview.data?.totalEntries ?? 0,
            panel: (
              <SitemapHealthPanel
                sitemap={sitemapOverview.data}
                isLoading={sitemapOverview.isLoading}
              />
            ),
          },
          {
            key: "revisions",
            label: "Revisions",
            badge: revisionItems.length,
            panel: <CmsRevisionList items={revisionItems} isLoading={revisions.isLoading} />,
          },
        ]}
      />
    </AdminResourceChrome>
  );
}

function SeoOverviewPanel({
  overview,
  sitemap,
  isLoading,
}: {
  overview?: SeoOverviewRecord | undefined;
  sitemap?: CmsSitemapOverviewRecord | undefined;
  isLoading?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminDirectoryMetric
          label="Published SEO"
          value={(overview?.published ?? 0).toLocaleString("en-IN")}
          actionLabel={`${overview?.total ?? 0} total entries`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="Needs work"
          value={(overview?.lowScore ?? 0).toLocaleString("en-IN")}
          actionLabel="Score below 70"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="warning"
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="Redirects"
          value={(overview?.redirects ?? 0).toLocaleString("en-IN")}
          actionLabel="Enabled SEO redirects"
          icon={<ArrowRight className="h-5 w-5" />}
          tone="muted"
          onSelect={() => undefined}
        />
        <AdminDirectoryMetric
          label="Sitemap URLs"
          value={(sitemap?.totalEntries ?? 0).toLocaleString("en-IN")}
          actionLabel={sitemap?.health.status ?? (isLoading ? "Loading" : "Not generated")}
          icon={<Database className="h-5 w-5" />}
          tone="info"
          onSelect={() => undefined}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Publish readiness">
          <SmallStack
            lines={[
              `${overview?.draft ?? 0} draft entries`,
              `${overview?.inReview ?? 0} entries in review`,
              `${overview?.scheduled ?? 0} scheduled entries`,
              `${overview?.duplicateCount ?? 0} duplicate title/description warnings`,
            ]}
          />
          {overview?.duplicates?.length ? (
            <div className="mt-4 space-y-2">
              {overview.duplicates.slice(0, 6).map((duplicate) => (
                <PanelStatus
                  key={`${duplicate.field}-${duplicate.value}`}
                  title={`Duplicate ${humanize(duplicate.field)}`}
                  message={`${duplicate.count} entries use "${duplicate.value}".`}
                  tone="warning"
                />
              ))}
            </div>
          ) : null}
        </Panel>
        <Panel title="Sitemap and robots">
          <SmallStack
            lines={[
              `Generated: ${formatDate(sitemap?.generatedAt)}`,
              `Public entries: ${sitemap?.totalEntries ?? 0}`,
              `Robots excludes: ${sitemap?.excludedRoutePrefixes?.join(", ") ?? "/admin, /account, /checkout"}`,
            ]}
          />
          {sitemap?.health.warnings?.length ? (
            <div className="mt-4 space-y-2">
              {sitemap.health.warnings.map((warning) => (
                <PanelStatus
                  key={warning}
                  title="Sitemap warning"
                  message={warning}
                  tone="warning"
                />
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function SeoEntryList({
  items,
  isLoading,
  disabled,
  onEdit,
  onPublish,
  onArchive,
}: {
  items: SeoEntryRecord[];
  isLoading?: boolean;
  disabled?: boolean;
  onEdit: (entry: SeoEntryRecord) => void;
  onPublish: (entry: SeoEntryRecord) => void;
  onArchive: (entry: SeoEntryRecord) => void;
}) {
  return (
    <Panel title="Managed commerce SEO">
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0">
              <EntityTitle
                title={entry.metaTitle || `${humanize(entry.entityType)} SEO`}
                subtitle={entry.routePath || entry.entityId || "Entity-level override"}
              />
              <SmallStack
                lines={[
                  entry.metaDescription || "Meta description not set",
                  `${humanize(entry.robotsDirective)} robots - ${entry.structuredDataType || "Schema type not set"}`,
                  `Score ${entry.seoScore}/100 - ${formatDate(entry.updatedAt)}`,
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={entry.seoScore >= 70 ? "success" : "warning"}>
                {entry.seoScore}/100
              </StatusBadge>
              <StatusBadge tone={statusTone(entry.status)}>{humanize(entry.status)}</StatusBadge>
              <AdminActionMenu
                label="SEO actions"
                items={[
                  {
                    label: "Edit SEO",
                    description: "Open the guided SEO form.",
                    icon: <Settings className="h-4 w-4 text-[#163B5C]" />,
                    disabled,
                    onSelect: () => onEdit(entry),
                  },
                  {
                    label: "Publish",
                    description: "Use this entry for public route metadata.",
                    icon: <CheckCircle2 className="h-4 w-4 text-[#0F8A5F]" />,
                    disabled: disabled || entry.status === "PUBLISHED",
                    onSelect: () => onPublish(entry),
                  },
                  {
                    label: "Archive",
                    description: "Stop using this override.",
                    icon: <Archive className="h-4 w-4 text-[#D64545]" />,
                    destructive: true,
                    disabled,
                    onSelect: () => onArchive(entry),
                  },
                ]}
              />
            </div>
          </div>
        ))}
        {isLoading ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">Loading SEO entries...</p>
        ) : null}
        {!isLoading && !items.length ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">No SEO entries yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function SeoEntryForm({
  entry,
  products,
  productsLoading,
  productSearch,
  onProductSearchChange,
  onSubmit,
  onCancel,
  disabled,
}: {
  entry?: SeoEntryRecord | null;
  products: ProductRecord[];
  productsLoading?: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  onSubmit: (payload: Partial<SeoEntryRecord>) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState(() => seoEntryFormState(entry));

  useEffect(() => {
    setForm(seoEntryFormState(entry));
  }, [entry]);

  const productOptions = useMemo<AdminSelectOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.name,
        description: [
          product.category?.name,
          product.seller?.storeName,
          `/products/${product.slug}`,
        ]
          .filter(Boolean)
          .join(" / "),
      })),
    [products],
  );
  const warnings = seoFormWarnings(form);
  const score = seoFormScore(form);
  const selectedProduct = products.find((product) => product.id === form.entityId);

  function handleEntityTypeChange(entityType: string) {
    setForm((current) => ({
      ...current,
      entityType,
      entityId: entityTypeRequiresEntityId(entityType) ? current.entityId : "",
      routePath: defaultRoutePathForSeoEntity(entityType) ?? current.routePath,
      structuredDataType: defaultSchemaTypeForSeoEntity(entityType),
    }));
  }

  function handleProductSelect(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    const primaryImage =
      product.images?.find((image) => image.isPrimary)?.url ?? product.images?.[0]?.url ?? "";
    setForm((current) => ({
      ...current,
      entityType: "PRODUCT",
      entityId: product.id,
      routePath: `/products/${product.slug}`,
      structuredDataType: "Product",
      metaTitle: current.metaTitle.trim() ? current.metaTitle : `${product.name} | 1HandIndia`,
      ogTitle: current.ogTitle.trim() ? current.ogTitle : product.name,
      ogImageUrl: current.ogImageUrl.trim() ? current.ogImageUrl : primaryImage,
      focusKeyword: current.focusKeyword.trim() ? current.focusKeyword : product.name,
    }));
  }

  return (
    <Panel title={entry ? "Edit SEO entry" : "Create SEO entry"}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Entity type"
            value={form.entityType}
            values={[
              "HOME",
              "PRODUCT",
              "CATEGORY",
              "STORE",
              "CMS_PAGE",
              "B2B_LANDING",
              "SELLER_LANDING",
              "POLICY",
              "SEARCH",
              "CUSTOM_ROUTE",
            ]}
            onChange={handleEntityTypeChange}
          />
          <LabeledSelect
            label="Status"
            value={form.status}
            values={contentWorkflowStatusValues}
            onChange={(status) => setForm((current) => ({ ...current, status }))}
          />
        </div>
        {form.entityType === "PRODUCT" ? (
          <div className="rounded-lg border border-[#D8E2EA] bg-[#FFFCFB] p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
              <TextInput
                label="Search product"
                value={productSearch}
                onChange={onProductSearchChange}
              />
              <AdminListbox
                label="Select product"
                value={selectedProduct?.id ?? ""}
                options={productOptions}
                onChange={handleProductSelect}
                placeholder={
                  productsLoading
                    ? "Loading approved products..."
                    : "Choose product to auto-fill target"
                }
                disabled={productsLoading || disabled}
                buttonClassName="bg-white"
              />
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-[#667085]">
              {selectedProduct
                ? `Selected product target: ${selectedProduct.id} / /products/${selectedProduct.slug}`
                : "Selecting a product fills Entity ID, Route path, schema type, focus keyword, OG title, and image when those fields are empty."}
            </p>
          </div>
        ) : null}
        <TextInput
          label="Entity ID"
          value={form.entityId}
          onChange={(entityId) => setForm((current) => ({ ...current, entityId }))}
        />
        <TextInput
          label="Route path"
          value={form.routePath}
          onChange={(routePath) => setForm((current) => ({ ...current, routePath }))}
        />
        <TextInput
          label="Meta title"
          value={form.metaTitle}
          onChange={(metaTitle) => setForm((current) => ({ ...current, metaTitle }))}
        />
        <TextAreaInput
          label="Meta description"
          value={form.metaDescription}
          onChange={(metaDescription) => setForm((current) => ({ ...current, metaDescription }))}
        />
        <TextInput
          label="Canonical URL"
          value={form.canonicalUrl}
          onChange={(canonicalUrl) => setForm((current) => ({ ...current, canonicalUrl }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Robots"
            value={form.robotsDirective}
            values={["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]}
            onChange={(robotsDirective) => setForm((current) => ({ ...current, robotsDirective }))}
          />
          <LabeledSelect
            label="Schema type"
            value={form.structuredDataType}
            values={[
              "Product",
              "WebSite",
              "WebPage",
              "Article",
              "Organization",
              "LocalBusiness",
              "FAQPage",
            ]}
            onChange={(structuredDataType) =>
              setForm((current) => ({ ...current, structuredDataType }))
            }
          />
        </div>
        <TextInput
          label="Focus keyword"
          value={form.focusKeyword}
          onChange={(focusKeyword) => setForm((current) => ({ ...current, focusKeyword }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="OG title"
            value={form.ogTitle}
            onChange={(ogTitle) => setForm((current) => ({ ...current, ogTitle }))}
          />
          <TextInput
            label="OG image URL"
            value={form.ogImageUrl}
            onChange={(ogImageUrl) => setForm((current) => ({ ...current, ogImageUrl }))}
          />
        </div>
        <TextAreaInput
          label="OG description"
          value={form.ogDescription}
          onChange={(ogDescription) => setForm((current) => ({ ...current, ogDescription }))}
        />
        <SeoPreview form={form} score={score} warnings={warnings} />
        <FormActionRow
          submitLabel={entry ? "Save SEO" : "Create SEO"}
          onCancel={() => {
            setForm(seoEntryFormState(null));
            onCancel();
          }}
          onSubmit={() => onSubmit({ ...form, seoScore: score })}
          disabled={disabled || warnings.some((warning) => warning.startsWith("Missing target"))}
        />
      </div>
    </Panel>
  );
}

function SeoPreview({
  form,
  score,
  warnings,
}: {
  form: ReturnType<typeof seoEntryFormState>;
  score: number;
  warnings: string[];
}) {
  const title = form.metaTitle || "SEO title preview";
  const description = form.metaDescription || "SEO description preview will appear here.";
  return (
    <div className="space-y-3 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={score >= 70 ? "success" : "warning"}>SEO score {score}/100</StatusBadge>
        <p className="text-xs font-bold text-[#667085]">
          Title {form.metaTitle.length}/65 - Description {form.metaDescription.length}/170
        </p>
      </div>
      <div className="rounded-md bg-white p-3">
        <p className="truncate text-sm text-[#0F8A5F]">
          {form.canonicalUrl || form.routePath || "https://www.1handindia.com/route"}
        </p>
        <p className="mt-1 text-lg font-semibold text-[#1A0DAB]">{title}</p>
        <p className="mt-1 text-sm text-[#4B5563]">{description}</p>
      </div>
      <div className="rounded-md border border-[#D8E2EA] bg-white p-3">
        <p className="text-xs font-black uppercase text-[#667085]">Social card</p>
        <p className="mt-2 font-black text-[#1F2933]">{form.ogTitle || title}</p>
        <p className="text-sm text-[#667085]">{form.ogDescription || description}</p>
      </div>
      {warnings.length ? (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <p key={warning} className="text-xs font-bold text-[#D64545]">
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CmsRedirectList({
  items,
  isLoading,
}: {
  items: CmsRedirectRecord[];
  isLoading?: boolean;
}) {
  return (
    <Panel title="SEO redirects">
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <div key={item.id} className="py-4">
            <EntityTitle
              title={`${item.sourcePath} -> ${item.targetPath}`}
              subtitle={`${item.statusCode} redirect`}
            />
            <SmallStack
              lines={[
                item.enabled ? "Enabled" : "Disabled",
                item.note ?? "No note",
                formatDate(item.updatedAt),
              ]}
            />
          </div>
        ))}
        {isLoading ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">Loading redirects...</p>
        ) : null}
        {!isLoading && !items.length ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">No redirects configured.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function CmsRedirectCreateForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (payload: Partial<CmsRedirectRecord>) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState({ sourcePath: "", targetPath: "", statusCode: "301", note: "" });
  return (
    <Panel title="Add redirect">
      <div className="space-y-4">
        <TextInput
          label="Source path"
          value={form.sourcePath}
          onChange={(sourcePath) => setForm((current) => ({ ...current, sourcePath }))}
        />
        <TextInput
          label="Target path"
          value={form.targetPath}
          onChange={(targetPath) => setForm((current) => ({ ...current, targetPath }))}
        />
        <LabeledSelect
          label="Status code"
          value={form.statusCode}
          values={["301", "302"]}
          onChange={(statusCode) => setForm((current) => ({ ...current, statusCode }))}
        />
        <TextAreaInput
          label="Note"
          value={form.note}
          onChange={(note) => setForm((current) => ({ ...current, note }))}
        />
        <FormActionRow
          submitLabel="Create redirect"
          onCancel={() => setForm({ sourcePath: "", targetPath: "", statusCode: "301", note: "" })}
          onSubmit={() =>
            onSubmit({
              sourcePath: form.sourcePath,
              targetPath: form.targetPath,
              statusCode: Number(form.statusCode),
              enabled: true,
              note: form.note,
            })
          }
          disabled={disabled || !form.sourcePath || !form.targetPath}
        />
      </div>
    </Panel>
  );
}

function CmsMediaList({
  items,
  isLoading,
  disabled,
  onRemove,
}: {
  items: CmsMediaAssetRecord[];
  isLoading?: boolean;
  disabled?: boolean;
  onRemove: (item: CmsMediaAssetRecord) => void;
}) {
  return (
    <Panel title="Media library records">
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="min-w-0">
              <EntityTitle
                title={item.title || item.publicId || "CMS media asset"}
                subtitle={item.usageContext || item.mediaType}
              />
              <SmallStack
                lines={[
                  item.altText || "Alt text not set",
                  item.caption || item.url,
                  `${item.width ?? "-"} x ${item.height ?? "-"}`,
                ]}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRemove(item)}
              disabled={disabled}
            >
              Delete
            </Button>
          </div>
        ))}
        {isLoading ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">Loading media assets...</p>
        ) : null}
        {!isLoading && !items.length ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">No media records yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function CmsMediaCreateForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (payload: Partial<CmsMediaAssetRecord>) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    publicId: "",
    altText: "",
    caption: "",
    usageContext: "",
    width: "",
    height: "",
  });
  return (
    <Panel title="Register media asset">
      <div className="space-y-4">
        <TextInput
          label="Title"
          value={form.title}
          onChange={(title) => setForm((current) => ({ ...current, title }))}
        />
        <TextInput
          label="Asset key"
          value={form.url}
          onChange={(url) => setForm((current) => ({ ...current, url }))}
        />
        <TextInput
          label="Public ID"
          value={form.publicId}
          onChange={(publicId) => setForm((current) => ({ ...current, publicId }))}
        />
        <TextInput
          label="Alt text"
          value={form.altText}
          onChange={(altText) => setForm((current) => ({ ...current, altText }))}
        />
        <TextAreaInput
          label="Caption"
          value={form.caption}
          onChange={(caption) => setForm((current) => ({ ...current, caption }))}
        />
        <TextInput
          label="Usage context"
          value={form.usageContext}
          onChange={(usageContext) => setForm((current) => ({ ...current, usageContext }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Width"
            type="number"
            value={form.width}
            onChange={(width) => setForm((current) => ({ ...current, width }))}
          />
          <TextInput
            label="Height"
            type="number"
            value={form.height}
            onChange={(height) => setForm((current) => ({ ...current, height }))}
          />
        </div>
        <FormActionRow
          submitLabel="Register media"
          onCancel={() =>
            setForm({
              title: "",
              url: "",
              publicId: "",
              altText: "",
              caption: "",
              usageContext: "",
              width: "",
              height: "",
            })
          }
          onSubmit={() =>
            onSubmit({
              title: form.title,
              url: form.url,
              publicId: form.publicId,
              altText: form.altText,
              caption: form.caption,
              usageContext: form.usageContext,
              mediaType: "image",
              width: Number(form.width) || undefined,
              height: Number(form.height) || undefined,
            })
          }
          disabled={disabled || !form.url}
        />
      </div>
    </Panel>
  );
}

function CmsMenuManager({
  items,
  allItems,
  activeArea,
  editingItem,
  isLoading,
  disabled,
  onAreaChange,
  onEdit,
  onCancelEdit,
  onSubmit,
  onArchive,
}: {
  items: CmsMenuItemRecord[];
  allItems: CmsMenuItemRecord[];
  activeArea: string;
  editingItem: CmsMenuItemRecord | null;
  isLoading?: boolean;
  disabled?: boolean;
  onAreaChange: (area: string) => void;
  onEdit: (item: CmsMenuItemRecord) => void;
  onCancelEdit: () => void;
  onSubmit: (payload: Partial<CmsMenuItemRecord>) => void;
  onArchive: (item: CmsMenuItemRecord) => void;
}) {
  const areaOptions = useMemo(() => menuAreaOptionsFromItems(allItems), [allItems]);
  const visibleItems = useMemo(() => items.filter((item) => item.status !== "ARCHIVED"), [items]);
  const childrenByParent = useMemo(() => groupMenuChildren(visibleItems), [visibleItems]);
  const roots = useMemo(
    () => visibleItems.filter((item) => !item.parentId).sort(compareMenuItems),
    [visibleItems],
  );
  const publishedCount = visibleItems.filter((item) => item.status === "PUBLISHED").length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <Panel title="Structured menu management">
        <div className="mb-4 grid gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4 lg:grid-cols-[minmax(12rem,18rem)_1fr]">
          <AdminListbox
            label="Menu area"
            value={activeArea}
            options={areaOptions}
            onChange={onAreaChange}
            buttonClassName="bg-white"
          />
          <div className="rounded-md bg-white p-3 text-sm font-semibold text-[#4B587C]">
            Published <span className="font-black text-[#163B5C]">{publishedCount}</span> of{" "}
            <span className="font-black text-[#163B5C]">{visibleItems.length}</span> items in this
            area. Header items render in the storefront navigation; footer/legal areas are ready for
            footer blocks.
          </div>
        </div>

        <div className="divide-y divide-[#E5E7EB] rounded-md border border-[#E5E7EB] bg-white">
          {roots.map((item) => (
            <CmsMenuTreeItem
              key={item.id}
              item={item}
              childrenByParent={childrenByParent}
              disabled={disabled}
              level={0}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
          {isLoading ? (
            <p className="p-4 text-sm font-semibold text-[#667085]">Loading menu items...</p>
          ) : null}
          {!isLoading && !roots.length ? (
            <p className="p-4 text-sm font-semibold text-[#667085]">
              No active menu items in this area yet.
            </p>
          ) : null}
        </div>
      </Panel>

      <CmsMenuEditor
        item={editingItem}
        allItems={allItems}
        activeArea={activeArea}
        disabled={disabled}
        onSubmit={onSubmit}
        onCancelEdit={onCancelEdit}
      />
    </div>
  );
}

function CmsMenuTreeItem({
  item,
  childrenByParent,
  level,
  disabled,
  onEdit,
  onArchive,
}: {
  item: CmsMenuItemRecord;
  childrenByParent: Map<string, CmsMenuItemRecord[]>;
  level: number;
  disabled?: boolean | undefined;
  onEdit: (item: CmsMenuItemRecord) => void;
  onArchive: (item: CmsMenuItemRecord) => void;
}) {
  const children = childrenByParent.get(item.id) ?? [];
  const indentClassName = level > 0 ? "pl-6" : "";

  return (
    <div className={cn("py-3", indentClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <EntityTitle
            title={item.label}
            subtitle={`${item.href}${item.parent?.label ? ` under ${item.parent.label}` : ""}`}
          />
          <SmallStack
            lines={[
              `Sort ${item.sortOrder}`,
              children.length ? `${children.length} child links` : "Top level link",
              formatDate(item.updatedAt),
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(item)}
            disabled={disabled}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onArchive(item)}
            disabled={disabled || item.status === "ARCHIVED"}
          >
            Archive
          </Button>
        </div>
      </div>
      {children.length ? (
        <div className="mt-3 space-y-3 border-l border-[#D8E2EA]">
          {children.map((child) => (
            <CmsMenuTreeItem
              key={child.id}
              item={child}
              childrenByParent={childrenByParent}
              disabled={disabled}
              level={level + 1}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CmsMenuEditor({
  item,
  allItems,
  activeArea,
  disabled,
  onSubmit,
  onCancelEdit,
}: {
  item: CmsMenuItemRecord | null;
  allItems: CmsMenuItemRecord[];
  activeArea: string;
  disabled?: boolean | undefined;
  onSubmit: (payload: Partial<CmsMenuItemRecord>) => void;
  onCancelEdit: () => void;
}) {
  const [form, setForm] = useState({
    area: activeArea,
    label: "",
    href: "",
    parentId: "",
    status: "PUBLISHED",
    sortOrder: "100",
  });

  useEffect(() => {
    setForm({
      area: item?.area ?? activeArea,
      label: item?.label ?? "",
      href: item?.href ?? "",
      parentId: item?.parentId ?? "",
      status: item?.status ?? "PUBLISHED",
      sortOrder: String(item?.sortOrder ?? 100),
    });
  }, [activeArea, item]);

  const parentOptions = useMemo<AdminSelectOption[]>(() => {
    const topLevelItems = allItems
      .filter(
        (menuItem) =>
          menuItem.area === form.area &&
          !menuItem.parentId &&
          menuItem.status !== "ARCHIVED" &&
          menuItem.id !== item?.id,
      )
      .sort(compareMenuItems);

    return [
      { value: "", label: "Top level item" },
      ...topLevelItems.map((menuItem) => ({ value: menuItem.id, label: menuItem.label })),
    ];
  }, [allItems, form.area, item?.id]);

  const submitLabel = item ? "Update menu item" : "Add menu item";

  return (
    <Panel title={item ? "Edit menu item" : "Add menu item"}>
      <div className="space-y-4">
        <AdminListbox
          label="Menu area"
          value={form.area}
          options={menuAreaOptionsFromItems(allItems)}
          onChange={(area) => setForm((current) => ({ ...current, area, parentId: "" }))}
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Parent"
          value={form.parentId}
          options={parentOptions}
          onChange={(parentId) => setForm((current) => ({ ...current, parentId }))}
          buttonClassName="bg-white"
        />
        <TextInput
          label="Label"
          value={form.label}
          onChange={(label) => setForm((current) => ({ ...current, label }))}
        />
        <TextInput
          label="Link"
          value={form.href}
          onChange={(href) => setForm((current) => ({ ...current, href }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect
            label="Status"
            value={form.status}
            values={contentWorkflowStatusValues}
            onChange={(status) => setForm((current) => ({ ...current, status }))}
          />
          <TextInput
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
          />
        </div>
        <FormActionRow
          submitLabel={submitLabel}
          onCancel={() => {
            onCancelEdit();
            setForm({
              area: activeArea,
              label: "",
              href: "",
              parentId: "",
              status: "PUBLISHED",
              sortOrder: "100",
            });
          }}
          onSubmit={() =>
            onSubmit({
              area: form.area,
              label: form.label,
              href: form.href,
              parentId: form.parentId || null,
              status: form.status,
              sortOrder: Number(form.sortOrder) || 0,
            })
          }
          disabled={disabled || !form.label.trim() || !form.href.trim()}
        />
      </div>
    </Panel>
  );
}

function SitemapHealthPanel({
  sitemap,
  isLoading,
}: {
  sitemap?: CmsSitemapOverviewRecord | undefined;
  isLoading?: boolean;
}) {
  return (
    <Panel title="Dynamic sitemap and robots health">
      <SmallStack
        lines={[
          isLoading
            ? "Loading sitemap health..."
            : `Status: ${sitemap?.health.status ?? "Unknown"}`,
          `Public URLs: ${sitemap?.totalEntries ?? 0}`,
          `Published SEO entries: ${sitemap?.seoEntries ?? 0}`,
          `Enabled redirects: ${sitemap?.redirects ?? 0}`,
        ]}
      />
      <div className="mt-5 divide-y divide-[#E5E7EB]">
        {(sitemap?.entries ?? []).slice(0, 20).map((entry) => (
          <div
            key={`${entry.source}-${entry.path}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <EntityTitle title={entry.path} subtitle={entry.source} />
            <StatusBadge tone="info">{entry.priority ?? 0.5}</StatusBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function CmsRevisionList({
  items,
  isLoading,
}: {
  items: CmsRevisionRecord[];
  isLoading?: boolean;
}) {
  return (
    <Panel title="CMS revision history">
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <div key={item.id} className="py-4">
            <EntityTitle
              title={`${humanize(item.entityType)} v${item.version}`}
              subtitle={item.action}
            />
            <SmallStack
              lines={[
                `Entity ${item.entityId}`,
                item.note ?? "No note",
                formatDate(item.createdAt),
              ]}
            />
          </div>
        ))}
        {isLoading ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">Loading revisions...</p>
        ) : null}
        {!isLoading && !items.length ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">No revisions recorded yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function seoEntryFormState(entry?: SeoEntryRecord | null) {
  return {
    entityType: entry?.entityType ?? "PRODUCT",
    entityId: entry?.entityId ?? "",
    routePath: entry?.routePath ?? "",
    metaTitle: entry?.metaTitle ?? "",
    metaDescription: entry?.metaDescription ?? "",
    canonicalUrl: entry?.canonicalUrl ?? "",
    robotsDirective: entry?.robotsDirective ?? "index,follow",
    ogTitle: entry?.ogTitle ?? "",
    ogDescription: entry?.ogDescription ?? "",
    ogImageUrl: entry?.ogImageUrl ?? "",
    twitterTitle: entry?.twitterTitle ?? "",
    twitterDescription: entry?.twitterDescription ?? "",
    twitterImageUrl: entry?.twitterImageUrl ?? "",
    focusKeyword: entry?.focusKeyword ?? "",
    structuredDataType: entry?.structuredDataType ?? "Product",
    status: entry?.status ?? "DRAFT",
  };
}

function entityTypeRequiresEntityId(entityType: string) {
  return ["PRODUCT", "CATEGORY", "STORE", "CMS_PAGE"].includes(entityType);
}

function defaultRoutePathForSeoEntity(entityType: string) {
  switch (entityType) {
    case "HOME":
      return "/";
    case "B2B_LANDING":
      return "/b2b/register";
    case "SELLER_LANDING":
      return "/seller/register";
    case "SEARCH":
      return "/search";
    default:
      return null;
  }
}

function defaultSchemaTypeForSeoEntity(entityType: string) {
  switch (entityType) {
    case "PRODUCT":
      return "Product";
    case "STORE":
      return "LocalBusiness";
    case "HOME":
      return "WebSite";
    case "CMS_PAGE":
    case "POLICY":
    case "B2B_LANDING":
    case "SELLER_LANDING":
    case "CATEGORY":
    case "SEARCH":
    case "CUSTOM_ROUTE":
      return "WebPage";
    default:
      return "WebPage";
  }
}

function seoFormWarnings(form: ReturnType<typeof seoEntryFormState>) {
  const warnings: string[] = [];
  if (!form.entityId.trim() && !form.routePath.trim()) {
    warnings.push("Missing target: add an entity ID or route path.");
  }
  if (!form.metaTitle.trim()) {
    warnings.push("Meta title is missing.");
  } else if (form.metaTitle.length < 30 || form.metaTitle.length > 65) {
    warnings.push("Meta title should usually stay between 30 and 65 characters.");
  }
  if (!form.metaDescription.trim()) {
    warnings.push("Meta description is missing.");
  } else if (form.metaDescription.length < 120 || form.metaDescription.length > 170) {
    warnings.push("Meta description should usually stay between 120 and 170 characters.");
  }
  if (!form.canonicalUrl.trim()) {
    warnings.push("Canonical URL is missing.");
  }
  if (!form.ogImageUrl.trim()) {
    warnings.push("Social image is missing.");
  }
  return warnings;
}

function seoFormScore(form: ReturnType<typeof seoEntryFormState>) {
  let score = 0;
  score +=
    form.metaTitle.length >= 30 && form.metaTitle.length <= 65 ? 20 : form.metaTitle ? 10 : 0;
  score +=
    form.metaDescription.length >= 120 && form.metaDescription.length <= 170
      ? 20
      : form.metaDescription
        ? 10
        : 0;
  score += form.canonicalUrl ? 15 : 0;
  score += form.ogTitle || form.ogDescription ? 10 : 0;
  score += form.ogImageUrl ? 15 : 0;
  score += form.focusKeyword ? 10 : 0;
  score += form.structuredDataType ? 10 : 0;
  return Math.min(score, 100);
}

export function AdminCategoriesPageClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useAdminConfirmation();
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const query = useQuery({
    queryKey: ["admin-categories", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<CategoryRecord[]>("/api/admin/categories", undefined, auth.authHeaders),
  });
  const templatesQuery = useQuery({
    queryKey: ["admin-product-templates", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<ProductTemplateRecord[]>(
        "/api/admin/product-templates",
        undefined,
        auth.authHeaders,
      ),
  });
  const createCategory = useMutation({
    mutationFn: (payload: {
      name: string;
      parentId?: string | undefined;
      productTemplateId?: string | undefined;
      description?: string | undefined;
      imageUrl?: string | undefined;
      defaultHsnCode?: string | undefined;
      defaultGstRatePercent?: number | undefined;
      defaultTaxDescription?: string | undefined;
      status: string;
      sortOrder: number;
    }) =>
      adminRequest("/api/admin/categories", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
  const updateCategory = useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: string;
      payload: Partial<{
        name: string;
        slug: string;
        parentId?: string | null | undefined;
        productTemplateId?: string | null | undefined;
        description?: string | undefined;
        imageUrl?: string | null | undefined;
        defaultHsnCode?: string | null | undefined;
        defaultGstRatePercent?: number | null | undefined;
        defaultTaxDescription?: string | null | undefined;
        status: string;
        sortOrder: number;
      }>;
    }) =>
      adminRequest(`/api/admin/categories/${categoryId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
  const archiveCategory = useMutation({
    mutationFn: (categoryId: string) =>
      adminRequest(`/api/admin/categories/${categoryId}`, auth.authHeaders, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
  const createTemplate = useMutation({
    mutationFn: (payload: ProductTemplatePayload) =>
      adminRequest("/api/admin/product-templates", auth.authHeaders, {
        method: "POST",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-product-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
  const updateTemplate = useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: ProductTemplatePayload;
    }) =>
      adminRequest(`/api/admin/product-templates/${templateId}`, auth.authHeaders, {
        method: "PATCH",
        body: JSON.stringify(emptyStringsToUndefined(payload)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-product-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
  const archiveTemplate = useMutation({
    mutationFn: (templateId: string) =>
      adminRequest(`/api/admin/product-templates/${templateId}`, auth.authHeaders, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-product-templates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
  const items = query.data ?? [];
  const templates = templatesQuery.data ?? [];
  const mutationError =
    createCategory.error ??
    updateCategory.error ??
    archiveCategory.error ??
    createTemplate.error ??
    updateTemplate.error ??
    archiveTemplate.error;

  return (
    <AdminResourceChrome
      title="Category management"
      description="Manage storefront category hierarchy and product grouping."
      icon={<Package className="h-5 w-5" />}
      query={query}
    >
      {confirmation.dialog}
      {mutationError ? (
        <PanelStatus
          tone="danger"
          title="Category update failed"
          message={mutationErrorMessage(mutationError)}
          {...(mutationError instanceof IndihubApiError ? { status: mutationError.status } : {})}
        />
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <AdminTable
          items={items}
          isLoading={query.isLoading}
          emptyTitle="No categories found"
          columns={[
            {
              header: "Category",
              cell: (item) => (
                <div className="flex items-center gap-3">
                  <AvatarImage src={item.imageUrl} fallback={item.name.slice(0, 2) || "CA"} />
                  <EntityTitle
                    title={item.name}
                    subtitle={item.parent?.name ? `Under ${item.parent.name}` : item.slug}
                  />
                </div>
              ),
            },
            {
              header: "Template",
              cell: (item) => (
                <SmallStack
                  lines={[
                    item.productTemplate?.name ?? "Standard product",
                    humanize(item.productTemplate?.listingMode ?? "CART"),
                  ]}
                />
              ),
            },
            {
              header: "Tax default",
              cell: (item) => <SmallStack lines={categoryTaxLines(item)} />,
            },
            {
              header: "Status",
              cell: (item) => (
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              ),
            },
            {
              header: "Counts",
              cell: (item) => (
                <SmallStack
                  lines={[
                    `${item._count?.products ?? 0} products`,
                    `${item._count?.children ?? 0} child categories`,
                    `Sort ${item.sortOrder}`,
                  ]}
                />
              ),
            },
            {
              header: "Action",
              cell: (item) => (
                <AdminActionMenu
                  label="Category actions"
                  items={[
                    {
                      label: "Edit category",
                      description: "Update category name, slug, image, hierarchy, and status.",
                      icon: <Settings className="h-4 w-4 text-[#163B5C]" />,
                      onSelect: () => setEditingCategory(item),
                      disabled: updateCategory.isPending,
                    },
                    {
                      label: "Archive category",
                      description:
                        (item._count?.products ?? 0) > 0
                          ? "Move products out before archiving."
                          : "Remove this category from active storefront navigation.",
                      icon: <Archive className="h-4 w-4 text-[#B42318]" />,
                      onSelect: () =>
                        confirmation.requestConfirmation({
                          title: "Archive category",
                          description: `"${item.name}" will no longer appear as an active storefront category. Categories with products stay protected from archiving.`,
                          confirmLabel: "Archive category",
                          onConfirm: () => archiveCategory.mutate(item.id),
                        }),
                      disabled: archiveCategory.isPending || (item._count?.products ?? 0) > 0,
                      destructive: true,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
        {editingCategory ? (
          <CategoryEditForm
            key={editingCategory.id}
            category={editingCategory}
            categories={items}
            productTemplates={templates}
            authHeaders={auth.authHeaders}
            onCancel={() => setEditingCategory(null)}
            onSubmit={(payload) =>
              updateCategory.mutate(
                { categoryId: editingCategory.id, payload },
                { onSuccess: () => setEditingCategory(null) },
              )
            }
            disabled={updateCategory.isPending}
          />
        ) : (
          <CategoryCreateForm
            categories={items}
            productTemplates={templates}
            authHeaders={auth.authHeaders}
            onSubmit={(payload) => createCategory.mutate(payload)}
            disabled={createCategory.isPending}
          />
        )}
      </div>
      <ProductTemplatesPanel
        templates={templates}
        isLoading={templatesQuery.isLoading}
        onCreate={(payload) => createTemplate.mutate(payload)}
        onUpdate={(templateId, payload) => updateTemplate.mutate({ templateId, payload })}
        onArchive={(template) =>
          confirmation.requestConfirmation({
            title: "Archive product template",
            description: `"${template.name}" can be archived only when no categories use it.`,
            confirmLabel: "Archive template",
            onConfirm: () => archiveTemplate.mutate(template.id),
          })
        }
        disabled={createTemplate.isPending || updateTemplate.isPending || archiveTemplate.isPending}
      />
    </AdminResourceChrome>
  );
}

function AdminResourceChrome({
  title,
  description,
  icon,
  search,
  setSearch,
  total,
  query,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  search?: string;
  setSearch?: (value: string) => void;
  total?: number;
  query: { isFetching?: boolean; isLoading?: boolean; error?: unknown; refetch?: () => void };
  children: ReactNode;
}) {
  const hasSearch = Boolean(setSearch);
  const activeFilterCount = search?.trim() ? 1 : 0;

  return (
    <>
      <AdminPanel className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              {icon}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
                {typeof total === "number" ? (
                  <StatusBadge tone="info">{total.toLocaleString("en-IN")} records</StatusBadge>
                ) : null}
                {query.isFetching ? <StatusBadge tone="warning">Refreshing</StatusBadge> : null}
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#667085]">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasSearch ? (
              <AdminFilterPopover activeCount={activeFilterCount}>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                    Search records
                  </span>
                  <span className="relative mt-2 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                    <input
                      value={search ?? ""}
                      onChange={(event) => setSearch?.(event.target.value)}
                      placeholder="Search by name, code, status, or email"
                      className="h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                    />
                  </span>
                </label>
              </AdminFilterPopover>
            ) : null}
            {query.refetch ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => query.refetch?.()}
                disabled={query.isFetching}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            ) : null}
          </div>
        </div>
      </AdminPanel>

      {query.error ? (
        <PanelStatus
          tone="danger"
          title="Admin API request failed"
          message={
            query.error instanceof Error ? query.error.message : "Unable to load admin data."
          }
          {...(query.error instanceof IndihubApiError ? { status: query.error.status } : {})}
        />
      ) : null}

      {children}
    </>
  );
}

function AdminTable<T extends { id: string }>({
  items,
  columns,
  isLoading,
  emptyTitle,
}: {
  items: T[];
  columns: Array<TableColumn<T>>;
  isLoading?: boolean;
  emptyTitle: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <table className="min-w-full text-left">
        <thead className="bg-[#F8FAFC]">
          <tr className="border-b border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#667085]">
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-3 ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-4 ${column.className ?? ""}`}>
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
              >
                Loading admin records...
              </td>
            </tr>
          ) : null}
          {!isLoading && !items.length ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
              >
                {emptyTitle}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <AdminPanel>
      {title ? <h2 className="mb-4 text-lg font-black text-[#1F2933]">{title}</h2> : null}
      {children}
    </AdminPanel>
  );
}

function PanelStatus({
  title,
  message,
  tone,
  status,
}: {
  title: string;
  message: string;
  tone: "warning" | "danger";
  status?: number | undefined;
}) {
  return <AdminStatusNotice title={title} message={message} tone={tone} status={status} />;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <AdminPanel>
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-3 text-2xl font-black text-[#163B5C]">{value}</p>
    </AdminPanel>
  );
}

function ReadinessCard({
  title,
  ready,
  detail,
}: {
  title: string;
  ready?: boolean | undefined;
  detail: string;
}) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-md ${ready ? "bg-[#ECFDF3] text-[#0F8A5F]" : "bg-[#FDECEC] text-[#D64545]"}`}
        >
          {ready ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        </span>
        <div>
          <h2 className="font-black text-[#1F2933]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{detail}</p>
          <StatusBadge tone={ready ? "success" : "danger"} className="mt-3">
            {ready ? "Ready" : "Needs setup"}
          </StatusBadge>
        </div>
      </div>
    </Panel>
  );
}

function EntityTitle({
  title,
  subtitle,
  actionHref,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
}) {
  const content = (
    <>
      <p className="font-black text-[#1F2933]">{title}</p>
      {subtitle ? (
        <p className="mt-1 max-w-[320px] truncate text-sm font-semibold text-[#667085]">
          {subtitle}
        </p>
      ) : null}
    </>
  );

  return actionHref ? (
    <Link href={actionHref} className="block hover:underline">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}

function SmallStack({ lines }: { lines: Array<string | number | null | undefined> }) {
  return (
    <div className="space-y-1 text-sm font-semibold text-[#667085]">
      {lines.filter(Boolean).map((line) => (
        <p key={String(line)}>{line}</p>
      ))}
    </div>
  );
}

function notificationBodyPreview(body?: string | null) {
  if (!body) {
    return "No body stored";
  }

  return `Body: ${truncate(
    body
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    120,
  )}`;
}

function notificationVariableLines(variables?: Record<string, unknown> | null) {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    return ["Context: none"];
  }

  const lines = Object.entries(variables)
    .filter(([, value]) => value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${formatVariableKey(key)}: ${String(value ?? "none")}`);

  return lines.length ? lines : ["Context: none"];
}

function formatVariableKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function AvatarImage({ src, fallback }: { src?: string | null | undefined; fallback: string }) {
  const imageSrc = resolveImageSource(src);
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        className="h-12 w-12 rounded-md border border-[#E5E7EB] object-cover"
      />
    );
  }

  return (
    <span className="grid h-12 w-12 place-items-center rounded-md bg-[#EAF1F7] text-sm font-black uppercase text-[#163B5C]">
      {fallback}
    </span>
  );
}

function ProductImage({ product }: { product: ProductRecord }) {
  const image = product.images?.find((item) => item.isPrimary)?.url ?? product.images?.[0]?.url;
  const imageSrc = resolveImageSource(image);
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        className="h-14 w-14 rounded-md border border-[#E5E7EB] object-cover"
      />
    );
  }

  return (
    <span className="grid h-14 w-14 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
      <Package className="h-5 w-5" />
    </span>
  );
}

function ProductEssentialsReview({ product }: { product: ProductRecord }) {
  const attributes = product.attributes ?? {};
  const chips = marketplaceProductAdminSummaryFields
    .map((field) => {
      const value = displayAdminProductAttributeValue(
        field.key,
        productEssentialValue(product, field.key, attributes),
      );
      return value ? `${field.label}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));
  const missing = productMissingEssentialLabels(product);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {missing.length ? (
          <StatusBadge tone="warning">{missing.length} missing</StatusBadge>
        ) : (
          <StatusBadge tone="success">Essentials ready</StatusBadge>
        )}
        {chips.slice(0, 4).map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-1 text-[11px] font-bold text-[#667085]"
          >
            {chip}
          </span>
        ))}
      </div>
      {missing.length ? (
        <p className="max-w-[260px] text-xs font-semibold leading-5 text-[#B54708]">
          Missing: {missing.slice(0, 3).join(", ")}
          {missing.length > 3 ? "..." : ""}
        </p>
      ) : null}
    </div>
  );
}

function productMissingEssentialLabels(product: ProductRecord) {
  const attributes = product.attributes ?? {};
  return marketplaceProductRequiredEssentialFields
    .filter(
      (field) =>
        !displayAdminProductAttributeValue(
          field.key,
          productEssentialValue(product, field.key, attributes),
        ),
    )
    .map((field) => field.label);
}

function productEssentialValue(
  product: ProductRecord,
  key: string,
  attributes: Record<string, unknown> = product.attributes ?? {},
) {
  if (key === "hsnCode") {
    return attributes.hsnCode ?? product.hsnCode;
  }

  if (key === "gstRatePercent") {
    return attributes.gstRatePercent ?? product.gstRatePercent;
  }

  return attributes[key];
}

function displayAdminProductAttributeValue(key: string, value: unknown) {
  const displayValue = displayInlineValue(value);
  if (!displayValue) {
    return "";
  }

  if (key === "gstRatePercent") {
    return `${displayValue}%`;
  }

  if (key === "packageWeightGrams") {
    return `${displayValue} g`;
  }

  return displayValue;
}

function displayInlineValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return "";
}

function StatusButtons({
  current,
  statuses,
  onPick,
  disabled,
}: {
  current: string;
  statuses: readonly string[];
  onPick: (status: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant={status === current ? "secondary" : "outline"}
          onClick={() => onPick(status)}
          disabled={disabled || status === current}
        >
          {humanize(status)}
        </Button>
      ))}
    </div>
  );
}

function CustomerAccountsTable({
  customers,
  isLoading,
  total,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  activityFilter,
  setActivityFilter,
  onStatus,
  disabled,
}: {
  customers: CustomerRecord[];
  isLoading?: boolean | undefined;
  total: number;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: CustomerStatusFilter;
  setStatusFilter: (value: CustomerStatusFilter) => void;
  activityFilter: CustomerActivityFilter;
  setActivityFilter: (value: CustomerActivityFilter) => void;
  onStatus: (customerId: string, status: string) => void;
  disabled?: boolean | undefined;
}) {
  const activeCount = customers.filter((customer) => customer.status === "ACTIVE").length;
  const pendingCount = customers.filter((customer) => customer.status === "PENDING").length;
  const disabledCount = customers.filter((customer) => customer.status === "DISABLED").length;
  const visibleCustomers = filterCustomers(customers, statusFilter, activityFilter);
  const hasFilters = Boolean(search.trim()) || statusFilter !== "ALL" || activityFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setActivityFilter("ALL");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <AdminDirectoryMetric
          label="Total customers"
          value={total.toLocaleString("en-IN")}
          actionLabel="View all customers"
          icon={<UsersRound className="h-5 w-5" />}
          active={statusFilter === "ALL" && activityFilter === "ALL"}
          onSelect={() => {
            setStatusFilter("ALL");
            setActivityFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Active customers"
          value={activeCount.toLocaleString("en-IN")}
          actionLabel="View active"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="success"
          active={statusFilter === "ACTIVE"}
          onSelect={() => {
            setStatusFilter("ACTIVE");
            setActivityFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Pending review"
          value={pendingCount.toLocaleString("en-IN")}
          actionLabel="View pending"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="warning"
          active={statusFilter === "PENDING"}
          onSelect={() => {
            setStatusFilter("PENDING");
            setActivityFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Disabled"
          value={disabledCount.toLocaleString("en-IN")}
          actionLabel="View disabled"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="muted"
          active={statusFilter === "DISABLED"}
          onSelect={() => {
            setStatusFilter("DISABLED");
            setActivityFilter("ALL");
          }}
        />
      </div>

      <div className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] p-4 xl:grid-cols-[minmax(18rem,1.45fr)_minmax(12rem,0.75fr)_minmax(12rem,0.75fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or phone..."
              className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-11 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#667085] focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
            />
          </label>
          <AdminListbox
            value={activityFilter}
            options={customerActivityFilterOptions}
            onChange={(value) => setActivityFilter(value as CustomerActivityFilter)}
            compact
            buttonClassName="h-12 bg-white"
          />
          <AdminListbox
            value={statusFilter}
            options={customerStatusFilterOptions}
            onChange={(value) => setStatusFilter(value as CustomerStatusFilter)}
            compact
            buttonClassName="h-12 bg-white"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 px-5"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            Reset
          </Button>
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="min-w-full table-fixed text-left">
            <thead className="bg-[#F8FAFC]">
              <tr className="border-b border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#344054]">
                <th className="w-[30%] px-5 py-4">Customer</th>
                <th className="w-[23%] px-5 py-4">Activity</th>
                <th className="w-[15%] px-5 py-4">Status</th>
                <th className="w-[22%] px-5 py-4">Joined</th>
                <th className="w-[10%] px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="align-middle transition-colors hover:bg-[#FFFCFB]">
                  <td className="px-5 py-5">
                    <CustomerIdentity customer={customer} />
                  </td>
                  <td className="px-5 py-5">
                    <CustomerActivityPills customer={customer} />
                  </td>
                  <td className="px-5 py-5">
                    <CustomerStatusPill status={customer.status} />
                  </td>
                  <td className="px-5 py-5">
                    <CustomerDateStack customer={customer} />
                  </td>
                  <td className="px-5 py-5 text-right">
                    <CustomerStatusActions
                      current={customer.status}
                      onPick={(status) => onStatus(customer.id, status)}
                      disabled={disabled}
                    />
                  </td>
                </tr>
              ))}
              <CustomerAccountsEmptyState
                isLoading={isLoading}
                isEmpty={!visibleCustomers.length}
                colSpan={5}
              />
            </tbody>
          </table>
        </div>

        <div className="space-y-3 bg-[#F8FAFC] p-3 xl:hidden">
          {visibleCustomers.map((customer) => (
            <div
              key={customer.id}
              className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <CustomerIdentity customer={customer} />
                <CustomerStatusPill status={customer.status} />
              </div>
              <div className="mt-4 border-t border-[#EEF2F6] pt-4">
                <CustomerActivityPills customer={customer} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF2F6] pt-4">
                <CustomerDateStack customer={customer} />
                <CustomerStatusActions
                  current={customer.status}
                  onPick={(status) => onStatus(customer.id, status)}
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
          {isLoading ? (
            <p className="rounded-lg border border-[#D8E2EA] bg-white px-4 py-8 text-center text-sm font-semibold text-[#667085]">
              Loading customer accounts...
            </p>
          ) : null}
          {!isLoading && !visibleCustomers.length ? (
            <p className="rounded-lg border border-[#D8E2EA] bg-white px-4 py-8 text-center text-sm font-semibold text-[#667085]">
              No customers found.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminDirectoryMetric({
  label,
  value,
  actionLabel,
  icon,
  tone = "info",
  active,
  onSelect,
}: {
  label: string;
  value: string;
  actionLabel: string;
  icon: ReactNode;
  tone?: "info" | "success" | "warning" | "muted";
  active?: boolean | undefined;
  onSelect: () => void;
}) {
  const iconClass =
    tone === "success"
      ? "bg-[#DDF8E8] text-[#0F8A5F]"
      : tone === "warning"
        ? "bg-[#FFF2D6] text-[#B7791F]"
        : tone === "muted"
          ? "bg-[#EEF2F6] text-[#163B5C]"
          : "bg-[#EAF1F7] text-[#1D4F91]";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[116px] items-center gap-4 rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C5D8E8] hover:shadow-md ${
        active ? "border-[#ED3500] ring-2 ring-[#FFE0D6]" : "border-[#D8E2EA]"
      }`}
    >
      <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${iconClass}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#344054]">{label}</span>
        <span className="mt-2 block text-2xl font-black text-[#0B1F3A]">{value}</span>
        <span className="mt-3 flex items-center gap-2 text-sm font-black text-[#163B5C]">
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </span>
      </span>
    </button>
  );
}

function CustomerAccountsEmptyState({
  isLoading,
  isEmpty,
  colSpan,
}: {
  isLoading?: boolean | undefined;
  isEmpty: boolean;
  colSpan: number;
}) {
  if (isLoading) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
        >
          Loading customer accounts...
        </td>
      </tr>
    );
  }

  if (!isEmpty) {
    return null;
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-[#667085]">
        No customers found.
      </td>
    </tr>
  );
}

function CustomerIdentity({ customer }: { customer: CustomerRecord }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EAF1F7] text-sm font-black uppercase text-[#163B5C]">
        {customerInitials(customer)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-black text-[#0B1F3A]">{customerName(customer)}</p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667085]">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{customer.user?.email ?? "Email not set"}</span>
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667085]">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{customer.user?.phone || "Phone not set"}</span>
        </p>
      </div>
    </div>
  );
}

function CustomerDateStack({ customer }: { customer: CustomerRecord }) {
  const date = customerDateLabel(customer.createdAt);
  const time = customerTimeLabel(customer.createdAt);

  return (
    <div className="space-y-1 text-sm font-semibold text-[#163B5C]">
      <p>{date}</p>
      <p className="text-xs text-[#667085]">{time}</p>
      <p className="text-xs text-[#98A2B3]">ID {truncate(customer.id, 14)}</p>
    </div>
  );
}

function CustomerActivityPills({ customer }: { customer: CustomerRecord }) {
  return (
    <div className="flex flex-wrap gap-2 xl:flex-col xl:items-start">
      <CustomerActivityPill
        icon={<ShoppingBag className="h-3.5 w-3.5" />}
        label={countLabel(customer._count?.orders ?? 0, "order")}
      />
      <CustomerActivityPill
        icon={<BookOpen className="h-3.5 w-3.5" />}
        label={countLabel(customer._count?.addresses ?? 0, "address", "addresses")}
      />
      <CustomerActivityPill
        icon={<Activity className="h-3.5 w-3.5" />}
        label={customer.status === "ACTIVE" ? "Ready to buy" : "Needs review"}
      />
    </div>
  );
}

function CustomerActivityPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-1.5 text-xs font-black text-[#344054]">
      {icon}
      {label}
    </span>
  );
}

function CustomerStatusPill({ status }: { status: string }) {
  const tone = statusTone(status);
  const toneClass =
    tone === "success"
      ? "bg-[#ECFDF3] text-[#067647]"
      : tone === "danger"
        ? "bg-[#FDECEC] text-[#B42318]"
        : tone === "warning"
          ? "bg-[#FFF7E6] text-[#B7791F]"
          : "bg-[#EAF1F7] text-[#163B5C]";
  const dotClass =
    tone === "success"
      ? "bg-[#12B76A]"
      : tone === "danger"
        ? "bg-[#D64545]"
        : tone === "warning"
          ? "bg-[#F59E0B]"
          : "bg-[#1D4F91]";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${toneClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {humanize(status)}
    </span>
  );
}

function CustomerStatusActions({
  current,
  onPick,
  disabled,
}: {
  current: string;
  onPick: (status: string) => void;
  disabled?: boolean | undefined;
}) {
  const items: AdminActionItem[] = [
    {
      label: "Mark active",
      description: "Allow this customer to use the marketplace.",
      icon: <ShieldCheck className="h-4 w-4 text-[#0F8A5F]" />,
      disabled: disabled || current === "ACTIVE",
      onSelect: () => onPick("ACTIVE"),
    },
    {
      label: "Disable customer",
      description: "Block customer account activity.",
      icon: <ShieldAlert className="h-4 w-4 text-[#B42318]" />,
      destructive: true,
      disabled: disabled || current === "DISABLED",
      onSelect: () => onPick("DISABLED"),
    },
  ];

  return (
    <AdminActionMenu
      label="Customer actions"
      items={items}
      buttonClassName="h-9 w-9 border-transparent px-0 text-[#0B1F3A] hover:bg-[#F8FAFC] [&>span]:sr-only"
    />
  );
}

function filterCustomers(
  customers: CustomerRecord[],
  statusFilter: CustomerStatusFilter,
  activityFilter: CustomerActivityFilter,
) {
  return customers.filter((customer) => {
    if (statusFilter !== "ALL" && customer.status !== statusFilter) {
      return false;
    }

    const orderCount = customer._count?.orders ?? 0;
    const addressCount = customer._count?.addresses ?? 0;

    if (activityFilter === "WITH_ORDERS") {
      return orderCount > 0;
    }
    if (activityFilter === "NO_ORDERS") {
      return orderCount === 0;
    }
    if (activityFilter === "WITH_ADDRESSES") {
      return addressCount > 0;
    }
    if (activityFilter === "NO_ADDRESSES") {
      return addressCount === 0;
    }

    return true;
  });
}

function customerName(customer: CustomerRecord) {
  return customer.displayName || customer.user?.fullName || customer.user?.email || "Customer";
}

function customerInitials(customer: CustomerRecord) {
  const source = customerName(customer);
  const initials = source
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "CU";
}

function customerDateLabel(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function customerTimeLabel(value?: string | null) {
  if (!value) {
    return "Time not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString("en-IN")} ${count === 1 ? singular : plural}`;
}

function UsersRolesTable({
  users,
  isLoading,
  currentAdminId,
  total,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  profileFilter,
  setProfileFilter,
  statusFilter,
  setStatusFilter,
  page,
  pageSize,
  setPage,
  setPageSize,
  onStatus,
  onAddRole,
  onRemoveRole,
  onSetBackOfficePassword,
  onUpdateDeliveryProfile,
  disabled,
}: {
  users: UserRecord[];
  isLoading?: boolean;
  currentAdminId: string | null;
  total: number;
  search: string;
  setSearch: (value: string) => void;
  roleFilter: UserRoleFilter;
  setRoleFilter: (value: UserRoleFilter) => void;
  profileFilter: UserProfileFilter;
  setProfileFilter: (value: UserProfileFilter) => void;
  statusFilter: UserStatusFilter;
  setStatusFilter: (value: UserStatusFilter) => void;
  page: number;
  pageSize: number;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  onStatus: (userId: string, status: string) => void;
  onAddRole: (userId: string, roleCode: PlatformRoleCode) => void;
  onRemoveRole: (userId: string, roleCode: PlatformRoleCode) => void;
  onSetBackOfficePassword: (userId: string, password: string) => void;
  onUpdateDeliveryProfile: (userId: string, payload: Record<string, string>) => void;
  disabled?: boolean | undefined;
}) {
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const pendingCount = users.filter((user) => user.status === "PENDING").length;
  const disabledCount = users.filter((user) => user.status === "DISABLED").length;
  const visibleUsers = filterUsers(users, roleFilter, profileFilter, statusFilter);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = visibleUsers.find((user) => user.id === selectedUserId) ?? null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters =
    Boolean(search.trim()) ||
    roleFilter !== "ALL" ||
    profileFilter !== "ALL" ||
    statusFilter !== "ALL";

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount, setPage]);

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("ALL");
    setProfileFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <AdminDirectoryMetric
          label="Total users"
          value={total.toLocaleString("en-IN")}
          actionLabel="View all users"
          icon={<UsersRound className="h-5 w-5" />}
          active={roleFilter === "ALL" && profileFilter === "ALL" && statusFilter === "ALL"}
          onSelect={() => {
            setRoleFilter("ALL");
            setProfileFilter("ALL");
            setStatusFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Active users"
          value={activeCount.toLocaleString("en-IN")}
          actionLabel="View active"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="success"
          active={statusFilter === "ACTIVE"}
          onSelect={() => {
            setStatusFilter("ACTIVE");
            setRoleFilter("ALL");
            setProfileFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Pending"
          value={pendingCount.toLocaleString("en-IN")}
          actionLabel="View pending"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="warning"
          active={statusFilter === "PENDING"}
          onSelect={() => {
            setStatusFilter("PENDING");
            setRoleFilter("ALL");
            setProfileFilter("ALL");
          }}
        />
        <AdminDirectoryMetric
          label="Disabled"
          value={disabledCount.toLocaleString("en-IN")}
          actionLabel="View disabled"
          icon={<XCircle className="h-5 w-5" />}
          tone="muted"
          active={statusFilter === "DISABLED"}
          onSelect={() => {
            setStatusFilter("DISABLED");
            setRoleFilter("ALL");
            setProfileFilter("ALL");
          }}
        />
      </div>

      <div className="rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] p-4 xl:grid-cols-[minmax(18rem,1.45fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or phone..."
              className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-11 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#667085] focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
            />
          </label>
          <AdminListbox
            value={roleFilter}
            options={userRoleFilterOptions}
            onChange={(value) => setRoleFilter(value as UserRoleFilter)}
            compact
            buttonClassName="h-12 bg-white"
          />
          <AdminListbox
            value={profileFilter}
            options={userProfileFilterOptions}
            onChange={(value) => setProfileFilter(value as UserProfileFilter)}
            compact
            buttonClassName="h-12 bg-white"
          />
          <AdminListbox
            value={statusFilter}
            options={userStatusFilterOptions}
            onChange={(value) => setStatusFilter(value as UserStatusFilter)}
            compact
            buttonClassName="h-12 bg-white"
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 px-5"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            Reset
          </Button>
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="min-w-full table-fixed text-left">
            <thead className="bg-[#F8FAFC]">
              <tr className="border-b border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#344054]">
                <th className="w-[32%] px-5 py-4">User</th>
                <th className="w-[16%] px-5 py-4">Roles</th>
                <th className="w-[13%] px-5 py-4">Profiles</th>
                <th className="w-[13%] px-5 py-4">Status</th>
                <th className="w-[16%] px-5 py-4">Last active</th>
                <th className="w-[10%] px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {visibleUsers.map((user) => (
                <tr key={user.id} className="align-middle transition-colors hover:bg-[#FFFCFB]">
                  <td className="px-5 py-5">
                    <UserIdentity user={user} />
                  </td>
                  <td className="px-5 py-5">
                    <RoleChipList
                      user={user}
                      currentAdminId={currentAdminId}
                      onRemoveRole={onRemoveRole}
                      disabled={disabled}
                      variant="icon"
                    />
                  </td>
                  <td className="px-5 py-5">
                    <AccountProfilePills user={user} variant="icon" />
                  </td>
                  <td className="px-5 py-5">
                    <CustomerStatusPill status={user.status} />
                  </td>
                  <td className="px-5 py-5">
                    <UserDateStack user={user} />
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className="grid h-9 w-9 place-items-center rounded-md bg-[#2E90FA] text-white shadow-sm transition hover:bg-[#175CD3]"
                        aria-label={`View ${user.fullName || user.email}`}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <UserStatusActions
                        current={user.status}
                        onPick={(status) => onStatus(user.id, status)}
                        disabled={disabled}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              <UsersRolesEmptyState
                isLoading={isLoading}
                isEmpty={!visibleUsers.length}
                colSpan={6}
              />
            </tbody>
          </table>
        </div>

        <div className="space-y-3 bg-[#F8FAFC] p-3 xl:hidden">
          {visibleUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <UserIdentity user={user} />
                <CustomerStatusPill status={user.status} />
              </div>
              <div className="mt-4 border-t border-[#EEF2F6] pt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                  Roles
                </p>
                <RoleChipList
                  user={user}
                  currentAdminId={currentAdminId}
                  onRemoveRole={onRemoveRole}
                  disabled={disabled}
                  variant="icon"
                />
              </div>
              <div className="mt-4 grid gap-4 border-t border-[#EEF2F6] pt-4 sm:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                    Profiles
                  </p>
                  <AccountProfilePills user={user} variant="icon" />
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                    Last active
                  </p>
                  <UserDateStack user={user} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                    Actions
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2E90FA] px-3 text-sm font-black text-white shadow-sm transition hover:bg-[#175CD3]"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </button>
                    <UserStatusActions
                      current={user.status}
                      onPick={(status) => onStatus(user.id, status)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading ? (
            <p className="rounded-lg border border-[#D8E2EA] bg-white px-4 py-8 text-center text-sm font-semibold text-[#667085]">
              Loading admin users...
            </p>
          ) : null}
          {!isLoading && !visibleUsers.length ? (
            <p className="rounded-lg border border-[#D8E2EA] bg-white px-4 py-8 text-center text-sm font-semibold text-[#667085]">
              No users found.
            </p>
          ) : null}
        </div>

        <UsersRolesPagination
          page={page}
          pageSize={pageSize}
          total={total}
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <UserDetailsDialog
        user={selectedUser}
        open={Boolean(selectedUser)}
        currentAdminId={currentAdminId}
        onClose={() => setSelectedUserId(null)}
        onStatus={(status) => selectedUser && onStatus(selectedUser.id, status)}
        onAddRole={onAddRole}
        onRemoveRole={onRemoveRole}
        onSetBackOfficePassword={onSetBackOfficePassword}
        onUpdateDeliveryProfile={onUpdateDeliveryProfile}
        disabled={disabled}
      />
    </div>
  );
}

const usersPageSizeOptions: AdminSelectOption[] = [
  { value: "10", label: "10 per page" },
  { value: "20", label: "20 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

function UsersRolesPagination({
  page,
  pageSize,
  total,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  isLoading?: boolean | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(total, currentPage * pageSize);
  const pages = paginationWindow(currentPage, pageCount);

  return (
    <div className="flex flex-col gap-3 border-t border-[#E5E7EB] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm font-semibold text-[#667085]">
        {isLoading
          ? "Loading users..."
          : `Showing ${firstItem.toLocaleString("en-IN")}-${lastItem.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} users`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AdminListbox
          value={String(pageSize)}
          options={usersPageSizeOptions}
          onChange={(value) => onPageSizeChange(Number(value))}
          compact
          className="w-36 [&>span]:sr-only"
          buttonClassName="h-10 bg-white"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {pages.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`${item}-${index}`} className="px-2 text-sm font-black text-[#98A2B3]">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                disabled={isLoading}
                onClick={() => onPageChange(item)}
                className={cn(
                  "grid h-9 min-w-9 place-items-center rounded-md border px-2 text-sm font-black transition",
                  item === currentPage
                    ? "border-[#163B5C] bg-[#163B5C] text-white"
                    : "border-[#D8E2EA] bg-white text-[#163B5C] hover:border-[#ED3500] hover:text-[#ED3500]",
                  isLoading && "cursor-wait opacity-60",
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading || currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function paginationWindow(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set(
    [1, pageCount, page - 1, page, page + 1].filter((item) => item >= 1 && item <= pageCount),
  );
  const sorted = Array.from(pages).sort((left, right) => left - right);
  const output: Array<number | "ellipsis"> = [];

  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) {
      output.push("ellipsis");
    }
    output.push(item);
  });

  return output;
}

function UserDetailsDialog({
  user,
  open,
  currentAdminId,
  onClose,
  onStatus,
  onAddRole,
  onRemoveRole,
  onSetBackOfficePassword,
  onUpdateDeliveryProfile,
  disabled,
}: {
  user: UserRecord | null;
  open: boolean;
  currentAdminId: string | null;
  onClose: () => void;
  onStatus: (status: string) => void;
  onAddRole: (userId: string, roleCode: PlatformRoleCode) => void;
  onRemoveRole: (userId: string, roleCode: PlatformRoleCode) => void;
  onSetBackOfficePassword: (userId: string, password: string) => void;
  onUpdateDeliveryProfile: (userId: string, payload: Record<string, string>) => void;
  disabled?: boolean | undefined;
}) {
  const [isEditingAccess, setIsEditingAccess] = useState(false);

  useEffect(() => {
    setIsEditingAccess(false);
  }, [open, user?.id]);

  if (!user) {
    return null;
  }

  const roles = userRoleCodes(user);
  const profiles = userProfileCards(user);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/50 transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-6xl overflow-hidden rounded-lg bg-[#F8FAFC] shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] bg-white px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#175CD3]">
                  User detail & edit
                </p>
                <DialogTitle className="mt-1 text-2xl font-black text-[#0B1F3A]">
                  {user.fullName || user.email}
                </DialogTitle>
                <Description className="mt-1 text-sm font-semibold text-[#667085]">
                  Review profile connections, manage role access, and edit account controls from one
                  focused view.
                </Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                aria-label="Close user details"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid max-h-[82svh] overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-[#E5E7EB] bg-white lg:border-b-0 lg:border-r">
                <div className="p-5 text-center">
                  <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#EAF1F7] text-2xl font-black uppercase text-[#163B5C]">
                    {userInitials(user)}
                  </span>
                  <h3 className="mt-4 text-lg font-black text-[#0B1F3A]">
                    {user.fullName || "Name not set"}
                  </h3>
                  <p className="mt-1 break-all text-sm font-semibold text-[#667085]">
                    {user.email}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <CustomerStatusPill status={user.status} />
                  </div>
                </div>

                <div className="border-t border-[#E5E7EB] p-5">
                  <UserDetailLine label="Phone" value={user.phone || "Phone not set"} />
                  <UserDetailLine
                    label="Created at"
                    value={`${customerDateLabel(user.createdAt)} ${customerTimeLabel(user.createdAt)}`}
                  />
                  <UserDetailLine
                    label="Updated at"
                    value={`${customerDateLabel(user.updatedAt)} ${customerTimeLabel(user.updatedAt)}`}
                  />
                  <UserDetailLine label="User ID" value={user.id} mono />
                </div>
              </aside>

              <section className="space-y-4 p-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <UserDetailMetric
                    label="Roles"
                    value={roles.length}
                    note={countLabel(roles.length, "role")}
                  />
                  <UserDetailMetric
                    label="Profiles"
                    value={profiles.filter((profile) => profile.active).length}
                    note="Linked surfaces"
                  />
                  <UserDetailMetric
                    label="Workload"
                    value={user.activeWorkload ?? 0}
                    note="Active delivery tasks"
                  />
                  <UserDetailMetric
                    label="COD cash"
                    value={formatPaise(user.pendingCodCashPaise ?? 0)}
                    note="Pending collection"
                  />
                </div>

                <div
                  className={cn(
                    "grid gap-4",
                    isEditingAccess ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_320px]",
                  )}
                >
                  <div className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-base font-black text-[#0B1F3A]">
                          {isEditingAccess ? "Edit account access" : "Account access"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-[#667085]">
                          {isEditingAccess
                            ? "Assign platform access and keep sensitive back-office credentials separate."
                            : "Review assigned roles and delivery profile settings before making changes."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isEditingAccess ? "secondary" : "outline"}
                        onClick={() => setIsEditingAccess((current) => !current)}
                        aria-pressed={isEditingAccess}
                      >
                        {isEditingAccess ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <UserCog className="h-4 w-4" aria-hidden="true" />
                        )}
                        {isEditingAccess ? "Done" : "Edit"}
                      </Button>
                    </div>
                    {isEditingAccess ? (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                              Account status
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#1F2933]">
                              Change access state only when the account review is complete.
                            </p>
                          </div>
                          <UserStatusActions
                            current={user.status}
                            onPick={onStatus}
                            disabled={disabled}
                          />
                        </div>
                        <RoleChipList
                          user={user}
                          currentAdminId={currentAdminId}
                          onRemoveRole={onRemoveRole}
                          disabled={disabled}
                        />
                        <RoleAddControl user={user} onAddRole={onAddRole} disabled={disabled} />
                        <BackOfficePasswordControl
                          user={user}
                          onSetPassword={onSetBackOfficePassword}
                          disabled={disabled}
                        />
                        <DeliveryPartnerProfileControl
                          user={user}
                          onSubmit={onUpdateDeliveryProfile}
                          disabled={disabled}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                              Assigned roles
                            </span>
                            <StatusBadge tone="info">Read only</StatusBadge>
                          </div>
                          <div className="mt-3">
                            <RoleChipList
                              user={user}
                              currentAdminId={currentAdminId}
                              onRemoveRole={onRemoveRole}
                              disabled={disabled}
                              readOnly
                            />
                          </div>
                        </div>
                        <DeliveryPartnerProfileSummary user={user} />
                        <p className="rounded-md border border-dashed border-[#C5D8E8] bg-white px-3 py-2 text-xs font-semibold text-[#667085]">
                          Click Edit to change roles, rotate back-office passwords, or update
                          delivery partner service settings.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
                    <h3 className="text-base font-black text-[#0B1F3A]">Profile links</h3>
                    <div className="mt-4 grid gap-3">
                      {profiles.map((profile) => (
                        <div
                          key={profile.label}
                          className={cn(
                            "rounded-lg border px-4 py-3",
                            profile.active
                              ? "border-[#C5D8E8] bg-[#F8FAFC]"
                              : "border-[#E5E7EB] bg-white opacity-65",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm font-black text-[#0B1F3A]">
                              {profile.icon}
                              {profile.label}
                            </span>
                            <StatusBadge tone={profile.active ? "success" : "neutral"}>
                              {profile.active ? "Linked" : "Not linked"}
                            </StatusBadge>
                          </div>
                          <p className="mt-2 break-words text-xs font-semibold text-[#667085]">
                            {profile.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function UserDetailMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[#0B1F3A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p>
    </div>
  );
}

function UserDetailLine({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean | undefined;
}) {
  return (
    <div className="border-b border-[#E5E7EB] py-3 last:border-b-0">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p
        className={cn(
          "mt-1 break-all text-sm font-black text-[#0B1F3A]",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function userProfileCards(user: UserRecord) {
  const deliveryDetailParts = [
    user.deliveryProfile?.vehicleNumber ? `Vehicle ${user.deliveryProfile.vehicleNumber}` : null,
    user.deliveryProfile?.phone ? `Phone ${user.deliveryProfile.phone}` : null,
  ].filter(Boolean);

  return [
    {
      label: "Customer",
      active: Boolean(user.customer),
      detail: user.customer
        ? "Customer account profile is linked."
        : "No customer profile has been created.",
      icon: <UsersRound className="h-4 w-4 text-[#163B5C]" aria-hidden="true" />,
    },
    {
      label: "Seller",
      active: Boolean(user.seller),
      detail: user.seller
        ? "Seller center profile is linked."
        : "No seller profile has been created.",
      icon: <Store className="h-4 w-4 text-[#0F8A5F]" aria-hidden="true" />,
    },
    {
      label: "B2B buyer",
      active: Boolean(user.businessBuyer),
      detail: user.businessBuyer
        ? "B2B buyer portal profile is linked."
        : "No B2B buyer profile has been created.",
      icon: <Building2 className="h-4 w-4 text-[#6D28D9]" aria-hidden="true" />,
    },
    {
      label: "Delivery partner",
      active: Boolean(user.deliveryProfile),
      detail: user.deliveryProfile
        ? deliveryDetailParts.join(", ") || "Delivery partner profile is linked."
        : "No delivery partner profile has been created.",
      icon: <Truck className="h-4 w-4 text-[#B7791F]" aria-hidden="true" />,
    },
  ];
}

function UsersRolesEmptyState({
  isLoading,
  isEmpty,
  colSpan,
}: {
  isLoading?: boolean | undefined;
  isEmpty: boolean;
  colSpan: number;
}) {
  if (isLoading) {
    return (
      <tr>
        <td
          colSpan={colSpan}
          className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
        >
          Loading admin users...
        </td>
      </tr>
    );
  }

  if (!isEmpty) {
    return null;
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-[#667085]">
        No users found.
      </td>
    </tr>
  );
}

function UserIdentity({ user }: { user: UserRecord }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#EAF1F7] text-sm font-black uppercase text-[#163B5C]">
        {userInitials(user)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base font-black text-[#0B1F3A]">
          {user.fullName || user.email}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667085]">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{user.email}</span>
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667085]">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{user.phone || "Phone not set"}</span>
        </p>
      </div>
    </div>
  );
}

function userInitials(user: UserRecord) {
  const source = user.fullName || user.email || "User";
  const initials = source
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "US";
}

function UserDateStack({ user }: { user: UserRecord }) {
  const activityAt = user.updatedAt ?? user.createdAt;
  return (
    <div className="space-y-1 text-sm font-semibold text-[#163B5C]">
      <p>{customerDateLabel(activityAt)}</p>
      <p className="text-xs text-[#667085]">{customerTimeLabel(activityAt)}</p>
    </div>
  );
}

function RoleChipList({
  user,
  currentAdminId,
  onRemoveRole,
  disabled,
  variant = "full",
  readOnly = false,
}: {
  user: UserRecord;
  currentAdminId: string | null;
  onRemoveRole: (userId: string, roleCode: PlatformRoleCode) => void;
  disabled?: boolean | undefined;
  variant?: "full" | "icon";
  readOnly?: boolean | undefined;
}) {
  const roles = userRoleCodes(user);

  if (!roles.length) {
    if (variant === "icon") {
      return (
        <span
          title="No roles assigned"
          aria-label="No roles assigned"
          className="grid h-9 w-9 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#98A2B3]"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#667085]">
        No roles assigned
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {roles.map((roleCode) => (
          <span
            key={roleCode}
            title={humanize(roleCode)}
            aria-label={`${humanize(roleCode)} role`}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border shadow-sm",
              roleChipClass(roleCode),
            )}
          >
            {roleIcon(roleCode)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((roleCode) => {
        const isOwnAdminRole = user.id === currentAdminId && roleCode === "ADMIN";
        return (
          <span
            key={roleCode}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black ${roleChipClass(roleCode)}`}
          >
            {roleIcon(roleCode)}
            <span className="truncate">{humanize(roleCode)}</span>
            {readOnly ? null : (
              <button
                type="button"
                aria-label={`Remove ${humanize(roleCode)} role from ${user.email}`}
                title={
                  isOwnAdminRole
                    ? "You cannot remove your own admin role"
                    : `Remove ${humanize(roleCode)}`
                }
                onClick={() => onRemoveRole(user.id, roleCode)}
                disabled={disabled || isOwnAdminRole}
                className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#163B5C] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function RoleRemovalImpactDialog({
  request,
  impact,
  isLoading,
  error,
  removeError,
  note,
  onNoteChange,
  onClose,
  onConfirm,
  isRemoving,
}: {
  request: RoleRemovalDialogRequest | null;
  impact: RoleRemovalImpact | null;
  isLoading: boolean;
  error: unknown;
  removeError: unknown;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isRemoving: boolean;
}) {
  if (!request) {
    return null;
  }

  const noteError = roleRemovalNoteError(impact, note);
  const hasBlockers = roleRemovalHasBlockers(impact);
  const counts = visibleRoleRemovalCounts(impact);
  const canConfirm = Boolean(impact && !hasBlockers && !noteError && !isLoading && !isRemoving);

  return (
    <Dialog open onClose={isRemoving ? () => undefined : onClose} className="relative z-[160]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/55 transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-2xl rounded-lg border border-[#FFD1C4] bg-white p-5 shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-black text-[#1F2933]">
                    Remove {humanize(request.roleCode)} role?
                  </DialogTitle>
                  <Description className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                    Access will be removed from {request.user.email}. Business records are preserved;
                    only the related operational profile is suspended when required.
                  </Description>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isRemoving}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close role removal impact"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {isLoading ? (
                <div className="flex items-center gap-3 rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-bold text-[#667085]">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#ED3500]" aria-hidden="true" />
                  Checking role impact, active work, COD, payouts, and profile links.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4">
                  <p className="text-sm font-black text-[#B42318]">Unable to load role impact</p>
                  <p className="mt-1 text-sm font-semibold text-[#7A271A]">
                    {mutationErrorMessage(error)}
                  </p>
                </div>
              ) : null}

              {removeError ? (
                <div className="rounded-lg border border-[#F5B7B7] bg-[#FDECEC] p-4">
                  <p className="text-sm font-black text-[#B42318]">Unable to remove role</p>
                  <p className="mt-1 text-sm font-semibold text-[#7A271A]">
                    {mutationErrorMessage(removeError)}
                  </p>
                </div>
              ) : null}

              {impact ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={impact.canRemove ? "success" : "danger"}>
                      {impact.canRemove ? "Can remove" : "Blocked"}
                    </StatusBadge>
                    {impact.noteRequired ? <StatusBadge tone="warning">Admin note required</StatusBadge> : null}
                    {impact.affectedProfile ? (
                      <StatusBadge tone="info">{humanize(impact.affectedProfile)}</StatusBadge>
                    ) : null}
                  </div>

                  {impact.blockers.length ? (
                    <ImpactList
                      title="Resolve before removing"
                      tone="danger"
                      items={impact.blockers}
                    />
                  ) : null}

                  {impact.cleanupActions.length ? (
                    <ImpactList
                      title="Cleanup actions"
                      tone="info"
                      items={impact.cleanupActions}
                    />
                  ) : null}

                  {impact.warnings.length ? (
                    <ImpactList title="Preserved data" tone="warning" items={impact.warnings} />
                  ) : null}

                  {counts.length ? (
                    <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
                        Associated records
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {counts.map((item) => (
                          <div
                            key={item.key}
                            className="flex items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-white px-3 py-2"
                          >
                            <span className="text-xs font-black text-[#596276]">{item.label}</span>
                            <span className="text-sm font-black text-[#163B5C]">
                              {item.value.toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {impact.noteRequired ? (
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                        Admin note
                      </span>
                      <textarea
                        value={note}
                        onChange={(event) => onNoteChange(event.target.value)}
                        rows={3}
                        placeholder="Example: Active work cleared and profile access removed after admin review."
                        className={cn(
                          "mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500]",
                          noteError ? "border-[#F5B7B7]" : "border-[#D8E2EA]",
                        )}
                      />
                      {noteError ? (
                        <span className="mt-1 block text-xs font-bold text-[#B42318]">
                          {noteError}
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={isRemoving}>
                Keep role
              </Button>
              <Button
                type="button"
                className="bg-[#B42318] hover:bg-[#8F1D14] focus-visible:ring-[#B42318]"
                onClick={onConfirm}
                disabled={!canConfirm}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {isRemoving ? "Removing" : "Remove role"}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function ImpactList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "danger" | "warning" | "info";
  items: string[];
}) {
  const styles =
    tone === "danger"
      ? "border-[#F5B7B7] bg-[#FDECEC] text-[#B42318]"
      : tone === "warning"
        ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
        : "border-[#C5D8E8] bg-[#F8FAFC] text-[#163B5C]";

  return (
    <div className={cn("rounded-lg border p-4", styles)}>
      <p className="text-xs font-black uppercase tracking-wide">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm font-semibold leading-5">
            <span aria-hidden="true">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryPartnerProfileSummary({ user }: { user: UserRecord }) {
  const isDeliveryPartner = userRoleCodes(user).includes("DELIVERY_PARTNER");

  if (!isDeliveryPartner) {
    return null;
  }

  const profile = user.deliveryProfile;

  if (!profile) {
    return (
      <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Delivery partner profile
          </span>
          <StatusBadge tone="neutral">Not configured</StatusBadge>
        </div>
        <p className="mt-2 text-sm font-semibold text-[#667085]">
          Delivery partner role is assigned, but service details have not been saved yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
          Delivery partner profile
        </span>
        <StatusBadge tone={profile.isAvailable === false ? "danger" : "success"}>
          {profile.isAvailable === false ? "Inactive" : "Available"}
        </StatusBadge>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <ReadOnlyInfo label="Phone" value={profile.phone || user.phone || "Phone not set"} />
        <ReadOnlyInfo label="Vehicle" value={profile.vehicleNumber || "Vehicle not set"} />
        <ReadOnlyInfo
          label="Priority"
          value={profile.priority ? String(profile.priority) : "100"}
        />
        <ReadOnlyInfo label="Country" value={profile.serviceCountryCode || "Any country"} />
        <ReadOnlyInfo label="State" value={profile.serviceStateCode || "Any state"} />
        <ReadOnlyInfo label="City" value={profile.serviceCityCode || "Any city"} />
        <ReadOnlyInfo
          label="COD limit"
          value={
            profile.codCashLimitPaise ? formatPaise(profile.codCashLimitPaise) : "No limit set"
          }
        />
        <ReadOnlyInfo label="Notes" value={profile.notes || "No notes"} />
      </div>
      <ReadOnlyCodeGroup
        label="Service pincodes"
        values={profile.servicePincodes ?? []}
        emptyText="No specific pincodes"
      />
      <ReadOnlyCodeGroup
        label="Service local areas"
        values={profile.serviceLocalAreaCodes ?? []}
        emptyText="No specific local areas"
      />
    </div>
  );
}

function ReadOnlyInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#1F2933]">{value}</p>
    </div>
  );
}

function ReadOnlyCodeGroup({
  label,
  values,
  emptyText,
}: {
  label: string;
  values: string[];
  emptyText: string;
}) {
  return (
    <div className="mt-3 rounded-md border border-[#E5E7EB] bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length ? (
          values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-[#D8E2EA] bg-[#F8FAFC] px-2 py-1 text-[11px] font-black text-[#344054]"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-xs font-semibold text-[#667085]">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function RoleAddControl({
  user,
  onAddRole,
  disabled,
}: {
  user: UserRecord;
  onAddRole: (userId: string, roleCode: PlatformRoleCode) => void;
  disabled?: boolean | undefined;
}) {
  const assignedKey = userRoleCodes(user).join("|");
  const availableRoles = useMemo(() => {
    const assigned = new Set(assignedKey.split("|").filter(Boolean));
    return roleCodes.filter((roleCode) => !assigned.has(roleCode));
  }, [assignedKey]);
  const roleOptions = useMemo<AdminSelectOption[]>(
    () =>
      availableRoles.map((role) => ({
        value: role,
        label: humanize(role),
      })),
    [availableRoles],
  );
  const [roleCode, setRoleCode] = useState<PlatformRoleCode | "">(availableRoles[0] ?? "");

  useEffect(() => {
    if (roleCode && availableRoles.includes(roleCode)) {
      return;
    }
    setRoleCode(availableRoles[0] ?? "");
  }, [availableRoles, roleCode]);

  if (!availableRoles.length) {
    return <p className="mt-3 text-xs font-semibold text-[#667085]">All roles are assigned.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <AdminListbox
        label={`Add role for ${user.email}`}
        value={roleCode}
        options={roleOptions}
        onChange={(value) => setRoleCode(value as PlatformRoleCode)}
        placeholder="Select role"
        compact
        className="min-w-44 [&>span]:sr-only"
        buttonClassName="bg-white"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => roleCode && onAddRole(user.id, roleCode)}
        disabled={disabled || !roleCode}
      >
        <Plus className="h-4 w-4" />
        Add role
      </Button>
    </div>
  );
}

function BackOfficePasswordControl({
  user,
  onSetPassword,
  disabled,
}: {
  user: UserRecord;
  onSetPassword: (userId: string, password: string) => void;
  disabled?: boolean | undefined;
}) {
  const roles = userRoleCodes(user);
  const backOfficeUser = roles.includes("ADMIN") || roles.includes("FINANCE") || roles.includes("COURIER_MANAGER");
  const [password, setPassword] = useState("");

  if (!backOfficeUser) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
          Back-office password
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Set or rotate password"
          className="mt-2 h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => {
          onSetPassword(user.id, password);
          setPassword("");
        }}
        disabled={disabled || password.length < 8}
      >
        <KeyRound className="h-4 w-4" />
        Save password
      </Button>
      <p className="mt-2 text-xs font-semibold text-[#667085]">
        Required for standalone Admin, Finance, or Courier workspace sign in.
      </p>
    </div>
  );
}

function DeliveryPartnerProfileControl({
  user,
  onSubmit,
  disabled,
}: {
  user: UserRecord;
  onSubmit: (userId: string, payload: Record<string, string>) => void;
  disabled?: boolean | undefined;
}) {
  const isDeliveryPartner = userRoleCodes(user).includes("DELIVERY_PARTNER");
  const profile = user.deliveryProfile;
  const [form, setForm] = useState({
    phone: profile?.phone ?? user.phone ?? "",
    vehicleNumber: profile?.vehicleNumber ?? "",
    isAvailable: profile?.isAvailable === false ? "false" : "true",
    priority: profile?.priority ? String(profile.priority) : "100",
    serviceCountryCode: profile?.serviceCountryCode ?? "IN",
    serviceStateCode: profile?.serviceStateCode ?? "",
    serviceCityCode: profile?.serviceCityCode ?? "",
    servicePincodes: profile?.servicePincodes?.join(", ") ?? "",
    serviceLocalAreaCodes: profile?.serviceLocalAreaCodes?.join(", ") ?? "",
    codCashLimitPaise: profile?.codCashLimitPaise ? String(profile.codCashLimitPaise) : "",
    notes: profile?.notes ?? "",
  });

  useEffect(() => {
    setForm({
      phone: profile?.phone ?? user.phone ?? "",
      vehicleNumber: profile?.vehicleNumber ?? "",
      isAvailable: profile?.isAvailable === false ? "false" : "true",
      priority: profile?.priority ? String(profile.priority) : "100",
      serviceCountryCode: profile?.serviceCountryCode ?? "IN",
      serviceStateCode: profile?.serviceStateCode ?? "",
      serviceCityCode: profile?.serviceCityCode ?? "",
      servicePincodes: profile?.servicePincodes?.join(", ") ?? "",
      serviceLocalAreaCodes: profile?.serviceLocalAreaCodes?.join(", ") ?? "",
      codCashLimitPaise: profile?.codCashLimitPaise ? String(profile.codCashLimitPaise) : "",
      notes: profile?.notes ?? "",
    });
  }, [profile, user.phone]);

  if (!isDeliveryPartner) {
    return null;
  }
  const serviceLocation: AdminLocationValue = {
    countryCode: form.serviceCountryCode,
    stateCode: form.serviceStateCode,
    cityCode: form.serviceCityCode,
    pincode: firstCodeValue(form.servicePincodes),
    localAreaCode: firstCodeValue(form.serviceLocalAreaCodes),
  };
  const applyServiceLocation = (location: AdminLocationValue) => {
    setForm((current) => ({
      ...current,
      serviceCountryCode: location.countryCode,
      serviceStateCode: location.stateCode,
      serviceCityCode: location.cityCode,
      servicePincodes: location.pincode
        ? joinCodeValues(addCodeValue(current.servicePincodes, location.pincode))
        : current.servicePincodes,
      serviceLocalAreaCodes: location.localAreaCode
        ? joinCodeValues(addCodeValue(current.serviceLocalAreaCodes, location.localAreaCode))
        : current.serviceLocalAreaCodes,
    }));
  };

  return (
    <div className="mt-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Delivery partner profile
          </span>
          <StatusBadge tone={form.isAvailable === "true" ? "success" : "danger"}>
            {form.isAvailable === "true" ? "Available" : "Inactive"}
          </StatusBadge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SmallInput
            label="Phone"
            value={form.phone}
            onChange={(phone) => setForm((current) => ({ ...current, phone }))}
          />
          <SmallInput
            label="Vehicle"
            value={form.vehicleNumber}
            onChange={(vehicleNumber) => setForm((current) => ({ ...current, vehicleNumber }))}
          />
          <SmallInput
            label="Priority"
            value={form.priority}
            onChange={(priority) => setForm((current) => ({ ...current, priority }))}
          />
          <div className="grid gap-2 sm:col-span-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">
              Service area
            </span>
            <AdminLocationSelector
              value={serviceLocation}
              onChange={applyServiceLocation}
              allowAnyCountry
            />
            <CodeChipEditor
              label="Service pincodes"
              values={codeValues(form.servicePincodes)}
              onRemove={(code) =>
                setForm((current) => ({
                  ...current,
                  servicePincodes: joinCodeValues(removeCodeValue(current.servicePincodes, code)),
                }))
              }
              onClear={() => setForm((current) => ({ ...current, servicePincodes: "" }))}
            />
            <CodeChipEditor
              label="Service local areas"
              values={codeValues(form.serviceLocalAreaCodes)}
              onRemove={(code) =>
                setForm((current) => ({
                  ...current,
                  serviceLocalAreaCodes: joinCodeValues(
                    removeCodeValue(current.serviceLocalAreaCodes, code),
                  ),
                }))
              }
              onClear={() => setForm((current) => ({ ...current, serviceLocalAreaCodes: "" }))}
            />
          </div>
          <SmallInput
            label="COD limit paise"
            value={form.codCashLimitPaise}
            onChange={(codCashLimitPaise) =>
              setForm((current) => ({ ...current, codCashLimitPaise }))
            }
          />
          <SmallInput
            label="Notes"
            value={form.notes}
            onChange={(notes) => setForm((current) => ({ ...current, notes }))}
          />
          <label className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">
              Availability
            </span>
            <select
              value={form.isAvailable}
              onChange={(event) =>
                setForm((current) => ({ ...current, isAvailable: event.target.value }))
              }
              className="h-9 w-full rounded-md border border-[#D8E2EA] bg-white px-2 text-xs font-semibold text-[#1F2933]"
            >
              <option value="true">Available</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onSubmit(user.id, form)}
        >
          Save delivery profile
        </Button>
      </div>
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-[#D8E2EA] bg-white px-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
      />
    </label>
  );
}

function CodeChipEditor({
  label,
  values,
  onRemove,
  onClear,
}: {
  label: string;
  values: string[];
  onRemove: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-white p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-[#667085]">
          {label}
        </span>
        {values.length ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-black text-[#ED3500] hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full border border-[#D8E2EA] bg-[#F8FAFC] px-2 py-1 text-[11px] font-black text-[#344054]"
          >
            {value}
            <button
              type="button"
              onClick={() => onRemove(value)}
              className="text-[#667085] hover:text-[#ED3500]"
              aria-label={`Remove ${value}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!values.length ? (
          <span className="text-xs font-semibold text-[#667085]">
            Select a pincode or local area from the dropdown above.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function codeValues(value: string) {
  return value
    .split(/[,\s]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function joinCodeValues(values: string[]) {
  return Array.from(new Set(values.map((code) => code.trim()).filter(Boolean))).join(", ");
}

function firstCodeValue(value: string) {
  return codeValues(value)[0] ?? "";
}

function addCodeValue(current: string, next: string) {
  return [...codeValues(current), next.trim()].filter(Boolean);
}

function removeCodeValue(current: string, remove: string) {
  return codeValues(current).filter((code) => code !== remove);
}

function AccountProfilePills({
  user,
  variant = "full",
}: {
  user: UserRecord;
  variant?: "full" | "icon";
}) {
  const profiles = [
    {
      label: "Customer",
      active: Boolean(user.customer),
      icon: <UsersRound className="h-3.5 w-3.5" />,
    },
    { label: "Seller", active: Boolean(user.seller), icon: <Store className="h-3.5 w-3.5" /> },
    {
      label: "B2B buyer",
      active: Boolean(user.businessBuyer),
      icon: <Building2 className="h-3.5 w-3.5" />,
    },
  ];

  if (variant === "icon") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {profiles.map((profile) => (
          <span
            key={profile.label}
            title={`${profile.label} profile ${profile.active ? "linked" : "not linked"}`}
            aria-label={`${profile.label} profile ${profile.active ? "linked" : "not linked"}`}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border transition",
              profile.active
                ? "border-[#C5D8E8] bg-[#F8FAFC] text-[#163B5C] shadow-sm"
                : "border-[#E5E7EB] bg-white text-[#98A2B3] opacity-70",
            )}
          >
            {profile.icon}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 xl:flex-col xl:items-start">
      {profiles.map((profile) => (
        <span
          key={profile.label}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black ${
            profile.active
              ? "border-[#D8E2EA] bg-[#F8FAFC] text-[#344054]"
              : "border-[#E5E7EB] bg-white text-[#98A2B3]"
          }`}
        >
          {profile.icon}
          {profile.label}
        </span>
      ))}
    </div>
  );
}

function UserStatusActions({
  current,
  onPick,
  disabled,
}: {
  current: string;
  onPick: (status: string) => void;
  disabled?: boolean | undefined;
}) {
  const items: AdminActionItem[] = userStatuses.map((status) => ({
    label: `Mark ${humanize(status)}`,
    description:
      status === "ACTIVE"
        ? "Allow this user to access assigned profiles."
        : status === "PENDING"
          ? "Move this user back to review."
          : "Disable this user account.",
    icon: statusIcon(status),
    destructive: status === "DISABLED",
    disabled: disabled || status === current,
    onSelect: () => onPick(status),
  }));

  return (
    <AdminActionMenu
      label="User actions"
      items={items}
      buttonClassName="h-9 w-9 border-transparent px-0 text-[#0B1F3A] hover:bg-[#F8FAFC] [&>span]:sr-only"
    />
  );
}

function filterUsers(
  users: UserRecord[],
  roleFilter: UserRoleFilter,
  profileFilter: UserProfileFilter,
  statusFilter: UserStatusFilter,
) {
  return users.filter((user) => {
    if (statusFilter !== "ALL" && user.status !== statusFilter) {
      return false;
    }

    if (roleFilter !== "ALL" && !userRoleCodes(user).includes(roleFilter)) {
      return false;
    }

    if (profileFilter !== "ALL" && !userHasProfile(user, profileFilter)) {
      return false;
    }

    return true;
  });
}

function userHasProfile(user: UserRecord, profileFilter: Exclude<UserProfileFilter, "ALL">) {
  if (profileFilter === "CUSTOMER") {
    return Boolean(user.customer);
  }
  if (profileFilter === "SELLER") {
    return Boolean(user.seller);
  }
  return Boolean(user.businessBuyer);
}

function userRoleCodes(user: UserRecord): PlatformRoleCode[] {
  return (
    user.userRoles
      ?.map((item) => item.role?.code)
      .filter((roleCode): roleCode is PlatformRoleCode =>
        roleCodes.includes(roleCode as PlatformRoleCode),
      ) ?? []
  );
}

function roleIcon(roleCode: PlatformRoleCode) {
  const className = "h-3.5 w-3.5 shrink-0";
  switch (roleCode) {
    case "CUSTOMER":
      return <UsersRound className={className} />;
    case "SELLER":
      return <Store className={className} />;
    case "BUSINESS_BUYER":
      return <Building2 className={className} />;
    case "ADMIN":
      return <ShieldCheck className={className} />;
    case "SUPPORT_STAFF":
      return <ShieldAlert className={className} />;
    case "DELIVERY_PARTNER":
      return <ClipboardList className={className} />;
    case "FINANCE":
      return <Landmark className={className} />;
    case "COURIER_MANAGER":
      return <Truck className={className} />;
  }
}

function roleChipClass(roleCode: PlatformRoleCode) {
  if (roleCode === "ADMIN") {
    return "border-[#B9D7FF] bg-[#EAF3FF] text-[#175CD3]";
  }
  if (roleCode === "SELLER") {
    return "border-[#BFEAD9] bg-[#E9F7F1] text-[#0F8A5F]";
  }
  if (roleCode === "BUSINESS_BUYER") {
    return "border-[#D8C8FF] bg-[#F2EDFF] text-[#6D28D9]";
  }
  if (roleCode === "CUSTOMER") {
    return "border-[#D8E2EA] bg-[#EAF1F7] text-[#163B5C]";
  }
  if (roleCode === "FINANCE") {
    return "border-[#F8DCA6] bg-[#FFF7E6] text-[#B7791F]";
  }
  if (roleCode === "COURIER_MANAGER") {
    return "border-[#BFEAD9] bg-[#E9F7F1] text-[#0F8A5F]";
  }
  return "border-[#E5E7EB] bg-[#F8FAFC] text-[#475467]";
}

function statusIcon(status: string) {
  const className = "h-4 w-4";
  if (status === "ACTIVE") {
    return <CheckCircle2 className={className} />;
  }
  if (status === "DISABLED") {
    return <XCircle className={className} />;
  }
  return <KeyRound className={className} />;
}

function B2BAction({
  status,
  onStatus,
  onApprove,
  onFinalise,
  onRespond,
  disabled,
}: {
  status: string;
  onStatus: (status: string) => void;
  onApprove: () => void;
  onFinalise: () => void;
  onRespond: (responseMessage: string, quotedPricePaise?: number | undefined) => void;
  disabled?: boolean;
}) {
  const statusOptions = b2bAdminStatusOptions(status);
  const [nextStatus, setNextStatus] = useState(statusOptions[0] ?? "");
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const canRespond = ["SUBMITTED", "IN_REVIEW", "RESPONDED"].includes(status);
  const canManuallyUpdate = statusOptions.length > 0;
  const canApprove = status === "BUYER_CONFIRMED";
  const canFinalise = status === "ADMIN_APPROVED";
  const statusSelectOptions = useMemo<AdminSelectOption[]>(
    () => statusOptions.map((item) => ({ value: item, label: humanize(item) })),
    [statusOptions],
  );

  useEffect(() => {
    setNextStatus(b2bAdminStatusOptions(status)[0] ?? "");
  }, [status]);

  return (
    <div className="space-y-3">
      {canManuallyUpdate ? (
        <div className="flex flex-wrap gap-2">
          <AdminListbox
            label="B2B status"
            value={nextStatus}
            options={statusSelectOptions}
            onChange={setNextStatus}
            compact
            className="min-w-44 [&>span]:sr-only"
            buttonClassName="bg-white"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onStatus(nextStatus)}
            disabled={disabled || !nextStatus}
          >
            Update
          </Button>
          {canApprove ? (
            <Button type="button" size="sm" onClick={onApprove} disabled={disabled}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
          ) : null}
          {canFinalise ? (
            <Button type="button" size="sm" onClick={onFinalise} disabled={disabled}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Finalise
            </Button>
          ) : null}
        </div>
      ) : null}
      {canRespond ? (
        <>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Admin response"
            className="min-h-20 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Quoted price in rupees"
              className="h-9 w-44 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933]"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onRespond(message, price.trim() ? Math.round(Number(price) * 100) : undefined);
                setMessage("");
                setPrice("");
              }}
              disabled={disabled || message.trim().length < 5}
            >
              Send response
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs font-semibold leading-5 text-[#667085]">
          {status === "BUYER_CONFIRMED"
            ? "Buyer confirmed this quotation. Approve it to move it toward finalisation."
            : status === "ADMIN_APPROVED"
              ? "Admin approval is done. Finalise when the manual order or offline processing is ready."
              : "This enquiry is locked for further responses."}
        </p>
      )}
    </div>
  );
}

function b2bAdminStatusOptions(status: string) {
  if (status === "SUBMITTED") {
    return b2bManualAdminStatuses;
  }

  if (status === "IN_REVIEW" || status === "BUYER_CONFIRMED" || status === "ADMIN_APPROVED") {
    return ["CLOSED", "CANCELLED"];
  }

  if (status === "RESPONDED") {
    return ["IN_REVIEW", "CLOSED", "CANCELLED"];
  }

  return [];
}

function SupportAction({
  status,
  note,
  onSubmit,
  disabled,
}: {
  status: string;
  note?: string | null | undefined;
  onSubmit: (status: string, note?: string) => void;
  disabled?: boolean;
}) {
  const [nextStatus, setNextStatus] = useState(status);
  const [adminNote, setAdminNote] = useState(note ?? "");
  const supportStatusOptions = useMemo<AdminSelectOption[]>(
    () => supportStatuses.map((item) => ({ value: item, label: humanize(item) })),
    [],
  );
  return (
    <div className="space-y-2">
      <AdminListbox
        label="Support status"
        value={nextStatus}
        options={supportStatusOptions}
        onChange={setNextStatus}
        compact
        className="[&>span]:sr-only"
        buttonClassName="bg-white"
      />
      <textarea
        value={adminNote}
        onChange={(event) => setAdminNote(event.target.value)}
        placeholder="Internal resolution note"
        className="min-h-20 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => onSubmit(nextStatus, adminNote)}
        disabled={disabled}
      >
        Update request
      </Button>
    </div>
  );
}

function OrderStatusForm({
  currentOrderStatus,
  currentPaymentStatus,
  onSubmit,
  disabled,
}: {
  currentOrderStatus: string;
  currentPaymentStatus: string;
  onSubmit: (payload: { orderStatus?: string; paymentStatus?: string; note?: string }) => void;
  disabled?: boolean;
}) {
  const [orderStatus, setOrderStatus] = useState(currentOrderStatus);
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
  const [note, setNote] = useState("");
  return (
    <Panel title="Order and payment status">
      <div className="space-y-3">
        <LabeledSelect
          label="Order status"
          value={orderStatus}
          values={orderStatuses}
          onChange={setOrderStatus}
        />
        <LabeledSelect
          label="Payment status"
          value={paymentStatus}
          values={paymentStatuses}
          onChange={setPaymentStatus}
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Status update note"
          className="min-h-24 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
        />
        <Button
          type="button"
          onClick={() => onSubmit({ orderStatus, paymentStatus, note })}
          disabled={disabled}
        >
          Update status
        </Button>
      </div>
    </Panel>
  );
}

function DeliveryForm({
  delivery,
  deliveryPartners,
  deliveryPartnersLoading,
  deliveryPartnersError,
  onSubmit,
  onAssign,
  onAutoAssign,
  disabled,
}: {
  delivery: OrderRecord["deliveryDetail"];
  deliveryPartners: UserRecord[];
  deliveryPartnersLoading?: boolean;
  deliveryPartnersError?: string | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  onAssign: (payload: {
    deliveryPartnerUserId?: string | null;
    assignmentNote?: string | undefined;
  }) => void;
  onAutoAssign: () => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<DeliveryFormState>({
    status: delivery?.status ?? "PENDING",
    deliveryMode: delivery?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER",
    deliveryPartnerUserId: delivery?.deliveryPartnerUserId ?? deliveryPartnerUnassignedValue,
    partnerName: delivery?.partnerName ?? "",
    partnerPhone: delivery?.partnerPhone ?? "",
    trackingReference: delivery?.trackingReference ?? "",
    estimatedDeliveryDate: delivery?.estimatedDeliveryDate?.slice(0, 10) ?? "",
    deliveryNote: delivery?.deliveryNote ?? "",
    receiverName: delivery?.receiverName ?? "",
    proofNote: delivery?.proofNote ?? "",
    proofReference: delivery?.proofReference ?? "",
  });
  const deliveryPartnerOptions = useMemo<AdminSelectOption[]>(() => {
    const partners = [...deliveryPartners];
    if (
      delivery?.deliveryPartner &&
      !partners.some((partner) => partner.id === delivery.deliveryPartner?.id)
    ) {
      partners.unshift(delivery.deliveryPartner);
    }

    return [
      {
        value: deliveryPartnerUnassignedValue,
        label: "Unassigned",
        description: "Admin will manage delivery without partner login.",
      },
      ...partners.map((partner) => ({
        value: partner.id,
        label: partner.fullName || partner.email,
        description:
          [
            partner.email,
            partner.phone,
            `${partner.activeWorkload ?? 0} active`,
            `COD ${formatPaise(partner.pendingCodCashPaise ?? 0)}`,
          ]
            .filter(Boolean)
            .join(" / ") || "Delivery partner user",
      })),
    ];
  }, [delivery?.deliveryPartner, deliveryPartners]);
  const isLocalDeliveryMode = form.deliveryMode === "LOCAL_DELIVERY_PARTNER";
  const selectedPartner =
    deliveryPartners.find((partner) => partner.id === form.deliveryPartnerUserId) ??
    (delivery?.deliveryPartnerUserId === form.deliveryPartnerUserId
      ? delivery?.deliveryPartner
      : null);

  useEffect(() => {
    setForm({
      status: delivery?.status ?? "PENDING",
      deliveryMode: delivery?.deliveryMode ?? "LOCAL_DELIVERY_PARTNER",
      deliveryPartnerUserId: delivery?.deliveryPartnerUserId ?? deliveryPartnerUnassignedValue,
      partnerName: delivery?.partnerName ?? "",
      partnerPhone: delivery?.partnerPhone ?? "",
      trackingReference: delivery?.trackingReference ?? "",
      estimatedDeliveryDate: delivery?.estimatedDeliveryDate?.slice(0, 10) ?? "",
      deliveryNote: delivery?.deliveryNote ?? "",
      receiverName: delivery?.receiverName ?? "",
      proofNote: delivery?.proofNote ?? "",
      proofReference: delivery?.proofReference ?? "",
    });
  }, [delivery]);

  const selectedPartnerId =
    !isLocalDeliveryMode || form.deliveryPartnerUserId === deliveryPartnerUnassignedValue
      ? null
      : form.deliveryPartnerUserId;
  const submitDelivery = () => {
    onSubmit({
      ...form,
      deliveryPartnerUserId: selectedPartnerId,
    });
  };
  const submitAssignment = () => {
    onAssign({
      deliveryPartnerUserId: selectedPartnerId,
      assignmentNote: form.deliveryNote || undefined,
    });
  };

  return (
    <Panel title="Delivery assignment and progress">
      <div className="space-y-3">
        <div className="grid gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={
                delivery?.assignmentStatus === "ACCEPTED"
                  ? "success"
                  : delivery?.assignmentStatus === "REJECTED"
                    ? "danger"
                    : "warning"
              }
            >
              Assignment {humanize(delivery?.assignmentStatus ?? "UNASSIGNED")}
            </StatusBadge>
            {delivery?.assignedAt ? (
              <span className="text-xs font-bold text-[#667085]">
                Assigned {formatDate(delivery.assignedAt)}
              </span>
            ) : null}
            {delivery?.acceptedAt ? (
              <span className="text-xs font-bold text-[#667085]">
                Accepted {formatDate(delivery.acceptedAt)}
              </span>
            ) : null}
            {delivery?.rejectedAt ? (
              <span className="text-xs font-bold text-[#667085]">
                Rejected {formatDate(delivery.rejectedAt)}
              </span>
            ) : null}
          </div>
          {delivery?.assignmentNote ? (
            <p className="rounded-md border border-[#FFD2C2] bg-[#FFF5F1] px-3 py-2 text-xs font-bold leading-5 text-[#8A2F15]">
              {delivery.assignmentNote}
            </p>
          ) : null}
          {isLocalDeliveryMode && selectedPartner ? (
            <PartnerWorkloadSummary partner={selectedPartner} />
          ) : null}
          {!isLocalDeliveryMode ? (
            <p className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-bold leading-5 text-[#667085]">
              Local partner assignment is only used for Local Delivery Partner mode. Store pickup
              and courier service orders stay unassigned here.
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              onClick={onAutoAssign}
              disabled={disabled || !isLocalDeliveryMode}
            >
              Auto assign best partner
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={submitAssignment}
              disabled={disabled || !isLocalDeliveryMode}
            >
              {selectedPartnerId ? "Save reassignment" : "Save unassignment"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onAssign({
                  deliveryPartnerUserId: null,
                  assignmentNote: "Unassigned from admin order detail.",
                })
              }
              disabled={disabled || !delivery?.deliveryPartnerUserId}
            >
              Unassign
            </Button>
          </div>
        </div>
        <LabeledSelect
          label="Delivery status"
          value={form.status}
          values={deliveryStatuses}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <AdminListbox
          label="Delivery mode"
          value={form.deliveryMode}
          options={deliveryModeOptions}
          onChange={(deliveryMode) =>
            setForm((current) => ({
              ...current,
              deliveryMode,
              deliveryPartnerUserId:
                deliveryMode === "LOCAL_DELIVERY_PARTNER"
                  ? current.deliveryPartnerUserId
                  : deliveryPartnerUnassignedValue,
            }))
          }
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Assigned delivery partner"
          value={form.deliveryPartnerUserId}
          options={deliveryPartnerOptions}
          onChange={(deliveryPartnerUserId) =>
            setForm((current) => ({ ...current, deliveryPartnerUserId }))
          }
          placeholder={
            isLocalDeliveryMode
              ? deliveryPartnersLoading
                ? "Loading partners..."
                : "Assign delivery partner"
              : "Only for Local Delivery Partner mode"
          }
          disabled={
            !isLocalDeliveryMode || deliveryPartnersLoading || Boolean(deliveryPartnersError)
          }
          buttonClassName="bg-white"
        />
        {deliveryPartnersError ? (
          <p className="text-xs font-bold text-[#D64545]">{deliveryPartnersError}</p>
        ) : null}
        {deliveryTextFields.map(([key, label, placeholder]) => (
          <label key={key} className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              {label}
            </span>
            <input
              value={form[key as keyof typeof form]}
              type={key === "estimatedDeliveryDate" ? "date" : "text"}
              placeholder={placeholder}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933]"
            />
          </label>
        ))}
        <Button type="button" onClick={submitDelivery} disabled={disabled}>
          Update delivery
        </Button>
      </div>
    </Panel>
  );
}

function PartnerWorkloadSummary({ partner }: { partner: UserRecord }) {
  const profile = partner.deliveryProfile;

  return (
    <div className="grid gap-2 rounded-md bg-white p-3 text-xs font-semibold text-[#667085]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black text-[#1F2933]">{partner.fullName || partner.email}</span>
        <StatusBadge tone={profile?.isAvailable === false ? "danger" : "success"}>
          {profile?.isAvailable === false ? "Inactive" : "Available"}
        </StatusBadge>
      </div>
      <p>
        Workload {partner.activeWorkload ?? 0} active / COD exposure{" "}
        {formatPaise(partner.pendingCodCashPaise ?? 0)}
        {profile?.codCashLimitPaise ? ` of ${formatPaise(profile.codCashLimitPaise)}` : ""}
      </p>
      <p>
        Service area:{" "}
        {[
          profile?.serviceCityCode,
          profile?.servicePincodes?.length ? `PIN ${profile.servicePincodes.join(", ")}` : null,
          profile?.vehicleNumber,
        ]
          .filter(Boolean)
          .join(" / ") || "Broad manual coverage"}
      </p>
    </div>
  );
}

function CodCollectionPanel({
  order,
  disabled,
  error,
  onVerify,
  onReject,
}: {
  order: OrderRecord;
  disabled?: boolean;
  error?: string | null;
  onVerify: (note: string) => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const delivery = order.deliveryDetail;
  const codPayment =
    order.payments?.find((payment) => payment.provider === "COD" || payment.method === "COD") ??
    null;

  if (!codPayment) {
    return null;
  }

  const collectionStatus = delivery?.codCollectionStatus ?? "NOT_COLLECTED";
  const collectedAmount = delivery?.codCollectedAmountPaise ?? null;
  const expectedAmount = codPayment.amountPaise;
  const amountMatches = collectedAmount === expectedAmount;
  const canVerify =
    collectionStatus === "COLLECTED" && order.paymentStatus === "PENDING" && amountMatches;
  const canReject = collectionStatus === "COLLECTED" && order.paymentStatus === "PENDING";

  return (
    <Panel title="COD collection">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={
              collectionStatus === "VERIFIED"
                ? "success"
                : collectionStatus === "REJECTED"
                  ? "danger"
                  : collectionStatus === "COLLECTED"
                    ? "warning"
                    : "neutral"
            }
          >
            {humanize(collectionStatus)}
          </StatusBadge>
          <StatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>
            {humanize(order.paymentStatus)}
          </StatusBadge>
        </div>

        <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
          <div className="flex justify-between gap-3">
            <span>Expected COD</span>
            <span className="font-black text-[#1F2933]">
              {formatPaise(expectedAmount, codPayment.currency)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>Reported collected</span>
            <span className="font-black text-[#1F2933]">
              {collectedAmount === null
                ? "Not reported"
                : formatPaise(collectedAmount, codPayment.currency)}
            </span>
          </div>
        </div>

        {delivery?.codCollectedAt ? (
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            Collected by{" "}
            {delivery.codCollectedBy?.fullName || delivery.codCollectedBy?.email || "delivery user"}{" "}
            on {formatDate(delivery.codCollectedAt)}.
          </p>
        ) : null}
        {delivery?.codCollectionNote ? (
          <p className="rounded-md bg-[#FFFCFB] p-3 text-xs font-semibold leading-5 text-[#667085]">
            {delivery.codCollectionNote}
          </p>
        ) : null}
        {delivery?.codVerifiedAt ? (
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            Verified by{" "}
            {delivery.codVerifiedBy?.fullName || delivery.codVerifiedBy?.email || "admin"} on{" "}
            {formatDate(delivery.codVerifiedAt)}.
          </p>
        ) : null}
        {delivery?.codVerificationNote ? (
          <p className="rounded-md bg-[#F8FAFC] p-3 text-xs font-semibold leading-5 text-[#667085]">
            {delivery.codVerificationNote}
          </p>
        ) : null}

        {!amountMatches && collectionStatus === "COLLECTED" ? (
          <p className="rounded-md border border-[#FFC7B8] bg-[#FFF0EC] p-3 text-xs font-bold leading-5 text-[#9F2600]">
            Reported cash does not match expected COD amount. Reject this record or correct it
            before marking paid.
          </p>
        ) : null}

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Verification note"
          className="min-h-20 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
        />
        {error ? <p className="text-xs font-bold text-[#D64545]">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => onVerify(note.trim())}
            disabled={disabled || !canVerify}
          >
            Verify and mark paid
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onReject(note.trim())}
            disabled={disabled || !canReject}
          >
            Reject collection
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function LabeledSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  const options = useMemo<AdminSelectOption[]>(
    () => values.map((item) => ({ value: item, label: humanize(item) })),
    [values],
  );

  return (
    <AdminListbox
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      buttonClassName="bg-white"
    />
  );
}

function Timeline({
  events,
}: {
  events: Array<{
    id: string;
    label: string;
    note?: string | null | undefined;
    date?: string | null | undefined;
  }>;
}) {
  if (!events.length) {
    return <p className="text-sm font-semibold text-[#667085]">No order timeline events yet.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="border-l-2 border-[#D8E2EA] pl-4">
          <p className="font-black text-[#1F2933]">{event.label}</p>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{formatDate(event.date)}</p>
          {event.note ? <p className="mt-1 text-sm text-[#667085]">{event.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

function PaymentConfigurationForm({
  config,
  onSubmit,
  disabled,
}: {
  config: PaymentConfiguration;
  onSubmit: (payload: unknown) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<PaymentConfigurationFormState>(() =>
    paymentConfigurationFormState(config),
  );

  useEffect(() => {
    setForm(paymentConfigurationFormState(config));
  }, [config]);

  const codMaxOrderPaise = rupeesToPaise(form.codMaxOrderRupees);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Razorpay">
        <div className="grid gap-4 md:grid-cols-2">
          <AdminSwitch
            label="Enable Razorpay checkout"
            description={
              config.razorpay.configured
                ? "Online payment is available when enabled."
                : "Add key ID and key secret before enabling live checkout."
            }
            checked={form.razorpayEnabled}
            onChange={(razorpayEnabled) => setForm((current) => ({ ...current, razorpayEnabled }))}
            disabled={disabled}
          />
          <AdminListbox
            label="Mode"
            value={form.razorpayMode}
            options={[
              { value: "TEST", label: "Test" },
              { value: "LIVE", label: "Live" },
            ]}
            onChange={(value) =>
              setForm((current) => ({ ...current, razorpayMode: value as "TEST" | "LIVE" }))
            }
            buttonClassName="bg-white"
          />
          <PaymentInput
            label="Key ID"
            value={form.razorpayKeyId}
            placeholder={config.razorpay.keyIdPreview ?? "rzp_test_..."}
            onChange={(razorpayKeyId) => setForm((current) => ({ ...current, razorpayKeyId }))}
          />
          <SecretPaymentInput
            label="Key secret"
            configured={config.razorpay.keySecretConfigured}
            value={form.razorpayKeySecret}
            clear={form.clearRazorpayKeySecret}
            onClear={(clearRazorpayKeySecret) =>
              setForm((current) => ({ ...current, clearRazorpayKeySecret }))
            }
            onChange={(razorpayKeySecret) =>
              setForm((current) => ({ ...current, razorpayKeySecret }))
            }
          />
          <SecretPaymentInput
            label="Webhook secret"
            configured={config.razorpay.webhookSecretConfigured}
            value={form.razorpayWebhookSecret}
            clear={form.clearRazorpayWebhookSecret}
            onClear={(clearRazorpayWebhookSecret) =>
              setForm((current) => ({ ...current, clearRazorpayWebhookSecret }))
            }
            onChange={(razorpayWebhookSecret) =>
              setForm((current) => ({ ...current, razorpayWebhookSecret }))
            }
          />
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              Webhook path
            </span>
            <input
              value={config.razorpay.webhookPath}
              readOnly
              className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#667085]"
            />
          </label>
        </div>
      </Panel>

      <Panel title="Checkout methods">
        <div className="space-y-4">
          <AdminSwitch
            label="Cash on delivery"
            description="Creates a pending COD payment record and lets admin mark payment collected later."
            checked={form.codEnabled}
            onChange={(codEnabled) => setForm((current) => ({ ...current, codEnabled }))}
            disabled={disabled}
          />
          <PaymentInput
            label="COD max order amount"
            value={form.codMaxOrderRupees}
            placeholder="0 means no limit"
            onChange={(codMaxOrderRupees) =>
              setForm((current) => ({ ...current, codMaxOrderRupees }))
            }
          />
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              COD instructions
            </span>
            <textarea
              value={form.codInstructions}
              onChange={(event) =>
                setForm((current) => ({ ...current, codInstructions: event.target.value }))
              }
              rows={4}
              className="mt-1 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
            />
          </label>
          <AdminSwitch
            label="Bank transfer"
            description={
              config.bankTransfer.configured
                ? "Shows configured bank/UPI details at checkout when enabled."
                : "Add bank account or UPI details before checkout can use this option."
            }
            checked={form.bankTransferEnabled}
            onChange={(bankTransferEnabled) =>
              setForm((current) => ({ ...current, bankTransferEnabled }))
            }
            disabled={disabled}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <PaymentInput
              label="Account holder"
              value={form.bankTransferAccountHolderName}
              placeholder="1HandIndia Marketplace"
              onChange={(bankTransferAccountHolderName) =>
                setForm((current) => ({ ...current, bankTransferAccountHolderName }))
              }
            />
            <PaymentInput
              label="Bank name"
              value={form.bankTransferBankName}
              placeholder="Bank name"
              onChange={(bankTransferBankName) =>
                setForm((current) => ({ ...current, bankTransferBankName }))
              }
            />
            <PaymentInput
              label="Account number"
              value={form.bankTransferAccountNumber}
              placeholder="Account number"
              onChange={(bankTransferAccountNumber) =>
                setForm((current) => ({ ...current, bankTransferAccountNumber }))
              }
            />
            <PaymentInput
              label="IFSC"
              value={form.bankTransferIfscCode}
              placeholder="IFSC code"
              onChange={(bankTransferIfscCode) =>
                setForm((current) => ({ ...current, bankTransferIfscCode }))
              }
            />
            <PaymentInput
              label="Branch"
              value={form.bankTransferBranch}
              placeholder="Branch"
              onChange={(bankTransferBranch) =>
                setForm((current) => ({ ...current, bankTransferBranch }))
              }
            />
            <PaymentInput
              label="UPI ID"
              value={form.bankTransferUpiId}
              placeholder="payments@upi"
              onChange={(bankTransferUpiId) =>
                setForm((current) => ({ ...current, bankTransferUpiId }))
              }
            />
          </div>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              Bank transfer instructions
            </span>
            <textarea
              value={form.bankTransferInstructions}
              onChange={(event) =>
                setForm((current) => ({ ...current, bankTransferInstructions: event.target.value }))
              }
              rows={4}
              className="mt-1 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-[#667085]">
            <input
              type="checkbox"
              checked={form.bankTransferReferenceRequired}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bankTransferReferenceRequired: event.target.checked,
                }))
              }
            />
            Ask customer for UTR/reference during checkout
          </label>
          <AdminSwitch
            label="Manual payment"
            description="Shows manual-payment checkout option when enabled."
            checked={form.manualEnabled}
            onChange={(manualEnabled) => setForm((current) => ({ ...current, manualEnabled }))}
            disabled={disabled}
          />
          {codMaxOrderPaise < 0 ? (
            <p className="text-sm font-semibold text-[#D64545]">Enter a valid COD limit.</p>
          ) : null}
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <Button
          type="button"
          onClick={() => onSubmit(paymentConfigurationPayload(form))}
          disabled={disabled || codMaxOrderPaise < 0}
        >
          <KeyRound size={16} /> Save payment configuration
        </Button>
      </div>
    </div>
  );
}

function StorageConfigurationForm({
  config,
  onSubmit,
  disabled,
}: {
  config: StorageConfiguration;
  onSubmit: (payload: unknown) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<StorageConfigurationFormState>(() =>
    storageConfigurationFormState(config),
  );

  useEffect(() => {
    setForm(storageConfigurationFormState(config));
  }, [config]);

  const imageKitPrivateKeyReady = form.clearImageKitPrivateKey
    ? Boolean(form.imageKitPrivateKey.trim())
    : Boolean(config.publicImages.imageKit.privateKeyConfigured || form.imageKitPrivateKey.trim());
  const publicS3SecretReady = form.clearPublicS3SecretAccessKey
    ? Boolean(form.publicS3SecretAccessKey.trim())
    : Boolean(
        config.publicImages.s3.secretAccessKeyConfigured || form.publicS3SecretAccessKey.trim(),
      );
  const privateSecretReady = form.clearPrivateSecretAccessKey
    ? Boolean(form.privateSecretAccessKey.trim())
    : Boolean(
        config.privateStorage.secretAccessKeyConfigured || form.privateSecretAccessKey.trim(),
      );
  const imageKitComplete = Boolean(
    form.publicImageBaseUrl.trim() && form.imageKitPublicKey.trim() && imageKitPrivateKeyReady,
  );
  const publicS3Complete = Boolean(
    form.publicS3Endpoint.trim() &&
    form.publicS3Region.trim() &&
    form.publicS3Bucket.trim() &&
    form.publicS3AccessKeyId.trim() &&
    publicS3SecretReady,
  );
  const publicUploadProviderReady =
    form.publicImageProvider === "S3" ? publicS3Complete : imageKitComplete;
  const privateComplete = Boolean(
    form.privateEnabled &&
    form.privateEndpoint.trim() &&
    form.privateBucket.trim() &&
    form.privateAccessKeyId.trim() &&
    privateSecretReady,
  );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Public image uploads">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={config.publicImages.configured ? "success" : "danger"}>
              {config.publicImages.configured ? "Ready" : "Needs setup"}
            </StatusBadge>
            <StatusBadge tone="info">{form.publicImageProvider}</StatusBadge>
            {form.publicImageProvider === "S3" && config.publicImages.s3.accessKeyPreview ? (
              <StatusBadge tone="info">{config.publicImages.s3.accessKeyPreview}</StatusBadge>
            ) : null}
            {form.publicImageProvider === "IMAGEKIT" &&
            config.publicImages.imageKit.publicKeyPreview ? (
              <StatusBadge tone="info">{config.publicImages.imageKit.publicKeyPreview}</StatusBadge>
            ) : null}
          </div>
          <AdminListbox
            label="Upload provider"
            value={form.publicImageProvider}
            options={[
              { value: "IMAGEKIT", label: "ImageKit" },
              { value: "S3", label: "S3-compatible bucket" },
            ]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                publicImageProvider: value as PublicImageProvider,
              }))
            }
            buttonClassName="bg-white"
          />
          <PaymentInput
            label="Public image base URL"
            value={form.publicImageBaseUrl}
            placeholder={
              config.publicImages.baseUrl ||
              (form.publicImageProvider === "S3"
                ? "https://cdn.example.com/marketplace-images"
                : "https://ik.imagekit.io/your_imagekit_id")
            }
            onChange={(publicImageBaseUrl) =>
              setForm((current) => ({ ...current, publicImageBaseUrl }))
            }
          />

          {form.publicImageProvider === "IMAGEKIT" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <PaymentInput
                label="ImageKit public key"
                value={form.imageKitPublicKey}
                placeholder={config.publicImages.imageKit.publicKeyPreview ?? "public_xxxxx"}
                onChange={(imageKitPublicKey) =>
                  setForm((current) => ({ ...current, imageKitPublicKey }))
                }
              />
              <SecretPaymentInput
                label="ImageKit private key"
                configured={config.publicImages.imageKit.privateKeyConfigured}
                value={form.imageKitPrivateKey}
                clear={form.clearImageKitPrivateKey}
                onClear={(clearImageKitPrivateKey) =>
                  setForm((current) => ({ ...current, clearImageKitPrivateKey }))
                }
                onChange={(imageKitPrivateKey) =>
                  setForm((current) => ({ ...current, imageKitPrivateKey }))
                }
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <PaymentInput
                label="S3 endpoint"
                value={form.publicS3Endpoint}
                placeholder="https://s3.ap-south-1.amazonaws.com"
                onChange={(publicS3Endpoint) =>
                  setForm((current) => ({ ...current, publicS3Endpoint }))
                }
              />
              <PaymentInput
                label="Region"
                value={form.publicS3Region}
                placeholder="ap-south-1"
                onChange={(publicS3Region) =>
                  setForm((current) => ({ ...current, publicS3Region }))
                }
              />
              <PaymentInput
                label="Public bucket"
                value={form.publicS3Bucket}
                placeholder="indihub-public-images"
                onChange={(publicS3Bucket) =>
                  setForm((current) => ({ ...current, publicS3Bucket }))
                }
              />
              <PaymentInput
                label="Access key ID"
                value={form.publicS3AccessKeyId}
                placeholder={config.publicImages.s3.accessKeyPreview ?? "Access key ID"}
                onChange={(publicS3AccessKeyId) =>
                  setForm((current) => ({ ...current, publicS3AccessKeyId }))
                }
              />
              <SecretPaymentInput
                label="Secret access key"
                configured={config.publicImages.s3.secretAccessKeyConfigured}
                value={form.publicS3SecretAccessKey}
                clear={form.clearPublicS3SecretAccessKey}
                onClear={(clearPublicS3SecretAccessKey) =>
                  setForm((current) => ({ ...current, clearPublicS3SecretAccessKey }))
                }
                onChange={(publicS3SecretAccessKey) =>
                  setForm((current) => ({ ...current, publicS3SecretAccessKey }))
                }
              />
            </div>
          )}

          <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold leading-5 text-[#667085]">
            Image records store only the asset key. The storefront resolves that key through the
            configured delivery base URL, so changing ImageKit or S3 later means copying the files
            and updating this provider/base URL.
          </div>

          {form.publicImageProvider === "IMAGEKIT" && !imageKitComplete ? (
            <p className="text-xs font-bold text-[#D64545]">
              Base URL, ImageKit public key, and ImageKit private key are required for ImageKit
              uploads.
            </p>
          ) : null}
          {form.publicImageProvider === "S3" && !publicS3Complete ? (
            <p className="text-xs font-bold text-[#D64545]">
              Endpoint, region, bucket, access key ID, and secret access key are required for S3
              image uploads.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Private document storage">
        <div className="space-y-4">
          <AdminSwitch
            label="Enable private storage"
            description={
              config.privateStorage.configured
                ? "Private document settings are ready."
                : "Add endpoint, bucket, access key, and secret before enabling document storage."
            }
            checked={form.privateEnabled}
            onChange={(privateEnabled) => setForm((current) => ({ ...current, privateEnabled }))}
            disabled={disabled}
          />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={config.privateStorage.configured ? "success" : "danger"}>
              {config.privateStorage.configured ? "Ready" : "Needs setup"}
            </StatusBadge>
            {config.privateStorage.accessKeyPreview ? (
              <StatusBadge tone="info">{config.privateStorage.accessKeyPreview}</StatusBadge>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PaymentInput
              label="Endpoint"
              value={form.privateEndpoint}
              placeholder="https://s3.ap-south-1.amazonaws.com"
              onChange={(privateEndpoint) =>
                setForm((current) => ({ ...current, privateEndpoint }))
              }
            />
            <PaymentInput
              label="Region"
              value={form.privateRegion}
              placeholder="ap-south-1"
              onChange={(privateRegion) => setForm((current) => ({ ...current, privateRegion }))}
            />
            <PaymentInput
              label="Bucket"
              value={form.privateBucket}
              placeholder="indihub-private-documents"
              onChange={(privateBucket) => setForm((current) => ({ ...current, privateBucket }))}
            />
            <PaymentInput
              label="Access key ID"
              value={form.privateAccessKeyId}
              placeholder={config.privateStorage.accessKeyPreview ?? "Access key ID"}
              onChange={(privateAccessKeyId) =>
                setForm((current) => ({ ...current, privateAccessKeyId }))
              }
            />
            <SecretPaymentInput
              label="Secret access key"
              configured={config.privateStorage.secretAccessKeyConfigured}
              value={form.privateSecretAccessKey}
              clear={form.clearPrivateSecretAccessKey}
              onClear={(clearPrivateSecretAccessKey) =>
                setForm((current) => ({ ...current, clearPrivateSecretAccessKey }))
              }
              onChange={(privateSecretAccessKey) =>
                setForm((current) => ({ ...current, privateSecretAccessKey }))
              }
            />
          </div>
          {form.privateEnabled && !privateComplete ? (
            <p className="text-xs font-bold text-[#D64545]">
              Endpoint, bucket, access key ID, and secret access key are required when private
              storage is enabled.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <Button
          type="button"
          onClick={() => onSubmit(storageConfigurationPayload(form))}
          disabled={
            disabled || !publicUploadProviderReady || (form.privateEnabled && !privateComplete)
          }
        >
          <KeyRound size={16} /> Save storage configuration
        </Button>
      </div>
    </div>
  );
}

function storageConfigurationFormState(
  config: StorageConfiguration,
): StorageConfigurationFormState {
  return {
    imageKitPublicKey: config.publicImages.imageKit.publicKey ?? "",
    imageKitPrivateKey: "",
    clearImageKitPrivateKey: false,
    publicImageProvider: config.publicImages.provider ?? "IMAGEKIT",
    publicImageBaseUrl: config.publicImages.baseUrl ?? "",
    publicS3Endpoint: config.publicImages.s3.endpoint ?? "",
    publicS3Region: config.publicImages.s3.region ?? "",
    publicS3Bucket: config.publicImages.s3.bucket ?? "",
    publicS3AccessKeyId: config.publicImages.s3.accessKeyId ?? "",
    publicS3SecretAccessKey: "",
    clearPublicS3SecretAccessKey: false,
    privateEnabled: config.privateStorage.enabled,
    privateEndpoint: config.privateStorage.endpoint ?? "",
    privateRegion: config.privateStorage.region ?? "",
    privateBucket: config.privateStorage.bucket ?? "",
    privateAccessKeyId: config.privateStorage.accessKeyId ?? "",
    privateSecretAccessKey: "",
    clearPrivateSecretAccessKey: false,
  };
}

function storageConfigurationPayload(form: StorageConfigurationFormState) {
  return {
    publicImages: {
      provider: form.publicImageProvider,
      baseUrl: form.publicImageBaseUrl.trim(),
      imageKit: {
        publicKey: form.imageKitPublicKey.trim(),
        ...(form.imageKitPrivateKey.trim() ? { privateKey: form.imageKitPrivateKey.trim() } : {}),
        clearPrivateKey: form.clearImageKitPrivateKey,
      },
      s3: {
        endpoint: form.publicS3Endpoint.trim(),
        region: form.publicS3Region.trim(),
        bucket: form.publicS3Bucket.trim(),
        accessKeyId: form.publicS3AccessKeyId.trim(),
        ...(form.publicS3SecretAccessKey.trim()
          ? { secretAccessKey: form.publicS3SecretAccessKey.trim() }
          : {}),
        clearSecretAccessKey: form.clearPublicS3SecretAccessKey,
      },
    },
    privateStorage: {
      enabled: form.privateEnabled,
      endpoint: form.privateEndpoint.trim(),
      region: form.privateRegion.trim(),
      bucket: form.privateBucket.trim(),
      accessKeyId: form.privateAccessKeyId.trim(),
      ...(form.privateSecretAccessKey.trim()
        ? { secretAccessKey: form.privateSecretAccessKey.trim() }
        : {}),
      clearSecretAccessKey: form.clearPrivateSecretAccessKey,
    },
  };
}

function PaymentInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933]"
      />
    </label>
  );
}

function SecretPaymentInput({
  label,
  configured,
  value,
  clear,
  onChange,
  onClear,
}: {
  label: string;
  configured: boolean;
  value: string;
  clear: boolean;
  onChange: (value: string) => void;
  onClear: (value: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
        <StatusBadge tone={configured ? "success" : "warning"}>
          {configured ? "Saved" : "Missing"}
        </StatusBadge>
      </div>
      <input
        type="password"
        value={value}
        placeholder={configured ? "Leave blank to keep saved value" : "Required"}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933]"
      />
      <label className="mt-2 flex items-center gap-2 text-xs font-bold text-[#667085]">
        <input
          type="checkbox"
          checked={clear}
          onChange={(event) => onClear(event.target.checked)}
        />
        Clear saved value
      </label>
    </div>
  );
}

function paymentConfigurationFormState(
  config: PaymentConfiguration,
): PaymentConfigurationFormState {
  return {
    razorpayEnabled: config.razorpay.enabled,
    razorpayMode: config.razorpay.mode,
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
    clearRazorpayKeySecret: false,
    clearRazorpayWebhookSecret: false,
    codEnabled: config.cod.enabled,
    codInstructions: config.cod.instructions,
    codMaxOrderRupees: config.cod.maxOrderPaise ? String(config.cod.maxOrderPaise / 100) : "",
    bankTransferEnabled: config.bankTransfer.enabled,
    bankTransferAccountHolderName: config.bankTransfer.accountHolderName ?? "",
    bankTransferBankName: config.bankTransfer.bankName ?? "",
    bankTransferAccountNumber: config.bankTransfer.accountNumber ?? "",
    bankTransferIfscCode: config.bankTransfer.ifscCode ?? "",
    bankTransferBranch: config.bankTransfer.branch ?? "",
    bankTransferUpiId: config.bankTransfer.upiId ?? "",
    bankTransferInstructions: config.bankTransfer.instructions ?? "",
    bankTransferReferenceRequired: config.bankTransfer.referenceRequired ?? true,
    manualEnabled: config.manual.enabled,
  };
}

function paymentConfigurationPayload(form: PaymentConfigurationFormState) {
  return {
    razorpay: {
      enabled: form.razorpayEnabled,
      mode: form.razorpayMode,
      ...(form.razorpayKeyId.trim() ? { keyId: form.razorpayKeyId.trim() } : {}),
      ...(form.razorpayKeySecret.trim() ? { keySecret: form.razorpayKeySecret.trim() } : {}),
      ...(form.razorpayWebhookSecret.trim()
        ? { webhookSecret: form.razorpayWebhookSecret.trim() }
        : {}),
      clearKeySecret: form.clearRazorpayKeySecret,
      clearWebhookSecret: form.clearRazorpayWebhookSecret,
    },
    cod: {
      enabled: form.codEnabled,
      instructions: form.codInstructions.trim(),
      maxOrderPaise: Math.max(0, rupeesToPaise(form.codMaxOrderRupees)),
    },
    bankTransfer: {
      enabled: form.bankTransferEnabled,
      accountHolderName: form.bankTransferAccountHolderName.trim(),
      bankName: form.bankTransferBankName.trim(),
      accountNumber: form.bankTransferAccountNumber.trim(),
      ifscCode: form.bankTransferIfscCode.trim(),
      branch: form.bankTransferBranch.trim(),
      upiId: form.bankTransferUpiId.trim(),
      instructions: form.bankTransferInstructions.trim(),
      referenceRequired: form.bankTransferReferenceRequired,
    },
    manual: {
      enabled: form.manualEnabled,
    },
  };
}

function rupeesToPaise(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) {
    return -1;
  }

  return Math.round(amount * 100);
}

function CmsList({
  title,
  description,
  items,
  isLoading,
  removeLabel,
  removeIcon,
  disabled,
  onEdit,
  onStatus,
  onRemove,
}: {
  title: string;
  description: string;
  items: Array<CmsPageRecord | BannerRecord | HomepageSectionRecord>;
  isLoading?: boolean;
  removeLabel?: string;
  removeIcon?: ReactNode;
  disabled?: boolean;
  onEdit?: (item: CmsPageRecord | BannerRecord | HomepageSectionRecord) => void;
  onStatus?: (item: CmsPageRecord | BannerRecord | HomepageSectionRecord, status: string) => void;
  onRemove?: (item: CmsPageRecord | BannerRecord | HomepageSectionRecord) => void;
}) {
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{description}</p>
        </div>
        <StatusBadge tone="info">{items.length.toLocaleString("en-IN")} records</StatusBadge>
      </div>
      <div className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                {contentRecordIcon(item)}
              </span>
              <div className="min-w-0">
                <EntityTitle title={item.title} subtitle={contentRecordSubtitle(item)} />
                <SmallStack lines={contentRecordDetails(item)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              <AdminActionMenu
                label="Content actions"
                items={[
                  {
                    label: "Edit content",
                    description: "Open this record in the edit panel.",
                    icon: <Settings className="h-4 w-4 text-[#163B5C]" />,
                    disabled: disabled || !onEdit,
                    onSelect: () => onEdit?.(item),
                  },
                  {
                    label: "Publish",
                    description: "Make this content visible where the storefront uses it.",
                    icon: <CheckCircle2 className="h-4 w-4 text-[#0F8A5F]" />,
                    disabled: disabled || item.status === "PUBLISHED" || !onStatus,
                    onSelect: () => onStatus?.(item, "PUBLISHED"),
                  },
                  {
                    label: "Move to draft",
                    description: "Keep this record in admin without publishing it.",
                    icon: <Archive className="h-4 w-4 text-[#667085]" />,
                    disabled: disabled || item.status === "DRAFT" || !onStatus,
                    onSelect: () => onStatus?.(item, "DRAFT"),
                  },
                  {
                    label: removeLabel ?? "Remove",
                    description: "Remove this content record from the active management list.",
                    icon: removeIcon,
                    disabled: disabled || !onRemove,
                    destructive: true,
                    onSelect: () => onRemove?.(item),
                  },
                ]}
              />
            </div>
          </div>
        ))}
        {isLoading ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">Loading content records...</p>
        ) : null}
        {!isLoading && !items.length ? (
          <p className="py-6 text-sm font-semibold text-[#667085]">No records found.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function ContentEditPanel({
  request,
  authHeaders,
  sectionDataSources,
  disabled,
  onCancel,
  onSavePage,
  onSaveBanner,
  onSaveSection,
}: {
  request: ContentEditRequest;
  authHeaders: IndihubAuthHeaders;
  sectionDataSources: HomepageSectionDataSources;
  disabled?: boolean | undefined;
  onCancel: () => void;
  onSavePage: (
    pageId: string,
    payload: Partial<{ title: string; slug: string; content: string; status: string }>,
  ) => void;
  onSaveBanner: (
    bannerId: string,
    payload: Partial<{
      title: string;
      subtitle: string;
      imageUrl: string;
      linkUrl: string;
      status: string;
      sortOrder: number;
    }>,
  ) => void;
  onSaveSection: (
    sectionId: string,
    payload: Partial<{
      sectionType: string;
      title: string;
      config: Record<string, unknown>;
      status: string;
      sortOrder: number;
    }>,
  ) => void;
}) {
  if (request.kind === "page") {
    return (
      <CmsPageEditForm
        key={`page-${request.item.id}`}
        page={request.item}
        disabled={disabled}
        onCancel={onCancel}
        onSubmit={(payload) => onSavePage(request.item.id, payload)}
      />
    );
  }

  if (request.kind === "banner") {
    return (
      <BannerEditForm
        key={`banner-${request.item.id}`}
        banner={request.item}
        authHeaders={authHeaders}
        disabled={disabled}
        onCancel={onCancel}
        onSubmit={(payload) => onSaveBanner(request.item.id, payload)}
      />
    );
  }

  return (
    <HomepageSectionEditForm
      key={`section-${request.item.id}`}
      section={request.item}
      dataSources={sectionDataSources}
      disabled={disabled}
      onCancel={onCancel}
      onSubmit={(payload) => onSaveSection(request.item.id, payload)}
    />
  );
}

function CmsPageEditForm({
  page,
  onSubmit,
  onCancel,
  disabled,
}: {
  page: CmsPageRecord;
  onSubmit: (
    payload: Partial<{ title: string; slug: string; content: string; status: string }>,
  ) => void;
  onCancel: () => void;
  disabled?: boolean | undefined;
}) {
  const [form, setForm] = useState({
    title: page.title,
    slug: page.slug,
    content: page.content ?? "",
    status: page.status,
  });

  return (
    <Panel title={`Edit CMS page: ${page.title}`}>
      <div className="space-y-3">
        <div className="grid gap-3 2xl:grid-cols-2">
          <TextInput
            label="Title"
            value={form.title}
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
          <TextInput
            label="Slug"
            value={form.slug}
            onChange={(slug) => setForm((current) => ({ ...current, slug }))}
          />
        </div>
        <LabeledSelect
          label="Status"
          value={form.status}
          values={contentWorkflowStatusValues}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Page content
          </span>
          <textarea
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({ ...current, content: event.target.value }))
            }
            className="mt-1 min-h-44 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
          />
        </label>
        <FormActionRow
          submitLabel="Save page"
          onCancel={onCancel}
          onSubmit={() => onSubmit(form)}
          disabled={
            disabled ||
            form.title.trim().length < 2 ||
            form.slug.trim().length < 2 ||
            form.content.trim().length < 10
          }
        />
      </div>
    </Panel>
  );
}

function BannerEditForm({
  banner,
  authHeaders,
  onSubmit,
  onCancel,
  disabled,
}: {
  banner: BannerRecord;
  authHeaders: IndihubAuthHeaders;
  onSubmit: (
    payload: Partial<{
      title: string;
      subtitle: string;
      imageUrl: string;
      linkUrl: string;
      eyebrow: string;
      ctaLabel: string;
      secondaryCtaLabel: string;
      secondaryLinkUrl: string;
      mobileImageUrl: string;
      imageAlt: string;
      textPosition: string;
      startsAt: string;
      endsAt: string;
      status: string;
      sortOrder: number;
    }>,
  ) => void;
  onCancel: () => void;
  disabled?: boolean | undefined;
}) {
  const [form, setForm] = useState<BannerCreateFormState>({
    title: banner.title,
    subtitle: banner.subtitle ?? "",
    imageUrl: banner.imageUrl ?? "",
    linkUrl: banner.linkUrl ?? "",
    eyebrow: banner.eyebrow ?? "",
    ctaLabel: banner.ctaLabel ?? "",
    secondaryCtaLabel: banner.secondaryCtaLabel ?? "",
    secondaryLinkUrl: banner.secondaryLinkUrl ?? "",
    mobileImageUrl: banner.mobileImageUrl ?? "",
    imageAlt: banner.imageAlt ?? "",
    textPosition: banner.textPosition ?? "LEFT",
    startsAt: isoToDateTimeLocal(banner.startsAt),
    endsAt: isoToDateTimeLocal(banner.endsAt),
    status: banner.status,
    sortOrder: String(banner.sortOrder ?? 0),
  });

  return (
    <Panel title={`Edit homepage banner: ${banner.title}`}>
      <div className="space-y-3">
        <BannerFormFields
          form={form}
          setForm={setForm}
          authHeaders={authHeaders}
          disabled={disabled}
        />
        <FormActionRow
          submitLabel="Save banner"
          onCancel={onCancel}
          onSubmit={() => onSubmit(bannerPayload(form))}
          disabled={disabled || form.title.trim().length < 2}
        />
      </div>
    </Panel>
  );
}

function BannerFormFields({
  form,
  setForm,
  authHeaders,
  disabled,
}: {
  form: BannerCreateFormState;
  setForm: Dispatch<SetStateAction<BannerCreateFormState>>;
  authHeaders: IndihubAuthHeaders;
  disabled?: boolean | undefined;
}) {
  const lifecycle = bannerLifecycle(form);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D8E2EA] bg-[#F8FAFC] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#1F2933]">Live hero preview</p>
          <StatusBadge tone={lifecycle.tone}>{lifecycle.label}</StatusBadge>
        </div>
        <BannerHeroPreview form={form} />
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 2xl:grid-cols-2">
          <TextInput
            label="Small label"
            value={form.eyebrow}
            onChange={(eyebrow) => setForm((current) => ({ ...current, eyebrow }))}
          />
          <TextInput
            label="Headline"
            value={form.title}
            onChange={(title) => setForm((current) => ({ ...current, title }))}
          />
        </div>
        <TextInput
          label="Subtitle"
          value={form.subtitle}
          onChange={(subtitle) => setForm((current) => ({ ...current, subtitle }))}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Primary CTA text"
            value={form.ctaLabel}
            onChange={(ctaLabel) => setForm((current) => ({ ...current, ctaLabel }))}
          />
          <TextInput
            label="Primary CTA link"
            value={form.linkUrl}
            onChange={(linkUrl) => setForm((current) => ({ ...current, linkUrl }))}
          />
          <TextInput
            label="Secondary CTA text"
            value={form.secondaryCtaLabel}
            onChange={(secondaryCtaLabel) =>
              setForm((current) => ({ ...current, secondaryCtaLabel }))
            }
          />
          <TextInput
            label="Secondary CTA link"
            value={form.secondaryLinkUrl}
            onChange={(secondaryLinkUrl) =>
              setForm((current) => ({ ...current, secondaryLinkUrl }))
            }
          />
        </div>
        <SellerImageUpload
          label="Desktop hero image"
          description="Upload a wide hero image for desktop and tablet."
          value={form.imageUrl || null}
          onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl: imageUrl ?? "" }))}
          authHeaders={authHeaders}
          purpose="ADMIN_BANNER"
          previewLabel="Desktop banner"
          aspectClass="aspect-[16/9]"
          allowExternalRemote
          disabled={disabled ?? false}
          layout="stacked"
        />
        <SellerImageUpload
          label="Mobile hero image"
          description="Optional portrait crop for phones. Desktop image is used when empty."
          value={form.mobileImageUrl || null}
          onChange={(mobileImageUrl) =>
            setForm((current) => ({ ...current, mobileImageUrl: mobileImageUrl ?? "" }))
          }
          authHeaders={authHeaders}
          purpose="ADMIN_BANNER"
          previewLabel="Mobile banner"
          aspectClass="aspect-[4/5]"
          allowExternalRemote
          disabled={disabled ?? false}
          layout="stacked"
        />
        <div className="grid gap-3 2xl:grid-cols-2">
          <TextInput
            label="Desktop image URL"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))}
          />
          <TextInput
            label="Mobile image URL"
            value={form.mobileImageUrl}
            onChange={(mobileImageUrl) => setForm((current) => ({ ...current, mobileImageUrl }))}
          />
        </div>
        <TextInput
          label="Image alt text"
          value={form.imageAlt}
          onChange={(imageAlt) => setForm((current) => ({ ...current, imageAlt }))}
        />
        <div className="grid gap-3 2xl:grid-cols-3">
          <LabeledSelect
            label="Text position"
            value={form.textPosition}
            values={[...bannerTextPositionValues]}
            onChange={(textPosition) => setForm((current) => ({ ...current, textPosition }))}
          />
          <LabeledSelect
            label="Status"
            value={form.status}
            values={contentWorkflowStatusValues}
            onChange={(status) => setForm((current) => ({ ...current, status }))}
          />
          <TextInput
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
          />
        </div>
        <div className="grid gap-3 2xl:grid-cols-2">
          <TextInput
            label="Start date"
            type="datetime-local"
            value={form.startsAt}
            onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))}
          />
          <TextInput
            label="End date"
            type="datetime-local"
            value={form.endsAt}
            onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))}
          />
        </div>
      </div>
      <SmallStack
        lines={[
          "Desktop image: 16:9 wide crop recommended",
          "Mobile image: optional 4:5 portrait crop",
          "Use short headlines and one clear CTA",
        ]}
      />
    </div>
  );
}

function BannerHeroPreview({ form }: { form: BannerCreateFormState }) {
  const imageUrl = form.imageUrl || form.mobileImageUrl;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#D8E2EA] bg-[#163B5C] text-white">
      <div className="relative min-h-64">
        {imageUrl ? (
          <img
            src={resolveImageSource(imageUrl) ?? ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,34,56,0.92),rgba(12,34,56,0.58))]" />
        <div className="relative flex min-h-64 flex-col justify-end p-5">
          <span className="w-fit rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white">
            {form.eyebrow || "Featured now"}
          </span>
          <p className="mt-3 text-3xl font-black leading-tight">
            {form.title || "Shop trusted local sellers near you"}
          </p>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white/78">
            {form.subtitle || "A premium marketplace hero controlled from the admin panel."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#ED3500] px-4 py-2 text-xs font-black text-white">
              {form.ctaLabel || "Explore now"}
            </span>
            {form.secondaryCtaLabel ? (
              <span className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-black text-white">
                {form.secondaryCtaLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomepageSectionEditForm({
  section,
  dataSources,
  onSubmit,
  onCancel,
  disabled,
}: {
  section: HomepageSectionRecord;
  dataSources: HomepageSectionDataSources;
  onSubmit: (
    payload: Partial<{
      sectionType: string;
      title: string;
      config: Record<string, unknown>;
      status: string;
      sortOrder: number;
    }>,
  ) => void;
  onCancel: () => void;
  disabled?: boolean | undefined;
}) {
  const [form, setForm] = useState<HomepageSectionCreateFormState>(() =>
    homepageSectionFormState(section),
  );

  return (
    <Panel title={`Edit homepage section: ${section.title}`}>
      <div className="space-y-4">
        <HomepageSectionFields form={form} setForm={setForm} dataSources={dataSources} />
        <FormActionRow
          submitLabel="Save section"
          onCancel={onCancel}
          onSubmit={() => onSubmit(homepageSectionPayload(form))}
          disabled={disabled || form.sectionType.trim().length < 2 || form.title.trim().length < 2}
        />
      </div>
    </Panel>
  );
}

function CmsPageCreateForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (payload: { title: string; slug: string; content: string; status: string }) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState({ title: "", slug: "", content: "", status: "DRAFT" });
  return (
    <Panel title="Create CMS page">
      <div className="space-y-3">
        {cmsPageTextFields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              {label}
            </span>
            <input
              value={form[key as keyof typeof form]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933]"
            />
          </label>
        ))}
        <LabeledSelect
          label="Status"
          value={form.status}
          values={contentWorkflowStatusValues}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <textarea
          value={form.content}
          onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
          placeholder="Page content"
          className="min-h-36 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
        />
        <Button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={disabled || form.title.trim().length < 2 || form.content.trim().length < 10}
        >
          Create page
        </Button>
      </div>
    </Panel>
  );
}

function BannerCreateForm({
  authHeaders,
  nextSortOrder,
  onSubmit,
  disabled,
}: {
  authHeaders: IndihubAuthHeaders;
  nextSortOrder: number;
  onSubmit: (payload: {
    title: string;
    subtitle?: string | undefined;
    imageUrl?: string | undefined;
    linkUrl?: string | undefined;
    eyebrow?: string | undefined;
    ctaLabel?: string | undefined;
    secondaryCtaLabel?: string | undefined;
    secondaryLinkUrl?: string | undefined;
    mobileImageUrl?: string | undefined;
    imageAlt?: string | undefined;
    textPosition?: string | undefined;
    startsAt?: string | undefined;
    endsAt?: string | undefined;
    status: string;
    sortOrder: number;
  }) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<BannerCreateFormState>({
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    eyebrow: "",
    ctaLabel: "Explore now",
    secondaryCtaLabel: "",
    secondaryLinkUrl: "",
    mobileImageUrl: "",
    imageAlt: "",
    textPosition: "LEFT",
    startsAt: "",
    endsAt: "",
    status: "PUBLISHED",
    sortOrder: String(nextSortOrder),
  });

  return (
    <Panel title="Create homepage hero banner">
      <div className="space-y-3">
        <BannerFormFields
          form={form}
          setForm={setForm}
          authHeaders={authHeaders}
          disabled={disabled}
        />
        <Button
          type="button"
          onClick={() => onSubmit(bannerPayload(form))}
          disabled={disabled || form.title.trim().length < 2}
        >
          Create banner
        </Button>
      </div>
    </Panel>
  );
}

function HomepageSectionCreateForm({
  dataSources,
  onSubmit,
  disabled,
}: {
  dataSources: HomepageSectionDataSources;
  onSubmit: (payload: {
    sectionType: string;
    title: string;
    config: Record<string, unknown>;
    status: string;
    sortOrder: number;
  }) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<HomepageSectionCreateFormState>(() =>
    homepageSectionFormState(),
  );

  return (
    <Panel title="Create homepage section">
      <div className="space-y-4">
        <HomepageSectionFields form={form} setForm={setForm} dataSources={dataSources} />
        <Button
          type="button"
          onClick={() => onSubmit(homepageSectionPayload(form))}
          disabled={disabled || form.sectionType.trim().length < 2 || form.title.trim().length < 2}
        >
          Create section
        </Button>
      </div>
    </Panel>
  );
}

function HomepageSectionFields({
  form,
  setForm,
  dataSources = emptyHomepageSectionDataSources,
}: {
  form: HomepageSectionCreateFormState;
  setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>;
  dataSources?: HomepageSectionDataSources;
}) {
  const typeOptions = useMemo(
    () => homepageSectionTypeOptionsForValue(form.sectionType),
    [form.sectionType],
  );
  const selectedType = typeOptions.find((option) => option.value === form.sectionType);
  const dynamicOptions = useMemo(
    () => homepageSectionDynamicOptions(form.sectionType, dataSources),
    [dataSources, form.sectionType],
  );
  const dynamicSourceLabel = homepageSectionDynamicSourceLabel(form.sectionType);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <AdminListbox
          label="Section type"
          value={form.sectionType}
          options={typeOptions}
          onChange={(sectionType) =>
            setForm((current) => ({
              ...current,
              sectionType,
              ctaLabel:
                sectionType === "deal_strip" && !current.ctaLabel.trim()
                  ? "View all deals"
                  : current.ctaLabel,
              ctaUrl:
                sectionType === "deal_strip" && !current.ctaUrl.trim()
                  ? "/deals"
                  : current.ctaUrl,
            }))
          }
          buttonClassName="bg-white"
        />
        <TextInput
          label="Title"
          value={form.title}
          onChange={(title) => setForm((current) => ({ ...current, title }))}
        />
      </div>
      {selectedType?.description ? (
        <p className="text-xs font-semibold leading-5 text-[#667085]">{selectedType.description}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label="Small label"
          value={form.eyebrow}
          onChange={(eyebrow) => setForm((current) => ({ ...current, eyebrow }))}
        />
        <TextInput
          label="Button text"
          value={form.ctaLabel}
          onChange={(ctaLabel) => setForm((current) => ({ ...current, ctaLabel }))}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextAreaInput
          label="Short description"
          value={form.subtitle}
          onChange={(subtitle) => setForm((current) => ({ ...current, subtitle }))}
        />
        <TextInput
          label="Button link"
          value={form.ctaUrl}
          onChange={(ctaUrl) => setForm((current) => ({ ...current, ctaUrl }))}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label="Start date"
          type="datetime-local"
          value={form.startsAt}
          onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))}
        />
        <TextInput
          label="End date"
          type="datetime-local"
          value={form.endsAt}
          onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))}
        />
      </div>
      {form.sectionType === "deal_strip" ? (
        <p className="rounded-md bg-[#FFF7E6] px-3 py-2 text-xs font-semibold text-[#B54708]">
          For Flash Sale, selected products are shown first. If no products are selected, active discounted products are used until the end date.
        </p>
      ) : null}

      <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-[#1F2933]">
              {dynamicSourceLabel ? `Available ${dynamicSourceLabel}` : "Section items"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#667085]">
              {dynamicSourceLabel
                ? `Pick from existing ${dynamicSourceLabel}; the item details are filled automatically.`
                : "Add campaign, service, or trust-point rows without writing JSON."}
            </p>
          </div>
          {dynamicOptions.length ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addAllHomepageDynamicOptions(setForm, dynamicOptions)}
            >
              <Plus className="h-4 w-4" /> Add all
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addHomepageSectionItem(setForm)}
            >
              <Plus className="h-4 w-4" /> Add item
            </Button>
          )}
        </div>

        {dynamicSourceLabel ? (
          <div className="mt-4 rounded-md border border-[#E5E7EB] bg-white p-3">
            {dataSources.isLoading ? (
              <p className="text-sm font-semibold text-[#667085]">
                Loading available {dynamicSourceLabel}...
              </p>
            ) : dynamicOptions.length ? (
              <div className="grid gap-2">
                {dynamicOptions.map((option) => {
                  const selected = homepageSectionOptionSelected(form.items, option);
                  return (
                    <div
                      key={`${option.sourceType}-${option.sourceId}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#1F2933]">{option.label}</p>
                        <p className="mt-0.5 text-xs font-semibold text-[#667085]">
                          {option.description || option.linkUrl}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {option.badge ? (
                          <StatusBadge tone="info">{option.badge}</StatusBadge>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addHomepageDynamicOption(setForm, option)}
                          disabled={selected}
                        >
                          {selected ? "Added" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#667085]">
                No available {dynamicSourceLabel} found for this section type.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {form.items.length ? (
            form.items.map((item, index) => (
              <div key={index} className="rounded-md border border-[#E5E7EB] bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                    Item {index + 1}
                    {item.sourceType ? (
                      <StatusBadge tone="success">{humanize(item.sourceType)}</StatusBadge>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeHomepageSectionItem(setForm, index)}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Item name"
                    value={item.label}
                    onChange={(label) => updateHomepageSectionItem(setForm, index, { label })}
                  />
                  <TextInput
                    label="Badge"
                    value={item.badge}
                    onChange={(badge) => updateHomepageSectionItem(setForm, index, { badge })}
                  />
                  <TextInput
                    label="Link"
                    value={item.linkUrl}
                    onChange={(linkUrl) => updateHomepageSectionItem(setForm, index, { linkUrl })}
                  />
                  <TextInput
                    label="Image URL"
                    value={item.imageUrl}
                    onChange={(imageUrl) => updateHomepageSectionItem(setForm, index, { imageUrl })}
                  />
                </div>
                <div className="mt-3">
                  <TextAreaInput
                    label="Item description"
                    value={item.description}
                    onChange={(description) =>
                      updateHomepageSectionItem(setForm, index, { description })
                    }
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-[#D8E2EA] bg-white p-4 text-sm font-semibold text-[#667085]">
              No item rows added.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          label="Status"
          value={form.status}
          values={contentWorkflowStatusValues}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <TextInput
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
        />
      </div>
    </>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
      />
    </label>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-20 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
      />
    </label>
  );
}

function FormActionRow({
  submitLabel,
  onSubmit,
  onCancel,
  disabled,
}: {
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" onClick={onSubmit} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}

function homepageSectionFormState(section?: HomepageSectionRecord): HomepageSectionCreateFormState {
  const config = section?.config ?? {};
  const items = homepageSectionItemsFromConfig(config);

  return {
    sectionType: section?.sectionType ?? "featured_categories",
    title: section?.title ?? "",
    eyebrow: stringConfigValue(config.eyebrow),
    subtitle: stringConfigValue(config.subtitle) || stringConfigValue(config.description),
    ctaLabel: stringConfigValue(config.ctaLabel),
    ctaUrl: stringConfigValue(config.ctaUrl) || stringConfigValue(config.ctaHref),
    startsAt: isoToDateTimeLocal(stringConfigValue(config.startsAt)),
    endsAt: isoToDateTimeLocal(
      stringConfigValue(config.endsAt) || stringConfigValue(config.timerEndsAt),
    ),
    items,
    status: section?.status ?? "PUBLISHED",
    sortOrder: String(section?.sortOrder ?? 0),
    extraConfig: extraHomepageSectionConfig(config),
  };
}

function homepageSectionPayload(form: HomepageSectionCreateFormState) {
  return {
    sectionType: form.sectionType,
    title: form.title,
    config: homepageSectionConfig(form),
    status: form.status,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function homepageSectionConfig(form: HomepageSectionCreateFormState) {
  const config: Record<string, unknown> = { ...form.extraConfig };
  const items = form.items.filter(hasHomepageSectionItemContent).map((item) =>
    emptyStringsToUndefined({
      sourceType: item.sourceType.trim(),
      sourceId: item.sourceId.trim(),
      slug: item.slug.trim(),
      label: item.label.trim(),
      description: item.description.trim(),
      imageUrl: item.imageUrl.trim(),
      linkUrl: item.linkUrl.trim(),
      badge: item.badge.trim(),
    }),
  );

  assignOptionalConfigString(config, "eyebrow", form.eyebrow);
  assignOptionalConfigString(config, "subtitle", form.subtitle);
  assignOptionalConfigString(config, "ctaLabel", form.ctaLabel);
  assignOptionalConfigString(config, "ctaUrl", form.ctaUrl);
  assignOptionalConfigString(config, "startsAt", dateTimeLocalToIso(form.startsAt));
  assignOptionalConfigString(config, "endsAt", dateTimeLocalToIso(form.endsAt));

  if (form.sectionType === "deal_strip") {
    assignOptionalConfigString(config, "timerEndsAt", dateTimeLocalToIso(form.endsAt));
  } else {
    delete config.timerEndsAt;
  }

  if (items.length) {
    config.items = items;
  } else {
    delete config.items;
  }

  return config;
}

function homepageSectionTypeOptionsForValue(value: string) {
  if (!value || homepageSectionTypeOptions.some((option) => option.value === value)) {
    return homepageSectionTypeOptions;
  }

  return [
    ...homepageSectionTypeOptions,
    {
      value,
      label: humanize(value),
      description: "Existing custom section type.",
    },
  ];
}

function homepageSectionDynamicSourceLabel(sectionType: string) {
  if (sectionType === "featured_categories") {
    return "categories";
  }

  if (sectionType === "featured_products" || sectionType === "deal_strip") {
    return "products";
  }

  if (sectionType === "featured_stores") {
    return "stores";
  }

  return "";
}

function homepageSectionDynamicOptions(
  sectionType: string,
  dataSources: HomepageSectionDataSources,
): HomepageSectionDynamicOption[] {
  if (sectionType === "featured_categories") {
    return dataSources.categories.map((category) => ({
      sourceType: "category",
      sourceId: category.id,
      slug: category.slug,
      label: category.name,
      description: category.description || `${category._count?.products ?? 0} live products`,
      imageUrl: category.imageUrl ?? "",
      linkUrl: `/categories/${category.slug}`,
      badge: `${category._count?.products ?? 0} products`,
    }));
  }

  if (sectionType === "featured_products" || sectionType === "deal_strip") {
    return dataSources.products.map((product) => {
      const firstVariant = product.variants?.[0];
      const imageUrl =
        product.images?.find((image) => image.isPrimary)?.url ?? product.images?.[0]?.url ?? "";

      return {
        sourceType: "product",
        sourceId: product.id,
        slug: product.slug,
        label: product.name,
        description: [product.category?.name, product.seller?.storeName]
          .filter(Boolean)
          .join(" / "),
        imageUrl,
        linkUrl: `/products/${product.slug}`,
        badge: firstVariant ? formatPaise(firstVariant.pricePaise) : humanize(product.status),
      };
    });
  }

  if (sectionType === "featured_stores") {
    return dataSources.sellers.map((seller) => ({
      sourceType: "seller",
      sourceId: seller.id,
      slug: seller.slug,
      label: seller.storeName,
      description:
        seller.profile?.contactName || `${seller._count?.products ?? 0} approved products`,
      imageUrl: seller.profile?.logoUrl ?? "",
      linkUrl: `/stores/${seller.slug}`,
      badge: seller.sellerType ? humanize(seller.sellerType) : "Store",
    }));
  }

  return [];
}

function homepageSectionItemsFromConfig(config: Record<string, unknown>) {
  if (!Array.isArray(config.items)) {
    return [];
  }

  return config.items
    .map((item): HomepageSectionItemFormState | null => {
      if (typeof item === "string") {
        return { ...createBlankHomepageSectionItem(), label: item };
      }

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      return {
        sourceType: stringConfigValue(record.sourceType),
        sourceId: stringConfigValue(record.sourceId),
        slug: stringConfigValue(record.slug),
        label:
          stringConfigValue(record.label) ||
          stringConfigValue(record.title) ||
          stringConfigValue(record.name),
        description: stringConfigValue(record.description) || stringConfigValue(record.subtitle),
        imageUrl: stringConfigValue(record.imageUrl) || stringConfigValue(record.image),
        linkUrl:
          stringConfigValue(record.linkUrl) ||
          stringConfigValue(record.href) ||
          stringConfigValue(record.url),
        badge: stringConfigValue(record.badge),
      };
    })
    .filter((item): item is HomepageSectionItemFormState => Boolean(item));
}

function extraHomepageSectionConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !homepageSectionKnownConfigKeys.has(key)),
  );
}

function createBlankHomepageSectionItem(): HomepageSectionItemFormState {
  return {
    label: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    badge: "",
    sourceType: "",
    sourceId: "",
    slug: "",
  };
}

function addHomepageSectionItem(setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>) {
  setForm((current) => ({
    ...current,
    items: [...current.items, createBlankHomepageSectionItem()],
  }));
}

function addHomepageDynamicOption(
  setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>,
  option: HomepageSectionDynamicOption,
) {
  setForm((current) => {
    if (homepageSectionOptionSelected(current.items, option)) {
      return current;
    }

    return { ...current, items: [...current.items, homepageSectionItemFromOption(option)] };
  });
}

function addAllHomepageDynamicOptions(
  setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>,
  options: HomepageSectionDynamicOption[],
) {
  setForm((current) => {
    const nextItems = [...current.items];
    options.forEach((option) => {
      if (!homepageSectionOptionSelected(nextItems, option)) {
        nextItems.push(homepageSectionItemFromOption(option));
      }
    });

    return { ...current, items: nextItems };
  });
}

function removeHomepageSectionItem(
  setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>,
  index: number,
) {
  setForm((current) => ({
    ...current,
    items: current.items.filter((_, itemIndex) => itemIndex !== index),
  }));
}

function updateHomepageSectionItem(
  setForm: Dispatch<SetStateAction<HomepageSectionCreateFormState>>,
  index: number,
  patch: Partial<HomepageSectionItemFormState>,
) {
  setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  }));
}

function hasHomepageSectionItemContent(item: HomepageSectionItemFormState) {
  return Object.values(item).some((value) => value.trim().length > 0);
}

function homepageSectionItemFromOption(
  option: HomepageSectionDynamicOption,
): HomepageSectionItemFormState {
  return {
    label: option.label,
    description: option.description,
    imageUrl: option.imageUrl,
    linkUrl: option.linkUrl,
    badge: option.badge,
    sourceType: option.sourceType,
    sourceId: option.sourceId,
    slug: option.slug,
  };
}

function homepageSectionOptionSelected(
  items: HomepageSectionItemFormState[],
  option: HomepageSectionDynamicOption,
) {
  return items.some((item) => {
    if (item.sourceType && item.sourceId) {
      return item.sourceType === option.sourceType && item.sourceId === option.sourceId;
    }

    return Boolean(item.linkUrl && item.linkUrl === option.linkUrl);
  });
}

function assignOptionalConfigString(config: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    config[key] = trimmed;
    return;
  }

  delete config[key];
}

function stringConfigValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

type ProductTemplatePayload = {
  name: string;
  code: string;
  description?: string | undefined;
  status: string;
  listingMode: ProductListingMode;
  sortOrder: number;
  fields: Array<{
    label: string;
    fieldKey: string;
    fieldType: ProductTemplateFieldType;
    scope: ProductTemplateFieldScope;
    isRequired: boolean;
    options?: string[] | undefined;
    placeholder?: string | undefined;
    helpText?: string | undefined;
    isFilterable: boolean;
    isSearchable: boolean;
    sortOrder: number;
  }>;
};

type ProductTemplateFormField = {
  id: string;
  label: string;
  fieldKey: string;
  fieldType: ProductTemplateFieldType;
  scope: ProductTemplateFieldScope;
  isRequired: boolean;
  optionsText: string;
  placeholder: string;
  helpText: string;
  isFilterable: boolean;
  isSearchable: boolean;
  sortOrder: string;
};

function ProductTemplatesPanel({
  templates,
  isLoading,
  onCreate,
  onUpdate,
  onArchive,
  disabled,
}: {
  templates: ProductTemplateRecord[];
  isLoading: boolean;
  onCreate: (payload: ProductTemplatePayload) => void;
  onUpdate: (templateId: string, payload: ProductTemplatePayload) => void;
  onArchive: (template: ProductTemplateRecord) => void;
  disabled?: boolean;
}) {
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplateRecord | null>(null);

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_520px]">
      <AdminTable
        items={templates}
        isLoading={isLoading}
        emptyTitle="No product templates found"
        columns={[
          {
            header: "Template",
            cell: (item) => (
              <EntityTitle
                title={item.name}
                subtitle={`${item.code} - ${item.fields?.length ?? 0} dynamic fields`}
              />
            ),
          },
          {
            header: "Mode",
            cell: (item) => (
              <SmallStack
                lines={[
                  humanize(item.listingMode),
                  `${item._count?.categories ?? 0} categories`,
                  `Sort ${item.sortOrder}`,
                ]}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Action",
            cell: (item) => (
              <AdminActionMenu
                label="Template actions"
                items={[
                  {
                    label: "Edit template",
                    description: "Update template fields used by seller product forms.",
                    icon: <Settings className="h-4 w-4 text-[#163B5C]" />,
                    onSelect: () => setEditingTemplate(item),
                    disabled,
                  },
                  {
                    label: "Archive template",
                    description:
                      (item._count?.categories ?? 0) > 0
                        ? "Reassign categories before archiving."
                        : "Remove this template from future category use.",
                    icon: <Archive className="h-4 w-4 text-[#B42318]" />,
                    onSelect: () => onArchive(item),
                    disabled: disabled || (item._count?.categories ?? 0) > 0,
                    destructive: true,
                  },
                ]}
              />
            ),
          },
        ]}
      />
      <ProductTemplateForm
        key={editingTemplate?.id ?? "new-template"}
        template={editingTemplate}
        onCancel={() => setEditingTemplate(null)}
        onSubmit={(payload) => {
          if (editingTemplate) {
            onUpdate(editingTemplate.id, payload);
            setEditingTemplate(null);
            return;
          }
          onCreate(payload);
        }}
        disabled={Boolean(disabled)}
      />
    </div>
  );
}

function ProductTemplateForm({
  template,
  onSubmit,
  onCancel,
  disabled,
}: {
  template?: ProductTemplateRecord | null;
  onSubmit: (payload: ProductTemplatePayload) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState(() => productTemplateFormState(template ?? undefined));

  function updateField(id: string, patch: Partial<ProductTemplateFormField>) {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    }));
  }

  function addField(scope: ProductTemplateFieldScope) {
    setForm((current) => ({
      ...current,
      fields: [...current.fields, emptyProductTemplateField(scope, current.fields.length * 10)],
    }));
  }

  function removeField(id: string) {
    setForm((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.id !== id),
    }));
  }

  return (
    <Panel title={template ? `Edit template: ${template.name}` : "Create product template"}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(name) => setForm((current) => ({ ...current, name }))}
          />
          <TextInput
            label="Code"
            value={form.code}
            onChange={(code) =>
              setForm((current) => ({ ...current, code: normalizeTemplateCodeInput(code) }))
            }
          />
          <LabeledSelect
            label="Status"
            value={form.status}
            values={productTemplateStatusValues}
            onChange={(status) => setForm((current) => ({ ...current, status }))}
          />
          <LabeledSelect
            label="Listing mode"
            value={form.listingMode}
            values={productListingModeValues}
            onChange={(listingMode) =>
              setForm((current) => ({ ...current, listingMode: listingMode as ProductListingMode }))
            }
          />
          <TextInput
            label="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
          />
        </div>
        <TextAreaInput
          label="Description"
          value={form.description}
          onChange={(description) => setForm((current) => ({ ...current, description }))}
        />

        <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#1F2933]">Dynamic fields</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">
                Product fields appear once. Variant fields repeat for each seller variant.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addField("PRODUCT")}>
                <Plus className="h-4 w-4" /> Product field
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addField("VARIANT")}>
                <Plus className="h-4 w-4" /> Variant field
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {form.fields.map((field) => (
              <div key={field.id} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    label="Label"
                    value={field.label}
                    onChange={(label) =>
                      updateField(field.id, {
                        label,
                        fieldKey: field.fieldKey || fieldKeyFromLabel(label),
                      })
                    }
                  />
                  <TextInput
                    label="Field key"
                    value={field.fieldKey}
                    onChange={(fieldKey) =>
                      updateField(field.id, { fieldKey: fieldKey.replace(/[^A-Za-z0-9_]/g, "") })
                    }
                  />
                  <LabeledSelect
                    label="Type"
                    value={field.fieldType}
                    values={productTemplateFieldTypeValues}
                    onChange={(fieldType) =>
                      updateField(field.id, { fieldType: fieldType as ProductTemplateFieldType })
                    }
                  />
                  <LabeledSelect
                    label="Scope"
                    value={field.scope}
                    values={productTemplateFieldScopeValues}
                    onChange={(scope) =>
                      updateField(field.id, { scope: scope as ProductTemplateFieldScope })
                    }
                  />
                  <TextInput
                    label="Options"
                    value={field.optionsText}
                    onChange={(optionsText) => updateField(field.id, { optionsText })}
                  />
                  <TextInput
                    label="Placeholder"
                    value={field.placeholder}
                    onChange={(placeholder) => updateField(field.id, { placeholder })}
                  />
                  <TextInput
                    label="Sort order"
                    type="number"
                    value={field.sortOrder}
                    onChange={(sortOrder) => updateField(field.id, { sortOrder })}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <CheckboxPill
                    label="Required"
                    checked={field.isRequired}
                    onChange={(isRequired) => updateField(field.id, { isRequired })}
                  />
                  <CheckboxPill
                    label="Filterable"
                    checked={field.isFilterable}
                    onChange={(isFilterable) => updateField(field.id, { isFilterable })}
                  />
                  <CheckboxPill
                    label="Searchable"
                    checked={field.isSearchable}
                    onChange={(isSearchable) => updateField(field.id, { isSearchable })}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Remove field
                  </Button>
                </div>
              </div>
            ))}
            {form.fields.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#D8E2EA] bg-white p-4 text-sm font-semibold text-[#667085]">
                No dynamic fields. This template will use only the common product fields.
              </p>
            ) : null}
          </div>
        </div>

        <FormActionRow
          submitLabel={template ? "Save template" : "Create template"}
          onCancel={onCancel}
          onSubmit={() => onSubmit(productTemplatePayloadFromForm(form))}
          disabled={
            disabled ||
            form.name.trim().length < 2 ||
            form.code.trim().length < 2 ||
            form.fields.some((field) => !field.label.trim() || !field.fieldKey.trim())
          }
        />
      </div>
    </Panel>
  );
}

function CheckboxPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] px-3 py-2 text-sm font-black text-[#1F2933]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function productTemplateOptions(templates: ProductTemplateRecord[]): AdminSelectOption[] {
  return [
    { value: "", label: "Standard product" },
    ...templates
      .filter((template) => template.status !== "ARCHIVED")
      .map((template) => ({
        value: template.id,
        label: `${template.name} (${humanize(template.listingMode)})`,
      })),
  ];
}

function categoryTaxLines(category: CategoryRecord) {
  if (
    !category.defaultHsnCode &&
    (category.defaultGstRatePercent === null || category.defaultGstRatePercent === undefined)
  ) {
    return ["No default HSN", "Seller must enter tax data"];
  }

  return [
    category.defaultHsnCode ? `HSN ${category.defaultHsnCode}` : "No HSN code",
    category.defaultGstRatePercent !== null && category.defaultGstRatePercent !== undefined
      ? `GST ${category.defaultGstRatePercent}%`
      : "No GST rate",
    category.defaultTaxDescription || "Category default",
  ];
}

function productTemplateFormState(template?: ProductTemplateRecord) {
  return {
    name: template?.name ?? "",
    code: template?.code ?? "",
    description: template?.description ?? "",
    status: template?.status ?? "ACTIVE",
    listingMode: template?.listingMode ?? "CART",
    sortOrder: String(template?.sortOrder ?? 0),
    fields: (template?.fields ?? []).map((field, index) => ({
      id: field.id ?? `field-${index}`,
      label: field.label,
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      scope: field.scope,
      isRequired: Boolean(field.isRequired),
      optionsText: (field.options ?? []).join(", "),
      placeholder: field.placeholder ?? "",
      helpText: field.helpText ?? "",
      isFilterable: Boolean(field.isFilterable),
      isSearchable: Boolean(field.isSearchable),
      sortOrder: String(field.sortOrder ?? index * 10),
    })),
  };
}

function emptyProductTemplateField(
  scope: ProductTemplateFieldScope,
  sortOrder: number,
): ProductTemplateFormField {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label: "",
    fieldKey: "",
    fieldType: "TEXT",
    scope,
    isRequired: false,
    optionsText: "",
    placeholder: "",
    helpText: "",
    isFilterable: false,
    isSearchable: false,
    sortOrder: String(sortOrder),
  };
}

function productTemplatePayloadFromForm(
  form: ReturnType<typeof productTemplateFormState>,
): ProductTemplatePayload {
  return {
    name: form.name.trim(),
    code: normalizeTemplateCodeInput(form.code),
    description: form.description.trim() || undefined,
    status: form.status,
    listingMode: form.listingMode as ProductListingMode,
    sortOrder: Number(form.sortOrder) || 0,
    fields: form.fields.map((field, index) => ({
      label: field.label.trim(),
      fieldKey: field.fieldKey.trim(),
      fieldType: field.fieldType,
      scope: field.scope,
      isRequired: field.isRequired,
      options: field.optionsText
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
      placeholder: field.placeholder.trim() || undefined,
      helpText: field.helpText.trim() || undefined,
      isFilterable: field.isFilterable,
      isSearchable: field.isSearchable,
      sortOrder: Number(field.sortOrder) || index * 10,
    })),
  };
}

function normalizeTemplateCodeInput(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_");
}

function fieldKeyFromLabel(label: string) {
  const words = label
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!words.length) {
    return "";
  }
  const [first, ...rest] = words;
  return `${first?.toLowerCase() ?? ""}${rest.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("")}`;
}

function CategoryCreateForm({
  categories,
  productTemplates,
  authHeaders,
  onSubmit,
  disabled,
}: {
  categories: CategoryRecord[];
  productTemplates: ProductTemplateRecord[];
  authHeaders: IndihubAuthHeaders;
  onSubmit: (payload: {
    name: string;
    parentId?: string | undefined;
    productTemplateId?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    defaultHsnCode?: string | undefined;
    defaultGstRatePercent?: number | undefined;
    defaultTaxDescription?: string | undefined;
    status: string;
    sortOrder: number;
  }) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    parentId: "",
    description: "",
    imageUrl: "",
    status: "ACTIVE",
    sortOrder: "0",
    productTemplateId: "",
    defaultHsnCode: "",
    defaultGstRatePercent: "",
    defaultTaxDescription: "",
  });
  const parentCategoryOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Top level" },
      ...categories.map((category) => ({ value: category.id, label: category.name })),
    ],
    [categories],
  );
  const templateOptions = productTemplateOptions(productTemplates);
  return (
    <Panel title="Create category">
      <div className="space-y-3">
        <TextInput
          label="Name"
          value={form.name}
          onChange={(name) => setForm((current) => ({ ...current, name }))}
        />
        <AdminListbox
          label="Parent category"
          value={form.parentId}
          options={parentCategoryOptions}
          onChange={(parentId) => setForm((current) => ({ ...current, parentId }))}
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Product template"
          value={form.productTemplateId}
          options={templateOptions}
          onChange={(productTemplateId) =>
            setForm((current) => ({ ...current, productTemplateId }))
          }
          buttonClassName="bg-white"
        />
        <LabeledSelect
          label="Status"
          value={form.status}
          values={["ACTIVE", "INACTIVE", "ARCHIVED"]}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <SellerImageUpload
          label="Category image"
          description="Upload the storefront category tile image through the configured ImageKit/public image provider."
          value={form.imageUrl || null}
          onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl: imageUrl ?? "" }))}
          authHeaders={authHeaders}
          purpose="CATEGORY_IMAGE"
          previewLabel={form.name || "Category"}
          aspectClass="aspect-[5/3]"
          disabled={disabled ?? false}
          layout="stacked"
        />
        <div className="grid gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
          <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Category tax default
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Default HSN"
              value={form.defaultHsnCode}
              onChange={(defaultHsnCode) => setForm((current) => ({ ...current, defaultHsnCode }))}
            />
            <TextInput
              label="Default GST %"
              type="number"
              value={form.defaultGstRatePercent}
              onChange={(defaultGstRatePercent) =>
                setForm((current) => ({ ...current, defaultGstRatePercent }))
              }
            />
          </div>
          <TextInput
            label="Tax description"
            value={form.defaultTaxDescription}
            onChange={(defaultTaxDescription) =>
              setForm((current) => ({ ...current, defaultTaxDescription }))
            }
          />
        </div>
        <TextInput
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
        />
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Description"
          className="min-h-24 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933]"
        />
        <Button
          type="button"
          onClick={() =>
            onSubmit({
              name: form.name,
              parentId: form.parentId || undefined,
              productTemplateId: form.productTemplateId || undefined,
              description: form.description || undefined,
              imageUrl: form.imageUrl || undefined,
              defaultHsnCode: form.defaultHsnCode || undefined,
              defaultGstRatePercent: form.defaultGstRatePercent
                ? Number(form.defaultGstRatePercent)
                : undefined,
              defaultTaxDescription: form.defaultTaxDescription || undefined,
              status: form.status,
              sortOrder: Number(form.sortOrder) || 0,
            })
          }
          disabled={disabled || form.name.trim().length < 2}
        >
          Create category
        </Button>
      </div>
    </Panel>
  );
}

type ReportPanelProps<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

function ReportControlPanel({
  range,
  scopeLabel,
  onRangeChange,
  exports,
}: {
  range: ReportRangeState;
  scopeLabel: string;
  onRangeChange: (range: ReportRangeState) => void;
  exports: AdminActionItem[];
}) {
  return (
    <AdminPanel className="mb-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Report range</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">{scopeLabel}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {reportRangePresets.map((preset) => {
              const active = range.preset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onRangeChange(rangeForPreset(preset.value))}
                  className={`h-9 rounded-md border px-3 text-sm font-black transition ${
                    active
                      ? "border-[#ED3500] bg-[#ED3500] text-white"
                      : "border-[#D8E2EA] bg-white text-[#1F2933] hover:bg-[#FFFCFB]"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] xl:min-w-[560px]">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">From</span>
            <input
              type="date"
              value={range.dateFrom}
              max={range.dateTo || undefined}
              onChange={(event) =>
                onRangeChange({ ...range, preset: "custom", dateFrom: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">To</span>
            <input
              type="date"
              value={range.dateTo}
              min={range.dateFrom || undefined}
              onChange={(event) =>
                onRangeChange({ ...range, preset: "custom", dateTo: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          <div className="flex items-end">
            <AdminActionMenu
              label="Export CSV"
              buttonClassName="h-10 w-full justify-center border-[#ED3500] text-[#ED3500] hover:bg-[#FFF0EC] md:w-auto"
              items={exports.map((item) => ({
                ...item,
                icon: item.icon ?? <Download className="h-4 w-4 text-[#ED3500]" />,
              }))}
            />
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}

function CategoryEditForm({
  category,
  categories,
  productTemplates,
  authHeaders,
  onSubmit,
  onCancel,
  disabled,
}: {
  category: CategoryRecord;
  categories: CategoryRecord[];
  productTemplates: ProductTemplateRecord[];
  authHeaders: IndihubAuthHeaders;
  onSubmit: (
    payload: Partial<{
      name: string;
      slug: string;
      parentId?: string | null | undefined;
      productTemplateId?: string | null | undefined;
      description?: string | undefined;
      imageUrl?: string | null | undefined;
      defaultHsnCode?: string | null | undefined;
      defaultGstRatePercent?: number | null | undefined;
      defaultTaxDescription?: string | null | undefined;
      status: string;
      sortOrder: number;
    }>,
  ) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState({
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ?? "",
    productTemplateId: category.productTemplateId ?? "",
    description: category.description ?? "",
    imageUrl: category.imageUrl ?? "",
    defaultHsnCode: category.defaultHsnCode ?? "",
    defaultGstRatePercent:
      category.defaultGstRatePercent === null || category.defaultGstRatePercent === undefined
        ? ""
        : String(category.defaultGstRatePercent),
    defaultTaxDescription: category.defaultTaxDescription ?? "",
    status: category.status,
    sortOrder: String(category.sortOrder ?? 0),
  });
  const parentCategoryOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Top level" },
      ...categories
        .filter((item) => item.id !== category.id)
        .map((item) => ({ value: item.id, label: item.name })),
    ],
    [categories, category.id],
  );
  const templateOptions = productTemplateOptions(productTemplates);

  return (
    <Panel title={`Edit category: ${category.name}`}>
      <div className="space-y-3">
        <TextInput
          label="Name"
          value={form.name}
          onChange={(name) => setForm((current) => ({ ...current, name }))}
        />
        <TextInput
          label="Slug"
          value={form.slug}
          onChange={(slug) => setForm((current) => ({ ...current, slug }))}
        />
        <AdminListbox
          label="Parent category"
          value={form.parentId}
          options={parentCategoryOptions}
          onChange={(parentId) => setForm((current) => ({ ...current, parentId }))}
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Product template"
          value={form.productTemplateId}
          options={templateOptions}
          onChange={(productTemplateId) =>
            setForm((current) => ({ ...current, productTemplateId }))
          }
          buttonClassName="bg-white"
        />
        <LabeledSelect
          label="Status"
          value={form.status}
          values={["ACTIVE", "INACTIVE", "ARCHIVED"]}
          onChange={(status) => setForm((current) => ({ ...current, status }))}
        />
        <SellerImageUpload
          label="Category image"
          description="Replace or remove the image shown on category cards and public category SEO previews."
          value={form.imageUrl || null}
          onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl: imageUrl ?? "" }))}
          authHeaders={authHeaders}
          purpose="CATEGORY_IMAGE"
          previewLabel={form.name || category.name}
          aspectClass="aspect-[5/3]"
          disabled={disabled ?? false}
          layout="stacked"
        />
        <div className="grid gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
          <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Category tax default
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput
              label="Default HSN"
              value={form.defaultHsnCode}
              onChange={(defaultHsnCode) => setForm((current) => ({ ...current, defaultHsnCode }))}
            />
            <TextInput
              label="Default GST %"
              type="number"
              value={form.defaultGstRatePercent}
              onChange={(defaultGstRatePercent) =>
                setForm((current) => ({ ...current, defaultGstRatePercent }))
              }
            />
          </div>
          <TextInput
            label="Tax description"
            value={form.defaultTaxDescription}
            onChange={(defaultTaxDescription) =>
              setForm((current) => ({ ...current, defaultTaxDescription }))
            }
          />
        </div>
        <TextInput
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={(sortOrder) => setForm((current) => ({ ...current, sortOrder }))}
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            className="mt-1 min-h-24 w-full rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:ring-2 focus:ring-[#FFE0D6]"
          />
        </label>
        <FormActionRow
          submitLabel="Save category"
          onCancel={onCancel}
          onSubmit={() =>
            onSubmit({
              name: form.name,
              slug: form.slug,
              parentId: form.parentId || null,
              productTemplateId: form.productTemplateId || null,
              description: form.description || undefined,
              imageUrl: form.imageUrl || null,
              defaultHsnCode: form.defaultHsnCode || null,
              defaultGstRatePercent: form.defaultGstRatePercent
                ? Number(form.defaultGstRatePercent)
                : null,
              defaultTaxDescription: form.defaultTaxDescription || null,
              status: form.status,
              sortOrder: Number(form.sortOrder) || 0,
            })
          }
          disabled={disabled || form.name.trim().length < 2 || form.slug.trim().length < 2}
        />
      </div>
    </Panel>
  );
}

function contentRecordIcon(item: CmsPageRecord | BannerRecord | HomepageSectionRecord) {
  if ("slug" in item) {
    return <BookOpen className="h-5 w-5" />;
  }
  if ("sectionType" in item) {
    return <Settings className="h-5 w-5" />;
  }
  return <Bell className="h-5 w-5" />;
}

function contentRecordSubtitle(item: CmsPageRecord | BannerRecord | HomepageSectionRecord) {
  if ("slug" in item) {
    return item.slug;
  }
  if ("sectionType" in item) {
    return humanize(item.sectionType);
  }
  return item.subtitle || item.linkUrl || "Homepage banner";
}

function contentRecordDetails(item: CmsPageRecord | BannerRecord | HomepageSectionRecord) {
  if ("slug" in item) {
    return [
      `Updated ${formatDate(item.updatedAt)}`,
      item.publishedAt ? `Published ${formatDate(item.publishedAt)}` : "Not published yet",
    ];
  }
  if ("sectionType" in item) {
    return [
      `Sort ${item.sortOrder}`,
      `Updated ${formatDate(item.updatedAt)}`,
      homepageSectionConfigSummary(item.config),
    ];
  }
  return [
    `Sort ${item.sortOrder}`,
    item.imageUrl ? "Image set" : "No image set",
    item.linkUrl ? `Links to ${item.linkUrl}` : "No link set",
  ];
}

function homepageSectionConfigSummary(config?: Record<string, unknown> | null) {
  const itemCount = Array.isArray(config?.items) ? config.items.length : 0;
  if (itemCount) {
    return `${itemCount.toLocaleString("en-IN")} item${itemCount === 1 ? "" : "s"}`;
  }

  if (config?.ctaLabel || config?.ctaUrl) {
    return "Button configured";
  }

  if (config?.subtitle || config?.description) {
    return "Text configured";
  }

  return "Basic section";
}

function contentPublishedCount(items: Array<{ status: string }>) {
  return items.filter((item) => item.status === "PUBLISHED").length.toLocaleString("en-IN");
}

function SalesReportPanel({ data, isLoading, error }: ReportPanelProps<AdminSalesReport>) {
  if (isLoading || error || !data) {
    return <ReportPanelState title="Sales report" isLoading={isLoading} error={error} />;
  }

  const paymentRows = data.payments ?? [];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross revenue" value={formatPaise(data.summary.totalPaise)} />
        <MetricCard label="Product subtotal" value={formatPaise(data.summary.subtotalPaise)} />
        <MetricCard label="Shipping" value={formatPaise(data.summary.shippingPaise)} />
        <MetricCard label="Orders" value={`${data.summary.orderCount}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <ReportDonutPanel
          title="Payment mix"
          emptyTitle="No payment records in this report."
          totalLabel={formatPaise(
            paymentRows.reduce((total, item) => total + (item._sum?.amountPaise ?? 0), 0),
          )}
          rows={paymentRows.map((item) => ({
            id: `${item.provider}-${item.status}`,
            label: humanize(`${item.provider} ${item.status}`),
            value: item._sum?.amountPaise ?? 0,
            note: `${countValue(item._count)} transaction${countValue(item._count) === 1 ? "" : "s"}`,
            valueLabel: formatPaise(item._sum?.amountPaise ?? 0),
          }))}
        />

        <Panel title="Recent orders">
          <ReportTable
            rows={data.recentOrders ?? []}
            emptyTitle="No orders in this report range."
            getKey={(item) => item.id}
            columns={[
              {
                header: "Order",
                cell: (item) => (
                  <EntityTitle
                    title={item.orderNumber}
                    subtitle={
                      item.customer?.user?.fullName ?? item.customer?.user?.email ?? "Customer"
                    }
                    actionHref={`/admin/orders/${item.orderNumber}`}
                  />
                ),
              },
              {
                header: "Status",
                cell: (item) => (
                  <StatusBadge tone={statusTone(item.orderStatus)}>
                    {humanize(item.orderStatus)}
                  </StatusBadge>
                ),
              },
              {
                header: "Payment",
                cell: (item) => (
                  <StatusBadge tone={statusTone(item.paymentStatus)}>
                    {humanize(item.paymentStatus)}
                  </StatusBadge>
                ),
              },
              {
                header: "Total",
                cell: (item) => (
                  <span className="font-black text-[#163B5C]">
                    {formatPaise(item.totalPaise, item.currency ?? "INR")}
                  </span>
                ),
              },
              {
                header: "Created",
                cell: (item) => (
                  <span className="text-sm font-semibold text-[#667085]">
                    {formatDate(item.createdAt)}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}

function SellerReportPanel({ data, isLoading, error }: ReportPanelProps<AdminSellerReport>) {
  if (isLoading || error || !data) {
    return <ReportPanelState title="Seller report" isLoading={isLoading} error={error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Approved sellers" value={`${data.summary.approvedSellers}`} />
        <MetricCard label="Pending sellers" value={`${data.summary.pendingSellers}`} />
        <MetricCard
          label="Reported seller sales"
          value={formatPaise(data.sellers.reduce((total, item) => total + item.salesPaise, 0))}
        />
      </div>

      <ReportBarList
        title="Top sellers by sales"
        emptyTitle="No seller sales in this report range."
        rows={(data.sellers ?? []).map((item) => ({
          id: item.sellerId,
          label: item.storeName,
          value: item.salesPaise,
          note: `${item.orderCount} order${item.orderCount === 1 ? "" : "s"}`,
          valueLabel: formatPaise(item.salesPaise),
        }))}
      />

      <Panel title="Seller performance table">
        <ReportTable
          rows={data.sellers ?? []}
          emptyTitle="No seller performance rows yet."
          getKey={(item) => item.sellerId}
          columns={[
            {
              header: "Seller",
              cell: (item) => <EntityTitle title={item.storeName} subtitle={item.sellerId} />,
            },
            {
              header: "Orders",
              cell: (item) => <span className="font-black text-[#163B5C]">{item.orderCount}</span>,
            },
            {
              header: "Sales",
              cell: (item) => (
                <span className="font-black text-[#163B5C]">{formatPaise(item.salesPaise)}</span>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function ProductReportPanel({ data, isLoading, error }: ReportPanelProps<AdminProductReport>) {
  if (isLoading || error || !data) {
    return <ReportPanelState title="Product report" isLoading={isLoading} error={error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Active products" value={`${data.summary.activeProducts}`} />
        <MetricCard label="Pending approvals" value={`${data.summary.pendingProducts}`} />
        <MetricCard label="Low stock variants" value={`${data.lowStockProducts?.length ?? 0}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <ReportBarList
          title="Top products by sales"
          emptyTitle="No product sales in this report range."
          rows={(data.topProducts ?? []).map((item) => ({
            id: item.productId,
            label: item.productName,
            value: item.salesPaise,
            note: `${item.quantity} unit${item.quantity === 1 ? "" : "s"} sold`,
            valueLabel: formatPaise(item.salesPaise),
          }))}
        />

        <Panel title="Low stock watchlist">
          <div className="grid gap-3">
            {(data.lowStockProducts ?? []).map((item) => (
              <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <p className="font-black text-[#1F2933]">{item.product?.name ?? "Product"}</p>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  {item.variantName ?? item.sku} - {item.stockQuantity} left
                </p>
              </div>
            ))}
            {!(data.lowStockProducts ?? []).length ? (
              <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
                No low-stock variants in this report.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Product performance table">
        <ReportTable
          rows={data.topProducts ?? []}
          emptyTitle="No product performance rows yet."
          getKey={(item) => item.productId}
          columns={[
            {
              header: "Product",
              cell: (item) => <EntityTitle title={item.productName} subtitle={item.productId} />,
            },
            {
              header: "Units",
              cell: (item) => <span className="font-black text-[#163B5C]">{item.quantity}</span>,
            },
            {
              header: "Sales",
              cell: (item) => (
                <span className="font-black text-[#163B5C]">{formatPaise(item.salesPaise)}</span>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function EnquiryReportPanel({ data, isLoading, error }: ReportPanelProps<AdminEnquiryReport>) {
  if (isLoading || error || !data) {
    return (
      <ReportPanelState title="Enquiry and support report" isLoading={isLoading} error={error} />
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportDonutPanel
          title="B2B enquiry status"
          emptyTitle="No B2B enquiries in this report range."
          rows={(data.b2bByStatus ?? []).map((item) => ({
            id: item.status,
            label: humanize(item.status),
            value: countValue(item._count),
            valueLabel: `${countValue(item._count)}`,
          }))}
        />
        <ReportDonutPanel
          title="Support workload"
          emptyTitle="No support requests in this report range."
          rows={(data.supportByStatus ?? []).map((item) => ({
            id: item.status,
            label: humanize(item.status),
            value: countValue(item._count),
            valueLabel: `${countValue(item._count)}`,
          }))}
        />
      </div>

      <Panel title="Recent B2B enquiries">
        <ReportTable
          rows={data.recentB2B ?? []}
          emptyTitle="No B2B enquiries in this report range."
          getKey={(item) => item.id}
          columns={[
            {
              header: "Buyer",
              cell: (item) => (
                <EntityTitle
                  title={item.businessBuyer?.companyName ?? "Business buyer"}
                  subtitle={item.product?.name ?? item.seller?.storeName ?? item.id}
                />
              ),
            },
            {
              header: "Status",
              cell: (item) => (
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              ),
            },
            {
              header: "Qty",
              cell: (item) => <span className="font-black text-[#163B5C]">{item.quantity}</span>,
            },
            {
              header: "Created",
              cell: (item) => (
                <span className="text-sm font-semibold text-[#667085]">
                  {formatDate(item.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="Recent support requests">
        <ReportTable
          rows={data.recentSupport ?? []}
          emptyTitle="No support requests in this report range."
          getKey={(item) => item.id}
          columns={[
            {
              header: "Request",
              cell: (item) => (
                <EntityTitle
                  title={item.subject ?? "Support request"}
                  subtitle={item.email ?? item.id}
                />
              ),
            },
            {
              header: "Status",
              cell: (item) => (
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              ),
            },
            {
              header: "Created",
              cell: (item) => (
                <span className="text-sm font-semibold text-[#667085]">
                  {formatDate(item.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function ReportPanelState({
  title,
  isLoading,
  error,
}: {
  title: string;
  isLoading?: boolean | undefined;
  error?: unknown;
}) {
  return (
    <Panel title={title}>
      {isLoading ? <p className="text-sm font-semibold text-[#667085]">Loading report...</p> : null}
      {!isLoading && error ? (
        <PanelStatus
          tone="danger"
          title="Report failed to load"
          message={error instanceof Error ? error.message : "Unable to load this report."}
          {...(error instanceof IndihubApiError ? { status: error.status } : {})}
        />
      ) : null}
      {!isLoading && !error ? (
        <p className="text-sm font-semibold text-[#667085]">No report data loaded yet.</p>
      ) : null}
    </Panel>
  );
}

type ReportChartRow = {
  id: string;
  label: string;
  value: number;
  valueLabel?: string;
  note?: string;
};

function ReportDonutPanel({
  title,
  rows,
  emptyTitle,
  totalLabel,
}: {
  title: string;
  rows: ReportChartRow[];
  emptyTitle: string;
  totalLabel?: string | undefined;
}) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  let cursor = 0;
  const gradient =
    total > 0
      ? rows
          .map((row, index) => {
            const start = cursor;
            const end = cursor + (Math.max(0, row.value) / total) * 360;
            cursor = end;
            const color = reportChartColors[index % reportChartColors.length];
            return `${color} ${start}deg ${end}deg`;
          })
          .join(", ")
      : "#E5E7EB 0deg 360deg";

  return (
    <Panel title={title}>
      {rows.length ? (
        <div className="grid gap-5 md:grid-cols-[170px_1fr] md:items-center">
          <div
            className="relative mx-auto grid h-40 w-40 place-items-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
            aria-hidden="true"
          >
            <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-sm">
              <span>
                <span className="block text-xl font-black text-[#163B5C]">
                  {totalLabel ?? total}
                </span>
                <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">
                  Total
                </span>
              </span>
            </div>
          </div>
          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3"
              >
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-2 font-black text-[#1F2933]">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: reportChartColors[index % reportChartColors.length],
                      }}
                    />
                    {row.label}
                  </span>
                  {row.note ? (
                    <p className="mt-1 text-xs font-semibold text-[#667085]">{row.note}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-black text-[#163B5C]">
                  {row.valueLabel ?? row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
          {emptyTitle}
        </p>
      )}
    </Panel>
  );
}

function ReportBarList({
  title,
  rows,
  emptyTitle,
}: {
  title: string;
  rows: ReportChartRow[];
  emptyTitle: string;
}) {
  const max = Math.max(0, ...rows.map((item) => item.value));

  return (
    <Panel title={title}>
      <div className="grid gap-3">
        {rows.map((item, index) => {
          const width =
            max > 0 && item.value > 0 ? Math.max(6, Math.round((item.value / max) * 100)) : 0;
          const color = reportChartColors[index % reportChartColors.length];

          return (
            <div key={item.id} className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[#1F2933]">{item.label}</p>
                  {item.note ? (
                    <p className="mt-1 text-sm font-semibold text-[#667085]">{item.note}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-black text-[#163B5C]">
                  {item.valueLabel ?? item.value}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
        {!rows.length ? (
          <p className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            {emptyTitle}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function ReportTable<T>({
  rows,
  columns,
  emptyTitle,
  getKey,
}: {
  rows: T[];
  columns: Array<TableColumn<T>>;
  emptyTitle: string;
  getKey: (item: T, index: number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <table className="min-w-full text-left">
        <thead className="bg-[#F8FAFC]">
          <tr className="border-b border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#667085]">
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-3 ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {rows.map((item, index) => (
            <tr key={getKey(item, index)} className="align-top">
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-4 ${column.className ?? ""}`}>
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
              >
                {emptyTitle}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function countValue(count: CountAggregate) {
  if (typeof count === "number") {
    return count;
  }

  return count?._all ?? 0;
}

function rangeForPreset(preset: ReportRangePreset): ReportRangeState {
  if (preset === "all" || preset === "custom") {
    return { preset, dateFrom: "", dateTo: "" };
  }

  const days = reportRangePresets.find((item) => item.value === preset)?.days ?? 30;
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateTo.getDate() - (days - 1));

  return {
    preset,
    dateFrom: dateInputValue(dateFrom),
    dateTo: dateInputValue(dateTo),
  };
}

function reportRangeQueryString(range: ReportRangeState) {
  const params = new URLSearchParams();
  if (range.dateFrom) {
    params.set("dateFrom", `${range.dateFrom}T00:00:00.000Z`);
  }
  if (range.dateTo) {
    params.set("dateTo", `${range.dateTo}T23:59:59.999Z`);
  }

  return params.toString();
}

function reportPath(path: string, queryString: string) {
  return queryString ? `${path}?${queryString}` : path;
}

function reportRangeLabel(range: ReportRangeState) {
  if (!range.dateFrom && !range.dateTo) {
    return "Showing all available report data.";
  }

  if (range.dateFrom && range.dateTo) {
    return `Showing report data from ${range.dateFrom} to ${range.dateTo}.`;
  }

  if (range.dateFrom) {
    return `Showing report data from ${range.dateFrom}.`;
  }

  return `Showing report data until ${range.dateTo}.`;
}

function menuAreaOptionsFromItems(items: CmsMenuItemRecord[]) {
  const knownAreas = new Set(cmsMenuAreaOptions.map((option) => option.value));
  const customAreas = Array.from(
    new Set(items.map((item) => item.area).filter((area) => !knownAreas.has(area))),
  ).sort();

  return [
    ...cmsMenuAreaOptions,
    ...customAreas.map((area) => ({ value: area, label: humanize(area) })),
  ];
}

function groupMenuChildren(items: CmsMenuItemRecord[]) {
  const groups = new Map<string, CmsMenuItemRecord[]>();
  for (const item of items) {
    if (!item.parentId) {
      continue;
    }

    const children = groups.get(item.parentId) ?? [];
    children.push(item);
    groups.set(item.parentId, children);
  }

  groups.forEach((children) => children.sort(compareMenuItems));
  return groups;
}

function compareMenuItems(left: CmsMenuItemRecord, right: CmsMenuItemRecord) {
  return left.sortOrder - right.sortOrder || left.label.localeCompare(right.label);
}

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function exportSalesReport(data: AdminSalesReport, range: ReportRangeState) {
  downloadCsv(`1handindia-sales-${reportExportSuffix(range)}.csv`, [
    ["Section", "Name", "Status", "Count", "Amount INR", "Reference", "Date"],
    [
      "Summary",
      "Gross revenue",
      "",
      data.summary.orderCount,
      paiseToRupees(data.summary.totalPaise),
      "",
      "",
    ],
    ["Summary", "Product subtotal", "", "", paiseToRupees(data.summary.subtotalPaise), "", ""],
    ["Summary", "Shipping", "", "", paiseToRupees(data.summary.shippingPaise), "", ""],
    ...data.payments.map((item) => [
      "Payment",
      item.provider,
      item.status,
      countValue(item._count),
      paiseToRupees(item._sum?.amountPaise ?? 0),
      "",
      "",
    ]),
    ...data.recentOrders.map((item) => [
      "Order",
      item.customer?.user?.fullName ?? item.customer?.user?.email ?? "Customer",
      item.orderStatus,
      "",
      paiseToRupees(item.totalPaise),
      item.orderNumber,
      item.createdAt ?? "",
    ]),
  ]);
}

function exportSellerReport(data: AdminSellerReport, range: ReportRangeState) {
  downloadCsv(`1handindia-sellers-${reportExportSuffix(range)}.csv`, [
    ["Section", "Seller", "Count", "Amount INR", "Reference"],
    ["Summary", "Approved sellers", data.summary.approvedSellers, "", ""],
    ["Summary", "Pending sellers", data.summary.pendingSellers, "", ""],
    ...data.sellers.map((item) => [
      "Seller",
      item.storeName,
      item.orderCount,
      paiseToRupees(item.salesPaise),
      item.sellerId,
    ]),
  ]);
}

function exportProductReport(data: AdminProductReport, range: ReportRangeState) {
  downloadCsv(`1handindia-products-${reportExportSuffix(range)}.csv`, [
    ["Section", "Product", "Count", "Amount INR", "Reference"],
    ["Summary", "Active products", data.summary.activeProducts, "", ""],
    ["Summary", "Pending approvals", data.summary.pendingProducts, "", ""],
    ...data.topProducts.map((item) => [
      "Top product",
      item.productName,
      item.quantity,
      paiseToRupees(item.salesPaise),
      item.productId,
    ]),
    ...data.lowStockProducts.map((item) => [
      "Low stock",
      item.product?.name ?? "Product",
      item.stockQuantity,
      "",
      item.variantName ?? item.sku,
    ]),
  ]);
}

function exportEnquiryReport(data: AdminEnquiryReport, range: ReportRangeState) {
  downloadCsv(`1handindia-enquiries-support-${reportExportSuffix(range)}.csv`, [
    ["Section", "Name", "Status", "Count or quantity", "Reference", "Created"],
    ...data.b2bByStatus.map((item) => [
      "B2B status",
      humanize(item.status),
      item.status,
      countValue(item._count),
      "",
      "",
    ]),
    ...data.supportByStatus.map((item) => [
      "Support status",
      humanize(item.status),
      item.status,
      countValue(item._count),
      "",
      "",
    ]),
    ...data.recentB2B.map((item) => [
      "B2B enquiry",
      item.businessBuyer?.companyName ?? "Business buyer",
      item.status,
      item.quantity,
      item.product?.name ?? item.seller?.storeName ?? item.id,
      item.createdAt ?? "",
    ]),
    ...data.recentSupport.map((item) => [
      "Support request",
      item.subject ?? "Support request",
      item.status,
      "",
      item.email ?? item.id,
      item.createdAt ?? "",
    ]),
  ]);
}

type CsvCell = string | number | boolean | null | undefined;

function downloadCsv(filename: string, rows: CsvCell[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: CsvCell) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function paiseToRupees(value: number) {
  return (value / 100).toFixed(2);
}

function reportExportSuffix(range: ReportRangeState) {
  if (!range.dateFrom && !range.dateTo) {
    return "all-time";
  }

  return `${range.dateFrom || "start"}-to-${range.dateTo || "today"}`;
}

function useAdminList<T>(
  key: string,
  path: string,
  authHeaders: IndihubAuthHeaders,
  search = "",
  searchParamName = "search",
  fixedParams?: Record<string, string | undefined>,
  page = 1,
  limit = 50,
) {
  const fixedParamsKey = JSON.stringify(fixedParams ?? {});
  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(fixedParams ?? {}).forEach(([paramKey, value]) => {
      if (value) {
        params.set(paramKey, value);
      }
    });
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search.trim()) {
      params.set(searchParamName, search.trim());
    }
    return `${path}?${params.toString()}`;
  }, [fixedParams, fixedParamsKey, limit, page, path, search, searchParamName]);

  return useQuery({
    queryKey: [key, authHeaders, search, fixedParamsKey, page, limit],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () => indihubFetch<PageResult<T> | T[]>(queryPath, undefined, authHeaders),
  });
}

function adminRequest<T = unknown>(
  path: string,
  authHeaders: IndihubAuthHeaders,
  init?: RequestInit,
) {
  return indihubFetch<T>(path, init, authHeaders);
}

type AdminConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "warning" | "info";
  onConfirm: () => void;
};

function useAdminConfirmation() {
  const [request, setRequest] = useState<AdminConfirmationRequest | null>(null);

  return {
    requestConfirmation: setRequest,
    dialog: request ? (
      <AdminConfirmationDialog request={request} onClose={() => setRequest(null)} />
    ) : null,
  };
}

function AdminConfirmationDialog({
  request,
  onClose,
}: {
  request: AdminConfirmationRequest;
  onClose: () => void;
}) {
  return (
    <HeadlessAdminConfirmationDialog
      open
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      tone={request.tone ?? "danger"}
      onClose={onClose}
      onConfirm={request.onConfirm}
    />
  );
}

function mutationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to complete the admin update.";
}

function listItems<T>(data: PageResult<T> | T[] | undefined): T[] {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : data.items;
}

function totalItems<T>(data: PageResult<T> | T[] | undefined, fallback: number) {
  if (!data) {
    return 0;
  }

  return Array.isArray(data) ? data.length : (data.total ?? fallback);
}

function statusTone(status?: string | null): StatusTone {
  const normalized = status ?? "";
  if (
    [
      "ACTIVE",
      "APPROVED",
      "PAID",
      "DELIVERED",
      "SENT",
      "COMPLETED",
      "PUBLISHED",
      "RESPONDED",
      "BUYER_CONFIRMED",
      "ADMIN_APPROVED",
      "FINALISED",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (
    [
      "PENDING",
      "PENDING_APPROVAL",
      "PLACED",
      "PROCESSING",
      "IN_REVIEW",
      "DRAFT",
      "SKIPPED",
      "OPEN",
    ].includes(normalized)
  ) {
    return "warning";
  }
  if (
    ["REJECTED", "SUSPENDED", "DISABLED", "FAILED", "CANCELLED", "ARCHIVED"].includes(normalized)
  ) {
    return "danger";
  }
  return "info";
}

function humanize(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sellerDocumentSummary(documents?: SellerRecord["documents"]) {
  if (!documents?.length) {
    return "No verification documents";
  }

  return documents
    .map((document) => `${humanize(document.documentType)}: ${humanize(document.status)}`)
    .join(", ");
}

function formatPaise(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

type AdminLocationValue = {
  countryCode: string;
  stateCode: string;
  cityCode: string;
  pincode: string;
  localAreaCode: string;
};

type LocationSelectOption = {
  code: string;
  label: string;
  postalCode?: string | null;
};

function AdminLocationSelector({
  value,
  onChange,
  allowAnyCountry = false,
}: {
  value: AdminLocationValue;
  onChange: (value: AdminLocationValue) => void;
  allowAnyCountry?: boolean;
}) {
  const locationCatalog = useLocationCatalog({
    countryCode: value.countryCode,
    stateCode: value.stateCode,
  });
  const cityAreasStore = useLocationAreaStore({
    countryCode: value.countryCode,
    stateCode: value.stateCode,
    cityCode: value.cityCode,
    limit: 100,
    enabled: Boolean(value.cityCode),
  });
  const pincodeAreasStore = useLocationAreaStore({
    countryCode: value.countryCode,
    stateCode: value.stateCode,
    cityCode: value.cityCode,
    postalCode: value.pincode,
    limit: 100,
    enabled: Boolean(value.pincode),
  });
  const pincodeListId = useId();
  const countries = withFallbackOption(
    locationCatalog.countries.map(countryToOption),
    value.countryCode,
  );
  const states = withFallbackOption(locationCatalog.states.map(stateToOption), value.stateCode);
  const cities = withFallbackOption(locationCatalog.cities.map(cityToOption), value.cityCode);
  const cityAreas = cityAreasStore.areas;
  const pincodeOptions = withFallbackOption(uniquePincodeOptions(cityAreas), value.pincode);
  const areaSource = value.pincode ? pincodeAreasStore.areas : cityAreas;
  const areaOptions = withFallbackOption(areaSource.map(areaToOption), value.localAreaCode);
  const selectClassName =
    "h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500] disabled:bg-[#F8FAFC]";

  const update = (patch: Partial<AdminLocationValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-[#667085]">Country</span>
        <select
          value={value.countryCode}
          onChange={(event) =>
            onChange({
              countryCode: event.currentTarget.value,
              stateCode: "",
              cityCode: "",
              pincode: "",
              localAreaCode: "",
            })
          }
          className={selectClassName}
        >
          {allowAnyCountry ? <option value="">Any country</option> : null}
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-[#667085]">State</span>
        <select
          value={value.stateCode}
          onChange={(event) =>
            update({
              stateCode: event.currentTarget.value,
              cityCode: "",
              pincode: "",
              localAreaCode: "",
            })
          }
          disabled={!value.countryCode}
          className={selectClassName}
        >
          <option value="">Any state</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-[#667085]">City</span>
        <select
          value={value.cityCode}
          onChange={(event) =>
            update({
              cityCode: event.currentTarget.value,
              pincode: "",
              localAreaCode: "",
            })
          }
          disabled={!value.stateCode}
          className={selectClassName}
        >
          <option value="">Any city</option>
          {cities.map((city) => (
            <option key={city.code} value={city.code}>
              {city.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-[#667085]">Pincode</span>
        <input
          list={pincodeListId}
          value={value.pincode}
          onChange={(event) =>
            update({
              pincode: event.currentTarget.value.trim().toUpperCase(),
              localAreaCode: "",
            })
          }
          disabled={!value.countryCode}
          placeholder="Enter or choose pincode"
          autoComplete="postal-code"
          className={selectClassName}
        />
        <datalist id={pincodeListId}>
          {pincodeOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </datalist>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-black uppercase text-[#667085]">Local area</span>
        <select
          value={value.localAreaCode}
          onChange={(event) => {
            const localAreaCode = event.currentTarget.value;
            const selectedArea = areaSource.find((area) => area.code === localAreaCode);
            const selectedCity = selectedArea?.city;
            const selectedSubdivision = selectedCity?.subdivision;
            const selectedCountry = selectedSubdivision?.country;
            update({
              countryCode: selectedCountry?.code ?? value.countryCode,
              stateCode: selectedSubdivision?.code ?? value.stateCode,
              cityCode: selectedCity?.code ?? value.cityCode,
              localAreaCode,
              pincode: selectedArea?.postalCode || value.pincode,
            });
          }}
          disabled={!value.cityCode && !value.pincode}
          className={selectClassName}
        >
          <option value="">Any local area</option>
          {areaOptions.map((area) => (
            <option key={area.code} value={area.code}>
              {area.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function defaultRateForm(): RateFormState {
  return {
    name: "Default local delivery",
    deliveryMode: "LOCAL_DELIVERY_PARTNER",
    isActive: true,
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    pincode: "",
    localAreaCode: "",
    minSubtotalRupees: "",
    maxSubtotalRupees: "",
    shippingRupees: "49",
    freeAboveRupees: "",
    codFlatRupees: "",
    priority: "100",
  };
}

function defaultCourierProviderForm(): CourierProviderFormState {
  return {
    providerCode: "",
    displayName: "",
    mode: "MANUAL",
    isActive: true,
    serviceableCountries: [],
    adapterCode: "GENERIC_REST",
    apiBaseUrl: "",
    bookingEndpointPath: "",
    trackingEndpointPath: "",
    labelEndpointPath: "",
    cancellationEndpointPath: "",
    accountCode: "",
    username: "",
    apiKey: "",
    apiSecret: "",
    password: "",
    webhookSecret: "",
    defaultPackageWeightGrams: "500",
    defaultPackageLengthCm: "20",
    defaultPackageBreadthCm: "15",
    defaultPackageHeightCm: "8",
    credentialsConfigured: false,
    webhookSecretConfigured: false,
    notes: "",
  };
}

function courierProviderFormFromRecord(provider: CourierProviderRecord): CourierProviderFormState {
  return {
    providerCode: provider.providerCode,
    displayName: provider.displayName,
    mode: provider.mode,
    isActive: provider.isActive,
    serviceableCountries: provider.serviceableCountryCodes,
    adapterCode: provider.adapterCode ?? "GENERIC_REST",
    apiBaseUrl: provider.apiBaseUrl ?? "",
    bookingEndpointPath: provider.bookingEndpointPath ?? "",
    trackingEndpointPath: provider.trackingEndpointPath ?? "",
    labelEndpointPath: provider.labelEndpointPath ?? "",
    cancellationEndpointPath: provider.cancellationEndpointPath ?? "",
    accountCode: provider.accountCode ?? "",
    username: provider.username ?? "",
    apiKey: "",
    apiSecret: "",
    password: "",
    webhookSecret: "",
    defaultPackageWeightGrams: provider.defaultPackage?.weightGrams
      ? String(provider.defaultPackage.weightGrams)
      : "",
    defaultPackageLengthCm: provider.defaultPackage?.lengthCm
      ? String(provider.defaultPackage.lengthCm)
      : "",
    defaultPackageBreadthCm: provider.defaultPackage?.breadthCm
      ? String(provider.defaultPackage.breadthCm)
      : "",
    defaultPackageHeightCm: provider.defaultPackage?.heightCm
      ? String(provider.defaultPackage.heightCm)
      : "",
    credentialsConfigured: provider.credentialsConfigured,
    webhookSecretConfigured: provider.webhookSecretConfigured,
    notes: provider.notes ?? "",
  };
}

function courierProviderPayloadFromForm(form: CourierProviderFormState) {
  const apiKey = form.apiKey.trim();
  const apiSecret = form.apiSecret.trim();
  const password = form.password.trim();
  const webhookSecret = form.webhookSecret.trim();
  const hasCredentialInputs = Boolean(
    apiKey || apiSecret || password || form.accountCode.trim() || form.username.trim(),
  );

  return {
    providerCode: normalizeProviderCodeInput(form.providerCode),
    displayName: form.displayName.trim(),
    mode: form.mode,
    isActive: form.isActive,
    serviceableCountryCodes: normalizeCountryCodeArray(form.serviceableCountries),
    adapterCode: normalizeProviderCodeInput(form.adapterCode),
    apiBaseUrl: form.apiBaseUrl.trim(),
    bookingEndpointPath: form.bookingEndpointPath.trim(),
    trackingEndpointPath: form.trackingEndpointPath.trim(),
    labelEndpointPath: form.labelEndpointPath.trim(),
    cancellationEndpointPath: form.cancellationEndpointPath.trim(),
    accountCode: form.accountCode.trim(),
    username: form.username.trim(),
    defaultPackageWeightGrams: positiveIntegerOrUndefined(form.defaultPackageWeightGrams),
    defaultPackageLengthCm: positiveIntegerOrUndefined(form.defaultPackageLengthCm),
    defaultPackageBreadthCm: positiveIntegerOrUndefined(form.defaultPackageBreadthCm),
    defaultPackageHeightCm: positiveIntegerOrUndefined(form.defaultPackageHeightCm),
    ...(apiKey ? { apiKey } : {}),
    ...(apiSecret ? { apiSecret } : {}),
    ...(password ? { password } : {}),
    ...(webhookSecret ? { webhookSecret } : {}),
    credentialsConfigured: form.credentialsConfigured || hasCredentialInputs,
    webhookSecretConfigured: form.webhookSecretConfigured || Boolean(webhookSecret),
    notes: form.notes.trim() || undefined,
  };
}

function normalizeProviderCodeInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function normalizeCountryCodeArray(values: string[]) {
  return Array.from(
    new Set(
      values.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code)),
    ),
  );
}

function countrySelectChoices(countries: LocationCountry[], selectedCodes: string[]) {
  return withFallbackOption(countries.map(countryToOption), selectedCodes).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function countryToOption(country: LocationCountry): LocationSelectOption {
  return { code: country.code, label: `${country.name} (${country.code})` };
}

function stateToOption(state: LocationSubdivision): LocationSelectOption {
  return { code: state.code, label: `${state.name} (${state.code})` };
}

function cityToOption(city: LocationCity): LocationSelectOption {
  return { code: city.code, label: `${city.name} (${city.code})` };
}

function areaToOption(area: LocationArea): LocationSelectOption {
  return {
    code: area.code,
    label: `${formatLocalAreaLabel(area)} / ${area.code}`,
    postalCode: area.postalCode ?? null,
  };
}

function uniquePincodeOptions(areas: LocationArea[]): LocationSelectOption[] {
  const seen = new Set<string>();
  return areas
    .map((area) => area.postalCode?.trim())
    .filter((postalCode): postalCode is string => Boolean(postalCode))
    .filter((postalCode) => {
      if (seen.has(postalCode)) {
        return false;
      }
      seen.add(postalCode);
      return true;
    })
    .map((postalCode) => ({ code: postalCode, label: postalCode }));
}

function withFallbackOption(
  options: LocationSelectOption[],
  selected: string,
): LocationSelectOption[];
function withFallbackOption(
  options: LocationSelectOption[],
  selected: string[],
): LocationSelectOption[];
function withFallbackOption(options: LocationSelectOption[], selected: string | string[]) {
  const selectedValues = Array.isArray(selected) ? selected : [selected];
  const knownCodes = new Set(options.map((option) => option.code));
  const fallbackOptions = selectedValues
    .map((code) => code.trim())
    .filter(Boolean)
    .filter((code) => !knownCodes.has(code))
    .map((code) => ({ code, label: code }));
  return [...options, ...fallbackOptions];
}

function rateCardPayloadFromForm(form: RateFormState) {
  return {
    name: form.name.trim(),
    deliveryMode: form.deliveryMode,
    countryCode: emptyToUndefined(form.countryCode.toUpperCase()),
    stateCode: emptyToUndefined(form.stateCode.toUpperCase()),
    cityCode: emptyToUndefined(form.cityCode.toUpperCase()),
    pincode: emptyToUndefined(form.pincode),
    localAreaCode: emptyToUndefined(form.localAreaCode.toUpperCase()),
    minSubtotalPaise: optionalRupeesInputToPaise(form.minSubtotalRupees),
    maxSubtotalPaise: optionalRupeesInputToPaise(form.maxSubtotalRupees),
    shippingChargePaise: rupeesInputToPaise(form.shippingRupees),
    freeAbovePaise: optionalRupeesInputToPaise(form.freeAboveRupees),
    codSurchargeType: form.codFlatRupees.trim() ? "FLAT" : "NONE",
    codSurchargeFlatPaise: optionalRupeesInputToPaise(form.codFlatRupees) ?? 0,
    priority: Number(form.priority) || 100,
    isActive: form.isActive,
  };
}

function paiseToRupeesInput(value?: number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  return Number.isInteger(value / 100) ? String(value / 100) : (value / 100).toFixed(2);
}

function findDuplicateActiveRateCardIds(cards: ShippingRateCardRecord[]) {
  const duplicateIds = new Set<string>();
  const activeCards = cards.filter((card) => card.isActive);

  activeCards.forEach((card, index) => {
    activeCards.slice(index + 1).forEach((other) => {
      if (sameRateCardRoute(card, other)) {
        duplicateIds.add(card.id);
        duplicateIds.add(other.id);
      }
    });
  });

  return duplicateIds;
}

function findRateFormConflict(
  cards: ShippingRateCardRecord[],
  form: RateFormState,
  editingRateCardId: string | null,
) {
  if (!form.isActive) {
    return null;
  }

  const draft = rateFormComparable(form);
  return (
    cards.find((card) => {
      if (!card.isActive || card.id === editingRateCardId) {
        return false;
      }
      return sameComparableRateRoute(draft, rateCardComparable(card));
    }) ?? null
  );
}

function sameRateCardRoute(left: ShippingRateCardRecord, right: ShippingRateCardRecord) {
  return sameComparableRateRoute(rateCardComparable(left), rateCardComparable(right));
}

type ComparableRateRule = {
  deliveryMode: string;
  countryCode: string | null;
  stateCode: string | null;
  cityCode: string | null;
  pincode: string | null;
  localAreaCode: string | null;
  minSubtotalPaise: number | null;
  maxSubtotalPaise: number | null;
};

function rateCardComparable(card: ShippingRateCardRecord): ComparableRateRule {
  return {
    deliveryMode: card.deliveryMode,
    countryCode: normalizeAdminCode(card.countryCode),
    stateCode: normalizeAdminCode(card.stateCode),
    cityCode: normalizeAdminCode(card.cityCode),
    pincode: normalizeAdminCode(card.pincode),
    localAreaCode: normalizeAdminCode(card.localAreaCode),
    minSubtotalPaise: card.minSubtotalPaise ?? null,
    maxSubtotalPaise: card.maxSubtotalPaise ?? null,
  };
}

function rateFormComparable(form: RateFormState): ComparableRateRule {
  return {
    deliveryMode: form.deliveryMode,
    countryCode: normalizeAdminCode(form.countryCode),
    stateCode: normalizeAdminCode(form.stateCode),
    cityCode: normalizeAdminCode(form.cityCode),
    pincode: normalizeAdminCode(form.pincode),
    localAreaCode: normalizeAdminCode(form.localAreaCode),
    minSubtotalPaise: optionalRupeesInputToPaise(form.minSubtotalRupees) ?? null,
    maxSubtotalPaise: optionalRupeesInputToPaise(form.maxSubtotalRupees) ?? null,
  };
}

function sameComparableRateRoute(left: ComparableRateRule, right: ComparableRateRule) {
  return (
    left.deliveryMode === right.deliveryMode &&
    left.countryCode === right.countryCode &&
    left.stateCode === right.stateCode &&
    left.cityCode === right.cityCode &&
    left.pincode === right.pincode &&
    left.localAreaCode === right.localAreaCode &&
    subtotalRangesOverlap(
      left.minSubtotalPaise,
      left.maxSubtotalPaise,
      right.minSubtotalPaise,
      right.maxSubtotalPaise,
    )
  );
}

function subtotalRangesOverlap(
  leftMin: number | null,
  leftMax: number | null,
  rightMin: number | null,
  rightMax: number | null,
) {
  const normalizedLeftMin = leftMin ?? 0;
  const normalizedLeftMax = leftMax ?? Number.MAX_SAFE_INTEGER;
  const normalizedRightMin = rightMin ?? 0;
  const normalizedRightMax = rightMax ?? Number.MAX_SAFE_INTEGER;

  return normalizedLeftMin <= normalizedRightMax && normalizedRightMin <= normalizedLeftMax;
}

function normalizeAdminCode(value?: string | null) {
  return value?.trim() ? value.trim().toUpperCase() : null;
}

function rateCardScopeLabel(card: ShippingRateCardRecord) {
  if (card.localAreaCode) {
    return `Local area ${card.localAreaCode}`;
  }
  if (card.pincode) {
    return `Pincode ${card.pincode}`;
  }
  if (card.cityCode) {
    return `City ${card.cityCode}`;
  }
  if (card.stateCode) {
    return `State ${card.stateCode}`;
  }
  if (card.countryCode) {
    return `Country ${card.countryCode}`;
  }

  return "Global fallback";
}

function rateCardSubtotalLabel(card: ShippingRateCardRecord) {
  if (
    card.minSubtotalPaise !== null &&
    card.minSubtotalPaise !== undefined &&
    card.maxSubtotalPaise !== null &&
    card.maxSubtotalPaise !== undefined
  ) {
    return `${formatPaise(card.minSubtotalPaise)} to ${formatPaise(card.maxSubtotalPaise)}`;
  }
  if (card.minSubtotalPaise !== null && card.minSubtotalPaise !== undefined) {
    return `Above ${formatPaise(card.minSubtotalPaise)}`;
  }
  if (card.maxSubtotalPaise !== null && card.maxSubtotalPaise !== undefined) {
    return `Up to ${formatPaise(card.maxSubtotalPaise)}`;
  }

  return "Any subtotal";
}

function rateCardChargeLabel(card: ShippingRateCardRecord) {
  const parts = [formatPaise(card.shippingChargePaise)];
  if (card.freeAbovePaise !== null && card.freeAbovePaise !== undefined) {
    parts.push(`free above ${formatPaise(card.freeAbovePaise)}`);
  }
  if (card.codSurchargeType === "FLAT" && card.codSurchargeFlatPaise > 0) {
    parts.push(`COD ${formatPaise(card.codSurchargeFlatPaise)}`);
  }
  if (card.codSurchargeType === "PERCENTAGE" && card.codSurchargeBps > 0) {
    parts.push(`COD ${card.codSurchargeBps / 100}%`);
  }

  return parts.join(" / ");
}

function rupeesInputToPaise(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function optionalRupeesInputToPaise(value: string) {
  return value.trim() ? rupeesInputToPaise(value) : undefined;
}

function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function positiveIntegerOrUndefined(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function formatMinor(value: number, currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function settingValue(settings: SettingRecord[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function settingBoolean(settings: SettingRecord[], key: string, fallback: boolean) {
  return readBooleanSettingValue(settingValue(settings, key), fallback);
}

function settingDisplayValue(setting: SettingRecord) {
  if (isSensitiveSettingKey(setting.key)) {
    return setting.value === null || setting.value === undefined || setting.value === ""
      ? "Not set"
      : "Saved value hidden";
  }

  if (setting.value === null || setting.value === undefined || setting.value === "") {
    return "Not set";
  }

  if (typeof setting.value === "string") {
    return truncate(setting.value, 180);
  }

  if (typeof setting.value === "number" || typeof setting.value === "boolean") {
    return String(setting.value);
  }

  try {
    return truncate(JSON.stringify(setting.value), 180);
  } catch {
    return "Stored JSON value";
  }
}

function isSensitiveSettingKey(key: string) {
  return /(secret|password|token|credential|api[_-]?key|access[_-]?key|private[_-]?key|webhook)/i.test(
    key,
  );
}

function emptyStringsToUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, entry === "" ? undefined : entry]),
  );
}

function bannerPayload(form: BannerCreateFormState) {
  return {
    title: form.title,
    subtitle: form.subtitle,
    imageUrl: form.imageUrl,
    linkUrl: form.linkUrl,
    eyebrow: form.eyebrow,
    ctaLabel: form.ctaLabel,
    secondaryCtaLabel: form.secondaryCtaLabel,
    secondaryLinkUrl: form.secondaryLinkUrl,
    mobileImageUrl: form.mobileImageUrl,
    imageAlt: form.imageAlt,
    textPosition: form.textPosition || "LEFT",
    startsAt: dateTimeLocalToIso(form.startsAt),
    endsAt: dateTimeLocalToIso(form.endsAt),
    status: form.status,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function bannerLifecycle(form: BannerCreateFormState): { label: string; tone: StatusTone } {
  if (form.status !== "PUBLISHED") {
    return {
      label: humanize(form.status),
      tone: form.status === "ARCHIVED" ? "danger" : "warning",
    };
  }

  const now = Date.now();
  const startsAt = form.startsAt ? new Date(form.startsAt).getTime() : null;
  const endsAt = form.endsAt ? new Date(form.endsAt).getTime() : null;

  if (startsAt && startsAt > now) {
    return { label: "Scheduled", tone: "info" };
  }

  if (endsAt && endsAt < now) {
    return { label: "Expired", tone: "danger" };
  }

  return { label: "Live", tone: "success" };
}

function isoToDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
