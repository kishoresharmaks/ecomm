import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LocationImportMode, type Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { bundledLocationDataset } from "./bundled-location-data";
import {
  LocationAreaQueryDto,
  LocationCityQueryDto,
  LocationCountryQueryDto,
  IndiaPostalLookupQueryDto,
  RunLocationImportDto,
  LocationSubdivisionQueryDto,
  UpdateLocationCountryDto
} from "./dto/location-query.dto";
import { attachStoredIndiaPostalComparison, fetchIndiaPostalLookup, type IndiaPostalStoredArea } from "./india-postal-lookup";
import { importLocationDataset } from "./location-importer";
import { normalizeLocationAreaSearchTerms } from "./location-search";

const publicLocationCacheMaxEntries = 500;
const catalogCacheTtlMs = 10 * 60 * 1000;
const areaSearchCacheTtlMs = 2 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

export type AddressLocationInput = {
  countryCode?: string | null | undefined;
  stateCode?: string | null | undefined;
  cityCode?: string | null | undefined;
  localAreaCode?: string | null | undefined;
  country?: string | null | undefined;
  state?: string | null | undefined;
  city?: string | null | undefined;
  area?: string | null | undefined;
  pincode?: string | null | undefined;
};

export type ResolvedAddressLocation = {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string | null;
  city: string;
  cityCode: string | null;
  area: string | null;
  localAreaCode: string | null;
  pincode: string;
};

@Injectable()
export class LocationsService {
  private readonly publicLocationCache = new Map<string, CacheEntry<unknown>>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listCountries(query: LocationCountryQueryDto = {}) {
    const includeDisabled = Boolean(query.includeDisabled);
    return this.cachedPublicLocationQuery(
      `countries:${includeDisabled ? "all" : "enabled"}`,
      catalogCacheTtlMs,
      () =>
        this.prisma.client.locationCountry.findMany({
          where: includeDisabled ? {} : { enabled: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        })
    );
  }

  listSubdivisions(query: LocationSubdivisionQueryDto) {
    const countryCode = this.clean(query.countryCode)?.toUpperCase() ?? "";
    return this.cachedPublicLocationQuery(
      `subdivisions:${countryCode || "all"}`,
      catalogCacheTtlMs,
      () =>
        this.prisma.client.locationSubdivision.findMany({
          where: {
            active: true,
            ...(countryCode ? { country: { code: countryCode, enabled: true } } : {})
          },
          include: { country: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        })
    );
  }

  listCities(query: LocationCityQueryDto) {
    const countryCode = this.clean(query.countryCode)?.toUpperCase();
    const stateCode = this.clean(query.stateCode)?.toUpperCase();

    return this.cachedPublicLocationQuery(
      `cities:${countryCode ?? "all"}:${stateCode ?? "all"}`,
      catalogCacheTtlMs,
      () =>
        this.prisma.client.locationCity.findMany({
          where: {
            active: true,
            ...(stateCode
              ? {
                  subdivision: {
                    code: stateCode,
                    active: true,
                    country: {
                      ...(countryCode ? { code: countryCode } : {}),
                      enabled: true
                    }
                  }
                }
              : {
                  subdivision: {
                    active: true,
                    country: {
                      ...(countryCode ? { code: countryCode } : {}),
                      enabled: true
                    }
                  }
                })
          },
          include: {
            subdivision: {
              include: { country: true }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        })
    );
  }

  listAreas(query: LocationAreaQueryDto) {
    const search = this.clean(query.search);
    const searchTerms = normalizeLocationAreaSearchTerms(search);
    const searchFilters = this.locationAreaSearchFilters(searchTerms);
    const limit = this.limitFromQuery(query.limit);
    const countryCode = this.clean(query.countryCode)?.toUpperCase();
    const stateCode = this.clean(query.stateCode)?.toUpperCase();
    const cityCode = this.clean(query.cityCode)?.toUpperCase();

    return this.cachedPublicLocationQuery(
      [
        "areas",
        countryCode ?? "all",
        stateCode ?? "all",
        cityCode ?? "all",
        query.postalCode?.trim() ?? "",
        searchTerms.join("|"),
        limit
      ].join(":"),
      areaSearchCacheTtlMs,
      () =>
        this.prisma.client.locationArea.findMany({
          where: {
            active: true,
            city: {
              ...(cityCode ? { code: cityCode } : {}),
              active: true,
              subdivision: {
                ...(stateCode ? { code: stateCode } : {}),
                active: true,
                country: {
                  ...(countryCode ? { code: countryCode } : {}),
                  enabled: true
                }
              }
            },
            ...(query.postalCode ? { postalCode: query.postalCode.trim() } : {}),
            ...(searchFilters.length
              ? {
                  OR: searchFilters
                }
              : {})
          },
          include: {
            city: {
              include: {
                subdivision: {
                  include: { country: true }
                }
              }
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          take: limit
        })
    );
  }

  listAdminCountries() {
    return this.prisma.client.locationCountry.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { subdivisions: true }
        }
      }
    });
  }

  async listAdminCoverage() {
    const countries = await this.prisma.client.locationCountry.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    return Promise.all(
      countries.map(async (country) => {
        const [subdivisionsCount, citiesCount, areasCount, latestRun, sources] = await Promise.all([
          this.prisma.client.locationSubdivision.count({
            where: { countryId: country.id, active: true }
          }),
          this.prisma.client.locationCity.count({
            where: {
              active: true,
              subdivision: { countryId: country.id, active: true }
            }
          }),
          this.prisma.client.locationArea.count({
            where: {
              active: true,
              city: {
                active: true,
                subdivision: { countryId: country.id, active: true }
              }
            }
          }),
          this.prisma.client.locationImportRun.findFirst({
            where: {
              OR: [{ countryCode: country.code }, { countryCode: null }]
            },
            include: { source: true },
            orderBy: { startedAt: "desc" }
          }),
          this.prisma.client.locationImportSource.findMany({
            where: {
              OR: [{ countryCode: country.code }, { countryCode: null }]
            },
            orderBy: [{ provider: "asc" }, { name: "asc" }]
          })
        ]);

        return {
          country,
          counts: {
            subdivisions: subdivisionsCount,
            cities: citiesCount,
            areas: areasCount
          },
          sources,
          latestRun
        };
      })
    );
  }

  listAdminImportRuns(limit = 25) {
    return this.prisma.client.locationImportRun.findMany({
      include: { source: true },
      orderBy: { startedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });
  }

  async runBundledImport(dto: RunLocationImportDto = {}) {
    const sourceCode = this.normalizeCountryCode(dto.sourceCode ?? bundledLocationDataset.source.code);
    if (sourceCode !== bundledLocationDataset.source.code) {
      throw new BadRequestException("Only registered bundled baseline import can be triggered from admin UI.");
    }

    const result = await importLocationDataset(this.prisma.client, bundledLocationDataset, dto.mode ?? LocationImportMode.REFRESH);
    this.clearPublicLocationCache();
    return result;
  }

  async lookupIndiaPostalCode(query: IndiaPostalLookupQueryDto) {
    const lookup = await fetchIndiaPostalLookup(query);
    const pincodes = Array.from(
      new Set(
        [
          ...lookup.postOffices.map((office) => office.pincode).filter((pincode): pincode is string => Boolean(pincode)),
          ...(query.pincode ? [query.pincode.trim()] : [])
        ].filter(Boolean)
      )
    );

    return attachStoredIndiaPostalComparison(lookup, await this.listStoredIndiaPostalAreas(pincodes));
  }

  async updateCountry(code: string, dto: UpdateLocationCountryDto) {
    const countryCode = this.normalizeCountryCode(code);
    const existing = await this.prisma.client.locationCountry.findUnique({ where: { code: countryCode } });

    if (!existing) {
      throw new NotFoundException("Location country not found.");
    }

    const updated = await this.prisma.client.locationCountry.update({
      where: { code: countryCode },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
    this.clearPublicLocationCache();
    return updated;
  }

  async resolveAddressLocation(input: AddressLocationInput): Promise<ResolvedAddressLocation> {
    const countryCode = this.normalizeCountryCode(input.countryCode ?? "IN");
    const country = await this.prisma.client.locationCountry.findUnique({
      where: { code: countryCode }
    });

    if ((!country || !country.enabled) && countryCode === "IN") {
      return this.resolveLegacyIndiaAddress(input);
    }

    if (!country || !country.enabled) {
      throw new BadRequestException("Selected country is not enabled for 1HandIndia.");
    }

    let state = this.clean(input.state);
    let stateCode: string | null = this.clean(input.stateCode)?.toUpperCase() ?? null;
    let city = this.clean(input.city);
    let cityCode: string | null = this.clean(input.cityCode)?.toUpperCase() ?? null;
    let area = this.clean(input.area);
    const localAreaCode: string | null = this.clean(input.localAreaCode)?.toUpperCase() ?? null;
    let pincode = this.clean(input.pincode) ?? "";

    if (stateCode) {
      const subdivision = await this.prisma.client.locationSubdivision.findFirst({
        where: {
          code: stateCode,
          countryId: country.id
        }
      });

      if (!subdivision) {
        throw new BadRequestException("Selected state or province does not belong to the selected country.");
      }

      state = subdivision.name;
    }

    if (cityCode) {
      const locationCity = await this.prisma.client.locationCity.findFirst({
        where: {
          code: cityCode,
          subdivision: {
            ...(stateCode ? { code: stateCode } : {}),
            countryId: country.id
          }
        },
        include: { subdivision: true }
      });

      if (!locationCity) {
        throw new BadRequestException("Selected city does not belong to the selected country/state.");
      }

      city = locationCity.name;
      state = locationCity.subdivision.name;
      stateCode = locationCity.subdivision.code;
    }

    if (localAreaCode) {
      const locationArea = await this.prisma.client.locationArea.findFirst({
        where: {
          code: localAreaCode,
          city: {
            ...(cityCode ? { code: cityCode } : {}),
            subdivision: {
              countryId: country.id
            }
          }
        },
        include: {
          city: {
            include: { subdivision: true }
          }
        }
      });

      if (!locationArea) {
        throw new BadRequestException("Selected local area does not belong to the selected city.");
      }

      area = locationArea.name;
      city = locationArea.city.name;
      cityCode = locationArea.city.code;
      state = locationArea.city.subdivision.name;
      stateCode = locationArea.city.subdivision.code;
      pincode ||= locationArea.postalCode ?? "";
    }

    if (!state || !city) {
      throw new BadRequestException("State/province and city are required.");
    }

    pincode = pincode || (countryCode === "AE" ? "N/A" : "");
    this.validatePostalCode(country, pincode);

    return {
      country: country.name,
      countryCode: country.code,
      state,
      stateCode,
      city,
      cityCode,
      area,
      localAreaCode,
      pincode
    };
  }

  private validatePostalCode(country: { code: string; postalCodeLabel: string; postalCodePattern: string | null }, value: string) {
    if (country.code === "AE" && value === "N/A") {
      return;
    }

    if (!value.trim()) {
      throw new BadRequestException(`${country.postalCodeLabel} is required.`);
    }

    if (country.postalCodePattern && !new RegExp(country.postalCodePattern).test(value)) {
      throw new BadRequestException(`Enter a valid ${country.postalCodeLabel.toLowerCase()}.`);
    }
  }

  private normalizeCountryCode(code: string) {
    return code.trim().toUpperCase();
  }

  private clean(value: string | null | undefined) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private limitFromQuery(value: number | string | null | undefined) {
    if (value === undefined || value === null || value === "") {
      return 50;
    }

    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException("limit must be a positive integer.");
    }

    return Math.min(parsed, 100);
  }

  private locationAreaSearchFilters(searchTerms: string[]): Prisma.LocationAreaWhereInput[] {
    return searchTerms.flatMap((term) => {
      const filters: Prisma.LocationAreaWhereInput[] = [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term.toUpperCase() } }
      ];

      if (/^[0-9]{4,10}$/.test(term)) {
        filters.push({ postalCode: term });
      } else {
        filters.push({ postalCode: { contains: term } });
      }

      return filters;
    });
  }

  private async cachedPublicLocationQuery<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const current = this.publicLocationCache.get(key) as CacheEntry<T> | undefined;

    if (current && current.expiresAt > now) {
      if (current.value !== undefined) {
        return current.value;
      }

      if (current.promise) {
        return current.promise;
      }
    }

    const promise = loader()
      .then((value) => {
        this.setPublicLocationCacheEntry(key, { expiresAt: Date.now() + ttlMs, value });
        return value;
      })
      .catch((error) => {
        if (this.publicLocationCache.get(key)?.promise === promise) {
          this.publicLocationCache.delete(key);
        }
        throw error;
      });

    this.setPublicLocationCacheEntry(key, { expiresAt: now + ttlMs, promise });
    return promise;
  }

  private setPublicLocationCacheEntry(key: string, entry: CacheEntry<unknown>) {
    if (this.publicLocationCache.has(key)) {
      this.publicLocationCache.delete(key);
    }

    this.publicLocationCache.set(key, entry);

    while (this.publicLocationCache.size > publicLocationCacheMaxEntries) {
      const oldestKey = this.publicLocationCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.publicLocationCache.delete(oldestKey);
    }
  }

  private clearPublicLocationCache() {
    this.publicLocationCache.clear();
  }

  private resolveLegacyIndiaAddress(input: AddressLocationInput): ResolvedAddressLocation {
    const state = this.clean(input.state);
    const city = this.clean(input.city);
    const area = this.clean(input.area);
    const pincode = this.clean(input.pincode) ?? "";

    if (!state || !city) {
      throw new BadRequestException("State/province and city are required.");
    }

    this.validatePostalCode(
      {
        code: "IN",
        postalCodeLabel: "Pincode",
        postalCodePattern: "^[1-9][0-9]{5}$"
      },
      pincode
    );

    return {
      country: "India",
      countryCode: "IN",
      state,
      stateCode: this.clean(input.stateCode)?.toUpperCase() ?? null,
      city,
      cityCode: this.clean(input.cityCode)?.toUpperCase() ?? null,
      area,
      localAreaCode: this.clean(input.localAreaCode)?.toUpperCase() ?? null,
      pincode
    };
  }

  private async listStoredIndiaPostalAreas(pincodes: string[]): Promise<IndiaPostalStoredArea[]> {
    if (!pincodes.length) {
      return [];
    }

    const areas = await this.prisma.client.locationArea.findMany({
      where: {
        active: true,
        postalCode: { in: pincodes },
        city: {
          active: true,
          subdivision: {
            active: true,
            country: { code: "IN" }
          }
        }
      },
      include: {
        city: {
          include: { subdivision: true }
        }
      },
      orderBy: [{ postalCode: "asc" }, { name: "asc" }]
    });

    return areas.map((area) => ({
      code: area.code,
      name: area.name,
      postalCode: area.postalCode,
      cityName: area.city.name,
      cityCode: area.city.code,
      stateName: area.city.subdivision.name,
      stateCode: area.city.subdivision.code,
      source: area.source,
      metadata: this.recordMetadata(area.metadata)
    }));
  }

  private recordMetadata(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }
}
