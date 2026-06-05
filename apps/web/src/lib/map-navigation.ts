export type CoordinateInput = {
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function coordinatesFromSnapshot(snapshot: CoordinateInput | null | undefined): Coordinates | null {
  const latitude = coordinateNumber(snapshot?.latitude);
  const longitude = coordinateNumber(snapshot?.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

export function googleMapsSearchUrl(coordinates: Coordinates) {
  const query = coordinatePair(coordinates);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleMapsDirectionsUrl(coordinates: Coordinates) {
  const destination = coordinatePair(coordinates);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function formatCoordinates(coordinates: Coordinates) {
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

function coordinateNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coordinatePair(coordinates: Coordinates) {
  return `${coordinates.latitude},${coordinates.longitude}`;
}
