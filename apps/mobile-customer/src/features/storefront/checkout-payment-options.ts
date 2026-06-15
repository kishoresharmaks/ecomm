import type { MobileCheckoutPaymentMethodsResponse } from "./storefront-api";

export type CheckoutPaymentOption = MobileCheckoutPaymentMethodsResponse["methods"][number];

export const fallbackPaymentMethods: CheckoutPaymentOption[] = [
  { method: "COD", label: "Cash on Delivery", enabled: true, note: "Pay when your order is delivered." },
  { method: "MANUAL", label: "Manual Payment", enabled: true, note: "Admin/finance team will verify payment manually." },
];

export function checkoutPaymentOptions(
  data: MobileCheckoutPaymentMethodsResponse | undefined,
  isError: boolean,
) {
  return data?.methods ?? (isError ? [] : fallbackPaymentMethods);
}
