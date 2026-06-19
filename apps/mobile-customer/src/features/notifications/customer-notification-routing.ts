import { router, type Href } from "expo-router";

export type CustomerNotificationRoutePayload = {
  href?: unknown;
  orderNumber?: unknown;
  productSlug?: unknown;
  storeSlug?: unknown;
};

const allowedHrefPatterns = [
  /^\/deals$/,
  /^\/orders\/[A-Za-z0-9._-]+$/,
  /^\/products?\/[A-Za-z0-9._-]+$/,
  /^\/stores?\/[A-Za-z0-9._-]+$/,
  /^\/categories?\/[A-Za-z0-9._-]+$/,
];

export function isAllowedCustomerNotificationHref(value: unknown): value is string {
  return typeof value === "string" && allowedHrefPatterns.some((pattern) => pattern.test(value.trim()));
}

export function routeForCustomerNotification(data?: CustomerNotificationRoutePayload | null): Href {
  if (isAllowedCustomerNotificationHref(data?.href)) {
    return data.href.trim() as Href;
  }
  if (typeof data?.orderNumber === "string" && data.orderNumber.trim()) {
    return `/orders/${encodeURIComponent(data.orderNumber.trim())}` as Href;
  }
  if (typeof data?.productSlug === "string" && data.productSlug.trim()) {
    return `/product/${encodeURIComponent(data.productSlug.trim())}` as Href;
  }
  if (typeof data?.storeSlug === "string" && data.storeSlug.trim()) {
    return `/store/${encodeURIComponent(data.storeSlug.trim())}` as Href;
  }
  return "/account/notifications" as Href;
}

export function openCustomerNotification(data?: CustomerNotificationRoutePayload | null) {
  router.push(routeForCustomerNotification(data) as never);
}
