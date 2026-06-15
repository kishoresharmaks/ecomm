"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, Star } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import {
  getSellerReviewSummary,
  listSellerReviews,
  type SellerReviewRecord,
} from "@/lib/seller-api";
import type { ProductReviewStatus } from "@/lib/storefront-api";
import { SellerAuthNotice, useSellerAuth } from "./seller-ui";

const statuses: Array<ProductReviewStatus | "ALL"> = ["ALL", "PENDING", "APPROVED", "REJECTED", "HIDDEN"];

export function SellerReviewsClient() {
  const auth = useSellerAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductReviewStatus | "ALL">("ALL");
  const [rating, setRating] = useState<number | "ALL">("ALL");

  const summaryQuery = useQuery({
    queryKey: ["seller-review-summary", auth.authKey],
    queryFn: () => getSellerReviewSummary(auth.authHeaders),
    enabled: auth.enabled,
  });

  const reviewsQuery = useQuery({
    queryKey: ["seller-reviews", auth.authKey, search, status, rating],
    queryFn: () => {
      const query: Parameters<typeof listSellerReviews>[1] = { limit: 50 };
      const cleanSearch = search.trim();
      if (cleanSearch) {
        query.search = cleanSearch;
      }
      if (status !== "ALL") {
        query.status = status;
      }
      if (rating !== "ALL") {
        query.rating = rating;
      }
      return listSellerReviews(auth.authHeaders, query);
    },
    enabled: auth.enabled,
  });

  if (!auth.enabled) {
    return <SellerAuthNotice />;
  }

  const summary = summaryQuery.data?.summary;
  const counts = summaryQuery.data?.statusCounts;

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <ReviewMetricCard
          label="Average rating"
          value={summary?.reviewCount ? `${summary.averageRating?.toFixed(1)} / 5` : "No reviews"}
        />
        <ReviewMetricCard label="Approved" value={`${counts?.APPROVED ?? 0}`} />
        <ReviewMetricCard label="Pending approval" value={`${counts?.PENDING ?? 0}`} />
        <ReviewMetricCard label="Hidden or rejected" value={`${(counts?.HIDDEN ?? 0) + (counts?.REJECTED ?? 0)}`} />
      </div>

      <div className="rounded-xl border border-[#D9E2EA] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, order number, title, or comment"
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
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value === "ALL" ? "ALL" : Number(event.target.value))}
            className="h-11 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-black text-[#1F2933] outline-none focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10"
          >
            <option value="ALL">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => void reviewsQuery.refetch()} disabled={reviewsQuery.isFetching}>
            <RefreshCw className={`h-4 w-4 ${reviewsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#D9E2EA] bg-white shadow-sm">
        <div className="grid gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm font-black text-[#667085] lg:grid-cols-[minmax(260px,1fr)_180px_160px_130px]">
          <span>Review</span>
          <span>Product</span>
          <span>Customer/order</span>
          <span>Status</span>
        </div>
        {reviewsQuery.isLoading ? (
          <div className="p-6 text-sm font-semibold text-[#667085]">Loading reviews...</div>
        ) : reviewsQuery.data?.items.length ? (
          reviewsQuery.data.items.map((review) => <SellerReviewRow key={review.id} review={review} />)
        ) : (
          <div className="p-6 text-sm font-semibold text-[#667085]">No reviews match this filter.</div>
        )}
      </div>
    </div>
  );
}

function SellerReviewRow({ review }: { review: SellerReviewRecord }) {
  return (
    <div className="grid gap-3 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(260px,1fr)_180px_160px_130px]">
      <div>
        <div className="flex items-center gap-1 text-[#ED3500]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className={`h-4 w-4 ${index < review.rating ? "fill-[#ED3500]" : ""}`} aria-hidden="true" />
          ))}
        </div>
        <p className="mt-2 text-sm font-black text-[#1F2933]">{review.title || "Untitled review"}</p>
        {review.comment ? <p className="mt-1 line-clamp-3 text-sm font-semibold leading-6 text-[#667085]">{review.comment}</p> : null}
      </div>
      <div className="text-sm">
        <Link href={`/seller/products/${review.product.id}/edit`} className="font-black text-[#123A5A] hover:text-[#ED3500]">
          {review.product.name}
        </Link>
        <p className="mt-1 text-xs font-bold text-[#98A2B3]">{review.orderItem.productNameSnapshot}</p>
      </div>
      <div className="text-sm">
        <p className="font-black text-[#1F2933]">{review.customer.displayName}</p>
        <p className="mt-1 font-semibold text-[#667085]">{review.order.orderNumber}</p>
        {review.isVerifiedPurchase ? <p className="mt-1 text-xs font-black text-[#0F8A5F]">Verified purchase</p> : null}
      </div>
      <div>
        <StatusBadge tone={reviewStatusTone(review.status)}>{reviewStatusLabel(review.status)}</StatusBadge>
      </div>
    </div>
  );
}

function ReviewMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#D9E2EA] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#123A5A]">{value}</p>
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
