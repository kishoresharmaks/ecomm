import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  LocationAreaQueryDto,
  LocationCityQueryDto,
  LocationCountryQueryDto,
  RunLocationImportDto,
  LocationSubdivisionQueryDto,
  UpdateLocationCountryDto
} from "./dto/location-query.dto";
import { LocationsService } from "./locations.service";

@ApiTags("Locations")
@Controller("locations")
export class LocationsController {
  constructor(@Inject(LocationsService) private readonly locationsService: LocationsService) {}

  @Public()
  @Get("countries")
  @ApiOperation({ summary: "List enabled market countries." })
  listCountries(@Query() query: LocationCountryQueryDto) {
    return this.locationsService.listCountries(query);
  }

  @Public()
  @Get("states")
  @ApiOperation({ summary: "List states/provinces for a country." })
  listSubdivisions(@Query() query: LocationSubdivisionQueryDto) {
    return this.locationsService.listSubdivisions(query);
  }

  @Public()
  @Get("cities")
  @ApiOperation({ summary: "List cities for a state/province." })
  listCities(@Query() query: LocationCityQueryDto) {
    return this.locationsService.listCities(query);
  }

  @Public()
  @Get("areas")
  @ApiOperation({ summary: "List local areas for a city." })
  listAreas(@Query() query: LocationAreaQueryDto) {
    return this.locationsService.listAreas(query);
  }
}

@ApiTags("Admin Locations")
@Roles(RoleCode.ADMIN)
@Controller("admin/locations")
export class AdminLocationsController {
  constructor(@Inject(LocationsService) private readonly locationsService: LocationsService) {}

  @Get("countries")
  @ApiOperation({ summary: "List all market countries for administration." })
  listCountries() {
    return this.locationsService.listAdminCountries();
  }

  @Get("coverage")
  @ApiOperation({ summary: "List country location coverage and import source status." })
  listCoverage() {
    return this.locationsService.listAdminCoverage();
  }

  @Get("import-runs")
  @ApiOperation({ summary: "List recent location import and refresh runs." })
  listImportRuns() {
    return this.locationsService.listAdminImportRuns();
  }

  @Post("import-runs")
  @ApiOperation({ summary: "Run a registered location import or refresh." })
  runImport(@Body() dto: RunLocationImportDto) {
    return this.locationsService.runBundledImport(dto);
  }

  @Patch("countries/:code")
  @ApiOperation({ summary: "Update an enabled market country." })
  updateCountry(@Param("code") code: string, @Body() dto: UpdateLocationCountryDto) {
    return this.locationsService.updateCountry(code, dto);
  }
}
