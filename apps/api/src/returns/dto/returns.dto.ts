import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  DeliveryAssignmentStatus,
  RefundMethod,
  RefundRequestStatus,
  ReturnRequestResolution,
  ReturnRequestStatus,
  ReverseShipmentMode,
  ReverseShipmentStatus,
} from "@indihub/database";

export enum ReversePickupDecision {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
}

export class ReturnOrderItemDto {
  @ApiProperty({ example: "70cf4fb8-44b7-4ff0-b65c-5987c72f91ab" })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class CreateCancellationDto {
  @ApiPropertyOptional({
    type: [ReturnOrderItemDto],
    description: "When omitted, all cancellable active quantities in the order are cancelled.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnOrderItemDto)
  items?: ReturnOrderItemDto[];

  @ApiPropertyOptional({ example: "Ordered by mistake." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;

  @ApiPropertyOptional({ example: "Please cancel only the selected quantity." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateReturnRequestDto {
  @ApiProperty({ enum: ReturnRequestResolution, example: ReturnRequestResolution.REFUND })
  @IsEnum(ReturnRequestResolution)
  resolution!: ReturnRequestResolution;

  @ApiProperty({ example: "Product is damaged." })
  @IsString()
  @MaxLength(160)
  reason!: string;

  @ApiPropertyOptional({ example: "Box is available and item is unused." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ type: [ReturnOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnOrderItemDto)
  items!: ReturnOrderItemDto[];

  @ApiPropertyOptional({ enum: ReverseShipmentMode })
  @IsOptional()
  @IsEnum(ReverseShipmentMode)
  reverseShipmentMode?: ReverseShipmentMode;
}

export class ReturnListQueryDto {
  @ApiPropertyOptional({ enum: ReturnRequestStatus })
  @IsOptional()
  @IsEnum(ReturnRequestStatus)
  status?: ReturnRequestStatus;

  @ApiPropertyOptional({ example: "1HI-RET-20260609-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous list response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class RefundListQueryDto {
  @ApiPropertyOptional({ enum: RefundRequestStatus })
  @IsOptional()
  @IsEnum(RefundRequestStatus)
  status?: RefundRequestStatus;

  @ApiPropertyOptional({ example: "1HI-RFD-20260609-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous list response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class UpdateReturnStatusDto {
  @ApiProperty({ enum: ReturnRequestStatus })
  @IsEnum(ReturnRequestStatus)
  status!: ReturnRequestStatus;

  @ApiPropertyOptional({ example: "Approved after policy check." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReturnQcDto {
  @ApiProperty({ enum: [ReturnRequestStatus.QC_PASSED, ReturnRequestStatus.QC_FAILED] })
  @IsEnum(ReturnRequestStatus)
  status!: ReturnRequestStatus;

  @ApiPropertyOptional({ example: "Item condition matched customer report." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SellerReturnNoteDto {
  @ApiProperty({ example: "Invoice copy verified by store team." })
  @IsString()
  @MaxLength(1000)
  note!: string;
}

export class ApproveRefundDto {
  @ApiPropertyOptional({ example: "Finance approved after QC." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class InitiateRefundDto {
  @ApiPropertyOptional({ enum: RefundMethod })
  @IsOptional()
  @IsEnum(RefundMethod)
  method?: RefundMethod;

  @ApiPropertyOptional({ example: "Initiate via original payment method." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ManualRefundDto {
  @ApiProperty({ enum: RefundMethod, example: RefundMethod.BANK_TRANSFER })
  @IsEnum(RefundMethod)
  method!: RefundMethod;

  @ApiProperty({ example: "UTR1234567890" })
  @IsString()
  @MaxLength(160)
  manualReference!: string;

  @ApiProperty({ example: "2026-06-09T10:00:00.000Z" })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: "Refund paid manually after gateway retry failed." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReversePickupUpdateDto {
  @ApiProperty({ enum: ReverseShipmentStatus })
  @IsEnum(ReverseShipmentStatus)
  status!: ReverseShipmentStatus;

  @ApiPropertyOptional({ example: "RET123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  awbNumber?: string;

  @ApiPropertyOptional({ example: "Local partner" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  courierName?: string;

  @ApiPropertyOptional({ example: "RET-TRACK-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  trackingReference?: string;

  @ApiPropertyOptional({ example: "proofs/returns/photo-1.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  proofReference?: string;

  @ApiPropertyOptional({ example: "proofs/returns/customer-pickup.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pickupProofReference?: string;

  @ApiPropertyOptional({ example: "proofs/returns/seller-receipt.jpg" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  receiptProofReference?: string;

  @ApiPropertyOptional({ example: "Harini Store manager" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receivedByName?: string;

  @ApiPropertyOptional({ example: "Picked up from customer gate." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReversePickupAssignmentDto {
  @ApiPropertyOptional({ example: "2d6f5f7c-0b6a-4d65-93b8-3c5b8c62d6f1" })
  @IsOptional()
  @IsUUID()
  deliveryPartnerUserId?: string | null;

  @ApiPropertyOptional({ example: "Assigned by return operations." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assignmentNote?: string;
}

export class ReversePickupDecisionDto {
  @ApiProperty({ enum: ReversePickupDecision })
  @IsEnum(ReversePickupDecision)
  decision!: ReversePickupDecision;

  @ApiPropertyOptional({ example: "Accepted for today pickup route." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReversePickupDecisionNoteDto {
  @ApiPropertyOptional({ example: "Accepted for today pickup route." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReversePickupReleaseDto {
  @ApiPropertyOptional({ example: "Partner did not accept before timeout." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReversePickupListQueryDto extends ReturnListQueryDto {
  @ApiPropertyOptional({ enum: DeliveryAssignmentStatus })
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  assignmentStatus?: DeliveryAssignmentStatus;
}
