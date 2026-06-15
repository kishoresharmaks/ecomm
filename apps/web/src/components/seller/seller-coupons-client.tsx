"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, TicketPercent, XCircle } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { SellerAuthNotice, useSellerAuth } from "@/components/seller/seller-ui";
import {
  acceptSellerCoupon,
  declineSellerCoupon,
  listSellerCoupons,
  type CouponSellerParticipationStatus,
  type SellerCouponParticipation,
} from "@/lib/coupons-api";
import { formatMoney } from "@/lib/storefront-api";

const filters: Array<CouponSellerParticipationStatus | "ALL"> = ["ALL", "PENDING", "ACCEPTED", "DECLINED", "REMOVED"];

export function SellerCouponsClient() {
  const sellerAuth = useSellerAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CouponSellerParticipationStatus | "ALL">("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  const couponsQuery = useQuery({
    queryKey: ["seller-coupons", sellerAuth.authKey, status],
    queryFn: () => listSellerCoupons(sellerAuth.authHeaders, { ...(status !== "ALL" ? { participationStatus: status } : {}) }),
    enabled: sellerAuth.enabled,
  });
  const acceptMutation = useMutation({
    mutationFn: (couponId: string) => acceptSellerCoupon(sellerAuth.authHeaders, couponId),
    onSuccess: () => refresh("Coupon participation accepted."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to accept coupon."),
  });
  const declineMutation = useMutation({
    mutationFn: (couponId: string) => declineSellerCoupon(sellerAuth.authHeaders, couponId),
    onSuccess: () => refresh("Coupon participation declined."),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to decline coupon."),
  });

  function refresh(message?: string) {
    if (message) setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ["seller-coupons"] });
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Seller consent</p>
            <h2 className="mt-2 text-xl font-black text-[#1F2933]">Coupon participation</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">Seller-funded coupons reduce payout only after you accept. Platform-funded coupons do not reduce your settlement.</p>
          </div>
          <div className="flex gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value as CouponSellerParticipationStatus | "ALL")} className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold">
              {filters.map((filter) => <option key={filter} value={filter}>{filter === "ALL" ? "All statuses" : filter}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => void couponsQuery.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-4 rounded-md border border-[#FFE0D6] bg-[#FFF8F5] px-3 py-2 text-sm font-bold text-[#9F2600]">{notice}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {couponsQuery.data?.items.map((item) => (
          <SellerCouponCard
            key={item.id}
            item={item}
            busy={acceptMutation.isPending || declineMutation.isPending}
            onAccept={() => acceptMutation.mutate(item.couponId)}
            onDecline={() => declineMutation.mutate(item.couponId)}
          />
        ))}
        {!couponsQuery.isLoading && !couponsQuery.data?.items.length ? (
          <p className="rounded-lg border border-dashed border-[#D8E2EA] bg-white p-8 text-center text-sm font-semibold text-[#667085]">No seller-funded coupon campaigns are connected to your store right now.</p>
        ) : null}
      </section>
    </div>
  );
}

function SellerCouponCard({ item, busy, onAccept, onDecline }: { item: SellerCouponParticipation; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const coupon = item.coupon;
  const accepted = item.status === "ACCEPTED";
  const declined = item.status === "DECLINED";
  const locked = Boolean(item.lockedAt);
  const totalSellerFunded = coupon.redemptions?.reduce((total, redemption) => total + redemption.sellerFundedDiscountPaise, 0) ?? 0;

  return (
    <article className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ParticipationBadge status={item.status} />
            <StatusBadge tone={coupon.status === "ACTIVE" ? "success" : coupon.status === "ARCHIVED" ? "danger" : "warning"}>{coupon.status}</StatusBadge>
          </div>
          <h3 className="mt-3 text-xl font-black text-[#1F2933]">{coupon.code}</h3>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{coupon.title}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#FFF0EC] text-[#ED3500]">
          <TicketPercent className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Offer" value={couponLabel(coupon)} />
        <Metric label="Deductions" value={formatMoney(totalSellerFunded)} />
        <Metric label="Redemptions" value={String(coupon.redemptions?.length ?? 0)} />
      </div>

      <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm font-semibold text-[#667085]">
        <p>Funding source: <span className="font-black text-[#1F2933]">{coupon.fundingSource.replace("_", " ")}</span></p>
        <p className="mt-1">Accepted consent locks after first redemption. Locked: <span className="font-black text-[#1F2933]">{locked ? "Yes" : "No"}</span></p>
      </div>

      {!accepted && !locked ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onAccept} disabled={busy || declined}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Accept
          </Button>
          {!declined ? (
            <Button type="button" variant="outline" onClick={onDecline} disabled={busy}>
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Decline
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ParticipationBadge({ status }: { status: CouponSellerParticipationStatus }) {
  const tone = status === "ACCEPTED" ? "success" : status === "DECLINED" || status === "REMOVED" ? "danger" : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-1 font-black text-[#1F2933]">{value}</p>
    </div>
  );
}

function couponLabel(coupon: SellerCouponParticipation["coupon"]) {
  if (coupon.discountType === "FREE_SHIPPING") return "Free shipping";
  if (coupon.discountType === "PERCENTAGE") return `${(coupon.discountValueBps ?? 0) / 100}% off`;
  return `${formatMoney(coupon.discountAmountPaise ?? 0)} off`;
}
