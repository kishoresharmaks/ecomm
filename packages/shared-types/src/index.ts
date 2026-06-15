export const platformRoles = ["customer", "seller", "business_buyer", "admin"] as const;
export type PlatformRole = (typeof platformRoles)[number];

export * from "./product-essentials";
export * from "./product-lifecycle";

export const sellerTypes = [
  "MARKETPLACE_SELLER",
  "HYPERLOCAL_STORE",
  "WHOLESALE_DISTRIBUTOR"
] as const;
export type SellerType = (typeof sellerTypes)[number];

export const sellerStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SUSPENDED"
] as const;
export type SellerStatus = (typeof sellerStatuses)[number];

export const productApprovalStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED"
] as const;
export type ProductApprovalStatus = (typeof productApprovalStatuses)[number];

export const orderStatuses = [
  "PLACED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED"
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const paymentStatuses = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "NOT_REQUIRED"
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const deliveryStatuses = [
  "NOT_ASSIGNED",
  "PENDING",
  "PACKED",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED"
] as const;
export type DeliveryStatus = (typeof deliveryStatuses)[number];

export const deliveryModes = [
  "STORE_PICKUP",
  "LOCAL_DELIVERY_PARTNER",
  "THIRD_PARTY_COURIER"
] as const;
export type DeliveryMode = (typeof deliveryModes)[number];

export const b2bEnquiryStatuses = [
  "SUBMITTED",
  "IN_REVIEW",
  "RESPONDED",
  "BUYER_CONFIRMED",
  "ADMIN_APPROVED",
  "FINALISED",
  "CLOSED",
  "CANCELLED"
] as const;
export type B2BEnquiryStatus = (typeof b2bEnquiryStatuses)[number];

export const supportRequestTopics = [
  "ORDER",
  "PAYMENT",
  "DELIVERY",
  "SELLER",
  "B2B",
  "DOWNLOAD_APP",
  "GENERAL"
] as const;
export type SupportRequestTopic = (typeof supportRequestTopics)[number];

export const supportRequesterTypes = [
  "CUSTOMER",
  "SELLER",
  "BUSINESS_BUYER",
  "DELIVERY_PARTNER",
  "GUEST"
] as const;
export type SupportRequesterType = (typeof supportRequesterTypes)[number];

export const supportContactChannels = ["EMAIL", "PHONE", "WHATSAPP"] as const;
export type SupportContactChannel = (typeof supportContactChannels)[number];

export const supportRequestSources = [
  "WEB_CONTACT",
  "WEB_ACCOUNT_SUPPORT",
  "WEB_SELLER_SUPPORT",
  "WEB_B2B_SUPPORT",
  "API",
  "MOBILE_APP"
] as const;
export type SupportRequestSource = (typeof supportRequestSources)[number];

export const publicSupportRequestSources = ["WEB_CONTACT", "WEB_ACCOUNT_SUPPORT"] as const;
export type PublicSupportRequestSource = (typeof publicSupportRequestSources)[number];

export type Money = {
  amountPaise: number;
  currency: "INR";
};

export type ApiEnvelope<T> = {
  ok: true;
  data: T;
  requestId?: string;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
};
