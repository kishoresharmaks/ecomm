import type { LocationArea } from "../../lib/location-api";

export function formatLocalAreaLabel(area: Pick<LocationArea, "name" | "postalCode">) {
  return area.postalCode ? `${area.name} (${area.postalCode})` : area.name;
}

export function normalizeLocalAreaSearchValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const displayLabelMatch = trimmed.match(/^(.*?)\s*\((\d{4,10})\)\s*$/);
  if (!displayLabelMatch) {
    return trimmed;
  }

  return displayLabelMatch[1]?.trim() || displayLabelMatch[2] || trimmed;
}
