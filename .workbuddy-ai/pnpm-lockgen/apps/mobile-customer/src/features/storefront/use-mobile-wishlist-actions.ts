import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useMobileCustomerAuth } from "../../auth/mobile-auth-context";
import { addWishlistItem, getWishlist, removeWishlistItem } from "./storefront-api";

type WishlistToggleInput = {
  productId: string;
  wished: boolean;
};

export function useMobileWishlistActions() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const wishlistQuery = useQuery({
    queryKey: ["mobile-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    staleTime: 30_000,
  });
  const productIds = useMemo(
    () => new Set((wishlistQuery.data?.items ?? []).map((item) => item.productId)),
    [wishlistQuery.data?.items],
  );

  const mutation = useMutation({
    mutationFn: async ({ productId, wished }: WishlistToggleInput) => {
      if (wished) {
        await removeWishlistItem(customerAuth.authHeaders, productId);
        return;
      }

      await addWishlistItem(customerAuth.authHeaders, productId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-wishlist", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-account-profile", customerAuth.authKey] }),
      ]);
    },
    onSettled: () => setPendingProductId(null),
  });

  function toggleWishlist(productId: string) {
    if (customerAuth.status === "loading" || customerAuth.status === "syncing" || mutation.isPending) {
      return;
    }
    if (!customerAuth.enabled) {
      router.push("/auth/sign-in");
      return;
    }

    setPendingProductId(productId);
    mutation.mutate({ productId, wished: productIds.has(productId) });
  }

  return {
    isPending: (productId: string) => pendingProductId === productId,
    isWished: (productId: string) => productIds.has(productId),
    pendingProductId,
    toggleWishlist,
    wishlistQuery,
  };
}
