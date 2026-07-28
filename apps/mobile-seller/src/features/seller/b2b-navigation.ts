import { sellerPortalUrl } from "./report-navigation";

export function sellerPortalB2BEnquiriesUrl() {
  return sellerPortalUrl("/seller/b2b-enquiries");
}

export function sellerPortalB2BEnquiryUrl(enquiryId: string) {
  return sellerPortalUrl(`/seller/b2b-enquiries/${encodeURIComponent(enquiryId)}`);
}

export function sellerPortalB2BOrdersUrl() {
  return sellerPortalUrl("/seller/b2b-orders");
}

export function sellerPortalB2BOrderUrl(orderNumber: string) {
  return sellerPortalUrl(`/seller/b2b-orders/${encodeURIComponent(orderNumber)}`);
}
