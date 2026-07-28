export const serviceKeys = {
  list: (search: string, locationKey: string | null) => ["mobile-services", search, locationKey] as const,
  detail: (slug: string, locationKey: string | null) => ["mobile-service", slug, locationKey] as const,
  bookings: (authKey: string, status: string | null) => ["mobile-service-bookings", authKey, status] as const,
  booking: (authKey: string, bookingNumber: string) => ["mobile-service-booking", authKey, bookingNumber] as const,
};
