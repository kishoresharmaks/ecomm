import { CourierShipmentStatus } from "@indihub/database";
import type {
  CourierAdapter,
  CourierBookingRequest,
  CourierBookingLookupResult,
  CourierBookingResult,
  CourierPickupSyncRequest,
  CourierPickupSyncResult,
  CourierRateQuoteRequest,
  CourierRateQuoteResult,
  CourierProviderAdapterSnapshot,
} from "./courier-adapter.types";

type ShiprocketJson = Record<string, unknown>;

const defaultBaseUrl = "https://apiv2.shiprocket.in";
const authEndpoint = "/v1/external/auth/login";
const defaultBookingEndpoint = "/v1/external/orders/create/adhoc";
const defaultServiceabilityEndpoint = "/v1/external/courier/serviceability";
const defaultAwbEndpoint = "/v1/external/courier/assign/awb";
const defaultLabelEndpoint = "/v1/external/courier/generate/label";
const defaultPickupEndpoint = "/v1/external/settings/company/addpickup";
const defaultOrderLookupEndpoint = "/v1/external/orders/show";
const shiprocketRequestTimeoutMs = 30000;

export class ShiprocketCourierAdapter implements CourierAdapter {
  readonly code = "SHIPROCKET";

  async quoteShipment(request: CourierRateQuoteRequest): Promise<CourierRateQuoteResult> {
    const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
    const email = request.settings.username?.trim();
    const password = request.settings.credentials?.password?.trim();
    if (!email || !password) {
      throw new Error("Shiprocket live rate quote needs API username/email and password.");
    }

    const token = await this.authenticate(baseUrl, email, password);
    const quotePayload = this.createServiceabilityParams(request);
    const quoteResponse = await getJson(
      `${urlFor(baseUrl, defaultServiceabilityEndpoint)}?${quotePayload.toString()}`,
      token,
    );
    const selectedCourier = selectCourierCompany(
      quoteResponse,
      request.settings.preferredCourierCompanyId,
    );

    if (!selectedCourier) {
      const preferredCourierCompanyId = request.settings.preferredCourierCompanyId?.trim();
      return {
        serviceable: false,
        providerCode: request.providerCode,
        courierCompanyId: preferredCourierCompanyId || null,
        warning: preferredCourierCompanyId
          ? `Preferred courier company ${preferredCourierCompanyId} is not serviceable for this route.`
          : "Shiprocket did not return a serviceable courier for this route.",
        quotePayloadSnapshot: Object.fromEntries(quotePayload.entries()),
        quoteResponseSnapshot: quoteResponse,
      };
    }

    const freightChargePaise = rupeesToPaise(
      readNumber(selectedCourier, ["freight_charge"]) ??
        readNumber(selectedCourier, ["rate"]) ??
        readNumber(selectedCourier, ["charges"]) ??
        readNumber(selectedCourier, ["shipping_charge"]),
    );
    const codChargePaise = rupeesToPaise(
      readNumber(selectedCourier, ["cod_charges"]) ??
        readNumber(selectedCourier, ["cod_charge"]) ??
        readNumber(selectedCourier, ["cod"]),
    );
    const totalChargePaise = rupeesToPaise(
      readNumber(selectedCourier, ["total_charge"]) ??
        readNumber(selectedCourier, ["total_charges"]) ??
        readNumber(selectedCourier, ["etd_charge"]),
    );

    return {
      serviceable: true,
      providerCode: request.providerCode,
      courierCompanyId:
        readText(selectedCourier, ["courier_company_id"]) ?? readText(selectedCourier, ["id"]),
      courierName:
        readText(selectedCourier, ["courier_name"]) ??
        readText(selectedCourier, ["courier_company_name"]) ??
        readText(selectedCourier, ["name"]),
      courierCode: readText(selectedCourier, ["courier_code"]) ?? readText(selectedCourier, ["code"]),
      freightChargePaise,
      codChargePaise,
      totalChargePaise:
        totalChargePaise ?? (freightChargePaise ?? 0) + (codChargePaise ?? 0),
      currency: "INR",
      estimatedDeliveryDays:
        readText(selectedCourier, ["estimated_delivery_days"]) ??
        readText(selectedCourier, ["etd"]) ??
        readText(selectedCourier, ["estimated_delivery"]),
      shippingZone: readText(selectedCourier, ["zone"]),
      quotePayloadSnapshot: Object.fromEntries(quotePayload.entries()),
      quoteResponseSnapshot: quoteResponse,
    };
  }

  async bookShipment(request: CourierBookingRequest): Promise<CourierBookingResult> {
    const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
    const email = request.settings.username?.trim();
    const password = request.settings.credentials?.password?.trim();
    if (!email || !password) {
      throw new Error("Shiprocket live booking needs API username/email and password.");
    }

    const token = await this.authenticate(baseUrl, email, password);
    const bookingPayload = this.createBookingPayload(request);
    const createResponse = await postJson(
      urlFor(baseUrl, request.settings.bookingEndpointPath || defaultBookingEndpoint),
      bookingPayload,
      token,
    );
    const shipmentId =
      readText(createResponse, ["shipment_id"]) ??
      readText(createResponse, ["data", "shipment_id"]) ??
      readText(createResponse, ["payload", "shipment_id"]);
    const providerOrderId =
      readText(createResponse, ["order_id"]) ??
      readText(createResponse, ["data", "order_id"]) ??
      shipmentId ??
      request.shipmentNumber;

    let serviceabilityResponse: unknown = null;
    let awbResponse: unknown = null;
    let labelResponse: unknown = null;
    let awbNumber =
      readText(createResponse, ["awb_code"]) ??
      readText(createResponse, ["awb"]) ??
      readText(createResponse, ["data", "awb_code"]) ??
      readText(createResponse, ["data", "awb"]);
    let statusLabel = awbNumber ? "Shipment booked with Shiprocket." : "Shiprocket order created.";

    if (!awbNumber && shipmentId) {
      try {
        serviceabilityResponse = await this.fetchServiceability(baseUrl, token, request);
        const courierCompanyId = request.settings.preferredCourierCompanyId?.trim() || readRecommendedCourierCompanyId(serviceabilityResponse);
        if (courierCompanyId) {
          awbResponse = await postJson(
            urlFor(baseUrl, defaultAwbEndpoint),
            {
              shipment_id: numericOrText(shipmentId),
              courier_id: numericOrText(courierCompanyId),
            },
            token,
          );
          awbNumber =
            readText(awbResponse, ["response", "data", "awb_code"]) ??
            readText(awbResponse, ["data", "awb_code"]) ??
            readText(awbResponse, ["awb_code"]) ??
            readText(awbResponse, ["awb"]);
          statusLabel = awbNumber
            ? "Shiprocket AWB assigned."
            : "Shiprocket order created; AWB is pending provider assignment.";
        } else {
          statusLabel = "Shiprocket order created; no serviceable courier was returned for AWB assignment.";
        }
      } catch (error) {
        statusLabel = `Shiprocket order created; AWB assignment failed: ${errorMessage(error)}`;
      }
    }

    if (shipmentId && awbNumber) {
      try {
        labelResponse = await postJson(
          urlFor(baseUrl, request.settings.labelEndpointPath || defaultLabelEndpoint),
          { shipment_id: [numericOrText(shipmentId)] },
          token,
        );
      } catch (error) {
        labelResponse = { error: errorMessage(error) };
      }
    }

    const labelUrl =
      readText(labelResponse, ["label_url"]) ??
      readText(labelResponse, ["labelUrl"]) ??
      readText(labelResponse, ["data", "label_url"]) ??
      readText(labelResponse, ["response", "label_url"]);

    return {
      providerOrderId,
      awbNumber,
      trackingUrl: awbNumber ? `https://shiprocket.co/tracking/${encodeURIComponent(awbNumber)}` : null,
      labelUrl,
      trackingStatus: awbNumber ? CourierShipmentStatus.BOOKED : CourierShipmentStatus.NOT_BOOKED,
      trackingStatusLabel: statusLabel,
      bookingPayloadSnapshot: bookingPayload,
      bookingResponseSnapshot: {
        create: createResponse,
        serviceability: serviceabilityResponse,
        awb: awbResponse,
        label: labelResponse,
      },
    };
  }

  async lookupShipmentByOrderId(request: CourierBookingRequest): Promise<CourierBookingLookupResult> {
    const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
    const email = request.settings.username?.trim();
    const password = request.settings.credentials?.password?.trim();
    if (!email || !password) {
      throw new Error("Shiprocket booking lookup needs API username/email and password.");
    }

    const token = await this.authenticate(baseUrl, email, password);
    const params = new URLSearchParams({ order_id: request.shipmentNumber });
    const lookupResponse = await getJsonAllowNotFound(
      `${urlFor(baseUrl, defaultOrderLookupEndpoint)}?${params.toString()}`,
      token,
    );

    if (lookupResponse.notFound) {
      return {
        found: false,
        bookingResponseSnapshot: {
          lookup: {
            orderId: request.shipmentNumber,
            status: 404,
          },
        },
      };
    }

    const body = lookupResponse.body;
    const providerOrderId =
      readText(body, ["order_id"]) ??
      readText(body, ["data", "order_id"]) ??
      readText(body, ["payload", "order_id"]) ??
      readText(body, ["id"]) ??
      request.shipmentNumber;
    const shipmentId =
      readText(body, ["shipment_id"]) ??
      readText(body, ["data", "shipment_id"]) ??
      readText(body, ["payload", "shipment_id"]);
    const awbNumber =
      readText(body, ["awb_code"]) ??
      readText(body, ["awb"]) ??
      readText(body, ["data", "awb_code"]) ??
      readText(body, ["data", "awb"]) ??
      readText(body, ["shipments", "awb"]) ??
      readText(body, ["payload", "awb_code"]);
    const courierName =
      readText(body, ["courier_name"]) ??
      readText(body, ["data", "courier_name"]) ??
      readText(body, ["courier_company_name"]);
    const courierCode =
      readText(body, ["courier_code"]) ??
      readText(body, ["data", "courier_code"]) ??
      readText(body, ["courier_company_id"]);
    const statusLabel =
      readText(body, ["status"]) ??
      readText(body, ["data", "status"]) ??
      (awbNumber ? "Shiprocket booking recovered from order lookup." : "Shiprocket order found without AWB.");
    const labelUrl =
      readText(body, ["label_url"]) ??
      readText(body, ["data", "label_url"]) ??
      readText(body, ["labelUrl"]);

    return {
      found: true,
      providerOrderId: providerOrderId ?? shipmentId,
      awbNumber,
      courierName,
      courierCode,
      trackingUrl: awbNumber ? `https://shiprocket.co/tracking/${encodeURIComponent(awbNumber)}` : null,
      labelUrl,
      trackingStatus: awbNumber ? CourierShipmentStatus.BOOKED : CourierShipmentStatus.NOT_BOOKED,
      trackingStatusLabel: statusLabel,
      bookingResponseSnapshot: { lookup: body },
    };
  }

  async syncPickupLocation(
    request: CourierPickupSyncRequest,
  ): Promise<CourierPickupSyncResult> {
    const baseUrl = normalizeBaseUrl(request.settings.apiBaseUrl ?? defaultBaseUrl);
    const email = request.settings.username?.trim();
    const password = request.settings.credentials?.password?.trim();
    if (!email || !password) {
      throw new Error("Shiprocket pickup sync needs API username/email and password.");
    }

    const token = await this.authenticate(baseUrl, email, password);
    const pickupPayload = this.createPickupPayload(request);
    const pickupLocationName = String(pickupPayload.pickup_location);

    try {
      const pickupResponse = await postJson(
        urlFor(baseUrl, defaultPickupEndpoint),
        pickupPayload,
        token,
      );
      const providerPickupId =
        readText(pickupResponse, ["pickup_id"]) ??
        readText(pickupResponse, ["address", "id"]) ??
        readText(pickupResponse, ["data", "id"]);

      return {
        pickupLocationName,
        providerPickupId,
        statusLabel: "Shiprocket pickup location synced.",
        pickupPayloadSnapshot: pickupPayload,
        pickupResponseSnapshot: pickupResponse,
      };
    } catch (error) {
      if (isDuplicatePickupError(error)) {
        return {
          pickupLocationName,
          providerPickupId: null,
          statusLabel: "Shiprocket pickup location already exists.",
          pickupPayloadSnapshot: pickupPayload,
          pickupResponseSnapshot: { duplicate: true, message: errorMessage(error) },
        };
      }

      throw error;
    }
  }

  async verifyCredentials(settings: CourierProviderAdapterSnapshot): Promise<{ success: boolean; message?: string }> {
    const baseUrl = normalizeBaseUrl(settings.apiBaseUrl ?? defaultBaseUrl);
    const email = settings.username?.trim();
    const password = settings.credentials?.password?.trim();
    if (!email || !password) {
      return { success: false, message: "Missing email or password." };
    }

    try {
      await this.authenticate(baseUrl, email, password);
      return { success: true, message: "Successfully authenticated with Shiprocket." };
    } catch (error) {
      return { success: false, message: errorMessage(error) };
    }
  }

  private async authenticate(baseUrl: string, email: string, password: string) {
    const response = await postJson(urlFor(baseUrl, authEndpoint), { email, password });
    const token = readText(response, ["token"]) ?? readText(response, ["data", "token"]);
    if (!token) {
      throw new Error("Shiprocket authentication did not return a token.");
    }

    return token;
  }

  private async fetchServiceability(baseUrl: string, token: string, request: CourierBookingRequest) {
    const params = this.createServiceabilityParams(request);
    return getJson(`${urlFor(baseUrl, defaultServiceabilityEndpoint)}?${params.toString()}`, token);
  }

  private createServiceabilityParams(request: Pick<CourierBookingRequest, "sellerAddress" | "shippingAddress" | "paymentMethod" | "parcel">) {
    return new URLSearchParams({
      pickup_postcode: requiredText(request.sellerAddress.pincode, "seller pickup pincode"),
      delivery_postcode: requiredText(request.shippingAddress.pincode, "delivery pincode"),
      cod: request.paymentMethod === "COD" ? "1" : "0",
      weight: gramsToKg(request.parcel.weightGrams),
    });
  }

  private createBookingPayload(request: CourierBookingRequest) {
    const nameParts = splitName(request.shippingAddress.fullName ?? "Customer");
    const payload: ShiprocketJson = {
      order_id: request.shipmentNumber,
      order_date: request.orderDate.toISOString().slice(0, 10),
      pickup_location: request.pickupLocationName,
      billing_customer_name: nameParts.firstName,
      billing_last_name: nameParts.lastName,
      billing_address: requiredText(request.shippingAddress.line1, "delivery address line 1"),
      billing_address_2: compactText([request.shippingAddress.line2, request.shippingAddress.area]),
      billing_city: requiredText(request.shippingAddress.city, "delivery city"),
      billing_pincode: requiredText(request.shippingAddress.pincode, "delivery pincode"),
      billing_state: requiredText(request.shippingAddress.state, "delivery state"),
      billing_country: request.shippingAddress.country ?? "India",
      billing_email: request.shippingAddress.email ?? "orders@1handindia.com",
      billing_phone: requiredText(request.shippingAddress.phone, "delivery phone"),
      shipping_is_billing: true,
      order_items: request.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: paiseToRupees(item.unitPricePaise),
      })),
      payment_method: request.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: paiseToRupees(request.subtotalPaise),
      length: request.parcel.lengthCm,
      breadth: request.parcel.breadthCm,
      height: request.parcel.heightCm,
      weight: gramsToKg(request.parcel.weightGrams),
    };

    if (request.settings.accountCode) {
      payload.channel_id = numericOrText(request.settings.accountCode);
    }
    if (request.note) {
      payload.comment = request.note;
    }

    return payload;
  }

  private createPickupPayload(request: CourierPickupSyncRequest) {
    return {
      pickup_location: truncateText(
        requiredText(request.pickupLocationName, "pickup location name"),
        36,
      ),
      name: requiredText(request.sellerName, "seller pickup contact name"),
      email: requiredText(request.sellerEmail, "seller pickup email"),
      phone: normalizeShiprocketPhone(request.sellerPhone),
      address: truncateText(
        requiredText(request.sellerAddress.line1, "seller pickup address line 1"),
        80,
      ),
      address_2: compactText([request.sellerAddress.line2, request.sellerAddress.area]),
      city: requiredText(request.sellerAddress.city, "seller pickup city"),
      state: requiredText(request.sellerAddress.state, "seller pickup state"),
      country: request.sellerAddress.country ?? "India",
      pin_code: requiredText(request.sellerAddress.pincode, "seller pickup pincode"),
    } satisfies ShiprocketJson;
  }
}

async function postJson(url: string, payload: unknown, token?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(shiprocketRequestTimeoutMs),
  });
  return parseJsonResponse(response, url);
}

async function getJson(url: string, token: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: jsonHeaders(token),
    signal: AbortSignal.timeout(shiprocketRequestTimeoutMs),
  });
  return parseJsonResponse(response, url);
}

async function getJsonAllowNotFound(url: string, token: string): Promise<{ notFound: true } | { notFound: false; body: unknown }> {
  const response = await fetch(url, {
    method: "GET",
    headers: jsonHeaders(token),
    signal: AbortSignal.timeout(shiprocketRequestTimeoutMs),
  });
  if (response.status === 404) {
    return { notFound: true };
  }

  return { notFound: false, body: await parseJsonResponse(response, url) };
}

async function parseJsonResponse(response: Response, url: string) {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    throw new Error(`Shiprocket request failed (${response.status}) for ${url}: ${safeBodyMessage(body)}`);
  }

  return body;
}

function jsonHeaders(token?: string) {
  return {
    "content-type": "application/json",
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function urlFor(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function readText(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === "string" && current.trim()) {
    return current.trim();
  }
  if (typeof current === "number" && Number.isFinite(current)) {
    return String(current);
  }

  return null;
}

function readNumber(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === "number" && Number.isFinite(current)) {
    return current;
  }
  if (typeof current === "string" && current.trim()) {
    const parsed = Number(current);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readRecommendedCourierCompanyId(value: unknown) {
  const explicit =
    readText(value, ["data", "recommended_courier_company_id"]) ??
    readText(value, ["recommended_courier_company_id"]);
  if (explicit) {
    return explicit;
  }

  const data = objectAt(value, ["data"]);
  const companies = Array.isArray(data?.available_courier_companies)
    ? data.available_courier_companies
    : [];
  const company = companies.find((item) => item && typeof item === "object") as
    | Record<string, unknown>
    | undefined;
  if (!company) {
    return null;
  }

  return readText(company, ["courier_company_id"]) ?? readText(company, ["id"]);
}

function selectCourierCompany(value: unknown, preferredCourierCompanyId?: string | null) {
  const companies = readAvailableCourierCompanies(value);
  const preferred = preferredCourierCompanyId?.trim();
  if (preferred) {
    return (
      companies.find((company) => {
        const id = readText(company, ["courier_company_id"]) ?? readText(company, ["id"]);
        return id === preferred;
      }) ?? null
    );
  }

  const recommendedId = readRecommendedCourierCompanyId(value);
  if (recommendedId) {
    const recommended = companies.find((company) => {
      const id = readText(company, ["courier_company_id"]) ?? readText(company, ["id"]);
      return id === recommendedId;
    });
    if (recommended) {
      return recommended;
    }
  }

  return companies[0] ?? null;
}

function readAvailableCourierCompanies(value: unknown) {
  const data = objectAt(value, ["data"]);
  const companies = Array.isArray(data?.available_courier_companies)
    ? data.available_courier_companies
    : [];

  return companies.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function objectAt(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : null;
}

function requiredText(value: string | null | undefined, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Shiprocket request needs ${label}.`);
  }

  return trimmed;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Customer",
    lastName: parts.slice(1).join(" ") || ".",
  };
}

function compactText(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(", ");
}

function paiseToRupees(value: number) {
  return Number((value / 100).toFixed(2));
}

function rupeesToPaise(value: number | null) {
  return value === null ? null : Math.max(0, Math.round(value * 100));
}

function gramsToKg(value: number) {
  return Math.max(0.01, Number((value / 1000).toFixed(3))).toString();
}

function numericOrText(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : value;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

function normalizeShiprocketPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  if (normalized.length < 10) {
    throw new Error("Shiprocket request needs a 10 digit seller pickup phone.");
  }

  return normalized;
}

function safeBodyMessage(body: unknown) {
  if (!body || typeof body !== "object") {
    return String(body ?? "empty response");
  }

  try {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") {
      try {
        const nested = JSON.parse(record.message);
        if (nested && typeof nested === "object") {
          const messages = Object.values(nested).flat();
          if (messages.length > 0) {
            return messages.join(" ");
          }
        }
      } catch {
        // Not a JSON string
        return record.message;
      }
    }
    
    if (record.errors && typeof record.errors === "object") {
      const messages = Object.values(record.errors).flat();
      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch { /* ignore parse errors */ }

  return JSON.stringify(body).slice(0, 500);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isDuplicatePickupError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("already") ||
    message.includes("duplicate") ||
    message.includes("exists")
  );
}
