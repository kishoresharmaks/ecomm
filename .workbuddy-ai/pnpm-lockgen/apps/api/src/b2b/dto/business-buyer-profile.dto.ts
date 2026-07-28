import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpsertBusinessBuyerProfileDto {
  @ApiProperty({ example: "Vignesh Traders" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  companyName!: string;

  @ApiPropertyOptional({ example: "33ABCDE1234F1Z5" })
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, {
    message: "gstNumber must be a valid GSTIN.",
  })
  gstNumber?: string;

  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: "+919876543210" })
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  contactPhone!: string;
}

export class UpdateBusinessBuyerProfileDto extends PartialType(UpsertBusinessBuyerProfileDto) {}

