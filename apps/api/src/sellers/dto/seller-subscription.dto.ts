import { Type } from "class-transformer";
import {
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
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  SellerSubscriptionBillingCycle,
  SellerSubscriptionPlanAudience,
  SellerSubscriptionStatus,
} from "@indihub/database";

export class SellerSubscriptionPlanQueryDto {
  @ApiPropertyOptional({ example: "starter" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: SellerSubscriptionPlanAudience })
  @IsOptional()
  @IsEnum(SellerSubscriptionPlanAudience)
  audience?: SellerSubscriptionPlanAudience;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateSellerSubscriptionPlanDto {
  @ApiProperty({ example: "STARTER_FREE" })
  @IsString()
  @Matches(/^[A-Z0-9_]{3,40}$/)
  code!: string;

  @ApiProperty({ example: "Starter Free" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Default seller onboarding plan." })
  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePaise?: number;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ enum: SellerSubscriptionBillingCycle })
  @IsOptional()
  @IsEnum(SellerSubscriptionBillingCycle)
  billingCycle?: SellerSubscriptionBillingCycle;

  @ApiPropertyOptional({ enum: SellerSubscriptionPlanAudience })
  @IsOptional()
  @IsEnum(SellerSubscriptionPlanAudience)
  audience?: SellerSubscriptionPlanAudience;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  productLimit?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  featuredProductLimit?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  b2bEnquiryLimit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  commissionDiscountBps?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSellerSubscriptionPlanDto extends PartialType(CreateSellerSubscriptionPlanDto) {}

export class AssignSellerSubscriptionDto {
  @ApiProperty({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ enum: SellerSubscriptionStatus })
  @IsOptional()
  @IsEnum(SellerSubscriptionStatus)
  status?: SellerSubscriptionStatus;

  @ApiPropertyOptional({ example: "2026-06-25T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @ApiPropertyOptional({ example: "Changed after seller selected Growth plan." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class VerifySellerRazorpaySubscriptionDto {
  @ApiProperty({ example: "sub_razorpay123" })
  @IsString()
  razorpaySubscriptionId!: string;

  @ApiProperty({ example: "pay_razorpay123" })
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty({ example: "generated_checkout_signature" })
  @IsString()
  razorpaySignature!: string;
}
