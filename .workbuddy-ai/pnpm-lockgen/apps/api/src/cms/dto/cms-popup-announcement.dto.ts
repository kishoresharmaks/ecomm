import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContentStatus } from "@indihub/database";

export class CreateCmsPopupAnnouncementDto {
  @ApiProperty({ example: "Monsoon marketplace offers" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: "indihub/admin/admin-id/banners/monsoon-popup.webp" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  desktopImageUrl!: string;

  @ApiPropertyOptional({ example: "indihub/admin/admin-id/banners/monsoon-popup-mobile.webp" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mobileImageUrl?: string;

  @ApiProperty({ example: "Monsoon offers from verified marketplace sellers" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  imageAlt!: string;

  @ApiPropertyOptional({ example: "/deals" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  primaryLinkUrl?: string;

  @ApiPropertyOptional({ example: "Shop offers" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  primaryCtaLabel?: string;

  @ApiPropertyOptional({ example: "/categories" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  secondaryLinkUrl?: string;

  @ApiPropertyOptional({ example: "Browse categories" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  secondaryCtaLabel?: string;

  @ApiPropertyOptional({ example: "2026-07-27T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ example: "2026-08-10T23:59:59.000Z" })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCmsPopupAnnouncementDto extends PartialType(CreateCmsPopupAnnouncementDto) {}
