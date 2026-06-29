import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveImageUrl } from "./image-url";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalWebUrl = process.env.EXPO_PUBLIC_WEB_URL;

describe("resolveImageUrl", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.3:4000/api";
    process.env.EXPO_PUBLIC_WEB_URL = "http://192.168.1.2:3000";
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    process.env.EXPO_PUBLIC_WEB_URL = originalWebUrl;
  });

  it("routes CMS public paths through the API storage redirect instead of the web dev server", () => {
    expect(resolveImageUrl("/cms/homepage-local-marketplace-hero.svg")).toBe(
      "http://192.168.1.3:4000/api/storage/public-image?key=1handindia%2Fcms%2Fhomepage-local-marketplace-hero.svg",
    );
    expect(resolveImageUrl("http://192.168.1.2:3000/cms/homepage-local-marketplace-hero.svg")).toBe(
      "http://192.168.1.3:4000/api/storage/public-image?key=1handindia%2Fcms%2Fhomepage-local-marketplace-hero.svg",
    );
  });

  it("keeps portable storage keys and external image URLs stable", () => {
    expect(resolveImageUrl("1handindia/cms/published-homepage-banner.jpg")).toBe(
      "http://192.168.1.3:4000/api/storage/public-image?key=1handindia%2Fcms%2Fpublished-homepage-banner.jpg",
    );
    expect(resolveImageUrl("https://cdn.example.com/product.jpg")).toBe("https://cdn.example.com/product.jpg");
  });
});
