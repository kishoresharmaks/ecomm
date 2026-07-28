import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
  });

  it("is ready with PostgreSQL and reports optional Redis as not configured", async () => {
    delete process.env.REDIS_URL;
    const service = new HealthService({ client: { $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]) } } as never);
    await expect(service.readiness()).resolves.toMatchObject({
      ok: true,
      status: "degraded",
      checks: { database: { status: "available" }, redis: { status: "not_configured" } },
    });
  });

  it("fails readiness when PostgreSQL is unavailable", async () => {
    const service = new HealthService({ client: { $queryRaw: vi.fn().mockRejectedValue(new Error("offline")) } } as never);
    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      status: "not_ready",
      checks: { database: { status: "degraded" } },
    });
  });
});
