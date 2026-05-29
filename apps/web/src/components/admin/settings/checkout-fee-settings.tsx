"use client";

import { useEffect, useState } from "react";
import { BadgePercent, IndianRupee, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminListbox, AdminSwitch, type AdminSelectOption } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import { readBooleanSettingValue, readNumberSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

type FeeType = "PERCENTAGE" | "FIXED" | "MANUAL";
type CheckoutPlatformFeeResponse = {
  enabled: boolean;
  type: FeeType;
  valueBps: number;
  fixedPaise: number;
};

const keys = {
  enabled: "checkout.platform_fee.enabled",
  type: "checkout.platform_fee.type",
  valueBps: "checkout.platform_fee.value_bps",
  fixedPaise: "checkout.platform_fee.fixed_paise"
} as const;

const feeTypeOptions: AdminSelectOption[] = [
  { value: "PERCENTAGE", label: "Percentage of order subtotal" },
  { value: "FIXED", label: "Fixed amount per order" },
  { value: "MANUAL", label: "No automatic fee" }
];

export function CheckoutFeeSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [feeType, setFeeType] = useState<FeeType>("PERCENTAGE");
  const [percentage, setPercentage] = useState("0");
  const [fixedRupees, setFixedRupees] = useState("0");
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const percentNumber = Math.max(0, Number(percentage || 0));
  const fixedNumber = Math.max(0, Number(fixedRupees || 0));
  const previewText =
    !enabled || feeType === "MANUAL"
      ? "No platform fee is added to buyer checkout."
      : feeType === "PERCENTAGE"
        ? `Calculated once from the order subtotal. A Rs.100 subtotal will show Rs.${formatPreviewAmount(percentNumber)} as platform fee.`
        : `Charged once per checkout, not per item. Every order will show Rs.${formatPreviewAmount(fixedNumber)} as platform fee.`;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const valueBps = Math.max(0, Math.round(Number(percentage || 0) * 100));
      const fixedPaise = Math.max(0, Math.round(Number(fixedRupees || 0) * 100));
      return indihubFetch<CheckoutPlatformFeeResponse>("/api/admin/settings/checkout/platform-fee", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          type: feeType,
          valueBps,
          fixedPaise
        })
      }, auth.authHeaders);
    },
    onSuccess: async (result) => {
      setEnabled(result.enabled);
      setFeeType(result.type);
      setPercentage(String(result.valueBps / 100));
      setFixedRupees(String(result.fixedPaise / 100));
      setIsDirty(false);
      setNotice("Checkout platform fee saved and applied.");
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["checkout-platform-fee-current"] });
      await queryClient.invalidateQueries({ queryKey: ["checkout-summary"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to save checkout platform fee.")
  });

  useEffect(() => {
    if (isDirty || saveMutation.isPending) {
      return;
    }

    setEnabled(booleanSetting(settings, keys.enabled, false));
    setFeeType(feeTypeSetting(settings, keys.type, "PERCENTAGE"));
    setPercentage(String(numberSetting(settings, keys.valueBps, 0) / 100));
    setFixedRupees(String(numberSetting(settings, keys.fixedPaise, 0) / 100));
  }, [isDirty, saveMutation.isPending, settings]);
  const updateEnabled = (value: boolean) => {
    setEnabled(value);
    markDirty();
  };
  const updateFeeType = (value: string) => {
    setFeeType(value as FeeType);
    markDirty();
  };
  const updatePercentage = (value: string) => {
    setPercentage(value);
    markDirty();
  };
  const updateFixedRupees = (value: string) => {
    setFixedRupees(value);
    markDirty();
  };

  function markDirty() {
    setIsDirty(true);
    setNotice(null);
  }

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <BadgePercent className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Checkout platform fee</h3>
              <StatusBadge tone={isDirty ? "warning" : enabled ? "success" : "warning"}>
                {isDirty ? "Unsaved changes" : enabled ? "Applied at checkout" : "Disabled"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Buyer-facing fee added once to cart, checkout, payment amount, and order totals. Changes become live only after saving.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <AdminSwitch
          label="Enable fee"
          description="Apply the buyer-facing platform fee at checkout."
          checked={enabled}
          onChange={updateEnabled}
          disabled={saveMutation.isPending}
        />

        <AdminListbox
          label="Fee type"
          value={feeType}
          options={feeTypeOptions}
          onChange={updateFeeType}
          disabled={saveMutation.isPending}
        />

        {feeType === "PERCENTAGE" ? (
          <label className="space-y-2">
            <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Percentage of subtotal</span>
            <div className="flex h-11 items-center rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 focus-within:border-[#ED3500] focus-within:bg-white">
              <input
                type="number"
                min="0"
                step="0.01"
                value={percentage}
                onChange={(event) => updatePercentage(event.target.value)}
                disabled={saveMutation.isPending}
                className="w-full bg-transparent text-sm font-bold text-[#1F2933] outline-none"
              />
              <span className="text-[#667085]">%</span>
            </div>
          </label>
        ) : feeType === "FIXED" ? (
          <label className="space-y-2">
            <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Fixed amount per order</span>
            <div className="flex h-11 items-center gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 focus-within:border-[#ED3500] focus-within:bg-white">
              <IndianRupee className="h-4 w-4 text-[#667085]" aria-hidden="true" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={fixedRupees}
                onChange={(event) => updateFixedRupees(event.target.value)}
                disabled={saveMutation.isPending}
                className="w-full bg-transparent text-sm font-bold text-[#1F2933] outline-none"
              />
            </div>
          </label>
        ) : (
          <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            Automatic buyer platform fee is off for this fee type.
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">
          {previewText} {isDirty ? "Save to persist this after refresh." : ""}
        </p>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={!auth.isAuthenticated || saveMutation.isPending || !isDirty}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save and apply fee"}
        </Button>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-md border p-3 text-sm font-semibold ${saveMutation.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}>
          {notice}
        </p>
      ) : null}
    </section>
  );
}

export function CheckoutFeeSettingsFromApi() {
  const auth = useAdminAuth();
  const platformFeeQuery = useQuery({
    queryKey: ["checkout-platform-fee-current", auth.authHeaders],
    queryFn: () => indihubFetch<CheckoutPlatformFeeResponse>("/api/admin/settings/checkout/platform-fee", undefined, auth.authHeaders),
    enabled: auth.isAuthenticated
  });

  if (platformFeeQuery.isLoading) {
    return (
      <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 text-sm font-black text-[#163B5C] shadow-sm">
        Loading checkout platform fee
      </section>
    );
  }

  if (platformFeeQuery.isError || !platformFeeQuery.data) {
    return (
      <section className="rounded-lg border border-[#F5B7B7] bg-white p-5 text-sm font-black text-[#8A1F1F] shadow-sm">
        {platformFeeQuery.error instanceof Error ? platformFeeQuery.error.message : "Unable to load checkout platform fee."}
      </section>
    );
  }

  return (
    <CheckoutFeeSettings
      settings={[
        { key: keys.enabled, value: platformFeeQuery.data.enabled },
        { key: keys.type, value: platformFeeQuery.data.type },
        { key: keys.valueBps, value: platformFeeQuery.data.valueBps },
        { key: keys.fixedPaise, value: platformFeeQuery.data.fixedPaise }
      ]}
    />
  );
}

function settingValue(settings: SettingRecord[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function booleanSetting(settings: SettingRecord[], key: string, fallback: boolean) {
  return readBooleanSettingValue(settingValue(settings, key), fallback);
}

function numberSetting(settings: SettingRecord[], key: string, fallback: number) {
  return readNumberSettingValue(settingValue(settings, key), fallback);
}

function feeTypeSetting(settings: SettingRecord[], key: string, fallback: FeeType): FeeType {
  const value = settingValue(settings, key);
  return value === "PERCENTAGE" || value === "FIXED" || value === "MANUAL" ? value : fallback;
}

function formatPreviewAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}
