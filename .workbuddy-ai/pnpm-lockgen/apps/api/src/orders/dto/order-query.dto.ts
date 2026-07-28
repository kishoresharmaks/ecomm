import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { DeliveryStatus, OrderStatus, PaymentStatus } from "@indihub/database";
import { CheckoutPaymentMethod } from "./checkout.dto";

export class OrderQueryDto {
  @ApiPropertyOptional({ example: "1HI202605230001" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  search?: string;

  @ApiPropertyOptional({ enum: OrderStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  orderStatus?: OrderStatus[];

  @ApiPropertyOptional({ enum: PaymentStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(PaymentStatus, { each: true })
  paymentStatus?: PaymentStatus[];

  @ApiPropertyOptional({ enum: DeliveryStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(DeliveryStatus, { each: true })
  deliveryStatus?: DeliveryStatus[];

  @ApiPropertyOptional({ enum: CheckoutPaymentMethod, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(CheckoutPaymentMethod, { each: true })
  paymentMethod?: CheckoutPaymentMethod[];

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

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous list response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}
