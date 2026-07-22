import { rupeesToPaise, paiseToRupees } from "../../lib/money";
import type {
  SellerProfile,
  SellerServiceArea,
  SellerServiceBooking,
  SellerServiceListing,
  SellerServicePayload,
  ProductTaxClassification,
  ServiceBookingStatus,
  ServiceCancellationPolicy,
  ServicePaymentMode,
  ServicePaymentPurpose,
  ServicePricingModel,
  ServiceVisitMode,
} from "./seller-api";

export type ServiceFormValues = {
  categoryId: string;
  title: string;
  description: string;
  pricingModel: ServicePricingModel;
  paymentMode: ServicePaymentMode;
  cancellationPolicy: ServiceCancellationPolicy;
  taxClassification: ProductTaxClassification;
  sacCode: string;
  gstRatePercent: string;
  basePrice: string;
  inspectionFee: string;
  advanceAmount: string;
  quoteTtlHours: string;
  serviceDurationMinutes: string;
  allowedVisitModes: ServiceVisitMode[];
  highlights: string;
  inclusions: string;
  exclusions: string;
  requirements: string;
  imageUrl: string;
  packageName: string;
  packageDescription: string;
  packagePrice: string;
  packageMrp: string;
  areaLabel: string;
  areaPincode: string;
  areaRadiusKm: string;
};

export type ServiceBookingAction =
  | "ACCEPT"
  | "RESCHEDULE"
  | "REJECT"
  | "CANCEL"
  | "QUOTE"
  | "WITHDRAW_QUOTE"
  | "START"
  | "FIELD_STATUS"
  | "COMPLETE"
  | "PAYMENT";

export const serviceVisitModeOptions: Array<{ label: string; value: ServiceVisitMode }> = [
  { label: "Customer location", value: "CUSTOMER_LOCATION" },
  { label: "Provider location", value: "PROVIDER_LOCATION" },
  { label: "Remote", value: "REMOTE" },
];

export const servicePricingModelOptions: Array<{ label: string; value: ServicePricingModel }> = [
  { label: "Fixed price", value: "FIXED_PRICE" },
  { label: "Quote first", value: "QUOTE_FIRST" },
  { label: "Inspection fee", value: "INSPECTION_FEE" },
];

export const servicePaymentModeOptions: Array<{ label: string; value: ServicePaymentMode }> = [
  { label: "Full payment", value: "FULL_PAYMENT" },
  { label: "Advance payment", value: "ADVANCE_PAYMENT" },
  { label: "Inspection fee", value: "INSPECTION_FEE" },
  { label: "Pay at visit", value: "PAY_AT_VISIT" },
];

export const servicePaymentPurposeOptions: Array<{ label: string; value: ServicePaymentPurpose }> = [
  { label: "Inspection fee", value: "INSPECTION_FEE" },
  { label: "Full payment", value: "FULL_PAYMENT" },
  { label: "Advance payment", value: "ADVANCE_PAYMENT" },
  { label: "Final quote", value: "FINAL_QUOTE" },
  { label: "Pay at visit", value: "PAY_AT_VISIT" },
];

export function createServiceForm(service?: SellerServiceListing | null, profile?: SellerProfile | null): ServiceFormValues {
  const primaryArea = service?.areas?.[0] ?? profile?.serviceAreas?.[0] ?? profile?.addresses?.[0];
  const firstPackage = service?.packages?.[0];
  const primaryImage = service?.images?.find((image) => image.isPrimary)?.url ?? service?.images?.[0]?.url ?? "";

  return {
    categoryId: service?.categoryId ?? "",
    title: service?.title ?? "",
    description: service?.description ?? "",
    pricingModel: service?.pricingModel ?? "FIXED_PRICE",
    paymentMode: service?.paymentMode ?? "FULL_PAYMENT",
    cancellationPolicy: service?.cancellationPolicy ?? "FLEXIBLE",
    taxClassification: service?.taxClassification ?? "TAXABLE",
    sacCode: service?.sacCode ?? "",
    gstRatePercent:
      service?.taxClassification === "TAXABLE"
        ? String(service.gstRatePercent ?? "")
        : "0",
    basePrice: paiseInput(service?.basePricePaise),
    inspectionFee: paiseInput(service?.inspectionFeePaise),
    advanceAmount: paiseInput(service?.advanceAmountPaise),
    quoteTtlHours: String(service?.quoteTtlHours ?? 48),
    serviceDurationMinutes: String(service?.serviceDurationMinutes ?? 60),
    allowedVisitModes: service?.allowedVisitModes?.length ? service.allowedVisitModes : ["CUSTOMER_LOCATION"],
    highlights: (service?.highlights ?? []).join("\n"),
    inclusions: (service?.inclusions ?? []).join("\n"),
    exclusions: (service?.exclusions ?? []).join("\n"),
    requirements: (service?.requirements ?? []).join("\n"),
    imageUrl: primaryImage,
    packageName: firstPackage?.name ?? "",
    packageDescription: firstPackage?.description ?? "",
    packagePrice: paiseInput(firstPackage?.pricePaise),
    packageMrp: paiseInput(firstPackage?.mrpPaise),
    areaLabel: areaLabel(primaryArea),
    areaPincode: primaryArea?.pincode ?? "",
    areaRadiusKm: radiusInput(primaryArea),
  };
}

export function buildServicePayload(values: ServiceFormValues): SellerServicePayload {
  const basePricePaise = rupeesToPaise(values.basePrice);
  const inspectionFeePaise = rupeesToPaise(values.inspectionFee);
  const advanceAmountPaise = rupeesToPaise(values.advanceAmount);
  const packagePricePaise = rupeesToPaise(values.packagePrice);
  const packageMrpPaise = rupeesToPaise(values.packageMrp);
  const durationMinutes = numberOrUndefined(values.serviceDurationMinutes);
  const quoteTtlHours = numberOrUndefined(values.quoteTtlHours);
  const areaRadiusKm = numberOrUndefined(values.areaRadiusKm);
  const title = values.title.trim();

  return {
    categoryId: values.categoryId.trim(),
    title,
    description: values.description.trim(),
    pricingModel: values.pricingModel,
    paymentMode: values.paymentMode,
    cancellationPolicy: values.cancellationPolicy,
    taxClassification: values.taxClassification,
    ...(values.sacCode.trim() ? { sacCode: values.sacCode.trim() } : {}),
    gstRatePercent:
      values.taxClassification === "TAXABLE"
        ? Number(values.gstRatePercent)
        : 0,
    currency: "INR",
    ...(basePricePaise > 0 ? { basePricePaise } : {}),
    ...(inspectionFeePaise > 0 ? { inspectionFeePaise } : {}),
    ...(advanceAmountPaise > 0 ? { advanceAmountPaise } : {}),
    ...(quoteTtlHours ? { quoteTtlHours } : {}),
    ...(durationMinutes ? { serviceDurationMinutes: durationMinutes } : {}),
    allowedVisitModes: values.allowedVisitModes.length ? values.allowedVisitModes : ["CUSTOMER_LOCATION"],
    highlights: lines(values.highlights),
    inclusions: lines(values.inclusions),
    exclusions: lines(values.exclusions),
    requirements: lines(values.requirements),
    images: values.imageUrl.trim()
      ? [{ url: values.imageUrl.trim(), altText: title, sortOrder: 0, isPrimary: true }]
      : [],
    packages:
      values.packageName.trim() && packagePricePaise > 0
        ? [
            {
              name: values.packageName.trim(),
              description: values.packageDescription.trim() || null,
              pricePaise: packagePricePaise,
              ...(packageMrpPaise > 0 ? { mrpPaise: packageMrpPaise } : {}),
              ...(durationMinutes ? { durationMinutes } : {}),
              sortOrder: 0,
              isActive: true,
            },
          ]
        : [],
    areas: serviceAreasFromValues(values, areaRadiusKm),
  };
}

export function availableServiceBookingActions(status: ServiceBookingStatus): ServiceBookingAction[] {
  switch (status) {
    case "REQUESTED":
      return ["ACCEPT", "REJECT", "CANCEL"];
    case "ACCEPTED":
    case "SCHEDULED":
      return ["RESCHEDULE", "QUOTE", "START", "FIELD_STATUS", "CANCEL", "PAYMENT"];
    case "QUOTE_SENT":
      return ["WITHDRAW_QUOTE", "FIELD_STATUS", "CANCEL", "PAYMENT"];
    case "QUOTE_ACCEPTED":
      return ["RESCHEDULE", "START", "FIELD_STATUS", "CANCEL", "PAYMENT"];
    case "IN_PROGRESS":
      return ["FIELD_STATUS", "QUOTE", "COMPLETE", "PAYMENT"];
    default:
      return [];
  }
}

export function dueServiceAmountPaise(booking: SellerServiceBooking) {
  return Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise);
}

export function servicePriceLabel(service: SellerServiceListing) {
  if (service.pricingModel === "QUOTE_FIRST") return "Quote after inspection";
  if (service.pricingModel === "INSPECTION_FEE") return `Inspection from ${paiseToRupees(service.inspectionFeePaise ?? 0)} INR`;
  return `Starts at ${paiseToRupees(service.basePricePaise ?? service.packages?.[0]?.pricePaise ?? 0)} INR`;
}

function paiseInput(value?: number | null) {
  return value ? paiseToRupees(value) : "";
}

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function numberOrUndefined(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function radiusInput(area?: SellerServiceArea | SellerAddressLike | null) {
  const radius = "radiusKm" in (area ?? {}) ? area?.radiusKm : undefined;
  return typeof radius === "number" && Number.isFinite(radius) ? String(radius) : "";
}

function areaLabel(area?: SellerServiceArea | SellerAddressLike | null) {
  if (!area) return "";
  if ("label" in area && area.label) return area.label;
  if ("area" in area && area.area) return area.area;
  return "";
}

function serviceAreasFromValues(values: ServiceFormValues, radiusKm?: number): SellerServiceArea[] {
  const label = values.areaLabel.trim() || values.areaPincode.trim();
  if (!label) return [];
  const area: SellerServiceArea = {
    label,
    countryCode: "IN",
    isActive: true,
  };
  if (values.areaPincode.trim()) {
    area.pincode = values.areaPincode.trim();
  }
  if (typeof radiusKm === "number") {
    area.radiusKm = radiusKm;
  }
  return [area];
}

type SellerAddressLike = { area?: string; label?: string; pincode?: string; radiusKm?: number | null };
