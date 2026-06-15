import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const searchEntityTypes = ["all", "product", "store", "category"] as const;
export type SearchEntityTypeFilter = (typeof searchEntityTypes)[number];

export const searchSorts = ["relevance", "newest", "price_asc", "price_desc", "rating", "discount"] as const;
export type SearchSort = (typeof searchSorts)[number];

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function booleanFromQuery(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}

export class SearchQueryDto {
  @ApiPropertyOptional({ example: "smart watch" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ enum: searchEntityTypes })
  @IsOptional()
  @IsIn(searchEntityTypes)
  type?: SearchEntityTypeFilter;

  @ApiPropertyOptional({ enum: searchSorts })
  @IsOptional()
  @IsIn(searchSorts)
  sort?: SearchSort;

  @ApiPropertyOptional({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePaise?: number;

  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePaise?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => booleanFromQuery(value))
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => booleanFromQuery(value))
  @IsBoolean()
  deals?: boolean;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ example: 24, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous search response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class SearchSuggestionsQueryDto {
  @ApiPropertyOptional({ example: "watch" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @ApiPropertyOptional({ example: 8, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
