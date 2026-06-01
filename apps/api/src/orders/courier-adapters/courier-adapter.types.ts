import { CourierShipmentStatus } from "@indihub/database";

export type CourierProviderAdapterSnapshot = {
  providerCode?: string | null;
  adapterCode?: string | null;
  apiBaseUrl?: string | null;
  bookingEndpointPath?: string | null;
  trackingEndpointPath?: string | null;
  labelEndpointPath?: string | null;
  cancellationEndpointPath?: string | null;
  accountCode?: string | null;
  username?: string | null;
  credentials?: {
    apiKey?: string | null;
    apiSecret?: string | null;
    password?: string | null;
  } | null;
  defaultPackage?: {
    weightGrams?: number | null;
    lengthCm?: number | null;
    breadthCm?: number | null;
    heightCm?: number | null;
  } | null;
  liveApiCallsEnabled?: boolean;
  supportedPhase?: string;
};

export type CourierBookingAddress = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  countryCode?: string | null;
};

export type CourierBookingItem = {
  name: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
};

export type CourierBookingPackage = {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
};

export type CourierBookingRequest = {
  providerCode: string;
  shipmentNumber: string;
  orderNumber: string;
  orderDate: Date;
  currency: string;
  paymentMethod: "COD" | "PREPAID";
  subtotalPaise: number;
  codAmountPaise: number;
  pickupLocationName: string;
  shippingAddress: CourierBookingAddress;
  sellerAddress: CourierBookingAddress;
  items: CourierBookingItem[];
  parcel: CourierBookingPackage;
  note?: string | null;
  settings: CourierProviderAdapterSnapshot;
};

export type CourierBookingResult = {
  providerOrderId?: string | null;
  awbNumber?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  trackingStatus?: CourierShipmentStatus;
  trackingStatusLabel?: string | null;
  bookingPayloadSnapshot: unknown;
  bookingResponseSnapshot: unknown;
};

export interface CourierAdapter {
  readonly code: string;
  bookShipment(request: CourierBookingRequest): Promise<CourierBookingResult>;
}
