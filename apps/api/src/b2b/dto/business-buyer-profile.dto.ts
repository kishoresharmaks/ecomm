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
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/)
  gstNumber?: string;

  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: "9876543210" })
  @Matches(/^[6-9]\d{9}$/)
  contactPhone!: string;
}

export class UpdateBusinessBuyerProfileDto extends PartialType(UpsertBusinessBuyerProfileDto) {}

