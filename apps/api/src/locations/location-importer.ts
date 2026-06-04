import { createHash } from "node:crypto";
import {
  LocationImportMode,
  LocationImportSourceType,
  LocationImportStatus,
  Prisma,
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
  metadata?: Record<string, unknown> | null;
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

export type LocationImportBulkOptions = {
  batchSize?: number;
};

type LocationImportStagingRow = {
  rowNumber: number;
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  phoneCode: string;
  postalCodeLabel: string;
  postalCodePattern: string | null;
  countryEnabled: boolean;
  countrySortOrder: number;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  subdivisionType: string | null;
  subdivisionSourceRecordId: string | null;
  subdivisionSortOrder: number | null;
  cityCode: string | null;
  cityName: string | null;
  citySourceRecordId: string | null;
  citySortOrder: number | null;
  areaCode: string | null;
  areaName: string | null;
  areaPostalCode: string | null;
  areaSourceRecordId: string | null;
  areaMetadataJson: string | null;
  areaSortOrder: number | null;
};

type LocationImportBulkPayload = {
  rows: LocationImportStagingRow[];
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
            const metadata = cleanMetadata(areaInput.metadata);
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
                ...(metadata !== undefined ? { metadata } : {}),
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
                ...(metadata !== undefined ? { metadata } : {}),
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

export async function importLocationDatasetBulk(
  prisma: PrismaClient,
  dataset: LocationImportDataset,
  mode: LocationImportMode = LocationImportMode.IMPORT,
  options: LocationImportBulkOptions = {}
): Promise<LocationImportResult> {
  const normalizedSource = normalizeSource(dataset.source);
  const bulkPayload = flattenLocationDatasetForBulkImport(dataset);
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
        importer: "indihub-location-importer-bulk-v1",
        stagedRows: bulkPayload.rows.length,
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
    skippedRows: bulkPayload.skippedRows
  };

  try {
    await ensureLocationImportStagingTable(prisma);
    await clearLocationImportStagingRows(prisma, run.id);
    await insertLocationImportStagingRows(prisma, run.id, bulkPayload.rows, options.batchSize);
    await upsertCountriesFromStaging(prisma, run.id);

    if (mode === LocationImportMode.REFRESH) {
      await markExistingSourceRowsInactiveFromStaging(prisma, run.id, normalizedSource.code);
    }

    await upsertSubdivisionsFromStaging(prisma, run.id, normalizedSource.code);
    await upsertCitiesFromStaging(prisma, run.id, normalizedSource.code);
    await upsertAreasFromStaging(prisma, run.id, normalizedSource.code);

    result.importedCountries = bulkPayload.importedCountries;
    result.importedSubdivisions = bulkPayload.importedSubdivisions;
    result.importedCities = bulkPayload.importedCities;
    result.importedAreas = bulkPayload.importedAreas;
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
    await markLocationImportRunFailed(prisma, run.id, result, error);
    throw error;
  } finally {
    await clearLocationImportStagingRowsBestEffort(prisma, run.id);
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

function flattenLocationDatasetForBulkImport(dataset: LocationImportDataset): LocationImportBulkPayload {
  const rows: LocationImportStagingRow[] = [];
  const countries = new Set<string>();
  const subdivisions = new Set<string>();
  const cities = new Set<string>();
  const areas = new Set<string>();

  for (const countryInput of dataset.countries) {
    const country = normalizeCountryForStaging(countryInput);
    countries.add(country.countryCode);

    if (!countryInput.subdivisions?.length) {
      rows.push(createLocationStagingRow(rows.length + 1, country));
      continue;
    }

    for (const subdivisionInput of countryInput.subdivisions) {
      const subdivision = normalizeSubdivisionForStaging(subdivisionInput);
      subdivisions.add(`${country.countryCode}|${subdivision.subdivisionCode}`);

      if (!subdivisionInput.cities?.length) {
        rows.push(createLocationStagingRow(rows.length + 1, country, subdivision));
        continue;
      }

      for (const cityInput of subdivisionInput.cities) {
        const city = normalizeCityForStaging(cityInput);
        cities.add(`${country.countryCode}|${subdivision.subdivisionCode}|${city.cityCode}`);

        if (!cityInput.areas?.length) {
          rows.push(createLocationStagingRow(rows.length + 1, country, subdivision, city));
          continue;
        }

        for (const areaInput of cityInput.areas) {
          const area = normalizeAreaForStaging(areaInput);
          areas.add(`${country.countryCode}|${subdivision.subdivisionCode}|${city.cityCode}|${area.areaCode}`);
          rows.push(createLocationStagingRow(rows.length + 1, country, subdivision, city, area));
        }
      }
    }
  }

  return {
    rows,
    importedCountries: countries.size,
    importedSubdivisions: subdivisions.size,
    importedCities: cities.size,
    importedAreas: areas.size,
    skippedRows: dataset.skippedRows ?? 0
  };
}

function normalizeCountryForStaging(countryInput: LocationCountryInput) {
  const countryCode = normalizeCode(countryInput.code);

  return {
    countryCode,
    countryName: cleanRequired(countryInput.name),
    currency: cleanRequired(countryInput.currency).toUpperCase(),
    locale: cleanRequired(countryInput.locale),
    phoneCode: cleanRequired(countryInput.phoneCode),
    postalCodeLabel: cleanRequired(countryInput.postalCodeLabel),
    postalCodePattern: cleanOptional(countryInput.postalCodePattern),
    countryEnabled: countryInput.enabled ?? true,
    countrySortOrder: countryInput.sortOrder ?? 0
  };
}

function normalizeSubdivisionForStaging(subdivisionInput: LocationSubdivisionInput) {
  const subdivisionCode = normalizeCode(subdivisionInput.code);

  return {
    subdivisionCode,
    subdivisionName: cleanRequired(subdivisionInput.name),
    subdivisionType: cleanOptional(subdivisionInput.type) ?? "State",
    subdivisionSourceRecordId: cleanOptional(subdivisionInput.sourceRecordId) ?? subdivisionCode,
    subdivisionSortOrder: subdivisionInput.sortOrder ?? 0
  };
}

function normalizeCityForStaging(cityInput: LocationCityInput) {
  const cityCode = normalizeCode(cityInput.code);

  return {
    cityCode,
    cityName: cleanRequired(cityInput.name),
    citySourceRecordId: cleanOptional(cityInput.sourceRecordId) ?? cityCode,
    citySortOrder: cityInput.sortOrder ?? 0
  };
}

function normalizeAreaForStaging(areaInput: LocationAreaInput) {
  const areaCode = normalizeCode(areaInput.code);
  const metadata = cleanMetadata(areaInput.metadata);

  return {
    areaCode,
    areaName: cleanRequired(areaInput.name),
    areaPostalCode: cleanOptional(areaInput.postalCode),
    areaSourceRecordId: cleanOptional(areaInput.sourceRecordId) ?? areaCode,
    areaMetadataJson: metadata ? JSON.stringify(metadata) : null,
    areaSortOrder: areaInput.sortOrder ?? 0
  };
}

function createLocationStagingRow(
  rowNumber: number,
  country: ReturnType<typeof normalizeCountryForStaging>,
  subdivision?: ReturnType<typeof normalizeSubdivisionForStaging>,
  city?: ReturnType<typeof normalizeCityForStaging>,
  area?: ReturnType<typeof normalizeAreaForStaging>
): LocationImportStagingRow {
  return {
    rowNumber,
    countryCode: country.countryCode,
    countryName: country.countryName,
    currency: country.currency,
    locale: country.locale,
    phoneCode: country.phoneCode,
    postalCodeLabel: country.postalCodeLabel,
    postalCodePattern: country.postalCodePattern,
    countryEnabled: country.countryEnabled,
    countrySortOrder: country.countrySortOrder,
    subdivisionCode: subdivision?.subdivisionCode ?? null,
    subdivisionName: subdivision?.subdivisionName ?? null,
    subdivisionType: subdivision?.subdivisionType ?? null,
    subdivisionSourceRecordId: subdivision?.subdivisionSourceRecordId ?? null,
    subdivisionSortOrder: subdivision?.subdivisionSortOrder ?? null,
    cityCode: city?.cityCode ?? null,
    cityName: city?.cityName ?? null,
    citySourceRecordId: city?.citySourceRecordId ?? null,
    citySortOrder: city?.citySortOrder ?? null,
    areaCode: area?.areaCode ?? null,
    areaName: area?.areaName ?? null,
    areaPostalCode: area?.areaPostalCode ?? null,
    areaSourceRecordId: area?.areaSourceRecordId ?? null,
    areaMetadataJson: area?.areaMetadataJson ?? null,
    areaSortOrder: area?.areaSortOrder ?? null
  };
}

async function ensureLocationImportStagingTable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS location_import_staging_rows (
      run_id UUID NOT NULL,
      row_number INTEGER NOT NULL,
      country_code TEXT NOT NULL,
      country_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      locale TEXT NOT NULL,
      phone_code TEXT NOT NULL,
      postal_code_label TEXT NOT NULL,
      postal_code_pattern TEXT,
      country_enabled BOOLEAN NOT NULL DEFAULT true,
      country_sort_order INTEGER NOT NULL DEFAULT 0,
      subdivision_code TEXT,
      subdivision_name TEXT,
      subdivision_type TEXT,
      subdivision_source_record_id TEXT,
      subdivision_sort_order INTEGER,
      city_code TEXT,
      city_name TEXT,
      city_source_record_id TEXT,
      city_sort_order INTEGER,
      area_code TEXT,
      area_name TEXT,
      area_postal_code TEXT,
      area_source_record_id TEXT,
      area_metadata JSONB,
      area_sort_order INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (run_id, row_number)
    )
  `);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS location_import_staging_rows_run_country_idx ON location_import_staging_rows (run_id, country_code)"
  );
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS location_import_staging_rows_run_hierarchy_idx ON location_import_staging_rows (run_id, country_code, subdivision_code, city_code, area_code)"
  );
}

async function insertLocationImportStagingRows(
  prisma: PrismaClient,
  runId: string,
  rows: LocationImportStagingRow[],
  batchSize = 1000
) {
  const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? Math.min(batchSize, 2000) : 1000;

  for (let index = 0; index < rows.length; index += safeBatchSize) {
    const batch = rows.slice(index, index + safeBatchSize);
    const values = batch.map((row) =>
      Prisma.sql`(
        ${runId}::uuid,
        ${row.rowNumber},
        ${row.countryCode},
        ${row.countryName},
        ${row.currency},
        ${row.locale},
        ${row.phoneCode},
        ${row.postalCodeLabel},
        ${row.postalCodePattern},
        ${row.countryEnabled},
        ${row.countrySortOrder},
        ${row.subdivisionCode},
        ${row.subdivisionName},
        ${row.subdivisionType},
        ${row.subdivisionSourceRecordId},
        ${row.subdivisionSortOrder},
        ${row.cityCode},
        ${row.cityName},
        ${row.citySourceRecordId},
        ${row.citySortOrder},
        ${row.areaCode},
        ${row.areaName},
        ${row.areaPostalCode},
        ${row.areaSourceRecordId},
        CAST(${row.areaMetadataJson} AS jsonb),
        ${row.areaSortOrder}
      )`
    );

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO location_import_staging_rows (
          run_id,
          row_number,
          country_code,
          country_name,
          currency,
          locale,
          phone_code,
          postal_code_label,
          postal_code_pattern,
          country_enabled,
          country_sort_order,
          subdivision_code,
          subdivision_name,
          subdivision_type,
          subdivision_source_record_id,
          subdivision_sort_order,
          city_code,
          city_name,
          city_source_record_id,
          city_sort_order,
          area_code,
          area_name,
          area_postal_code,
          area_source_record_id,
          area_metadata,
          area_sort_order
        )
        VALUES ${Prisma.join(values)}
      `
    );
  }
}

async function upsertCountriesFromStaging(prisma: PrismaClient, runId: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO location_countries (
        id,
        code,
        name,
        currency,
        locale,
        phone_code,
        postal_code_label,
        postal_code_pattern,
        enabled,
        sort_order,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (country_code)
        gen_random_uuid(),
        country_code,
        country_name,
        currency,
        locale,
        phone_code,
        postal_code_label,
        postal_code_pattern,
        country_enabled,
        country_sort_order,
        NOW(),
        NOW()
      FROM location_import_staging_rows
      WHERE run_id = ${runId}::uuid
      ORDER BY country_code, row_number
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        currency = EXCLUDED.currency,
        locale = EXCLUDED.locale,
        phone_code = EXCLUDED.phone_code,
        postal_code_label = EXCLUDED.postal_code_label,
        postal_code_pattern = EXCLUDED.postal_code_pattern,
        enabled = EXCLUDED.enabled,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `
  );
}

async function markExistingSourceRowsInactiveFromStaging(prisma: PrismaClient, runId: string, sourceCode: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE location_areas area
      SET active = false, updated_at = NOW()
      FROM location_cities city, location_subdivisions subdivision, location_countries country
      WHERE area.city_id = city.id
        AND city.subdivision_id = subdivision.id
        AND subdivision.country_id = country.id
        AND area.source = ${sourceCode}
        AND country.code IN (
          SELECT DISTINCT country_code
          FROM location_import_staging_rows
          WHERE run_id = ${runId}::uuid
        )
    `
  );
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE location_cities city
      SET active = false, updated_at = NOW()
      FROM location_subdivisions subdivision, location_countries country
      WHERE city.subdivision_id = subdivision.id
        AND subdivision.country_id = country.id
        AND city.source = ${sourceCode}
        AND country.code IN (
          SELECT DISTINCT country_code
          FROM location_import_staging_rows
          WHERE run_id = ${runId}::uuid
        )
    `
  );
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE location_subdivisions subdivision
      SET active = false, updated_at = NOW()
      FROM location_countries country
      WHERE subdivision.country_id = country.id
        AND subdivision.source = ${sourceCode}
        AND country.code IN (
          SELECT DISTINCT country_code
          FROM location_import_staging_rows
          WHERE run_id = ${runId}::uuid
        )
    `
  );
}

async function upsertSubdivisionsFromStaging(prisma: PrismaClient, runId: string, sourceCode: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO location_subdivisions (
        id,
        country_id,
        code,
        name,
        type,
        active,
        source,
        source_record_id,
        sort_order,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (country.id, staging.subdivision_code)
        gen_random_uuid(),
        country.id,
        staging.subdivision_code,
        staging.subdivision_name,
        COALESCE(staging.subdivision_type, 'State'),
        true,
        ${sourceCode},
        COALESCE(staging.subdivision_source_record_id, staging.subdivision_code),
        COALESCE(staging.subdivision_sort_order, 0),
        NOW(),
        NOW()
      FROM location_import_staging_rows staging
      JOIN location_countries country ON country.code = staging.country_code
      WHERE staging.run_id = ${runId}::uuid
        AND staging.subdivision_code IS NOT NULL
        AND staging.subdivision_name IS NOT NULL
      ORDER BY country.id, staging.subdivision_code, staging.row_number
      ON CONFLICT (country_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        active = true,
        source = EXCLUDED.source,
        source_record_id = EXCLUDED.source_record_id,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `
  );
}

async function upsertCitiesFromStaging(prisma: PrismaClient, runId: string, sourceCode: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO location_cities (
        id,
        subdivision_id,
        code,
        name,
        active,
        source,
        source_record_id,
        sort_order,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (subdivision.id, staging.city_code)
        gen_random_uuid(),
        subdivision.id,
        staging.city_code,
        staging.city_name,
        true,
        ${sourceCode},
        COALESCE(staging.city_source_record_id, staging.city_code),
        COALESCE(staging.city_sort_order, 0),
        NOW(),
        NOW()
      FROM location_import_staging_rows staging
      JOIN location_countries country ON country.code = staging.country_code
      JOIN location_subdivisions subdivision
        ON subdivision.country_id = country.id
       AND subdivision.code = staging.subdivision_code
      WHERE staging.run_id = ${runId}::uuid
        AND staging.city_code IS NOT NULL
        AND staging.city_name IS NOT NULL
      ORDER BY subdivision.id, staging.city_code, staging.row_number
      ON CONFLICT (subdivision_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        active = true,
        source = EXCLUDED.source,
        source_record_id = EXCLUDED.source_record_id,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `
  );
}

async function upsertAreasFromStaging(prisma: PrismaClient, runId: string, sourceCode: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO location_areas (
        id,
        city_id,
        code,
        name,
        postal_code,
        active,
        source,
        source_record_id,
        metadata,
        sort_order,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (city.id, staging.area_code)
        gen_random_uuid(),
        city.id,
        staging.area_code,
        staging.area_name,
        staging.area_postal_code,
        true,
        ${sourceCode},
        COALESCE(staging.area_source_record_id, staging.area_code),
        staging.area_metadata,
        COALESCE(staging.area_sort_order, 0),
        NOW(),
        NOW()
      FROM location_import_staging_rows staging
      JOIN location_countries country ON country.code = staging.country_code
      JOIN location_subdivisions subdivision
        ON subdivision.country_id = country.id
       AND subdivision.code = staging.subdivision_code
      JOIN location_cities city
        ON city.subdivision_id = subdivision.id
       AND city.code = staging.city_code
      WHERE staging.run_id = ${runId}::uuid
        AND staging.area_code IS NOT NULL
        AND staging.area_name IS NOT NULL
      ORDER BY city.id, staging.area_code, staging.row_number
      ON CONFLICT (city_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        postal_code = EXCLUDED.postal_code,
        active = true,
        source = EXCLUDED.source,
        source_record_id = EXCLUDED.source_record_id,
        metadata = COALESCE(EXCLUDED.metadata, location_areas.metadata),
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `
  );
}

async function clearLocationImportStagingRows(prisma: PrismaClient, runId: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      DELETE FROM location_import_staging_rows
      WHERE run_id = ${runId}::uuid
    `
  );
}

async function clearLocationImportStagingRowsBestEffort(prisma: PrismaClient, runId: string) {
  try {
    await clearLocationImportStagingRows(prisma, runId);
  } catch {
    // The failed import run stores the error. Staging cleanup is best-effort only.
  }
}

async function markLocationImportRunFailed(
  prisma: PrismaClient,
  runId: string,
  result: LocationImportResult,
  error: unknown
) {
  await prisma.locationImportRun.update({
    where: { id: runId },
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

function cleanMetadata(value: Record<string, unknown> | null | undefined): Prisma.InputJsonObject | undefined {
  if (!value) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "");
  return entries.length ? (Object.fromEntries(entries) as Prisma.InputJsonObject) : undefined;
}

function hashDataset(dataset: LocationImportDataset) {
  return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}
