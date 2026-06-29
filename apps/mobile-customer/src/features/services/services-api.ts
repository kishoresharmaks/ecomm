import { getJson, patchJson, postJson, type MobileAuthHeaders } from "../../lib/api";
import type { SelectedLocation } from "../../types/storefront";
import {
  mapPaginatedServiceBookings,
  mapPaginatedServices,
  mapServiceBooking,
  mapServiceListing,
  mapServiceReview,
} from "./mappers";
import type {
  BackendCreateServiceBookingPayload,
  BackendPaginatedServiceBookings,
  BackendPaginatedServices,
  BackendServiceBooking,
  BackendServiceListing,
  BackendServiceReview,
  BackendBookingStatus,
} from "./types";

export type MobileServiceListQuery = {
  search?: string;
  location?: SelectedLocation | null;
  limit?: number;
  page?: number;
};

export function listPublicServices(query: MobileServiceListQuery = {}) {
  return getJson<BackendPaginatedServices>({
    path: "/services",
    searchParams: {
      search: query.search,
      page: query.page,
      limit: query.limit ?? 20,
      ...locationParams(query.location),
    },
  }).then(mapPaginatedServices);
}

export function getPublicService(slug: string, location?: SelectedLocation | null) {
  return getJson<BackendServiceListing>({
    path: `/services/${encodeURIComponent(slug)}`,
    searchParams: locationParams(location),
  }).then(mapServiceListing);
}

export function createCustomerServiceBooking(auth: MobileAuthHeaders, payload: BackendCreateServiceBookingPayload) {
  return postJson<BackendServiceBooking>({
    path: "/account/service-bookings",
    auth,
    body: payload,
  }).then(mapServiceBooking);
}

export function listCustomerServiceBookings(
  auth: MobileAuthHeaders,
  query: { status?: BackendBookingStatus; page?: number; limit?: number } = {},
) {
  return getJson<BackendPaginatedServiceBookings>({
    path: "/account/service-bookings",
    auth,
    searchParams: {
      status: query.status,
      page: query.page,
      limit: query.limit ?? 50,
    },
  }).then(mapPaginatedServiceBookings);
}

export function getCustomerServiceBooking(auth: MobileAuthHeaders, bookingNumber: string) {
  return getJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}`,
    auth,
  }).then(mapServiceBooking);
}

export function cancelCustomerServiceBooking(auth: MobileAuthHeaders, bookingNumber: string, payload: { reason: string }) {
  return patchJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/cancel`,
    auth,
    body: payload,
  }).then(mapServiceBooking);
}

export function acceptCustomerServiceQuote(auth: MobileAuthHeaders, bookingNumber: string) {
  return patchJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/quotes/accept`,
    auth,
  }).then(mapServiceBooking);
}

export function rejectCustomerServiceQuote(auth: MobileAuthHeaders, bookingNumber: string) {
  return patchJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/quotes/reject`,
    auth,
  }).then(mapServiceBooking);
}

export function confirmCustomerServiceCompletion(auth: MobileAuthHeaders, bookingNumber: string) {
  return patchJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/confirm-completion`,
    auth,
  }).then(mapServiceBooking);
}

export function raiseCustomerServiceDispute(
  auth: MobileAuthHeaders,
  bookingNumber: string,
  payload: { reason: string; evidence?: string[] },
) {
  return postJson<BackendServiceBooking>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/disputes`,
    auth,
    body: payload,
  }).then(mapServiceBooking);
}

export function createCustomerServiceReview(
  auth: MobileAuthHeaders,
  bookingNumber: string,
  payload: { rating: number; body?: string },
) {
  return postJson<BackendServiceReview>({
    path: `/account/service-bookings/${encodeURIComponent(bookingNumber)}/reviews`,
    auth,
    body: payload,
  }).then(mapServiceReview);
}

function locationParams(location?: SelectedLocation | null) {
  return {
    countryCode: location?.countryCode,
    stateCode: location?.stateCode,
    cityCode: location?.cityCode,
    localAreaCode: location?.localAreaCode,
    pincode: location?.pincode,
  };
}
