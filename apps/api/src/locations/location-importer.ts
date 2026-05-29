import { createHash } from "node:crypto";
import {
  LocationImportMode,
  LocationImportSourceType,
  LocationImportStatus,
  type PrismaClient
} from "@indihub/database";

export type LocationImportSourceInput = {
  code: string;
  name: string;
  provider: string;
  sourceType: LocationImportSourceType;
  countryCode?: string | null;
  sourceUrl?: string | null;
  licenseNote?: string | null;
};

export type LocationAreaInput = {
  code: string;
  name: string;
  postalCode?: string | null;
  sourceRecordId?: string | null;
  sortOrder?: number;
};

export type LocationCityInput = {
  code: string;
  name: string;
  sourceRecordId?: string | null;
  sortOrder?: number;
  areas?: LocationAreaInput[];
};

export type LocationSubdivisionInput = {
  code: string;
  name: string;
  type?: string;
  sourceRecordId?: string | null;
  sortOrder?: number;
  cities?: LocationCityInput[];
};

export type LocationCountryInput = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  phoneCode: string;
  postalCodeLabel: string;
  postalCodePattern?: string | null;
  enabled?: boolean;
  sortOrder?: number;
  subdivisions?: LocationSubdivisionInput[];
};

export type LocationImportDataset = {
  source: LocationImportSourceInput;
  countries: LocationCountryInput[];
  skippedRows?: number;
  metadata?: Record<string, unknown>;
};

type NormalizedLocationImportSource = {
  code: string;
  name: string;
  provider: string;
  sourceType: LocationImportSourceType;
  countryCode: string | null;
  sourceUrl: string | null;
  licenseNote: string | null;
};

export type LocationImportResult = {
  runId: string;
  status: LocationImportStatus;
  importedCountries: number;
  importedSubdivisions: number;
  importedCities: number;
  importedAreas: number;
  skippedRows: number;
};

const defaultCountryConfig: Record<string, Omit<LocationCountryInput, "code" | "name"> & { name: string }> = {
  IN: {
    name: "India",
    currency: "INR",
    locale: "en-IN",
    phoneCode: "+91",
    postalCodeLabel: "Pincode",
    postalCodePattern: "^[1-9][0-9]{5}$",
    sortOrder: 1
  },
  AE: {
    name: "United Arab Emirates",
    currency: "AED",
    locale: "en-AE",
    phoneCode: "+971",
    postalCodeLabel: "Postal code",
    postalCodePattern: "^[A-Za-z0-9 -]{0,12}$",
    sortOrder: 2
  },
  US: {
    name: "United States",
    currency: "USD",
    locale: "en-US",
    phoneCode: "+1",
    postalCodeLabel: "ZIP code",
    postalCodePattern: "^\\d{5}(-\\d{4})?$",
    sortOrder: 3
  },
  GB: {
    name: "United Kingdom",
    currency: "GBP",
    locale: "en-GB",
    phoneCode: "+44",
    postalCodeLabel: "Postcode",
    postalCodePattern: "^[A-Za-z0-9 ]{5,8}$",
    sortOrder: 4
  },
  SG: {
    name: "Singapore",
    currency: "SGD",
    locale: "en-SG",
    phoneCode: "+65",
    postalCodeLabel: "Postal code",
    postalCodePattern: "^\\d{6}$",
    sortOrder: 5
  }
};

export async function importLocationDataset(
  prisma: PrismaClient,
  dataset: LocationImportDataset,
  mode: LocationImportMode = LocationImportMode.IMPORT
): Promise<LocationImportResult> {
  const normalizedSource = normalizeSource(dataset.source);
  const source = await prisma.locationImportSource.upsert({
    where: { code: normalizedSource.code },
    update: {
      name: normalizedSource.name,
      provider: normalizedSource.provider,
      sourceType: normalizedSource.sourceType,
      countryCode: normalizedSource.countryCode,
      sourceUrl: normalizedSource.sourceUrl,
      licenseNote: normalizedSource.licenseNote,
      enabled: true
    },
    create: {
      code: normalizedSource.code,
      name: normalizedSource.name,
      provider: normalizedSource.provider,
      sourceType: normalizedSource.sourceType,
      countryCode: normalizedSource.countryCode,
      sourceUrl: normalizedSource.sourceUrl,
      licenseNote: normalizedSource.licenseNote,
      enabled: true
    }
  });

  const checksum = hashDataset(dataset);
  const run = await prisma.locationImportRun.create({
    data: {
      sourceId: source.id,
      mode,
      status: LocationImportStatus.RUNNING,
      countryCode: normalizedSource.countryCode,
      sourceUrl: normalizedSource.sourceUrl,
      sourceChecksum: checksum,
      metadata: {
        datasetCountries: dataset.countries.map((country) => normalizeCode(country.code)),
        importer: "indihub-location-importer-v1",
        ...(dataset.metadata ?? {})
      }
    }
  });

  const result: LocationImportResult = {
    runId: run.id,
    status: LocationImportStatus.RUNNING,
    importedCountries: 0,
    importedSubdivisions: 0,
    importedCities: 0,
    importedAreas: 0,
    skippedRows: dataset.skippedRows ?? 0
  };

  try {
    for (const countryInput of dataset.countries) {
      const countryCode = normalizeCode(countryInput.code);
      const country = await prisma.locationCountry.upsert({
        where: { code: countryCode },
        update: {
          name: cleanRequired(countryInput.name),
          currency: cleanRequired(countryInput.currency).toUpperCase(),
          locale: cleanRequired(countryInput.locale),
          phoneCode: cleanRequired(countryInput.phoneCode),
          postalCodeLabel: cleanRequired(countryInput.postalCodeLabel),
          postalCodePattern: cleanOptional(countryInput.postalCodePattern),
          enabled: countryInput.enabled ?? true,
          sortOrder: countryInput.sortOrder ?? 0
        },
        create: {
          code: countryCode,
          name: cleanRequired(countryInput.name),
          currency: cleanRequired(countryInput.currency).toUpperCase(),
          locale: cleanRequired(countryInput.locale),
          phoneCode: cleanRequired(countryInput.phoneCode),
          postalCodeLabel: cleanRequired(countryInput.postalCodeLabel),
          postalCodePattern: cleanOptional(countryInput.postalCodePattern),
          enabled: countryInput.enabled ?? true,
          sortOrder: countryInput.sortOrder ?? 0
        }
      });
      result.importedCountries += 1;

      if (mode === LocationImportMode.REFRESH) {
        await markExistingSourceRowsInactive(prisma, country.id, normalizedSource.code);
      }

      for (const subdivisionInput of countryInput.subdivisions ?? []) {
        const subdivisionCode = normalizeCode(subdivisionInput.code);
        const subdivision = await prisma.locationSubdivision.upsert({
          where: {
            countryId_code: {
              countryId: country.id,
              code: subdivisionCode
            }
          },
          update: {
            name: cleanRequired(subdivisionInput.name),
            type: cleanOptional(subdivisionInput.type) ?? "State",
            active: true,
            source: normalizedSource.code,
            sourceRecordId: cleanOptional(subdivisionInput.sourceRecordId) ?? subdivisionCode,
            sortOrder: subdivisionInput.sortOrder ?? 0
          },
          create: {
            countryId: country.id,
            code: subdivisionCode,
            name: cleanRequired(subdivisionInput.name),
            type: cleanOptional(subdivisionInput.type) ?? "State",
            active: true,
            source: normalizedSource.code,
            sourceRecordId: cleanOptional(subdivisionInput.sourceRecordId) ?? subdivisionCode,
            sortOrder: subdivisionInput.sortOrder ?? 0
          }
        });
        result.importedSubdivisions += 1;

        for (const cityInput of subdivisionInput.cities ?? []) {
          const cityCode = normalizeCode(cityInput.code);
          const city = await prisma.locationCity.upsert({
            where: {
              subdivisionId_code: {
                subdivisionId: subdivision.id,
                code: cityCode
              }
            },
            update: {
              name: cleanRequired(cityInput.name),
              active: true,
              source: normalizedSource.code,
              sourceRecordId: cleanOptional(cityInput.sourceRecordId) ?? cityCode,
              sortOrder: cityInput.sortOrder ?? 0
            },
            create: {
              subdivisionId: subdivision.id,
              code: cityCode,
              name: cleanRequired(cityInput.name),
              active: true,
              source: normalizedSource.code,
              sourceRecordId: cleanOptional(cityInput.sourceRecordId) ?? cityCode,
              sortOrder: cityInput.sortOrder ?? 0
            }
          });
          result.importedCities += 1;

          for (const areaInput of cityInput.areas ?? []) {
            const areaCode = normalizeCode(areaInput.code);
            await prisma.locationArea.upsert({
              where: {
                cityId_code: {
                  cityId: city.id,
                  code: areaCode
                }
              },
              update: {
                name: cleanRequired(areaInput.name),
                postalCode: cleanOptional(areaInput.postalCode),
                active: true,
                source: normalizedSource.code,
                sourceRecordId: cleanOptional(areaInput.sourceRecordId) ?? areaCode,
                sortOrder: areaInput.sortOrder ?? 0
              },
              create: {
                cityId: city.id,
                code: areaCode,
                name: cleanRequired(areaInput.name),
                postalCode: cleanOptional(areaInput.postalCode),
                active: true,
                source: normalizedSource.code,
                sourceRecordId: cleanOptional(areaInput.sourceRecordId) ?? areaCode,
                sortOrder: areaInput.sortOrder ?? 0
              }
            });
            result.importedAreas += 1;
          }
        }
      }
    }

    result.status =
      result.skippedRows > 0 ? LocationImportStatus.COMPLETED_WITH_WARNINGS : LocationImportStatus.COMPLETED;
    await prisma.locationImportRun.update({
      where: { id: run.id },
      data: {
        status: result.status,
        importedCountries: result.importedCountries,
        importedSubdivisions: result.importedSubdivisions,
        importedCities: result.importedCities,
        importedAreas: result.importedAreas,
        skippedRows: result.skippedRows,
        finishedAt: new Date()
      }
    });
    await prisma.locationImportSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date() }
    });

    return result;
  } catch (error) {
    await prisma.locationImportRun.update({
      where: { id: run.id },
      data: {
        status: LocationImportStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Location import failed.",
        importedCountries: result.importedCountries,
        importedSubdivisions: result.importedSubdivisions,
        importedCities: result.importedCities,
        importedAreas: result.importedAreas,
        skippedRows: result.skippedRows,
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

export function parseNormalizedLocationCsv(csv: string, source: LocationImportSourceInput): LocationImportDataset {
  const rows = parseCsv(csv);
  const [header, ...records] = rows;

  if (!header?.length) {
    throw new Error("Location CSV is empty.");
  }

  const columnIndex = new Map(header.map((column, index) => [column.trim().toLowerCase(), index]));
  const requiredColumns = ["country_code", "subdivision_code", "city_code"];

  for (const column of requiredColumns) {
    if (!columnIndex.has(column)) {
      throw new Error(`Location CSV is missing required column ${column}.`);
    }
  }

  const countries = new Map<string, LocationCountryInput>();

  for (const row of records) {
    const countryCode = normalizeCode(cell(row, columnIndex, "country_code"));
    const subdivisionCode = normalizeCode(cell(row, columnIndex, "subdivision_code"));
    const cityCode = normalizeCode(cell(row, columnIndex, "city_code"));

    if (!countryCode || !subdivisionCode || !cityCode) {
      continue;
    }

    const defaults = defaultCountryConfig[countryCode];
    const country =
      countries.get(countryCode) ??
      createCountryFromCsv(countryCode, row, columnIndex, defaults);
    countries.set(countryCode, country);

    const subdivision = upsertNested(
      country.subdivisions ??= [],
      subdivisionCode,
      () => ({
        code: subdivisionCode,
        name: cell(row, columnIndex, "subdivision_name") || subdivisionCode,
        type: cell(row, columnIndex, "subdivision_type") || "State",
        sourceRecordId: cell(row, columnIndex, "subdivision_source_id") || subdivisionCode,
        cities: []
      })
    );

    const city = upsertNested(
      subdivision.cities ??= [],
      cityCode,
      () => ({
        code: cityCode,
        name: cell(row, columnIndex, "city_name") || cityCode,
        sourceRecordId: cell(row, columnIndex, "city_source_id") || cityCode,
        areas: []
      })
    );

    const areaCode = normalizeCode(cell(row, columnIndex, "area_code"));
    const areaName = cell(row, columnIndex, "area_name");

    if (areaCode && areaName) {
      upsertNested(
        city.areas ??= [],
        areaCode,
        () => ({
          code: areaCode,
          name: areaName,
          postalCode: cell(row, columnIndex, "postal_code") || null,
          sourceRecordId: cell(row, columnIndex, "area_source_id") || areaCode
        })
      );
    }
  }

  return {
    source: normalizeSource(source),
    countries: Array.from(countries.values())
  };
}

function createCountryFromCsv(
  countryCode: string,
  row: string[],
  columnIndex: Map<string, number>,
  defaults: (Omit<LocationCountryInput, "code" | "name"> & { name: string }) | undefined
): LocationCountryInput {
  return {
    code: countryCode,
    name: cell(row, columnIndex, "country_name") || defaults?.name || countryCode,
    currency: cell(row, columnIndex, "currency") || defaults?.currency || "INR",
    locale: cell(row, columnIndex, "locale") || defaults?.locale || "en",
    phoneCode: cell(row, columnIndex, "phone_code") || defaults?.phoneCode || "",
    postalCodeLabel: cell(row, columnIndex, "postal_code_label") || defaults?.postalCodeLabel || "Postal code",
    postalCodePattern: cell(row, columnIndex, "postal_code_pattern") || defaults?.postalCodePattern || null,
    enabled: true,
    sortOrder: Number(cell(row, columnIndex, "country_sort_order") || defaults?.sortOrder || 0),
    subdivisions: []
  };
}

function upsertNested<T extends { code: string }>(items: T[], code: string, create: () => T) {
  const existing = items.find((item) => normalizeCode(item.code) === code);
  if (existing) {
    return existing;
  }

  const item = create();
  items.push(item);
  return item;
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

async function markExistingSourceRowsInactive(
  prisma: PrismaClient,
  countryId: string,
  sourceCode: string
) {
  await prisma.locationArea.updateMany({
    where: {
      source: sourceCode,
      city: { subdivision: { countryId } }
    },
    data: { active: false }
  });
  await prisma.locationCity.updateMany({
    where: {
      source: sourceCode,
      subdivision: { countryId }
    },
    data: { active: false }
  });
  await prisma.locationSubdivision.updateMany({
    where: {
      source: sourceCode,
      countryId
    },
    data: { active: false }
  });
}

function normalizeSource(source: LocationImportSourceInput): NormalizedLocationImportSource {
  return {
    code: normalizeCode(source.code),
    name: cleanRequired(source.name),
    provider: cleanRequired(source.provider),
    sourceType: source.sourceType,
    countryCode: cleanOptional(source.countryCode)?.toUpperCase() ?? null,
    sourceUrl: cleanOptional(source.sourceUrl),
    licenseNote: cleanOptional(source.licenseNote)
  };
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function cleanRequired(value: string) {
  const cleaned = cleanOptional(value);
  if (!cleaned) {
    throw new Error("Location import contains a required empty value.");
  }

  return cleaned;
}

function cleanOptional(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hashDataset(dataset: LocationImportDataset) {
  return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}
