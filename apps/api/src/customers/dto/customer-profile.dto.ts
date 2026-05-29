import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: "Vignesh Kumar" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  phone?: string;

  @ApiPropertyOptional({ example: "Vignesh" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;
}

