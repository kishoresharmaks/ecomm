"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Bike, MapPinned, Phone, Save, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useLocationAreaStore, useLocationCatalog } from "@/components/locations/location-store";
import { formatLocalAreaLabel } from "@/components/locations/location-utils";
import type { LocationArea } from "@/lib/location-api";
import {
  getDeliveryProfile,
  updateDeliveryProfile,
  type DeliveryPartnerProfileAccount,
  type DeliveryPartnerProfileUpdatePayload,
} from "@/lib/delivery-api";
import {
  DeliveryError,
  DeliveryIconTile,
  DeliveryMetric,
  DeliveryPanel,
  formatPaise,
  humanize,
  useDeliveryAuth,
} from "./delivery-ui";

type DeliveryProfileForm = {
  phone: string;
  vehicleNumber: string;
  isAvailable: boolean;
  serviceCountryCode: string;
  serviceStateCode: string;
  serviceCityCode: string;
  servicePincodes: string;
  serviceLocalAreaCodes: string;
  notes: string;
};

const emptyForm: DeliveryProfileForm = {
  phone: "",
  vehicleNumber: "",
  isAvailable: true,
  serviceCountryCode: "",
  serviceStateCode: "",
  serviceCityCode: "",
  servicePincodes: "",
  serviceLocalAreaCodes: "",
  notes: "",
};

export function DeliveryProfileClient() {
  const auth = useDeliveryAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DeliveryProfileForm>(emptyForm);
  const [notice, setNotice] = useState<{ tone: StatusTone; message: string } | null>(null);
  const queryKey = useMemo(() => ["delivery-profile", auth.authKey], [auth.authKey]);
  const profileQuery = useQuery({
    queryKey,
    queryFn: () => getDeliveryProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const updateProfile = useMutation({
    mutationFn: (payload: DeliveryPartnerProfileUpdatePayload) =>
      updateDeliveryProfile(auth.authHeaders, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setNotice({ tone: "success", message: "Profile updated." });
    },
    onError: (error) => {
      setNotice({
        tone: "danger",
        message: error instanceof Error ? error.message : "Profile update failed.",
      });
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(profileToForm(profileQuery.data));
    }
  }, [profileQuery.data]);

  if (!auth.enabled) {
    return null;
  }

  if (profileQuery.error) {
    return <DeliveryError error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />;
  }

  const profile = profileQuery.data;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    updateProfile.mutate({
      phone: phonePayload(form.phone),
      vehicleNumber: form.vehicleNumber.trim(),
      isAvailable: form.isAvailable,
      serviceCountryCode: form.serviceCountryCode.trim(),
      serviceStateCode: form.serviceStateCode.trim(),
      serviceCityCode: form.serviceCityCode.trim(),
      servicePincodes: csvValues(form.servicePincodes),
      serviceLocalAreaCodes: csvValues(form.serviceLocalAreaCodes),
      notes: form.notes.trim(),
    });
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <DeliveryMetric
          label="Availability"
          value={form.isAvailable ? "Active" : "Inactive"}
          note="Used for new admin assignment"
        />
        <DeliveryMetric
          label="Active workload"
          value={profile?.activeWorkload ?? 0}
          note="Assigned deliveries in progress"
        />
        <DeliveryMetric
          label="COD exposure"
          value={formatPaise(profile?.pendingCodCashPaise ?? 0)}
          note={`Limit ${formatPaise(profile?.deliveryProfile.effectiveCodCashLimitPaise ?? 0)}`}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          title="Partner profile"
          description="Keep delivery contact, vehicle, availability, and service area details current."
        />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={form.isAvailable ? "success" : "warning"}>
            {form.isAvailable ? "Available" : "Inactive"}
          </StatusBadge>
          <StatusBadge tone="info">{humanize(profile?.status ?? "ACTIVE")}</StatusBadge>
        </div>
      </div>

      {profileQuery.isLoading ? (
        <DeliveryPanel>
          <div className="h-72 animate-pulse rounded-md bg-[#F8FAFC]" />
        </DeliveryPanel>
      ) : null}

      {profile ? (
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <ProfileSummaryCard
              icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
              label="Account"
              value={profile.fullName || profile.email || "Delivery partner"}
              note={profile.email ?? "Email not set"}
            />
            <ProfileSummaryCard
              icon={<Phone className="h-5 w-5" aria-hidden="true" />}
              label="Phone"
              value={form.phone || "Not set"}
              note="Visible to delivery operations"
            />
            <ProfileSummaryCard
              icon={<Bike className="h-5 w-5" aria-hidden="true" />}
              label="Vehicle"
              value={form.vehicleNumber || "Not set"}
              note="Used by admin handover"
            />
          </div>

          {notice ? (
            <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
              <StatusBadge tone={notice.tone}>{notice.message}</StatusBadge>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <DeliveryPanel>
              <h2 className="text-base font-black text-[#123A5A]">Contact and status</h2>
              <div className="mt-4 grid gap-4">
                <ProfileInput
                  label="Phone"
                  value={form.phone}
                  inputMode="tel"
                  placeholder="9876543210"
                  onChange={(phone) => setForm((current) => ({ ...current, phone }))}
                />
                <ProfileInput
                  label="Vehicle number"
                  value={form.vehicleNumber}
                  placeholder="TN 30 AB 1234"
                  onChange={(vehicleNumber) =>
                    setForm((current) => ({ ...current, vehicleNumber }))
                  }
                />
                <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2">
                  <span>
                    <span className="block text-sm font-black text-[#1F2933]">Available for assignment</span>
                    <span className="block text-xs font-semibold text-[#667085]">
                      {form.isAvailable ? "Active" : "Inactive"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, isAvailable: event.target.checked }))
                    }
                    className="h-5 w-5 accent-[#ED3500]"
                  />
                </label>
              </div>
            </DeliveryPanel>

            <DeliveryPanel>
              <h2 className="text-base font-black text-[#123A5A]">Service area</h2>
              <DeliveryServiceAreaPicker form={form} onChange={setForm} />
            </DeliveryPanel>
          </div>

          <DeliveryPanel>
            <div className="flex items-start gap-3">
              <DeliveryIconTile>
                <MapPinned className="h-5 w-5" aria-hidden="true" />
              </DeliveryIconTile>
              <div className="min-w-0 flex-1">
                <ProfileTextarea
                  label="Notes"
                  value={form.notes}
                  placeholder="Shift timing, preferred pickup point, route notes"
                  onChange={(notes) => setForm((current) => ({ ...current, notes }))}
                />
              </div>
            </div>
          </DeliveryPanel>

          <div className="sticky bottom-3 z-10 flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending || profileQuery.isLoading}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {updateProfile.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function DeliveryServiceAreaPicker({
  form,
  onChange,
}: {
  form: DeliveryProfileForm;
  onChange: (updater: (current: DeliveryProfileForm) => DeliveryProfileForm) => void;
}) {
  const [areaSearch, setAreaSearch] = useState("");
  const locationCatalog = useLocationCatalog({
    countryCode: form.serviceCountryCode,
    stateCode: form.serviceStateCode,
  });
  const areasStore = useLocationAreaStore({
    countryCode: form.serviceCountryCode,
    stateCode: form.serviceStateCode,
    cityCode: form.serviceCityCode,
    search: areaSearch,
    limit: 50,
  });
  const pincodeValues = codeValues(form.servicePincodes);
  const localAreaValues = codeValues(form.serviceLocalAreaCodes);

  function update(patch: Partial<DeliveryProfileForm>) {
    onChange((current) => ({ ...current, ...patch }));
  }

  function selectArea(area: LocationArea) {
    const selectedCity = area.city;
    const selectedSubdivision = selectedCity?.subdivision;
    const selectedCountry = selectedSubdivision?.country;

    onChange((current) => ({
      ...current,
      serviceCountryCode: selectedCountry?.code ?? current.serviceCountryCode,
      serviceStateCode: selectedSubdivision?.code ?? current.serviceStateCode,
      serviceCityCode: selectedCity?.code ?? current.serviceCityCode,
      servicePincodes: area.postalCode
        ? joinCodeValues(addCodeValue(current.servicePincodes, area.postalCode))
        : current.servicePincodes,
      serviceLocalAreaCodes: joinCodeValues(addCodeValue(current.serviceLocalAreaCodes, area.code)),
    }));
    setAreaSearch(formatLocalAreaLabel(area));
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ProfileSelect
          label="Country"
          value={form.serviceCountryCode}
          disabled={locationCatalog.countriesQuery.isLoading}
          options={locationCatalog.countries.map((country) => ({
            value: country.code,
            label: country.name,
          }))}
          emptyLabel="Any country"
          onChange={(serviceCountryCode) =>
            update({
              serviceCountryCode,
              serviceStateCode: "",
              serviceCityCode: "",
              servicePincodes: "",
              serviceLocalAreaCodes: "",
            })
          }
        />
        <ProfileSelect
          label="State"
          value={form.serviceStateCode}
          disabled={!form.serviceCountryCode || locationCatalog.statesQuery.isLoading}
          options={locationCatalog.states.map((state) => ({ value: state.code, label: state.name }))}
          emptyLabel="Any state"
          onChange={(serviceStateCode) =>
            update({
              serviceStateCode,
              serviceCityCode: "",
              servicePincodes: "",
              serviceLocalAreaCodes: "",
            })
          }
        />
        <ProfileSelect
          label="City"
          value={form.serviceCityCode}
          disabled={!form.serviceStateCode || locationCatalog.citiesQuery.isLoading}
          options={locationCatalog.cities.map((city) => ({ value: city.code, label: city.name }))}
          emptyLabel="Any city"
          onChange={(serviceCityCode) =>
            update({
              serviceCityCode,
              servicePincodes: "",
              serviceLocalAreaCodes: "",
            })
          }
        />
      </div>

      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
          Local area / pincode search
        </span>
        <input
          value={areaSearch}
          placeholder="Search Omalur or 636455"
          disabled={!form.serviceCountryCode}
          onChange={(event) => setAreaSearch(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6]"
        />
      </label>

      {form.serviceCountryCode && areaSearch.trim() ? (
        <div className="max-h-44 overflow-auto rounded-md border border-[#E5E7EB] bg-white">
          {areasStore.areas.length ? (
            areasStore.areas.map((area) => (
              <button
                key={area.code}
                type="button"
                onClick={() => selectArea(area)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm font-semibold text-[#1F2933] hover:bg-[#FFF0EC]",
                  localAreaValues.includes(area.code) ? "bg-[#FFF0EC] text-[#9F2600]" : "",
                )}
              >
                <span className="block font-black">{formatLocalAreaLabel(area)}</span>
                <span className="text-xs text-[#667085]">
                  {[area.city?.name, area.city?.subdivision?.name, area.city?.subdivision?.country?.name]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-semibold text-[#667085]">
              {areasStore.isLoading ? "Searching..." : "No matching local areas"}
            </p>
          )}
        </div>
      ) : null}

      <CodeChipList
        label="Service pincodes"
        values={pincodeValues}
        emptyText="No specific pincodes. Country/state/city coverage applies."
        onRemove={(code) =>
          onChange((current) => ({
            ...current,
            servicePincodes: joinCodeValues(removeCodeValue(current.servicePincodes, code)),
          }))
        }
        onClear={() => update({ servicePincodes: "" })}
      />
      <CodeChipList
        label="Local area codes"
        values={localAreaValues}
        emptyText="No specific local areas."
        onRemove={(code) =>
          onChange((current) => ({
            ...current,
            serviceLocalAreaCodes: joinCodeValues(
              removeCodeValue(current.serviceLocalAreaCodes, code),
            ),
          }))
        }
        onClear={() => update({ serviceLocalAreaCodes: "" })}
      />
    </div>
  );
}

function ProfileSummaryCard({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <DeliveryIconTile>{icon}</DeliveryIconTile>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
        <p className="mt-1 truncate text-base font-black text-[#1F2933]">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[#667085]">{note}</p>
      </div>
    </div>
  );
}

function ProfileSelect({
  label,
  value,
  options,
  emptyLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6] disabled:opacity-60"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "text" | "tel";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6]"
      />
    </label>
  );
}

function CodeChipList({
  label,
  values,
  emptyText,
  onRemove,
  onClear,
}: {
  label: string;
  values: string[];
  emptyText: string;
  onRemove: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
        {values.length ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-black uppercase tracking-wide text-[#B42318]"
          >
            Clear
          </button>
        ) : null}
      </div>
      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRemove(value)}
              className="rounded-full border border-[#D8E2EA] bg-white px-3 py-1.5 text-xs font-black text-[#163B5C] transition hover:border-[#ED3500] hover:text-[#ED3500]"
            >
              {value}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#667085]">{emptyText}</p>
      )}
    </div>
  );
}

function ProfileTextarea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-28 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold leading-6 text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6]"
      />
    </label>
  );
}

function profileToForm(account: DeliveryPartnerProfileAccount): DeliveryProfileForm {
  const profile = account.deliveryProfile;
  return {
    phone: profile.phone ?? account.phone ?? "",
    vehicleNumber: profile.vehicleNumber ?? "",
    isAvailable: profile.isAvailable ?? true,
    serviceCountryCode: profile.serviceCountryCode ?? "",
    serviceStateCode: profile.serviceStateCode ?? "",
    serviceCityCode: profile.serviceCityCode ?? "",
    servicePincodes: profile.servicePincodes?.join(", ") ?? "",
    serviceLocalAreaCodes: profile.serviceLocalAreaCodes?.join(", ") ?? "",
    notes: profile.notes ?? "",
  };
}

function csvValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function codeValues(value: string) {
  return csvValues(value);
}

function addCodeValue(value: string, code: string) {
  return Array.from(new Set([...codeValues(value), code.trim()].filter(Boolean)));
}

function removeCodeValue(value: string, code: string) {
  return codeValues(value).filter((item) => item !== code);
}

function joinCodeValues(values: string[]) {
  return values.join(", ");
}

function phonePayload(value: string) {
  const phone = value.replace(/\D/g, "");
  return phone || undefined;
}
