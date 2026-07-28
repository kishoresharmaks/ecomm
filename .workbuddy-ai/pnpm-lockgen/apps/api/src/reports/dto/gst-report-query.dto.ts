import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import {
  GstComplianceStatus,
  GstrSupplySection,
  ProductTaxClassification,
  SellerTaxRegistrationStatus,
  TaxDocumentType,
} from "@indihub/database";
import { ReportQueryDto } from "./report-query.dto";

export class AdminGstReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ enum: SellerTaxRegistrationStatus })
  @IsOptional()
  @IsEnum(SellerTaxRegistrationStatus)
  sellerTaxRegistrationStatus?: SellerTaxRegistrationStatus;
}

export class GstDocumentQueryDto extends AdminGstReportQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 25, default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({ enum: TaxDocumentType })
  @IsOptional()
  @IsEnum(TaxDocumentType)
  documentType?: TaxDocumentType;

  @ApiPropertyOptional({ enum: GstrSupplySection })
  @IsOptional()
  @IsEnum(GstrSupplySection)
  section?: GstrSupplySection;

  @ApiPropertyOptional({ enum: ProductTaxClassification })
  @IsOptional()
  @IsEnum(ProductTaxClassification)
  taxClassification?: ProductTaxClassification;

  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eInvoiceStatus?: GstComplianceStatus;

  @ApiPropertyOptional({ enum: GstComplianceStatus })
  @IsOptional()
  @IsEnum(GstComplianceStatus)
  eWayBillStatus?: GstComplianceStatus;

  @ApiPropertyOptional({
    example: "TI/26-27/000001",
    description: "Search document, order, seller, buyer, or GSTIN fields.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class SellerGstDocumentQueryDto extends OmitType(GstDocumentQueryDto, [
  "sellerId",
] as const) {}
