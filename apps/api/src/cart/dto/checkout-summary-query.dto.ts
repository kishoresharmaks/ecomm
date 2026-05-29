import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import {
  CheckoutDeliveryPreference,
  CheckoutRoutingPaymentMethod,
} from "../../checkout/dto/delivery-routing.dto";

export class CheckoutSummaryQueryDto {
  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  buyerCountryCode?: string;

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
}
