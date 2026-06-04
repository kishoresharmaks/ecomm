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
