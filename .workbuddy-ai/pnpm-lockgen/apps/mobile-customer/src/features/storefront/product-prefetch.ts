import type { QueryClient } from "@tanstack/react-query";
import { getProduct } from "./storefront-api";

/**
 * Instant product-detail navigation:
 * 1. seed the detail cache with the summary the list screen already has
 *    (marked stale via updatedAt: 0 so it never suppresses a refetch), then
 * 2. start fetching the full record in the background.
 * The detail screen renders the seed immediately and react-query replaces it
 * when the fresh response lands.
 */
export function primeProductDetail(queryClient: QueryClient, product: { slug?: string | null }) {
  const slug = product.slug;
  if (!slug) {
    return;
  }

  const queryKey = ["mobile-product", slug];
  if (!queryClient.getQueryData(queryKey)) {
    queryClient.setQueryData(queryKey, product, { updatedAt: 0 });
  }
  void queryClient.prefetchQuery({
    queryKey,
    queryFn: () => getProduct(slug),
    staleTime: 15_000,
  });
}
