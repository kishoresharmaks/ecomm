import { indihubFetch, type IndihubAuthHeaders } from "./api";
import type { ProductSummary, SellerSummary } from "./storefront-api";

export type CouponStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
export type CouponFundingSource = "PLATFORM" | "SELLER";
export type CouponSellerParticipationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REMOVED";

export type CouponParticipation = {
  id: string;
  couponId: string;
  sellerId: string;
  status: CouponSellerParticipationStatus;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  removedAt?: string | null;
  lockedAt?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  seller?: SellerSummary & {
    user?: { email?: string | null; fullName?: string | null } | null;
  };
};

export type Coupon = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: CouponStatus;
  discountType: CouponDiscountType;
  fundingSource: CouponFundingSource;
  discountValueBps?: number | null;
  discountAmountPaise?: number | null;
  maxDiscountPaise?: number | null;
  minSubtotalPaise?: number | null;
  maxSubtotalPaise?: number | null;
  totalUsageLimit?: number | null;
  perCustomerLimit?: number | null;
  redeemedCount: number;
  firstOrderOnly: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  activatedAt?: string | null;
  pausedAt?: string | null;
  archivedAt?: string | null;
  internalNote?: string | null;
  sellerEligibilities?: Array<{ sellerId: string; seller?: SellerSummary }>;
  productEligibilities?: Array<{ productId: string; product?: ProductSummary }>;
  categoryEligibilities?: Array<{ categoryId: string; category?: { id: string; name: string; slug: string } }>;
  customerEligibilities?: Array<{ customerId: string; customer?: { user?: { email?: string | null; fullName?: string | null } | null } }>;
  sellerParticipations?: CouponParticipation[];
  _count?: {
    redemptions?: number;
    orders?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CouponPayload = {
  code: string;
  title: string;
  description?: string | null;
  discountType: CouponDiscountType;
  fundingSource: CouponFundingSource;
  discountValueBps?: number;
  discountAmountPaise?: number;
  maxDiscountPaise?: number;
  minSubtotalPaise?: number;
  maxSubtotalPaise?: number;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  firstOrderOnly?: boolean;
  startsAt?: string;
  endsAt?: string;
  internalNote?: string;
  sellerIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
  customerIds?: string[];
};

export type CouponPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
  stats?: {
    total: number;
    active: number;
    scheduled: number;
    paused: number;
    archived: number;
    redeemed: number;
  };
};

export type CouponRedemption = {
  id: string;
  couponId: string;
  orderId: string;
  customerId: string;
  codeSnapshot: string;
  titleSnapshot: string;
  status: string;
  discountPaise: number;
  platformFundedDiscountPaise: number;
  sellerFundedDiscountPaise: number;
  createdAt?: string;
  order?: { orderNumber: string; totalPaise: number; currency: string };
  customer?: { user?: { email?: string | null; fullName?: string | null } | null };
};

export type SellerCouponParticipation = CouponParticipation & {
  coupon: Coupon & {
    redemptions?: CouponRedemption[];
  };
};

export function listAdminCoupons(
  auth: IndihubAuthHeaders,
  query: { status?: CouponStatus; fundingSource?: CouponFundingSource; search?: string; page?: number; limit?: number } = {},
) {
  return indihubFetch<CouponPage<Coupon>>(`/api/admin/coupons${queryString(query)}`, undefined, auth);
}

export function getAdminCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<Coupon>(`/api/admin/coupons/${encodeURIComponent(couponId)}`, undefined, auth);
}

export function createAdminCoupon(auth: IndihubAuthHeaders, payload: CouponPayload) {
  return indihubFetch<Coupon>("/api/admin/coupons", { method: "POST", body: JSON.stringify(payload) }, auth);
}

export function updateAdminCoupon(auth: IndihubAuthHeaders, couponId: string, payload: Partial<CouponPayload>) {
  return indihubFetch<Coupon>(`/api/admin/coupons/${encodeURIComponent(couponId)}`, { method: "PATCH", body: JSON.stringify(payload) }, auth);
}

export function activateAdminCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<Coupon>(`/api/admin/coupons/${encodeURIComponent(couponId)}/activate`, { method: "POST" }, auth);
}

export function pauseAdminCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<Coupon>(`/api/admin/coupons/${encodeURIComponent(couponId)}/pause`, { method: "POST" }, auth);
}

export function archiveAdminCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<Coupon>(`/api/admin/coupons/${encodeURIComponent(couponId)}/archive`, { method: "POST" }, auth);
}

export function listCouponRedemptions(auth: IndihubAuthHeaders, couponId: string, cursor?: string | null) {
  return indihubFetch<CouponPage<CouponRedemption>>(
    `/api/admin/coupons/${encodeURIComponent(couponId)}/redemptions${queryString({
      limit: 50,
      cursor: cursor ?? undefined,
    })}`,
    undefined,
    auth,
  );
}

export function listSellerCoupons(auth: IndihubAuthHeaders, query: { participationStatus?: CouponSellerParticipationStatus } = {}) {
  return indihubFetch<{ items: SellerCouponParticipation[] }>(`/api/seller/coupons${queryString(query)}`, undefined, auth);
}

export function acceptSellerCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<CouponParticipation>(`/api/seller/coupons/${encodeURIComponent(couponId)}/accept`, { method: "POST" }, auth);
}

export function declineSellerCoupon(auth: IndihubAuthHeaders, couponId: string) {
  return indihubFetch<CouponParticipation>(`/api/seller/coupons/${encodeURIComponent(couponId)}/decline`, { method: "POST" }, auth);
}

function queryString(query: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.size ? `?${params.toString()}` : "";
}
