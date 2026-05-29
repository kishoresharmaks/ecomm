import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from "class-validator";
import {
  CourierProviderMode,
  DeliveryMode,
  ShippingCodSurchargeType,
} from "@indihub/database";

export enum CheckoutDeliveryPreference {
  STORE_PICKUP = "STORE_PICKUP",
  DELIVER_TO_ADDRESS = "DELIVER_TO_ADDRESS",
}

export enum CheckoutRoutingPaymentMethod {
  RAZORPAY = "RAZORPAY",
  COD = "COD",
  BANK_TRANSFER = "BANK_TRANSFER",
  MANUAL = "MANUAL",
}

export class CheckoutRoutingAddressDto {
  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: "+919876543210" })
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  phone!: string;

  @ApiProperty({ example: "12 Market Road" })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  line1!: string;

  @ApiPropertyOptional({ example: "Near Central Bus Stand" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @ApiPropertyOptional({ example: "Gandhipuram" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @ApiPropertyOptional({ example: "Coimbatore" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: "Tamil Nadu" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: "641012" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-CBE" })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  cityCode?: string;

  @ApiPropertyOptional({ example: "PIN-641012-ABCD1234" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;
}

export class ResolveCheckoutDeliveryDto {
  @ApiProperty({ enum: CheckoutDeliveryPreference })
  @IsEnum(CheckoutDeliveryPreference)
  deliveryPreference!: CheckoutDeliveryPreference;

  @ApiPropertyOptional({ example: "f2c7311c-6666-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressId?: string;

  @ApiPropertyOptional({ type: CheckoutRoutingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutRoutingAddressDto)
  shippingAddress?: CheckoutRoutingAddressDto;

  @ApiPropertyOptional({ enum: CheckoutRoutingPaymentMethod, default: CheckoutRoutingPaymentMethod.COD })
  @IsOptional()
  @IsEnum(CheckoutRoutingPaymentMethod)
  paymentMethod?: CheckoutRoutingPaymentMethod;
}

export class UpsertShippingRateCardDto {
  @ApiProperty({ example: "Salem local delivery" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: DeliveryMode })
  @IsEnum(DeliveryMode)
  deliveryMode!: DeliveryMode;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SALEM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityCode?: string;

  @ApiPropertyOptional({ example: "636114" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @ApiPropertyOptional({ example: "PIN-636114-708A9748" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSubtotalPaise?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSubtotalPaise?: number;

  @ApiPropertyOptional({ example: 4900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shippingChargePaise?: number;

  @ApiPropertyOptional({ example: 99900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  freeAbovePaise?: number;

  @ApiPropertyOptional({ enum: ShippingCodSurchargeType, default: ShippingCodSurchargeType.NONE })
  @IsOptional()
  @IsEnum(ShippingCodSurchargeType)
  codSurchargeType?: ShippingCodSurchargeType;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  codSurchargeFlatPaise?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  codSurchargeBps?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: "Admin-managed rate for Salem local delivery." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateRateCardActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

export class UpsertCourierProviderSettingDto {
  @ApiProperty({ example: "PROVIDER_CODE" })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  providerCode!: string;

  @ApiProperty({ example: "Courier Partner" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional({ enum: CourierProviderMode, default: CourierProviderMode.MANUAL })
  @IsOptional()
  @IsEnum(CourierProviderMode)
  mode?: CourierProviderMode;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: ["IN", "US", "GB"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceableCountryCodes?: string[];

  @ApiPropertyOptional({ example: "GENERIC_REST" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  adapterCode?: string;

  @ApiPropertyOptional({ example: "https://api.courier-provider.example" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBaseUrl?: string;

  @ApiPropertyOptional({ example: "/v1/shipments/book" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  bookingEndpointPath?: string;

  @ApiPropertyOptional({ example: "/v1/shipments/track" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  trackingEndpointPath?: string;

  @ApiPropertyOptional({ example: "/v1/shipments/label" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  labelEndpointPath?: string;

  @ApiPropertyOptional({ example: "/v1/shipments/cancel" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  cancellationEndpointPath?: string;

  @ApiPropertyOptional({ example: "merchant-account-code" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountCode?: string;

  @ApiPropertyOptional({ example: "api-user" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  username?: string;

  @ApiPropertyOptional({ example: "new-api-key-or-token" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;

  @ApiPropertyOptional({ example: "new-api-secret" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiSecret?: string;

  @ApiPropertyOptional({ example: "new-api-password" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  password?: string;

  @ApiPropertyOptional({ example: "new-webhook-secret" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  webhookSecret?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  credentialsConfigured?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  webhookSecretConfigured?: boolean;

  @ApiPropertyOptional({ example: "Credentials are stored outside source code." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateCourierProviderActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

export class RoutingSimulatorDto {
  @ApiProperty({ enum: CheckoutDeliveryPreference })
  @IsEnum(CheckoutDeliveryPreference)
  deliveryPreference!: CheckoutDeliveryPreference;

  @ApiPropertyOptional({ type: CheckoutRoutingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutRoutingAddressDto)
  shippingAddress?: CheckoutRoutingAddressDto;

  @ApiPropertyOptional({ example: 48900 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalPaise?: number;

  @ApiPropertyOptional({ enum: CheckoutRoutingPaymentMethod, default: CheckoutRoutingPaymentMethod.COD })
  @IsOptional()
  @IsEnum(CheckoutRoutingPaymentMethod)
  paymentMethod?: CheckoutRoutingPaymentMethod;
}
