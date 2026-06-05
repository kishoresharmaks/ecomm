"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@indihub/ui";
import { type LocationArea } from "@/lib/location-api";
import { formatLocalAreaLabel } from "./location-utils";
import { useLocationAreaStore, useLocationCatalog } from "./location-store";

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

type LocationAutofillEventDetail = {
  address?: AddressLocationValue;
  overwrite?: boolean;
};

type LocationAreaOption = {
  code: string;
  name: string;
  postalCode?: string | null;
  city?: LocationArea["city"];
};

type LocationFieldsProps = {
  defaultValue?: AddressLocationValue | undefined;
  defaultCountryCode?: string | undefined;
  loadCitiesAcrossCountry?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
};

const defaultInputClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white";
const defaultLabelClass = "space-y-2";
const locationAutofillEventName = "indihub:location-autofill";

export function LocationFields({
  defaultValue,
  defaultCountryCode = "IN",
  loadCitiesAcrossCountry = false,
  disabled = false,
  className,
  inputClassName,
  labelClassName
}: LocationFieldsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [countryCode, setCountryCode] = useState(defaultValue?.countryCode ?? defaultCountryCode);
  const [stateCode, setStateCode] = useState(defaultValue?.stateCode ?? "");
  const [cityCode, setCityCode] = useState(defaultValue?.cityCode ?? "");
  const [localAreaCode, setLocalAreaCode] = useState(defaultValue?.localAreaCode ?? "");
  const [areaSearch, setAreaSearch] = useState(defaultValue?.area ?? "");
  const [selectedArea, setSelectedArea] = useState<LocationAreaOption | null>(null);
  const [pincode, setPincode] = useState(defaultValue?.pincode ?? "");
  const [pendingAutofill, setPendingAutofill] = useState<AddressLocationValue | null>(null);
  const [manualNames, setManualNames] = useState<{
    country?: string | undefined;
    state?: string | undefined;
    city?: string | undefined;
    area?: string | undefined;
  }>({});

  const inputClass = inputClassName ?? defaultInputClass;
  const labelClass = labelClassName ?? defaultLabelClass;
  const postalCodeLookup = postalCodeLookupValue(countryCode, pincode);

  const locationCatalog = useLocationCatalog({ countryCode, stateCode, loadCitiesAcrossCountry });
  const areasStore = useLocationAreaStore({
    countryCode,
    stateCode: postalCodeLookup ? "" : stateCode,
    cityCode: postalCodeLookup ? "" : cityCode,
    search: postalCodeLookup ? "" : areaSearch,
    postalCode: postalCodeLookup,
    limit: 50,
  });

  useEffect(() => {
    setCountryCode(defaultValue?.countryCode ?? defaultCountryCode);
    setStateCode(defaultValue?.stateCode ?? "");
    setCityCode(defaultValue?.cityCode ?? "");
    setLocalAreaCode(defaultValue?.localAreaCode ?? "");
    setAreaSearch(defaultValue?.area ?? "");
    setPincode(defaultValue?.pincode ?? "");
    setSelectedArea(null);
    setPendingAutofill(null);
    setManualNames({});
  }, [
    defaultCountryCode,
    defaultValue?.area,
    defaultValue?.cityCode,
    defaultValue?.countryCode,
    defaultValue?.localAreaCode,
    defaultValue?.pincode,
    defaultValue?.stateCode
  ]);

  const rawCountries = locationCatalog.countries;
  const rawStates = locationCatalog.states;
  const rawCities = locationCatalog.cities;
  const rawAreas = areasStore.areas;
  const selectedAreaCity = selectedArea?.city;
  const selectedAreaSubdivision = selectedAreaCity?.subdivision;
  const selectedAreaCountry = selectedAreaSubdivision?.country;
  const countries = rawCountries.some((item) => item.code === countryCode)
    ? rawCountries
    : [
        {
          id: selectedAreaCountry?.id ?? `fallback-${countryCode}`,
          code: countryCode,
          name:
            selectedAreaCountry?.name ??
            defaultValue?.country ??
            (countryCode === defaultCountryCode && countryCode === "IN" ? "India" : countryCode),
          currency: selectedAreaCountry?.currency ?? (countryCode === "IN" ? "INR" : ""),
          locale: selectedAreaCountry?.locale ?? (countryCode === "IN" ? "en-IN" : "en-US"),
          phoneCode: selectedAreaCountry?.phoneCode ?? "",
          postalCodeLabel: selectedAreaCountry?.postalCodeLabel ?? (countryCode === "IN" ? "Pincode" : "Postal code"),
          postalCodePattern: selectedAreaCountry?.postalCodePattern ?? null,
          enabled: selectedAreaCountry?.enabled ?? true,
          sortOrder: selectedAreaCountry?.sortOrder ?? -1
        },
        ...rawCountries
      ];
  const fallbackStateName = selectedAreaSubdivision?.name ?? defaultValue?.state;
  const states = stateCode && fallbackStateName && !rawStates.some((item) => item.code === stateCode)
    ? [
        {
          id: selectedAreaSubdivision?.id ?? `fallback-${stateCode}`,
          countryId: selectedAreaSubdivision?.countryId ?? "",
          code: stateCode,
          name: fallbackStateName,
          type: selectedAreaSubdivision?.type ?? "State / province",
          country: selectedAreaCountry
        },
        ...rawStates
      ]
    : rawStates;
  const fallbackCityName = selectedAreaCity?.name ?? defaultValue?.city;
  const cities = cityCode && fallbackCityName && !rawCities.some((item) => item.code === cityCode)
    ? [
        {
          id: selectedAreaCity?.id ?? `fallback-${cityCode}`,
          subdivisionId: selectedAreaCity?.subdivisionId ?? "",
          code: cityCode,
          name: fallbackCityName,
          subdivision: selectedAreaSubdivision
        },
        ...rawCities
      ]
    : rawCities;
  const areas: LocationAreaOption[] = useMemo(() => {
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
  const canChooseCity = Boolean(countryCode && (stateCode || loadCitiesAcrossCountry));
  const pincodeAreaOptions = postalCodeLookup ? areas.filter((item) => item.postalCode === postalCodeLookup) : [];

  function selectArea(nextArea: LocationAreaOption) {
    setLocalAreaCode(nextArea.code);
    setSelectedArea(nextArea);
    setAreaSearch(formatLocalAreaLabel(nextArea));
    const selectedCity = nextArea.city;
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
    if (nextArea.postalCode) {
      setPincode(nextArea.postalCode);
    }
  }

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
        if (match.subdivision?.country?.code) {
          setCountryCode(match.subdivision.country.code);
        }
        if (match.subdivision?.code) {
          setStateCode(match.subdivision.code);
        }
      }
    }
  }, [cityCode, cities, defaultValue?.city]);

  useEffect(() => {
    if (!localAreaCode && defaultValue?.area && areas.length) {
      const match = areas.find((item) => sameName(item.name, defaultValue.area));
      if (match) {
        selectArea(match);
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
      country:
        country?.name ??
        selectedAreaCountry?.name ??
        manualNames.country ??
        defaultValue?.country ??
        "India",
      state: state?.name ?? selectedAreaSubdivision?.name ?? manualNames.state ?? defaultValue?.state ?? "",
      city: city?.name ?? selectedAreaCity?.name ?? manualNames.city ?? defaultValue?.city ?? "",
      area: area?.name ?? (areaSearch || manualNames.area || defaultValue?.area || "")
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
      manualNames.area,
      manualNames.city,
      manualNames.country,
      manualNames.state,
      selectedAreaCity?.name,
      selectedAreaCountry?.name,
      selectedAreaSubdivision?.name,
      state?.name
    ]
  );

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }

    function handleAutofill(event: Event) {
      const detail = (event as CustomEvent<LocationAutofillEventDetail>).detail;
      const address = detail?.address;
      if (!address) {
        return;
      }

      const overwrite = Boolean(detail.overwrite);
      const nextAutofill: AddressLocationValue = {
        country: cleanAddressValue(address.country),
        countryCode: cleanAddressValue(address.countryCode),
        state: cleanAddressValue(address.state),
        city: cleanAddressValue(address.city),
        area: cleanAddressValue(address.area),
        pincode: cleanAddressValue(address.pincode)
      };

      setPendingAutofill((current) => ({ ...(current ?? {}), ...nextAutofill }));

      if (nextAutofill.countryCode && (overwrite || !countryCode)) {
        setCountryCode(nextAutofill.countryCode);
      }

      if (overwrite) {
        if (nextAutofill.state) {
          setStateCode("");
        }
        if (nextAutofill.city) {
          setCityCode("");
        }
        if (nextAutofill.area) {
          setLocalAreaCode("");
          setSelectedArea(null);
        }
      }

      if (nextAutofill.pincode && (overwrite || !pincode)) {
        setPincode(nextAutofill.pincode);
        setLocalAreaCode("");
        setSelectedArea(null);
      }

      if (nextAutofill.area && (overwrite || !areaSearch)) {
        setAreaSearch(nextAutofill.area);
        setLocalAreaCode("");
        setSelectedArea(null);
      }

      setManualNames((current) => ({
        country: nextAutofill.country && (overwrite || !current.country) ? nextAutofill.country : current.country,
        state: nextAutofill.state && (overwrite || !stateCode) ? nextAutofill.state : current.state,
        city: nextAutofill.city && (overwrite || !cityCode) ? nextAutofill.city : current.city,
        area: nextAutofill.area && (overwrite || !localAreaCode) ? nextAutofill.area : current.area
      }));
    }

    form.addEventListener(locationAutofillEventName, handleAutofill as EventListener);
    return () => form.removeEventListener(locationAutofillEventName, handleAutofill as EventListener);
  }, [areaSearch, cityCode, countryCode, localAreaCode, pincode, stateCode]);

  useEffect(() => {
    if (!pendingAutofill?.state || stateCode || !states.length) {
      return;
    }

    const match = states.find((item) => sameName(item.name, pendingAutofill.state));
    if (match) {
      setStateCode(match.code);
    }
  }, [pendingAutofill?.state, stateCode, states]);

  useEffect(() => {
    if (!pendingAutofill?.city || cityCode || !cities.length) {
      return;
    }

    const match = cities.find((item) => sameName(item.name, pendingAutofill.city));
    if (!match) {
      return;
    }

    setCityCode(match.code);
    if (match.subdivision?.country?.code) {
      setCountryCode(match.subdivision.country.code);
    }
    if (match.subdivision?.code) {
      setStateCode(match.subdivision.code);
    }
  }, [cities, cityCode, pendingAutofill?.city]);

  useEffect(() => {
    if (!pendingAutofill?.area || localAreaCode || !areas.length) {
      return;
    }

    const match = areas.find((item) => sameName(item.name, pendingAutofill.area));
    if (match) {
      selectArea(match);
    }
  }, [areas, localAreaCode, pendingAutofill?.area]);

  return (
    <div ref={rootRef} className={cn("grid gap-4", className)}>
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
        disabled={disabled || locationCatalog.countriesQuery.isLoading}
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
        disabled={disabled || !countryCode || locationCatalog.statesQuery.isLoading}
        required={!hiddenValues.state}
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
        getLabel={(item) => loadCitiesAcrossCountry ? formatCityOptionLabel(item) : item.name}
        getValue={(item) => item.code}
        inputClassName={inputClass}
        labelClassName={labelClass}
        disabled={disabled || !canChooseCity || locationCatalog.citiesQuery.isLoading}
        required={!hiddenValues.city}
        onChange={(value) => {
          setCityCode(value);
          const selectedCity = cities.find((item) => item.code === value);
          const selectedSubdivision = selectedCity?.subdivision;
          const selectedCountry = selectedSubdivision?.country;
          if (selectedCountry?.code && selectedCountry.code !== countryCode) {
            setCountryCode(selectedCountry.code);
          }
          if (selectedSubdivision?.code && selectedSubdivision.code !== stateCode) {
            setStateCode(selectedSubdivision.code);
          }
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
        disabled={disabled || !countryCode}
        isLoading={areasStore.isLoading || areasStore.isFetching}
        placeholder="Search local area or pincode"
        onSearchChange={(value) => {
          setAreaSearch(value);
          setLocalAreaCode("");
          setSelectedArea(null);
        }}
        onSelect={(value) => {
          setLocalAreaCode(value);
          const selected = areas.find((item) => item.code === value);
          if (selected) {
            selectArea(selected);
          }
        }}
      />

      <div className={labelClass}>
        <label className="block">
          <span className="block text-sm font-bold text-[#1F2933]">{postalLabel}</span>
          <input
            name="pincode"
            value={pincode}
            onChange={(event) => {
              setPincode(event.target.value);
              setLocalAreaCode("");
              setSelectedArea(null);
              setAreaSearch("");
            }}
            disabled={disabled}
            className={inputClass}
            placeholder={postalLabel}
            required={countryCode !== "AE"}
          />
        </label>
        <PincodeAreaSuggestions
          pincode={postalCodeLookup}
          areas={pincodeAreaOptions}
          selectedCode={localAreaCode}
          isLoading={Boolean(postalCodeLookup && (areasStore.isLoading || areasStore.isFetching))}
          onSelect={selectArea}
        />
      </div>
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
  onChange,
  required = true,
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
  required?: boolean;
}) {
  return (
    <label className={labelClassName}>
      <span className="block text-sm font-bold text-[#1F2933]">{label}</span>
      <select name={name} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={inputClassName} required={required}>
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
  placeholder,
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
  placeholder?: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const selectedOption = options.find((item) => getValue(item) === value);
  const selectedOptionLabel = selectedOption ? getLabel(selectedOption) : "";
  const selectionIsDisplayed = Boolean(value && selectedOptionLabel && searchValue.trim() === selectedOptionLabel.trim());
  const showOptions = focused && !disabled && !selectionIsDisplayed && (isLoading || options.length > 0 || searchValue.trim().length > 0);

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
        placeholder={isLoading ? "Loading local areas..." : placeholder ?? `Search ${label.toLowerCase()}`}
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

function PincodeAreaSuggestions({
  pincode,
  areas,
  selectedCode,
  isLoading,
  onSelect
}: {
  pincode: string;
  areas: LocationAreaOption[];
  selectedCode: string;
  isLoading: boolean;
  onSelect: (area: LocationAreaOption) => void;
}) {
  if (!pincode) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
        {isLoading ? `Loading local areas for ${pincode}` : `Local areas for ${pincode}`}
      </p>
      {areas.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {areas.map((area) => (
            <button
              key={area.code}
              type="button"
              onClick={() => onSelect(area)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-xs font-black transition",
                selectedCode === area.code
                  ? "border-[#ED3500] bg-[#FFF0EC] text-[#ED3500]"
                  : "border-[#D8E2EA] bg-white text-[#1F2933] hover:border-[#ED3500]"
              )}
            >
              {area.name}
            </button>
          ))}
        </div>
      ) : !isLoading ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-[#667085]">
          No local areas are imported for this pincode yet.
        </p>
      ) : null}
    </div>
  );
}

function sameName(left: string, right: string | null | undefined) {
  return left.trim().toLowerCase() === right?.trim().toLowerCase();
}

function cleanAddressValue(value: string | null | undefined) {
  return value?.trim() || undefined;
}

function formatCityOptionLabel(city: { name: string; subdivision?: { name: string } | undefined }) {
  const stateName = city.subdivision?.name;
  return stateName ? `${city.name}, ${stateName}` : city.name;
}

function postalCodeLookupValue(countryCode: string, pincode: string) {
  const value = pincode.trim().toUpperCase();
  if (!value) {
    return "";
  }

  if (countryCode === "IN") {
    return /^[1-9][0-9]{5}$/.test(value) ? value : "";
  }

  return value.length >= 3 ? value : "";
}
