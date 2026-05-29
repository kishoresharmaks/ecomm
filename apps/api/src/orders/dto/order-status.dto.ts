import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { OrderStatus, PaymentStatus, SellerOrderStatus } from "@indihub/database";

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ example: "Confirmed by admin after stock check." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateSellerOrderStatusDto {
  @ApiProperty({ enum: SellerOrderStatus })
  @IsEnum(SellerOrderStatus)
  sellerStatus!: SellerOrderStatus;

  @ApiPropertyOptional({ example: "Seller packed the item." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

