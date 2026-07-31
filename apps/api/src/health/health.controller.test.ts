import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns the public legacy liveness response", () => {
    const controller = new HealthController({
      liveness: () => ({
        ok: true,
        status: "live" as const,
        service: "indihub-api",
        timestamp: "2026-07-31T00:00:00.000Z",
      }),
    } as never);

    expect(controller.getHealth()).toEqual({
      ok: true,
      status: "live",
      service: "indihub-api",
      timestamp: "2026-07-31T00:00:00.000Z",
      brand: "1HandIndia",
    });
  });
});
