import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { DeliveryMode } from "@indihub/database";
import { CheckoutDeliveryPreference } from "../../checkout/dto/delivery-routing.dto";

const locationSources = ["GPS", "MAP_PICK", "MANUAL", "REVERSE_GEOCODE"] as const;

export enum CheckoutPaymentMethod {
  RAZORPAY = "RAZORPAY",
  COD = "COD",
  BANK_TRANSFER = "BANK_TRANSFER",
  MANUAL = "MANUAL"
}

export class CheckoutShippingAddressDto {
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

  @ApiPropertyOptional({ example: "IN-TN-CBE-GANDHIPURAM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  localAreaCode?: string;

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

  @ApiPropertyOptional({ enum: locationSources, example: "MAP_PICK" })
  @IsOptional()
  @IsIn(locationSources)
  locationSource?: (typeof locationSources)[number];

  @ApiPropertyOptional({ example: 24.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  accuracyMeters?: number;

  @ApiPropertyOptional({ example: 92 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  locationConfidenceScore?: number;
}

export class PlaceOrderDto {
  @ApiPropertyOptional({ example: "mobile_cart_01HX6D9T0QZP7N6P8K3R2B5C4D" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9:_-]{12,120}$/)
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: "f2c7311c-6666-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ type: CheckoutShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutShippingAddressDto)
  shippingAddress?: CheckoutShippingAddressDto;

  @ApiPropertyOptional({
    enum: CheckoutDeliveryPreference,
    default: CheckoutDeliveryPreference.DELIVER_TO_ADDRESS,
  })
  @IsOptional()
  @IsEnum(CheckoutDeliveryPreference)
  deliveryPreference?: CheckoutDeliveryPreference;

  @ApiPropertyOptional({
    enum: DeliveryMode,
    description: "Legacy compatibility field. New customer checkout should send deliveryPreference only.",
  })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiProperty({ enum: CheckoutPaymentMethod, default: CheckoutPaymentMethod.COD })
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod!: CheckoutPaymentMethod;

  @ApiPropertyOptional({ example: "UTR1234567890" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentReference?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999999)
  shippingPaise?: number;

  @ApiPropertyOptional({ example: "Please call before delivery." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  @ApiPropertyOptional({ example: "SAVE10" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/)
  couponCode?: string;

  @ApiPropertyOptional({ example: "GB" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  buyerCountryCode?: string;
}
