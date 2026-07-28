import { Prisma } from "@indihub/database";
import { readBooleanSetting } from "./setting-value-utils";

export const mapRoutingSettingGroup = "maps";

export const mapRoutingSettingKeys = {
  enabled: "maps.routing.enabled",
  provider: "maps.routing.provider",
  googleApiToken: "maps.routing.google_api_token",
  googleTravelMode: "maps.routing.google_travel_mode",
  mapboxAccessToken: "maps.routing.mapbox_access_token",
  mapboxProfile: "maps.routing.mapbox_profile",
  fallbackToHaversine: "maps.routing.fallback_to_haversine",
} as const;

export type MapRoutingProvider = "HAVERSINE" | "GOOGLE_ROUTES" | "MAPBOX_DIRECTIONS";
export type GoogleTravelMode = "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE";

export type MapRoutingSettings = {
  enabled: boolean;
  provider: MapRoutingProvider;
  googleApiToken: string;
  googleTravelMode: GoogleTravelMode;
  mapboxAccessToken: string;
  mapboxProfile: string;
  fallbackToHaversine: boolean;
};

export type MapRoutingSettingsReadback = Omit<
  MapRoutingSettings,
  "googleApiToken" | "mapboxAccessToken"
> & {
  googleApiToken: "";
  googleApiTokenConfigured: boolean;
  mapboxAccessToken: "";
  mapboxAccessTokenConfigured: boolean;
};

export const defaultMapRoutingSettings: MapRoutingSettings = {
  enabled: false,
  provider: "HAVERSINE",
  googleApiToken: "",
  googleTravelMode: "DRIVE",
  mapboxAccessToken: "",
  mapboxProfile: "mapbox/driving",
  fallbackToHaversine: true,
};

type SettingLike = {
  key: string;
  value: Prisma.JsonValue;
};

type SettingReader = {
  setting: {
    findMany(args: Prisma.SettingFindManyArgs): Promise<SettingLike[]>;
  };
};

export async function readMapRoutingSettings(client: SettingReader): Promise<MapRoutingSettings> {
  const settings = await client.setting.findMany({
    where: {
      key: {
        in: Object.values(mapRoutingSettingKeys),
      },
    },
  });
  return normalizeMapRoutingSettings(settings);
}

export function normalizeMapRoutingSettings(settings: SettingLike[]): MapRoutingSettings {
  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    enabled: readBooleanSetting(
      settingMap.get(mapRoutingSettingKeys.enabled),
      defaultMapRoutingSettings.enabled,
    ),
    provider: providerValue(settingMap.get(mapRoutingSettingKeys.provider)),
    googleApiToken: stringValue(
      settingMap.get(mapRoutingSettingKeys.googleApiToken),
      defaultMapRoutingSettings.googleApiToken,
    ),
    googleTravelMode: googleTravelModeValue(
      settingMap.get(mapRoutingSettingKeys.googleTravelMode),
    ),
    mapboxAccessToken: stringValue(
      settingMap.get(mapRoutingSettingKeys.mapboxAccessToken),
      defaultMapRoutingSettings.mapboxAccessToken,
    ),
    mapboxProfile: mapboxProfileValue(settingMap.get(mapRoutingSettingKeys.mapboxProfile)),
    fallbackToHaversine: readBooleanSetting(
      settingMap.get(mapRoutingSettingKeys.fallbackToHaversine),
      defaultMapRoutingSettings.fallbackToHaversine,
    ),
  };
}

export function mapRoutingSettingsReadback(
  settings: MapRoutingSettings,
): MapRoutingSettingsReadback {
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    googleApiToken: "",
    googleApiTokenConfigured: Boolean(settings.googleApiToken),
    googleTravelMode: settings.googleTravelMode,
    mapboxAccessToken: "",
    mapboxAccessTokenConfigured: Boolean(settings.mapboxAccessToken),
    mapboxProfile: settings.mapboxProfile,
    fallbackToHaversine: settings.fallbackToHaversine,
  };
}

function providerValue(value: Prisma.JsonValue | undefined): MapRoutingProvider {
  return value === "GOOGLE_ROUTES" || value === "MAPBOX_DIRECTIONS" || value === "HAVERSINE"
    ? value
    : defaultMapRoutingSettings.provider;
}

function googleTravelModeValue(value: Prisma.JsonValue | undefined): GoogleTravelMode {
  return value === "DRIVE" || value === "TWO_WHEELER" || value === "WALK" || value === "BICYCLE"
    ? value
    : defaultMapRoutingSettings.googleTravelMode;
}

function mapboxProfileValue(value: Prisma.JsonValue | undefined) {
  const profile = stringValue(value, defaultMapRoutingSettings.mapboxProfile);
  return /^mapbox\/(driving|driving-traffic|walking|cycling)$/i.test(profile)
    ? profile
    : defaultMapRoutingSettings.mapboxProfile;
}

function stringValue(value: Prisma.JsonValue | undefined, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}
