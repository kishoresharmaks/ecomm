"use client";

import { FormEvent, useMemo, useState } from "react";
import { Calculator, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, type AdminSelectOption } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import {
  bpsToPercent,
  createCommissionRule,
  listCommissionRules,
  setCommissionRuleActive,
  updateCommissionRule,
  type CommissionRule,
  type CommissionRulePayload,
  type FinanceSeller,
  type PageResult
} from "@/lib/admin-finance-api";
import { listCategories, type CategorySummary } from "@/lib/storefront-api";
import { FinancePageHeader, FinancePanel, FinanceState, FinanceStatus } from "./finance-ui";

type RuleFormState = {
  id?: string;
  name: string;
  scope: CommissionRulePayload["scope"];
  sellerId: string;
  categoryId: string;
  commissionType: "PERCENTAGE" | "FIXED" | "MANUAL";
  commissionRatePercent: string;
  commissionFixedPaise: string;
  gstRatePercent: string;
  tdsRatePercent: string;
  tcsRatePercent: string;
  platformFeeType: "PERCENTAGE" | "FIXED" | "MANUAL";
  platformFeeRatePercent: string;
  platformFeeFixedPaise: string;
  priority: string;
};

const emptyForm: RuleFormState = {
  name: "",
  scope: "GLOBAL",
  sellerId: "",
  categoryId: "",
  commissionType: "PERCENTAGE",
  commissionRatePercent: "0",
  commissionFixedPaise: "0",
  gstRatePercent: "0",
  tdsRatePercent: "0",
  tcsRatePercent: "0",
  platformFeeType: "MANUAL",
  platformFeeRatePercent: "0",
  platformFeeFixedPaise: "0",
  priority: "100"
};

const scopeOptions: AdminSelectOption[] = [
  { value: "GLOBAL", label: "Global" },
  { value: "CATEGORY", label: "Category" },
  { value: "SELLER", label: "Seller" },
  { value: "SELLER_CATEGORY", label: "Seller + category" }
];

const commissionTypeOptions: AdminSelectOption[] = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed paise" }
];

const platformFeeTypeOptions: AdminSelectOption[] = [
  { value: "MANUAL", label: "None" },
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed paise" }
];

export function AdminCommissionRulesClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RuleFormState>(emptyForm);
  const rulesQuery = useQuery({
    queryKey: ["admin-finance-commission-rules", auth.authHeaders],
    queryFn: () => listCommissionRules(auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const sellersQuery = useQuery({
    queryKey: ["admin-finance-sellers", auth.authHeaders],
    queryFn: () => indihubFetch<PageResult<FinanceSeller>>("/api/admin/sellers?limit=100", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated
  });
  const categoriesQuery = useQuery({
    queryKey: ["finance-categories"],
    queryFn: listCategories
  });
  const saveRule = useMutation({
    mutationFn: (payload: CommissionRulePayload) =>
      form.id ? updateCommissionRule(auth.authHeaders, form.id, payload) : createCommissionRule(auth.authHeaders, payload),
    onSuccess: async () => {
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ["admin-finance-commission-rules"] });
    }
  });
  const toggleRule = useMutation({
    mutationFn: ({ ruleId, active }: { ruleId: string; active: boolean }) => setCommissionRuleActive(auth.authHeaders, ruleId, active),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["admin-finance-commission-rules"] })
  });
  const categories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const sellerOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select seller" },
      ...(sellersQuery.data?.items ?? []).map((seller) => ({ value: seller.id, label: seller.storeName }))
    ],
    [sellersQuery.data?.items]
  );
  const categoryOptions = useMemo<AdminSelectOption[]>(
    () => [
      { value: "", label: "Select category" },
      ...categories.map((category) => ({ value: category.id, label: category.name }))
    ],
    [categories]
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: CommissionRulePayload = {
      name: form.name,
      scope: form.scope,
      commissionType: form.commissionType,
      commissionRatePercent: numberValue(form.commissionRatePercent),
      commissionFixedPaise: numberValue(form.commissionFixedPaise),
      gstRatePercent: numberValue(form.gstRatePercent),
      tdsRatePercent: numberValue(form.tdsRatePercent),
      tcsRatePercent: numberValue(form.tcsRatePercent),
      platformFeeType: form.platformFeeType,
      platformFeeRatePercent: numberValue(form.platformFeeRatePercent),
      platformFeeFixedPaise: numberValue(form.platformFeeFixedPaise),
      priority: numberValue(form.priority)
    };
    if (["SELLER", "SELLER_CATEGORY"].includes(form.scope)) {
      payload.sellerId = form.sellerId;
    }
    if (["CATEGORY", "SELLER_CATEGORY"].includes(form.scope)) {
      payload.categoryId = form.categoryId;
    }
    saveRule.mutate(payload);
  }

  return (
    <div className="grid gap-5">
      <FinancePageHeader
        title="Commission rules"
        description="Manage seller payout deductions: commission, GST on commission, TDS/TCS, and seller settlement fees with clear precedence."
        actions={
          <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New rule
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <FinancePanel>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </span>
            <SectionHeading title={form.id ? "Edit rule" : "Create rule"} description="Percent inputs are stored as precise basis points." />
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-3">
            <FinanceInput label="Rule name" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <FinanceSelect label="Scope" value={form.scope} options={scopeOptions} onChange={(scope) => setForm({ ...form, scope: scope as RuleFormState["scope"] })} />
            {["SELLER", "SELLER_CATEGORY"].includes(form.scope) ? (
              <FinanceSelect label="Seller" value={form.sellerId} options={sellerOptions} onChange={(sellerId) => setForm({ ...form, sellerId })} required />
            ) : null}
            {["CATEGORY", "SELLER_CATEGORY"].includes(form.scope) ? (
              <FinanceSelect label="Category" value={form.categoryId} options={categoryOptions} onChange={(categoryId) => setForm({ ...form, categoryId })} required />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <FinanceSelect label="Commission type" value={form.commissionType} options={commissionTypeOptions} onChange={(commissionType) => setForm({ ...form, commissionType: commissionType as RuleFormState["commissionType"] })} />
              {form.commissionType === "PERCENTAGE" ? (
                <FinanceInput label="Commission %" value={form.commissionRatePercent} onChange={(commissionRatePercent) => setForm({ ...form, commissionRatePercent })} type="number" step="0.01" required />
              ) : (
                <FinanceInput label="Commission paise" value={form.commissionFixedPaise} onChange={(commissionFixedPaise) => setForm({ ...form, commissionFixedPaise })} type="number" required />
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FinanceInput label="GST %" value={form.gstRatePercent} onChange={(gstRatePercent) => setForm({ ...form, gstRatePercent })} type="number" step="0.01" />
              <FinanceInput label="TDS %" value={form.tdsRatePercent} onChange={(tdsRatePercent) => setForm({ ...form, tdsRatePercent })} type="number" step="0.01" />
              <FinanceInput label="TCS %" value={form.tcsRatePercent} onChange={(tcsRatePercent) => setForm({ ...form, tcsRatePercent })} type="number" step="0.01" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FinanceSelect label="Seller settlement fee" value={form.platformFeeType} options={platformFeeTypeOptions} onChange={(platformFeeType) => setForm({ ...form, platformFeeType: platformFeeType as RuleFormState["platformFeeType"] })} />
              {form.platformFeeType === "PERCENTAGE" ? (
                <FinanceInput label="Seller settlement fee %" value={form.platformFeeRatePercent} onChange={(platformFeeRatePercent) => setForm({ ...form, platformFeeRatePercent })} type="number" step="0.01" />
              ) : form.platformFeeType === "FIXED" ? (
                <FinanceInput label="Seller settlement fee paise" value={form.platformFeeFixedPaise} onChange={(platformFeeFixedPaise) => setForm({ ...form, platformFeeFixedPaise })} type="number" />
              ) : null}
            </div>
            <FinanceInput label="Priority" value={form.priority} onChange={(priority) => setForm({ ...form, priority })} type="number" />
            {saveRule.error ? <p className="rounded-md bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">{saveRule.error.message}</p> : null}
            <Button type="submit" disabled={saveRule.isPending || !form.name.trim()}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {saveRule.isPending ? "Saving..." : form.id ? "Update rule" : "Create rule"}
            </Button>
          </form>
        </FinancePanel>

        <div className="grid gap-4">
          <FinanceState loading={rulesQuery.isLoading} error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />
          {(rulesQuery.data?.items ?? []).map((rule) => (
            <FinancePanel key={rule.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-[#1F2933]">{rule.name}</h3>
                    <FinanceStatus status={rule.active ? "APPROVED" : "CANCELLED"} />
                    <FinanceStatus status={rule.scope} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#667085]">
                    {rule.seller?.storeName ?? "All sellers"} / {rule.category?.name ?? "All categories"} / priority {rule.priority}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#163B5C]">
                    Commission {rule.commissionType === "PERCENTAGE" ? `${bpsToPercent(rule.commissionValueBps)}%` : `${rule.commissionFixedPaise ?? 0} paise`} / GST {bpsToPercent(rule.gstRateBps)}% / TDS {bpsToPercent(rule.tdsRateBps)}% / TCS {bpsToPercent(rule.tcsRateBps)}%
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#667085]">
                    Seller settlement fee: {settlementFeeLabel(rule)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(formFromRule(rule))}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleRule.mutate({ ruleId: rule.id, active: !rule.active })}>
                    {rule.active ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </FinancePanel>
          ))}
          {!rulesQuery.isLoading && (rulesQuery.data?.items ?? []).length === 0 ? <FinanceState empty="No commission rules yet" /> : null}
        </div>
      </div>
    </div>
  );
}

function FinanceInput({ label, value, onChange, type = "text", step, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; step?: string; required?: boolean }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} step={step} required={required} className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white" />
    </label>
  );
}

function FinanceSelect({
  label,
  value,
  onChange,
  options,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  required?: boolean | undefined;
}) {
  return <AdminListbox label={label} value={value} options={options} onChange={onChange} required={required} />;
}

function formFromRule(rule: CommissionRule): RuleFormState {
  return {
    id: rule.id,
    name: rule.name,
    scope: rule.scope,
    sellerId: rule.sellerId ?? "",
    categoryId: rule.categoryId ?? "",
    commissionType: rule.commissionType,
    commissionRatePercent: String(bpsToPercent(rule.commissionValueBps)),
    commissionFixedPaise: String(rule.commissionFixedPaise ?? 0),
    gstRatePercent: String(bpsToPercent(rule.gstRateBps)),
    tdsRatePercent: String(bpsToPercent(rule.tdsRateBps)),
    tcsRatePercent: String(bpsToPercent(rule.tcsRateBps)),
    platformFeeType: rule.platformFeeType,
    platformFeeRatePercent: String(bpsToPercent(rule.platformFeeValueBps)),
    platformFeeFixedPaise: String(rule.platformFeeFixedPaise ?? 0),
    priority: String(rule.priority)
  };
}

function numberValue(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function settlementFeeLabel(rule: CommissionRule) {
  if (rule.platformFeeType === "PERCENTAGE") {
    return `${bpsToPercent(rule.platformFeeValueBps)}% deducted from seller payout`;
  }

  if (rule.platformFeeType === "FIXED") {
    return `${rule.platformFeeFixedPaise ?? 0} paise deducted from seller payout`;
  }

  return "None";
}

function flattenCategories(categories: CategorySummary[]): CategorySummary[] {
  return categories.flatMap((category) => [category, ...(category.children ? flattenCategories(category.children) : [])]);
}
