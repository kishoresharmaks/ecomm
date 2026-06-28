import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
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
} from "class-validator";
import {
  CheckoutDeliveryPreference,
  CheckoutRoutingPaymentMethod,
} from "../../checkout/dto/delivery-routing.dto";

export class CheckoutSummaryQueryDto {
  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  buyerCountryCode?: string;

  @ApiPropertyOptional({ example: "b9b5f7ec-64f8-42d3-a2ff-82fd11fb0421" })
  @IsOptional()
  @IsUUID()
  directProductVariantId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  directQuantity?: number;

  @ApiPropertyOptional({ example: "SAVE10" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/)
  couponCode?: string;

  @ApiPropertyOptional({ enum: CheckoutDeliveryPreference })
  @IsOptional()
  @IsEnum(CheckoutDeliveryPreference)
  deliveryPreference?: CheckoutDeliveryPreference;

  @ApiPropertyOptional({ enum: CheckoutRoutingPaymentMethod })
  @IsOptional()
  @IsEnum(CheckoutRoutingPaymentMethod)
  paymentMethod?: CheckoutRoutingPaymentMethod;

  @ApiPropertyOptional({ example: "f2c7311c-6666-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressId?: string;

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
}
