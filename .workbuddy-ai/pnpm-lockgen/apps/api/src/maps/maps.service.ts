import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { readMapRoutingSettings } from "../settings/map-routing-settings";

type MapboxFeature = {
  id?: string;
  place_type?: string[];
  place_name?: string;
  text?: string;
  relevance?: number;
  properties?: {
    accuracy?: string;
  };
  context?: Array<{
    id?: string;
    text?: string;
    short_code?: string;
  }>;
};

type ReverseGeocodeAddress = {
  line1: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  countryCode: string | null;
};

type ReverseGeocodeLookup = {
  configured: boolean;
  provider: "MAPBOX";
  address: ReverseGeocodeAddress | null;
  rawPlaceName: string | null;
  locationConfidenceScore: number | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const mapboxTokenCacheTtlMs = 60 * 1000;
const reverseGeocodeCacheMaxEntries = 1000;
const configuredReverseGeocodeCacheTtlMs = 60 * 60 * 1000;
const unconfiguredReverseGeocodeCacheTtlMs = 30 * 1000;

@Injectable()
export class MapsService {
  private mapboxTokenCache: { expiresAt: number; token: string } | null = null;
  private readonly reverseGeocodeCache = new Map<string, CacheEntry<ReverseGeocodeLookup>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reverseGeocode(input: { latitude: number; longitude: number }) {
    const token = await this.mapboxToken();
    const lookup = await this.cachedReverseGeocodeLookup(
      `reverse:${token ? "configured" : "unconfigured"}:${this.roundCoordinate(input.latitude)}:${this.roundCoordinate(input.longitude)}`,
      token ? configuredReverseGeocodeCacheTtlMs : unconfiguredReverseGeocodeCacheTtlMs,
      () => this.reverseGeocodeLookup(input, token)
    );

    return {
      ...lookup,
      latitude: input.latitude,
      longitude: input.longitude
    };
  }

  private async reverseGeocodeLookup(
    input: { latitude: number; longitude: number },
    token: string
  ): Promise<ReverseGeocodeLookup> {
    if (!token) {
      return {
        configured: false,
        provider: "MAPBOX",
        address: null,
        rawPlaceName: null,
        locationConfidenceScore: null
      };
    }

    const feature = await this.fetchMapboxReverseGeocode(input, token);
    if (!feature) {
      return {
        configured: true,
        provider: "MAPBOX",
        address: null,
        rawPlaceName: null,
        locationConfidenceScore: null
      };
    }

    return {
      configured: true,
      provider: "MAPBOX",
      address: this.addressFromFeature(feature),
      rawPlaceName: feature.place_name ?? null,
      locationConfidenceScore: this.confidenceScore(feature)
    };
  }

  private async mapboxToken() {
    const now = Date.now();
    if (this.mapboxTokenCache && this.mapboxTokenCache.expiresAt > now) {
      return this.mapboxTokenCache.token;
    }

    const settings = await readMapRoutingSettings(this.prisma.client);
    const token =
      settings.mapboxAccessToken ||
      process.env.MAPBOX_TOKEN?.trim() ||
      process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
      "";
    this.mapboxTokenCache = {
      expiresAt: now + mapboxTokenCacheTtlMs,
      token
    };
    return token;
  }

  private async fetchMapboxReverseGeocode(
    input: { latitude: number; longitude: number },
    token: string,
  ) {
    try {
      const coordinates = `${input.longitude},${input.latitude}`;
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates}.json`,
      );
      url.searchParams.set("access_token", token);
      url.searchParams.set("limit", "1");
      url.searchParams.set(
        "types",
        "address,poi,neighborhood,locality,place,postcode,region,country",
      );
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { features?: MapboxFeature[] };
      return payload.features?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private addressFromFeature(feature: MapboxFeature): ReverseGeocodeAddress {
    const context = feature.context ?? [];
    const postcode = this.contextText(context, "postcode");
    const featureText = feature.text?.trim() || null;
    const featureType = this.featureType(feature);
    const city =
      this.contextText(context, "place") ??
      this.contextText(context, "locality") ??
      this.contextText(context, "district") ??
      (featureType === "place" || featureType === "locality" || featureType === "district"
        ? featureText
        : null);
    const area =
      this.contextText(context, "neighborhood") ??
      this.contextText(context, "locality") ??
      (featureType === "neighborhood" || featureType === "poi" ? featureText : null);
    const state = this.contextText(context, "region");
    const country = this.contextText(context, "country");
    const countryCode = this.contextShortCode(context, "country")?.toUpperCase() ?? null;

    return {
      line1: featureText,
      area,
      city,
      state,
      pincode: postcode,
      country,
      countryCode,
    };
  }

  private contextText(context: NonNullable<MapboxFeature["context"]>, prefix: string) {
    return context.find((entry) => entry.id?.startsWith(`${prefix}.`))?.text?.trim() || null;
  }

  private contextShortCode(context: NonNullable<MapboxFeature["context"]>, prefix: string) {
    return context.find((entry) => entry.id?.startsWith(`${prefix}.`))?.short_code?.trim() || null;
  }

  private featureType(feature: MapboxFeature) {
    return (
      feature.place_type?.[0] ??
      feature.id?.split(".")[0] ??
      ""
    );
  }

  private confidenceScore(feature: MapboxFeature) {
    if (typeof feature.relevance === "number" && Number.isFinite(feature.relevance)) {
      return Math.round(Math.max(0, Math.min(1, feature.relevance)) * 100);
    }

    return null;
  }

  private async cachedReverseGeocodeLookup(
    key: string,
    ttlMs: number,
    loader: () => Promise<ReverseGeocodeLookup>
  ) {
    const now = Date.now();
    const current = this.reverseGeocodeCache.get(key);

    if (current && current.expiresAt > now) {
      if (current.value) {
        return current.value;
      }

      if (current.promise) {
        return current.promise;
      }
    }

    const promise = loader()
      .then((value) => {
        this.setReverseGeocodeCacheEntry(key, { expiresAt: Date.now() + ttlMs, value });
        return value;
      })
      .catch((error) => {
        if (this.reverseGeocodeCache.get(key)?.promise === promise) {
          this.reverseGeocodeCache.delete(key);
        }
        throw error;
      });

    this.setReverseGeocodeCacheEntry(key, { expiresAt: now + ttlMs, promise });
    return promise;
  }

  private setReverseGeocodeCacheEntry(key: string, entry: CacheEntry<ReverseGeocodeLookup>) {
    if (this.reverseGeocodeCache.has(key)) {
      this.reverseGeocodeCache.delete(key);
    }

    this.reverseGeocodeCache.set(key, entry);

    while (this.reverseGeocodeCache.size > reverseGeocodeCacheMaxEntries) {
      const oldestKey = this.reverseGeocodeCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.reverseGeocodeCache.delete(oldestKey);
    }
  }

  private roundCoordinate(value: number) {
    return Math.round(value * 100_000) / 100_000;
  }
}
