import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { B2BOrderStatus } from "@indihub/database";

const legacyB2BOrderStatusMap = {
  PENDING: B2BOrderStatus.PROFORMA_ISSUED,
  PROCESSING: B2BOrderStatus.IN_FULFILMENT,
  SHIPPED: B2BOrderStatus.IN_FULFILMENT,
  DELIVERED: B2BOrderStatus.FULFILLED,
} as const;

export class B2BOrderQueryDto {
  @ApiPropertyOptional({ example: "PO-2026-001" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: B2BOrderStatus })
  @IsOptional()
  @Transform(({ value }) => legacyB2BOrderStatusMap[value as keyof typeof legacyB2BOrderStatusMap] ?? value)
  @IsEnum(B2BOrderStatus)
  status?: B2BOrderStatus;

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
  @Max(100)
  limit?: number;
}

export class SubmitB2BPurchaseOrderDto {
  @ApiProperty({ example: "PO-2026-00045" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  purchaseOrderNumber!: string;

  @ApiPropertyOptional({ example: "private/b2b/po/po-2026-00045.pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purchaseOrderFileKey?: string;

  @ApiPropertyOptional({ example: "Buyer approved proforma and attached signed purchase order." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateB2BPurchaseOrderUploadRequestDto {
  @ApiProperty({ example: "approved-po-2026-00045.pdf" })
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

export class UpdateB2BOrderStatusDto {
  @ApiProperty({ enum: B2BOrderStatus })
  @IsEnum(B2BOrderStatus)
  status!: B2BOrderStatus;

  @ApiPropertyOptional({ example: "PO verified against proforma and accepted for fulfilment." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
