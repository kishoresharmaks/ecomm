import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  B2BCollectionTaskStatus,
  B2BCreditDecisionStatus,
  B2BDisputeResolutionType,
  B2BErpConnectionStatus,
  B2BFulfilmentSource,
  B2BPaymentMethod,
  B2BPaymentRecordStatus,
  B2BPaymentTermType,
  B2BPoReviewStatus,
  B2BProcurementStatus,
  B2BProductionStatus,
  B2BQcStatus,
  B2BReceivableStatus,
  B2BShipmentStatus,
  B2BSupportCaseStatus,
  B2BSupportCaseType,
  B2BWarehouseTaskStatus,
  B2BWarehouseTaskType,
} from "@indihub/database";

export class B2BOperationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class VersionedB2BActionDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class B2BControlActionDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class B2BAmendmentLineChangeDto {
  @ApiProperty()
  @IsUUID()
  orderLineId!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPricePaise?: number;
}

export class CreateB2BOrderAmendmentDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ type: [B2BAmendmentLineChangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => B2BAmendmentLineChangeDto)
  lines?: B2BAmendmentLineChangeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  deliveryAddressSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  paymentDueAt?: string;
}

export class DecideB2BOrderAmendmentDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsBoolean()
  approved!: boolean;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ResolveB2BDisputeDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BDisputeResolutionType })
  @IsEnum(B2BDisputeResolutionType)
  resolutionType!: B2BDisputeResolutionType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  acceptedQuantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rejectedQuantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  returnQuantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  replacementQuantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmountPaise?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivableAdjustmentPaise?: number;
}

export class ReconcileB2BFinanceDto extends VersionedB2BActionDto {
  @ApiProperty({ default: false })
  @IsBoolean()
  correct!: boolean;
}

export class ReviewB2BPoDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BPoReviewStatus })
  @IsEnum(B2BPoReviewStatus)
  status!: B2BPoReviewStatus;

  @ApiProperty()
  @IsBoolean()
  documentMatched!: boolean;

  @ApiProperty()
  @IsBoolean()
  priceMatched!: boolean;

  @ApiProperty()
  @IsBoolean()
  quantityMatched!: boolean;

  @ApiProperty()
  @IsBoolean()
  deliveryTermsMatched!: boolean;

  @ApiProperty()
  @IsBoolean()
  stockChecked!: boolean;

  @ApiProperty()
  @IsBoolean()
  taxDataChecked!: boolean;

  @ApiProperty()
  @IsBoolean()
  creditChecked!: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  exceptionCodes?: string[];

  @ApiPropertyOptional({ enum: B2BPaymentTermType })
  @IsOptional()
  @IsEnum(B2BPaymentTermType)
  paymentTermType?: B2BPaymentTermType;
}

export class UpsertB2BCreditProfileDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditLimitPaise!: number;

  @ApiProperty({ enum: B2BPaymentTermType, isArray: true })
  @IsArray()
  @IsEnum(B2BPaymentTermType, { each: true })
  allowedTerms!: B2BPaymentTermType[];

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  holdReason?: string;
}

export class DecideB2BCreditDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BCreditDecisionStatus })
  @IsEnum(B2BCreditDecisionStatus)
  status!: B2BCreditDecisionStatus;

  @ApiProperty({ enum: B2BPaymentTermType })
  @IsEnum(B2BPaymentTermType)
  paymentTermType!: B2BPaymentTermType;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approvedAmountPaise?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  overrideExpiresAt?: string;
}

export class B2BFulfilmentPlanLineDto {
  @ApiProperty()
  @IsUUID()
  orderLineId!: string;

  @ApiProperty({ enum: B2BFulfilmentSource })
  @IsEnum(B2BFulfilmentSource)
  source!: B2BFulfilmentSource;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plannedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedReadyAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpsertB2BFulfilmentPlansDto extends VersionedB2BActionDto {
  @ApiProperty({ type: [B2BFulfilmentPlanLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => B2BFulfilmentPlanLineDto)
  lines!: B2BFulfilmentPlanLineDto[];
}

export class CreateB2BProcurementDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsUUID()
  fulfilmentPlanId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplierReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedAt?: string;
}

export class UpdateB2BProcurementDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BProcurementStatus })
  @IsEnum(B2BProcurementStatus)
  status!: B2BProcurementStatus;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  receivedQuantity!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rejectedQuantity?: number;
}

export class CreateB2BProductionDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsUUID()
  fulfilmentPlanId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  materialNotes?: string;
}

export class UpdateB2BProductionDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BProductionStatus })
  @IsEnum(B2BProductionStatus)
  status!: B2BProductionStatus;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedQuantity!: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rejectedQuantity?: number;
}

export class CreateB2BWarehouseTaskDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BWarehouseTaskType })
  @IsEnum(B2BWarehouseTaskType)
  taskType!: B2BWarehouseTaskType;
}

export class B2BWarehouseTaskItemResultDto {
  @ApiProperty()
  @IsUUID()
  orderLineId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exceptionNote?: string;
}

export class CompleteB2BWarehouseTaskDto extends VersionedB2BActionDto {
  @ApiProperty({ enum: B2BWarehouseTaskStatus })
  @IsEnum(B2BWarehouseTaskStatus)
  status!: B2BWarehouseTaskStatus;

  @ApiProperty({ type: [B2BWarehouseTaskItemResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => B2BWarehouseTaskItemResultDto)
  items!: B2BWarehouseTaskItemResultDto[];
}

export class CreateB2BPackageDto extends VersionedB2BActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  breadthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  heightCm?: number;

  @ApiProperty()
  @IsObject()
  itemAllocations!: Record<string, number>;
}

export class RecordB2BQcDto extends VersionedB2BActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @ApiProperty({ enum: B2BQcStatus })
  @IsEnum(B2BQcStatus)
  status!: B2BQcStatus;

  @ApiProperty()
  @IsObject()
  checklist!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceFileKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  failureReason?: string;
}

export class CreateB2BShipmentDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsObject()
  deliveryAddressSnapshot!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  packageIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedDeliveryUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  transporterName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  transporterGstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lrNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  awbNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleNumber?: string;
}

export class DispatchB2BShipmentDto extends VersionedB2BActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  transporterName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lrNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  awbNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleNumber?: string;
}

export class AssignB2BShipmentDto extends VersionedB2BActionDto {
  @ApiProperty()
  @IsUUID()
  deliveryUserId!: string;
}

export class UpdateB2BShipmentEventDto {
  @ApiProperty({ enum: B2BShipmentStatus })
  @IsEnum(B2BShipmentStatus)
  status!: B2BShipmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RecordB2BPodDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  receiverName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  receiverPhone?: string;

  @ApiProperty()
  @IsISO8601()
  deliveredAt!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  proofFileKeys!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  signatureFileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DecideB2BDeliveryDto extends VersionedB2BActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  disputeReason?: string;
}

export class CreateB2BPaymentRecordDto {
  @ApiProperty({ enum: B2BPaymentMethod })
  @IsEnum(B2BPaymentMethod)
  method!: B2BPaymentMethod;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  referenceNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofFileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  chequeNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  chequeBankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  chequeDate?: string;
}

export class CreateB2BOnlinePaymentDto {
  @ApiProperty({ enum: [B2BPaymentMethod.RAZORPAY, B2BPaymentMethod.UPI] })
  @IsIn([B2BPaymentMethod.RAZORPAY, B2BPaymentMethod.UPI])
  method!: Extract<B2BPaymentMethod, "RAZORPAY" | "UPI">;

  @ApiProperty({ minimum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  amountPaise!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentScheduleId?: string;
}

export class VerifyB2BOnlinePaymentDto {
  @ApiProperty()
  @IsUUID()
  paymentRecordId!: string;

  @ApiProperty({ example: "order_RB58MiP5SPFYyM" })
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  razorpayOrderId!: string;

  @ApiProperty({ example: "pay_RB58e1AbCdEfGh" })
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  razorpaySignature!: string;
}

export class VerifyB2BPaymentRecordDto {
  @ApiProperty({ enum: B2BPaymentRecordStatus })
  @IsEnum(B2BPaymentRecordStatus)
  status!: B2BPaymentRecordStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateB2BCollectionTaskDto {
  @ApiProperty()
  @IsUUID()
  receivableId!: string;

  @ApiProperty()
  @IsISO8601()
  dueAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateB2BCollectionTaskDto {
  @ApiProperty({ enum: B2BCollectionTaskStatus })
  @IsEnum(B2BCollectionTaskStatus)
  status!: B2BCollectionTaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  promiseToPayAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  nextReminderAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateB2BSupportCaseDto {
  @ApiProperty({ enum: B2BSupportCaseType })
  @IsEnum(B2BSupportCaseType)
  caseType!: B2BSupportCaseType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(3000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderLineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taxDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  paymentRecordId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceFileKeys?: string[];
}

export class UpdateB2BSupportCaseDto {
  @ApiProperty({ enum: B2BSupportCaseStatus })
  @IsEnum(B2BSupportCaseStatus)
  status!: B2BSupportCaseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  resolution?: string;
}

export class CreateB2BErpConnectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl!: string;

  @ApiProperty()
  @IsObject()
  authConfig!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(500)
  signingSecret!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  subscribedEvents!: string[];
}

export class UpdateB2BErpConnectionDto {
  @ApiProperty({ enum: B2BErpConnectionStatus })
  @IsEnum(B2BErpConnectionStatus)
  status!: B2BErpConnectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(500)
  signingSecret?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subscribedEvents?: string[];
}

export class B2BReceivableQueryDto extends B2BOperationsQueryDto {
  @ApiPropertyOptional({ enum: B2BReceivableStatus })
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsEnum(B2BReceivableStatus)
  declare status?: B2BReceivableStatus;
}
