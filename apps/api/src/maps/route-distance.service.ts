import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  MapRoutingSettings,
  readMapRoutingSettings,
} from "../settings/map-routing-settings";

export type RouteDistancePoint = {
  latitude?: Prisma.Decimal | number | string | null | undefined;
  longitude?: Prisma.Decimal | number | string | null | undefined;
  label?: string | null;
};

export type RouteDistanceResult = {
  provider: "GOOGLE_ROUTES" | "MAPBOX_DIRECTIONS" | "HAVERSINE" | "NONE";
  accuracy: "ROAD_ROUTE" | "STRAIGHT_LINE" | "UNAVAILABLE";
  distanceMeters: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  fallbackUsed: boolean;
  failureReason: string | null;
  origin: { latitude: number | null; longitude: number | null; label: string | null };
  destination: { latitude: number | null; longitude: number | null; label: string | null };
  resolvedAt: string;
};

type SettingReader = {
  setting: {
    findMany(args: Prisma.SettingFindManyArgs): Promise<Array<{ key: string; value: Prisma.JsonValue }>>;
  };
};

@Injectable()
export class RouteDistanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async calculate(input: {
    origin: RouteDistancePoint | null | undefined;
    destination: RouteDistancePoint | null | undefined;
    client?: SettingReader;
  }): Promise<RouteDistanceResult> {
    const settings = await readMapRoutingSettings(input.client ?? this.prisma.client);
    const origin = this.normalizedPoint(input.origin);
    const destination = this.normalizedPoint(input.destination);

    if (!this.hasCoordinates(origin) || !this.hasCoordinates(destination)) {
      return this.unavailable(origin, destination, "Missing origin or destination coordinates.");
    }

    if (settings.enabled && settings.provider === "GOOGLE_ROUTES" && settings.googleApiToken) {
      const result = await this.googleRoutes(settings, origin, destination);
      if (result || !settings.fallbackToHaversine) {
        return result ?? this.unavailable(origin, destination, "Google Routes distance failed.");
      }
    }

    if (
      settings.enabled &&
      settings.provider === "MAPBOX_DIRECTIONS" &&
      settings.mapboxAccessToken
    ) {
      const result = await this.mapboxDirections(settings, origin, destination);
      if (result || !settings.fallbackToHaversine) {
        return result ?? this.unavailable(origin, destination, "Mapbox Directions distance failed.");
      }
    }

    if (settings.fallbackToHaversine || settings.provider === "HAVERSINE" || !settings.enabled) {
      const distanceKm = this.haversineKm(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      );
      return {
        provider: "HAVERSINE",
        accuracy: "STRAIGHT_LINE",
        distanceMeters: Math.round(distanceKm * 1000),
        distanceKm,
        durationSeconds: null,
        fallbackUsed: settings.provider !== "HAVERSINE",
        failureReason: null,
        origin,
        destination,
        resolvedAt: new Date().toISOString(),
      };
    }

    return this.unavailable(origin, destination, "Map routing is disabled and fallback is off.");
  }

  private async googleRoutes(
    settings: MapRoutingSettings,
    origin: RouteDistanceResult["origin"] & { latitude: number; longitude: number },
    destination: RouteDistanceResult["destination"] & { latitude: number; longitude: number },
  ) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": settings.googleApiToken,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: origin.latitude, longitude: origin.longitude },
            },
          },
          destination: {
            location: {
              latLng: { latitude: destination.latitude, longitude: destination.longitude },
            },
          },
          travelMode: settings.googleTravelMode,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        routes?: Array<{ distanceMeters?: number; duration?: string }>;
      };
      const route = payload.routes?.[0];
      const distanceMeters = this.positiveNumber(route?.distanceMeters);
      if (distanceMeters === null) {
        return null;
      }

      return {
        provider: "GOOGLE_ROUTES" as const,
        accuracy: "ROAD_ROUTE" as const,
        distanceMeters,
        distanceKm: distanceMeters / 1000,
        durationSeconds: this.durationSeconds(route?.duration),
        fallbackUsed: false,
        failureReason: null,
        origin,
        destination,
        resolvedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private async mapboxDirections(
    settings: MapRoutingSettings,
    origin: RouteDistanceResult["origin"] & { latitude: number; longitude: number },
    destination: RouteDistanceResult["destination"] & { latitude: number; longitude: number },
  ) {
    try {
      const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      const url = new URL(
        `https://api.mapbox.com/directions/v5/${settings.mapboxProfile}/${coordinates}`,
      );
      url.searchParams.set("access_token", settings.mapboxAccessToken);
      url.searchParams.set("overview", "false");
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        routes?: Array<{ distance?: number; duration?: number }>;
      };
      const route = payload.routes?.[0];
      const distanceMeters = this.positiveNumber(route?.distance);
      if (distanceMeters === null) {
        return null;
      }

      return {
        provider: "MAPBOX_DIRECTIONS" as const,
        accuracy: "ROAD_ROUTE" as const,
        distanceMeters,
        distanceKm: distanceMeters / 1000,
        durationSeconds: this.positiveNumber(route?.duration),
        fallbackUsed: false,
        failureReason: null,
        origin,
        destination,
        resolvedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private normalizedPoint(point: RouteDistancePoint | null | undefined) {
    return {
      latitude: this.coordinate(point?.latitude),
      longitude: this.coordinate(point?.longitude),
      label: point?.label?.trim() || null,
    };
  }

  private hasCoordinates(point: RouteDistanceResult["origin"]): point is RouteDistanceResult["origin"] & {
    latitude: number;
    longitude: number;
  } {
    return point.latitude !== null && point.longitude !== null;
  }

  private unavailable(
    origin: RouteDistanceResult["origin"],
    destination: RouteDistanceResult["destination"],
    failureReason: string,
  ): RouteDistanceResult {
    return {
      provider: "NONE",
      accuracy: "UNAVAILABLE",
      distanceMeters: null,
      distanceKm: null,
      durationSeconds: null,
      fallbackUsed: false,
      failureReason,
      origin,
      destination,
      resolvedAt: new Date().toISOString(),
    };
  }

  private coordinate(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private positiveNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  }

  private durationSeconds(value: string | undefined) {
    if (!value) {
      return null;
    }

    const match = /^(\d+(?:\.\d+)?)s$/.exec(value);
    return match ? Math.round(Number(match[1])) : null;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
