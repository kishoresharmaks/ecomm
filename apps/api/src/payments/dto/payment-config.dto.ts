import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class RazorpayConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ["TEST", "LIVE"] })
  @IsOptional()
  @IsIn(["TEST", "LIVE"])
  mode?: "TEST" | "LIVE";

  @ApiPropertyOptional({ example: "rzp_test_abc123" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyId?: string;

  @ApiPropertyOptional({ example: "secret" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  keySecret?: string;

  @ApiPropertyOptional({ example: "webhook_secret" })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  webhookSecret?: string;

  @ApiPropertyOptional({ example: false, description: "WARNING: Setting this to true will clear the stored key secret. This action cannot be undone." })
  @IsOptional()
  @IsBoolean()
  clearKeySecret?: boolean;

  @ApiPropertyOptional({ example: false, description: "WARNING: Setting this to true will clear the stored webhook secret. This action cannot be undone." })
  @IsOptional()
  @IsBoolean()
  clearWebhookSecret?: boolean;
}

export class CodConfigDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: "Keep exact cash ready. Our delivery partner will collect payment on delivery." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @ApiPropertyOptional({ example: 5000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  maxOrderPaise?: number;
}

export class SimplePaymentMethodConfigDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class BankTransferConfigDto extends SimplePaymentMethodConfigDto {
  @ApiPropertyOptional({ example: "1HandIndia Marketplace Private Limited" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  accountHolderName?: string;

  @ApiPropertyOptional({ example: "HDFC Bank" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bankName?: string;

  @ApiPropertyOptional({ example: "123456789012" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountNumber?: string;

  @ApiPropertyOptional({ example: "HDFC0001234" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifscCode?: string;

  @ApiPropertyOptional({ example: "Coimbatore Main" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  branch?: string;

  @ApiPropertyOptional({ example: "payments@upi" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  upiId?: string;

  @ApiPropertyOptional({ example: "Transfer the payable amount and enter the UTR/reference after payment." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  referenceRequired?: boolean;
}

export class UpsertPaymentConfigurationDto {
  @ApiPropertyOptional({ type: RazorpayConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RazorpayConfigDto)
  razorpay?: RazorpayConfigDto;

  @ApiPropertyOptional({ type: CodConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CodConfigDto)
  cod?: CodConfigDto;

  @ApiPropertyOptional({ type: BankTransferConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankTransferConfigDto)
  bankTransfer?: BankTransferConfigDto;

  @ApiPropertyOptional({ type: SimplePaymentMethodConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SimplePaymentMethodConfigDto)
  manual?: SimplePaymentMethodConfigDto;
}
