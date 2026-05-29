"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@indihub/ui";
import {
  type LocationArea,
  listLocationAreas,
  listLocationCities,
  listLocationCountries,
  listLocationStates
} from "@/lib/location-api";
import { formatLocalAreaLabel, normalizeLocalAreaSearchValue } from "./location-utils";

export type AddressLocationValue = {
  country?: string | null | undefined;
  countryCode?: string | null | undefined;
  state?: string | null | undefined;
  stateCode?: string | null | undefined;
  city?: string | null | undefined;
  cityCode?: string | null | undefined;
  area?: string | null | undefined;
  localAreaCode?: string | null | undefined;
  pincode?: string | null | undefined;
};

type LocationFieldsProps = {
  defaultValue?: AddressLocationValue | undefined;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
};

const defaultInputClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white";
const defaultLabelClass = "space-y-2";

export function LocationFields({
  defaultValue,
  disabled = false,
  className,
  inputClassName,
  labelClassName
}: LocationFieldsProps) {
  const [countryCode, setCountryCode] = useState(defaultValue?.countryCode ?? "IN");
  const [stateCode, setStateCode] = useState(defaultValue?.stateCode ?? "");
  const [cityCode, setCityCode] = useState(defaultValue?.cityCode ?? "");
  const [localAreaCode, setLocalAreaCode] = useState(defaultValue?.localAreaCode ?? "");
  const [areaSearch, setAreaSearch] = useState(defaultValue?.area ?? "");
  const [selectedArea, setSelectedArea] = useState<LocationArea | null>(null);
  const [pincode, setPincode] = useState(defaultValue?.pincode ?? "");

  const inputClass = inputClassName ?? defaultInputClass;
  const labelClass = labelClassName ?? defaultLabelClass;

  const countriesQuery = useQuery({
    queryKey: ["locations", "countries"],
    queryFn: listLocationCountries
  });
  const statesQuery = useQuery({
    queryKey: ["locations", "states", countryCode],
    queryFn: () => listLocationStates(countryCode),
    enabled: Boolean(countryCode)
  });
  const citiesQuery = useQuery({
    queryKey: ["locations", "cities", stateCode],
    queryFn: () => listLocationCities(stateCode),
    enabled: Boolean(stateCode)
  });
  const areaLookupSearch = useMemo(() => normalizeLocalAreaSearchValue(areaSearch), [areaSearch]);
  const areasQuery = useQuery({
    queryKey: ["locations", "areas", cityCode, areaLookupSearch],
    queryFn: () => listLocationAreas({ cityCode, search: areaLookupSearch, limit: 50 }),
    enabled: Boolean(cityCode)
  });

  const rawCountries = countriesQuery.data ?? [];
  const rawStates = statesQuery.data ?? [];
  const rawCities = citiesQuery.data ?? [];
  const rawAreas = areasQuery.data ?? [];
  const countries = rawCountries.some((item) => item.code === countryCode)
    ? rawCountries
    : [
        {
          id: `fallback-${countryCode}`,
          code: countryCode,
          name: defaultValue?.country ?? (countryCode === "IN" ? "India" : countryCode),
          currency: countryCode === "IN" ? "INR" : "",
          locale: countryCode === "IN" ? "en-IN" : "en-US",
          phoneCode: "",
          postalCodeLabel: countryCode === "IN" ? "Pincode" : "Postal code",
          postalCodePattern: null,
          enabled: true,
          sortOrder: -1
        },
        ...rawCountries
      ];
  const states = stateCode && defaultValue?.state && !rawStates.some((item) => item.code === stateCode)
    ? [{ id: `fallback-${stateCode}`, countryId: "", code: stateCode, name: defaultValue.state, type: "State / province" }, ...rawStates]
    : rawStates;
  const cities = cityCode && defaultValue?.city && !rawCities.some((item) => item.code === cityCode)
    ? [{ id: `fallback-${cityCode}`, subdivisionId: "", code: cityCode, name: defaultValue.city }, ...rawCities]
    : rawCities;
  const areas = useMemo(() => {
    if (localAreaCode && selectedArea?.code === localAreaCode && !rawAreas.some((item) => item.code === localAreaCode)) {
      return [selectedArea, ...rawAreas];
    }

    if (localAreaCode && defaultValue?.area && !rawAreas.some((item) => item.code === localAreaCode)) {
      return [
        {
          id: `fallback-${localAreaCode}`,
          cityId: "",
          code: localAreaCode,
          name: defaultValue.area,
          postalCode: defaultValue.pincode ?? null
        },
        ...rawAreas
      ];
    }

    return rawAreas;
  }, [defaultValue?.area, defaultValue?.pincode, localAreaCode, rawAreas, selectedArea]);
  const country = countries.find((item) => item.code === countryCode);
  const state = states.find((item) => item.code === stateCode);
  const city = cities.find((item) => item.code === cityCode);
  const area = areas.find((item) => item.code === localAreaCode);
  const postalLabel = country?.postalCodeLabel ?? (countryCode === "IN" ? "Pincode" : "Postal code");

  useEffect(() => {
    if (!stateCode && defaultValue?.state && states.length) {
      const match = states.find((item) => sameName(item.name, defaultValue.state));
      if (match) {
        setStateCode(match.code);
      }
    }
  }, [defaultValue?.state, stateCode, states]);

  useEffect(() => {
    if (!cityCode && defaultValue?.city && cities.length) {
      const match = cities.find((item) => sameName(item.name, defaultValue.city));
      if (match) {
        setCityCode(match.code);
      }
    }
  }, [cityCode, cities, defaultValue?.city]);

  useEffect(() => {
    if (!localAreaCode && defaultValue?.area && areas.length) {
      const match = areas.find((item) => sameName(item.name, defaultValue.area));
      if (match) {
        setLocalAreaCode(match.code);
      }
    }
  }, [areas, defaultValue?.area, localAreaCode]);

  useEffect(() => {
    if (area?.postalCode && !pincode) {
      setPincode(area.postalCode);
    }
  }, [area?.postalCode, pincode]);

  const hiddenValues = useMemo(
    () => ({
      country: country?.name ?? defaultValue?.country ?? "India",
      state: state?.name ?? defaultValue?.state ?? "",
      city: city?.name ?? defaultValue?.city ?? "",
      area: area?.name ?? areaSearch ?? defaultValue?.area ?? ""
    }),
    [
      area?.name,
      areaSearch,
      city?.name,
      country?.name,
      defaultValue?.area,
      defaultValue?.city,
      defaultValue?.country,
      defaultValue?.state,
      state?.name
    ]
  );

  return (
    <div className={cn("grid gap-4", className)}>
      <input type="hidden" name="country" value={hiddenValues.country} />
      <input type="hidden" name="state" value={hiddenValues.state} />
      <input type="hidden" name="city" value={hiddenValues.city} />
      <input type="hidden" name="area" value={hiddenValues.area} />

      <SelectField
        label="Country"
        name="countryCode"
        value={countryCode}
        options={countries}
        getLabel={(item) => item.name}
        getValue={(item) => item.code}
        inputClassName={inputClass}
        labelClassName={labelClass}
        disabled={disabled || countriesQuery.isLoading}
        onChange={(value) => {
          setCountryCode(value);
          setStateCode("");
          setCityCode("");
          setLocalAreaCode("");
          setSelectedArea(null);
          setAreaSearch("");
          setPincode("");
        }}
      />

      <SelectField
        label={state?.type ?? "State / province"}
        name="stateCode"
        value={stateCode}
        options={states}
        getLabel={(item) => item.name}
        getValue={(item) => item.code}
        inputClassName={inputClass}
        labelClassName={labelClass}
        disabled={disabled || !countryCode || statesQuery.isLoading}
        onChange={(value) => {
          setStateCode(value);
          setCityCode("");
          setLocalAreaCode("");
          setSelectedArea(null);
          setAreaSearch("");
          setPincode("");
        }}
      />

      <SelectField
        label="City"
        name="cityCode"
        value={cityCode}
        options={cities}
        getLabel={(item) => item.name}
        getValue={(item) => item.code}
        inputClassName={inputClass}
        labelClassName={labelClass}
        disabled={disabled || !stateCode || citiesQuery.isLoading}
        onChange={(value) => {
          setCityCode(value);
          setLocalAreaCode("");
          setSelectedArea(null);
          setAreaSearch("");
          setPincode("");
        }}
      />

      <AreaSearchField
        label="Local area"
        name="localAreaCode"
        value={localAreaCode}
        searchValue={areaSearch}
        options={areas}
        getLabel={(item) => item.postalCode ? `${item.name} (${item.postalCode})` : item.name}
        getValue={(item) => item.code}
        inputClassName={inputClass}
        labelClassName={labelClass}
        disabled={disabled || !cityCode || areasQuery.isLoading}
        isLoading={areasQuery.isLoading}
        onSearchChange={(value) => {
          setAreaSearch(value);
          setLocalAreaCode("");
          setSelectedArea(null);
        }}
        onSelect={(value) => {
          setLocalAreaCode(value);
          const selected = areas.find((item) => item.code === value);
          if (selected) {
            setSelectedArea(selected);
            setAreaSearch(formatLocalAreaLabel(selected));
          }
          if (selected?.postalCode) {
            setPincode(selected.postalCode);
          }
        }}
      />

      <label className={labelClass}>
        <span className="block text-sm font-bold text-[#1F2933]">{postalLabel}</span>
        <input
          name="pincode"
          value={pincode}
          onChange={(event) => setPincode(event.target.value)}
          disabled={disabled}
          className={inputClass}
          placeholder={postalLabel}
          required={countryCode !== "AE"}
        />
      </label>
    </div>
  );
}

function SelectField<T>({
  label,
  name,
  value,
  options,
  getLabel,
  getValue,
  inputClassName,
  labelClassName,
  disabled,
  onChange
}: {
  label: string;
  name: string;
  value: string;
  options: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  inputClassName: string;
  labelClassName: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={labelClassName}>
      <span className="block text-sm font-bold text-[#1F2933]">{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={inputClassName} required>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((item) => (
          <option key={getValue(item)} value={getValue(item)}>
            {getLabel(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AreaSearchField<T>({
  label,
  name,
  value,
  searchValue,
  options,
  getLabel,
  getValue,
  inputClassName,
  labelClassName,
  disabled,
  isLoading,
  onSearchChange,
  onSelect
}: {
  label: string;
  name: string;
  value: string;
  searchValue: string;
  options: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  inputClassName: string;
  labelClassName: string;
  disabled?: boolean;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const selectedOption = options.find((item) => getValue(item) === value);
  const selectedOptionLabel = selectedOption ? getLabel(selectedOption) : "";
  const selectionIsDisplayed = Boolean(value && selectedOptionLabel && searchValue.trim() === selectedOptionLabel.trim());
  const showOptions = focused && !disabled && !selectionIsDisplayed;

  return (
    <label className={cn(labelClassName, "relative")}>
      <span className="block text-sm font-bold text-[#1F2933]">{label}</span>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        disabled={disabled}
        className={inputClassName}
        placeholder={isLoading ? "Loading local areas..." : `Search ${label.toLowerCase()}`}
        autoComplete="off"
      />
      {showOptions ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[#D8E2EA] bg-white shadow-lg">
          {options.length ? (
            options.map((item) => {
              const itemValue = getValue(item);
              return (
                <button
                  key={itemValue}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(itemValue);
                    setFocused(false);
                  }}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-sm font-semibold text-[#1F2933] hover:bg-[#EAF1F7]",
                    value === itemValue ? "bg-[#EAF1F7]" : ""
                  )}
                >
                  {getLabel(item)}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm font-semibold text-[#667085]">
              {isLoading ? "Searching..." : "No matching local areas"}
            </div>
          )}
        </div>
      ) : null}
    </label>
  );
}

function sameName(left: string, right: string | null | undefined) {
  return left.trim().toLowerCase() === right?.trim().toLowerCase();
}
