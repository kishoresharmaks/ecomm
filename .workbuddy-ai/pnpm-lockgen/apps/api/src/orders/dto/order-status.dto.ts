import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
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

  @ApiPropertyOptional({ example: "123456789012" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: "E-Way Bill Number must contain exactly 12 digits." })
  ewayBillNumber?: string;
}

export class CorrectPackageEWayBillDto {
  @ApiProperty({ example: "123456789012" })
  @IsString()
  @Matches(/^\d{12}$/, { message: "E-Way Bill Number must contain exactly 12 digits." })
  ewayBillNumber!: string;

  @ApiProperty({ example: "Corrected against the statutory E-Way Bill document." })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
