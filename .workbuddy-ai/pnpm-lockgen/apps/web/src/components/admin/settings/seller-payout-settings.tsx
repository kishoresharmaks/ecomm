"use client";

import { useEffect, useState } from "react";
import { IndianRupee, Save, WalletCards } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminSwitch } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import { readBooleanSettingValue, readNumberSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

const keys = {
  enabled: "seller.payout.requests_enabled",
  minimumPaise: "seller.payout.minimum_paise"
} as const;

export function SellerPayoutSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [minimumRupees, setMinimumRupees] = useState("100");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(booleanSetting(settings, keys.enabled, true));
    setMinimumRupees(String(numberSetting(settings, keys.minimumPaise, 10_000) / 100));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const minimumPaise = Math.max(0, Math.round(Number(minimumRupees || 0) * 100));
      await Promise.all([
        upsertSetting(auth.authHeaders, keys.enabled, "BOOLEAN", enabled),
        upsertSetting(auth.authHeaders, keys.minimumPaise, "NUMBER", minimumPaise)
      ]);
    },
    onSuccess: async () => {
      setNotice("Seller payout request settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Unable to save seller payout settings.")
  });

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <WalletCards className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Seller payout requests</h3>
              <StatusBadge tone={enabled ? "success" : "warning"}>{enabled ? "Enabled" : "Disabled"}</StatusBadge>
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Controls manual seller payout requests. RazorpayX can later use the same approval and ledger flow.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdminSwitch
          label="Allow seller requests"
          description="Sellers can request payout for eligible delivered and paid orders."
          checked={enabled}
          onChange={setEnabled}
        />
        <label className="space-y-2">
          <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">Minimum request amount</span>
          <div className="flex h-11 items-center gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 focus-within:border-[#ED3500] focus-within:bg-white">
            <IndianRupee className="h-4 w-4 text-[#667085]" aria-hidden="true" />
            <input
              type="number"
              min="0"
              step="1"
              value={minimumRupees}
              onChange={(event) => setMinimumRupees(event.target.value)}
              className="w-full bg-transparent text-sm font-bold text-[#1F2933] outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">Requests still require admin approval and manual payment reference before becoming paid.</p>
        <Button type="button" onClick={() => saveMutation.mutate()} disabled={!auth.isAuthenticated || saveMutation.isPending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save payout settings"}
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

function upsertSetting(authHeaders: { bearerToken?: string }, key: string, valueType: "BOOLEAN" | "NUMBER", value: boolean | number) {
  return indihubFetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ group: "seller_finance", valueType, value })
  }, authHeaders);
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
