import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

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
}

export class UpdateCustomerAddressDto extends PartialType(CreateCustomerAddressDto) {}
