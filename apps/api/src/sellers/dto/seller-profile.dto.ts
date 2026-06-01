import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SellerBusinessType } from "@indihub/database";
import { SellerVerificationDocumentDto } from "./create-seller-registration.dto";

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
  @IsString()
  @MaxLength(30)
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

  @ApiPropertyOptional({ type: [SellerVerificationDocumentDto] })
  @IsOptional()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => SellerVerificationDocumentDto)
  documents?: SellerVerificationDocumentDto[];
}
