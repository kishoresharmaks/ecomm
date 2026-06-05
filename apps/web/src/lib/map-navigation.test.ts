import { describe, expect, it } from "vitest";
import {
  coordinatesFromSnapshot,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
} from "./map-navigation";

describe("map navigation helpers", () => {
  it("normalizes valid numeric and string coordinates", () => {
    expect(coordinatesFromSnapshot({ latitude: "11.6643", longitude: 78.146 })).toEqual({
      latitude: 11.6643,
      longitude: 78.146,
    });
  });

  it("rejects missing or out-of-range coordinates", () => {
    expect(coordinatesFromSnapshot(null)).toBeNull();
    expect(coordinatesFromSnapshot({ latitude: 120, longitude: 78.146 })).toBeNull();
    expect(coordinatesFromSnapshot({ latitude: 11.6643, longitude: 220 })).toBeNull();
  });

  it("builds Google Maps view and route URLs without a paid API key", () => {
    const coordinates = { latitude: 11.6643, longitude: 78.146 };

    expect(googleMapsSearchUrl(coordinates)).toContain("https://www.google.com/maps/search/");
    expect(googleMapsSearchUrl(coordinates)).toContain("query=11.6643%2C78.146");
    expect(googleMapsDirectionsUrl(coordinates)).toContain("https://www.google.com/maps/dir/");
    expect(googleMapsDirectionsUrl(coordinates)).toContain("destination=11.6643%2C78.146");
    expect(googleMapsDirectionsUrl(coordinates)).toContain("travelmode=driving");
  });
});
