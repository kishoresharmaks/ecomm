import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { CommissionType, PaymentProvider, PaymentStatus, FinanceRuleScope, SellerPayoutStatus } from "@indihub/database";

export class FinanceListQueryDto {
  @ApiPropertyOptional({ example: "seller name or payout number" })
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional({ description: "Opaque cursor for large result sets." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class CommissionRuleQueryDto extends FinanceListQueryDto {
  @ApiPropertyOptional({ enum: FinanceRuleScope })
  @IsOptional()
  @IsEnum(FinanceRuleScope)
  scope?: FinanceRuleScope;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class UpsertCommissionRuleDto {
  @ApiProperty({ example: "Default marketplace commission" })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: FinanceRuleScope })
  @IsEnum(FinanceRuleScope)
  scope!: FinanceRuleScope;

  @ApiPropertyOptional({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: "79f4b5b3-1130-4a38-95e2-7d9f910005b9" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ enum: CommissionType, example: CommissionType.PERCENTAGE })
  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  @ApiPropertyOptional({ example: 8.5, description: "Percentage entered by admin. Stored as basis points." })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  commissionRatePercent?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commissionFixedPaise?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gstRatePercent?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  tdsRatePercent?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  tcsRatePercent?: number;

  @ApiPropertyOptional({ enum: CommissionType, example: CommissionType.MANUAL })
  @IsOptional()
  @IsEnum(CommissionType)
  platformFeeType?: CommissionType;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  platformFeeRatePercent?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  platformFeeFixedPaise?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: "2026-05-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59.000Z" })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class SettlementDraftDto {
  @ApiProperty({ example: "2026-05-18T00:00:00.000Z" })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: "2026-05-24T23:59:59.999Z" })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional({ example: "Weekly seller settlement" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SettlementQueryDto extends FinanceListQueryDto {
  @ApiPropertyOptional({ enum: SellerPayoutStatus })
  @IsOptional()
  @IsEnum(SellerPayoutStatus)
  status?: SellerPayoutStatus;
}

export class PayoutQueryDto extends SettlementQueryDto {
  @ApiPropertyOptional({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class PayoutActionDto {
  @ApiPropertyOptional({ example: "Approved for weekly settlement." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SellerPayoutRequestDto {
  @ApiPropertyOptional({ example: "Please process this payout in the next manual cycle." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class MarkPayoutPaidDto extends PayoutActionDto {
  @ApiProperty({ example: "NEFT" })
  @IsString()
  @MaxLength(80)
  paymentMode!: string;

  @ApiProperty({ example: "UTR1234567890" })
  @IsString()
  @MaxLength(160)
  transactionReference!: string;

  @ApiPropertyOptional({ example: "2026-05-25T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class ManualLedgerAdjustmentDto {
  @ApiProperty({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsUUID()
  sellerId!: string;

  @ApiProperty({ enum: ["CREDIT", "DEBIT"] })
  @IsIn(["CREDIT", "DEBIT"])
  direction!: "CREDIT" | "DEBIT";

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ example: "Manual correction for shipping deduction." })
  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class GenerateStatementDto {
  @ApiProperty({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsUUID()
  payoutId!: string;
}

export class ActiveStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  active!: boolean;
}

export class FinancePaymentCollectionQueryDto extends FinanceListQueryDto {
  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ example: "2026-05-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-05-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export enum FinanceOfflinePaymentVerificationDecision {
  VERIFY = "VERIFY",
  REJECT = "REJECT"
}

export class FinanceOfflinePaymentVerificationDto {
  @ApiProperty({ enum: FinanceOfflinePaymentVerificationDecision })
  @IsEnum(FinanceOfflinePaymentVerificationDecision)
  decision!: FinanceOfflinePaymentVerificationDecision;

  @ApiPropertyOptional({ example: "UTR1234567890" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  transactionReference?: string;

  @ApiPropertyOptional({ example: "Amount matched with bank statement." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
