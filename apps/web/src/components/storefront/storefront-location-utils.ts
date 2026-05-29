import type { CustomerAddress } from "@/lib/account-api";
import type {
  SellerAddress,
  StoreLocationMatchLevel,
  StoreLocationQuery,
  StoreProfile,
} from "@/lib/storefront-api";

export type StorefrontBrowsingLocation = {
  countryCode: string;
  countryName: string;
  stateCode?: string;
  stateName?: string;
  cityCode?: string;
  cityName?: string;
  localAreaCode?: string;
  areaName?: string;
  pincode?: string;
};

export function defaultBrowsingLocationFromAddresses(
  addresses: CustomerAddress[] | undefined,
): StorefrontBrowsingLocation | null {
  const address = addresses?.find((item) => item.isDefault) ?? addresses?.[0];
  if (!address) {
    return null;
  }

  return normalizeBrowsingLocation({
    countryCode: address.countryCode ?? "IN",
    countryName: address.country ?? "India",
    ...(address.stateCode ? { stateCode: address.stateCode } : {}),
    ...(address.state ? { stateName: address.state } : {}),
    ...(address.cityCode ? { cityCode: address.cityCode } : {}),
    ...(address.city ? { cityName: address.city } : {}),
    ...(address.localAreaCode ? { localAreaCode: address.localAreaCode } : {}),
    ...(address.area ? { areaName: address.area } : {}),
    ...(address.pincode ? { pincode: address.pincode } : {}),
  });
}

export function normalizeBrowsingLocation(
  location: Partial<StorefrontBrowsingLocation> | null | undefined,
): StorefrontBrowsingLocation | null {
  const countryCode = location?.countryCode?.trim().toUpperCase();
  if (!countryCode) {
    return null;
  }

  return {
    countryCode,
    countryName: location?.countryName?.trim() || countryCode,
    ...(location?.stateCode?.trim()
      ? { stateCode: location.stateCode.trim().toUpperCase() }
      : {}),
    ...(location?.stateName?.trim() ? { stateName: location.stateName.trim() } : {}),
    ...(location?.cityCode?.trim() ? { cityCode: location.cityCode.trim().toUpperCase() } : {}),
    ...(location?.cityName?.trim() ? { cityName: location.cityName.trim() } : {}),
    ...(location?.localAreaCode?.trim()
      ? { localAreaCode: location.localAreaCode.trim().toUpperCase() }
      : {}),
    ...(location?.areaName?.trim() ? { areaName: location.areaName.trim() } : {}),
    ...(location?.pincode?.trim() ? { pincode: location.pincode.trim() } : {}),
  };
}

export function browsingLocationLabel(
  location: Partial<StorefrontBrowsingLocation> | null | undefined,
) {
  if (!location) {
    return "All stores";
  }

  const parts = [location.areaName, location.cityName, location.stateName, location.countryName]
    .map((value) => value?.trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : location.countryCode ?? "All stores";
}

export function browsingLocationHeadline(
  location: Partial<StorefrontBrowsingLocation> | null | undefined,
) {
  if (!location) {
    return "Across 1HandIndia";
  }

  return location.cityName?.trim() || location.stateName?.trim() || location.countryName?.trim() || "your market";
}

export function browsingLocationQuery(
  location: StorefrontBrowsingLocation | null | undefined,
  limit?: number,
): StoreLocationQuery {
  if (!location) {
    return limit ? { limit } : {};
  }

  return {
    countryCode: location.countryCode,
    ...(location.stateCode ? { stateCode: location.stateCode } : {}),
    ...(location.cityCode ? { cityCode: location.cityCode } : {}),
    ...(location.localAreaCode ? { localAreaCode: location.localAreaCode } : {}),
    ...(location.pincode ? { pincode: location.pincode } : {}),
    ...(limit ? { limit } : {}),
  };
}

export function splitStoresByLocationMatch(stores: StoreProfile[]) {
  return {
    localStores: stores.filter((store) => store.locationMatchLevel && store.locationMatchLevel !== "NONE"),
    broaderStores: stores.filter((store) => !store.locationMatchLevel || store.locationMatchLevel === "NONE"),
  };
}

export function locationMatchLabel(level: StoreLocationMatchLevel | undefined) {
  switch (level) {
    case "LOCAL_AREA":
      return "In your area";
    case "CITY":
      return "Same city";
    case "STATE":
      return "Same state";
    case "COUNTRY":
      return "Same country";
    default:
      return "Marketplace";
  }
}

export function sellerLocationLabel(address?: SellerAddress | null) {
  if (!address) {
    return "Location not listed";
  }

  const parts = [address.area, address.city, address.state].filter(Boolean);
  return parts.length ? parts.join(", ") : address.country ?? address.countryCode ?? "Location not listed";
}
