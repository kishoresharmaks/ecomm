import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerBrowsingLocationDto {
  @ApiProperty({ example: "Mettu Street, Salem 636001" })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  label!: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @ApiPropertyOptional({ example: "TN" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  stateCode?: string;

  @ApiPropertyOptional({ example: "SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityCode?: string;

  @ApiPropertyOptional({ example: "TN-SALEM-METTU-STREET-636001" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: "636001" })
  @IsOptional()
  @Matches(/^[0-9A-Za-z -]{3,20}$/)
  pincode?: string;
}
