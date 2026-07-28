import { describe, expect, it, vi } from "vitest";
import { SettingsService } from "./settings.service";

const validSettings = {
  platform: {
    legalName: "1HandIndia Private Limited",
    gstin: "33ABCDE1234F1Z5",
    stateCode: "33",
    serviceSacCode: "998599",
    serviceDescription: "Marketplace commission and platform services",
    address: {
      line1: "12 Marketplace Avenue",
      line2: "",
      city: "Chennai",
      state: "Tamil Nadu",
      postalCode: "600001",
      country: "India" as const,
    },
  },
  eInvoice: { enabled: true, provider: "MANUAL" as const },
  eWayBill: {
    enabled: true,
    provider: "MANUAL" as const,
    thresholdPaise: 5_000_000,
  },
};

describe("SettingsService GST configuration", () => {
  it("rejects a GSTIN and state-code mismatch before writing", async () => {
    const prisma = { client: { $transaction: vi.fn() } };
    const service = new SettingsService(prisma as never);

    await expect(
      service.upsertGstSettings(
        { id: "admin-1" } as never,
        {
          ...validSettings,
          platform: { ...validSettings.platform, stateCode: "29" },
        },
      ),
    ).rejects.toThrow("GSTIN state prefix");
    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it("writes every GST setting atomically and records one audit event", async () => {
    const values = new Map<string, unknown>();
    const tx = {
      setting: {
        findMany: vi.fn(async () =>
          [...values].map(([key, value]) => ({ key, value })),
        ),
        upsert: vi.fn(async ({ create }: { create: { key: string; value: unknown } }) => {
          values.set(create.key, create.value);
          return create;
        }),
      },
      auditLog: { create: vi.fn(async () => undefined) },
    };
    const prisma = {
      client: {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
      },
    };
    const service = new SettingsService(prisma as never);

    await expect(
      service.upsertGstSettings(
        { id: "admin-1" } as never,
        validSettings,
      ),
    ).resolves.toEqual(validSettings);
    expect(tx.setting.upsert).toHaveBeenCalledTimes(11);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-1",
        action: "settings.gst.updated",
        entityType: "gst_settings",
      }),
    });
  });
});
