import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { SettingValueType } from "@indihub/database";

export class UpsertSettingDto {
  @ApiProperty({ example: "general" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  group!: string;

  @ApiProperty({ enum: SettingValueType })
  @IsEnum(SettingValueType)
  valueType!: SettingValueType;

  @ApiProperty({ example: "1HandIndia" })
  @IsDefined()
  value!: unknown;
}

export class SettingsQueryDto {
  @ApiPropertyOptional({ example: "general" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  group?: string;
}

export class UpsertCheckoutPlatformFeeDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: ["PERCENTAGE", "FIXED", "MANUAL"] })
  @IsIn(["PERCENTAGE", "FIXED", "MANUAL"])
  type!: "PERCENTAGE" | "FIXED" | "MANUAL";

  @ApiProperty({ example: 250, description: "Percentage fee in basis points. 250 means 2.5%." })
  @IsInt()
  @Min(0)
  valueBps!: number;

  @ApiProperty({ example: 500, description: "Fixed buyer checkout fee in paise." })
  @IsInt()
  @Min(0)
  fixedPaise!: number;
}

export class EmailProviderConfigDto {
  @ApiPropertyOptional({ example: "xkeysib-..." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  brevoApiKey?: string;

  @ApiPropertyOptional({ example: "re_..." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resendApiKey?: string;

  @ApiPropertyOptional({ example: "SG...." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sendgridApiKey?: string;

  @ApiPropertyOptional({ example: "smtp.gmail.com" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ example: "no-reply@1handindia.com" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUsername?: string;

  @ApiPropertyOptional({ example: "smtp-app-password" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  smtpPassword?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiPropertyOptional({ example: "https://email-bridge.example.com/send" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^https?:\/\/.+/i)
  smtpBridgeUrl?: string;
}

export class UpsertEmailSettingDto {
  @ApiProperty({ example: "smtp" })
  @IsString()
  @IsIn(["smtp", "brevo", "resend", "sendgrid"])
  @MinLength(2)
  @MaxLength(80)
  provider!: string;

  @ApiProperty({ example: "1HandIndia" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  senderName!: string;

  @ApiProperty({ example: "no-reply@example.com" })
  @IsEmail()
  senderEmail!: string;

  @ApiPropertyOptional({ example: "ops@1handindia.com, support@1handindia.com" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminRecipients?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ type: EmailProviderConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailProviderConfigDto)
  providerConfig?: EmailProviderConfigDto;
}
