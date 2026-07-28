import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { MapsController } from "./maps.controller";
import { MapsService } from "./maps.service";

describe("MapsController", () => {
  it("injects MapsService for reverse geocode requests", async () => {
    const reverseGeocode = vi.fn().mockResolvedValue({
      configured: false,
      provider: "MAPBOX",
      latitude: 11.6643,
      longitude: 78.146,
      address: null,
      rawPlaceName: null,
      locationConfidenceScore: null,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [MapsController],
      providers: [{ provide: MapsService, useValue: { reverseGeocode } }],
    }).compile();

    const controller = moduleRef.get(MapsController);
    const result = await controller.reverseGeocode({ latitude: 11.6643, longitude: 78.146 });

    expect(reverseGeocode).toHaveBeenCalledWith({ latitude: 11.6643, longitude: 78.146 });
    expect(result).toMatchObject({
      configured: false,
      provider: "MAPBOX",
      latitude: 11.6643,
      longitude: 78.146,
    });
  });
});
