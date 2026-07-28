import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateBusinessBuyerAddressDto {
  @ApiProperty({ example: "12 Industrial Estate Road" })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  line1!: string;

  @ApiPropertyOptional({ example: "Near Warehouse Gate 2" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @ApiPropertyOptional({ example: "Industrial Area" })
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
}

export class UpdateBusinessBuyerAddressDto extends PartialType(CreateBusinessBuyerAddressDto) {}
