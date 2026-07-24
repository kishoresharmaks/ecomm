import { CourierShipmentStatus } from "@indihub/database";

export type CourierProviderAdapterSnapshot = {
  providerCode?: string | null;
  adapterCode?: string | null;
  apiBaseUrl?: string | null;
  bookingEndpointPath?: string | null;
  trackingEndpointPath?: string | null;
  labelEndpointPath?: string | null;
  cancellationEndpointPath?: string | null;
  preferredCourierCompanyId?: string | null;
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
  hsnCode?: string | null;
};

export type CourierBookingPackage = {
  weightGrams: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  ewayBillNumber?: string | null;
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
  shippingChargesPaise: number;
  billingCompanyName?: string | null;
  customerGstin?: string | null;
  pickupLocationName: string;
  shippingAddress: CourierBookingAddress;
  sellerAddress: CourierBookingAddress;
  items: CourierBookingItem[];
  parcel: CourierBookingPackage;
  ewayBillNumber?: string | null;
  note?: string | null;
  settings: CourierProviderAdapterSnapshot;
};

export type CourierRateQuoteRequest = {
  providerCode: string;
  currency: string;
  paymentMethod: "COD" | "PREPAID";
  subtotalPaise: number;
  codAmountPaise: number;
  shippingAddress: CourierBookingAddress;
  sellerAddress: CourierBookingAddress;
  parcel: CourierBookingPackage;
  settings: CourierProviderAdapterSnapshot;
};

export type CourierBookingResult = {
  providerOrderId?: string | null;
  awbNumber?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  manifestUrl?: string | null;
  invoiceUrl?: string | null;
  shippingZone?: string | null;
  providerRawStatus?: string | null;
  providerRawStatusCode?: string | null;
  pickupScheduledAt?: Date | null;
  trackingStatus?: CourierShipmentStatus;
  trackingStatusLabel?: string | null;
  bookingPayloadSnapshot: unknown;
  bookingResponseSnapshot: unknown;
};

export type CourierBookingLookupResult = {
  found: boolean;
  providerOrderId?: string | null;
  awbNumber?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  trackingStatus?: CourierShipmentStatus;
  trackingStatusLabel?: string | null;
  bookingResponseSnapshot: unknown;
};

export type CourierRateQuoteResult = {
  serviceable: boolean;
  providerCode: string;
  courierCompanyId?: string | null;
  courierName?: string | null;
  courierCode?: string | null;
  freightChargePaise?: number | null;
  codChargePaise?: number | null;
  totalChargePaise?: number | null;
  currency?: string | null;
  estimatedDeliveryDays?: string | null;
  shippingZone?: string | null;
  warning?: string | null;
  quotePayloadSnapshot: unknown;
  quoteResponseSnapshot: unknown;
};

export type CourierPickupSyncRequest = {
  providerCode: string;
  pickupLocationName: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  sellerAddress: CourierBookingAddress;
  settings: CourierProviderAdapterSnapshot;
};

export type CourierPickupSyncResult = {
  pickupLocationName: string;
  providerPickupId?: string | null;
  statusLabel?: string | null;
  pickupPayloadSnapshot: unknown;
  pickupResponseSnapshot: unknown;
};

export type CourierCancelRequest = {
  providerCode: string;
  providerOrderId?: string | null;
  awbNumber?: string | null;
  orderNumber?: string | null;
  settings: CourierProviderAdapterSnapshot;
};

export type CourierCancelResult = {
  success: boolean;
  message?: string | null;
  cancelPayloadSnapshot?: unknown;
  cancelResponseSnapshot?: unknown;
};

export interface CourierAdapter {
  readonly code: string;
  bookShipment(request: CourierBookingRequest): Promise<CourierBookingResult>;
  cancelShipment?(request: CourierCancelRequest): Promise<CourierCancelResult>;
  lookupShipmentByOrderId?(request: CourierBookingRequest): Promise<CourierBookingLookupResult>;
  quoteShipment?(request: CourierRateQuoteRequest): Promise<CourierRateQuoteResult>;
  syncPickupLocation?(request: CourierPickupSyncRequest): Promise<CourierPickupSyncResult>;
  verifyCredentials?(settings: CourierProviderAdapterSnapshot): Promise<{ success: boolean; message?: string }>;
}
