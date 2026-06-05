import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsEmail,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { SellerBusinessType, SellerType } from "@indihub/database";

const locationSources = ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"] as const;

class SellerAddressDto {
  @ApiProperty({ example: "12 Market Road" })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  line1!: string;

  @ApiPropertyOptional({ example: "Near Central Bus Stand" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @ApiPropertyOptional({ example: "Gandhipuram" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @ApiPropertyOptional({ example: "Coimbatore" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: "Tamil Nadu" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: "641012" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CBE" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CBE-GANDHIPURAM" })
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

export class SellerVerificationDocumentDto {
  @ApiProperty({ example: "ID_PROOF" })
  @IsString()
  @Matches(/^(ID_PROOF|SIGNATURE_PROOF|GST_CERTIFICATE|PAN_CARD|ADDRESS_PROOF|BANK_PROOF|BUSINESS_REGISTRATION|OTHER)$/)
  documentType!: string;

  @ApiProperty({ example: "indihub/sellers/user-id/documents/gst-certificate.pdf" })
  @IsString()
  @MaxLength(500)
  fileUrl!: string;
}

export class CreateSellerRegistrationDto {
  @ApiProperty({ enum: SellerType })
  @IsEnum(SellerType)
  sellerType!: SellerType;

  @ApiProperty({ example: "Vignesh Local Mart" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  storeName!: string;

  @ApiPropertyOptional({ example: "Vignesh Local Mart Private Limited" })
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

  @ApiProperty({ example: "Vignesh" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: "+919876543210" })
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  contactPhone!: string;

  @ApiProperty({ example: "seller@example.com" })
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ type: SellerAddressDto })
  @ValidateNested()
  @Type(() => SellerAddressDto)
  address!: SellerAddressDto;

  @ApiPropertyOptional({ example: "Local grocery and household product seller." })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  businessDescription?: string;

  @ApiPropertyOptional({ type: [SellerVerificationDocumentDto] })
  @IsOptional()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SellerVerificationDocumentDto)
  documents?: SellerVerificationDocumentDto[];

  @ApiPropertyOptional({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsOptional()
  @IsUUID()
  subscriptionPlanId?: string;
}

export class CreateSellerOnboardingDto extends OmitType(CreateSellerRegistrationDto, [
  "contactEmail",
] as const) {}
