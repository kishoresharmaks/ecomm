import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
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
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ApprovalStatus,
  PaymentProvider,
  RefundMethod,
  RefundRequestStatus,
  ServiceCashDisputeResolution,
  ServiceReceivableOffsetPolicy,
  ServiceReceivableTaxAccrualStatus,
  ServiceReceivableWaiverApprovalStatus,
  ServiceBookingStatus,
  ServiceCancellationInitiator,
  ServiceCancellationPolicy,
  ServiceDisputeResolution,
  ServiceListingStatus,
  ServicePaymentMode,
  ServicePaymentPurpose,
  ServicePricingModel,
  ServiceQuoteStatus,
  ServiceSellerReceivableStatus,
  ServiceVisitMode,
} from "@indihub/database";

export class ServiceAreaDto {
  @ApiPropertyOptional({ example: "Salem service radius" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM-METTU-STREET" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: "636001" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: 11.6643 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.146 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServicePackageDto {
  @ApiPropertyOptional({ example: "f2c7311c-2222-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: "Standard TV inspection" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @ApiPropertyOptional({ example: "Diagnosis and basic troubleshooting." })
  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @ApiProperty({ example: 49900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pricePaise!: number;

  @ApiPropertyOptional({ example: 79900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mrpPaise?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceListingImageDto {
  @ApiProperty({ example: "indihub/sellers/seller-id/services/tv-repair.jpg" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  url!: string;

  @ApiPropertyOptional({ example: "TV repair service" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  altText?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateServiceListingDto {
  @ApiProperty({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "LED TV repair and installation" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: "Doorstep TV diagnosis, repair, and installation support." })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: ServicePricingModel, example: ServicePricingModel.INSPECTION_FEE })
  @IsEnum(ServicePricingModel)
  pricingModel!: ServicePricingModel;

  @ApiProperty({ enum: ServicePaymentMode, example: ServicePaymentMode.INSPECTION_FEE })
  @IsEnum(ServicePaymentMode)
  paymentMode!: ServicePaymentMode;

  @ApiPropertyOptional({ enum: ServiceCancellationPolicy, example: ServiceCancellationPolicy.FLEXIBLE })
  @IsOptional()
  @IsEnum(ServiceCancellationPolicy)
  cancellationPolicy?: ServiceCancellationPolicy;

  @ApiPropertyOptional({ example: 99900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePricePaise?: number;

  @ApiPropertyOptional({ example: 29900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inspectionFeePaise?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  advanceAmountPaise?: number;

  @ApiPropertyOptional({ example: "INR" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  quoteTtlHours?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  serviceDurationMinutes?: number;

  @ApiProperty({ enum: ServiceVisitMode, isArray: true, example: [ServiceVisitMode.CUSTOMER_LOCATION] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(ServiceVisitMode, { each: true })
  allowedVisitModes!: ServiceVisitMode[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  inclusions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  exclusions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ type: [ServiceListingImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ServiceListingImageDto)
  images?: ServiceListingImageDto[];

  @ApiPropertyOptional({ type: [ServicePackageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ServicePackageDto)
  packages?: ServicePackageDto[];

  @ApiPropertyOptional({ type: [ServiceAreaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  areas?: ServiceAreaDto[];
}

export class UpdateServiceListingDto extends PartialType(CreateServiceListingDto) {}

export class ServiceListingQueryDto {
  @ApiPropertyOptional({ example: "tv repair" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-1111-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ enum: ServiceListingStatus })
  @IsOptional()
  @IsEnum(ServiceListingStatus)
  status?: ServiceListingStatus;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM-METTU-STREET" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: "636001" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: 11.6643 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.146 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

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

export class ServiceReceivableQueryDto {
  @ApiPropertyOptional({ example: "SRCV-2026" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ServiceSellerReceivableStatus })
  @IsOptional()
  @IsEnum(ServiceSellerReceivableStatus)
  status?: ServiceSellerReceivableStatus;

  @ApiPropertyOptional({ enum: ServiceReceivableTaxAccrualStatus })
  @IsOptional()
  @IsEnum(ServiceReceivableTaxAccrualStatus)
  taxAccrualStatus?: ServiceReceivableTaxAccrualStatus;

  @ApiPropertyOptional({ enum: ServiceReceivableOffsetPolicy })
  @IsOptional()
  @IsEnum(ServiceReceivableOffsetPolicy)
  offsetPolicy?: ServiceReceivableOffsetPolicy;

  @ApiPropertyOptional({ enum: ServiceReceivableWaiverApprovalStatus })
  @IsOptional()
  @IsEnum(ServiceReceivableWaiverApprovalStatus)
  waiverApprovalStatus?: ServiceReceivableWaiverApprovalStatus;

  @ApiPropertyOptional({ example: "f2c7311c-1111-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateServiceBookingDto {
  @ApiPropertyOptional({ example: "mobile_service_ac-repair_01HX6D9T0QZP7N6P8K3R2B5C4D" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{12,120}$/)
  idempotencyKey?: string;

  @ApiProperty({ example: "service-slug" })
  @IsString()
  @MinLength(2)
  @MaxLength(220)
  serviceSlug!: string;

  @ApiPropertyOptional({ example: "f2c7311c-2222-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  servicePackageId?: string;

  @ApiProperty({ enum: ServiceVisitMode, example: ServiceVisitMode.CUSTOMER_LOCATION })
  @IsEnum(ServiceVisitMode)
  visitMode!: ServiceVisitMode;

  @ApiPropertyOptional({ example: "2026-07-01T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiProperty({ example: "TV turns on but has no picture." })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  customerIssue!: string;

  @ApiPropertyOptional({ example: "Please call before arriving." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNote?: string;

  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ example: { city: "Salem", pincode: "636001" } })
  @IsOptional()
  addressSnapshot?: Record<string, unknown>;
}

export class ServiceBookingQueryDto {
  @ApiPropertyOptional({ enum: ServiceBookingStatus })
  @IsOptional()
  @IsEnum(ServiceBookingStatus)
  status?: ServiceBookingStatus;

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

export class SellerServiceBookingActionDto {
  @ApiPropertyOptional({ example: "Technician assigned." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: "2026-07-01T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledStartAt?: string;

  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;
}

export class RescheduleServiceBookingDto {
  @ApiProperty({ example: "2026-07-01T10:00:00.000Z" })
  @IsDateString()
  scheduledStartAt!: string;

  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  assignedTechnicianId?: string;

  @ApiPropertyOptional({ example: "Customer requested a later visit." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

}

export class SellerServiceAvailabilityRuleDto {
  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 1, description: "0 is Sunday, 6 is Saturday." })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: 600, description: "Minutes after midnight." })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @ApiProperty({ example: 1080, description: "Minutes after midnight." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({ example: "Morning field visits" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SellerServiceBlockedWindowDto {
  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: "2026-07-01T00:00:00.000Z" })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: "2026-07-01T23:59:00.000Z" })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: "Shop closed for inventory." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFullDay?: boolean;
}

export class SellerServiceTechnicianDto {
  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: "Arun Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name!: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: "arun@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ type: [String], example: ["AC repair", "Installation"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSellerServiceCalendarDto {
  @ApiPropertyOptional({ type: [SellerServiceAvailabilityRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => SellerServiceAvailabilityRuleDto)
  availabilityRules?: SellerServiceAvailabilityRuleDto[];

  @ApiPropertyOptional({ type: [SellerServiceBlockedWindowDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SellerServiceBlockedWindowDto)
  blockedWindows?: SellerServiceBlockedWindowDto[];

  @ApiPropertyOptional({ type: [SellerServiceTechnicianDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SellerServiceTechnicianDto)
  technicians?: SellerServiceTechnicianDto[];
}

export class QuoteLineItemDto {
  @ApiProperty({ example: "Panel repair" })
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  description!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPaise!: number;
}

export class SendServiceQuoteDto {
  @ApiProperty({ type: [QuoteLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];

  @ApiPropertyOptional({ example: "Includes parts and labour." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  ttlHours?: number;
}

export class CompletionSubmitDto {
  @ApiProperty({ example: "TV repaired and tested with customer." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  completionNote!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  completionImages?: string[];

  @ApiPropertyOptional({ type: [String], description: "Private storage asset keys for managed completion proof." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  completionProofKeys?: string[];
}

export class CancelServiceBookingDto {
  @ApiProperty({ example: "Customer unavailable at scheduled time." })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ enum: ServiceCancellationInitiator })
  @IsOptional()
  @IsEnum(ServiceCancellationInitiator)
  initiator?: ServiceCancellationInitiator;
}

export class RecordServicePaymentDto {
  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.MANUAL })
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @ApiProperty({ enum: ServicePaymentPurpose, example: ServicePaymentPurpose.PAY_AT_VISIT })
  @IsEnum(ServicePaymentPurpose)
  purpose!: ServicePaymentPurpose;

  @ApiProperty({ example: 99900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountPaise!: number;

  @ApiPropertyOptional({ example: "UPI123456" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;
}

export class RecordServiceCashCollectionDto {
  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiPropertyOptional({ enum: ServicePaymentPurpose, example: ServicePaymentPurpose.PAY_AT_VISIT })
  @IsOptional()
  @IsEnum(ServicePaymentPurpose)
  purpose?: ServicePaymentPurpose;

  @ApiPropertyOptional({ example: "cash_visit_01HX6D9T0QZP7N6P8K3R2B5C4D" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^[A-Za-z0-9:_-]{8,160}$/)
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: "SRV-2026-ABC123:VISIT-1" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^[A-Za-z0-9:_-]{8,160}$/)
  cashCollectionEventId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  attemptNumber?: number;

  @ApiPropertyOptional({ example: "Cash collected after completion visit." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class WithdrawServiceQuoteDto {
  @ApiPropertyOptional({ example: "Customer requested a revised estimate after site inspection." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ServiceFieldStatusDto {
  @ApiProperty({ enum: ["EN_ROUTE", "ARRIVED", "CHECKED_IN", "CHECKED_OUT"], example: "ARRIVED" })
  @IsIn(["EN_ROUTE", "ARRIVED", "CHECKED_IN", "CHECKED_OUT"])
  status!: "EN_ROUTE" | "ARRIVED" | "CHECKED_IN" | "CHECKED_OUT";

  @ApiPropertyOptional({ example: 11.6643 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.146 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: "Technician reached customer location." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ type: [String], description: "Private storage asset keys for technician field proof." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  fieldProofKeys?: string[];
}

export class CustomerServiceCashCollectionDecisionDto {
  @ApiPropertyOptional({ example: "Amount paid to technician after work completion." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CustomerServiceCashCollectionDisputeDto {
  @ApiProperty({ example: "Provider recorded Rs. 1500, but I paid only Rs. 1000." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  reason!: string;
}

export class ResolveServiceCashReceivableDto {
  @ApiProperty({ enum: ServiceCashDisputeResolution })
  @IsEnum(ServiceCashDisputeResolution)
  resolution!: ServiceCashDisputeResolution;

  @ApiPropertyOptional({ example: 100000, description: "Required for partial acceptance." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  acceptedCashPaise?: number;

  @ApiProperty({ example: "Customer evidence accepted for partial amount." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  note!: string;
}

export class SettleServiceReceivableDto {
  @ApiProperty({ example: 12500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiPropertyOptional({ example: "UPI-RECEIVABLE-123" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  referenceNumber?: string;

  @ApiPropertyOptional({ example: "Seller paid platform commission for cash booking." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ServiceReceivableWaiverDto {
  @ApiProperty({ example: 12500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ example: "Goodwill waiver approved by finance head." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  reason!: string;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  waiverLimitPaise?: number;
}

export class ServiceReceivableWaiverDecisionDto {
  @ApiProperty({ enum: ServiceReceivableWaiverApprovalStatus, example: ServiceReceivableWaiverApprovalStatus.APPROVED })
  @IsEnum(ServiceReceivableWaiverApprovalStatus)
  decision!: ServiceReceivableWaiverApprovalStatus;

  @ApiPropertyOptional({ example: "Approved within finance limit." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ServiceReceivableOffsetPolicyDto {
  @ApiProperty({ enum: ServiceReceivableOffsetPolicy, example: ServiceReceivableOffsetPolicy.AUTO_OFFSET_NEXT_PAYOUT })
  @IsEnum(ServiceReceivableOffsetPolicy)
  offsetPolicy!: ServiceReceivableOffsetPolicy;

  @ApiPropertyOptional({ example: "Auto offset approved for this seller." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RaiseServiceDisputeDto {
  @ApiProperty({ example: "Service issue is not resolved." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  reason!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  evidence?: string[];

  @ApiPropertyOptional({ type: [String], description: "Private storage asset keys for managed dispute evidence." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  evidenceKeys?: string[];
}

export class ResolveServiceDisputeDto {
  @ApiProperty({ enum: ServiceDisputeResolution })
  @IsEnum(ServiceDisputeResolution)
  resolution!: ServiceDisputeResolution;

  @ApiProperty({ example: "Reviewed evidence and resolved in favour of completion." })
  @IsString()
  @MinLength(5)
  @MaxLength(1500)
  adminNote!: string;

  @ApiPropertyOptional({ example: 50000, description: "Required for partial refund dispute resolution." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  refundAmountPaise?: number;
}

export class ServiceRefundQueryDto {
  @ApiPropertyOptional({ enum: RefundRequestStatus })
  @IsOptional()
  @IsEnum(RefundRequestStatus)
  status?: RefundRequestStatus;

  @ApiPropertyOptional({ example: "SRF-20260702" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: "203d0321-63f7-4998-b87e-342192335985" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApproveServiceRefundDto {
  @ApiPropertyOptional({ example: "Approved after dispute evidence review." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class InitiateServiceRefundDto {
  @ApiPropertyOptional({ enum: RefundMethod })
  @IsOptional()
  @IsEnum(RefundMethod)
  method?: RefundMethod;

  @ApiPropertyOptional({ example: "Initiate refund through original Razorpay payment." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ManualServiceRefundDto {
  @ApiProperty({ enum: RefundMethod, example: RefundMethod.BANK_TRANSFER })
  @IsEnum(RefundMethod)
  method!: RefundMethod;

  @ApiProperty({ example: "UTR1234567890" })
  @IsString()
  @MaxLength(160)
  manualReference!: string;

  @ApiProperty({ example: "2026-07-02T10:00:00.000Z" })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: "Manual refund recorded after customer confirmation." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateServiceReviewDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Technician was punctual and fixed the issue." })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  body?: string;
}

export class ServiceReviewReplyDto {
  @ApiProperty({ example: "Thank you for choosing our service." })
  @IsString()
  @MinLength(2)
  @MaxLength(1200)
  body!: string;
}

export class ServiceReviewQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ enum: ["VISIBLE", "HIDDEN", "REPLIED", "UNREPLIED"], example: "VISIBLE" })
  @IsOptional()
  @IsIn(["VISIBLE", "HIDDEN", "REPLIED", "UNREPLIED"])
  status?: "VISIBLE" | "HIDDEN" | "REPLIED" | "UNREPLIED";

  @ApiPropertyOptional({ example: "late arrival" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class AdminServiceApprovalDto {
  @ApiProperty({ enum: ApprovalStatus, example: ApprovalStatus.APPROVED })
  @IsEnum(ApprovalStatus)
  approvalStatus!: ApprovalStatus;

  @ApiPropertyOptional({ enum: ServiceListingStatus, example: ServiceListingStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ServiceListingStatus)
  status?: ServiceListingStatus;

  @ApiPropertyOptional({ example: "Approved after document and category review." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateSellerCapabilitiesDto {
  @ApiProperty({ enum: ["RETAIL", "SERVICE"], isArray: true, example: ["RETAIL", "SERVICE"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(["RETAIL", "SERVICE"], { each: true })
  enabledCapabilities!: Array<"RETAIL" | "SERVICE">;

  @ApiProperty({ enum: ["RETAIL", "SERVICE"], example: "SERVICE" })
  @IsEnum(["RETAIL", "SERVICE"])
  primaryCapability!: "RETAIL" | "SERVICE";

  @ApiProperty({ example: "Seller approved for service operations." })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class UpdateServiceQuoteStatusDto {
  @ApiProperty({ enum: ServiceQuoteStatus, example: ServiceQuoteStatus.ACCEPTED })
  @IsEnum(ServiceQuoteStatus)
  status!: ServiceQuoteStatus;
}
