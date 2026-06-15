"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgePercent, Ban, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { IndihubApiError } from "@/lib/api";
import {
  cancelAdminDeal,
  createAdminDeal,
  getAdminDealDashboard,
  listAdminDeals,
  publishAdminDeal,
  type AdminDeal,
  type DealPayload,
  type DealStatus,
} from "@/lib/deals-api";
import { formatMoney, listCategories, type CategorySummary } from "@/lib/storefront-api";

const statusOptions: Array<DealStatus | "ALL"> = ["ALL", "DRAFT", "PUBLISHED", "CANCELLED"];

type DealFormState = {
  title: string;
  description: string;
  categoryId: string;
  discountPercent: string;
  joinDeadline: string;
  startsAt: string;
  endsAt: string;
  maxSellers: string;
  maxProducts: string;
};

const emptyForm: DealFormState = {
  title: "",
  description: "",
  categoryId: "",
  discountPercent: "20",
  joinDeadline: "",
  startsAt: "",
  endsAt: "",
  maxSellers: "",
  maxProducts: "",
};

export function AdminDealsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DealStatus | "ALL">("ALL");
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [form, setForm] = useState<DealFormState>(() => defaultDealForm());
  const [notice, setNotice] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["deal-categories"],
    queryFn: listCategories,
  });
  const dealsQuery = useQuery({
    queryKey: ["admin-deals", auth.token, status],
    queryFn: () => listAdminDeals(auth.authHeaders, { ...(status !== "ALL" ? { status } : {}), limit: 50 }),
    enabled: auth.isAuthenticated,
  });
  const selectedDeal = useMemo(
    () => dealsQuery.data?.items.find((deal) => deal.id === selectedDealId) ?? dealsQuery.data?.items[0] ?? null,
    [dealsQuery.data?.items, selectedDealId],
  );
  const dashboardQuery = useQuery({
    queryKey: ["admin-deal-dashboard", auth.token, selectedDeal?.id],
    queryFn: () => getAdminDealDashboard(auth.authHeaders, selectedDeal?.id ?? ""),
    enabled: auth.isAuthenticated && Boolean(selectedDeal?.id),
  });

  const createMutation = useMutation({
    mutationFn: (payload: DealPayload) => createAdminDeal(auth.authHeaders, payload),
    onSuccess: (deal) => {
      setNotice("Deal created.");
      setSelectedDealId(deal.id);
      setForm(defaultDealForm());
      void queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const publishMutation = useMutation({
    mutationFn: (dealId: string) => publishAdminDeal(auth.authHeaders, dealId),
    onSuccess: () => {
      setNotice("Deal published and seller availability is logged.");
      void queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-deal-dashboard"] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const cancelMutation = useMutation({
    mutationFn: (dealId: string) => cancelAdminDeal(auth.authHeaders, dealId),
    onSuccess: () => {
      setNotice("Deal cancelled. Active pricing stops immediately.");
      void queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-deal-dashboard"] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });

  function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = dealPayloadFromForm(form);
    createMutation.mutate(payload);
  }

  const categories = flattenCategoryOptions(categoriesQuery.data ?? []);

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Campaign setup</p>
            <h2 className="mt-2 text-xl font-black text-[#1F2933]">Create deal</h2>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <BadgePercent className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <form className="mt-5 grid gap-3" onSubmit={submitDeal}>
          <AdminDealField label="Title" value={form.title} onChange={(title) => setForm((current) => ({ ...current, title }))} required />
          <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 rounded-md border border-[#D8E2EA] px-3 py-2 text-sm font-semibold outline-none focus:border-[#ED3500]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
            Category
            <select
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <AdminDealField label="Discount %" type="number" min={1} max={90} value={form.discountPercent} onChange={(discountPercent) => setForm((current) => ({ ...current, discountPercent }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminDealField label="Join deadline" type="datetime-local" value={form.joinDeadline} onChange={(joinDeadline) => setForm((current) => ({ ...current, joinDeadline }))} required />
            <AdminDealField label="Starts at" type="datetime-local" value={form.startsAt} onChange={(startsAt) => setForm((current) => ({ ...current, startsAt }))} required />
          </div>
          <AdminDealField label="Ends at" type="datetime-local" value={form.endsAt} onChange={(endsAt) => setForm((current) => ({ ...current, endsAt }))} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminDealField label="Max sellers" type="number" min={1} value={form.maxSellers} onChange={(maxSellers) => setForm((current) => ({ ...current, maxSellers }))} />
            <AdminDealField label="Max products" type="number" min={1} value={form.maxProducts} onChange={(maxProducts) => setForm((current) => ({ ...current, maxProducts }))} />
          </div>
          {notice ? <p className="rounded-md border border-[#FFE0D6] bg-[#FFF8F5] px-3 py-2 text-sm font-bold text-[#9F2600]">{notice}</p> : null}
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {createMutation.isPending ? "Creating" : "Create deal"}
          </Button>
        </form>
      </section>

      <section className="grid gap-5">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#1F2933]">Deal campaigns</h2>
              <p className="mt-1 text-sm font-semibold text-[#667085]">Publish when ready; sellers can join until the deadline.</p>
            </div>
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as DealStatus | "ALL")}
                className="h-10 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-bold"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All statuses" : option}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => void dealsQuery.refetch()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {dealsQuery.data?.items.map((deal) => (
              <DealListCard
                key={deal.id}
                deal={deal}
                selected={selectedDeal?.id === deal.id}
                onSelect={() => setSelectedDealId(deal.id)}
                onPublish={() => publishMutation.mutate(deal.id)}
                onCancel={() => cancelMutation.mutate(deal.id)}
                busy={publishMutation.isPending || cancelMutation.isPending}
              />
            ))}
            {!dealsQuery.isLoading && !dealsQuery.data?.items.length ? (
              <p className="rounded-md border border-dashed border-[#D8E2EA] p-5 text-sm font-semibold text-[#667085]">No deal campaigns found.</p>
            ) : null}
          </div>
        </div>

        {selectedDeal ? (
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">Dashboard</p>
                <h2 className="mt-1 text-xl font-black text-[#1F2933]">{selectedDeal.title}</h2>
              </div>
              <DealStatusBadge status={selectedDeal.status} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <DealMetric label="Accepted sellers" value={dashboardQuery.data?.metrics.acceptedSellers ?? 0} />
              <DealMetric label="Products" value={dashboardQuery.data?.metrics.enrolledProducts ?? 0} />
              <DealMetric label="Orders" value={dashboardQuery.data?.metrics.orderCount ?? 0} />
              <DealMetric label="Revenue" value={formatMoney(dashboardQuery.data?.metrics.revenuePaise ?? 0)} />
              <DealMetric label="Discount" value={formatMoney(dashboardQuery.data?.metrics.discountPaise ?? 0)} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DealListCard({
  deal,
  selected,
  onSelect,
  onPublish,
  onCancel,
  busy,
}: {
  deal: AdminDeal;
  selected: boolean;
  onSelect: () => void;
  onPublish: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <article className={`rounded-lg border p-4 ${selected ? "border-[#ED3500] bg-[#FFF8F5]" : "border-[#E5E7EB] bg-white"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={onSelect} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DealStatusBadge status={deal.status} />
            <span className="rounded-full bg-[#EAF4FF] px-2.5 py-1 text-xs font-black text-[#175CD3]">{deal.discountBps / 100}% off</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-[#1F2933]">{deal.title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#667085]">{deal.category?.name ?? "Category"} · Join by {formatDate(deal.joinDeadline)}</p>
        </button>
        <div className="flex flex-wrap gap-2">
          {deal.status === "DRAFT" ? (
            <Button type="button" size="sm" onClick={onPublish} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Publish
            </Button>
          ) : null}
          {deal.status !== "CANCELLED" ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              <Ban className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={onSelect}>
            View <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function AdminDealField({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#1F2933]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-md border border-[#D8E2EA] px-3 text-sm font-semibold outline-none focus:border-[#ED3500]"
      />
    </label>
  );
}

function DealMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#E8EDF2] bg-[#FCFDFE] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#667085]">{label}</p>
      <p className="mt-2 text-xl font-black text-[#163B5C]">{value}</p>
    </div>
  );
}

function DealStatusBadge({ status }: { status: DealStatus }) {
  const tone = status === "PUBLISHED" ? "success" : status === "CANCELLED" ? "danger" : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function defaultDealForm(): DealFormState {
  const now = new Date();
  const join = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const start = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000);
  return {
    ...emptyForm,
    joinDeadline: toLocalInputValue(join),
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
  };
}

function dealPayloadFromForm(form: DealFormState): DealPayload {
  const payload: DealPayload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    categoryId: form.categoryId,
    discountPercent: Number(form.discountPercent),
    joinDeadline: localInputToIso(form.joinDeadline),
    startsAt: localInputToIso(form.startsAt),
    endsAt: localInputToIso(form.endsAt),
  };
  if (form.maxSellers) {
    payload.maxSellers = Number(form.maxSellers);
  }
  if (form.maxProducts) {
    payload.maxProducts = Number(form.maxProducts);
  }
  return payload;
}

function flattenCategoryOptions(categories: CategorySummary[]) {
  const options: Array<{ id: string; label: string }> = [];
  function visit(category: CategorySummary, ancestors: string[] = []) {
    const label = [...ancestors, category.name].join(" / ");
    options.push({ id: category.id, label });
    category.children?.forEach((child) => visit(child, [...ancestors, category.name]));
  }
  categories.forEach((category) => visit(category));
  return options;
}

function toLocalInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof IndihubApiError || error instanceof Error ? error.message : "Deal action failed.";
}
