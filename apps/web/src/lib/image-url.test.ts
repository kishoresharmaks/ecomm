import { describe, expect, it } from "vitest";
import { isPrivateNetworkImageSource } from "./image-url";

describe("image URL helpers", () => {
  it("detects private-network image sources that Next image optimization rejects", () => {
    expect(isPrivateNetworkImageSource("http://192.168.1.2:4000/api/storage/public-image")).toBe(true);
    expect(isPrivateNetworkImageSource("http://127.0.0.1:4000/image.jpg")).toBe(true);
    expect(isPrivateNetworkImageSource("http://172.20.0.4/image.jpg")).toBe(true);
    expect(isPrivateNetworkImageSource("https://api.1handindia.com/image.jpg")).toBe(false);
    expect(isPrivateNetworkImageSource("/brand/logo.png")).toBe(false);
  });
});
