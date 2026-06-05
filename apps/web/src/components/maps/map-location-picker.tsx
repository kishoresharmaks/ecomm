"use client";

import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { AlertTriangle, Check, LocateFixed, Loader2, MapPinned, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, StatusBadge } from "@indihub/ui";
import type { IndihubAuthHeaders } from "@/lib/api";
import { mapPickerProviderConfig } from "@/lib/map-provider";
import { reverseGeocode, type LocationSource, type ReverseGeocodeAddress } from "@/lib/maps-api";
import type * as Leaflet from "leaflet";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type MapLocationValue = {
  latitude?: number | string | null | undefined;
  longitude?: number | string | null | undefined;
  locationSource?: LocationSource | string | null | undefined;
  accuracyMeters?: number | string | null | undefined;
  locationConfidenceScore?: number | string | null | undefined;
};

type PendingAddressSuggestion = {
  address: ReverseGeocodeAddress;
  rawPlaceName: string | null;
  locationConfidenceScore: number | null;
  conflicts: string[];
};

type MapLocationPickerProps = {
  label?: string;
  defaultValue?: MapLocationValue | undefined;
  authHeaders?: IndihubAuthHeaders | undefined;
  disabled?: boolean | undefined;
  radiusPreviewKm?: number | undefined;
  centerFallback?: Coordinates | undefined;
  inputClassName?: string | undefined;
};

type LocationAutofillEventDetail = {
  address: ReverseGeocodeAddress;
  overwrite?: boolean;
};

const defaultCenter: Coordinates = { latitude: 20.5937, longitude: 78.9629 };
const poorAccuracyThresholdMeters = 500;
const locationAutofillEventName = "indihub:location-autofill";
const defaultInputClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white";

export function MapLocationPicker({
  label = "Location coordinates",
  defaultValue,
  authHeaders,
  disabled = false,
  radiusPreviewKm,
  centerFallback,
  inputClassName
}: MapLocationPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markerRef = useRef<Leaflet.Marker | null>(null);
  const circleRef = useRef<Leaflet.Circle | null>(null);
  const currentPointRef = useRef<Coordinates | null>(null);
  const centerFallbackRef = useRef<Coordinates>(centerFallback ?? defaultCenter);
  const handleMapPickRef = useRef<(point: Coordinates) => void>(() => undefined);
  const [latitude, setLatitude] = useState(coordinateValue(defaultValue?.latitude));
  const [longitude, setLongitude] = useState(coordinateValue(defaultValue?.longitude));
  const [locationSource, setLocationSource] = useState(sourceValue(defaultValue?.locationSource));
  const [accuracyMeters, setAccuracyMeters] = useState(metricValue(defaultValue?.accuracyMeters));
  const [locationConfidenceScore, setLocationConfidenceScore] = useState(
    metricValue(defaultValue?.locationConfidenceScore)
  );
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingAddressSuggestion | null>(null);

  const inputClass = inputClassName ?? defaultInputClass;
  const currentPoint = useMemo(() => parseCoordinates(latitude, longitude), [latitude, longitude]);
  const providerConfig = useMemo(() => mapPickerProviderConfig(), []);
  const accuracyNumber = parseOptionalNumber(accuracyMeters);
  const poorAccuracy = typeof accuracyNumber === "number" && accuracyNumber > poorAccuracyThresholdMeters;

  useEffect(() => {
    setLatitude(coordinateValue(defaultValue?.latitude));
    setLongitude(coordinateValue(defaultValue?.longitude));
    setLocationSource(sourceValue(defaultValue?.locationSource));
    setAccuracyMeters(metricValue(defaultValue?.accuracyMeters));
    setLocationConfidenceScore(metricValue(defaultValue?.locationConfidenceScore));
    setPendingSuggestion(null);
  }, [
    defaultValue?.accuracyMeters,
    defaultValue?.latitude,
    defaultValue?.locationConfidenceScore,
    defaultValue?.locationSource,
    defaultValue?.longitude
  ]);

  useEffect(() => {
    currentPointRef.current = currentPoint;
  }, [currentPoint]);

  useEffect(() => {
    centerFallbackRef.current = centerFallback ?? defaultCenter;
  }, [centerFallback]);

  const dispatchLocationAutofill = useCallback((address: ReverseGeocodeAddress, overwrite: boolean) => {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }

    form.dispatchEvent(
      new CustomEvent<LocationAutofillEventDetail>(locationAutofillEventName, {
        detail: { address, overwrite }
      })
    );
  }, []);

  const applyAddressSuggestion = useCallback(
    (address: ReverseGeocodeAddress, overwrite: boolean) => {
      const form = rootRef.current?.closest("form") as HTMLFormElement | null;
      if (!form) {
        return { conflicts: [] as string[], filled: 0 };
      }

      const conflicts = addressConflicts(form, address);
      const filled = applyDirectAddressFields(form, address, overwrite);
      dispatchLocationAutofill(address, overwrite);
      return { conflicts, filled };
    },
    [dispatchLocationAutofill]
  );

  const runReverseGeocode = useCallback(
    async (point: Coordinates) => {
      if (!hasReverseGeocodeAuth(authHeaders)) {
        return;
      }

      setReverseBusy(true);
      setError(null);
      try {
        const response = await reverseGeocode(authHeaders, point);
        if (!response.configured) {
          setNotice("Coordinates saved. Address autofill is off until a Mapbox token is configured.");
          return;
        }

        if (typeof response.locationConfidenceScore === "number") {
          setLocationConfidenceScore(metricValue(response.locationConfidenceScore));
        }

        if (!response.address) {
          setNotice("Coordinates saved. Mapbox did not return a usable address suggestion.");
          return;
        }

        const { conflicts, filled } = applyAddressSuggestion(response.address, false);

        if (conflicts.length > 0) {
          setPendingSuggestion({
            address: response.address,
            rawPlaceName: response.rawPlaceName,
            locationConfidenceScore: response.locationConfidenceScore,
            conflicts
          });
          setNotice("Address suggestion found. Empty fields were filled; review before overwriting existing fields.");
        } else {
          setPendingSuggestion(null);
          setNotice(
            filled > 0
              ? "Address suggestion applied to empty fields."
              : "Address suggestion checked; no empty fields needed updating."
          );
        }
      } catch (reverseError) {
        setError(reverseError instanceof Error ? reverseError.message : "Reverse geocode failed.");
      } finally {
        setReverseBusy(false);
      }
    },
    [applyAddressSuggestion, authHeaders]
  );

  const setCoordinateSelection = useCallback(
    (
      point: Coordinates,
      source: LocationSource,
      options: {
        accuracy?: number | null | undefined;
        confidence?: number | null | undefined;
        reverse?: boolean | undefined;
      } = {}
    ) => {
      setLatitude(coordinateValue(point.latitude));
      setLongitude(coordinateValue(point.longitude));
      setLocationSource(source);
      setAccuracyMeters(options.accuracy === undefined || options.accuracy === null ? "" : metricValue(options.accuracy));
      if (options.confidence !== undefined && options.confidence !== null) {
        setLocationConfidenceScore(metricValue(options.confidence));
      }
      setPendingSuggestion(null);
      setNotice(source === "GPS" ? "Current location captured." : "Map pin location selected.");
      setError(null);

      if (options.reverse) {
        void runReverseGeocode(point);
      }
    },
    [runReverseGeocode]
  );

  const handleMapPick = useCallback(
    (point: Coordinates) => {
      setCoordinateSelection(point, "MAP_PICK", { confidence: 80, reverse: true });
    },
    [setCoordinateSelection]
  );

  useEffect(() => {
    handleMapPickRef.current = handleMapPick;
  }, [handleMapPick]);

  const updateMapOverlays = useCallback(
    (point: Coordinates | null) => {
      const leaflet = leafletRef.current;
      const map = mapRef.current;
      if (!leaflet || !map) {
        return;
      }

      if (!point) {
        markerRef.current?.remove();
        circleRef.current?.remove();
        markerRef.current = null;
        circleRef.current = null;
        return;
      }

      const latLng: Leaflet.LatLngExpression = [point.latitude, point.longitude];
      if (!markerRef.current) {
        const marker = leaflet.marker(latLng, {
          draggable: !disabled,
          icon: leaflet.divIcon({
            className: "",
            html: '<span class="indihub-map-marker" aria-hidden="true"></span>',
            iconSize: [34, 44],
            iconAnchor: [17, 42]
          })
        });
        marker.on("dragend", () => {
          const next = marker.getLatLng();
          handleMapPickRef.current({ latitude: next.lat, longitude: next.lng });
        });
        marker.addTo(map);
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(latLng);
      }

      if (radiusPreviewKm && radiusPreviewKm > 0) {
        if (!circleRef.current) {
          circleRef.current = leaflet.circle(latLng, {
            radius: radiusPreviewKm * 1000,
            color: "#ED3500",
            weight: 2,
            opacity: 0.8,
            fillColor: "#ED3500",
            fillOpacity: 0.08
          });
          circleRef.current.addTo(map);
        } else {
          circleRef.current.setLatLng(latLng);
          circleRef.current.setRadius(radiusPreviewKm * 1000);
        }
      } else {
        circleRef.current?.remove();
        circleRef.current = null;
      }
    },
    [disabled, radiusPreviewKm]
  );

  useEffect(() => {
    if (!mapOpen) {
      return;
    }

    let cancelled = false;
    setMapLoading(true);
    setMapError(null);

    void import("leaflet")
      .then((leaflet) => {
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        leafletRef.current = leaflet;
        const map = leaflet.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true
        });
        const center = currentPointRef.current ?? centerFallbackRef.current;
        map.setView([center.latitude, center.longitude], currentPointRef.current ? 15 : 5);
        const tileOptions: Leaflet.TileLayerOptions = {
          attribution: providerConfig.attribution,
          maxZoom: 19
        };
        if (providerConfig.tileSize !== undefined) {
          tileOptions.tileSize = providerConfig.tileSize;
        }
        if (providerConfig.zoomOffset !== undefined) {
          tileOptions.zoomOffset = providerConfig.zoomOffset;
        }
        leaflet.tileLayer(providerConfig.tileUrl, tileOptions).addTo(map);
        map.on("click", (event) =>
          handleMapPickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
        );
        mapRef.current = map;
        setMapVersion((current) => current + 1);
        window.setTimeout(() => map.invalidateSize(), 80);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError("Map could not be loaded. You can still enter latitude and longitude manually.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMapLoading(false);
        }
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      leafletRef.current = null;
    };
  }, [mapOpen, providerConfig.attribution, providerConfig.tileSize, providerConfig.tileUrl, providerConfig.zoomOffset]);

  useEffect(() => {
    if (!mapOpen) {
      return;
    }

    updateMapOverlays(currentPoint);
    if (currentPoint && mapRef.current) {
      mapRef.current.panTo([currentPoint.latitude, currentPoint.longitude]);
    }
  }, [currentPoint, mapOpen, mapVersion, updateMapOverlays]);

  function onManualCoordinateChange(kind: "latitude" | "longitude", value: string) {
    if (kind === "latitude") {
      setLatitude(value);
    } else {
      setLongitude(value);
    }

    const nextPoint = parseCoordinates(kind === "latitude" ? value : latitude, kind === "longitude" ? value : longitude);
    setPendingSuggestion(null);
    if (nextPoint) {
      setLocationSource("MANUAL");
      setAccuracyMeters("");
      setLocationConfidenceScore((current) => current || "50");
      setNotice("Manual coordinates entered.");
      setError(null);
    } else {
      setLocationSource("");
      setAccuracyMeters("");
      setLocationConfidenceScore("");
      if (latitude.trim() || longitude.trim() || value.trim()) {
        setNotice("Enter both latitude and longitude to save coordinates.");
      }
    }
  }

  function useCurrentLocation() {
    if (disabled || gpsBusy) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Current location is not available in this browser. Enter coordinates manually or pick on the map.");
      return;
    }

    setGpsBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
        setCoordinateSelection(point, "GPS", {
          accuracy,
          confidence: gpsConfidenceScore(accuracy),
          reverse: true
        });
        if (accuracy && accuracy > poorAccuracyThresholdMeters) {
          setNotice(`GPS captured with poor accuracy (${Math.round(accuracy)} m). Confirm the pin before saving.`);
        }
        setGpsBusy(false);
      },
      (positionError) => {
        setError(geolocationErrorMessage(positionError));
        setGpsBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  function clearLocation() {
    setLatitude("");
    setLongitude("");
    setLocationSource("");
    setAccuracyMeters("");
    setLocationConfidenceScore("");
    setPendingSuggestion(null);
    setNotice("Location cleared. Manual address details remain unchanged.");
    setError(null);
  }

  function applyPendingSuggestion(overwrite: boolean) {
    if (!pendingSuggestion) {
      return;
    }

    if (!overwrite) {
      setPendingSuggestion(null);
      setNotice("Suggested address dismissed.");
      return;
    }

    applyAddressSuggestion(pendingSuggestion.address, overwrite);
    setPendingSuggestion(null);
    if (typeof pendingSuggestion.locationConfidenceScore === "number") {
      setLocationConfidenceScore(metricValue(pendingSuggestion.locationConfidenceScore));
    }
    setNotice("Suggested address applied.");
  }

  return (
    <div ref={rootRef} className="grid gap-3 rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-3">
      <input type="hidden" name="locationSource" value={locationSource} />
      <input type="hidden" name="accuracyMeters" value={accuracyMeters} />
      <input type="hidden" name="locationConfidenceScore" value={locationConfidenceScore} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#1F2933]">{label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
            Coordinates are saved first. Address autofill runs only when Mapbox is configured.
          </p>
        </div>
        <StatusBadge tone="info">{providerConfig.provider === "MAPBOX" ? "Mapbox tiles" : "OSM tiles"}</StatusBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm font-bold text-[#1F2933]">Latitude</span>
          <input
            name="latitude"
            type="number"
            step="0.0000001"
            value={latitude}
            disabled={disabled}
            onChange={(event) => onManualCoordinateChange("latitude", event.target.value)}
            className={inputClass}
            placeholder="11.6643000"
          />
        </label>
        <label className="space-y-2">
          <span className="block text-sm font-bold text-[#1F2933]">Longitude</span>
          <input
            name="longitude"
            type="number"
            step="0.0000001"
            value={longitude}
            disabled={disabled}
            onChange={(event) => onManualCoordinateChange("longitude", event.target.value)}
            className={inputClass}
            placeholder="78.1460000"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setMapOpen(true)}>
          <MapPinned className="h-4 w-4" aria-hidden="true" />
          Pick location on map
        </Button>
        <Button type="button" variant="outline" disabled={disabled || gpsBusy} onClick={useCurrentLocation}>
          {gpsBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
          Use current location
        </Button>
        <Button type="button" variant="outline" disabled={disabled || (!latitude && !longitude)} onClick={clearLocation}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear location
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {locationSource ? <StatusBadge tone="neutral">Source: {humanizeSource(locationSource)}</StatusBadge> : null}
        {accuracyMeters ? <StatusBadge tone={poorAccuracy ? "warning" : "success"}>Accuracy: {accuracyMeters} m</StatusBadge> : null}
        {locationConfidenceScore ? <StatusBadge tone="info">Confidence: {locationConfidenceScore}%</StatusBadge> : null}
        {reverseBusy ? (
          <StatusBadge tone="info">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
            Checking address
          </StatusBadge>
        ) : null}
      </div>

      {poorAccuracy ? (
        <div className="flex items-start gap-2 rounded-md border border-[#FFC7B8] bg-[#FFF0EC] px-3 py-2 text-xs font-bold leading-5 text-[#9A3A00]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          GPS accuracy is above {poorAccuracyThresholdMeters} m. Move the pin or confirm manually before saving.
        </div>
      ) : null}
      {notice ? <p className="text-xs font-semibold leading-5 text-[#667085]">{notice}</p> : null}
      {error ? <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-xs font-bold text-[#B42318]">{error}</p> : null}

      {pendingSuggestion ? (
        <div className="rounded-md border border-[#C5D8E8] bg-white p-3">
          <p className="text-sm font-black text-[#1F2933]">Suggested address available</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">
            {pendingSuggestion.rawPlaceName ?? formatSuggestedAddress(pendingSuggestion.address)}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#8A5A00]">
            Existing fields differ: {pendingSuggestion.conflicts.join(", ")}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => applyPendingSuggestion(true)}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Apply suggested address
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => applyPendingSuggestion(false)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} className="relative z-50">
        <DialogBackdrop transition className="fixed inset-0 bg-[#101828]/45 transition duration-200 data-closed:opacity-0" />
        <div className="fixed inset-0 w-screen overflow-y-auto px-3 py-4 sm:px-6">
          <div className="flex min-h-full items-center justify-center">
            <DialogPanel
              transition
              className="w-full max-w-4xl overflow-hidden rounded-lg border border-[#D8E2EA] bg-white shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
            >
              <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="text-lg font-black text-[#1F2933]">Pick location on map</DialogTitle>
                  <Description className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                    Click on the map or drag the pin. Seller forms show the current service-radius preview.
                  </Description>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setMapOpen(false)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Close
                </Button>
              </div>

              <div className="relative h-[62vh] min-h-[360px] bg-[#EAF1F7]">
                <div ref={mapContainerRef} className="h-full w-full" />
                {mapLoading ? (
                  <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-[#163B5C]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading map
                    </span>
                  </div>
                ) : null}
                {mapError ? (
                  <div className="absolute inset-x-4 top-4 rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#B42318]">
                    {mapError}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 border-t border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-[#667085]">
                  {currentPoint ? (
                    <span>
                      {coordinateValue(currentPoint.latitude)}, {coordinateValue(currentPoint.longitude)}
                      {radiusPreviewKm ? ` / Radius preview ${radiusPreviewKm} km` : ""}
                    </span>
                  ) : (
                    <span>No pin selected yet.</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={disabled || gpsBusy} onClick={useCurrentLocation}>
                    {gpsBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
                    Use current location
                  </Button>
                  <Button type="button" onClick={() => setMapOpen(false)}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Done
                  </Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function hasReverseGeocodeAuth(authHeaders: IndihubAuthHeaders | undefined): authHeaders is IndihubAuthHeaders {
  return Boolean(
    authHeaders?.platformUserId ||
      authHeaders?.bearerToken ||
      authHeaders?.clerkUserId ||
      authHeaders?.getBearerToken
  );
}

function coordinateValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return String(Math.round(parsed * 10_000_000) / 10_000_000);
}

function metricValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return String(Math.round(parsed * 100) / 100);
}

function sourceValue(value: string | null | undefined) {
  return value && isLocationSource(value) ? value : "";
}

function isLocationSource(value: string): value is LocationSource {
  return ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"].includes(value);
}

function parseCoordinates(latitude: string, longitude: string): Coordinates | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function gpsConfidenceScore(accuracy: number | null) {
  if (accuracy === null) {
    return 60;
  }

  if (accuracy <= 50) {
    return 100;
  }

  if (accuracy <= 100) {
    return 90;
  }

  if (accuracy <= poorAccuracyThresholdMeters) {
    return 70;
  }

  if (accuracy <= 1000) {
    return 40;
  }

  return 20;
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Pick on the map or enter coordinates manually.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Current location is unavailable on this device. Pick on the map or enter coordinates manually.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location request timed out. Try again or enter coordinates manually.";
  }

  return "Unable to read current location. Pick on the map or enter coordinates manually.";
}

function addressConflicts(form: HTMLFormElement, address: ReverseGeocodeAddress) {
  const formData = new FormData(form);
  const conflicts: string[] = [];

  addressFieldEntries(address).forEach(([name, value]) => {
    const existing = String(formData.get(name) ?? "").trim();
    if (existing && normalized(existing) !== normalized(value)) {
      conflicts.push(fieldLabel(name));
    }
  });

  return conflicts;
}

function applyDirectAddressFields(form: HTMLFormElement, address: ReverseGeocodeAddress, overwrite: boolean) {
  let filled = 0;
  const line1 = address.line1?.trim();
  if (line1 && setFormControlValue(form, "line1", line1, overwrite)) {
    filled += 1;
  }

  return filled;
}

function setFormControlValue(form: HTMLFormElement, name: string, value: string, overwrite: boolean) {
  const control = form.elements.namedItem(name);
  if (!isTextFormControl(control)) {
    return false;
  }

  if (!overwrite && control.value.trim()) {
    return false;
  }

  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function isTextFormControl(control: Element | RadioNodeList | null): control is HTMLInputElement | HTMLTextAreaElement {
  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement;
}

function addressFieldEntries(address: ReverseGeocodeAddress) {
  return ([
    ["line1", address.line1],
    ["area", address.area],
    ["city", address.city],
    ["state", address.state],
    ["pincode", address.pincode],
    ["country", address.country],
    ["countryCode", address.countryCode]
  ] as const).flatMap(([name, value]) => (value?.trim() ? [[name, value.trim()] as const] : []));
}

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function fieldLabel(name: string) {
  const labels: Record<string, string> = {
    line1: "address line 1",
    area: "local area",
    city: "city",
    state: "state",
    pincode: "pincode",
    country: "country",
    countryCode: "country"
  };

  return labels[name] ?? name;
}

function humanizeSource(source: string) {
  return source.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSuggestedAddress(address: ReverseGeocodeAddress) {
  return [address.line1, address.area, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(", ");
}
