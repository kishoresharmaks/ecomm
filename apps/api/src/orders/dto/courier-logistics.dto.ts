import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  CourierCodRemittanceStatus,
  CourierShipmentStatus,
  DeliveryAssignmentStatus,
  DeliveryMode,
  OrderShipmentPackageStatus,
} from "@indihub/database";

export class CourierShipmentQueryDto {
  @ApiPropertyOptional({ example: "COURIER_PROVIDER" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  providerCode?: string;

  @ApiPropertyOptional({ enum: CourierShipmentStatus })
  @IsOptional()
  @IsEnum(CourierShipmentStatus)
  trackingStatus?: CourierShipmentStatus;

  @ApiPropertyOptional({ example: "AWB123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CourierPackageQueryDto {
  @ApiPropertyOptional({ enum: DeliveryMode })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiPropertyOptional({ enum: OrderShipmentPackageStatus })
  @IsOptional()
  @IsEnum(OrderShipmentPackageStatus)
  packageStatus?: OrderShipmentPackageStatus;

  @ApiPropertyOptional({ enum: CourierShipmentStatus })
  @IsOptional()
  @IsEnum(CourierShipmentStatus)
  trackingStatus?: CourierShipmentStatus;

  @ApiPropertyOptional({ example: "SHIPROCKET" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  providerCode?: string;

  @ApiPropertyOptional({ example: "1HI202606040001" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CourierRoutingFailureQueryDto {
  @ApiPropertyOptional({ example: "641002" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CourierRoutingOverrideDto {
  @ApiPropertyOptional({ enum: DeliveryMode })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiPropertyOptional({ example: "SHIPROCKET" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  courierProviderCode?: string;

  @ApiPropertyOptional({ example: "2d6f5f7c-0b6a-4d65-93b8-3c5b8c62d6f1" })
  @IsOptional()
  @IsUUID()
  deliveryPartnerUserId?: string | null;

  @ApiPropertyOptional({ example: "Manual override by courier manager." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CourierLocalDeliveryQueryDto {
  @ApiPropertyOptional({ enum: DeliveryAssignmentStatus })
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  assignmentStatus?: DeliveryAssignmentStatus;

  @ApiPropertyOptional({ example: "641002" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CourierLocalDeliveryAssignmentDto {
  @ApiPropertyOptional({ example: "2d6f5f7c-0b6a-4d65-93b8-3c5b8c62d6f1" })
  @IsOptional()
  @IsUUID()
  deliveryPartnerUserId?: string | null;

  @ApiPropertyOptional({ example: "Assigned from courier operations workspace." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assignmentNote?: string;
}

export class BookCourierShipmentDto {
  @ApiProperty({ example: "COURIER_PROVIDER" })
  @IsString()
  @MaxLength(40)
  providerCode!: string;

  @ApiPropertyOptional({ example: "AWB123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  awbNumber?: string;

  @ApiPropertyOptional({ example: "XB_ORDER_123" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerOrderId?: string;

  @ApiPropertyOptional({ example: "https://provider.example/label.pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  labelUrl?: string;

  @ApiPropertyOptional({ example: "https://provider.example/track/AWB123" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  trackingUrl?: string;

  @ApiPropertyOptional({ example: "Booked manually from provider dashboard." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateCourierTrackingDto {
  @ApiProperty({ enum: CourierShipmentStatus })
  @IsEnum(CourierShipmentStatus)
  trackingStatus!: CourierShipmentStatus;

  @ApiPropertyOptional({ example: "Reached Chennai hub." })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  trackingStatusLabel?: string;

  @ApiPropertyOptional({ example: "Manual courier status update." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateSellerShipmentPackageDto {
  @ApiPropertyOptional({ example: 750 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lengthCm?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  breadthCm?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  heightCm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  markReadyForBooking?: boolean;
}

export class CourierCodRemittanceQueryDto {
  @ApiPropertyOptional({ enum: CourierCodRemittanceStatus })
  @IsOptional()
  @IsEnum(CourierCodRemittanceStatus)
  status?: CourierCodRemittanceStatus;

  @ApiPropertyOptional({ example: "COURIER_PROVIDER" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  providerCode?: string;

  @ApiPropertyOptional({ example: "AWB123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class UpsertCourierCodRemittanceDto {
  @ApiPropertyOptional({ example: "1HI20260528701338-S01" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shipmentNumber?: string;

  @ApiPropertyOptional({ example: "AWB123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  awbNumber?: string;

  @ApiPropertyOptional({ example: "0ab73a4c-2f21-4d5f-8d08-7a6bb7e52041" })
  @IsOptional()
  @IsUUID()
  courierShipmentId?: string;

  @ApiPropertyOptional({ example: 48900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  collectedAmountPaise?: number;

  @ApiProperty({ example: 48900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  remittedAmountPaise!: number;

  @ApiPropertyOptional({ example: "2026-05-30" })
  @IsOptional()
  @IsDateString()
  remittanceDate?: string;

  @ApiPropertyOptional({ example: "UTR1234567890" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  remittanceReference?: string;

  @ApiPropertyOptional({ example: "XB-COD-REPORT-2026-05-30" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reportReference?: string;

  @ApiPropertyOptional({ example: "Imported from provider COD report." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ImportCourierCodRemittanceReportDto {
  @ApiPropertyOptional({ example: "SHIPROCKET-COD-REPORT-2026-05-31" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reportReference?: string;

  @ApiProperty({ type: [UpsertCourierCodRemittanceDto] })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertCourierCodRemittanceDto)
  rows!: UpsertCourierCodRemittanceDto[];
}

export class VerifyCourierCodRemittanceDto {
  @ApiProperty({ enum: ["VERIFY", "DISPUTE", "REJECT"] })
  @IsIn(["VERIFY", "DISPUTE", "REJECT"])
  decision!: "VERIFY" | "DISPUTE" | "REJECT";

  @ApiPropertyOptional({ example: "Matched courier remittance report and bank credit." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
