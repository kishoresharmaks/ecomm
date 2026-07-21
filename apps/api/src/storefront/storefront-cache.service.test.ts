import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  disconnect: vi.fn(),
  errorHandler: undefined as ((error: Error) => void) | undefined,
  options: undefined as Record<string, unknown> | undefined,
}));

vi.mock("ioredis", () => ({
  default: class RedisMock {
    constructor(_url: string, options: Record<string, unknown>) {
      redisMock.options = options;
    }

    on(event: string, handler: (error: Error) => void) {
      if (event === "error") {
        redisMock.errorHandler = handler;
      }
    }

    disconnect() {
      redisMock.disconnect();
    }
  },
}));

import { StorefrontCacheService } from "./storefront-cache.service";

describe("StorefrontCacheService", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "redis://127.0.0.1:1";
    redisMock.disconnect.mockClear();
    redisMock.errorHandler = undefined;
    redisMock.options = undefined;
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.restoreAllMocks();
  });

  it("disables Redis after the first connection error and uses the local fallback path", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const cache = new StorefrontCacheService();

    expect(cache.isAvailable()).toBe(true);
    expect(redisMock.options).toMatchObject({
      enableOfflineQueue: false,
      maxRetriesPerRequest: null,
    });

    const retryStrategy = redisMock.options?.retryStrategy as (attempt: number) => number | null;
    expect(retryStrategy(1)).toBe(250);
    expect(retryStrategy(2)).toBeNull();

    redisMock.errorHandler?.(new Error("offline"));
    redisMock.errorHandler?.(new Error("still offline"));

    expect(cache.isAvailable()).toBe(false);
    await expect(cache.get("home:test")).resolves.toBeNull();
    expect(redisMock.disconnect).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
