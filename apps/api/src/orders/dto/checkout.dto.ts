import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
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
}

export class PlaceOrderDto {
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

  @ApiPropertyOptional({ example: "GB" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  buyerCountryCode?: string;
}
