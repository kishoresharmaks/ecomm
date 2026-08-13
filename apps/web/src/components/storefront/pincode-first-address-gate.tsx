"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useLocationAreaStore } from "@/components/locations/location-store";
import { type AddressLocationValue } from "@/components/locations/location-fields";
import { type LocationArea } from "@/lib/location-api";

type PincodeFirstAddressGateProps = {
  /** Called once the user confirms the pincode + picks an area (or skips). */
  onConfirm: (location: AddressLocationValue & { pincode: string }) => void;
  /** Input className consistent with rest of the storefront form */
  inputClassName: string;
};

/**
 * A compact "enter your pincode first" step shown before the full address form.
 * - Validates the pincode format for India (6-digit).
 * - Looks up matching local areas from the area store.
 * - Shows a chip list of areas to choose from.
 * - On chip selection → fires onConfirm with pre-filled location values.
 * - "Enter address manually" skips straight to the full form with the typed pincode.
 */
export function PincodeFirstAddressGate({
  onConfirm,
  inputClassName,
}: PincodeFirstAddressGateProps) {
  const [pincode, setPincode] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidPincode = /^[1-9][0-9]{5}$/.test(pincode.trim());
  const lookupPincode = isValidPincode ? pincode.trim() : "";

  const areasStore = useLocationAreaStore({
    countryCode: "IN",
    postalCode: lookupPincode,
    limit: 30,
    enabled: Boolean(lookupPincode),
  });

  const areas = areasStore.areas;
  const isLoading = areasStore.isLoading || areasStore.isFetching;
  const hasAreas = areas.length > 0;

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function buildLocation(area: LocationArea): AddressLocationValue & { pincode: string } {
    return {
      pincode: area.postalCode ?? pincode.trim(),
      country: area.city?.subdivision?.country?.name ?? "India",
      countryCode: area.city?.subdivision?.country?.code ?? "IN",
      state: area.city?.subdivision?.name ?? "",
      stateCode: area.city?.subdivision?.code ?? "",
      city: area.city?.name ?? "",
      cityCode: area.city?.code ?? "",
      area: area.name,
      localAreaCode: area.code,
    };
  }

  function skipToManual() {
    onConfirm({
      pincode: pincode.trim(),
      countryCode: "IN",
      country: "India",
      state: "",
      stateCode: "",
      city: "",
      cityCode: "",
      area: "",
      localAreaCode: "",
    });
  }

  const pincodeError =
    touched && pincode.trim().length > 0 && !isValidPincode
      ? "Enter a valid 6-digit Indian pincode."
      : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0EC] text-[#ED3500]">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-black text-[#1F2933]">Enter your delivery pincode</p>
          <p className="text-xs font-semibold leading-5 text-[#667085]">
            {"We'll auto-fill your city, state, and local area instantly."}
          </p>
        </div>
      </div>

      {/* Pincode input */}
      <label className="space-y-2 block">
        <span className="block text-sm font-bold text-[#1F2933]">Pincode</span>
        <div className="flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 600001"
            value={pincode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPincode(val);
            }}
            onBlur={() => setTouched(true)}
            className={inputClassName}
          />
          {isLoading && lookupPincode ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#ED3500]" />
          ) : null}
        </div>
        {pincodeError ? (
          <p className="text-xs font-semibold text-[#9F2600]">{pincodeError}</p>
        ) : null}
      </label>

      {/* Area chips after lookup */}
      {lookupPincode && !isLoading && hasAreas ? (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Select your local area — {pincode}
          </p>
          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <button
                key={area.code}
                type="button"
                onClick={() => onConfirm(buildLocation(area))}
                className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-left text-xs font-black text-[#1F2933] transition hover:border-[#ED3500] hover:bg-[#FFF0EC] hover:text-[#ED3500]"
              >
                {area.name}
                {area.city?.name ? (
                  <span className="ml-1 font-semibold text-[#667085]">— {area.city.name}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* No areas found */}
      {lookupPincode && !isLoading && !hasAreas && !areasStore.error ? (
        <p className="text-xs font-semibold leading-5 text-[#667085]">
          No local areas found for this pincode. You can still enter your address manually below.
        </p>
      ) : null}

      {/* Area store error */}
      {areasStore.error ? (
        <p className="text-xs font-semibold text-[#9F2600]">
          {"Could not load areas for this pincode. "}
          <button
            type="button"
            onClick={() => void areasStore.refetch()}
            className="underline"
          >
            Retry
          </button>
        </p>
      ) : null}

      {/* Skip / manual entry */}
      <button
        type="button"
        onClick={skipToManual}
        className="text-xs font-black text-[#163B5C] underline underline-offset-2 transition-colors hover:text-[#ED3500]"
      >
        Enter address manually without pincode lookup
      </button>
    </div>
  );
}
