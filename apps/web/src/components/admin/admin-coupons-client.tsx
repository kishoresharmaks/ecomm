"use client";

import Link from "next/link";
import { FormEvent, type Dispatch, type ReactNode, type SetStateAction, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  Archive,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  Eye,
  Gift,
  Pause,
  Pencil,
  RefreshCw,
  ShoppingBag,
  Store,
  TicketPercent,
  UsersRound,
  X,
} from "lucide-react";
import { Button, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { indihubFetch } from "@/lib/api";
import {
  activateAdminCoupon,
  archiveAdminCoupon,
  createAdminCoupon,
  listAdminCoupons,
  listCouponRedemptions,
  pauseAdminCoupon,
  updateAdminCoupon,
  type Coupon,
  type CouponDiscountType,
  type CouponFundingSource,
  type CouponPayload,
  type CouponStatus,
} from "@/lib/coupons-api";
import {
  formatMoney,
  listCategories,
  type CategorySummary,
  type ProductSummary,
  type SellerSummary,
} from "@/lib/storefront-api";

const statuses: Array<CouponStatus | "ALL"> = ["ALL", "DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];

type CouponFormState = {
  code: string;
  title: string;
  description: string;
  discountType: CouponDiscountType;
  fundingSource: CouponFundingSource;
  percent: string;
  amountRupees: string;
  maxDiscountRupees: string;
  minSubtotalRupees: string;
  maxSubtotalRupees: string;
  totalUsageLimit: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  startsAt: string;
  endsAt: string;
  sellerIds: string[];
  productIds: string[];
  categoryIds: string[];
};

const emptyForm: CouponFormState = {
  code: "",
  title: "",
  description: "",
  discountType: "PERCENTAGE",
  fundingSource: "PLATFORM",
  percent: "10",
  amountRupees: "",
  maxDiscountRupees: "",
  minSubtotalRupees: "",
  maxSubtotalRupees: "",
  totalUsageLimit: "",
  perCustomerLimit: "1",
  firstOrderOnly: false,
  startsAt: "",
  endsAt: "",
  sellerIds: [],
  productIds: [],
  categoryIds: [],
};

type PageResult<T> = { items: T[] };

export function AdminCouponsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CouponStatus | "ALL">("ALL");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [form, setForm] = useState<CouponFormState>(emptyForm);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editForm, setEditForm] = useState<CouponFormState>(emptyForm);
  const [notice, setNotice] = useState<string | null>(null);

  const couponsQuery = useQuery({
    queryKey: ["admin-coupons", auth.token, status],
    queryFn: () =>
      listAdminCoupons(auth.authHeaders, {
        ...(status !== "ALL" ? { status } : {}),
        limit: 50,
      }),
    enabled: auth.isAuthenticated,
  });
  const sellersQuery = useQuery({
    queryKey: ["admin-coupon-sellers", auth.token],
    queryFn: () =>
      indihubFetch<PageResult<SellerSummary>>(
        "/api/admin/sellers?limit=100",
        undefined,
        auth.authHeaders,
      ),
    enabled: auth.isAuthenticated,
  });
  const productsQuery = useQuery({
    queryKey: ["admin-coupon-products", auth.token],
    queryFn: () =>
      indihubFetch<PageResult<ProductSummary>>(
        "/api/admin/products?limit=100",
        undefined,
        auth.authHeaders,
      ),
    enabled: auth.isAuthenticated,
  });
  const categoriesQuery = useQuery({ queryKey: ["admin-coupon-categories"], queryFn: listCategories });
  const selectedCoupon = useMemo(
    () =>
      couponsQuery.data?.items.find((coupon) => coupon.id === selectedCouponId) ??
      couponsQuery.data?.items[0] ??
      null,
    [couponsQuery.data?.items, selectedCouponId],
  );
  const redemptionsQuery = useQuery({
    queryKey: ["admin-coupon-redemptions", auth.token, selectedCoupon?.id],
    queryFn: () => listCouponRedemptions(auth.authHeaders, selectedCoupon?.id ?? ""),
    enabled: auth.isAuthenticated && Boolean(selectedCoupon?.id),
  });

  const metrics = couponsQuery.data?.stats ?? {
    total: 0,
    active: 0,
    scheduled: 0,
    paused: 0,
    archived: 0,
    redeemed: 0,
  };

  const createMutation = useMutation({
    mutationFn: (payload: CouponPayload) => createAdminCoupon(auth.authHeaders, payload),
    onSuccess: (coupon) => {
      setNotice("Coupon created. Activate it when dates and seller consent are ready.");
      setSelectedCouponId(coupon.id);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to create coupon."),
  });
  const lifecycleMutation = useMutation({
    mutationFn: ({ action, couponId }: { action: "activate" | "pause" | "archive"; couponId: string }) => {
      if (action === "activate") return activateAdminCoupon(auth.authHeaders, couponId);
      if (action === "pause") return pauseAdminCoupon(auth.authHeaders, couponId);
      return archiveAdminCoupon(auth.authHeaders, couponId);
    },
    onSuccess: () => {
      setNotice("Coupon status updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-coupon-redemptions"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update coupon."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ couponId, payload }: { couponId: string; payload: Partial<CouponPayload> }) =>
      updateAdminCoupon(auth.authHeaders, couponId, payload),
    onSuccess: (coupon) => {
      setNotice("Coupon updated.");
      setEditCoupon(null);
      setSelectedCouponId(coupon.id);
      void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-coupon-redemptions"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to update coupon."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(payloadFromForm(form));
  }

  function openEdit(coupon: Coupon) {
    setSelectedCouponId(coupon.id);
    setEditCoupon(coupon);
    setEditForm(formFromCoupon(coupon));
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editCoupon) {
      return;
    }
    updateMutation.mutate({
      couponId: editCoupon.id,
      payload: payloadFromEditForm(editForm, editCoupon),
    });
  }

  return (
    <>
      <div className="space-y-5 text-[15px]">
      <div className="grid gap-3 sm:grid-cols-4">
          <DashboardMetric label="Active" value={String(metrics.active)} tone="success" />
          <DashboardMetric label="Scheduled" value={String(metrics.scheduled)} tone="info" />
          <DashboardMetric label="Paused" value={String(metrics.paused)} tone="warning" />
          <DashboardMetric label="Redeemed" value={String(metrics.redeemed)} tone="neutral" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#101828]">Create coupon</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Create one controlled buyer campaign.</p>
            </div>
            <span className="rounded-full bg-[#FFF0EC] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#ED3500]">
              Campaign setup
            </span>
          </div>

          <form className="mt-5 grid gap-3" onSubmit={submit}>
            <CouponField
              label="Coupon code"
              value={form.code}
              onChange={(code) => setForm((current) => ({ ...current, code: code.toUpperCase() }))}
              placeholder="FIRST10"
              required
              trailing={<TicketPercent className="h-4 w-4" aria-hidden="true" />}
            />
            <CouponField
              label="Title"
              value={form.title}
              onChange={(title) => setForm((current) => ({ ...current, title }))}
              placeholder="First order coupon"
              required
            />
            <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
              Description
              <textarea
                value={form.description}
                maxLength={160}
                placeholder="Describe the offer and terms."
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="min-h-20 rounded-lg border border-[#D8E2EA] px-3 py-2 text-sm font-semibold outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
              />
              <span className="text-right text-xs font-semibold text-[#98A2B3]">
                {form.description.length} / 160
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <CouponSelect
                label="Discount type"
                value={form.discountType}
                onChange={(discountType) =>
                  setForm((current) => ({
                    ...current,
                    discountType,
                    fundingSource: discountType === "FREE_SHIPPING" ? "PLATFORM" : current.fundingSource,
                  }))
                }
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </CouponSelect>
              <CouponSelect
                label="Funding"
                value={form.fundingSource}
                disabled={form.discountType === "FREE_SHIPPING"}
                onChange={(fundingSource) => setForm((current) => ({ ...current, fundingSource }))}
              >
                <option value="PLATFORM">Platform funded</option>
                <option value="SELLER">Seller funded</option>
              </CouponSelect>
            </div>

            {form.discountType === "PERCENTAGE" ? (
              <CouponField
                label="Discount value"
                type="number"
                min={1}
                max={90}
                value={form.percent}
                onChange={(percent) => setForm((current) => ({ ...current, percent }))}
                required
                trailing="%"
              />
            ) : form.discountType === "FIXED_AMOUNT" ? (
              <CouponField
                label="Discount amount"
                type="number"
                min={1}
                value={form.amountRupees}
                onChange={(amountRupees) => setForm((current) => ({ ...current, amountRupees }))}
                required
                trailing="Rs."
              />
            ) : (
              <p className="rounded-lg border border-[#BEE6D2] bg-[#ECFDF3] px-3 py-2 text-xs font-bold text-[#067647]">
                Free shipping waives eligible shipping only. COD surcharge stays separate.
              </p>
            )}

            {form.discountType !== "FREE_SHIPPING" ? (
              <CouponField
                label="Max discount"
                type="number"
                min={1}
                value={form.maxDiscountRupees}
                onChange={(maxDiscountRupees) =>
                  setForm((current) => ({ ...current, maxDiscountRupees }))
                }
                trailing="Rs."
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <CouponField
                label="Minimum subtotal"
                type="number"
                min={0}
                value={form.minSubtotalRupees}
                onChange={(minSubtotalRupees) =>
                  setForm((current) => ({ ...current, minSubtotalRupees }))
                }
                trailing="Rs."
              />
              <CouponField
                label="Maximum subtotal"
                type="number"
                min={1}
                value={form.maxSubtotalRupees}
                onChange={(maxSubtotalRupees) =>
                  setForm((current) => ({ ...current, maxSubtotalRupees }))
                }
                trailing="Rs."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <CouponField
                label="Usage limit"
                type="number"
                min={1}
                value={form.totalUsageLimit}
                onChange={(totalUsageLimit) =>
                  setForm((current) => ({ ...current, totalUsageLimit }))
                }
                placeholder="1000"
              />
              <CouponField
                label="Per customer"
                type="number"
                min={1}
                value={form.perCustomerLimit}
                onChange={(perCustomerLimit) =>
                  setForm((current) => ({ ...current, perCustomerLimit }))
                }
                placeholder="1"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <CouponField
                label="Start date"
                type="datetime-local"
                value={form.startsAt}
                onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))}
              />
              <span className="hidden pb-3 text-sm font-black text-[#98A2B3] sm:block">-</span>
              <CouponField
                label="End date"
                type="datetime-local"
                value={form.endsAt}
                onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))}
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-bold text-[#1F2933]">
              <input
                type="checkbox"
                checked={form.firstOrderOnly}
                onChange={(event) =>
                  setForm((current) => ({ ...current, firstOrderOnly: event.target.checked }))
                }
              />
              First order only
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <MultiSelect
                label="Eligible sellers"
                values={form.sellerIds}
                options={(sellersQuery.data?.items ?? []).map((seller) => ({
                  value: seller.id,
                  label: seller.storeName,
                }))}
                onChange={(sellerIds) => setForm((current) => ({ ...current, sellerIds }))}
              />
              <MultiSelect
                label="Eligible products"
                values={form.productIds}
                options={(productsQuery.data?.items ?? []).map((product) => ({
                  value: product.id,
                  label: product.name,
                }))}
                onChange={(productIds) => setForm((current) => ({ ...current, productIds }))}
              />
            </div>
            <MultiSelect
              label="Eligible categories"
              values={form.categoryIds}
              options={flattenCategories(categoriesQuery.data ?? []).map((category) => ({
                value: category.id,
                label: category.label,
              }))}
              onChange={(categoryIds) => setForm((current) => ({ ...current, categoryIds }))}
            />

            {notice ? (
              <p className="rounded-lg border border-[#FFE0D6] bg-[#FFF8F5] px-3 py-2 text-sm font-bold text-[#9F2600]">
                {notice}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="h-11 w-full justify-center bg-[#ED3500] text-white hover:bg-[#D92F00]"
            >
              {createMutation.isPending ? "Creating coupon" : "Create coupon"}
            </Button>
          </form>
        </section>

        <section className="min-w-0 space-y-5">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#101828]">Coupon campaigns</h2>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  One coupon can be applied per order at checkout.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as CouponStatus | "ALL")}
                  className="h-10 min-w-40 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-bold text-[#344054] outline-none focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
                >
                  {statuses.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All statuses" : titleCaseStatus(option)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void couponsQuery.refetch()}
                  className="h-10 rounded-lg"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-[#EEF2F6]">
              <div className="hidden grid-cols-[1.3fr_0.55fr_0.6fr_0.8fr_0.5fr_0.35fr] border-b border-[#EEF2F6] bg-[#FCFCFD] px-3 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#667085] lg:grid">
                <span>Coupon</span>
                <span>Discount</span>
                <span>Redeemed</span>
                <span>Validity</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-[#EEF2F6]">
                {couponsQuery.data?.items.map((coupon) => {
                  const isSelected = selectedCoupon?.id === coupon.id;
                  return (
                    <div
                      key={coupon.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCouponId(coupon.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCouponId(coupon.id);
                        }
                      }}
                      className={cn(
                        "grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition lg:grid-cols-[1.3fr_0.55fr_0.6fr_0.8fr_0.5fr_0.35fr] lg:items-center",
                        isSelected
                          ? "bg-[#FFF8F5] ring-1 ring-inset ring-[#ED3500]"
                          : "bg-white hover:bg-[#FFF8F5]/70",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-2 h-2 w-2 shrink-0 rounded-full",
                            statusDotClass(coupon.status),
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CampaignPill status={coupon.status} compact />
                            {coupon.fundingSource === "SELLER" ? (
                              <span className="rounded-full bg-[#FFF7E6] px-2.5 py-1 text-[11px] font-black uppercase text-[#B54708]">
                                Seller funded
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-sm font-black text-[#101828]">{coupon.code}</p>
                          <p className="truncate text-xs font-semibold text-[#667085]">{coupon.title}</p>
                        </div>
                      </div>
                      <RowValue label="Discount" value={couponLabel(coupon)} subValue={couponSubLabel(coupon)} />
                      <RowValue
                        label="Redeemed"
                        value={`${coupon.redeemedCount}${coupon.totalUsageLimit ? ` / ${coupon.totalUsageLimit}` : ""}`}
                        subValue={`${usagePercent(coupon)}% used`}
                        progress={usagePercent(coupon)}
                        progressTone={coupon.status === "PAUSED" ? "warning" : "success"}
                      />
                      <RowValue label="Validity" value={validityLabel(coupon)} subValue={validitySubLabel(coupon)} />
                      <div className="flex items-center justify-between gap-3 lg:block">
                        <span className="text-xs font-black uppercase tracking-wide text-[#667085] lg:hidden">
                          Status
                        </span>
                        <CampaignPill status={coupon.status} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedCouponId(coupon.id);
                          }}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                          aria-label={`View coupon ${coupon.code}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(coupon);
                          }}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#D8E2EA] bg-white text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                          aria-label={`Edit coupon ${coupon.code}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!couponsQuery.isLoading && !couponsQuery.data?.items.length ? (
                  <div className="grid place-items-center px-4 py-14 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
                      <Gift className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 font-black text-[#101828]">No coupon campaigns found</p>
                    <p className="mt-1 max-w-sm text-sm font-semibold text-[#667085]">
                      Create a campaign from the form and activate it when it is ready for checkout.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {selectedCoupon ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CampaignPill status={selectedCoupon.status} />
                  <h2 className="mt-3 text-2xl font-black text-[#101828]">{selectedCoupon.code}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">{selectedCoupon.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCoupon.status !== "ACTIVE" && selectedCoupon.status !== "ARCHIVED" ? (
                    <Button
                      type="button"
                      onClick={() =>
                        lifecycleMutation.mutate({ action: "activate", couponId: selectedCoupon.id })
                      }
                      className="h-10 rounded-lg bg-[#ED3500] text-white hover:bg-[#D92F00]"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Activate
                    </Button>
                  ) : null}
                  {selectedCoupon.status === "ACTIVE" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        lifecycleMutation.mutate({ action: "pause", couponId: selectedCoupon.id })
                      }
                      className="h-10 rounded-lg"
                    >
                      <Pause className="h-4 w-4" aria-hidden="true" />
                      Pause
                    </Button>
                  ) : null}
                  {selectedCoupon.status !== "ARCHIVED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        lifecycleMutation.mutate({ action: "archive", couponId: selectedCoupon.id })
                      }
                      className="h-10 rounded-lg"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Archive
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEdit(selectedCoupon)}
                    className="h-10 rounded-lg"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Link
                    href="/admin/orders"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D8E2EA] px-4 text-sm font-black text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                  >
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    View orders
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MetricCard icon={BadgePercent} label="Discount" value={couponLabel(selectedCoupon)} />
                <MetricCard
                  icon={Gift}
                  label="Redeemed"
                  value={`${selectedCoupon.redeemedCount}${selectedCoupon.totalUsageLimit ? ` / ${selectedCoupon.totalUsageLimit}` : ""}`}
                  subValue={`${usagePercent(selectedCoupon)}% used`}
                />
                <MetricCard icon={UsersRound} label="Seller consent" value={participationSummary(selectedCoupon)} />
                <MetricCard icon={CalendarDays} label="Validity" value={validityLabel(selectedCoupon)} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <DetailPanel
                  icon={UsersRound}
                  iconClassName="bg-[#ECFDF3] text-[#079455]"
                  title="Seller participation"
                  description={
                    selectedCoupon.fundingSource === "SELLER"
                      ? "Seller-funded campaigns require consent before their products are eligible."
                      : "No seller consent is needed for this coupon."
                  }
                >
                  <div className="grid gap-2">
                    {selectedCoupon.sellerParticipations?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#EEF2F6] bg-[#FCFCFD] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#101828]">
                            {item.seller?.storeName ?? item.sellerId}
                          </p>
                          <p className="text-xs font-semibold text-[#667085]">
                            {item.lockedAt ? "Locked after redemption" : "Consent can still change"}
                          </p>
                        </div>
                        <ParticipationPill status={item.status} />
                      </div>
                    ))}
                    {!selectedCoupon.sellerParticipations?.length ? (
                      <p className="rounded-lg border border-[#EEF2F6] bg-[#FCFCFD] px-3 py-3 text-sm font-semibold text-[#667085]">
                        No seller consent is required.
                      </p>
                    ) : null}
                  </div>
                </DetailPanel>

                <DetailPanel
                  icon={Gift}
                  iconClassName="bg-[#F4EBFF] text-[#7F56D9]"
                  title="Recent redemptions"
                  description="Latest orders that used this campaign."
                >
                  <div className="grid gap-2">
                    {redemptionsQuery.data?.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[#EEF2F6] bg-[#FCFCFD] px-3 py-2 text-sm"
                      >
                        <div className="flex justify-between gap-3">
                          <span className="font-black text-[#101828]">
                            {item.order?.orderNumber ?? item.orderId}
                          </span>
                          <span className="font-black text-[#ED3500]">-{formatMoney(item.discountPaise)}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#667085]">
                          {item.customer?.user?.email ?? "Customer"} - {titleCaseStatus(item.status)}
                        </p>
                      </div>
                    ))}
                    {!redemptionsQuery.isLoading && !redemptionsQuery.data?.items.length ? (
                      <p className="rounded-lg border border-[#EEF2F6] bg-[#FCFCFD] px-3 py-3 text-sm font-semibold text-[#667085]">
                        No redemptions yet.
                      </p>
                    ) : null}
                  </div>
                </DetailPanel>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      </div>

      <EditCouponDialog
        coupon={editCoupon}
        form={editForm}
        setForm={setEditForm}
        onClose={() => setEditCoupon(null)}
        onSubmit={submitEdit}
        isSaving={updateMutation.isPending}
        sellers={(sellersQuery.data?.items ?? []).map((seller) => ({
          value: seller.id,
          label: seller.storeName,
        }))}
        products={(productsQuery.data?.items ?? []).map((product) => ({
          value: product.id,
          label: product.name,
        }))}
        categories={flattenCategories(categoriesQuery.data ?? []).map((category) => ({
          value: category.id,
          label: category.label,
        }))}
      />
    </>
  );
}

function payloadFromForm(form: CouponFormState): CouponPayload {
  const payload: CouponPayload = {
    code: form.code.trim().toUpperCase(),
    title: form.title.trim(),
    discountType: form.discountType,
    fundingSource: form.discountType === "FREE_SHIPPING" ? "PLATFORM" : form.fundingSource,
    firstOrderOnly: form.firstOrderOnly,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
    ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
    ...(form.totalUsageLimit ? { totalUsageLimit: Number(form.totalUsageLimit) } : {}),
    ...(form.perCustomerLimit ? { perCustomerLimit: Number(form.perCustomerLimit) } : {}),
    ...(form.minSubtotalRupees ? { minSubtotalPaise: rupeesToPaise(form.minSubtotalRupees) } : {}),
    ...(form.maxSubtotalRupees ? { maxSubtotalPaise: rupeesToPaise(form.maxSubtotalRupees) } : {}),
    ...(form.sellerIds.length ? { sellerIds: form.sellerIds } : {}),
    ...(form.productIds.length ? { productIds: form.productIds } : {}),
    ...(form.categoryIds.length ? { categoryIds: form.categoryIds } : {}),
  };
  if (form.discountType === "PERCENTAGE") {
    payload.discountValueBps = Math.round(Number(form.percent) * 100);
    if (form.maxDiscountRupees) payload.maxDiscountPaise = rupeesToPaise(form.maxDiscountRupees);
  }
  if (form.discountType === "FIXED_AMOUNT") {
    payload.discountAmountPaise = rupeesToPaise(form.amountRupees);
    if (form.maxDiscountRupees) payload.maxDiscountPaise = rupeesToPaise(form.maxDiscountRupees);
  }
  return payload;
}

function payloadFromEditForm(form: CouponFormState, coupon: Coupon): Partial<CouponPayload> {
  const payload: Partial<CouponPayload> = payloadFromForm(form);
  const hasRedemption = (coupon._count?.redemptions ?? 0) > 0 || coupon.redeemedCount > 0;
  if (hasRedemption) {
    delete payload.code;
    delete payload.discountType;
    delete payload.fundingSource;
    delete payload.discountValueBps;
    delete payload.discountAmountPaise;
    delete payload.maxDiscountPaise;
  }
  return payload;
}

function formFromCoupon(coupon: Coupon): CouponFormState {
  return {
    code: coupon.code,
    title: coupon.title,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    fundingSource: coupon.fundingSource,
    percent:
      coupon.discountType === "PERCENTAGE" && coupon.discountValueBps
        ? String(coupon.discountValueBps / 100)
        : "10",
    amountRupees:
      coupon.discountType === "FIXED_AMOUNT" && coupon.discountAmountPaise
        ? paiseToRupees(coupon.discountAmountPaise)
        : "",
    maxDiscountRupees: coupon.maxDiscountPaise ? paiseToRupees(coupon.maxDiscountPaise) : "",
    minSubtotalRupees: coupon.minSubtotalPaise ? paiseToRupees(coupon.minSubtotalPaise) : "",
    maxSubtotalRupees: coupon.maxSubtotalPaise ? paiseToRupees(coupon.maxSubtotalPaise) : "",
    totalUsageLimit: coupon.totalUsageLimit ? String(coupon.totalUsageLimit) : "",
    perCustomerLimit: coupon.perCustomerLimit ? String(coupon.perCustomerLimit) : "",
    firstOrderOnly: coupon.firstOrderOnly,
    startsAt: coupon.startsAt ? toLocalDateTimeValue(coupon.startsAt) : "",
    endsAt: coupon.endsAt ? toLocalDateTimeValue(coupon.endsAt) : "",
    sellerIds: coupon.sellerEligibilities?.map((item) => item.sellerId) ?? [],
    productIds: coupon.productEligibilities?.map((item) => item.productId) ?? [],
    categoryIds: coupon.categoryEligibilities?.map((item) => item.categoryId) ?? [],
  };
}

function rupeesToPaise(value: string) {
  return Math.round(Number(value) * 100);
}

function paiseToRupees(value: number) {
  return String(value / 100);
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function EditCouponDialog({
  coupon,
  form,
  setForm,
  onClose,
  onSubmit,
  isSaving,
  sellers,
  products,
  categories,
}: {
  coupon: Coupon | null;
  form: CouponFormState;
  setForm: Dispatch<SetStateAction<CouponFormState>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSaving: boolean;
  sellers: Array<{ value: string; label: string }>;
  products: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
}) {
  const hasRedemption = coupon ? (coupon._count?.redemptions ?? 0) > 0 || coupon.redeemedCount > 0 : false;
  return (
    <Dialog open={Boolean(coupon)} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-[#101828]/45" />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-black text-[#101828]">Edit coupon</DialogTitle>
                <p className="mt-1 text-sm font-semibold text-[#667085]">
                  Update campaign details, limits, dates, and eligibility.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#D8E2EA] text-[#344054] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                aria-label="Close coupon editor"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {hasRedemption ? (
              <p className="mt-4 rounded-lg border border-[#FFE0D6] bg-[#FFF8F5] px-3 py-2 text-sm font-bold text-[#9F2600]">
                Code, funding, and discount math are locked because this coupon already has redemptions.
              </p>
            ) : null}

            <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <CouponField
                  label="Coupon code"
                  value={form.code}
                  disabled={hasRedemption}
                  onChange={(code) => setForm((current) => ({ ...current, code: code.toUpperCase() }))}
                  required
                />
                <CouponField
                  label="Title"
                  value={form.title}
                  onChange={(title) => setForm((current) => ({ ...current, title }))}
                  required
                />
              </div>
              <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
                Description
                <textarea
                  value={form.description}
                  maxLength={160}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="min-h-20 rounded-lg border border-[#D8E2EA] px-3 py-2 text-sm font-semibold outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <CouponSelect
                  label="Discount type"
                  value={form.discountType}
                  disabled={hasRedemption}
                  onChange={(discountType) =>
                    setForm((current) => ({
                      ...current,
                      discountType,
                      fundingSource: discountType === "FREE_SHIPPING" ? "PLATFORM" : current.fundingSource,
                    }))
                  }
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                </CouponSelect>
                <CouponSelect
                  label="Funding"
                  value={form.fundingSource}
                  disabled={hasRedemption || form.discountType === "FREE_SHIPPING"}
                  onChange={(fundingSource) => setForm((current) => ({ ...current, fundingSource }))}
                >
                  <option value="PLATFORM">Platform funded</option>
                  <option value="SELLER">Seller funded</option>
                </CouponSelect>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <CouponField
                  label="Discount %"
                  type="number"
                  min={1}
                  max={90}
                  disabled={hasRedemption || form.discountType !== "PERCENTAGE"}
                  value={form.percent}
                  onChange={(percent) => setForm((current) => ({ ...current, percent }))}
                />
                <CouponField
                  label="Amount"
                  type="number"
                  min={1}
                  disabled={hasRedemption || form.discountType !== "FIXED_AMOUNT"}
                  value={form.amountRupees}
                  onChange={(amountRupees) => setForm((current) => ({ ...current, amountRupees }))}
                  trailing="Rs."
                />
                <CouponField
                  label="Max discount"
                  type="number"
                  min={1}
                  disabled={hasRedemption || form.discountType === "FREE_SHIPPING"}
                  value={form.maxDiscountRupees}
                  onChange={(maxDiscountRupees) =>
                    setForm((current) => ({ ...current, maxDiscountRupees }))
                  }
                  trailing="Rs."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CouponField
                  label="Minimum subtotal"
                  type="number"
                  min={0}
                  value={form.minSubtotalRupees}
                  onChange={(minSubtotalRupees) =>
                    setForm((current) => ({ ...current, minSubtotalRupees }))
                  }
                  trailing="Rs."
                />
                <CouponField
                  label="Maximum subtotal"
                  type="number"
                  min={1}
                  value={form.maxSubtotalRupees}
                  onChange={(maxSubtotalRupees) =>
                    setForm((current) => ({ ...current, maxSubtotalRupees }))
                  }
                  trailing="Rs."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CouponField
                  label="Usage limit"
                  type="number"
                  min={1}
                  value={form.totalUsageLimit}
                  onChange={(totalUsageLimit) =>
                    setForm((current) => ({ ...current, totalUsageLimit }))
                  }
                />
                <CouponField
                  label="Per customer"
                  type="number"
                  min={1}
                  value={form.perCustomerLimit}
                  onChange={(perCustomerLimit) =>
                    setForm((current) => ({ ...current, perCustomerLimit }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CouponField
                  label="Start date"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))}
                />
                <CouponField
                  label="End date"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))}
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-bold text-[#1F2933]">
                <input
                  type="checkbox"
                  checked={form.firstOrderOnly}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, firstOrderOnly: event.target.checked }))
                  }
                />
                First order only
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <MultiSelect
                  label="Eligible sellers"
                  values={form.sellerIds}
                  options={sellers}
                  onChange={(sellerIds) => setForm((current) => ({ ...current, sellerIds }))}
                />
                <MultiSelect
                  label="Eligible products"
                  values={form.productIds}
                  options={products}
                  onChange={(productIds) => setForm((current) => ({ ...current, productIds }))}
                />
              </div>
              <MultiSelect
                label="Eligible categories"
                values={form.categoryIds}
                options={categories}
                onChange={(categoryIds) => setForm((current) => ({ ...current, categoryIds }))}
              />
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-[#ED3500] text-white hover:bg-[#D92F00]">
                  {isSaving ? "Saving" : "Save changes"}
                </Button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function DashboardMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "warning" | "neutral";
}) {
  const toneClass = {
    success: "bg-[#ECFDF3] text-[#067647]",
    info: "bg-[#EFF8FF] text-[#175CD3]",
    warning: "bg-[#FFF7E6] text-[#B54708]",
    neutral: "bg-[#F2F4F7] text-[#344054]",
  }[tone];
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className={cn("mt-2 inline-flex rounded-full px-2.5 py-1 text-lg font-black", toneClass)}>
        {value}
      </p>
    </div>
  );
}

function CouponField({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled,
  min,
  max,
  placeholder,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
      <span>
        {label}
        {required ? <span className="text-[#ED3500]"> *</span> : null}
      </span>
      <span className="relative block">
        <input
          type={type}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-10 w-full rounded-lg border border-[#D8E2EA] px-3 text-sm font-semibold text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10 disabled:bg-[#F3F4F6] disabled:text-[#98A2B3]",
            trailing ? "pr-10" : "",
          )}
        />
        {trailing ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm font-black text-[#667085]">
            {trailing}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function CouponSelect<T extends string>({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
      {label}
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 rounded-lg border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10 disabled:bg-[#F3F4F6]"
      >
        {children}
      </select>
    </label>
  );
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
      {label}
      <select
        multiple
        value={values}
        onChange={(event) =>
          onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))
        }
        className="min-h-24 rounded-lg border border-[#D8E2EA] bg-white px-3 py-2 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#ED3500] focus:ring-4 focus:ring-[#ED3500]/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-xs font-semibold text-[#667085]">Use Ctrl or Cmd for multiple selections.</span>
    </label>
  );
}

function RowValue({
  label,
  value,
  subValue,
  progress,
  progressTone = "success",
}: {
  label: string;
  value: string;
  subValue?: string;
  progress?: number;
  progressTone?: "success" | "warning";
}) {
  return (
    <div className="flex items-start justify-between gap-3 lg:block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085] lg:hidden">{label}</span>
      <div className="min-w-0 text-right lg:text-left">
        <p className="font-black text-[#101828]">{value}</p>
        {subValue ? <p className="mt-1 text-xs font-semibold text-[#667085]">{subValue}</p> : null}
        {progress !== undefined ? (
          <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-[#EAECF0]">
            <span
              className={cn(
                "block h-full rounded-full",
                progressTone === "warning" ? "bg-[#F79009]" : "bg-[#12B76A]",
              )}
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CampaignPill({ status, compact = false }: { status: CouponStatus; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-black",
        compact ? "px-2.5 py-1 text-[11px] uppercase" : "px-3 py-1.5 text-xs",
        statusPillClass(status),
      )}
    >
      {titleCaseStatus(status)}
    </span>
  );
}

function ParticipationPill({ status }: { status: string }) {
  const className =
    status === "ACCEPTED"
      ? "bg-[#ECFDF3] text-[#067647]"
      : status === "DECLINED" || status === "REMOVED"
        ? "bg-[#FEF3F2] text-[#B42318]"
        : "bg-[#FFF7E6] text-[#B54708]";
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-black", className)}>
      {titleCaseStatus(status)}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: typeof Store;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
          <p className="mt-2 text-lg font-black text-[#101828]">{value}</p>
          {subValue ? <p className="mt-1 text-xs font-semibold text-[#667085]">{subValue}</p> : null}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#FFF0EC] text-[#ED3500]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function DetailPanel({
  icon: Icon,
  iconClassName,
  title,
  description,
  children,
}: {
  icon: typeof Store;
  iconClassName: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", iconClassName)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-black text-[#101828]">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function couponLabel(coupon: Coupon) {
  if (coupon.discountType === "FREE_SHIPPING") return "Free shipping";
  if (coupon.discountType === "PERCENTAGE") return `${(coupon.discountValueBps ?? 0) / 100}% off`;
  return `${formatMoney(coupon.discountAmountPaise ?? 0)} off`;
}

function couponSubLabel(coupon: Coupon) {
  if (coupon.discountType === "FREE_SHIPPING") return "Shipping only";
  if (coupon.maxDiscountPaise) return `Max ${formatMoney(coupon.maxDiscountPaise)}`;
  return coupon.fundingSource === "SELLER" ? "Seller funded" : "Platform funded";
}

function participationSummary(coupon: Coupon) {
  const items = coupon.sellerParticipations ?? [];
  if (!items.length) return "Not required";
  return `${items.filter((item) => item.status === "ACCEPTED").length} accepted / ${items.length}`;
}

function validityLabel(coupon: Coupon) {
  if (!coupon.startsAt && !coupon.endsAt) return "Open dates";
  const startsAt = coupon.startsAt ? formatShortDate(coupon.startsAt) : "Now";
  const endsAt = coupon.endsAt ? formatShortDate(coupon.endsAt) : "No end";
  return `${startsAt} - ${endsAt}`;
}

function validitySubLabel(coupon: Coupon) {
  if (coupon.status === "ARCHIVED") return "Archived";
  if (!coupon.endsAt) return "No end date";
  const end = new Date(coupon.endsAt);
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "Expired";
  if (days === 0) return "Ends today";
  return `${days} days remaining`;
}

function usagePercent(coupon: Coupon) {
  if (!coupon.totalUsageLimit) return 0;
  return Math.round((coupon.redeemedCount / coupon.totalUsageLimit) * 100);
}

function statusPillClass(status: CouponStatus) {
  if (status === "ACTIVE") return "bg-[#ECFDF3] text-[#067647]";
  if (status === "PAUSED") return "bg-[#FFF7E6] text-[#B54708]";
  if (status === "ARCHIVED") return "bg-[#F2F4F7] text-[#667085]";
  return "bg-[#EFF8FF] text-[#175CD3]";
}

function statusDotClass(status: CouponStatus) {
  if (status === "ACTIVE") return "bg-[#12B76A]";
  if (status === "PAUSED") return "bg-[#F79009]";
  if (status === "ARCHIVED") return "bg-[#98A2B3]";
  return "bg-[#2E90FA]";
}

function titleCaseStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function flattenCategories(categories: CategorySummary[], prefix = ""): Array<{ id: string; label: string }> {
  return categories.flatMap((category) => [
    { id: category.id, label: `${prefix}${category.name}` },
    ...flattenCategories(category.children ?? [], `${prefix}${category.name} / `),
  ]);
}
