import { Location01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import { calculateLocationConfidenceScore } from "../features/storefront/checkout-validation";
import {
  listLocationAreas,
  listLocationCities,
  listLocationCountries,
  listLocationStates,
  type MobileCustomerAddress,
  type MobileCustomerAddressPayload,
} from "../features/storefront/storefront-api";
import type { LocationArea } from "../types/storefront";
import { colors } from "../theme";

type MobileAddressFormProps = {
  disabled?: boolean;
  showDefaultToggle?: boolean;
  value: MobileCustomerAddressPayload;
  onChange: (value: MobileCustomerAddressPayload) => void;
};

const areaSearchDebounceMs = 350;

export function emptyMobileAddressForm(overrides: Partial<MobileCustomerAddressPayload> = {}): MobileCustomerAddressPayload {
  return {
    label: "Home",
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    countryCode: "IN",
    isDefault: false,
    ...overrides,
  };
}

export function mobileAddressFormFromAddress(address: MobileCustomerAddress): MobileCustomerAddressPayload {
  const latitude = nullableNumber(address.latitude);
  const longitude = nullableNumber(address.longitude);
  const accuracyMeters = nullableNumber(address.accuracyMeters);
  const locationConfidenceScore = nullableNumber(address.locationConfidenceScore);

  return {
    label: address.label ?? "Home",
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    area: address.area ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country ?? "India",
    countryCode: address.countryCode ?? "IN",
    stateCode: address.stateCode ?? null,
    cityCode: address.cityCode ?? null,
    localAreaCode: address.localAreaCode ?? null,
    locationSource: address.locationSource ?? null,
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
    ...(locationConfidenceScore !== undefined ? { locationConfidenceScore } : {}),
    isDefault: address.isDefault,
  };
}

export function MobileAddressForm({ disabled = false, showDefaultToggle = true, value, onChange }: MobileAddressFormProps) {
  const [areaSearch, setAreaSearch] = useState(formatAreaSearchValue(value));
  const [debouncedAreaSearch, setDebouncedAreaSearch] = useState(areaSearch);
  const [gpsStatus, setGpsStatus] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const countryCode = normalizeCountryCode(value.countryCode);
  const pincode = value.pincode ?? "";
  const postalCodeLookup = postalSearchValue(countryCode, pincode);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAreaSearch(areaSearch), areaSearchDebounceMs);
    return () => clearTimeout(timer);
  }, [areaSearch]);

  useEffect(() => {
    const nextSearch = formatAreaSearchValue(value);
    const currentArea = areaSearchBase(areaSearch);
    const nextArea = value.area?.trim() ?? "";

    if (value.localAreaCode && areaSearch !== nextSearch) {
      setAreaSearch(nextSearch);
      return;
    }

    if (nextArea && currentArea !== nextArea) {
      setAreaSearch(nextArea);
      return;
    }

    if (!nextArea && areaSearch.trim()) {
      setAreaSearch("");
    }
  }, [areaSearch, value.area, value.localAreaCode, value.pincode]);

  const countriesQuery = useQuery({
    queryKey: ["mobile-location-countries"],
    queryFn: listLocationCountries,
  });
  const statesQuery = useQuery({
    queryKey: ["mobile-location-states", countryCode],
    queryFn: () => listLocationStates(countryCode),
    enabled: Boolean(countryCode),
  });
  const citiesQuery = useQuery({
    queryKey: ["mobile-location-cities", countryCode, value.stateCode ?? ""],
    queryFn: () => listLocationCities({ countryCode, ...(value.stateCode ? { stateCode: value.stateCode } : {}) }),
    enabled: Boolean(countryCode),
  });
  const areaSearchTerm = debouncedAreaSearch.trim();
  const shouldSearchAreas = Boolean(postalCodeLookup || areaSearchTerm.length >= 2);
  const areasQuery = useQuery({
    queryKey: [
      "mobile-location-areas",
      countryCode,
      value.stateCode ?? "",
      value.cityCode ?? "",
      postalCodeLookup,
      areaSearchTerm,
    ],
    queryFn: () =>
      listLocationAreas({
        countryCode,
        ...(!postalCodeLookup && value.stateCode ? { stateCode: value.stateCode } : {}),
        ...(!postalCodeLookup && value.cityCode ? { cityCode: value.cityCode } : {}),
        ...(postalCodeLookup ? { postalCode: postalCodeLookup } : {}),
        ...(!postalCodeLookup && areaSearchTerm ? { search: areaSearchTerm } : {}),
        limit: 24,
      }),
    enabled: !disabled && shouldSearchAreas,
  });

  const countries = countriesQuery.data ?? [];
  const states = statesQuery.data ?? [];
  const cities = citiesQuery.data ?? [];
  const areas = areasQuery.data ?? [];
  const selectedCountry = countries.find((country) => country.code === countryCode);
  const selectedState = states.find((state) => state.code === value.stateCode);
  const selectedCity = cities.find((city) => city.code === value.cityCode);
  const postalLabel = selectedCountry?.postalCodeLabel ?? (countryCode === "IN" ? "Pincode" : "Postal code");

  function update(patch: Partial<MobileCustomerAddressPayload>) {
    onChange({ ...value, ...patch });
  }

  function selectCountry(nextCountryCode: string) {
    const country = countries.find((item) => item.code === nextCountryCode);
    update({
      country: country?.name ?? nextCountryCode,
      countryCode: nextCountryCode,
      state: "",
      stateCode: null,
      city: "",
      cityCode: null,
      area: "",
      localAreaCode: null,
      pincode: "",
    });
  }

  function selectState(nextStateCode: string) {
    const state = states.find((item) => item.code === nextStateCode);
    update({
      state: state?.name ?? "",
      stateCode: nextStateCode,
      city: "",
      cityCode: null,
      area: "",
      localAreaCode: null,
      pincode: "",
    });
  }

  function selectCity(nextCityCode: string) {
    const city = cities.find((item) => item.code === nextCityCode);
    const subdivision = city?.subdivision;
    const country = subdivision?.country;
    update({
      country: country?.name ?? value.country ?? "India",
      countryCode: country?.code ?? value.countryCode ?? "IN",
      state: subdivision?.name ?? value.state,
      stateCode: subdivision?.code ?? value.stateCode ?? null,
      city: city?.name ?? "",
      cityCode: nextCityCode,
      area: "",
      localAreaCode: null,
      pincode: "",
    });
  }

  function selectArea(area: LocationArea) {
    const city = area.city;
    const subdivision = city.subdivision;
    const country = subdivision.country;
    const postalCode = area.postalCode?.trim() ?? "";
    update({
      country: country.name,
      countryCode: country.code,
      state: subdivision.name,
      stateCode: subdivision.code,
      city: city.name,
      cityCode: city.code,
      area: area.name,
      localAreaCode: area.code,
      ...(postalCode ? { pincode: postalCode } : {}),
    });
    setAreaSearch(formatLocationAreaLabel(area));
  }

  async function captureCurrentLocation() {
    setGpsStatus("");
    setGpsLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setGpsStatus("Location permission denied. You can still enter the address manually.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const accuracyMeters = typeof current.coords.accuracy === "number" ? current.coords.accuracy : null;
      update({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        locationSource: "GPS",
        accuracyMeters,
        locationConfidenceScore: calculateLocationConfidenceScore(accuracyMeters),
      });
      setGpsStatus(accuracyMeters ? `GPS captured within ${Math.round(accuracyMeters)} m.` : "GPS location captured.");
    } catch {
      setGpsStatus("Location could not be captured. Enter the address manually.");
    } finally {
      setGpsLoading(false);
    }
  }

  const areaStatus = useMemo(() => {
    if (!shouldSearchAreas) {
      return "Search by local area or enter a valid postal code.";
    }
    if (areasQuery.isFetching) {
      return "Searching local areas...";
    }
    if (areasQuery.isError) {
      return "Location search could not load. Manual city, state, and postal code still work.";
    }
    if (!areas.length) {
      return "No matching local areas. You can save this address manually.";
    }

    return "";
  }, [areas.length, areasQuery.isError, areasQuery.isFetching, shouldSearchAreas]);

  return (
    <View style={styles.form}>
      <Input disabled={disabled} label="Label" onChangeText={(text) => update({ label: text })} value={value.label ?? ""} />
      <Input disabled={disabled} label="Full name" onChangeText={(text) => update({ fullName: text })} value={value.fullName} />
      <Input
        disabled={disabled}
        keyboardType="phone-pad"
        label="Phone"
        onChangeText={(text) => update({ phone: text })}
        value={value.phone}
      />
      <Input
        disabled={disabled}
        label="Address line 1"
        onChangeText={(text) => update({ line1: text })}
        placeholder="House, building, street"
        value={value.line1}
      />
      <Input
        disabled={disabled}
        label="Address line 2"
        onChangeText={(text) => update({ line2: text })}
        placeholder="Apartment, floor, landmark"
        value={value.line2 ?? ""}
      />

      <Selector
        disabled={disabled || countriesQuery.isLoading}
        emptyText="Countries could not load. India is used by default."
        label="Country"
        onSelect={selectCountry}
        options={countries.map((country) => ({ label: country.name, value: country.code }))}
        selectedValue={countryCode}
      />
      <Selector
        disabled={disabled || statesQuery.isLoading}
        emptyText="Choose manually if states do not load."
        label={selectedState?.type ?? "State / province"}
        onSelect={selectState}
        options={states.map((state) => ({ label: state.name, value: state.code }))}
        selectedValue={value.stateCode ?? ""}
      />
      <Selector
        disabled={disabled || citiesQuery.isLoading}
        emptyText="Choose manually if cities do not load."
        label="City / district"
        onSelect={selectCity}
        options={cities.map((city) => ({
          label: city.subdivision?.name ? `${city.name}, ${city.subdivision.name}` : city.name,
          value: city.code,
        }))}
        selectedValue={value.cityCode ?? ""}
      />

      <View>
        <Text style={styles.label}>Local area</Text>
        <View style={styles.searchBox}>
          <HugeiconsIcon color={colors.muted} icon={Search01Icon} size={17} strokeWidth={2.1} />
          <TextInput
            editable={!disabled}
            onChangeText={(text) => {
              setAreaSearch(text);
              update({ area: text, localAreaCode: null });
            }}
            placeholder="Search locality or neighbourhood"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={areaSearch}
          />
        </View>
        {areaStatus ? (
          <Text style={[styles.helpText, areasQuery.isError ? styles.errorText : null]}>{areaStatus}</Text>
        ) : null}
        {areas.length ? (
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.optionScroller}>
            {areas.map((area) => (
              <Pressable
                disabled={disabled}
                key={area.code}
                onPress={() => selectArea(area)}
                style={[styles.optionPill, value.localAreaCode === area.code ? styles.optionPillActive : null]}
              >
                <Text style={[styles.optionPillText, value.localAreaCode === area.code ? styles.optionPillTextActive : null]}>
                  {formatLocationAreaLabel(area)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.twoColumnRow}>
        <Input
          compact
          disabled={disabled}
          label="City"
          onChangeText={(text) => update({ city: text, cityCode: null })}
          value={selectedCity?.name ?? value.city}
        />
        <Input
          compact
          disabled={disabled}
          label="State"
          onChangeText={(text) => update({ state: text, stateCode: null })}
          value={selectedState?.name ?? value.state}
        />
      </View>
      <Input
        disabled={disabled}
        keyboardType="number-pad"
        label={postalLabel}
        onChangeText={(text) => update({ pincode: text, localAreaCode: null })}
        value={value.pincode}
      />

      <Pressable disabled={disabled || gpsLoading} style={styles.locationButton} onPress={captureCurrentLocation}>
        {gpsLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={18} strokeWidth={2.2} />
        )}
        <Text style={styles.locationButtonText}>Use current location</Text>
      </Pressable>
      {gpsStatus ? <Text style={styles.helpText}>{gpsStatus}</Text> : null}
      {value.latitude !== undefined && value.latitude !== null && value.longitude !== undefined && value.longitude !== null ? (
        <Text style={styles.locationMeta}>
          Coordinates saved. Confidence {Math.round(Number(value.locationConfidenceScore ?? 0))}/100
        </Text>
      ) : null}

      {showDefaultToggle ? (
        <Pressable disabled={disabled} style={styles.checkboxRow} onPress={() => update({ isDefault: !value.isDefault })}>
          <View style={[styles.checkbox, value.isDefault ? styles.checkboxActive : null]} />
          <Text style={styles.checkboxText}>Set as default delivery address</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Input({
  compact,
  disabled,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={compact ? styles.compactInputWrap : null}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={!disabled}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.muted}
        style={[styles.input, disabled ? styles.inputDisabled : null]}
        value={value}
      />
    </View>
  );
}

function Selector({
  disabled,
  emptyText,
  label,
  onSelect,
  options,
  selectedValue,
}: {
  disabled?: boolean;
  emptyText: string;
  label: string;
  onSelect: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {options.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroller}>
          {options.map((option) => (
            <Pressable
              disabled={disabled}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={[styles.optionPill, selectedValue === option.value ? styles.optionPillActive : null]}
            >
              <Text style={[styles.optionPillText, selectedValue === option.value ? styles.optionPillTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.helpText}>{emptyText}</Text>
      )}
    </View>
  );
}

function normalizeCountryCode(value?: string | null) {
  return value?.trim().toUpperCase() || "IN";
}

function postalSearchValue(countryCode: string, value: string) {
  const cleanValue = value.trim();
  if (countryCode === "IN") {
    const digits = cleanValue.replace(/\D/g, "");
    return /^\d{6}$/.test(digits) ? digits : "";
  }

  return cleanValue.length >= 3 ? cleanValue : "";
}

function formatAreaSearchValue(value: MobileCustomerAddressPayload) {
  const area = value.area?.trim() ?? "";
  const pincode = value.pincode?.trim() ?? "";
  if (area && pincode) {
    return `${area} (${pincode})`;
  }

  return area;
}

function areaSearchBase(value: string) {
  return value.replace(/\s+\([^)]*\)\s*$/, "").trim();
}

function formatLocationAreaLabel(area: LocationArea) {
  const postalCode = area.postalCode?.trim();
  const city = area.city?.name?.trim();
  const state = area.city?.subdivision?.name?.trim();
  const primary = `${area.name}${postalCode ? ` (${postalCode})` : ""}`;
  return [primary, city, state].filter(Boolean).join(", ");
}

function nullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return value === null ? null : undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 46,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
  },
  compactInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionScroller: {
    marginTop: 2,
  },
  optionPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 230,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionPillActive: {
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
  },
  optionPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  optionPillTextActive: {
    color: colors.primary,
  },
  helpText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 7,
  },
  errorText: {
    color: colors.danger,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: "#FFD7CA",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  locationButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  locationMeta: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 2,
  },
  checkbox: {
    borderColor: colors.border,
    borderRadius: 7,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxText: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
});
