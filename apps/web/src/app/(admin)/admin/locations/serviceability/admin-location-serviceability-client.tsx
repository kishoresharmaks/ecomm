"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, MapPinned, Search, Store, Truck } from "lucide-react";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  buildAdminLocationServiceabilityPath,
  serviceabilityLabel,
  serviceabilityTone,
  type AdminLocationServiceabilityPaymentMethod
} from "@/components/admin/admin-location-serviceability-utils";
import { formatLocalAreaLabel, normalizeLocalAreaSearchValue } from "@/components/locations/location-utils";
import { IndihubApiError, indihubFetch } from "@/lib/api";
import {
  listLocationAreas,
  listLocationCities,
  listLocationCountries,
  listLocationStates,
  type AdminLocationServiceabilitySummary,
  type LocationArea
} from "@/lib/location-api";

type FormState = {
  countryCode: string;
  stateCode: string;
  cityCode: string;
  localAreaCode: string;
  pincode: string;
  subtotalInr: string;
  paymentMethod: AdminLocationServiceabilityPaymentMethod;
};

const paymentMethods: Array<{ value: AdminLocationServiceabilityPaymentMethod; label: string }> = [
  { value: "COD", label: "COD" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "MANUAL", label: "Manual" }
];

export function AdminLocationServiceabilityClient() {
  const auth = useAdminAuth();
  const [form, setForm] = useState<FormState>({
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    localAreaCode: "",
    pincode: "",
    subtotalInr: "999",
    paymentMethod: "COD"
  });
  const [areaSearch, setAreaSearch] = useState("");
  const areaLookupSearch = useMemo(() => normalizeLocalAreaSearchValue(areaSearch), [areaSearch]);

  const countriesQuery = useQuery({
    queryKey: ["locations", "countries"],
    queryFn: listLocationCountries
  });
  const statesQuery = useQuery({
    queryKey: ["locations", "states", form.countryCode],
    enabled: Boolean(form.countryCode),
    queryFn: () => listLocationStates(form.countryCode)
  });
  const citiesQuery = useQuery({
    queryKey: ["locations", "cities", form.stateCode],
    enabled: Boolean(form.stateCode),
    queryFn: () => listLocationCities(form.stateCode)
  });
  const areasQuery = useQuery({
    queryKey: ["locations", "areas", form.cityCode, areaLookupSearch],
    enabled: Boolean(form.cityCode),
    queryFn: () => listLocationAreas({ cityCode: form.cityCode, search: areaLookupSearch, limit: 25 })
  });

  const summaryMutation = useMutation({
    mutationFn: () =>
      indihubFetch<AdminLocationServiceabilitySummary>(
        buildAdminLocationServiceabilityPath({
          countryCode: form.countryCode,
          stateCode: form.stateCode,
          cityCode: form.cityCode,
          localAreaCode: form.localAreaCode,
          pincode: form.pincode,
          subtotalPaise: Math.round(Math.max(0, Number(form.subtotalInr) || 0) * 100),
          paymentMethod: form.paymentMethod
        }),
        undefined,
        auth.authHeaders
      )
  });

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    summaryMutation.mutate();
  }

  function selectArea(area: LocationArea) {
    updateForm({
      localAreaCode: area.code,
      pincode: area.postalCode ?? form.pincode
    });
    setAreaSearch(formatLocalAreaLabel(area));
  }

  const summary = summaryMutation.data ?? null;

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[#D8E2EA] bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Check location</h2>
            <p className="text-sm font-semibold text-[#667085]">Uses live seller, delivery, payment, and rate-card data.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <SelectControl
            label="Country"
            value={form.countryCode}
            disabled={countriesQuery.isLoading}
            options={(countriesQuery.data ?? []).map((country) => ({ value: country.code, label: country.name }))}
            onChange={(value) => {
              updateForm({ countryCode: value, stateCode: "", cityCode: "", localAreaCode: "", pincode: "" });
              setAreaSearch("");
            }}
          />
          <SelectControl
            label="State / UT"
            value={form.stateCode}
            disabled={!form.countryCode || statesQuery.isLoading}
            options={(statesQuery.data ?? []).map((state) => ({ value: state.code, label: state.name }))}
            onChange={(value) => {
              updateForm({ stateCode: value, cityCode: "", localAreaCode: "", pincode: "" });
              setAreaSearch("");
            }}
          />
          <SelectControl
            label="City / district"
            value={form.cityCode}
            disabled={!form.stateCode || citiesQuery.isLoading}
            options={(citiesQuery.data ?? []).map((city) => ({ value: city.code, label: city.name }))}
            onChange={(value) => {
              updateForm({ cityCode: value, localAreaCode: "", pincode: "" });
              setAreaSearch("");
            }}
          />

          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">Local area / pincode search</span>
            <input
              value={areaSearch}
              onChange={(event) => {
                setAreaSearch(event.target.value);
                updateForm({ localAreaCode: "" });
              }}
              disabled={!form.cityCode}
              placeholder="Search local area or pincode"
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
            />
          </label>
          {form.cityCode && areaSearch.trim() ? (
            <div className="max-h-44 overflow-auto rounded-md border border-[#E5E7EB] bg-[#FCFDFE]">
              {(areasQuery.data ?? []).length ? (
                (areasQuery.data ?? []).map((area) => (
                  <button
                    key={area.code}
                    type="button"
                    onClick={() => selectArea(area)}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm font-semibold text-[#1F2933] hover:bg-[#FFF0EC]",
                      form.localAreaCode === area.code ? "bg-[#FFF0EC] text-[#9F2600]" : ""
                    )}
                  >
                    {formatLocalAreaLabel(area)}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-semibold text-[#667085]">
                  {areasQuery.isLoading ? "Searching..." : "No matching local areas"}
                </p>
              )}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextControl label="Pincode" value={form.pincode} onChange={(value) => updateForm({ pincode: value })} />
            <TextControl label="Subtotal INR" value={form.subtotalInr} onChange={(value) => updateForm({ subtotalInr: value })} />
          </div>
          <SelectControl
            label="Payment method"
            value={form.paymentMethod}
            options={paymentMethods}
            onChange={(value) => updateForm({ paymentMethod: value as AdminLocationServiceabilityPaymentMethod })}
          />

          {summaryMutation.error ? (
            <PanelStatus
              tone="danger"
              title="Check failed"
              message={errorMessage(summaryMutation.error)}
              {...apiStatusProps(summaryMutation.error)}
            />
          ) : null}

          <Button type="submit" className="w-full" disabled={summaryMutation.isPending || !auth.isAuthenticated}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {summaryMutation.isPending ? "Checking..." : "Check serviceability"}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        {summary ? <SummaryPanel summary={summary} /> : <EmptySummary />}
      </section>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: AdminLocationServiceabilitySummary }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#D8E2EA] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#1F2933]">Serviceability result</h2>
            <p className="mt-1 text-sm font-semibold text-[#667085]">{locationLabel(summary)}</p>
          </div>
          <StatusBadge tone={serviceabilityTone(summary.status)}>{serviceabilityLabel(summary.status)}</StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ReadinessCard label="Location" active={summary.readiness.locationKnown} />
          <ReadinessCard label="Delivery" active={summary.readiness.deliveryAvailable} />
          <ReadinessCard label="COD" active={summary.query.paymentMethod !== "COD" || summary.readiness.codAvailable} />
          <ReadinessCard label="Sellers" active={summary.readiness.sellerCoverage} />
          <ReadinessCard label="Partners" active={summary.readiness.deliveryPartnerCoverage} />
          <ReadinessCard label="Rate card" active={summary.readiness.shippingRateConfigured} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
          title="Delivery"
          rows={[
            ["Mode", humanize(summary.delivery.mode)],
            ["Shipping", formatPaise(summary.delivery.shippingChargePaise)],
            ["COD surcharge", formatPaise(summary.delivery.codSurchargePaise)],
            ["Rate card", summary.delivery.matchedRateCardName ?? "Fallback setting"],
            ["Partner", summary.delivery.recommendedPartnerName ?? summary.delivery.courierProviderCode ?? "Not assigned"]
          ]}
        />
        <MetricPanel
          icon={<Store className="h-5 w-5" aria-hidden="true" />}
          title="Seller coverage"
          rows={[
            ["Exact", summary.coverage.exactSellerCount.toLocaleString("en-IN")],
            ["City", summary.coverage.citySellerCount.toLocaleString("en-IN")],
            ["State", summary.coverage.stateSellerCount.toLocaleString("en-IN")],
            ["Country", summary.coverage.countrySellerCount.toLocaleString("en-IN")],
            ["Approved total", summary.coverage.approvedSellerCount.toLocaleString("en-IN")]
          ]}
        />
        <MetricPanel
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
          title="Payment"
          rows={[
            ["Requested", summary.payments.requestedMethod],
            ["Available", summary.payments.requestedMethodEnabled ? "Yes" : "No"],
            ["COD enabled", summary.payments.codEnabled ? "Yes" : "No"],
            ["COD max", summary.payments.codMaxOrderPaise ? formatPaise(summary.payments.codMaxOrderPaise) : "No limit"],
            ["Courier providers", summary.coverage.activeCourierProviderCount.toLocaleString("en-IN")]
          ]}
        />
      </div>

      {summary.delivery.warnings.length || summary.nextActions.length ? (
        <div className="rounded-lg border border-[#D8E2EA] bg-white p-5">
          <h3 className="text-base font-black text-[#1F2933]">Operational notes</h3>
          <div className="mt-3 space-y-2">
            {[...summary.delivery.warnings, ...summary.nextActions].map((item) => (
              <p key={item} className="rounded-md border border-[#E5E7EB] bg-[#FFFCFB] px-3 py-2 text-sm font-semibold text-[#667085]">
                {item}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptySummary() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-[#D8E2EA] bg-white p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          <Search className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-black text-[#1F2933]">Select a location and run a serviceability check.</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">The result combines location data, rate cards, delivery routing, seller coverage, and payment settings.</p>
      </div>
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
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
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      >
        <option value="">Any {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
      />
    </label>
  );
}

function ReadinessCard({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#E5E7EB] p-3">
      <span className="text-sm font-semibold text-[#667085]">{label}</span>
      <StatusBadge tone={active ? "success" : "warning"}>{active ? "Ready" : "Needs work"}</StatusBadge>
    </div>
  );
}

function MetricPanel({
  icon,
  title,
  rows
}: {
  icon: ReactNode;
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">{icon}</span>
        <h3 className="text-base font-black text-[#1F2933]">{title}</h3>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-[#667085]">{label}</span>
            <span className="text-right font-black text-[#163B5C]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PanelStatus({
  title,
  message,
  tone,
  status
}: {
  title: string;
  message: string;
  tone: StatusTone;
  status?: number;
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone}>{status ? `HTTP ${status}` : title}</StatusBadge>
        <p className="text-sm font-semibold text-[#1F2933]">{message}</p>
      </div>
    </div>
  );
}

function locationLabel(summary: AdminLocationServiceabilitySummary) {
  return [
    summary.knownLocation.localArea?.name,
    summary.knownLocation.city?.name,
    summary.knownLocation.state?.name,
    summary.knownLocation.country?.name
  ]
    .filter(Boolean)
    .join(", ") || "Selected location";
}

function formatPaise(value: number) {
  return `INR ${(value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to check serviceability.";
}

function apiStatus(error: unknown) {
  return error instanceof IndihubApiError ? error.status : undefined;
}

function apiStatusProps(error: unknown): { status?: number } {
  const status = apiStatus(error);
  return typeof status === "number" ? { status } : {};
}
