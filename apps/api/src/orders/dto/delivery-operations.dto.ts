import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DeliveryAssignmentStatus, DeliveryAttemptReason, UserStatus } from "@indihub/database";

export enum DeliveryAssignmentDecision {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
}

export class DeliveryPartnerQueryDto {
  @ApiPropertyOptional({ example: "ravi@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: "IN-TN-SLM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityCode?: string;

  @ApiPropertyOptional({ example: "636304" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SLM-MUTHU" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class DeliveryPartnerWalletQueryDto {
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

export class DeliveryPartnerPayoutRequestDto {
  @ApiPropertyOptional({ example: "Please process this payout in the next finance cycle." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateDeliveryPartnerProfileDto {
  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  phone?: string;

  @ApiPropertyOptional({ example: "TN 30 AB 1234" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  serviceCountryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceStateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SLM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceCityCode?: string;

  @ApiPropertyOptional({ example: ["636304"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  servicePincodes?: string[];

  @ApiPropertyOptional({ example: ["IN-TN-SLM-MUTHU"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  serviceLocalAreaCodes?: string[];

  @ApiPropertyOptional({ example: 11.0168 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  baseLatitude?: number;

  @ApiPropertyOptional({ example: 76.9558 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  baseLongitude?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  codCashLimitPaise?: number;

  @ApiPropertyOptional({ example: "Covers Salem local routes." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CourierDeliveryPartnerAvailabilityDto {
  @ApiProperty({ example: true })
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isAvailable!: boolean;

  @ApiPropertyOptional({ example: "Paused due to vehicle maintenance." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateOwnDeliveryPartnerProfileDto {
  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  phone?: string;

  @ApiPropertyOptional({ example: "TN 30 AB 1234" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  serviceCountryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceStateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceCityCode?: string;

  @ApiPropertyOptional({ example: ["636114", "636304"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  servicePincodes?: string[];

  @ApiPropertyOptional({ example: ["PIN-636114-708A9748"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  serviceLocalAreaCodes?: string[];

  @ApiPropertyOptional({ example: 11.0168 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  baseLatitude?: number;

  @ApiPropertyOptional({ example: 76.9558 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  baseLongitude?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ example: "Covers Salem local routes." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateDeliveryAssignmentDto {
  @ApiPropertyOptional({ example: "2d6f5f7c-0b6a-4d65-93b8-3c5b8c62d6f1" })
  @IsOptional()
  @IsUUID()
  deliveryPartnerUserId?: string | null;

  @ApiPropertyOptional({ example: "Assigned by operations team." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assignmentNote?: string;
}

export class DeliveryAssignmentDecisionDto {
  @ApiProperty({ enum: DeliveryAssignmentDecision })
  @IsEnum(DeliveryAssignmentDecision)
  decision!: DeliveryAssignmentDecision;

  @ApiPropertyOptional({ example: "Accepted for afternoon delivery." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateDeliveryAttemptDto {
  @ApiProperty({ enum: DeliveryAttemptReason })
  @IsEnum(DeliveryAttemptReason)
  reason!: DeliveryAttemptReason;

  @ApiPropertyOptional({ example: "Customer phone was switched off." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: "2026-05-28T10:30:00.000Z" })
  @IsOptional()
  @IsDateString()
  attemptedAt?: string;

  @ApiPropertyOptional({ example: "2026-05-29" })
  @IsOptional()
  @IsDateString()
  nextAttemptDate?: string;
}

export class DeliveryOperationsQueryDto {
  @ApiPropertyOptional({ example: "1HI202605230001" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;

  @ApiPropertyOptional({ enum: DeliveryAssignmentStatus })
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  assignmentStatus?: DeliveryAssignmentStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}
