import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContentStatus } from "@indihub/database";

const bannerTextPositions = ["LEFT", "CENTER", "RIGHT"] as const;

export class CreateBannerDto {
  @ApiProperty({ example: "1HandIndia Launch Deals" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: "Shop trusted Indian sellers and local stores." })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @ApiPropertyOptional({ example: "indihub/admin/admin-id/banners/banner.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ example: "/categories/groceries" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @ApiPropertyOptional({ example: "Local stores" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eyebrow?: string;

  @ApiPropertyOptional({ example: "Explore products" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @ApiPropertyOptional({ example: "Register as seller" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  secondaryCtaLabel?: string;

  @ApiPropertyOptional({ example: "/seller/register" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  secondaryLinkUrl?: string;

  @ApiPropertyOptional({ example: "indihub/admin/admin-id/banners/banner-mobile.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mobileImageUrl?: string;

  @ApiPropertyOptional({ example: "Customers shopping from local sellers" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  imageAlt?: string;

  @ApiPropertyOptional({ enum: bannerTextPositions, default: "LEFT" })
  @IsOptional()
  @IsIn(bannerTextPositions)
  textPosition?: (typeof bannerTextPositions)[number];

  @ApiPropertyOptional({ example: "2026-06-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59.000Z" })
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

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
