import { useQuery } from "@tanstack/react-query";
import { listStorefrontAnnouncements } from "./storefront-api";

export function useMobileAnnouncements() {
  return useQuery({
    queryKey: ["mobile-cms-announcements"],
    queryFn: listStorefrontAnnouncements,
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
