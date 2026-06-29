import { describe, expect, it } from "vitest";
import { createCorsOptions, parseCorsOrigins } from "./cors";

function checkOrigin(origin: string | undefined, env: NodeJS.ProcessEnv) {
  const options = createCorsOptions(env);
  let allowed: boolean | undefined;
  options.origin(origin, (error, result) => {
    if (error) {
      throw error;
    }
    allowed = result;
  });
  return allowed;
}

describe("createCorsOptions", () => {
  it("allows the configured LAN web origin", () => {
    expect(
      checkOrigin("http://192.168.1.2:3000", {
        API_CORS_ORIGINS: "http://192.168.1.2:3000",
      }),
    ).toBe(true);
  });

  it("trims spaces and quotes in configured origins", () => {
    expect(parseCorsOrigins('"http://192.168.1.2:3000", http://10.0.0.5:3000')).toEqual(
      new Set(["http://192.168.1.2:3000", "http://10.0.0.5:3000"]),
    );
  });

  it("allows private network origins during development", () => {
    expect(checkOrigin("http://192.168.1.44:3000", { NODE_ENV: "development" })).toBe(true);
    expect(checkOrigin("http://10.0.0.12:5173", { NODE_ENV: "development" })).toBe(true);
    expect(checkOrigin("http://172.20.1.8:3000", { NODE_ENV: "development" })).toBe(true);
  });

  it("blocks unconfigured private origins in production", () => {
    expect(
      checkOrigin("http://192.168.1.44:3000", {
        API_CORS_ORIGINS: "https://1handindia.com",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });
});
