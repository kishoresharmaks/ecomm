import { useQuery } from "@tanstack/react-query";
import { listStorefrontPopupAnnouncements } from "./storefront-api";

export function useMobilePopupAnnouncements() {
  return useQuery({
    queryKey: ["mobile-cms-popup-announcements"],
    queryFn: listStorefrontPopupAnnouncements,
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
