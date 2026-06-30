"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, LocateFixed, MapPinned, Plus, Trash2, X } from "lucide-react";
import { Button, cn } from "@indihub/ui";
import { useLocationAreaStore, useLocationCatalog } from "@/components/locations/location-store";
import { formatLocalAreaLabel } from "@/components/locations/location-utils";
import type { LocationArea } from "@/lib/location-api";

export type SellerServiceAreaDraft = {
  id: string;
  label: string;
  countryCode: string;
  stateCode: string;
  cityCode: string;
  localAreaCode: string;
  pincode: string;
  latitude: string;
  longitude: string;
  radiusKm: string;
  isActive: boolean;
};

type SellerServiceAreaEditorProps = {
  areas: SellerServiceAreaDraft[];
  disabled?: boolean;
  minimumAreas?: number;
  emptyMessage?: string;
  addLabel?: string;
  className?: string;
  actionPrefix?: ReactNode;
  createArea?: () => SellerServiceAreaDraft;
  onChange: (areas: SellerServiceAreaDraft[]) => void;
};

type GpsStatus =
  | { state: "idle"; message?: string }
  | { state: "loading"; message: string }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

export function SellerServiceAreaEditor({
  areas,
  disabled,
  minimumAreas = 0,
  emptyMessage = "No service coverage added yet. Add at least one location before publishing.",
  addLabel = "Add location",
  className,
  actionPrefix,
  createArea = createEmptySellerServiceAreaDraft,
  onChange,
}: SellerServiceAreaEditorProps) {
  function addArea() {
    onChange([...areas, createArea()]);
  }

  function updateArea(id: string, patch: Partial<SellerServiceAreaDraft>) {
    onChange(areas.map((area) => (area.id === id ? { ...area, ...patch } : area)));
  }

  function removeArea(id: string) {
    const next = areas.filter((area) => area.id !== id);
    if (next.length >= minimumAreas) {
      onChange(next);
      return;
    }

    onChange([...next, createArea()]);
  }

  return (
    <div className={cn("seller-service-area-editor mt-5 grid gap-4", className)}>
      <div className="seller-service-area-toolbar">
        {actionPrefix ? <div className="seller-service-area-toolbar-group">{actionPrefix}</div> : null}
        <Button type="button" variant="outline" size="sm" className="seller-service-area-action-button" onClick={addArea} disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>

      {!areas.length ? (
        <div className="rounded-md border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-4">
          <p className="text-sm font-bold leading-6 text-[#667085]">{emptyMessage}</p>
        </div>
      ) : null}

      {areas.map((area, index) => (
        <SellerServiceAreaRow
          key={area.id}
          area={area}
          index={index}
          disabled={disabled === true}
          canRemove={areas.length > minimumAreas}
          onUpdate={(patch) => updateArea(area.id, patch)}
          onRemove={() => removeArea(area.id)}
        />
      ))}
    </div>
  );
}

function SellerServiceAreaRow({
  area,
  index,
  disabled,
  canRemove,
  onUpdate,
  onRemove,
}: {
  area: SellerServiceAreaDraft;
  index: number;
  disabled?: boolean;
  canRemove: boolean;
  onUpdate: (patch: Partial<SellerServiceAreaDraft>) => void;
  onRemove: () => void;
}) {
  const [areaSearch, setAreaSearch] = useState(area.label || area.pincode);
  const [areaSearchOpen, setAreaSearchOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>({ state: "idle" });

  useEffect(() => {
    setAreaSearch(area.label || area.pincode);
    setAreaSearchOpen(false);
    setGpsStatus({ state: "idle" });
  }, [area.id, area.label, area.pincode]);

  const locationCatalog = useLocationCatalog({
    countryCode: area.countryCode,
    stateCode: area.stateCode,
  });
  const areasStore = useLocationAreaStore({
    countryCode: area.countryCode,
    stateCode: area.stateCode,
    cityCode: area.cityCode,
    search: areaSearch,
    limit: 50,
  });

  const selectedCountry = useMemo(
    () => locationCatalog.countries.find((country) => country.code === area.countryCode),
    [area.countryCode, locationCatalog.countries],
  );
  const selectedState = useMemo(
    () => locationCatalog.states.find((state) => state.code === area.stateCode),
    [area.stateCode, locationCatalog.states],
  );
  const selectedCity = useMemo(
    () => locationCatalog.cities.find((city) => city.code === area.cityCode),
    [area.cityCode, locationCatalog.cities],
  );
  const coverageLabel = area.label.trim() || fallbackCoverageLabel(area, selectedCountry?.name, selectedState?.name, selectedCity?.name);
  const hasGps = Boolean(area.latitude && area.longitude);
  const showAreaResults = areaSearchOpen && area.countryCode && areaSearch.trim().length > 0;

  function updateCountry(countryCode: string) {
    const country = locationCatalog.countries.find((item) => item.code === countryCode);
    setAreaSearch("");
    onUpdate({
      countryCode,
      stateCode: "",
      cityCode: "",
      localAreaCode: "",
      pincode: "",
      label: country?.name ?? countryCode,
    });
  }

  function updateState(stateCode: string) {
    const state = locationCatalog.states.find((item) => item.code === stateCode);
    setAreaSearch("");
    onUpdate({
      stateCode,
      cityCode: "",
      localAreaCode: "",
      pincode: "",
      label: state ? [state.name, selectedCountry?.name].filter(Boolean).join(", ") : selectedCountry?.name ?? "",
    });
  }

  function updateCity(cityCode: string) {
    const city = locationCatalog.cities.find((item) => item.code === cityCode);
    setAreaSearch("");
    onUpdate({
      cityCode,
      localAreaCode: "",
      pincode: "",
      label: city ? [city.name, selectedState?.name].filter(Boolean).join(", ") : selectedState?.name ?? selectedCountry?.name ?? "",
    });
  }

  function selectArea(selectedArea: LocationArea) {
    const selectedLocalAreaLabel = formatLocalAreaLabel(selectedArea);
    const city = selectedArea.city;
    const state = city?.subdivision;
    const country = state?.country;
    setAreaSearch(selectedLocalAreaLabel);
    setAreaSearchOpen(false);
    onUpdate({
      countryCode: country?.code ?? area.countryCode,
      stateCode: state?.code ?? area.stateCode,
      cityCode: city?.code ?? area.cityCode,
      localAreaCode: selectedArea.code,
      pincode: selectedArea.postalCode ?? "",
      label: selectedLocalAreaLabel,
    });
  }

  function clearLocalArea() {
    setAreaSearch("");
    onUpdate({
      localAreaCode: "",
      pincode: "",
      label: selectedCity
        ? [selectedCity.name, selectedState?.name].filter(Boolean).join(", ")
        : selectedState?.name ?? selectedCountry?.name ?? "",
    });
  }

  function fetchGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus({
        state: "error",
        message: "GPS is not available in this browser.",
      });
      return;
    }

    setGpsStatus({ state: "loading", message: "Fetching current GPS..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? ` Accuracy around ${Math.round(position.coords.accuracy)} m.`
          : "";
        onUpdate({ latitude, longitude });
        setGpsStatus({ state: "success", message: `GPS location added.${accuracy}` });
      },
      (error) => {
        setGpsStatus({ state: "error", message: gpsErrorMessage(error) });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  return (
    <div className="seller-service-area-card">
      <div className="seller-service-area-card-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-[#123A5A]">Coverage location {index + 1}</p>
            <span
              className={cn(
                "rounded px-2 py-1 text-[11px] font-black uppercase tracking-wide",
                area.isActive ? "bg-[#E8F8EF] text-[#0F8A5F]" : "bg-[#F3F4F6] text-[#667085]",
              )}
            >
              {area.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">{coverageLabel}</p>
        </div>
        <div className="seller-service-area-row-actions">
          <label className="seller-service-area-toggle">
            <input
              type="checkbox"
              checked={area.isActive}
              disabled={disabled}
              onChange={(event) => onUpdate({ isActive: event.target.checked })}
              className="h-4 w-4 accent-[#ED3500]"
            />
            Active
          </label>
          <Button type="button" variant="ghost" size="sm" className="seller-service-area-action-button" onClick={onRemove} disabled={disabled || !canRemove}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="seller-service-area-primary-grid">
          <SelectField
            label="Country"
            value={area.countryCode}
            disabled={disabled || locationCatalog.countriesQuery.isLoading}
            emptyLabel="Select country"
            options={withCurrentOption(
              locationCatalog.countries.map((country) => ({ value: country.code, label: country.name })),
              area.countryCode,
            )}
            onChange={updateCountry}
          />
          <SelectField
            label="State"
            value={area.stateCode}
            disabled={disabled || !area.countryCode || locationCatalog.statesQuery.isLoading}
            emptyLabel="All states"
            options={withCurrentOption(
              locationCatalog.states.map((state) => ({ value: state.code, label: state.name })),
              area.stateCode,
            )}
            onChange={updateState}
          />
          <SelectField
            label="City"
            value={area.cityCode}
            disabled={disabled || !area.stateCode || locationCatalog.citiesQuery.isLoading}
            emptyLabel="All cities"
            options={withCurrentOption(
              locationCatalog.cities.map((city) => ({ value: city.code, label: city.name })),
              area.cityCode,
            )}
            onChange={updateCity}
          />
        </div>

        <div className="seller-service-area-search-grid">
          <div className="relative">
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">
                Local area or pincode
              </span>
              <input
                value={areaSearch}
                disabled={disabled || !area.countryCode}
                placeholder="Search area name or pincode, then select"
                onFocus={() => setAreaSearchOpen(true)}
                onChange={(event) => {
                  setAreaSearch(event.target.value);
                  setAreaSearchOpen(true);
                }}
                className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6] disabled:opacity-60"
              />
            </label>

            {showAreaResults ? (
              <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-md border border-[#D8E2EA] bg-white shadow-lg">
                {areasStore.areas.length ? (
                  areasStore.areas.map((result) => (
                    <button
                      key={result.code}
                      type="button"
                      onClick={() => selectArea(result)}
                      className={cn(
                        "block w-full px-3 py-2 text-left text-sm font-semibold text-[#1F2933] hover:bg-[#FFF0EC]",
                        area.localAreaCode === result.code ? "bg-[#FFF0EC] text-[#9F2600]" : "",
                      )}
                    >
                      <span className="block font-black">{formatLocalAreaLabel(result)}</span>
                      <span className="block text-xs text-[#667085]">
                        {[result.city?.name, result.city?.subdivision?.name, result.city?.subdivision?.country?.name]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm font-semibold text-[#667085]">
                    {areasStore.isLoading || areasStore.isFetching ? "Searching..." : "No matching local areas"}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Radius km</span>
            <input
              type="number"
              min={1}
              step={1}
              value={area.radiusKm}
              disabled={disabled}
              onChange={(event) => onUpdate({ radiusKm: event.target.value })}
              placeholder="10"
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white focus:ring-2 focus:ring-[#FFE0D6] disabled:opacity-60"
            />
          </label>
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
            <div className="seller-service-area-summary-grid">
              <SummaryChip label="Country" value={selectedCountry?.name ?? area.countryCode} />
              <SummaryChip label="State" value={selectedState?.name ?? area.stateCode} empty="All states" />
              <SummaryChip label="City" value={selectedCity?.name ?? area.cityCode} empty="All cities" />
              <SummaryChip label="Local area" value={area.localAreaCode ? area.label : ""} empty="Not selected" />
              <SummaryChip label="Pincode" value={area.pincode} empty="Auto after area select" />
              <SummaryChip
                label="GPS"
                value={hasGps ? `${area.latitude}, ${area.longitude}` : ""}
                empty="Not captured"
              />
            </div>
          </div>

          <div className="seller-service-area-footer-actions">
            {area.localAreaCode ? (
              <Button type="button" variant="outline" size="sm" className="seller-service-area-action-button" onClick={clearLocalArea} disabled={disabled}>
                <X className="h-4 w-4" aria-hidden="true" />
                Clear area
              </Button>
            ) : null}
            {hasGps ? (
              <Button type="button" variant="outline" size="sm" className="seller-service-area-action-button" onClick={() => onUpdate({ latitude: "", longitude: "" })} disabled={disabled}>
                <MapPinned className="h-4 w-4" aria-hidden="true" />
                Clear GPS
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="seller-service-area-action-button" onClick={fetchGps} disabled={disabled || gpsStatus.state === "loading"}>
              {gpsStatus.state === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : gpsStatus.state === "success" ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
              )}
              {gpsStatus.state === "loading" ? "Fetching..." : "Use GPS"}
            </Button>
          </div>
        </div>

        {gpsStatus.state !== "idle" ? (
          <p
            className={cn(
              "rounded-md px-3 py-2 text-xs font-bold",
              gpsStatus.state === "error" ? "bg-[#FDECEC] text-[#8A1F1F]" : "bg-[#E8F8EF] text-[#0F8A5F]",
            )}
          >
            {gpsStatus.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SelectField({
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
      <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">{label}</span>
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

function SummaryChip({ label, value, empty }: { label: string; value?: string; empty?: string }) {
  const display = value?.trim() || empty || "Not selected";

  return (
    <span className="seller-service-area-summary-item">
      <span className="text-[#667085]">{label}</span>
      <span className="min-w-0 truncate text-left">{display}</span>
    </span>
  );
}

function withCurrentOption(options: Array<{ value: string; label: string }>, currentValue: string) {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return options;
  }

  return [{ value: currentValue, label: currentValue }, ...options];
}

function fallbackCoverageLabel(
  area: SellerServiceAreaDraft,
  countryName: string | undefined,
  stateName: string | undefined,
  cityName: string | undefined,
) {
  if (area.localAreaCode && area.pincode) {
    return `${area.localAreaCode} (${area.pincode})`;
  }

  return cityName || stateName || countryName || area.countryCode || "Service coverage";
}

function gpsErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "GPS permission was denied. Allow location access and try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "GPS position is unavailable. Try again from the seller location.";
  }
  if (error.code === error.TIMEOUT) {
    return "GPS request timed out. Move to an open area and try again.";
  }

  return error.message || "Unable to fetch GPS location.";
}

export function createEmptySellerServiceAreaDraft(
  overrides: Partial<Omit<SellerServiceAreaDraft, "id">> = {},
): SellerServiceAreaDraft {
  return {
    id: createSellerServiceAreaDraftId(),
    label: "",
    countryCode: "IN",
    stateCode: "",
    cityCode: "",
    localAreaCode: "",
    pincode: "",
    latitude: "",
    longitude: "",
    radiusKm: "10",
    isActive: true,
    ...overrides,
  };
}

export function createSellerServiceAreaDraftId() {
  return `service-area-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
