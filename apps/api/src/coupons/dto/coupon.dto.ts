import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  CouponDiscountType,
  CouponFundingSource,
  CouponSellerParticipationStatus,
  CouponStatus,
} from "@indihub/database";

export class CouponQueryDto {
  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ enum: CouponFundingSource })
  @IsOptional()
  @IsEnum(CouponFundingSource)
  fundingSource?: CouponFundingSource;

  @ApiPropertyOptional({ example: "SAVE" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
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

  @ApiPropertyOptional({ description: "Cursor redemption id for the next page." })
  @IsOptional()
  @IsUUID("4")
  cursor?: string;
}

export class CreateCouponDto {
  @ApiProperty({ example: "SAVE10" })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/)
  code!: string;

  @ApiProperty({ example: "Launch discount" })
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @ApiPropertyOptional({ example: "Customer-facing checkout discount." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ enum: CouponDiscountType })
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @ApiProperty({ enum: CouponFundingSource })
  @IsEnum(CouponFundingSource)
  fundingSource!: CouponFundingSource;

  @ApiPropertyOptional({ example: 1000, description: "Discount in basis points. 1000 = 10%." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9000)
  discountValueBps?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  discountAmountPaise?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDiscountPaise?: number;

  @ApiPropertyOptional({ example: 49900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSubtotalPaise?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSubtotalPaise?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalUsageLimit?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @ApiPropertyOptional({ example: "2026-07-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: "2026-07-31T23:59:59.000Z" })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: "Only for campaign landing page." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNote?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID("4", { each: true })
  sellerIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  productIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID("4", { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID("4", { each: true })
  customerIds?: string[];
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class SellerCouponQueryDto {
  @ApiPropertyOptional({ enum: CouponSellerParticipationStatus })
  @IsOptional()
  @IsEnum(CouponSellerParticipationStatus)
  participationStatus?: CouponSellerParticipationStatus;
}
