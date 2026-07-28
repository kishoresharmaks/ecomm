import { describe, expect, it } from "vitest";
import {
  adminContactConfig,
  defaultContactSettings,
  normalizeContactSettings,
  publicContactConfig,
} from "./contact-settings";

describe("contact settings", () => {
  it("derives public enabled channels from toggles plus configured values", () => {
    const config = normalizeContactSettings({
      supportEmail: "help@1handindia.test",
      supportPhone: "",
      whatsappNumber: "+91 98765 43210",
      businessAddress: "Saved address",
      mapUrl: "https://maps.example.test/office",
      enableEmail: true,
      enablePhone: true,
      enableWhatsapp: true,
      enableAddress: false,
      enableMap: true,
    });

    expect(publicContactConfig(config)).toMatchObject({
      enabledChannels: ["EMAIL", "WHATSAPP"],
      whatsappLink: "https://wa.me/919876543210",
      businessAddress: "",
      mapUrl: "https://maps.example.test/office",
    });
  });

  it("keeps disabled saved values visible to admin readback", () => {
    const config = normalizeContactSettings({
      ...defaultContactSettings,
      businessAddress: "Back office address",
      mapUrl: "https://maps.example.test/hidden",
      enableAddress: false,
      enableMap: false,
    });

    expect(adminContactConfig(config)).toMatchObject({
      businessAddress: "Back office address",
      mapUrl: "https://maps.example.test/hidden",
      enabledChannels: ["EMAIL"],
    });
  });
});
