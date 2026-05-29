import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  ProductAttributeFieldType,
  ProductAttributeScope,
  ProductListingMode,
  ProductTemplateStatus,
} from "@indihub/database";

export class ProductTemplateFieldDto {
  @ApiProperty({ example: "Brand" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: "brand" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/)
  fieldKey!: string;

  @ApiProperty({ enum: ProductAttributeFieldType })
  @IsEnum(ProductAttributeFieldType)
  fieldType!: ProductAttributeFieldType;

  @ApiProperty({ enum: ProductAttributeScope })
  @IsEnum(ProductAttributeScope)
  scope!: ProductAttributeScope;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: ["S", "M", "L"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options?: string[];

  @ApiPropertyOptional({ example: "Select size" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string;

  @ApiPropertyOptional({ example: "Shown to sellers while adding products." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  helpText?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateProductTemplateDto {
  @ApiProperty({ example: "Fashion" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "FASHION" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @ApiPropertyOptional({ example: "Clothing and fashion products." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ProductTemplateStatus, default: ProductTemplateStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProductTemplateStatus)
  status?: ProductTemplateStatus;

  @ApiPropertyOptional({ enum: ProductListingMode, default: ProductListingMode.CART })
  @IsOptional()
  @IsEnum(ProductListingMode)
  listingMode?: ProductListingMode;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [ProductTemplateFieldDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ProductTemplateFieldDto)
  fields?: ProductTemplateFieldDto[];
}

export class UpdateProductTemplateDto extends PartialType(CreateProductTemplateDto) {}
