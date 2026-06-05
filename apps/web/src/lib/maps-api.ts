import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type LocationSource = "GPS" | "MAP_PICK" | "MANUAL" | "REVERSE_GEOCODE";

export type ReverseGeocodeAddress = {
  line1: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  countryCode: string | null;
};

export type ReverseGeocodeResponse = {
  configured: boolean;
  provider: "MAPBOX";
  latitude: number;
  longitude: number;
  address: ReverseGeocodeAddress | null;
  rawPlaceName: string | null;
  locationConfidenceScore: number | null;
};

const reverseGeocodeCache = new Map<
  string,
  {
    expiresAt: number;
    value?: ReverseGeocodeResponse;
    promise?: Promise<ReverseGeocodeResponse>;
  }
>();
const reverseGeocodeCacheMaxEntries = 200;
const configuredReverseGeocodeCacheTtlMs = 5 * 60 * 1000;
const unconfiguredReverseGeocodeCacheTtlMs = 30 * 1000;

export function reverseGeocode(
  auth: IndihubAuthHeaders,
  payload: { latitude: number; longitude: number },
) {
  const key = reverseGeocodeCacheKey(payload);
  const now = Date.now();
  const current = reverseGeocodeCache.get(key);

  if (current && current.expiresAt > now) {
    if (current.value) {
      return Promise.resolve(current.value);
    }

    if (current.promise) {
      return current.promise;
    }
  }

  const promise = indihubFetch<ReverseGeocodeResponse>(
    "/api/maps/reverse-geocode",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    auth,
  )
    .then((value) => {
      setReverseGeocodeCacheEntry(key, {
        expiresAt: Date.now() + (value.configured ? configuredReverseGeocodeCacheTtlMs : unconfiguredReverseGeocodeCacheTtlMs),
        value,
      });
      return value;
    })
    .catch((error) => {
      if (reverseGeocodeCache.get(key)?.promise === promise) {
        reverseGeocodeCache.delete(key);
      }
      throw error;
    });

  setReverseGeocodeCacheEntry(key, {
    expiresAt: now + configuredReverseGeocodeCacheTtlMs,
    promise,
  });
  return promise;
}

function reverseGeocodeCacheKey(payload: { latitude: number; longitude: number }) {
  return `${roundedCoordinate(payload.latitude)}:${roundedCoordinate(payload.longitude)}`;
}

function roundedCoordinate(value: number) {
  return Math.round(value * 100_000) / 100_000;
}

function setReverseGeocodeCacheEntry(
  key: string,
  entry: {
    expiresAt: number;
    value?: ReverseGeocodeResponse;
    promise?: Promise<ReverseGeocodeResponse>;
  },
) {
  if (reverseGeocodeCache.has(key)) {
    reverseGeocodeCache.delete(key);
  }

  reverseGeocodeCache.set(key, entry);

  while (reverseGeocodeCache.size > reverseGeocodeCacheMaxEntries) {
    const oldestKey = reverseGeocodeCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    reverseGeocodeCache.delete(oldestKey);
  }
}
