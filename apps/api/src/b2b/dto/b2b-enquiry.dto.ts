import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
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
  ValidateNested,
} from "class-validator";
import { B2BTransportMode } from "@indihub/database";

export class CreateB2BEnquiryLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  description!: string;

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetPricePaise?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateB2BEnquiryDto {
  @ApiPropertyOptional({ example: "mobile_b2b_01HX6D9T0QZP7N6P8K3R2B5C4D" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{12,120}$/)
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-5555-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: 100, description: "Legacy single-line quantity." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  @ApiPropertyOptional({ type: [CreateB2BEnquiryLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateB2BEnquiryLineDto)
  lines?: CreateB2BEnquiryLineDto[];

  @ApiProperty({ example: "Need wholesale quotation for monthly supply." })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ enum: B2BTransportMode, default: B2BTransportMode.SELLER_ARRANGED_TRANSPORT })
  @IsOptional()
  @IsEnum(B2BTransportMode)
  transportMode?: B2BTransportMode;

  @ApiPropertyOptional({ example: "Deliver to Coimbatore warehouse; seller-arranged courier preferred." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  transportNote?: string;
}
