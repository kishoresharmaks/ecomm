import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { CategoryStatus } from "@indihub/database";

export class CreateCategoryDto {
  @ApiPropertyOptional({ example: "f2c7311c-1111-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ example: "f2c7311c-2222-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  productTemplateId?: string | null;

  @ApiProperty({ example: "Groceries" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Daily household essentials and local grocery products." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "indihub/admin/admin-id/categories/category.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ example: "8517", description: "Default HSN code applied when sellers choose this category." })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/, { message: "defaultHsnCode must be a 4 to 8 digit HSN code." })
  defaultHsnCode?: string | null;

  @ApiPropertyOptional({ example: 18, description: "Default GST rate percentage applied when sellers choose this category." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultGstRatePercent?: number | null;

  @ApiPropertyOptional({ example: "Mobile accessories and connected devices." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  defaultTaxDescription?: string | null;

  @ApiPropertyOptional({ enum: CategoryStatus, default: CategoryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional({ example: "groceries" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  slug?: string;
}
