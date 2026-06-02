import { BadRequestException } from "@nestjs/common";
import { DeliveryMode } from "@indihub/database";
import type { CheckoutCharges } from "./checkout-pricing.service";
import { CheckoutDeliveryPreference } from "./dto/delivery-routing.dto";

export function assertCheckoutDeliveryServiceable(
  charges: Pick<CheckoutCharges, "deliveryRouting">,
  options: {
    addressProvided: boolean;
    deliveryPreference?: CheckoutDeliveryPreference | null;
  },
) {
  const quote = charges.deliveryRouting;
  if (!quote || !options.addressProvided) {
    return;
  }

  if (
    options.deliveryPreference === CheckoutDeliveryPreference.STORE_PICKUP ||
    quote.deliveryMode === DeliveryMode.STORE_PICKUP
  ) {
    return;
  }

  if (quote.routingFailed) {
    throw new BadRequestException(checkoutDeliveryUnavailableMessage(quote.routingFailureNote));
  }
}

export function checkoutDeliveryUnavailableMessage(note?: string | null) {
  const detail = note?.trim();
  return detail
    ? `This delivery address is not serviceable yet. ${detail} Choose another address or contact support.`
    : "This delivery address is not serviceable yet. Choose another address or contact support.";
}
