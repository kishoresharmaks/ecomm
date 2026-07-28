import { BadGatewayException, BadRequestException } from "@nestjs/common";

const POSTAL_PIN_BASE_URL = "https://api.postalpincode.in";
const POSTAL_PIN_PROVIDER = "api.postalpincode.in";
const INDIA_PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export type IndiaPostalLookupQuery = {
  pincode?: string | null;
  postOffice?: string | null;
};

export type IndiaPostalLookupType = "PINCODE" | "POST_OFFICE";

export type IndiaPostalLookupPostOffice = {
  name: string;
  branchType: string | null;
  deliveryStatus: string | null;
  circle: string | null;
  district: string | null;
  division: string | null;
  region: string | null;
  block: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  databaseMatch?: IndiaPostalStoredArea | null;
};

export type IndiaPostalStoredArea = {
  code: string;
  name: string;
  postalCode: string | null;
  cityName: string;
  cityCode: string;
  stateName: string;
  stateCode: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

export type IndiaPostalLookupComparisonStatus = "MATCHED" | "PARTIAL" | "NOT_IMPORTED" | "DATABASE_ONLY" | "NO_DATA";

export type IndiaPostalLookupComparison = {
  status: IndiaPostalLookupComparisonStatus;
  storedAreaCount: number;
  matchedPostOfficeCount: number;
  missingPostOfficeCount: number;
  extraStoredAreaCount: number;
  storedAreas: IndiaPostalStoredArea[];
  missingPostOffices: IndiaPostalLookupPostOffice[];
  extraStoredAreas: IndiaPostalStoredArea[];
};

export type IndiaPostalLookupResult = {
  provider: typeof POSTAL_PIN_PROVIDER;
  queryType: IndiaPostalLookupType;
  query: string;
  sourceUrl: string;
  status: "SUCCESS" | "NOT_FOUND";
  message: string;
  postOffices: IndiaPostalLookupPostOffice[];
  comparison?: IndiaPostalLookupComparison;
};

type PostalPinApiEnvelope = {
  Message?: string | number | null;
  Status?: string | number | null;
  PostOffice?: PostalPinApiPostOffice[] | null;
};

type PostalPinApiPostOffice = {
  Name?: string | number | null;
  BranchType?: string | number | null;
  DeliveryStatus?: string | number | null;
  Circle?: string | number | null;
  District?: string | number | null;
  Division?: string | number | null;
  Region?: string | number | null;
  Block?: string | number | null;
  State?: string | number | null;
  Country?: string | number | null;
  Pincode?: string | number | null;
};

type NormalizedLookupRequest = {
  queryType: IndiaPostalLookupType;
  query: string;
  sourceUrl: string;
};

export async function fetchIndiaPostalLookup(
  query: IndiaPostalLookupQuery,
  fetchImpl: typeof fetch = fetch
): Promise<IndiaPostalLookupResult> {
  const request = normalizeIndiaPostalLookupQuery(query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchImpl(request.sourceUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "1HandIndia location lookup"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new BadGatewayException("PostalPin lookup service is unavailable.");
    }

    const payload = (await response.json()) as unknown;
    return normalizePostalPinPayload(request, payload);
  } catch (error) {
    if (error instanceof BadGatewayException || error instanceof BadRequestException) {
      throw error;
    }

    throw new BadGatewayException("PostalPin lookup service is unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeIndiaPostalLookupQuery(query: IndiaPostalLookupQuery): NormalizedLookupRequest {
  const pincode = clean(query.pincode);
  const postOffice = clean(query.postOffice)?.replace(/\s+/g, " ") ?? null;

  if (pincode && postOffice) {
    throw new BadRequestException("Search by either pincode or post office name, not both.");
  }

  if (!pincode && !postOffice) {
    throw new BadRequestException("Enter an India pincode or post office name.");
  }

  if (pincode) {
    if (!INDIA_PINCODE_PATTERN.test(pincode)) {
      throw new BadRequestException("Enter a valid 6-digit India pincode.");
    }

    return {
      queryType: "PINCODE",
      query: pincode,
      sourceUrl: `${POSTAL_PIN_BASE_URL}/pincode/${pincode}`
    };
  }

  if (!postOffice || postOffice.length < 2) {
    throw new BadRequestException("Post office search must contain at least 2 characters.");
  }

  return {
    queryType: "POST_OFFICE",
    query: postOffice,
    sourceUrl: `${POSTAL_PIN_BASE_URL}/postoffice/${encodeURIComponent(postOffice)}`
  };
}

export function normalizePostalPinPayload(request: NormalizedLookupRequest, payload: unknown): IndiaPostalLookupResult {
  const envelope = Array.isArray(payload) ? (payload[0] as PostalPinApiEnvelope | undefined) : undefined;
  const sourceStatus = clean(envelope?.Status)?.toLowerCase() ?? "";
  const postOffices = Array.isArray(envelope?.PostOffice) ? envelope.PostOffice.map(mapPostOffice).filter((office) => office.name) : [];

  return {
    provider: POSTAL_PIN_PROVIDER,
    queryType: request.queryType,
    query: request.query,
    sourceUrl: request.sourceUrl,
    status: sourceStatus === "success" && postOffices.length ? "SUCCESS" : "NOT_FOUND",
    message: clean(envelope?.Message) ?? "No post offices found.",
    postOffices
  };
}

export function attachStoredIndiaPostalComparison(
  result: IndiaPostalLookupResult,
  storedAreas: IndiaPostalStoredArea[]
): IndiaPostalLookupResult {
  const usedStoredAreaCodes = new Set<string>();
  const postOffices = result.postOffices.map((office) => {
    const match = storedAreas.find((area) => {
      if (usedStoredAreaCodes.has(area.code)) {
        return false;
      }

      return area.postalCode === office.pincode && normalizePostalName(area.name) === normalizePostalName(office.name);
    });

    if (match) {
      usedStoredAreaCodes.add(match.code);
    }

    return {
      ...office,
      databaseMatch: match ?? null
    };
  });
  const missingPostOffices = postOffices.filter((office) => !office.databaseMatch);
  const extraStoredAreas = storedAreas.filter((area) => !usedStoredAreaCodes.has(area.code));

  return {
    ...result,
    postOffices,
    comparison: {
      status: comparisonStatus(postOffices.length, storedAreas.length, missingPostOffices.length, extraStoredAreas.length),
      storedAreaCount: storedAreas.length,
      matchedPostOfficeCount: postOffices.length - missingPostOffices.length,
      missingPostOfficeCount: missingPostOffices.length,
      extraStoredAreaCount: extraStoredAreas.length,
      storedAreas,
      missingPostOffices,
      extraStoredAreas
    }
  };
}

function mapPostOffice(office: PostalPinApiPostOffice): IndiaPostalLookupPostOffice {
  return {
    name: clean(office.Name) ?? "",
    branchType: clean(office.BranchType),
    deliveryStatus: clean(office.DeliveryStatus),
    circle: clean(office.Circle),
    district: clean(office.District),
    division: clean(office.Division),
    region: clean(office.Region),
    block: clean(office.Block),
    state: clean(office.State),
    country: clean(office.Country),
    pincode: clean(office.Pincode)
  };
}

function clean(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function comparisonStatus(postOfficeCount: number, storedAreaCount: number, missingCount: number, extraCount: number): IndiaPostalLookupComparisonStatus {
  if (!postOfficeCount && !storedAreaCount) {
    return "NO_DATA";
  }

  if (!storedAreaCount) {
    return "NOT_IMPORTED";
  }

  if (!postOfficeCount) {
    return "DATABASE_ONLY";
  }

  return missingCount === 0 && extraCount === 0 ? "MATCHED" : "PARTIAL";
}

function normalizePostalName(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+(B\.O|S\.O|H\.O|G\.P\.O|M\.D\.G|D\.O)$/i, "")
    .replace(/\s+(BO|SO|HO|GPO|MDG|DO)$/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
