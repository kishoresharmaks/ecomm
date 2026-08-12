import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(new URL("../../../../Dockerfile.web", import.meta.url), "utf8");
const compose = readFileSync(new URL("../../../../docker-compose.yml", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../../../../.dockerignore", import.meta.url), "utf8");

describe("Docker public web environment boundary", () => {
  it("passes browser API settings at image build time without copying env files", () => {
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_API_URL");
    expect(dockerfile).toContain("ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL");
    expect(compose).toContain("NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-https://api.1handindia.com}");
    expect(dockerignore).toContain("apps/*/.env");
  });
});
