import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  GstComplianceStatus,
  GstrSupplySection,
  ProductTaxClassification,
  SellerSettlementStatus,
  TaxDocumentStatus,
  TaxDocumentType,
} from "@indihub/database";
import { ReportQueryDto } from "./report-query.dto";

export enum OrderTaxRegisterSource {
  PRODUCT = "PRODUCT",
  SERVICE = "SERVICE",
}

export enum OrderTaxRegisterChannel {
  B2C = "B2C",
  B2B = "B2B",
}

export enum OrderTaxRegisterDateBasis {
  DOCUMENT_DATE = "DOCUMENT_DATE",
  TRANSACTION_DATE = "TRANSACTION_DATE",
  PAYMENT_DATE = "PAYMENT_DATE",
}

export enum OrderTaxReadinessStatus {
  READY = "READY",
  INCOMPLETE_DOCUMENT = "INCOMPLETE_DOCUMENT",
  MISSING_DOCUMENT = "MISSING_DOCUMENT",
  DRAFT_DOCUMENT = "DRAFT_DOCUMENT",
  CANCELLED_DOCUMENT = "CANCELLED_DOCUMENT",
  NOT_REQUIRED = "NOT_REQUIRED",
}

export enum OrderTaxReconciliationStatus {
  MATCHED = "MATCHED",
  MISMATCH = "MISMATCH",
  PARTIAL = "PARTIAL",
  NOT_COMPARABLE = "NOT_COMPARABLE",
}

export enum OrderTaxRegisterSortField {
  DATE = "DATE",
  TRANSACTION = "TRANSACTION",
  INVOICE = "INVOICE",
  SELLER = "SELLER",
  TAXABLE_VALUE = "TAXABLE_VALUE",
  TOTAL_TAX = "TOTAL_TAX",
  INVOICE_VALUE = "INVOICE_VALUE",
  READINESS = "READINESS",
  RECONCILIATION = "RECONCILIATION",
}

export enum SortDirection {
  ASC = "ASC",
  DESC = "DESC",
}

export class OrderTaxRegisterQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ enum: OrderTaxRegisterSource, default: OrderTaxRegisterSource.PRODUCT })
  @IsOptional()
  @IsEnum(OrderTaxRegisterSource)
  source?: OrderTaxRegisterSource = OrderTaxRegisterSource.PRODUCT;

  @ApiPropertyOptional({ enum: OrderTaxRegisterChannel })
  @IsOptional()
  @IsEnum(OrderTaxRegisterChannel)
  channel?: OrderTaxRegisterChannel;

  @ApiPropertyOptional({
    enum: OrderTaxRegisterDateBasis,
    default: OrderTaxRegisterDateBasis.DOCUMENT_DATE,
  })
  @IsOptional()
  @IsEnum(OrderTaxRegisterDateBasis)
  dateBasis?: OrderTaxRegisterDateBasis = OrderTaxRegisterDateBasis.DOCUMENT_DATE;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ enum: TaxDocumentStatus })
  @IsOptional()
  @IsEnum(TaxDocumentStatus)
  documentStatus?: TaxDocumentStatus;

  @ApiPropertyOptional({ enum: TaxDocumentType })
  @IsOptional()
  @IsEnum(TaxDocumentType)
  documentType?: TaxDocumentType;

  @ApiPropertyOptional({ enum: OrderTaxReadinessStatus })
  @IsOptional()
  @IsEnum(OrderTaxReadinessStatus)
  readinessStatus?: OrderTaxReadinessStatus;

  @ApiPropertyOptional({ enum: OrderTaxReconciliationStatus })
  @IsOptional()
  @IsEnum(OrderTaxReconciliationStatus)
  reconciliationStatus?: OrderTaxReconciliationStatus;

  @ApiPropertyOptional({ enum: SellerSettlementStatus })
  @IsOptional()
  @IsEnum(SellerSettlementStatus)
  settlementStatus?: SellerSettlementStatus;

  @ApiPropertyOptional({ enum: ProductTaxClassification })
  @IsOptional()
  @IsEnum(ProductTaxClassification)
  taxClassification?: ProductTaxClassification;

  @ApiPropertyOptional({ enum: GstrSupplySection })
  @IsOptional()
  @IsEnum(GstrSupplySection)
  gstrSupplySection?: GstrSupplySection;

  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eInvoiceStatus?: GstComplianceStatus;

  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eWayBillStatus?: GstComplianceStatus;

  @ApiPropertyOptional({ example: "PAID" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentStatus?: string;

  @ApiPropertyOptional({ example: "8471" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsnSacCode?: string;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  gstRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  reverseCharge?: boolean;

  @ApiPropertyOptional({ example: "MISSING_PAYMENT,SOURCE_LINK_MISSING" })
  @IsOptional()
  @Transform(({ value }) =>
    (Array.isArray(value) ? value : String(value).split(","))
      .map((item) => String(item).trim().toUpperCase())
      .filter(Boolean),
  )
  @IsString({ each: true })
  warningCodes?: string[];

  @ApiPropertyOptional({
    description: "Search transaction, invoice, payment, seller, buyer, GSTIN, HSN/SAC, or description.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: OrderTaxRegisterSortField, default: OrderTaxRegisterSortField.DATE })
  @IsOptional()
  @IsEnum(OrderTaxRegisterSortField)
  sortBy?: OrderTaxRegisterSortField = OrderTaxRegisterSortField.DATE;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.DESC })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
