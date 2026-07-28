import type { PlaceOrderPayload } from "@/lib/storefront-api";

export type CustomerDeliveryPreference = NonNullable<PlaceOrderPayload["deliveryPreference"]>;

export type CustomerDeliveryOption = {
  preference: CustomerDeliveryPreference;
  label: string;
  description: string;
};

export const customerDeliveryOptions: CustomerDeliveryOption[] = [
  {
    preference: "STORE_PICKUP",
    label: "Store pickup",
    description: "Collect from the seller or store after pickup details are confirmed."
  },
  {
    preference: "DELIVER_TO_ADDRESS",
    label: "Deliver to address",
    description: "We choose the best available local delivery partner or courier for this address."
  }
];

export function customerDeliveryModeLabel(mode?: string | null) {
  if (!mode) {
    return "Not assigned";
  }

  if (mode === "STORE_PICKUP") {
    return "Store pickup";
  }

  if (mode === "LOCAL_DELIVERY_PARTNER") {
    return "Local delivery partner";
  }

  if (mode === "THIRD_PARTY_COURIER" || mode === "MANUAL_COURIER") {
    return "Courier delivery";
  }

  if (mode === "MANUAL_TRANSPORT") {
    return "Manual transport";
  }

  if (mode === "SELLER_SELF_DELIVERY") {
    return "Local delivery partner";
  }

  return mode.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
