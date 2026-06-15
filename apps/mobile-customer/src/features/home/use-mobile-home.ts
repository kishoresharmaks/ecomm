import { useQuery } from "@tanstack/react-query";
import { getJson } from "../../lib/api";
import type { MobileHome } from "../../types/mobile-home";
import type { SelectedLocation } from "../../types/storefront";

export function useMobileHome(location?: SelectedLocation) {
  return useQuery({
    queryKey: ["mobile-home", location?.countryCode, location?.stateCode, location?.cityCode, location?.localAreaCode, location?.pincode],
    queryFn: () =>
      getJson<MobileHome>({
        path: "/mobile/storefront/home",
        searchParams: {
          limit: 8,
          countryCode: location?.countryCode,
          stateCode: location?.stateCode,
          cityCode: location?.cityCode,
          localAreaCode: location?.localAreaCode,
          pincode: location?.pincode,
        },
      }),
  });
}
