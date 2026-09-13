import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useMobileCustomerAuth } from "../../auth/mobile-auth-context";
import {
  deleteCustomerReview,
  getCustomerReviews,
  getOrderReviewOptions,
  getProductReviews,
  submitProductReview,
  type SubmitProductReviewPayload,
} from "./storefront-api";
import type { MobileCustomerReview } from "../../types/storefront";

export function useProductReviews(productId: string | null) {
  const { enabled, authKey } = useMobileCustomerAuth();

  const query = useQuery({
    queryKey: ["mobile-product-reviews", productId],
    queryFn: () => getProductReviews(productId!),
    enabled: Boolean(productId) && enabled,
    staleTime: 60_000,
  });

  const reviews = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const hasNextPage = query.data?.nextCursor != null;
  const reviewCount = reviews.length;

  const averageRating = useMemo(() => {
    if (!reviewCount) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviewCount) * 10) / 10;
  }, [reviews, reviewCount]);

  return {
    averageRating,
    reviewCount,
    reviews,
    hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    refetch: () => void query.refetch(),
  };
}

export function useReviewableItems(orderNumber: string | null) {
  const { enabled, authHeaders } = useMobileCustomerAuth();

  const query = useQuery({
    queryKey: ["mobile-review-options", orderNumber],
    queryFn: () => getOrderReviewOptions(authHeaders, orderNumber!),
    enabled: Boolean(orderNumber) && enabled,
    staleTime: 30_000,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

export function useSubmitReview() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: SubmitProductReviewPayload) =>
      submitProductReview(customerAuth.authHeaders, payload),
    onSuccess: async () => {
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-review-options"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-product-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-product"] }),
      ]);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Review could not be submitted.");
    },
  });

  function submitReview(payload: SubmitProductReviewPayload) {
    setError("");
    return mutation.mutateAsync(payload).then(() => {
      router.back();
    });
  }

  return {
    error,
    isSubmitting: mutation.isPending,
    submitReview,
  };
}

export function useCustomerReviews(page = 1) {
  const { enabled, authHeaders } = useMobileCustomerAuth();

  const query = useQuery({
    queryKey: ["mobile-customer-reviews", page],
    queryFn: () => getCustomerReviews(authHeaders, page),
    enabled,
    staleTime: 60_000,
  });

  const reviews = useMemo(() => (query.data?.items ?? []) as MobileCustomerReview[], [query.data?.items]);

  return {
    data: query.data,
    reviews,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

export function useDeleteReview() {
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (reviewId: string) => deleteCustomerReview(customerAuth.authHeaders, reviewId),
    onSuccess: async () => {
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-customer-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-review-options"] }),
        queryClient.invalidateQueries({ queryKey: ["mobile-product-reviews"] }),
      ]);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Review could not be deleted.");
    },
  });

  function deleteReview(reviewId: string) {
    setError("");
    return mutation.mutateAsync(reviewId);
  }

  return {
    error,
    isDeleting: mutation.isPending,
    deleteReview,
  };
}
