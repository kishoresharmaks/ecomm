"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, EyeOff, RefreshCw, Search, Star, XCircle } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";
import type { ProductReviewStatus } from "@/lib/storefront-api";

type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type AdminReviewRecord = {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  status: ProductReviewStatus;
  adminNote?: string | null;
  isVerifiedPurchase: boolean;
  submittedAt?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  };
  seller: {
    id: string;
    storeName: string;
    slug: string;
  };
  customer: {
    id: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
  };
  order: {
    orderNumber: string;
    createdAt?: string;
  };
  moderatedAt?: string | null;
  moderatedBy?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type ModerationDecision = "APPROVE" | "REJECT" | "HIDE";

const statuses: Array<ProductReviewStatus | "ALL"> = ["ALL", "PENDING", "APPROVED", "REJECTED", "HIDDEN"];

export function AdminReviewsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductReviewStatus | "ALL">("PENDING");
  const [activeAction, setActiveAction] = useState<{
    review: AdminReviewRecord;
    decision: ModerationDecision;
  } | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews", auth.token, status, search],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (status !== "ALL") {
        params.set("status", status);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }
      return indihubFetch<PageResult<AdminReviewRecord>>(`/api/admin/reviews?${params.toString()}`, undefined, auth.authHeaders);
    },
    enabled: auth.isAuthenticated,
  });

  const moderationMutation = useMutation({
    mutationFn: (payload: { reviewId: string; decision: ModerationDecision; moderationNote?: string }) =>
      indihubFetch<AdminReviewRecord>(
        `/api/admin/reviews/${encodeURIComponent(payload.reviewId)}/moderation`,
        {
          method: "PATCH",
          body: JSON.stringify({
            decision: payload.decision,
            moderationNote: payload.moderationNote,
          }),
        },
        auth.authHeaders,
      ),
    onSuccess: () => {
      setActiveAction(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-[#D8E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, seller, customer, order, title, or comment"
              className="h-11 w-full rounded-lg border border-[#D8E2EA] bg-white pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProductReviewStatus | "ALL")}
            className="h-11 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "All statuses" : reviewStatusLabel(value)}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void reviewsQuery.refetch()} disabled={reviewsQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${reviewsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#D8E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm font-black text-[#667085] lg:grid-cols-[minmax(260px,1fr)_190px_180px_150px_170px]">
          <span>Review</span>
          <span>Product</span>
          <span>Customer</span>
          <span>Status</span>
          <span className="lg:text-right">Moderation</span>
        </div>

        {reviewsQuery.isLoading ? (
          <div className="p-6 text-sm font-semibold text-[#667085]">Loading reviews...</div>
        ) : reviewsQuery.data?.items.length ? (
          reviewsQuery.data.items.map((review) => (
            <div key={review.id} className="grid gap-3 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(260px,1fr)_190px_180px_150px_170px] lg:items-start">
              <div>
                <RatingRow rating={review.rating} />
                <p className="mt-2 text-sm font-black text-[#1F2933]">{review.title || "Untitled review"}</p>
                {review.comment ? <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-[#667085]">{review.comment}</p> : null}
                {review.adminNote ? <p className="mt-2 rounded-md bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#667085]">Note: {review.adminNote}</p> : null}
              </div>
              <div className="text-sm">
                <p className="font-black text-[#1F2933]">{review.product.name}</p>
                <p className="mt-1 font-semibold text-[#667085]">{review.seller.storeName}</p>
                <p className="mt-1 text-xs font-bold text-[#98A2B3]">{review.order.orderNumber}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-[#1F2933]">{review.customer.displayName}</p>
                <p className="mt-1 break-all font-semibold text-[#667085]">{review.customer.email}</p>
              </div>
              <div>
                <StatusBadge tone={reviewStatusTone(review.status)}>{reviewStatusLabel(review.status)}</StatusBadge>
                {review.isVerifiedPurchase ? <p className="mt-2 text-xs font-black text-[#0F8A5F]">Verified purchase</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setActiveAction({ review, decision: "APPROVE" })}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setActiveAction({ review, decision: "REJECT" })}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setActiveAction({ review, decision: "HIDE" })}>
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  Hide
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-sm font-semibold text-[#667085]">No reviews match this filter.</div>
        )}
      </div>

      <ModerationDialog
        action={activeAction}
        isPending={moderationMutation.isPending}
        error={moderationMutation.error}
        onClose={() => setActiveAction(null)}
        onConfirm={(moderationNote) => {
          if (!activeAction) {
            return;
          }
          const payload: { reviewId: string; decision: ModerationDecision; moderationNote?: string } = {
            reviewId: activeAction.review.id,
            decision: activeAction.decision,
          };
          if (moderationNote) {
            payload.moderationNote = moderationNote;
          }
          moderationMutation.mutate(payload);
        }}
      />
    </div>
  );
}

function ModerationDialog({
  action,
  isPending,
  error,
  onClose,
  onConfirm,
}: {
  action: { review: AdminReviewRecord; decision: ModerationDecision } | null;
  isPending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (moderationNote?: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <Dialog open={Boolean(action)} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-[#071B35]/45" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="text-lg font-black text-[#123A5A]">
            {action ? moderationTitle(action.decision) : "Moderate review"}
          </DialogTitle>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
            {action?.review.product.name}
          </p>
          <label className="mt-4 grid gap-1 text-sm font-black text-[#1F2933]">
            Moderation note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={500}
              className="rounded-lg border border-[#D8E2EA] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
              placeholder="Internal moderation reason"
            />
          </label>
          {error ? <p className="mt-3 text-sm font-bold text-[#C4320A]">{error instanceof Error ? error.message : "Moderation failed."}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" className="bg-[#ED3500]" onClick={() => onConfirm(note.trim() || undefined)} disabled={isPending}>
              {isPending ? "Saving" : "Confirm"}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function RatingRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-[#ED3500]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-4 w-4 ${index < rating ? "fill-[#ED3500]" : ""}`} aria-hidden="true" />
      ))}
    </div>
  );
}

function reviewStatusLabel(status: ProductReviewStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function reviewStatusTone(status: ProductReviewStatus) {
  if (status === "APPROVED") {
    return "success" as const;
  }
  if (status === "PENDING") {
    return "warning" as const;
  }
  return "danger" as const;
}

function moderationTitle(decision: ModerationDecision) {
  if (decision === "APPROVE") {
    return "Approve review";
  }
  if (decision === "REJECT") {
    return "Reject review";
  }
  return "Hide review";
}
