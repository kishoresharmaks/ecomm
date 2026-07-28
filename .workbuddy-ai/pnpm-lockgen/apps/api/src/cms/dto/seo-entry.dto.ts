import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ContentStatus, SeoEntityType } from "@indihub/database";

export class SeoEntryQueryDto {
  @ApiPropertyOptional({ enum: SeoEntityType })
  @IsOptional()
  @IsEnum(SeoEntityType)
  entityType?: SeoEntityType;

  @ApiPropertyOptional({ example: "product-id-or-route-segment" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  entityId?: string;

  @ApiPropertyOptional({ example: "/products/sample-product" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  routePath?: string;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ example: "wireless headset" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateSeoEntryDto {
  @ApiProperty({ enum: SeoEntityType, example: SeoEntityType.PRODUCT })
  @IsEnum(SeoEntityType)
  entityType!: SeoEntityType;

  @ApiPropertyOptional({ example: "5b10b96d-7e96-4c7e-b24f-26aa9d7e5a1a" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  entityId?: string;

  @ApiPropertyOptional({ example: "/products/noise-headset" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  routePath?: string;

  @ApiPropertyOptional({ example: "Noise Headset | 1HandIndia" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  metaTitle?: string;

  @ApiPropertyOptional({ example: "Buy Noise Headset from verified sellers on 1HandIndia." })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  metaDescription?: string;

  @ApiPropertyOptional({ example: "https://1handindia.com/products/noise-headset" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string;

  @ApiPropertyOptional({ example: "index,follow", default: "index,follow" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  robotsDirective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  ogDescription?: string;

  @ApiPropertyOptional({ example: "indihub/seo/product-og.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  twitterTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  twitterDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  twitterImageUrl?: string;

  @ApiPropertyOptional({ example: "headset" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  focusKeyword?: string;

  @ApiPropertyOptional({ example: "Product" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  structuredDataType?: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

export class UpdateSeoEntryDto extends PartialType(CreateSeoEntryDto) {}
