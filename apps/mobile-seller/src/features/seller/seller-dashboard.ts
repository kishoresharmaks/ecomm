import type { SellerProfile, SellerSalesReport } from "./seller-api";

export type SellerDashboardMode = "retail" | "service" | "hybrid";

export function sellerDashboardMode(
  profile: Pick<SellerProfile, "enabledCapabilities" | "primaryCapability" | "sellerType"> | undefined,
  report: Pick<SellerSalesReport, "seller"> | undefined,
): SellerDashboardMode {
  const capabilities =
    report?.seller?.enabledCapabilities?.length
      ? report.seller.enabledCapabilities
      : report?.seller?.primaryCapability
        ? [report.seller.primaryCapability]
        : profile?.enabledCapabilities?.length
          ? profile.enabledCapabilities
          : profile?.primaryCapability
            ? [profile.primaryCapability]
            : profile?.sellerType === "SERVICE_PROVIDER"
              ? ["SERVICE" as const]
              : ["RETAIL" as const];

  const hasRetail = capabilities.includes("RETAIL");
  const hasService = capabilities.includes("SERVICE");
  if (hasRetail && hasService) return "hybrid";
  return hasService ? "service" : "retail";
}
