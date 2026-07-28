import { describe, expect, it, vi } from "vitest";
import {
  createJobEnvelope,
  createPollingGuard,
  retryDelayMs,
  safeJobError,
} from "./job-runtime";

describe("worker job runtime", () => {
  it("creates versioned envelopes and propagates correlation", () => {
    expect(
      createJobEnvelope({
        jobId: "job-1",
        jobType: "search.index",
        idempotencyKey: "product-1:v2",
        requestId: "req-1",
        payload: { productId: "product-1" },
        metadata: { token: "secret", batch: 2 },
      }),
    ).toMatchObject({
      jobId: "job-1",
      schemaVersion: 1,
      correlationId: "req-1",
      metadata: { token: "[REDACTED]", batch: 2 },
    });
  });

  it("keeps exponential retry inside bounded jitter", () => {
    const policy = { baseDelayMs: 1_000, maxDelayMs: 10_000, jitterRatio: 0.2 };
    expect(retryDelayMs(3, policy, () => 0)).toBe(3_200);
    expect(retryDelayMs(3, policy, () => 1)).toBe(4_800);
    expect(retryDelayMs(10, policy, () => 0.5)).toBe(10_000);
  });

  it("redacts sensitive errors and classifies invariant failures as terminal", () => {
    expect(safeJobError(new Error("invariant failed token=abc"))).toEqual({
      name: "Error",
      message: "invariant failed token=[REDACTED]",
      retryable: false,
    });
  });

  it("prevents overlapping polling runs", async () => {
    const guard = createPollingGuard();
    let release!: () => void;
    const first = guard(() => new Promise<void>((resolve) => (release = resolve)));
    const second = await guard(vi.fn(async () => "duplicate"));
    expect(second).toBeUndefined();
    release();
    await first;
    await expect(guard(async () => "next")).resolves.toBe("next");
  });
});
