import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { LocationImportMode } from "@indihub/database";

export class LocationCountryQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDisabled?: boolean;
}

export class LocationSubdivisionQueryDto {
  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
}

export class LocationCityQueryDto {
  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;
}

export class LocationAreaQueryDto {
  @ApiPropertyOptional({ example: "IN-TN-CBE" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "641012" })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  postalCode?: string;

  @ApiPropertyOptional({ example: "Gandhipuram" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateLocationCountryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}

export class RunLocationImportDto {
  @ApiPropertyOptional({ example: "BUNDLED_LOCATION_BASELINE" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sourceCode?: string;

  @ApiPropertyOptional({ enum: LocationImportMode, example: LocationImportMode.REFRESH })
  @IsOptional()
  @IsEnum(LocationImportMode)
  mode?: LocationImportMode;
}
