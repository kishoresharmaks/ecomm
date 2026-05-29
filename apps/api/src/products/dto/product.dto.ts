import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  ValidateNested
} from "class-validator";
import { VariantStatus } from "@indihub/database";

export class ProductImageDto {
  @ApiProperty({ example: "indihub/sellers/seller-id/products/product.jpg" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: "1HandIndia product image" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  altText?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ProductVariantDto {
  @ApiPropertyOptional({ example: "f2c7311c-2222-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: "1HI-GROCERY-RICE-5KG" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiPropertyOptional({ example: "5 KG Pack" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  variantName?: string;

  @ApiProperty({ example: 59900, description: "Selling price in paise." })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePaise!: number;

  @ApiPropertyOptional({ example: 69900, description: "MRP in paise." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mrpPaise?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ enum: VariantStatus, default: VariantStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;

  @ApiPropertyOptional({ example: { size: "M", color: "Blue" } })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class CreateSellerProductDto {
  @ApiProperty({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "Premium Ponni Rice" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: "High quality rice from local sellers." })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({
    example: {
      brand: "1HandIndia",
      condition: "New",
      unitOfMeasure: "Pack",
      gstRatePercent: 5,
      hsnCode: "100630",
      returnEligibility: "Returnable",
      packageWeightGrams: 500,
      highlights: ["Locally packed", "Suitable for daily cooking"]
    },
    description: "Marketplace essentials plus category template attributes."
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  @ApiProperty({ type: [ProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];
}

export class UpdateProductVariantDto extends PartialType(ProductVariantDto) {}

export class UpdateSellerProductDto extends PartialType(OmitType(CreateSellerProductDto, ["variants"] as const)) {
  @ApiPropertyOptional({ type: [UpdateProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  variants?: UpdateProductVariantDto[];
}
