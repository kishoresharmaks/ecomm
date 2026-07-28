import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expireRazorpayReservations,
  normalizeInternalApiBaseUrl,
} from "./razorpay-reservation-expiry-worker";

describe("Razorpay reservation expiry worker", () => {
  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("posts the timeout policy to the protected internal API", async () => {
    process.env.INTERNAL_API_SECRET = "test-secret";
    process.env.INTERNAL_API_URL = "http://localhost:4000";
    const request = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checked: 1,
          expired: 1,
          capturedRecovered: 0,
          authorizedSkipped: 0,
          conflictsSkipped: 0,
          failed: 0,
          cutoff: "2026-07-20T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(expireRazorpayReservations(15, 50, request)).resolves.toMatchObject({
      expired: 1,
    });
    expect(request).toHaveBeenCalledWith(
      "http://localhost:4000/api/internal/payments/expire-razorpay-reservations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": "test-secret",
        },
        body: JSON.stringify({ timeoutMinutes: 15, limit: 50 }),
      },
    );
  });

  it("requires the shared internal API secret", async () => {
    await expect(expireRazorpayReservations(15, 50, vi.fn())).rejects.toThrow(
      "INTERNAL_API_SECRET is missing.",
    );
  });

  it("normalizes API origins and already-prefixed API URLs", () => {
    expect(normalizeInternalApiBaseUrl("https://api.1handindia.com")).toBe(
      "https://api.1handindia.com/api",
    );
    expect(normalizeInternalApiBaseUrl("https://api.1handindia.com/api/")).toBe(
      "https://api.1handindia.com/api",
    );
  });
});
