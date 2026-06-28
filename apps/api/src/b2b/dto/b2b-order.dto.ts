import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { B2BPaymentMethod, B2BProofStatus, B2BOrderStatus } from "@indihub/database";

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

export class B2BPaymentProofQueryDto {
  @ApiPropertyOptional({ enum: B2BProofStatus })
  @IsOptional()
  @IsEnum(B2BProofStatus)
  status?: B2BProofStatus;

  @ApiPropertyOptional({ enum: B2BPaymentMethod })
  @IsOptional()
  @IsEnum(B2BPaymentMethod)
  method?: B2BPaymentMethod;

  @ApiPropertyOptional({ example: "2026-06-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59.999Z" })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

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

export class SubmitB2BPaymentProofDto {
  @ApiProperty({ enum: [B2BPaymentMethod.BANK_TRANSFER] })
  @IsEnum(B2BPaymentMethod)
  method!: B2BPaymentMethod;

  @ApiProperty({ example: 10000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ example: "INR" })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ example: "UTR1234567890" })
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  referenceNumber!: string;

  @ApiProperty({ example: "storage/private/b2b/purchase-orders/buyer-id/order/proof.pdf" })
  @IsString()
  @MaxLength(500)
  proofFileKey!: string;
}

export class VerifyB2BPaymentProofDto {
  @ApiPropertyOptional({ example: "Matched bank statement." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectB2BPaymentProofDto {
  @ApiProperty({ example: "Reference number does not match the bank statement." })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  rejectionReason!: string;
}

export class RecordB2BManualPaymentDto {
  @ApiProperty({ example: 10000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ example: "NEFT-MANUAL-12345" })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  referenceNumber!: string;

  @ApiProperty({ example: "Finance received NEFT and matched bank statement." })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ example: "Credited to HDFC current account." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ExtendB2BPaymentDueDateDto {
  @ApiProperty({ example: "2026-07-05T18:30:00.000Z" })
  @IsISO8601()
  newDueAt!: string;

  @ApiProperty({ example: "Buyer requested bank approval extension." })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class B2BAdminReasonDto {
  @ApiProperty({ example: "Credit-term buyer approved by finance." })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class IssueB2BRefundDto {
  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ example: "Refunding verified excess payment after finance review." })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
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
