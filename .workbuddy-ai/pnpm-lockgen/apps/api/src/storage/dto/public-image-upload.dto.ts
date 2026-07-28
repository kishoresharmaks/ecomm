import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export enum PublicImageUploadPurpose {
  SELLER_LOGO = "SELLER_LOGO",
  SELLER_BANNER = "SELLER_BANNER",
  SELLER_PRODUCT_IMAGE = "SELLER_PRODUCT_IMAGE",
  ADMIN_BANNER = "ADMIN_BANNER",
  CATEGORY_IMAGE = "CATEGORY_IMAGE",
}

export class PublicImageUploadDto {
  @ApiProperty({
    enum: PublicImageUploadPurpose,
    example: PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
  })
  @IsEnum(PublicImageUploadPurpose)
  purpose!: PublicImageUploadPurpose;

  @ApiPropertyOptional({ example: "product-main" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "publicId can contain only letters, numbers, hyphen, and underscore.",
  })
  publicId?: string;
}
