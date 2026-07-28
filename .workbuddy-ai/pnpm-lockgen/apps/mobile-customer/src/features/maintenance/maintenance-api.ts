import { getJson } from "../../lib/api";

export type MaintenanceScope = "storefront" | "seller" | "delivery";

export type MaintenanceScopeSetting = {
  scope: MaintenanceScope;
  enabled: boolean;
  message: string;
  eta: string;
};

export function getMaintenanceSettings() {
  return getJson<MaintenanceScopeSetting[]>({ path: "/settings/maintenance" });
}

export function getStorefrontMaintenance(settings: MaintenanceScopeSetting[] | undefined | null) {
  return settings?.find((setting) => setting.scope === "storefront") ?? null;
}
