import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { PublicImageUploadPurpose } from "./public-image-upload.dto";

export class PrivateStorageConfigDto {
  @ApiPropertyOptional({ enum: ["AUTO", "S3", "LOCAL"], example: "AUTO" })
  @IsOptional()
  @IsIn(["AUTO", "S3", "LOCAL"])
  provider?: "AUTO" | "S3" | "LOCAL";

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

  @ApiPropertyOptional({ example: "storage/private" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  localRoot?: string;
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
  @ApiProperty({
    enum: PublicImageUploadPurpose,
    example: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
  })
  @IsEnum(PublicImageUploadPurpose)
  purpose!: PublicImageUploadPurpose;

  @ApiProperty({ example: "product-main.jpg" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|gif)$/i, {
    message: "contentType must be a supported image type.",
  })
  contentType!: string;

  @ApiPropertyOptional({ example: 524288 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  sizeBytes?: number;

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
  @ApiProperty({ example: "ID_PROOF" })
  @IsString()
  @Matches(/^(ID_PROOF|SIGNATURE_PROOF|GST_CERTIFICATE|FSSAI_CERTIFICATE|PAN_CARD|ADDRESS_PROOF|BANK_PROOF|BUSINESS_REGISTRATION|OTHER)$/)
  documentType!: string;

  @ApiProperty({ example: "gst-certificate.pdf" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiProperty({ example: "application/pdf" })
  @IsString()
  @Matches(/^(application\/pdf|image\/jpeg|image\/png|image\/webp)$/i, {
    message: "contentType must be PDF, JPG, PNG, or WebP.",
  })
  contentType!: string;

  @ApiProperty({ example: 524288 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;
}
