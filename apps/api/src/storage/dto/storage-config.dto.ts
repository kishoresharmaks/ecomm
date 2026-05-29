import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { PublicImageUploadPurpose } from "./public-image-upload.dto";

export class PrivateStorageConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: "https://s3.ap-south-1.amazonaws.com" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  endpoint?: string;

  @ApiPropertyOptional({ example: "ap-south-1" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ example: "indihub-private-documents" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bucket?: string;

  @ApiPropertyOptional({ example: "AKIA..." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accessKeyId?: string;

  @ApiPropertyOptional({ example: "s3-secret" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  secretAccessKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clearSecretAccessKey?: boolean;
}

export class PublicImageS3ConfigDto {
  @ApiPropertyOptional({ example: "https://s3.ap-south-1.amazonaws.com" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  endpoint?: string;

  @ApiPropertyOptional({ example: "ap-south-1" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ example: "indihub-public-images" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bucket?: string;

  @ApiPropertyOptional({ example: "AKIA..." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accessKeyId?: string;

  @ApiPropertyOptional({ example: "s3-secret" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  secretAccessKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clearSecretAccessKey?: boolean;
}

export class PublicImageImageKitConfigDto {
  @ApiPropertyOptional({ example: "public_xxxxx" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  publicKey?: string;

  @ApiPropertyOptional({ example: "private_xxxxx" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  privateKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clearPrivateKey?: boolean;
}

export class PublicImageConfigDto {
  @ApiPropertyOptional({ enum: ["IMAGEKIT", "S3"], example: "IMAGEKIT" })
  @IsOptional()
  @IsIn(["IMAGEKIT", "S3"])
  provider?: "IMAGEKIT" | "S3";

  @ApiPropertyOptional({ example: "https://cdn.1handindia.com/marketplace-images" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string;

  @ApiPropertyOptional({ type: () => PublicImageImageKitConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicImageImageKitConfigDto)
  imageKit?: PublicImageImageKitConfigDto;

  @ApiPropertyOptional({ type: () => PublicImageS3ConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicImageS3ConfigDto)
  s3?: PublicImageS3ConfigDto;
}

export class UpsertStorageConfigurationDto {
  @ApiPropertyOptional({ type: PrivateStorageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PrivateStorageConfigDto)
  privateStorage?: PrivateStorageConfigDto;

  @ApiPropertyOptional({ type: PublicImageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicImageConfigDto)
  publicImages?: PublicImageConfigDto;
}

export class PublicImageUploadRequestDto {
  @ApiPropertyOptional({
    enum: PublicImageUploadPurpose,
    example: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
  })
  @IsEnum(PublicImageUploadPurpose)
  purpose!: PublicImageUploadPurpose;

  @ApiPropertyOptional({ example: "product-main.jpg" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: "image/jpeg" })
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|gif)$/i, {
    message: "contentType must be a supported image type.",
  })
  contentType!: string;

  @ApiPropertyOptional({ example: "product-main" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "publicId can contain only letters, numbers, hyphen, and underscore.",
  })
  publicId?: string;
}

export class PrivateDocumentUploadRequestDto {
  @ApiPropertyOptional({ example: "GST_CERTIFICATE" })
  @IsString()
  @Matches(/^(GST_CERTIFICATE|PAN_CARD|ADDRESS_PROOF|BANK_PROOF|BUSINESS_REGISTRATION|OTHER)$/)
  documentType!: string;

  @ApiPropertyOptional({ example: "gst-certificate.pdf" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsString()
  @Matches(/^(application\/pdf|image\/jpeg|image\/png|image\/webp)$/i, {
    message: "contentType must be PDF, JPG, PNG, or WebP.",
  })
  contentType!: string;
}
