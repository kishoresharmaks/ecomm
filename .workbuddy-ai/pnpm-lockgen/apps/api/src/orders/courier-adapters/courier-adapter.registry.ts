import { Injectable } from "@nestjs/common";
import type { CourierAdapter } from "./courier-adapter.types";
import { ShiprocketCourierAdapter } from "./shiprocket.adapter";

@Injectable()
export class CourierAdapterRegistry {
  private readonly adapters = new Map<string, CourierAdapter>([
    ["SHIPROCKET", new ShiprocketCourierAdapter()],
  ]);

  getAdapter(adapterCode?: string | null, providerCode?: string | null) {
    const normalizedAdapterCode = adapterCode?.trim().toUpperCase();
    const normalizedProviderCode = providerCode?.trim().toUpperCase();
    return this.adapters.get(normalizedAdapterCode ?? "") ?? this.adapters.get(normalizedProviderCode ?? "");
  }
}
