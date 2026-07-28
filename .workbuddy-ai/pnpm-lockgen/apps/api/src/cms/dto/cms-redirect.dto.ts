import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CmsRedirectQueryDto {
  @ApiPropertyOptional({ example: "old-product" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

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

export class CreateCmsRedirectDto {
  @ApiProperty({ example: "/old-product-url" })
  @IsString()
  @MaxLength(500)
  sourcePath!: string;

  @ApiProperty({ example: "/products/new-product-url" })
  @IsString()
  @MaxLength(500)
  targetPath!: string;

  @ApiPropertyOptional({ example: 301, enum: [301, 302], default: 301 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([301, 302])
  statusCode?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateCmsRedirectDto extends PartialType(CreateCmsRedirectDto) {}

