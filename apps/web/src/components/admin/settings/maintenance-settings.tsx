"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Store, Truck, Wrench } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { AdminPanel, AdminStatusNotice, AdminSwitch } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  normalizeMaintenanceScope,
  upsertMaintenanceSettings,
  type MaintenanceScope,
  type MaintenanceScopeSetting,
} from "@/lib/maintenance-mode";
import { readBooleanSettingValue } from "./setting-value-utils";

type SettingRecord = {
  key: string;
  value: unknown;
};

type MaintenanceFormState = Record<MaintenanceScope, MaintenanceScopeSetting>;

const scopeMeta: Record<
  MaintenanceScope,
  { title: string; description: string; routes: string; icon: typeof Store }
> = {
  storefront: {
    title: "Storefront shopping",
    description: "Blocks shopping pages only. Account, B2B, support, auth, and chat stay available.",
    routes: "/, /categories, /products, /stores, /cart, /checkout, /track-order, /deals",
    icon: Store,
  },
  seller: {
    title: "Seller Center",
    description: "Blocks seller catalogue, orders, finance, reports, reviews, and onboarding pages.",
    routes: "/seller/*",
    icon: Wrench,
  },
  delivery: {
    title: "Delivery Partner workspace",
    description: "Blocks assigned delivery operations while leaving delivery partner registration open.",
    routes: "/delivery/* except /delivery/register",
    icon: Truck,
  },
};

const scopes: MaintenanceScope[] = ["storefront", "seller", "delivery"];

export function MaintenanceSettingsPanel({ settings }: { settings: SettingRecord[] }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MaintenanceFormState>(() => formFromSettings([]));
  const [baseline, setBaseline] = useState<MaintenanceFormState>(() => formFromSettings([]));

  useEffect(() => {
    const next = formFromSettings(settings);
    setForm(next);
    setBaseline(next);
  }, [settings]);

  const hasChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [baseline, form]);
  const validationError = validateMaintenanceForm(form);
  const mutation = useMutation({
    mutationFn: () => upsertMaintenanceSettings(auth.authHeaders, scopes.map((scope) => form[scope])),
    onSuccess: async (saved) => {
      const next = formFromApi(saved);
      setForm(next);
      setBaseline(next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["maintenance-settings"] }),
      ]);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validationError) {
      mutation.mutate();
    }
  }

  return (
    <AdminPanel>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-[#1F2933]">Maintenance mode</h3>
              <StatusBadge tone={hasChanges ? "warning" : "success"}>
                {hasChanges ? "Unsaved changes" : "Saved"}
              </StatusBadge>
            </div>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              Pause storefront shopping, Seller Center, or delivery operations independently without blocking admin access.
            </p>
          </div>
          <Button type="submit" disabled={!auth.isAuthenticated || mutation.isPending || Boolean(validationError) || !hasChanges}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {mutation.isPending ? "Saving" : "Save maintenance modes"}
          </Button>
        </div>

        {validationError ? (
          <AdminStatusNotice title="Maintenance settings need attention" message={validationError} tone="danger" />
        ) : null}
        {mutation.isError ? (
          <AdminStatusNotice
            title="Maintenance settings not saved"
            message={mutation.error instanceof Error ? mutation.error.message : "Unable to save maintenance settings."}
            tone="danger"
          />
        ) : null}
        {mutation.isSuccess ? (
          <AdminStatusNotice
            title="Maintenance settings saved"
            message="The selected portal maintenance modes are now active from database settings."
            tone="success"
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          {scopes.map((scope) => (
            <MaintenanceScopeCard
              key={scope}
              scope={scope}
              value={form[scope]}
              onChange={(next) => setForm((current) => ({ ...current, [scope]: normalizeMaintenanceScope(scope, next) }))}
            />
          ))}
        </div>
      </form>
    </AdminPanel>
  );
}

function MaintenanceScopeCard({
  scope,
  value,
  onChange,
}: {
  scope: MaintenanceScope;
  value: MaintenanceScopeSetting;
  onChange: (value: MaintenanceScopeSetting) => void;
}) {
  const meta = scopeMeta[scope];
  const Icon = meta.icon;

  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-[#1F2933]">{meta.title}</h4>
            <StatusBadge tone={value.enabled ? "warning" : "success"}>
              {value.enabled ? "Maintenance on" : "Live"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{meta.description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <AdminSwitch
          label="Enable maintenance"
          description={`Affected routes: ${meta.routes}`}
          checked={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
        <PublicTextInput
          label="Public message shown to users"
          helper="Shown to users on the maintenance page. Keep it brief and public-facing."
          maxLength={240}
          value={value.message}
          onChange={(message) => onChange({ ...value, message })}
          placeholder="Shown to users - keep it brief and public-facing."
        />
        <PublicTextInput
          label="Public ETA"
          helper='Optional free-text ETA shown to users, such as "Expected back by 3 PM IST".'
          maxLength={160}
          value={value.eta}
          onChange={(eta) => onChange({ ...value, eta })}
          placeholder="Expected back by 3 PM IST"
        />
      </div>
    </section>
  );
}

function PublicTextInput({
  label,
  helper,
  maxLength,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper: string;
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[#344054]">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        maxLength={maxLength}
        rows={3}
        placeholder={placeholder}
        className="min-h-24 resize-y rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
      />
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[#667085]">
        <span>{helper}</span>
        <span>{value.length}/{maxLength}</span>
      </span>
    </label>
  );
}

function formFromSettings(settings: SettingRecord[]): MaintenanceFormState {
  return {
    storefront: scopeFromSettings(settings, "storefront"),
    seller: scopeFromSettings(settings, "seller"),
    delivery: scopeFromSettings(settings, "delivery"),
  };
}

function formFromApi(settings: MaintenanceScopeSetting[]): MaintenanceFormState {
  return {
    storefront: normalizeMaintenanceScope("storefront", settings.find((setting) => setting.scope === "storefront")),
    seller: normalizeMaintenanceScope("seller", settings.find((setting) => setting.scope === "seller")),
    delivery: normalizeMaintenanceScope("delivery", settings.find((setting) => setting.scope === "delivery")),
  };
}

function scopeFromSettings(settings: SettingRecord[], scope: MaintenanceScope) {
  return normalizeMaintenanceScope(scope, {
    enabled: readBooleanSettingValue(settingValue(settings, `maintenance.${scope}.enabled`), false),
    message: stringSetting(settings, `maintenance.${scope}.message`),
    eta: stringSetting(settings, `maintenance.${scope}.eta`),
  });
}

function validateMaintenanceForm(form: MaintenanceFormState) {
  for (const scope of scopes) {
    if (form[scope].enabled && !form[scope].message.trim()) {
      return `${scopeMeta[scope].title} needs a public message before maintenance can be enabled.`;
    }
  }

  return "";
}

function settingValue(settings: SettingRecord[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function stringSetting(settings: SettingRecord[], key: string) {
  const value = settingValue(settings, key);
  return typeof value === "string" ? value : "";
}
