"use client";

import { useState, useMemo } from "react";
import { Store, UserRound, ReceiptText } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, AdminConfirmationDialog, type AdminSelectOption } from "@/components/admin/admin-ux";
import {
  listAdminSubscribedSellers,
  listAdminSellerSubscriptionPlans,
  assignSellerSubscription,
} from "@/lib/seller-subscription-admin-api";
import { indihubFetch } from "@/lib/api";
import type { SellerProfile, SellerSubscriptionStatus } from "@/lib/seller-api";

const assignmentStatusOptions: AdminSelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" }
];

export function SubscribedSellersClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [assignment, setAssignment] = useState({
    sellerId: "",
    planId: "",
    status: "ACTIVE" as SellerSubscriptionStatus,
    currentPeriodEnd: "",
    note: ""
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["admin-subscribed-sellers", auth.authHeaders, search],
    queryFn: () => listAdminSubscribedSellers(auth.authHeaders, { search, limit: 100 }),
    enabled: auth.isAuthenticated
  });

  const sellersQuery = useQuery({
    queryKey: ["admin-sellers-summary", auth.authHeaders],
    queryFn: () => indihubFetch<{ items: SellerProfile[] }>("/api/admin/sellers?limit=100", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated
  });

  const plansQuery = useQuery({
    queryKey: ["admin-seller-subscription-plans", auth.authHeaders],
    queryFn: () => listAdminSellerSubscriptionPlans(auth.authHeaders, { limit: 100 }),
    enabled: auth.isAuthenticated
  });

  const assignPlan = useMutation({
    mutationFn: () =>
      assignSellerSubscription(auth.authHeaders, assignment.sellerId, {
        planId: assignment.planId,
        status: assignment.status,
        ...(assignment.currentPeriodEnd ? { currentPeriodEnd: new Date(assignment.currentPeriodEnd).toISOString() } : {}),
        ...(assignment.note?.trim() ? { note: assignment.note.trim() } : {})
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscribed-sellers"] });
      setAssignment({
        sellerId: "",
        planId: "",
        status: "ACTIVE",
        currentPeriodEnd: "",
        note: ""
      });
    }
  });

  const subscriptions = subscriptionsQuery.data?.items ?? [];
  const sellers = sellersQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];

  const sellerOptions: AdminSelectOption[] = useMemo(() => {
    return sellers.map((s) => ({ value: s.id, label: s.storeName }));
  }, [sellers]);

  const planOptions: AdminSelectOption[] = useMemo(() => {
    const sorted = [...plans].sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
    return sorted.map((p) => ({ value: p.id, label: p.name }));
  }, [plans]);

  function statusTone(status?: string | null) {
    if (status === "ACTIVE") return "success";
    if (status === "TRIALING") return "info";
    if (status === "PENDING_PAYMENT") return "warning";
    if (status === "CANCELLED" || status === "EXPIRED") return "neutral";
    return "danger";
  }

  function humanize(value?: string | null) {
    if (!value) return "Unknown";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase().replace(/_/g, " ");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-5">
        <section className="rounded-lg border border-[#D9E2EA] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title="Active Subscriptions" description="Recurring authorisation, grace-period, cancellation, and provider status by seller." />
          </div>
          
          <div className="mt-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subscribed sellers"
              className="h-10 w-full max-w-md rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
            />
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
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-3 py-3 font-black text-[#1F2933]">{sub.seller?.storeName}</td>
                    <td className="px-3 py-3 font-semibold text-[#667085]">{sub.plan?.name ?? "Unknown plan"}</td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={statusTone(sub.status)}>{humanize(sub.status)}</StatusBadge>
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#667085]">{sub.providerStatus ?? "Not authorised"}</td>
                    <td className="px-3 py-3 font-semibold text-[#667085]">{sub.paymentFailureCount ?? 0}</td>
                    <td className="px-3 py-3 font-semibold text-[#667085]">{sub.cancelAtPeriodEnd ? "Period end" : "No"}</td>
                  </tr>
                ))}
                {!subscriptionsQuery.isLoading && subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-sm font-semibold text-[#667085]">No active subscriptions found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
              setConfirmationOpen(true);
            }}
          >
            <AdminSelect label="Seller" value={assignment.sellerId} options={sellerOptions} onChange={(sellerId) => setAssignment({ ...assignment, sellerId, planId: "" })} required />
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
      </div>

      <AdminConfirmationDialog
        open={confirmationOpen}
        title="Assign seller plan"
        description="Are you sure you want to assign this subscription plan to the selected seller? Recurring billing and operational limits may be impacted immediately."
        confirmLabel="Assign plan"
        tone="warning"
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => {
          setConfirmationOpen(false);
          assignPlan.mutate();
        }}
      />
    </div>
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
  step,
  helpText
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
  helpText?: React.ReactNode;
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
      {helpText ? <p className="text-[11px] font-semibold text-[#667085] leading-tight">{helpText}</p> : null}
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
