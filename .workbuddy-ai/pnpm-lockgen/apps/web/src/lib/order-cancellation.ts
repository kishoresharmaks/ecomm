const dispatchedSellerStatuses = new Set(["DISPATCHED", "DELIVERED"]);
const dispatchedDeliveryStatuses = new Set(["DISPATCHED", "IN_TRANSIT", "DELIVERED"]);
const dispatchedOrderStatuses = new Set(["SHIPPED", "DELIVERED"]);

export const dispatchedCancellationMessage =
  "This order has already been dispatched. Please contact support for cancellation or refund help.";

export type CancellationOrderSnapshot = {
  orderStatus?: string | null;
  deliveryStatus?: string | null;
  deliveryDetail?: {
    status?: string | null;
  } | null;
  sellerSplits?: Array<{
    sellerStatus?: string | null;
  }> | null;
  shipments?: Array<{
    status?: string | null;
  }> | null;
};

export function hasOrderLeftSeller(order: CancellationOrderSnapshot) {
  return (
    isDispatchedOrderStatus(order.orderStatus) ||
    isDispatchedDeliveryStatus(order.deliveryStatus) ||
    isDispatchedDeliveryStatus(order.deliveryDetail?.status) ||
    Boolean(order.sellerSplits?.some((split) => isDispatchedSellerStatus(split.sellerStatus))) ||
    Boolean(order.shipments?.some((shipment) => isDispatchedDeliveryStatus(shipment.status)))
  );
}

export function canCustomerSelfCancelOrder(order: CancellationOrderSnapshot) {
  return (
    order.orderStatus !== "CANCELLED" &&
    order.orderStatus !== "DELIVERED" &&
    order.deliveryStatus !== "DELIVERED" &&
    !hasOrderLeftSeller(order)
  );
}

export function customerCancellationUnavailableReason(order: CancellationOrderSnapshot) {
  if (hasOrderLeftSeller(order)) {
    return dispatchedCancellationMessage;
  }

  return "Cancellation is no longer available for this order status.";
}

function isDispatchedOrderStatus(status?: string | null) {
  return status ? dispatchedOrderStatuses.has(status) : false;
}

function isDispatchedSellerStatus(status?: string | null) {
  return status ? dispatchedSellerStatuses.has(status) : false;
}

function isDispatchedDeliveryStatus(status?: string | null) {
  return status ? dispatchedDeliveryStatuses.has(status) : false;
}
