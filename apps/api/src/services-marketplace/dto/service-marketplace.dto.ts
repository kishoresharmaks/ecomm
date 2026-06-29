import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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
  ServiceBookingStatus,
  ServiceCancellationInitiator,
  ServiceCancellationPolicy,
  ServiceDisputeResolution,
  ServiceListingStatus,
  ServicePaymentMode,
  ServicePaymentPurpose,
  ServicePricingModel,
  ServiceQuoteStatus,
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
