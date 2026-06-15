"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Ban, CheckCircle2, PackagePlus, RefreshCw, XCircle } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useMarket } from "@/components/market/market-context";
import { SellerAuthNotice, useSellerAuth } from "@/components/seller/seller-ui";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import {
  acceptSellerDeal,
  declineSellerDeal,
  enrollSellerDealProducts,
  getSellerDeal,
  listSellerDeals,
  removeSellerDealProduct,
  type SellerDeal,
} from "@/lib/deals-api";
import { primaryImage, primaryVariant, type ProductSummary } from "@/lib/storefront-api";

export function SellerDealsClient() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const market = useMarket();
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);

  const dealsQuery = useQuery({
    queryKey: ["seller-deals", sellerAuth.authKey],
    queryFn: () => listSellerDeals(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
  });
  const selectedDeal = useMemo(
    () => dealsQuery.data?.items.find((deal) => deal.id === selectedDealId) ?? dealsQuery.data?.items[0] ?? null,
    [dealsQuery.data?.items, selectedDealId],
  );
  const detailQuery = useQuery({
    queryKey: ["seller-deal", sellerAuth.authKey, selectedDeal?.id],
    queryFn: () => getSellerDeal(sellerAuth.authHeaders, selectedDeal?.id ?? ""),
    enabled: sellerAuth.enabled && Boolean(selectedDeal?.id),
  });
  const detail = detailQuery.data ?? selectedDeal;
  const accepted = detail?.sellerParticipation?.status === "ACCEPTED";
  const declined = detail?.sellerParticipation?.status === "DECLINED";
  const eligibleProductCount = detail?.sellerEligibleProductCount ?? detail?.eligibleProducts?.length ?? 0;
  const canAcceptDeal = Boolean(detail && eligibleProductCount > 0 && !declined);
  const enrolledProductIds = new Set(
    detail?.productEnrollments
      ?.filter((enrollment) => enrollment.status === "ENROLLED")
      .map((enrollment) => enrollment.productId) ?? [],
  );

  const acceptMutation = useMutation({
    mutationFn: (dealId: string) => acceptSellerDeal(sellerAuth.authHeaders, dealId),
    onSuccess: () => refresh("Deal accepted. You can now add eligible products."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to accept deal."),
  });
  const declineMutation = useMutation({
    mutationFn: (dealId: string) => declineSellerDeal(sellerAuth.authHeaders, dealId),
    onSuccess: () => refresh("Deal declined."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to decline deal."),
  });
  const enrollMutation = useMutation({
    mutationFn: ({ dealId, productId }: { dealId: string; productId: string }) =>
      enrollSellerDealProducts(sellerAuth.authHeaders, dealId, [productId]),
    onSuccess: () => refresh("Product enrolled."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to enroll product."),
  });
  const removeMutation = useMutation({
    mutationFn: ({ dealId, productId }: { dealId: string; productId: string }) =>
      removeSellerDealProduct(sellerAuth.authHeaders, dealId, productId),
    onSuccess: () => refresh("Product removed from deal."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to remove product."),
  });

  function refresh(message: string) {
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ["seller-deals"] });
    void queryClient.invalidateQueries({ queryKey: ["seller-deal"] });
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Available campaigns</p>
            <h2 className="mt-2 text-xl font-black text-[#1F2933]">Deals</h2>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void dealsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-5 grid gap-3">
          {dealsQuery.data?.items.map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => setSelectedDealId(deal.id)}
              className={`rounded-md border p-4 text-left transition ${selectedDeal?.id === deal.id ? "border-[#ED3500] bg-[#FFF8F5]" : "border-[#E5E7EB] bg-white hover:border-[#ED3500]/40"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <DealStateBadge deal={deal} />
                <span className="rounded-full bg-[#FFF0EC] px-2.5 py-1 text-xs font-black text-[#ED3500]">{deal.discountBps / 100}% off</span>
              </div>
              <p className="mt-2 font-black text-[#1F2933]">{deal.title}</p>
              <p className="mt-1 text-xs font-bold text-[#667085]">
                {deal.sellerEligibleProductCount ?? 0} eligible products · Join by {formatDate(deal.joinDeadline)}
              </p>
            </button>
          ))}
          {!dealsQuery.isLoading && !dealsQuery.data?.items.length ? (
            <p className="rounded-md border border-dashed border-[#D8E2EA] p-5 text-sm font-semibold text-[#667085]">No published deal campaigns are available right now.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
        {detail ? (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="info">{detail.category?.name ?? "Category"}</StatusBadge>
                  <StatusBadge tone="warning">{detail.discountBps / 100}% seller funded</StatusBadge>
                  <DealStateBadge deal={detail} />
                </div>
                <h2 className="mt-3 text-2xl font-black text-[#1F2933]">{detail.title}</h2>
                {detail.description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">{detail.description}</p> : null}
                <p className="mt-3 text-sm font-bold text-[#667085]">
                  {formatDate(detail.startsAt)} to {formatDate(detail.endsAt)} · Join by {formatDate(detail.joinDeadline)}
                </p>
                <p className="mt-2 text-sm font-bold text-[#667085]">
                  {eligibleProductCount} of your active approved products match this category.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!accepted ? (
                  <Button type="button" onClick={() => acceptMutation.mutate(detail.id)} disabled={acceptMutation.isPending || !canAcceptDeal}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Accept
                  </Button>
                ) : null}
                {!accepted && !declined ? (
                  <Button type="button" variant="outline" onClick={() => declineMutation.mutate(detail.id)} disabled={declineMutation.isPending}>
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Decline
                  </Button>
                ) : null}
              </div>
            </div>

            {notice ? <p className="mt-4 rounded-md border border-[#FFE0D6] bg-[#FFF8F5] px-3 py-2 text-sm font-bold text-[#9F2600]">{notice}</p> : null}

            <div className="mt-6">
              <h3 className="text-lg font-black text-[#1F2933]">Eligible products</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {(detail.eligibleProducts ?? []).map((product) => (
                  <SellerDealProductCard
                    key={product.id}
                    product={product}
                    enrolled={enrolledProductIds.has(product.id)}
                    accepted={accepted}
                    busy={enrollMutation.isPending || removeMutation.isPending}
                    marketFormat={(amount) => market.format(amount)}
                    onEnroll={() => enrollMutation.mutate({ dealId: detail.id, productId: product.id })}
                    onRemove={() => removeMutation.mutate({ dealId: detail.id, productId: product.id })}
                  />
                ))}
              </div>
              {!detail.eligibleProducts?.length ? (
                <p className="mt-4 rounded-md border border-dashed border-[#D8E2EA] p-5 text-sm font-semibold text-[#667085]">
                  No eligible active approved products found for {detail.category?.name ?? "this category"}. Add or approve a matching product first, then return before the join deadline.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-[#D8E2EA] text-center">
            <div>
              <BadgePercent className="mx-auto h-10 w-10 text-[#ED3500]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#667085]">Select a deal to review products.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SellerDealProductCard({
  product,
  enrolled,
  accepted,
  busy,
  marketFormat,
  onEnroll,
  onRemove,
}: {
  product: ProductSummary;
  enrolled: boolean;
  accepted: boolean;
  busy: boolean;
  marketFormat: (amount: number) => string;
  onEnroll: () => void;
  onRemove: () => void;
}) {
  const variant = primaryVariant(product);
  return (
    <article className="rounded-md border border-[#E5E7EB] bg-[#FCFDFE] p-3">
      <div className="flex gap-3">
        <Link href={`/products/${product.slug}` as Route} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white">
          <StorefrontImage src={primaryImage(product)} alt={product.name} sizes="80px" fallbackLabel={product.category.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {enrolled ? <StatusBadge tone="success">Enrolled</StatusBadge> : <StatusBadge tone="neutral">Available</StatusBadge>}
          </div>
          <p className="mt-2 line-clamp-2 font-black text-[#1F2933]">{product.name}</p>
          <p className="mt-1 text-sm font-bold text-[#667085]">{variant ? marketFormat(variant.pricePaise) : "Price pending"}</p>
        </div>
      </div>
      <div className="mt-3">
        {enrolled ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={busy}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onEnroll} disabled={!accepted || busy}>
            <PackagePlus className="h-4 w-4" aria-hidden="true" />
            Enroll
          </Button>
        )}
      </div>
    </article>
  );
}

function DealStateBadge({ deal }: { deal: SellerDeal }) {
  if (deal.sellerParticipation?.status === "ACCEPTED") {
    return <StatusBadge tone="success">Accepted</StatusBadge>;
  }
  if (deal.sellerParticipation?.status === "DECLINED") {
    return <StatusBadge tone="danger">Declined</StatusBadge>;
  }
  return <StatusBadge tone="warning">Open</StatusBadge>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
