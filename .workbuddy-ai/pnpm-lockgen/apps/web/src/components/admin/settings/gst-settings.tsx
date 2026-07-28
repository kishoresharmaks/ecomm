"use client";

import { FormEvent, useDeferredValue, useEffect, useState } from "react";
import { FileCheck2, Info, Landmark, Save, Truck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  AdminPanel,
  AdminStatusNotice,
  AdminSwitch,
} from "@/components/admin/admin-ux";
import { userFacingApiErrorMessage } from "@/lib/api";
import { searchSacMaster, type SacMasterEntry } from "@/lib/storefront-api";
import {
  getAdminGstSettings,
  gstSettingsValidationError,
  paiseToRupeesInput,
  rupeesToPaise,
  saveAdminGstSettings,
  type GstSettings,
} from "@/lib/gst-settings";

export function AdminGstSettingsClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GstSettings | null>(null);
  const [thresholdRupees, setThresholdRupees] = useState("50000");
  const [isDirty, setIsDirty] = useState(false);
  const [notice, setNotice] = useState<
    { tone: "success" | "danger"; message: string } | null
  >(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-gst-settings", auth.authHeaders],
    enabled: auth.isAuthenticated,
    retry: false,
    queryFn: () => getAdminGstSettings(auth.authHeaders),
  });

  useEffect(() => {
    if (!settingsQuery.data || isDirty) return;
    setDraft(settingsQuery.data);
    setThresholdRupees(paiseToRupeesInput(settingsQuery.data.eWayBill.thresholdPaise));
  }, [isDirty, settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (settings: GstSettings) =>
      saveAdminGstSettings(auth.authHeaders, settings),
    onSuccess: async (settings) => {
      setDraft(settings);
      setThresholdRupees(paiseToRupeesInput(settings.eWayBill.thresholdPaise));
      setIsDirty(false);
      setNotice({
        tone: "success",
        message: "Platform GST identity and manual compliance settings are active.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-gst-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-finance-gst-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reports-gst"] }),
      ]);
    },
    onError: (error) =>
      setNotice({ tone: "danger", message: userFacingApiErrorMessage(error) }),
  });

  function markDirty(next: GstSettings) {
    setDraft(next);
    setIsDirty(true);
    setNotice(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const thresholdPaise = rupeesToPaise(thresholdRupees);
    if (thresholdPaise === null) {
      setNotice({
        tone: "danger",
        message: "Enter a valid e-way bill threshold in INR.",
      });
      return;
    }
    const payload = {
      ...draft,
      platform: {
        ...draft.platform,
        gstin: draft.platform.gstin.trim().toUpperCase(),
      },
      eWayBill: { ...draft.eWayBill, thresholdPaise },
    };
    const validationError = gstSettingsValidationError(payload);
    if (validationError) {
      setNotice({ tone: "danger", message: validationError });
      return;
    }
    saveMutation.mutate(payload);
  }

  if (settingsQuery.isError) {
    return (
      <AdminStatusNotice
        tone="danger"
        title="GST configuration unavailable"
        message={userFacingApiErrorMessage(settingsQuery.error)}
      />
    );
  }

  if (settingsQuery.isLoading || !draft) {
    return <div className="h-80 animate-pulse rounded-lg bg-[#F8FAFC]" />;
  }

  const platformReady = !gstSettingsValidationError({
    ...draft,
    eWayBill: { ...draft.eWayBill, thresholdPaise: 0 },
  });

  return (
    <form onSubmit={submit} className="grid gap-5">
      {notice ? (
        <AdminStatusNotice
          tone={notice.tone}
          title={notice.tone === "success" ? "GST configuration saved" : "GST configuration not saved"}
          message={notice.message}
          className="mb-0"
        />
      ) : null}

      <fieldset disabled={saveMutation.isPending} className="contents">
        <AdminPanel>
          <SectionHeader
            icon={<Landmark className="h-5 w-5" aria-hidden="true" />}
            title="Platform GST identity"
            description="Used when 1HandIndia issues marketplace commission and platform-service GST documents to sellers."
            status={platformReady ? "Configured" : "Action required"}
            ready={platformReady}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextField
            label="Registered legal name"
            value={draft.platform.legalName}
            onChange={(value) =>
              markDirty({ ...draft, platform: { ...draft.platform, legalName: value } })
            }
            required
          />
          <TextField
            label="Platform GSTIN"
            value={draft.platform.gstin}
            maxLength={15}
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: { ...draft.platform, gstin: value.toUpperCase() },
              })
            }
            required
          />
          <TextField
            label="GST state code"
            value={draft.platform.stateCode}
            maxLength={2}
            inputMode="numeric"
            description="The first two digits must match the platform GSTIN."
            onChange={(value) =>
              markDirty({ ...draft, platform: { ...draft.platform, stateCode: value } })
            }
            required
          />
          <SacCodeField
            value={draft.platform.serviceSacCode}
            onChange={(serviceSacCode) =>
              markDirty({
                ...draft,
                platform: { ...draft.platform, serviceSacCode },
              })
            }
            onSelect={(entry) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  serviceSacCode: entry.sacCode,
                  serviceDescription: entry.description,
                },
              })
            }
          />
          <TextField
            label="Platform service description"
            value={draft.platform.serviceDescription}
            description="Printed on marketplace commission and platform-service GST documents."
            onChange={(serviceDescription) =>
              markDirty({
                ...draft,
                platform: { ...draft.platform, serviceDescription },
              })
            }
            required
          />
          <TextField label="Country" value="India" disabled onChange={() => undefined} />
          <TextField
            label="Registered address line 1"
            value={draft.platform.address.line1}
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  address: { ...draft.platform.address, line1: value },
                },
              })
            }
            required
          />
          <TextField
            label="Registered address line 2"
            value={draft.platform.address.line2}
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  address: { ...draft.platform.address, line2: value },
                },
              })
            }
          />
          <TextField
            label="City"
            value={draft.platform.address.city}
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  address: { ...draft.platform.address, city: value },
                },
              })
            }
            required
          />
          <TextField
            label="State"
            value={draft.platform.address.state}
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  address: { ...draft.platform.address, state: value },
                },
              })
            }
            required
          />
          <TextField
            label="Postal code"
            value={draft.platform.address.postalCode}
            maxLength={6}
            inputMode="numeric"
            onChange={(value) =>
              markDirty({
                ...draft,
                platform: {
                  ...draft.platform,
                  address: { ...draft.platform.address, postalCode: value },
                },
              })
            }
            required
          />
          </div>
        </AdminPanel>

        <AdminPanel>
          <SectionHeader
            icon={<FileCheck2 className="h-5 w-5" aria-hidden="true" />}
            title="E-invoice / IRN"
            description="Marks eligible seller documents for audited manual IRN processing. It does not contact an IRP."
            status={draft.eInvoice.enabled ? "Enabled" : "Disabled"}
            ready={draft.eInvoice.enabled}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ReadOnlyProvider />
            <AdminSwitch
              label="Enable manual e-invoice workflow"
              description="Finance staff generate the IRN externally and record the acknowledgement and signed QR in 1HandIndia."
              checked={draft.eInvoice.enabled}
              onChange={(enabled) =>
                markDirty({ ...draft, eInvoice: { provider: "MANUAL", enabled } })
              }
            />
          </div>
        </AdminPanel>

        <AdminPanel>
          <SectionHeader
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
            title="E-way bill"
            description="Marks applicable goods movements for audited manual e-way bill processing. It does not contact the government portal."
            status={draft.eWayBill.enabled ? "Enabled" : "Disabled"}
            ready={draft.eWayBill.enabled}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ReadOnlyProvider />
            <AdminSwitch
              label="Enable manual e-way bill workflow"
              description="Sellers or operations staff generate the e-way bill externally and record its number against the shipment."
              checked={draft.eWayBill.enabled}
              onChange={(enabled) =>
                markDirty({
                  ...draft,
                  eWayBill: { ...draft.eWayBill, provider: "MANUAL", enabled },
                })
              }
            />
            <label className="space-y-2 md:col-span-2 md:max-w-md">
              <span className="flex items-center gap-2 text-xs font-black uppercase text-[#667085]">
                Readiness threshold (INR)
                <span title="This is an operational readiness rule, not a complete legal determination.">
                  <Info className="h-4 w-4" aria-hidden="true" />
                </span>
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={thresholdRupees}
                onChange={(event) => {
                  setThresholdRupees(event.target.value);
                  setIsDirty(true);
                  setNotice(null);
                }}
                className={inputClass}
              />
              <span className="block text-xs font-semibold leading-5 text-[#667085]">
                Confirm the operational threshold with the platform accountant or GST practitioner.
              </span>
            </label>
          </div>
        </AdminPanel>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D8E2EA] pt-5">
        <p className="text-sm font-semibold text-[#667085]">
          {isDirty ? "You have unsaved GST configuration changes." : "Saved configuration is active."}
        </p>
        <Button
          type="submit"
          disabled={!auth.isAuthenticated || !isDirty || saveMutation.isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveMutation.isPending ? "Saving" : "Save GST configuration"}
        </Button>
      </div>
    </form>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

function SectionHeader({
  icon,
  title,
  description,
  status,
  ready,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
  ready: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
            {description}
          </p>
        </div>
      </div>
      <StatusBadge tone={ready ? "success" : "neutral"}>{status}</StatusBadge>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  description,
  required,
  disabled,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase text-[#667085]">{label}</span>
      <input
        value={value}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {description ? (
        <span className="block text-xs font-semibold leading-5 text-[#667085]">
          {description}
        </span>
      ) : null}
    </label>
  );
}

function ReadOnlyProvider() {
  return (
    <div className="min-h-28 border-b border-[#D8E2EA] py-3">
      <p className="text-xs font-black uppercase text-[#667085]">Processing mode</p>
      <p className="mt-2 text-sm font-black text-[#1F2933]">Manual processing</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
        No provider credentials or automatic submission are used.
      </p>
    </div>
  );
}

function SacCodeField({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (entry: SacMasterEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const deferredValue = useDeferredValue(value.trim());
  const suggestions = useQuery({
    queryKey: ["platform-gst-sac-master", deferredValue],
    queryFn: () => searchSacMaster({ search: deferredValue, limit: 8 }),
    enabled: deferredValue.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <label className="relative space-y-2">
      <span className="block text-xs font-black uppercase text-[#667085]">
        Platform service SAC
      </span>
      <input
        value={value}
        required
        inputMode="numeric"
        maxLength={6}
        placeholder="Search six-digit SAC"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6));
          setOpen(true);
        }}
        className={inputClass}
      />
      {open && suggestions.data?.length ? (
        <div
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[#D8E2EA] bg-white p-1 shadow-lg"
        >
          {suggestions.data.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={entry.sacCode === value}
              onClick={() => {
                onSelect(entry);
                setOpen(false);
              }}
              className="block w-full rounded px-3 py-2 text-left hover:bg-[#FFF0EC]"
            >
              <span className="block text-sm font-black text-[#1F2933]">
                {entry.sacCode}
              </span>
              <span className="mt-0.5 block text-xs font-semibold leading-5 text-[#667085]">
                {entry.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <span className="block text-xs font-semibold leading-5 text-[#667085]">
        Classifies the marketplace service on platform-issued GST invoices.
      </span>
    </label>
  );
}
