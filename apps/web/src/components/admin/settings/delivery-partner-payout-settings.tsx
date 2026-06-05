"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, IndianRupee, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { AdminSwitch } from "@/components/admin/admin-ux";
import { indihubFetch } from "@/lib/api";
import { readBooleanSettingValue, readNumberSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

type DeliveryPartnerPayoutSettingsResponse = {
  minimumPerOrderPaise: number;
  basePayPaise: number;
  perKmPaise: number;
  codBonusPaise: number;
  minimumWalletPayoutPaise: number;
  requestsEnabled: boolean;
  freeDeliveryPlatformSubsidyEnabled: boolean;
};

type DeliveryPartnerPayoutSettingsForm = {
  minimumPerOrderRupees: string;
  basePayRupees: string;
  perKmRupees: string;
  codBonusRupees: string;
  minimumWalletPayoutRupees: string;
  requestsEnabled: boolean;
  freeDeliveryPlatformSubsidyEnabled: boolean;
};

const keys = {
  minimumPerOrderPaise: "delivery_partner.payout.minimum_per_order_paise",
  basePayPaise: "delivery_partner.payout.base_pay_paise",
  perKmPaise: "delivery_partner.payout.per_km_paise",
  codBonusPaise: "delivery_partner.payout.cod_bonus_paise",
  minimumWalletPayoutPaise: "delivery_partner.payout.minimum_wallet_payout_paise",
  requestsEnabled: "delivery_partner.payout.requests_enabled",
  freeDeliveryPlatformSubsidyEnabled:
    "delivery_partner.payout.free_delivery_platform_subsidy_enabled",
} as const;

const defaults: DeliveryPartnerPayoutSettingsResponse = {
  minimumPerOrderPaise: 4_000,
  basePayPaise: 2_500,
  perKmPaise: 800,
  codBonusPaise: 500,
  minimumWalletPayoutPaise: 100_000,
  requestsEnabled: true,
  freeDeliveryPlatformSubsidyEnabled: true,
};

export function DeliveryPartnerPayoutSettings({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const fallbackSettings = useMemo(() => settingsFromRecords(settings), [settings]);
  const [form, setForm] = useState(() => formFromSettings(fallbackSettings));
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentQuery = useQuery({
    queryKey: ["delivery-partner-payout-settings", auth.authHeaders],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () =>
      indihubFetch<DeliveryPartnerPayoutSettingsResponse>(
        "/api/admin/settings/delivery-partner-payouts",
        undefined,
        auth.authHeaders,
      ),
  });
  const savedSettings = currentQuery.data ?? fallbackSettings;
  const savedForm = useMemo(() => formFromSettings(savedSettings), [savedSettings]);
  const isDirty = hasUserEdited && JSON.stringify(form) !== JSON.stringify(savedForm);
  const validationError = validateForm(form);

  useEffect(() => {
    if (!hasUserEdited) {
      setForm(savedForm);
    }
  }, [hasUserEdited, savedForm]);

  function updateForm(updater: (current: DeliveryPartnerPayoutSettingsForm) => DeliveryPartnerPayoutSettingsForm) {
    setHasUserEdited(true);
    setForm(updater);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validateForm(form);
      if (error) {
        throw new Error(error);
      }

      return indihubFetch<DeliveryPartnerPayoutSettingsResponse>(
        "/api/admin/settings/delivery-partner-payouts",
        {
          method: "PUT",
          body: JSON.stringify(payloadFromForm(form)),
        },
        auth.authHeaders,
      );
    },
    onSuccess: async () => {
      setNotice("Delivery partner payout settings saved.");
      setHasUserEdited(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-partner-payout-settings"] }),
      ]);
    },
    onError: (error) =>
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save delivery partner payout settings.",
      ),
  });

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">
                Delivery partner payout settings
              </h3>
              <StatusBadge tone={form.requestsEnabled ? "success" : "warning"}>
                {form.requestsEnabled ? "Requests enabled" : "Requests disabled"}
              </StatusBadge>
              {isDirty ? <StatusBadge tone="warning">Unsaved</StatusBadge> : null}
            </div>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
              Controls local delivery partner earning credits and manual payout eligibility.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MoneyInput
          label="Minimum per order"
          value={form.minimumPerOrderRupees}
          onChange={(value) => updateForm((current) => ({ ...current, minimumPerOrderRupees: value }))}
        />
        <MoneyInput
          label="Base pay"
          value={form.basePayRupees}
          onChange={(value) => updateForm((current) => ({ ...current, basePayRupees: value }))}
        />
        <MoneyInput
          label="Per km"
          value={form.perKmRupees}
          onChange={(value) => updateForm((current) => ({ ...current, perKmRupees: value }))}
        />
        <MoneyInput
          label="COD bonus"
          value={form.codBonusRupees}
          onChange={(value) => updateForm((current) => ({ ...current, codBonusRupees: value }))}
        />
        <MoneyInput
          label="Payout threshold"
          value={form.minimumWalletPayoutRupees}
          onChange={(value) =>
            updateForm((current) => ({ ...current, minimumWalletPayoutRupees: value }))
          }
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdminSwitch
          label="Allow partner requests"
          description="Partners can request payout when available wallet balance meets the threshold."
          checked={form.requestsEnabled}
          onChange={(checked) => updateForm((current) => ({ ...current, requestsEnabled: checked }))}
        />
        <AdminSwitch
          label="Platform pays free-delivery subsidy"
          description="When customer shipping is zero or lower than the formula, platform still credits the calculated partner earning."
          checked={form.freeDeliveryPlatformSubsidyEnabled}
          onChange={(checked) =>
            updateForm((current) => ({
              ...current,
              freeDeliveryPlatformSubsidyEnabled: checked,
            }))
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#667085]">
          New delivered local orders use the latest values. Existing wallet credits keep their stored snapshot.
        </p>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!auth.isAuthenticated || saveMutation.isPending || Boolean(validationError) || !isDirty}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save delivery payouts"}
        </Button>
      </div>

      {currentQuery.error ? (
        <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
          {currentQuery.error instanceof Error
            ? currentQuery.error.message
            : "Unable to load saved delivery payout settings."}
        </p>
      ) : null}
      {validationError ? (
        <p className="mt-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
          {validationError}
        </p>
      ) : null}
      {notice ? (
        <p
          className={`mt-4 rounded-md border p-3 text-sm font-semibold ${
            saveMutation.isError
              ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]"
              : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"
          }`}
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-wide text-[#667085]">
        {label}
      </span>
      <div className="flex h-11 items-center gap-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 focus-within:border-[#ED3500] focus-within:bg-white">
        <IndianRupee className="h-4 w-4 text-[#667085]" aria-hidden="true" />
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-sm font-bold text-[#1F2933] outline-none"
        />
      </div>
    </label>
  );
}

function settingsFromRecords(settings: SettingRecord[]): DeliveryPartnerPayoutSettingsResponse {
  return {
    minimumPerOrderPaise: numberSetting(settings, keys.minimumPerOrderPaise, defaults.minimumPerOrderPaise),
    basePayPaise: numberSetting(settings, keys.basePayPaise, defaults.basePayPaise),
    perKmPaise: numberSetting(settings, keys.perKmPaise, defaults.perKmPaise),
    codBonusPaise: numberSetting(settings, keys.codBonusPaise, defaults.codBonusPaise),
    minimumWalletPayoutPaise: numberSetting(
      settings,
      keys.minimumWalletPayoutPaise,
      defaults.minimumWalletPayoutPaise,
    ),
    requestsEnabled: booleanSetting(settings, keys.requestsEnabled, defaults.requestsEnabled),
    freeDeliveryPlatformSubsidyEnabled: booleanSetting(
      settings,
      keys.freeDeliveryPlatformSubsidyEnabled,
      defaults.freeDeliveryPlatformSubsidyEnabled,
    ),
  };
}

function formFromSettings(
  settings: DeliveryPartnerPayoutSettingsResponse,
): DeliveryPartnerPayoutSettingsForm {
  return {
    minimumPerOrderRupees: paiseToRupeesInput(settings.minimumPerOrderPaise),
    basePayRupees: paiseToRupeesInput(settings.basePayPaise),
    perKmRupees: paiseToRupeesInput(settings.perKmPaise),
    codBonusRupees: paiseToRupeesInput(settings.codBonusPaise),
    minimumWalletPayoutRupees: paiseToRupeesInput(settings.minimumWalletPayoutPaise),
    requestsEnabled: settings.requestsEnabled,
    freeDeliveryPlatformSubsidyEnabled: settings.freeDeliveryPlatformSubsidyEnabled,
  };
}

function payloadFromForm(form: DeliveryPartnerPayoutSettingsForm): DeliveryPartnerPayoutSettingsResponse {
  return {
    minimumPerOrderPaise: rupeesToPaise(form.minimumPerOrderRupees),
    basePayPaise: rupeesToPaise(form.basePayRupees),
    perKmPaise: rupeesToPaise(form.perKmRupees),
    codBonusPaise: rupeesToPaise(form.codBonusRupees),
    minimumWalletPayoutPaise: rupeesToPaise(form.minimumWalletPayoutRupees),
    requestsEnabled: form.requestsEnabled,
    freeDeliveryPlatformSubsidyEnabled: form.freeDeliveryPlatformSubsidyEnabled,
  };
}

function validateForm(form: DeliveryPartnerPayoutSettingsForm) {
  const numericFields = [
    ["minimum per order", form.minimumPerOrderRupees],
    ["base pay", form.basePayRupees],
    ["per km", form.perKmRupees],
    ["COD bonus", form.codBonusRupees],
    ["payout threshold", form.minimumWalletPayoutRupees],
  ] as const;
  const invalid = numericFields.find(([, value]) => !isValidMoneyInput(value));

  return invalid ? `Enter a valid non-negative amount for ${invalid[0]}.` : null;
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

function paiseToRupeesInput(value: number) {
  return String(Math.round(value) / 100);
}

function rupeesToPaise(value: string) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function isValidMoneyInput(value: string) {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
}
