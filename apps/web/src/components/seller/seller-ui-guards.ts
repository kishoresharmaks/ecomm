import { IndihubApiError } from "../../lib/api";
import type { SellerCapability, SellerProfile } from "../../lib/seller-api";

export function sellerCapabilities(profile?: SellerProfile | null): SellerCapability[] {
  if (!profile) return [];
  if (profile.enabledCapabilities?.length) return profile.enabledCapabilities;
  return profile.primaryCapability ? [profile.primaryCapability] : ["RETAIL"];
}

export function sellerHasCapability(profile: SellerProfile | null | undefined, capability: SellerCapability) {
  return sellerCapabilities(profile).includes(capability);
}

export function requiredSellerCapability(pathname: string): SellerCapability | null {
  if (
    [
      "/seller/products",
      "/seller/orders",
      "/seller/returns",
      "/seller/deals",
      "/seller/coupons",
      "/seller/reviews",
      "/seller/b2b-enquiries",
      "/seller/b2b-orders",
      "/seller/reports/sales",
      "/seller/reports/inventory",
      "/seller/reports/returns",
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) return "RETAIL";

  if (
    [
      "/seller/services",
      "/seller/service-bookings",
      "/seller/service-calendar",
      "/seller/service-reviews",
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) return "SERVICE";

  return null;
}

export function isSellerOnboardingRequiredError(error: unknown) {
  return error instanceof IndihubApiError && (
    error.status === 404 ||
    (error.status === 403 && /seller (profile|account|access) (is )?required|do not have permission to access this resource/i.test(error.message))
  );
}
