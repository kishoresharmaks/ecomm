import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type MaintenanceScope = "storefront" | "seller" | "delivery";

export type MaintenanceScopeSetting = {
  scope: MaintenanceScope;
  enabled: boolean;
  message: string;
  eta: string;
};

export type AdminPreviewState = {
  isAuthenticated: boolean;
  roles?: string[];
};

const staffPreviewRoles = new Set(["ADMIN", "FINANCE", "COURIER_MANAGER"]);
const storefrontShoppingExactPaths = new Set(["/", "/cart", "/checkout", "/track-order", "/deals"]);
const storefrontShoppingPrefixes = ["/categories", "/products", "/stores", "/checkout/success", "/deals"];

export function getMaintenanceSettings() {
  return indihubFetch<MaintenanceScopeSetting[]>("/api/settings/maintenance");
}

export function upsertMaintenanceSettings(
  authHeaders: IndihubAuthHeaders,
  scopes: MaintenanceScopeSetting[],
) {
  return indihubFetch<MaintenanceScopeSetting[]>(
    "/api/admin/settings/maintenance",
    {
      method: "PUT",
      body: JSON.stringify({ scopes }),
    },
    authHeaders,
  );
}

export function maintenanceForScope(
  settings: MaintenanceScopeSetting[] | undefined,
  scope: MaintenanceScope,
) {
  return settings?.find((setting) => setting.scope === scope) ?? null;
}

export function isStorefrontMaintenancePath(pathname: string) {
  const normalized = normalizePathname(pathname);
  return (
    storefrontShoppingExactPaths.has(normalized) ||
    storefrontShoppingPrefixes.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    )
  );
}

export function isDeliveryMaintenancePath(pathname: string) {
  const normalized = normalizePathname(pathname);
  return normalized === "/delivery" || (normalized.startsWith("/delivery/") && normalized !== "/delivery/register");
}

export function canBypassMaintenancePreview(
  searchParams: URLSearchParams,
  admin: AdminPreviewState,
) {
  if (searchParams.get("maintenance_preview") !== "1" || !admin.isAuthenticated) {
    return false;
  }

  return Boolean(admin.roles?.some((role) => staffPreviewRoles.has(role)));
}

export function normalizeMaintenanceScope(
  scope: MaintenanceScope,
  input?: Partial<MaintenanceScopeSetting>,
): MaintenanceScopeSetting {
  return {
    scope,
    enabled: Boolean(input?.enabled),
    message: publicText(input?.message, defaultMaintenanceMessage(scope), 240),
    eta: publicText(input?.eta, "", 160),
  };
}

function publicText(value: unknown, fallback: string, maxLength: number) {
  return (typeof value === "string" && value.trim() ? value.trim() : fallback).slice(0, maxLength);
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const cleanPath = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  return cleanPath.length > 1 && cleanPath.endsWith("/") ? cleanPath.slice(0, -1) : cleanPath;
}

function defaultMaintenanceMessage(scope: MaintenanceScope) {
  switch (scope) {
    case "seller":
      return "Seller Center is under maintenance. Please check back shortly.";
    case "delivery":
      return "Delivery Partner workspace is under maintenance. Please check back shortly.";
    default:
      return "We are updating the shopping experience. Please check back shortly.";
  }
}
