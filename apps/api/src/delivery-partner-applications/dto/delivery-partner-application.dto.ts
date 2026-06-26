import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DeliveryPartnerApplicationStatus, LocationSource } from "@indihub/database";
import { IsValidPhoneNumber } from "../../common/validators/is-phone-number.validator";

export const deliveryPartnerApplicationDecisions = ["APPROVE", "REJECT"] as const;
export type DeliveryPartnerApplicationDecision = (typeof deliveryPartnerApplicationDecisions)[number];

export class DeliveryPartnerApplicationQueryDto {
  @ApiPropertyOptional({ enum: DeliveryPartnerApplicationStatus })
  @IsOptional()
  @IsEnum(DeliveryPartnerApplicationStatus)
  status?: DeliveryPartnerApplicationStatus;

  @ApiPropertyOptional({ example: "salem" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

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

export class DeliveryPartnerApplicationDto {
  @ApiProperty({ example: "Ravi Kumar" })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: "ravi@example.com" })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "+919876543210" })
  @IsValidPhoneNumber()
  phone!: string;

  @ApiPropertyOptional({ example: "+919123456780" })
  @IsOptional()
  @IsValidPhoneNumber()
  alternatePhone?: string;

  @ApiProperty({ example: "Bike" })
  @IsString()
  @MaxLength(80)
  vehicleType!: string;

  @ApiProperty({ example: "TN 30 AB 1234" })
  @IsString()
  @MaxLength(40)
  vehicleNumber!: string;

  @ApiPropertyOptional({ example: "TN302026000001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  drivingLicenseNumber?: string;

  @ApiPropertyOptional({ example: "2 years local delivery experience around Salem." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  experienceSummary?: string;

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

  @ApiPropertyOptional({ example: ["636001", "636007"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  servicePincodes?: string[];

  @ApiPropertyOptional({ example: ["PIN-636001-ABCD"] })
  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsString({ each: true })
  serviceLocalAreaCodes?: string[];

  @ApiProperty({ example: "24, Main Road" })
  @IsString()
  @MaxLength(220)
  addressLine1!: string;

  @ApiPropertyOptional({ example: "Near bus stand" })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  addressLine2?: string;

  @ApiPropertyOptional({ example: "Fairlands" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @ApiProperty({ example: "Salem" })
  @IsString()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: "Tamil Nadu" })
  @IsString()
  @MaxLength(120)
  state!: string;

  @ApiProperty({ example: "636001" })
  @IsString()
  @MaxLength(24)
  pincode!: string;

  @ApiPropertyOptional({ example: "India" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @ApiPropertyOptional({ example: 11.6643 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.146 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: LocationSource })
  @IsOptional()
  @IsEnum(LocationSource)
  locationSource?: LocationSource;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100000)
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  locationConfidenceScore?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ example: "Available morning and evening shifts." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  availabilityNotes?: string;
}

export class DeliveryPartnerApplicationDecisionDto {
  @ApiProperty({ enum: deliveryPartnerApplicationDecisions })
  @IsIn(deliveryPartnerApplicationDecisions)
  decision!: DeliveryPartnerApplicationDecision;

  @ApiPropertyOptional({ example: "Approved after phone and vehicle verification." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  codCashLimitPaise?: number;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}
