import { createHash } from "node:crypto";
import { LocationImportSourceType } from "@indihub/database";
import { bundledLocationDataset } from "./bundled-location-data";
import type {
  LocationAreaInput,
  LocationCityInput,
  LocationCountryInput,
  LocationImportDataset,
  LocationImportSourceInput,
  LocationSubdivisionInput
} from "./location-importer";

export const INDIA_PINCODE_RESOURCE_ID = "5c2f62fe-5afa-4119-a499-fec9d604d5bd";
export const INDIA_PINCODE_SOURCE_URL = `https://api.data.gov.in/resource/${INDIA_PINCODE_RESOURCE_ID}`;
export const INDIA_PINCODE_CATALOG_URL = "https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month";

export type IndiaPincodeRecord = {
  officename?: string | number | null;
  pincode?: string | number | null;
  district?: string | number | null;
  statename?: string | number | null;
};

export type IndiaPincodeDatasetBuildResult = {
  dataset: LocationImportDataset;
  acceptedRows: number;
  skippedRows: number;
  cityCount: number;
  areaCount: number;
};

export function parseIndiaPincodeCsv(csv: string): IndiaPincodeRecord[] {
  const rows = parseCsv(csv);
  const [header, ...records] = rows;

  if (!header?.length) {
    throw new Error("India pincode CSV is empty.");
  }

  const columnIndex = new Map(header.map((column, index) => [normalizeHeader(column), index]));

  return records.map((row) => ({
    officename: cell(row, columnIndex, "officename"),
    pincode: cell(row, columnIndex, "pincode"),
    district: cell(row, columnIndex, "district") || cell(row, columnIndex, "districtname"),
    statename: cell(row, columnIndex, "statename")
  }));
}

const indiaCountryInput = bundledLocationDataset.countries.find((country) => country.code === "IN");

if (!indiaCountryInput) {
  throw new Error("Bundled location baseline does not include India.");
}

const indiaCountry: LocationCountryInput = indiaCountryInput;
const indiaSubdivisions = indiaCountry.subdivisions ?? [];

const stateAliases: Record<string, string> = {
  "A AND N ISLANDS": "ANDAMAN AND NICOBAR ISLANDS",
  "ANDAMAN AND NICOBAR": "ANDAMAN AND NICOBAR ISLANDS",
  CHATTISGARH: "CHHATTISGARH",
  "DADRA AND NAGAR HAVELI": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "DAMAN AND DIU": "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
  "NCT OF DELHI": "DELHI",
  "NATIONAL CAPITAL TERRITORY OF DELHI": "DELHI",
  ORISSA: "ODISHA",
  PONDICHERRY: "PUDUCHERRY",
  UTTARANCHAL: "UTTARAKHAND"
};

const manualCityCodeAliases: Record<string, string> = {
  "IN-KA|BANGALORE": "IN-KA-BLR",
  "IN-KA|BENGALURU": "IN-KA-BLR",
  "IN-KA|BENGALURU URBAN": "IN-KA-BLR",
  "IN-TN|CHENNAI": "IN-TN-CHN",
  "IN-TN|COIMBATORE": "IN-TN-CBE"
};

const districtStateOverrides: Record<string, string> = {
  "ANDHRA PRADESH|ADILABAD": "IN-TG",
  "ANDHRA PRADESH|HYDERABAD": "IN-TG",
  "ANDHRA PRADESH|KARIM NAGAR": "IN-TG",
  "ANDHRA PRADESH|KARIMNAGAR": "IN-TG",
  "ANDHRA PRADESH|KHAMMAM": "IN-TG",
  "ANDHRA PRADESH|MAHBUBNAGAR": "IN-TG",
  "ANDHRA PRADESH|MAHABUBNAGAR": "IN-TG",
  "ANDHRA PRADESH|MEDAK": "IN-TG",
  "ANDHRA PRADESH|NALGONDA": "IN-TG",
  "ANDHRA PRADESH|NIZAMABAD": "IN-TG",
  "ANDHRA PRADESH|RANGA REDDY": "IN-TG",
  "ANDHRA PRADESH|RANGAREDDY": "IN-TG",
  "ANDHRA PRADESH|WARANGAL": "IN-TG",
  "JAMMU AND KASHMIR|KARGIL": "IN-LA",
  "JAMMU AND KASHMIR|LEH": "IN-LA"
};

export function buildIndiaPincodeDataset(
  records: IndiaPincodeRecord[],
  source: Partial<LocationImportSourceInput> = {}
): IndiaPincodeDatasetBuildResult {
  const stateByName = buildStateLookup();
  const stateByCode = new Map(indiaSubdivisions.map((subdivision) => [subdivision.code, subdivision]));
  const cityCodeAliases = buildCityCodeAliases();
  const country = createIndiaCountry();
  const subdivisionByCode = new Map((country.subdivisions ?? []).map((subdivision) => [subdivision.code, subdivision]));
  const cityMaps = new Map<string, Map<string, LocationCityInput>>();
  const areaMaps = new Map<string, Map<string, LocationAreaInput>>();
  let acceptedRows = 0;
  let skippedRows = 0;

  for (const record of records) {
    const pincode = cleanPincode(record.pincode);
    const officeName = cleanString(record.officename);
    const district = cleanString(record.district);
    const stateName = cleanString(record.statename);

    if (!pincode || !officeName || !district || !stateName) {
      skippedRows += 1;
      continue;
    }

    const overrideStateCode = districtStateOverrides[`${normalizeStateName(stateName)}|${normalizeLookup(district)}`];
    const subdivision = overrideStateCode ? stateByCode.get(overrideStateCode) : stateByName.get(normalizeStateName(stateName));
    if (!subdivision) {
      skippedRows += 1;
      continue;
    }

    const targetSubdivision = subdivisionByCode.get(subdivision.code);
    if (!targetSubdivision) {
      skippedRows += 1;
      continue;
    }

    const districtLookup = normalizeLookup(district);
    const cityCode = cityCodeAliases.get(`${subdivision.code}|${districtLookup}`) ?? createCityCode(subdivision.code, district);
    const cityMap = ensureCityMap(cityMaps, subdivision.code);
    const city = upsertByCode(cityMap, cityCode, () => ({
      code: cityCode,
      name: displayName(district),
      sourceRecordId: `${subdivision.code}|${districtLookup}`,
      areas: []
    }));

    if (!targetSubdivision.cities?.some((item) => item.code === city.code)) {
      targetSubdivision.cities ??= [];
      targetSubdivision.cities.push(city);
    }

    const areaCode = createAreaCode(pincode, subdivision.code, district, officeName);
    const area: LocationAreaInput = {
      code: areaCode,
      name: displayName(cleanOfficeName(officeName)),
      postalCode: pincode,
      sourceRecordId: [subdivision.code, districtLookup, pincode, normalizeLookup(officeName)].join("|")
    };
    upsertByCode(ensureAreaMap(areaMaps, city.code), areaCode, () => {
      city.areas ??= [];
      city.areas.push(area);
      return area;
    });
    acceptedRows += 1;
  }

  sortLocationHierarchy(country);

  const areaCount =
    country.subdivisions?.reduce(
      (stateTotal, subdivision) =>
        stateTotal +
        (subdivision.cities?.reduce((cityTotal, city) => cityTotal + (city.areas?.length ?? 0), 0) ?? 0),
      0
    ) ?? 0;
  const cityCount = country.subdivisions?.reduce((total, subdivision) => total + (subdivision.cities?.length ?? 0), 0) ?? 0;

  return {
    dataset: {
      source: {
        code: "INDIA_OGD_PINCODES",
        name: "India pincode directory",
        provider: "Department of Posts / data.gov.in",
        sourceType: LocationImportSourceType.OGD_API,
        countryCode: "IN",
        sourceUrl: INDIA_PINCODE_CATALOG_URL,
        licenseNote: "Government Open Data License - India",
        ...source
      },
      countries: [country],
      skippedRows,
      metadata: {
        acceptedRows,
        sourceResourceId: INDIA_PINCODE_RESOURCE_ID,
        hierarchyMapping: "State/UT -> district as city node -> post office as local area"
      }
    },
    acceptedRows,
    skippedRows,
    cityCount,
    areaCount
  };
}

function createIndiaCountry(): LocationCountryInput {
  return {
    code: indiaCountry.code,
    name: indiaCountry.name,
    currency: indiaCountry.currency,
    locale: indiaCountry.locale,
    phoneCode: indiaCountry.phoneCode,
    postalCodeLabel: indiaCountry.postalCodeLabel,
    postalCodePattern: indiaCountry.postalCodePattern ?? null,
    sortOrder: indiaCountry.sortOrder ?? 0,
    subdivisions: indiaSubdivisions.map((subdivision) => ({
      code: subdivision.code,
      name: subdivision.name,
      type: subdivision.type ?? "State",
      sourceRecordId: subdivision.code,
      sortOrder: subdivision.sortOrder ?? 0,
      cities: []
    }))
  };
}

function buildStateLookup() {
  const lookup = new Map<string, LocationSubdivisionInput>();

  for (const subdivision of indiaSubdivisions) {
    const normalizedName = normalizeStateName(subdivision.name);
    lookup.set(normalizedName, subdivision);
  }

  for (const [alias, canonical] of Object.entries(stateAliases)) {
    const subdivision = lookup.get(canonical);
    if (subdivision) {
      lookup.set(alias, subdivision);
    }
  }

  return lookup;
}

function buildCityCodeAliases() {
  const aliases = new Map<string, string>();

  for (const subdivision of indiaSubdivisions) {
    for (const city of subdivision.cities ?? []) {
      aliases.set(`${subdivision.code}|${normalizeLookup(city.name)}`, city.code);
    }
  }

  for (const [key, value] of Object.entries(manualCityCodeAliases)) {
    aliases.set(key, value);
  }

  return aliases;
}

function ensureCityMap(cityMaps: Map<string, Map<string, LocationCityInput>>, subdivisionCode: string) {
  const existing = cityMaps.get(subdivisionCode);
  if (existing) {
    return existing;
  }

  const cityMap = new Map<string, LocationCityInput>();
  cityMaps.set(subdivisionCode, cityMap);
  return cityMap;
}

function ensureAreaMap(areaMaps: Map<string, Map<string, LocationAreaInput>>, cityCode: string) {
  const existing = areaMaps.get(cityCode);
  if (existing) {
    return existing;
  }

  const areaMap = new Map<string, LocationAreaInput>();
  areaMaps.set(cityCode, areaMap);
  return areaMap;
}

function upsertByCode<T extends { code: string }>(items: Map<string, T>, code: string, create: () => T) {
  const existing = items.get(code);
  if (existing) {
    return existing;
  }

  const item = create();
  items.set(code, item);
  return item;
}

function sortLocationHierarchy(country: LocationCountryInput) {
  for (const subdivision of country.subdivisions ?? []) {
    subdivision.cities = (subdivision.cities ?? []).sort((left, right) => left.name.localeCompare(right.name));
    subdivision.cities.forEach((city, cityIndex) => {
      city.sortOrder = (cityIndex + 1) * 10;
      city.areas = (city.areas ?? []).sort((left, right) => {
        const postalCompare = (left.postalCode ?? "").localeCompare(right.postalCode ?? "");
        return postalCompare || left.name.localeCompare(right.name);
      });
      city.areas.forEach((area, areaIndex) => {
        area.sortOrder = (areaIndex + 1) * 10;
      });
    });
  }
}

function createCityCode(stateCode: string, district: string) {
  return limitedCode(stateCode, district, 48);
}

function createAreaCode(pincode: string, stateCode: string, district: string, officeName: string) {
  return `PIN-${pincode}-${shortHash([stateCode, district, officeName, pincode].join("|"), 8)}`;
}

function limitedCode(prefix: string, value: string, maxLength: number) {
  const slug = slugCode(value) || "LOCATION";
  const full = `${prefix}-${slug}`;

  if (full.length <= maxLength) {
    return full;
  }

  const hash = shortHash(full, 6);
  const available = Math.max(maxLength - prefix.length - hash.length - 2, 1);
  return `${prefix}-${slug.slice(0, available).replace(/-+$/g, "")}-${hash}`;
}

function slugCode(value: string) {
  return normalizeLookup(value).replace(/\s+/g, "-").replace(/-+/g, "-");
}

function shortHash(value: string, length: number) {
  return createHash("sha1").update(value).digest("hex").slice(0, length).toUpperCase();
}

function normalizeStateName(value: string) {
  const normalized = normalizeLookup(value);
  return stateAliases[normalized] ?? normalized;
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPincode(value: string | number | null | undefined) {
  const cleaned = cleanString(value).replace(/\.0$/g, "");
  return /^[1-9][0-9]{5}$/.test(cleaned) ? cleaned : "";
}

function cleanString(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function cleanOfficeName(value: string) {
  return value
    .replace(/\s+(B\.O|S\.O|H\.O|G\.P\.O|M\.D\.G|D\.O)$/i, "")
    .replace(/\s+(BO|SO|HO|GPO|MDG|DO)$/i, "")
    .trim();
}

function displayName(value: string) {
  const cleaned = value.toLowerCase().replace(/\s+/g, " ").trim();
  return cleaned.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cellValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cellValue);
      cellValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cellValue);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cellValue = "";
      continue;
    }

    cellValue += char;
  }

  row.push(cellValue);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function cell(row: string[], columnIndex: Map<string, number>, column: string) {
  const index = columnIndex.get(column);
  if (index === undefined) {
    return "";
  }

  return row[index]?.trim() ?? "";
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
