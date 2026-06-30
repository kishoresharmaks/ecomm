import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SellerBusinessType, SellerCapability } from "@indihub/database";
import { SellerVerificationDocumentDto } from "./create-seller-registration.dto";

const locationSources = ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"] as const;

export class UpdateSellerAddressDto {
  @ApiPropertyOptional({ example: "No 12, Market Road" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  line1?: string;

  @ApiPropertyOptional({ example: "Near bus stand" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @ApiPropertyOptional({ example: "Anna Nagar" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @ApiPropertyOptional({ example: "Chennai" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: "Tamil Nadu" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ example: "600040" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CHN" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CHN-ANNANAGAR" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

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

  @ApiPropertyOptional({ enum: locationSources, example: "MAP_PICK" })
  @IsOptional()
  @IsIn(locationSources)
  locationSource?: (typeof locationSources)[number];

  @ApiPropertyOptional({ example: 24.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 92 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  locationConfidenceScore?: number;
}

export class UpdateSellerPayoutProfileDto {
  @ApiPropertyOptional({ example: "1HandIndia Local Store" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  accountHolderName?: string;

  @ApiPropertyOptional({ example: "HDFC Bank" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  bankName?: string;

  @ApiPropertyOptional({ example: "50100123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountNumber?: string;

  @ApiPropertyOptional({ example: "HDFC0001234" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifscCode?: string;

  @ApiPropertyOptional({ example: "seller@upi" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  upiId?: string;
}

export class UpdateSellerCourierProviderSettingDto {
  @ApiPropertyOptional({ example: "SHIPROCKET" })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  providerCode!: string;

  @ApiPropertyOptional({ example: "Main Warehouse" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  pickupLocationName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSellerServiceAreaDto {
  @ApiPropertyOptional({ example: "Salem doorstep service radius" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM-METTU-STREET" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: "636001" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

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

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSellerProfileDto {
  @ApiPropertyOptional({ example: "1HandIndia Local Store" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  storeName?: string;

  @ApiPropertyOptional({
    example: "indihub/sellers/seller-id/profile/logo/store-logo.png",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @ApiPropertyOptional({
    example: "indihub/sellers/seller-id/profile/banner/store-banner.png",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string | null;

  @ApiPropertyOptional({ example: "Fresh local groceries and home essentials." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: "1HandIndia Local Store Private Limited" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  businessLegalName?: string;

  @ApiPropertyOptional({ enum: SellerBusinessType, example: SellerBusinessType.PROPRIETORSHIP })
  @IsOptional()
  @IsEnum(SellerBusinessType)
  businessType?: SellerBusinessType;

  @ApiPropertyOptional({ example: "33ABCDE1234F1Z5" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, {
    message: "gstNumber must be a valid GSTIN.",
  })
  gstNumber?: string;

  @ApiPropertyOptional({ example: "ABCDE1234F" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: "panNumber must be a valid PAN.",
  })
  panNumber?: string;

  @ApiPropertyOptional({ example: "Vignesh" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  contactPhone?: string;

  @ApiPropertyOptional({ example: "seller@example.com" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ type: UpdateSellerAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSellerAddressDto)
  address?: UpdateSellerAddressDto;

  @ApiPropertyOptional({ type: UpdateSellerPayoutProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSellerPayoutProfileDto)
  payoutProfile?: UpdateSellerPayoutProfileDto;

  @ApiPropertyOptional({ type: [UpdateSellerCourierProviderSettingDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdateSellerCourierProviderSettingDto)
  courierSettings?: UpdateSellerCourierProviderSettingDto[];

  @ApiPropertyOptional({ type: [UpdateSellerServiceAreaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UpdateSellerServiceAreaDto)
  serviceAreas?: UpdateSellerServiceAreaDto[];

  @ApiPropertyOptional({ type: [SellerVerificationDocumentDto] })
  @IsOptional()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SellerVerificationDocumentDto)
  documents?: SellerVerificationDocumentDto[];
}

export class UpdateMySellerCapabilitiesDto {
  @ApiPropertyOptional({
    enum: SellerCapability,
    isArray: true,
    example: [SellerCapability.RETAIL, SellerCapability.SERVICE],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(SellerCapability, { each: true })
  enabledCapabilities!: SellerCapability[];

  @ApiPropertyOptional({ enum: SellerCapability, example: SellerCapability.RETAIL })
  @IsOptional()
  @IsEnum(SellerCapability)
  primaryCapability?: SellerCapability;

  @ApiPropertyOptional({ example: "Adding retail selling after service provider onboarding." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
