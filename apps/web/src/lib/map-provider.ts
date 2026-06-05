export type MapPickerProvider = "OSM_LEAFLET" | "MAPBOX";

export type MapPickerProviderConfig = {
  provider: MapPickerProvider;
  tileUrl: string;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
};

const osmTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function mapPickerProviderConfig(): MapPickerProviderConfig {
  const configuredProvider = process.env.NEXT_PUBLIC_MAP_PROVIDER?.trim().toUpperCase();
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
  const explicitTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
  const explicitAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION?.trim();

  if (explicitTileUrl) {
    return {
      provider: configuredProvider === "MAPBOX" ? "MAPBOX" : "OSM_LEAFLET",
      tileUrl: explicitTileUrl,
      attribution: explicitAttribution || osmAttribution,
    };
  }

  if (configuredProvider === "MAPBOX" && mapboxToken) {
    return {
      provider: "MAPBOX",
      tileUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxToken)}`,
      attribution:
        explicitAttribution ||
        '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
    };
  }

  return {
    provider: "OSM_LEAFLET",
    tileUrl: osmTileUrl,
    attribution: explicitAttribution || osmAttribution,
  };
}
