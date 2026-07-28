import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApprovalStatus, ProductStatus } from "@indihub/database";

export class ProductQueryDto {
  @ApiPropertyOptional({ example: "rice" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

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

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous list response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({ enum: ["offset", "cursor"], description: "Use cursor to avoid total-count queries on large public result sets." })
  @IsOptional()
  @IsIn(["offset", "cursor"])
  pagination?: "offset" | "cursor";
}
