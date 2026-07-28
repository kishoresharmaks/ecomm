import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  GstComplianceStatus,
  ProductTaxClassification,
} from "@indihub/database";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class GstFilingPeriodDto {
  @ApiProperty({ example: "072026", description: "GST return period in MMYYYY format." })
  @Matches(/^(0[1-9]|1[0-2])\d{4}$/)
  returnPeriod!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminGstFilingPeriodDto extends GstFilingPeriodDto {
  @ApiProperty()
  @IsUUID()
  sellerId!: string;
}

export class GstMarkFiledDto {
  @ApiProperty({ example: "072026" })
  @Matches(/^(0[1-9]|1[0-2])\d{4}$/)
  returnPeriod!: string;

  @ApiProperty({ example: "ARN123456789012" })
  @IsString()
  @MaxLength(100)
  filingReference!: string;
}

export class AdminGstMarkFiledDto extends GstMarkFiledDto {
  @ApiProperty()
  @IsUUID()
  sellerId!: string;
}

export class GstPeriodActionDto {
  @ApiProperty({ example: "072026" })
  @Matches(/^(0[1-9]|1[0-2])\d{4}$/)
  returnPeriod!: string;
}

export class AdminGstPeriodActionDto extends GstPeriodActionDto {
  @ApiProperty()
  @IsUUID()
  sellerId!: string;
}

export class GstDebitNoteLineDto {
  @ApiProperty({ example: "Post-sale price adjustment" })
  @IsString()
  @MaxLength(240)
  description!: string;

  @ApiPropertyOptional({ example: "610910" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsnSacCode?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 11800, description: "GST-inclusive line value in paise." })
  @IsInt()
  @Min(1)
  lineValuePaise!: number;

  @ApiProperty({ example: 18 })
  @Min(0)
  gstRatePercent!: number;

  @ApiPropertyOptional({ enum: ProductTaxClassification })
  @IsOptional()
  @IsEnum(ProductTaxClassification)
  taxClassification?: ProductTaxClassification;
}

export class CreateGstDebitNoteDto {
  @ApiProperty()
  @IsUUID()
  originalDocumentId!: string;

  @ApiProperty({ example: "Additional amount payable after invoice adjustment." })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ type: [GstDebitNoteLineDto] })
  @ValidateNested({ each: true })
  @Type(() => GstDebitNoteLineDto)
  lines!: GstDebitNoteLineDto[];
}

export class AdminCreateGstDebitNoteDto extends CreateGstDebitNoteDto {
  @ApiProperty()
  @IsUUID()
  sellerId!: string;
}

export class RecordTaxDocumentComplianceDto {
  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eInvoiceStatus?: GstComplianceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  irn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  acknowledgementNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acknowledgementDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  signedQrCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eInvoiceProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  eInvoiceProviderRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eInvoiceError?: string;

  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eWayBillStatus?: GstComplianceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  eWayBillNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eWayBillGeneratedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eWayBillValidUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eWayBillProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  eWayBillProviderRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eWayBillError?: string;
}
