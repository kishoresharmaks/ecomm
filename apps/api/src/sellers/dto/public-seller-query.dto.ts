import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class PublicSellerQueryDto {
  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SLM" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SLM-FR" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: "636016" })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  pincode?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
