"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { addWishlistItem, getWishlist, removeWishlistItem } from "@/lib/account-api";
import { capturePostHogEvent, capturePostHogException, isPostHogConfigured, posthog } from "@/lib/posthog-client";

type WishlistMutationArgs = {
  action: "add" | "remove";
  productId: string;
  productName?: string | undefined;
  price?: number | undefined;
};

export function useStorefrontWishlist() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();

  const wishlistQuery = useQuery({
    queryKey: ["account-wishlist", customerAuth.authKey],
    queryFn: () => getWishlist(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false,
    staleTime: 30_000,
  });

  const wishlistIds = useMemo(
    () => new Set((wishlistQuery.data?.items ?? []).map((item) => item.productId)),
    [wishlistQuery.data?.items],
  );

  const wishlistMutation = useMutation({
    mutationFn: ({ action, productId }: WishlistMutationArgs) => {
      if (action === "remove") {
        return removeWishlistItem(customerAuth.authHeaders, productId);
      }

      return addWishlistItem(customerAuth.authHeaders, productId);
    },
    onSuccess: (_wishlist, variables) => {
      if (variables.action === "add" && isPostHogConfigured()) {
        posthog.capture("wishlist_added", {
          product_id: variables.productId,
          product_name: variables.productName ?? "",
          price: variables.price ?? 0,
          currency: "INR",
        });
      }
      capturePostHogEvent("product_wishlist_updated", {
        action: variables.action,
        product_id: variables.productId,
      });
      void queryClient.invalidateQueries({ queryKey: ["account-wishlist", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => capturePostHogException(error),
  });

  async function toggleWishlist(
    productId: string,
    details?: { productName?: string; price?: number },
  ) {
    if (!customerAuth.enabled) {
      throw new Error("Sign in before using wishlist actions.");
    }

    const action: WishlistMutationArgs["action"] = wishlistIds.has(productId) ? "remove" : "add";
    await wishlistMutation.mutateAsync({
      action,
      productId,
      productName: details?.productName,
      price: details?.price,
    });
    return action;
  }

  return {
    hasWishlistProduct: (productId: string) => wishlistIds.has(productId),
    isPendingProductId: wishlistMutation.isPending ? wishlistMutation.variables?.productId ?? null : null,
    pendingAction: wishlistMutation.isPending ? wishlistMutation.variables?.action ?? null : null,
    toggleWishlist,
    isLoading: wishlistQuery.isLoading,
    isEnabled: customerAuth.enabled,
  };
}
