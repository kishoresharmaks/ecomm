import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CmsMediaQueryDto {
  @ApiPropertyOptional({ example: "seo" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: "product-seo" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usageContext?: string;

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
  limit?: number;
}

export class CreateCmsMediaDto {
  @ApiPropertyOptional({ example: "Homepage OG image" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiProperty({ example: "indihub/cms/home-og.jpg" })
  @IsString()
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: "indihub/cms/home-og" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  publicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  assetId?: string;

  @ApiPropertyOptional({ example: "image", default: "image" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  mediaType?: string;

  @ApiPropertyOptional({ example: "1HandIndia marketplace homepage" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  altText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional({ example: "homepage-og" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usageContext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bytes?: number;
}

export class UpdateCmsMediaDto extends PartialType(CreateCmsMediaDto) {}
