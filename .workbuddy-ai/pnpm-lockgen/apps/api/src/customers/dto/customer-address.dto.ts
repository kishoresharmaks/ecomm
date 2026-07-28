import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const locationSources = ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"] as const;

export class CreateCustomerAddressDto {
  @ApiPropertyOptional({ example: "Home" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: "+919876543210" })
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  phone!: string;

  @ApiProperty({ example: "12 Market Road" })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  line1!: string;

  @ApiPropertyOptional({ example: "Near Central Bus Stand" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @ApiPropertyOptional({ example: "Gandhipuram" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @ApiPropertyOptional({ example: "Coimbatore" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: "Tamil Nadu" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: "641012" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "India" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CBE" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CBE-GANDHIPURAM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 11.6643 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.146 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: locationSources, example: "MAP_PICK" })
  @IsOptional()
  @IsIn(locationSources)
  locationSource?: (typeof locationSources)[number];

  @ApiPropertyOptional({ example: 24.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 92 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  locationConfidenceScore?: number;
}

export class UpdateCustomerAddressDto extends PartialType(CreateCustomerAddressDto) {}
