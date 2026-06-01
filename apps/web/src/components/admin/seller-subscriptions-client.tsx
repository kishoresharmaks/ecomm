"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Pencil, Plus, ReceiptText, ShieldCheck, Store, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, AdminSwitch, type AdminSelectOption } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import {
  assignSellerSubscription,
  createSellerSubscriptionPlan,
  listAdminSellerSubscriptionPlans,
  setDefaultSellerSubscriptionPlan,
  updateSellerSubscriptionPlan,
  type PageResult,
  type SellerSubscriptionPlanPayload
} from "@/lib/seller-subscription-admin-api";
import type { SellerProfile, SellerSubscriptionPlan, SellerSubscriptionStatus } from "@/lib/seller-api";
import { formatMoney } from "@/lib/storefront-api";

type PlanFormState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  priceRupees: string;
  currency: string;
  billingCycle: "MONTHLY" | "YEARLY" | "LIFETIME";
  productLimit: string;
  featuredProductLimit: string;
  b2bEnquiryLimit: string;
  commissionDiscountBps: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
};

const emptyPlanForm: PlanFormState = {
  code: "",
  name: "",
  description: "",
  priceRupees: "0",
  currency: "INR",
  billingCycle: "MONTHLY",
  productLimit: "",
  featuredProductLimit: "",
  b2bEnquiryLimit: "",
  commissionDiscountBps: "0",
  isDefault: false,
  isActive: true,
  sortOrder: "100"
};

const billingCycleOptions: AdminSelectOption[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "LIFETIME", label: "Lifetime" }
];

const assignmentStatusOptions: AdminSelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" }
];

export function AdminSellerSubscriptionsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm);
  const [assignment, setAssignment] = useState({
    sellerId: "",
    planId: "",
    status: "ACTIVE" as SellerSubscriptionStatus,
    currentPeriodEnd: "",
    note: ""
  });

  const plansQuery = useQuery({
    queryKey: ["admin-seller-subscription-plans", auth.authHeaders, search],
    queryFn: () => listAdminSellerSubscriptionPlans(auth.authHeaders, { search, limit: 100 }),
    enabled: auth.isAuthenticated
  });

  const sellersQuery = useQuery({
    queryKey: ["admin-seller-subscription-sellers", auth.authHeaders],
    queryFn: () => indihubFetch<PageResult<SellerProfile>>("/api/admin/sellers?limit=100", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated
  });

  const plans = plansQuery.data?.items ?? [];
  const sellers = sellersQuery.data?.items ?? [];
  const defaultPlan = plans.find((plan) => plan.isDefault);
  const activePlans = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);
  const sellerOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select seller" },
      ...sellers.map((seller) => ({
        value: seller.id,
        label: seller.storeName,
        description: `${seller.subscriptionPlan?.name ?? "No plan"} / ${humanize(seller.subscriptionStatus)}`
      }))
    ],
    [sellers]
  );
  const planOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select plan" },
      ...activePlans.map((plan) => ({ value: plan.id, label: plan.name, description: plan.code }))
    ],
    [activePlans]
  );

  const savePlan = useMutation({
    mutationFn: (payload: SellerSubscriptionPlanPayload) =>
      planForm.id ? updateSellerSubscriptionPlan(auth.authHeaders, planForm.id, payload) : createSellerSubscriptionPlan(auth.authHeaders, payload),
    onSuccess: async () => {
      setPlanForm(emptyPlanForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-sellers"] });
    }
  });

  const setDefault = useMutation({
    mutationFn: (planId: string) => setDefaultSellerSubscriptionPlan(auth.authHeaders, planId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-plans"] })
  });

  const assignPlan = useMutation({
    mutationFn: () =>
      assignSellerSubscription(auth.authHeaders, assignment.sellerId, {
        planId: assignment.planId,
        status: assignment.status,
        ...(assignment.currentPeriodEnd ? { currentPeriodEnd: new Date(assignment.currentPeriodEnd).toISOString() } : {}),
        ...(assignment.note.trim() ? { note: assignment.note.trim() } : {})
      }),
    onSuccess: async () => {
      setAssignment({ sellerId: "", planId: "", status: "ACTIVE", currentPeriodEnd: "", note: "" });
      await queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-sellers"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-seller-subscription-plans"] });
    }
  });

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: SellerSubscriptionPlanPayload = {
      code: planForm.code.trim().toUpperCase(),
      name: planForm.name.trim(),
      description: planForm.description.trim(),
      pricePaise: rupeesToPaise(planForm.priceRupees),
      currency: planForm.currency.trim().toUpperCase() || "INR",
      billingCycle: planForm.billingCycle,
      commissionDiscountBps: numberOrZero(planForm.commissionDiscountBps),
      isDefault: planForm.isDefault,
      isActive: planForm.isActive,
      sortOrder: numberOrZero(planForm.sortOrder)
    };

    const productLimit = optionalNumber(planForm.productLimit);
    const featuredProductLimit = optionalNumber(planForm.featuredProductLimit);
    const b2bEnquiryLimit = optionalNumber(planForm.b2bEnquiryLimit);
    if (productLimit !== undefined) {
      payload.productLimit = productLimit;
    }
    if (featuredProductLimit !== undefined) {
      payload.featuredProductLimit = featuredProductLimit;
    }
    if (b2bEnquiryLimit !== undefined) {
      payload.b2bEnquiryLimit = b2bEnquiryLimit;
    }

    savePlan.mutate(payload);
  }

  function editPlan(plan: SellerSubscriptionPlan) {
    setPlanForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      priceRupees: String((plan.pricePaise ?? 0) / 100),
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      productLimit: plan.productLimit === null || plan.productLimit === undefined ? "" : String(plan.productLimit),
      featuredProductLimit: plan.featuredProductLimit === null || plan.featuredProductLimit === undefined ? "" : String(plan.featuredProductLimit),
      b2bEnquiryLimit: plan.b2bEnquiryLimit === null || plan.b2bEnquiryLimit === undefined ? "" : String(plan.b2bEnquiryLimit),
      commissionDiscountBps: String(plan.commissionDiscountBps ?? 0),
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder ?? 100)
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Plans" value={plans.length} note={`${activePlans.length} active`} />
        <SummaryTile label="Default plan" value={defaultPlan?.name ?? "Not set"} note="Used during seller onboarding" />
        <SummaryTile label="Assigned sellers" value={plans.reduce((total, plan) => total + (plan._count?.currentSellers ?? 0), 0)} note="Current plan links" />
        <SummaryTile label="Billing attention" value={sellers.filter((seller) => ["PENDING_PAYMENT", "EXPIRED"].includes(seller.subscriptionStatus ?? "")).length} note="Payment pending or expired" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title={planForm.id ? "Edit seller plan" : "Create seller plan"} description="Control onboarding defaults, plan price, and operational limits." />
          </div>

          <form onSubmit={submitPlan} className="mt-5 grid gap-3">
            <AdminField label="Plan code" value={planForm.code} onChange={(code) => setPlanForm({ ...planForm, code })} required placeholder="STARTER_FREE" />
            <AdminField label="Plan name" value={planForm.name} onChange={(name) => setPlanForm({ ...planForm, name })} required placeholder="Starter Free" />
            <label className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Description</span>
              <textarea
                value={planForm.description}
                onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })}
                rows={4}
                className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Price INR" type="number" min={0} step="0.01" value={planForm.priceRupees} onChange={(priceRupees) => setPlanForm({ ...planForm, priceRupees })} />
              <AdminListbox
                label="Billing cycle"
                value={planForm.billingCycle}
                options={billingCycleOptions}
                onChange={(billingCycle) => setPlanForm({ ...planForm, billingCycle: billingCycle as PlanFormState["billingCycle"] })}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <AdminField label="Products" type="number" min={0} value={planForm.productLimit} onChange={(productLimit) => setPlanForm({ ...planForm, productLimit })} placeholder="Unlimited" />
              <AdminField label="Featured" type="number" min={0} value={planForm.featuredProductLimit} onChange={(featuredProductLimit) => setPlanForm({ ...planForm, featuredProductLimit })} placeholder="0" />
              <AdminField label="B2B enquiries" type="number" min={0} value={planForm.b2bEnquiryLimit} onChange={(b2bEnquiryLimit) => setPlanForm({ ...planForm, b2bEnquiryLimit })} placeholder="Unlimited" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AdminField label="Discount bps" type="number" min={0} value={planForm.commissionDiscountBps} onChange={(commissionDiscountBps) => setPlanForm({ ...planForm, commissionDiscountBps })} />
              <AdminField label="Sort order" type="number" min={0} value={planForm.sortOrder} onChange={(sortOrder) => setPlanForm({ ...planForm, sortOrder })} />
            </div>

            <AdminSwitch
              label="Use as default onboarding plan"
              checked={planForm.isDefault}
              onChange={(isDefault) => setPlanForm({ ...planForm, isDefault })}
            />
            <AdminSwitch
              label="Plan is active"
              checked={planForm.isActive}
              onChange={(isActive) => setPlanForm({ ...planForm, isActive })}
            />

            {savePlan.error ? <p className="rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">{savePlan.error.message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savePlan.isPending || !planForm.code.trim() || !planForm.name.trim()}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {savePlan.isPending ? "Saving..." : planForm.id ? "Update plan" : "Create plan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPlanForm(emptyPlanForm)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New
              </Button>
            </div>
          </form>
        </section>

        <div className="grid gap-5">
          <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SectionHeading title="Seller plans" description="Default plan is automatically selected during seller registration." />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plans"
                className="h-10 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
              />
            </div>
            {plansQuery.isLoading ? <p className="mt-5 text-sm font-semibold text-[#667085]">Loading plans</p> : null}
            {plansQuery.error ? <p className="mt-5 rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">{plansQuery.error.message}</p> : null}
            <div className="mt-5 grid gap-3">
              {plans.map((plan) => (
                <article key={plan.id} className="rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-[#1F2933]">{plan.name}</h3>
                        {plan.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : null}
                        <StatusBadge tone={plan.isActive ? "success" : "danger"}>{plan.isActive ? "Active" : "Inactive"}</StatusBadge>
                        <StatusBadge tone="info">{humanize(plan.billingCycle)}</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#667085]">{plan.description ?? "No description set."}</p>
                      <p className="mt-2 text-sm font-black text-[#163B5C]">
                        {formatMoney(plan.pricePaise, plan.currency)} / {humanize(plan.billingCycle)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">
                        Products {limitLabel(plan.productLimit)} / Featured {limitLabel(plan.featuredProductLimit)} / B2B {limitLabel(plan.b2bEnquiryLimit)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#667085]">
                        {plan._count?.currentSellers ?? 0} sellers currently assigned / {plan._count?.subscriptions ?? 0} historical assignments
                      </p>
                      <p className="mt-1 text-xs font-bold text-[#667085]">
                        Razorpay plan {plan.providerPlanId ? `synced (${plan.providerPlanId})` : "will sync on first paid authorisation"} / version {plan.providerPlanVersion ?? 1}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => editPlan(plan)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button type="button" size="sm" onClick={() => setDefault.mutate(plan.id)} disabled={setDefault.isPending || plan.isDefault || !plan.isActive}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Set default
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
              {!plansQuery.isLoading && plans.length === 0 ? <p className="text-sm font-semibold text-[#667085]">No subscription plans found.</p> : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading title="Assign seller plan" description="Paid recurring plans move to seller Razorpay authorisation unless admin sets a manual status." />
            </div>
            <form
              className="mt-5 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                assignPlan.mutate();
              }}
            >
              <AdminSelect label="Seller" value={assignment.sellerId} options={sellerOptions} onChange={(sellerId) => setAssignment({ ...assignment, sellerId })} required />
              <AdminSelect label="Plan" value={assignment.planId} options={planOptions} onChange={(planId) => setAssignment({ ...assignment, planId })} required />
              <AdminSelect
                label="Status"
                value={assignment.status}
                options={assignmentStatusOptions}
                onChange={(status) => setAssignment({ ...assignment, status: status as SellerSubscriptionStatus })}
              />
              <AdminField label="Period end" type="date" value={assignment.currentPeriodEnd} onChange={(currentPeriodEnd) => setAssignment({ ...assignment, currentPeriodEnd })} />
              <label className="space-y-2 md:col-span-2">
                <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Admin note</span>
                <textarea
                  value={assignment.note}
                  onChange={(event) => setAssignment({ ...assignment, note: event.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              {assignPlan.error ? <p className="rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F] md:col-span-2">{assignPlan.error.message}</p> : null}
              <div className="md:col-span-2">
                <Button type="submit" disabled={assignPlan.isPending || !assignment.sellerId || !assignment.planId}>
                  <Store className="h-4 w-4" aria-hidden="true" />
                  {assignPlan.isPending ? "Assigning..." : "Assign seller plan"}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <SectionHeading title="Seller billing state" description="Recurring authorisation, grace-period, cancellation, and provider status by seller." />
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#D9E2EA] text-xs uppercase tracking-wide text-[#667085]">
                  <tr>
                    <th className="px-3 py-2">Seller</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Billing</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Failure</th>
                    <th className="px-3 py-2">Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {sellers.map((seller) => {
                    const current = seller.subscriptions?.[0];
                    return (
                      <tr key={seller.id}>
                        <td className="px-3 py-3 font-black text-[#1F2933]">{seller.storeName}</td>
                        <td className="px-3 py-3 font-semibold text-[#667085]">{seller.subscriptionPlan?.name ?? "No plan"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge tone={statusTone(seller.subscriptionStatus)}>{humanize(seller.subscriptionStatus)}</StatusBadge>
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#667085]">{current?.providerStatus ?? "Not authorised"}</td>
                        <td className="px-3 py-3 font-semibold text-[#667085]">{current?.paymentFailureCount ?? 0}</td>
                        <td className="px-3 py-3 font-semibold text-[#667085]">{current?.cancelAtPeriodEnd ? "Period end" : "No"}</td>
                      </tr>
                    );
                  })}
                  {!sellersQuery.isLoading && sellers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-sm font-semibold text-[#667085]">No sellers found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#667085]">{label}</p>
      <p className="mt-3 text-2xl font-black text-[#123A5A]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#667085]">{note}</p>
    </section>
  );
}

function AdminField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  min,
  step
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

function AdminSelect({
  label,
  value,
  onChange,
  required = false,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  options: AdminSelectOption[];
}) {
  return <AdminListbox label={label} value={value} options={options} onChange={onChange} required={required} />;
}

function rupeesToPaise(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function numberOrZero(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  return numberOrZero(value);
}

function limitLabel(value?: number | null) {
  return value === null || value === undefined ? "Unlimited" : value;
}

function humanize(value?: string | null) {
  return value ? value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not set";
}

function statusTone(status?: string | null): "success" | "warning" | "danger" | "info" {
  if (["ACTIVE", "TRIALING"].includes(status ?? "")) {
    return "success";
  }
  if (status === "PENDING_PAYMENT") {
    return "warning";
  }
  if (["EXPIRED", "CANCELLED"].includes(status ?? "")) {
    return "danger";
  }
  return "info";
}
