import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LocationImportMode } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { bundledLocationDataset } from "./bundled-location-data";
import {
  LocationAreaQueryDto,
  LocationCityQueryDto,
  LocationCountryQueryDto,
  RunLocationImportDto,
  LocationSubdivisionQueryDto,
  UpdateLocationCountryDto
} from "./dto/location-query.dto";
import { importLocationDataset } from "./location-importer";
import { normalizeLocationAreaSearchTerms } from "./location-search";

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listCountries(query: LocationCountryQueryDto = {}) {
    return this.prisma.client.locationCountry.findMany({
      where: query.includeDisabled ? {} : { enabled: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  listSubdivisions(query: LocationSubdivisionQueryDto) {
    return this.prisma.client.locationSubdivision.findMany({
      where: {
        active: true,
        ...(query.countryCode ? { country: { code: this.normalizeCountryCode(query.countryCode), enabled: true } } : {})
      },
      include: { country: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  listCities(query: LocationCityQueryDto) {
    return this.prisma.client.locationCity.findMany({
      where: {
        active: true,
        ...(query.stateCode
          ? {
              subdivision: {
                code: query.stateCode.trim().toUpperCase(),
                active: true,
                country: { enabled: true }
              }
            }
          : {
              subdivision: {
                active: true,
                country: { enabled: true }
              }
            })
      },
      include: {
        subdivision: {
          include: { country: true }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  listAreas(query: LocationAreaQueryDto) {
    const search = this.clean(query.search);
    const searchTerms = normalizeLocationAreaSearchTerms(search);
    const limit = this.limitFromQuery(query.limit);

    return this.prisma.client.locationArea.findMany({
      where: {
        active: true,
        ...(query.cityCode
          ? {
              city: {
                code: query.cityCode.trim().toUpperCase(),
                active: true,
                subdivision: { active: true, country: { enabled: true } }
              }
            }
          : {
              city: {
                active: true,
                subdivision: { active: true, country: { enabled: true } }
              }
            }),
        ...(query.postalCode ? { postalCode: query.postalCode.trim() } : {}),
        ...(searchTerms.length
          ? {
              OR: searchTerms.flatMap((term) => [
                { name: { contains: term } },
                { postalCode: { contains: term } },
                { code: { contains: term.toUpperCase() } }
              ])
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
    });
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

    return importLocationDataset(this.prisma.client, bundledLocationDataset, dto.mode ?? LocationImportMode.REFRESH);
  }

  async updateCountry(code: string, dto: UpdateLocationCountryDto) {
    const countryCode = this.normalizeCountryCode(code);
    const existing = await this.prisma.client.locationCountry.findUnique({ where: { code: countryCode } });

    if (!existing) {
      throw new NotFoundException("Location country not found.");
    }

    return this.prisma.client.locationCountry.update({
      where: { code: countryCode },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
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
}
