import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class VerifyRazorpayPaymentDto {
  @ApiProperty({ example: "order_RB58MiP5SPFYyM" })
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  razorpayOrderId!: string;

  @ApiProperty({ example: "pay_RB58e1AbCdEfGh" })
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  razorpayPaymentId!: string;

  @ApiProperty({ example: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d" })
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  razorpaySignature!: string;
}
