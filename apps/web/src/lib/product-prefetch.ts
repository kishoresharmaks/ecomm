import type { QueryClient } from "@tanstack/react-query";
import { getProduct } from "./storefront-api";

/**
 * Instant product-detail navigation:
 * 1. seed the ["product", slug] cache with the summary the list/card already
 *    has (updatedAt: 0 marks it stale so it never suppresses a refetch), then
 * 2. prefetch the full record in the background.
 * The detail client renders the seed immediately and react-query swaps in the
 * fresh response when it lands (stale-while-revalidate).
 */
export function primeProductDetail(queryClient: QueryClient, product: { slug?: string | null }) {
  const slug = product.slug;
  if (!slug) {
    return;
  }

  const queryKey = ["product", slug];
  if (!queryClient.getQueryData(queryKey)) {
    queryClient.setQueryData(queryKey, product, { updatedAt: 0 });
  }
  void queryClient.prefetchQuery({
    queryKey,
    queryFn: () => getProduct(slug),
    staleTime: 15_000,
  });
}
