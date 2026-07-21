import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InternalPaymentsController } from "./internal-payments.controller";

describe("InternalPaymentsController", () => {
  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
  });

  it("rejects missing or incorrect internal secrets", () => {
    process.env.INTERNAL_API_SECRET = "expected-secret";
    const controller = new InternalPaymentsController({
      expireStaleRazorpayReservations: vi.fn(),
    } as never);

    expect(() => controller.expireRazorpayReservations("wrong-secret", {})).toThrow(
      UnauthorizedException,
    );
  });

  it("runs the expiry batch with validated optional values", async () => {
    process.env.INTERNAL_API_SECRET = "expected-secret";
    const expireStaleRazorpayReservations = vi.fn().mockResolvedValue({ expired: 1 });
    const controller = new InternalPaymentsController({
      expireStaleRazorpayReservations,
    } as never);

    await expect(
      controller.expireRazorpayReservations("expected-secret", {
        timeoutMinutes: 15,
        limit: 50,
      }),
    ).resolves.toEqual({ expired: 1 });
    expect(expireStaleRazorpayReservations).toHaveBeenCalledWith({
      timeoutMinutes: 15,
      limit: 50,
    });
  });
});
