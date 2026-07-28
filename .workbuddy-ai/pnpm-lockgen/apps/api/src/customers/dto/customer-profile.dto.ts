import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: "Vignesh Kumar" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  phone?: string;

  @ApiPropertyOptional({ example: "Vignesh" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;
}

