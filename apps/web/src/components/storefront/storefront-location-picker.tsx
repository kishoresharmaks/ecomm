"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MapPin, RotateCcw } from "lucide-react";
import { Button, cn } from "@indihub/ui";
import { useMarket } from "@/components/market/market-context";
import { type LocationArea } from "@/lib/location-api";
import { useLocationAreaStore, useLocationCatalog } from "@/components/locations/location-store";
import { formatLocalAreaLabel, normalizeLocalAreaSearchValue } from "@/components/locations/location-utils";
import { useStorefrontLocation } from "./storefront-location-context";
import {
  browsingLocationLabel,
  normalizeBrowsingLocation,
} from "./storefront-location-utils";

type StorefrontLocationPickerProps = {
  mobile?: boolean;
  compact?: boolean;
  className?: string;
};

export function StorefrontLocationPicker({
  mobile = false,
  compact = false,
  className,
}: StorefrontLocationPickerProps) {
  const market = useMarket();
  const {
    activeLocation,
    prefillLocation,
    source,
    setManualLocation,
    resetLocationPreference,
  } = useStorefrontLocation();
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState(activeLocation?.countryCode ?? market.countryCode);
  const [stateCode, setStateCode] = useState(activeLocation?.stateCode ?? "");
  const [cityCode, setCityCode] = useState(activeLocation?.cityCode ?? "");
  const [localAreaCode, setLocalAreaCode] = useState(activeLocation?.localAreaCode ?? "");
  const [areaSearch, setAreaSearch] = useState(activeLocation?.areaName ?? "");
  const [selectedArea, setSelectedArea] = useState<LocationArea | null>(null);
  const [pincode, setPincode] = useState(activeLocation?.pincode ?? "");
  const [showRefinements, setShowRefinements] = useState(
    Boolean(activeLocation?.localAreaCode || activeLocation?.areaName || activeLocation?.pincode),
  );

  useEffect(() => {
    const location = activeLocation ?? null;
    setCountryCode(location?.countryCode ?? market.countryCode);
    setStateCode(location?.stateCode ?? "");
    setCityCode(location?.cityCode ?? "");
    setLocalAreaCode(location?.localAreaCode ?? "");
    setAreaSearch(location?.areaName ?? "");
    setSelectedArea(null);
    setPincode(location?.pincode ?? "");
    setShowRefinements(Boolean(location?.localAreaCode || location?.areaName || location?.pincode));
  }, [activeLocation, market.countryCode]);

  const locationCatalog = useLocationCatalog({ countryCode, stateCode });
  const areasStore = useLocationAreaStore({
    countryCode,
    stateCode,
    cityCode,
    search: areaSearch,
    limit: 50,
    enabled: open && showRefinements,
  });

  const countries = locationCatalog.countries;
  const states = locationCatalog.states;
  const cities = locationCatalog.cities;
  const areas = areasStore.areas;
  const country = countries.find((item) => item.code === countryCode);
  const state = states.find((item) => item.code === stateCode);
  const city = cities.find((item) => item.code === cityCode);
  const area =
    selectedArea ??
    areas.find((item) => item.code === localAreaCode) ??
    (localAreaCode && areaSearch
      ? {
          id: `selected-${localAreaCode}`,
          cityId: "",
          code: localAreaCode,
          name: areaSearch,
          postalCode: pincode || null,
        }
      : null);
  const selectedAreaLabel = area ? formatLocalAreaLabel(area) : "";
  const shouldShowAreaSuggestions =
    Boolean(countryCode) &&
    areaSearch.trim().length > 0 &&
    normalizeLocalAreaSearchValue(areaSearch) !==
      normalizeLocalAreaSearchValue(selectedAreaLabel);

  const hasManualOverride = source === "manual";
  const triggerToneClass = mobile
    ? "w-full justify-between rounded-[22px] border border-[#D8E2EA] bg-white px-4 py-3 text-left shadow-sm"
    : compact
      ? "w-full min-w-0 justify-between rounded-full border border-[#D8E2EA] bg-[#FCFDFE] px-3 py-2.5 text-left shadow-sm"
      : "min-w-[220px] justify-between rounded-full border border-[#D8E2EA] bg-white/85 px-4 py-2.5 text-left shadow-sm backdrop-blur";
  const triggerLabel = compact
    ? activeLocation?.areaName ??
      activeLocation?.cityName ??
      activeLocation?.stateName ??
      activeLocation?.countryName ??
      "All stores"
    : browsingLocationLabel(activeLocation);

  function applyLocation() {
    const selectedStateName = state?.name ?? selectedArea?.city?.subdivision?.name;
    const selectedCityName = city?.name ?? selectedArea?.city?.name;
    const next = normalizeBrowsingLocation({
      countryCode,
      countryName: country?.name ?? selectedArea?.city?.subdivision?.country?.name ?? market.market.countryName,
      ...(stateCode ? { stateCode } : {}),
      ...(selectedStateName ? { stateName: selectedStateName } : {}),
      ...(cityCode ? { cityCode } : {}),
      ...(selectedCityName ? { cityName: selectedCityName } : {}),
      ...(localAreaCode ? { localAreaCode } : {}),
      ...((area?.name ?? areaSearch)
        ? { areaName: area?.name ?? areaSearch }
        : {}),
      ...((area?.postalCode ?? pincode)
        ? { pincode: area?.postalCode ?? pincode }
        : {}),
    });
    setManualLocation(next);
    setOpen(false);
  }

  function resetLocation() {
    resetLocationPreference();
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex items-center gap-3 text-[#163B5C] transition hover:border-[#ED3500] hover:text-[#ED3500]",
          triggerToneClass,
        )}
        aria-expanded={open}
      >
        <span
          className={cn(
            "grid place-items-center rounded-full bg-[#FFF0EC] text-[#ED3500]",
            compact ? "h-8 w-8" : "h-9 w-9",
          )}
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          {compact ? (
            <span className="block truncate text-sm font-black text-[#163B5C]">
              {triggerLabel}
            </span>
          ) : (
            <>
              <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-[#667085]">
                {hasManualOverride ? "Browsing near" : source === "saved-address" ? "Saved address" : "Stores"}
              </span>
              <span className="block truncate text-sm font-black">
                {triggerLabel}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition", open ? "rotate-180" : "")}
          aria-hidden="true"
        />
      </button>

      {open ? (
          <div
            className={cn(
              "absolute right-0 z-50 mt-3 flex max-h-[78svh] w-full flex-col overflow-hidden rounded-2xl border border-[#D8E2EA] bg-white shadow-2xl",
            mobile ? "left-0 min-w-0" : "min-w-[340px] max-w-[380px]",
          )}
        >
          <div className="border-b border-[#E5E7EB] px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ED3500]">
              Store location
            </p>
            <h3 className="mt-2 text-xl font-black text-[#163B5C]">Choose browsing location</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
              Start with a country, then refine by state, city, local area, or pincode.
            </p>
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
            {prefillLocation ? (
              <button
                type="button"
                onClick={resetLocation}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  source === "saved-address"
                    ? "border-[#ED3500] bg-[#FFF0EC] text-[#9F2600]"
                    : "border-[#E5E7EB] bg-[#F8FAFC] text-[#163B5C] hover:border-[#ED3500]",
                )}
              >
                <span>
                  <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#667085]">
                    Saved address
                  </span>
                  <span className="mt-1 block text-sm font-black">
                    {browsingLocationLabel(prefillLocation)}
                  </span>
                </span>
                <span className="text-xs font-black uppercase tracking-[0.14em]">
                  {source === "saved-address" ? "Active" : "Use"}
                </span>
              </button>
            ) : null}

            <div className="space-y-3">
              <SelectField
                label="Country"
                value={countryCode}
                onChange={(value) => {
                  setCountryCode(value);
                  setStateCode("");
                  setCityCode("");
                  setLocalAreaCode("");
                  setAreaSearch("");
                  setSelectedArea(null);
                  setPincode("");
                  setShowRefinements(false);
                }}
                options={countries.map((item) => ({ value: item.code, label: item.name }))}
              />
              <SelectField
                label={state?.type ?? "State / Province"}
                value={stateCode}
                onChange={(value) => {
                  setStateCode(value);
                  setCityCode("");
                  setLocalAreaCode("");
                  setAreaSearch("");
                  setSelectedArea(null);
                  setPincode("");
                  setShowRefinements(false);
                }}
                disabled={!countryCode}
                options={states.map((item) => ({ value: item.code, label: item.name }))}
              />
              <SelectField
                label="City"
                value={cityCode}
                onChange={(value) => {
                  setCityCode(value);
                  setLocalAreaCode("");
                  setAreaSearch("");
                  setSelectedArea(null);
                  setPincode("");
                  setShowRefinements(false);
                }}
                disabled={!stateCode}
                options={cities.map((item) => ({ value: item.code, label: item.name }))}
              />
            </div>

            {countryCode ? (
              <div className="space-y-3 rounded-2xl border border-[#E5E7EB] bg-[#FCFDFE] p-4">
                <button
                  type="button"
                  onClick={() => setShowRefinements((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <span className="block text-sm font-black text-[#163B5C]">
                      Add area or pincode
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[#667085]">
                      Optional. Use this only when you want tighter local store matching.
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-[#667085] transition", showRefinements ? "rotate-180" : "")}
                    aria-hidden="true"
                  />
                </button>

                {showRefinements ? (
                  <div className="space-y-3">
                    <label className="space-y-2">
                      <span className="block text-sm font-bold text-[#425466]">
                        Local area
                      </span>
                      <input
                        value={areaSearch}
                        onChange={(event) => {
                          setAreaSearch(event.target.value);
                          setLocalAreaCode("");
                          setSelectedArea(null);
                        }}
                        placeholder="Search area or pincode"
                        className="h-11 w-full rounded-xl border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500]"
                      />
                      {shouldShowAreaSuggestions ? (
                        <div className="max-h-32 overflow-auto rounded-xl border border-[#E5E7EB] bg-white">
                          {areas.length ? (
                            areas.slice(0, 6).map((item) => (
                              <button
                                key={item.code}
                                type="button"
                                onClick={() => {
                                  setSelectedArea(item);
                                  setLocalAreaCode(item.code);
                                  setAreaSearch(formatLocalAreaLabel(item));
                                  setPincode(item.postalCode ?? "");
                                  const selectedCity = item.city;
                                  const selectedSubdivision = selectedCity?.subdivision;
                                  const selectedCountry = selectedSubdivision?.country;
                                  if (selectedCountry?.code) {
                                    setCountryCode(selectedCountry.code);
                                  }
                                  if (selectedSubdivision?.code) {
                                    setStateCode(selectedSubdivision.code);
                                  }
                                  if (selectedCity?.code) {
                                    setCityCode(selectedCity.code);
                                  }
                                }}
                                className={cn(
                                  "block w-full px-3 py-2 text-left text-sm font-semibold text-[#1F2933] hover:bg-[#FFF0EC]",
                                  localAreaCode === item.code ? "bg-[#FFF0EC]" : "",
                                )}
                              >
                                {formatLocalAreaLabel(item)}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm font-semibold text-[#667085]">
                              {areasStore.isLoading ? "Searching areas..." : "No matching local areas"}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </label>

                    <label className="space-y-2">
                      <span className="block text-sm font-bold text-[#425466]">
                        Postal code
                      </span>
                      <input
                        value={pincode}
                        onChange={(event) => setPincode(event.target.value)}
                        placeholder="Optional postal code"
                        className="h-11 w-full rounded-xl border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

          </div>

          <div className="border-t border-[#E5E7EB] bg-white px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={resetLocation}
                className="inline-flex items-center gap-2 text-sm font-black text-[#667085] transition hover:text-[#163B5C]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {prefillLocation ? "Use saved address" : "Show all stores"}
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={applyLocation} disabled={!countryCode}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-bold text-[#425466]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
