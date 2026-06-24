import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  ArrayMinSize,
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

export class MaintenanceScopeDto {
  @ApiProperty({ example: "storefront", enum: ["storefront", "seller", "delivery"] })
  @IsIn(["storefront", "seller", "delivery"])
  scope!: "storefront" | "seller" | "delivery";

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    example: "We are updating this workspace. Please check back shortly.",
    description: "Public-facing maintenance message shown to users.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  message?: string;

  @ApiPropertyOptional({
    example: "Expected back by 3 PM IST",
    description: "Public-facing free-text ETA shown to users.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  eta?: string;
}

export class UpsertMaintenanceSettingsDto {
  @ApiProperty({ type: [MaintenanceScopeDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MaintenanceScopeDto)
  scopes!: MaintenanceScopeDto[];
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

export class UpsertDeliveryPartnerPayoutSettingsDto {
  @ApiProperty({ example: 4000, description: "Minimum delivery partner earning per completed local order, in paise." })
  @IsInt()
  @Min(0)
  minimumPerOrderPaise!: number;

  @ApiProperty({ example: 2500, description: "Base earning per completed local order, in paise." })
  @IsInt()
  @Min(0)
  basePayPaise!: number;

  @ApiProperty({ example: 800, description: "Per-kilometer earning rate, in paise." })
  @IsInt()
  @Min(0)
  perKmPaise!: number;

  @ApiProperty({ example: 500, description: "COD delivery bonus, in paise." })
  @IsInt()
  @Min(0)
  codBonusPaise!: number;

  @ApiProperty({ example: 100000, description: "Minimum wallet balance required before payout request, in paise." })
  @IsInt()
  @Min(0)
  minimumWalletPayoutPaise!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  requestsEnabled!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  freeDeliveryPlatformSubsidyEnabled!: boolean;
}

export class UpsertMapRoutingSettingsDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: ["HAVERSINE", "GOOGLE_ROUTES", "MAPBOX_DIRECTIONS"] })
  @IsIn(["HAVERSINE", "GOOGLE_ROUTES", "MAPBOX_DIRECTIONS"])
  provider!: "HAVERSINE" | "GOOGLE_ROUTES" | "MAPBOX_DIRECTIONS";

  @ApiPropertyOptional({ example: "AIza..." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  googleApiToken?: string;

  @ApiProperty({ enum: ["DRIVE", "TWO_WHEELER", "WALK", "BICYCLE"] })
  @IsIn(["DRIVE", "TWO_WHEELER", "WALK", "BICYCLE"])
  googleTravelMode!: "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE";

  @ApiPropertyOptional({ example: "pk.ey..." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mapboxAccessToken?: string;

  @ApiProperty({ enum: ["mapbox/driving", "mapbox/driving-traffic", "mapbox/walking", "mapbox/cycling"] })
  @IsIn(["mapbox/driving", "mapbox/driving-traffic", "mapbox/walking", "mapbox/cycling"])
  mapboxProfile!: "mapbox/driving" | "mapbox/driving-traffic" | "mapbox/walking" | "mapbox/cycling";

  @ApiProperty({ example: true })
  @IsBoolean()
  fallbackToHaversine!: boolean;
}

export class UpsertContactSettingsDto {
  @ApiPropertyOptional({ example: "support@1handindia.com" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  supportEmail?: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^$|^[0-9+()\-\s]{6,40}$/)
  supportPhone?: string;

  @ApiPropertyOptional({ example: "+91 98765 43210" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^$|^[0-9+()\-\s]{6,40}$/)
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: "https://wa.me/919876543210" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^https?:\/\/.+/i)
  whatsappUrl?: string;

  @ApiPropertyOptional({ example: "1HandIndia Marketplace, Bengaluru, Karnataka" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @ApiPropertyOptional({ example: "Monday to Saturday, 10:00 AM - 6:00 PM IST" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  workingHours?: string;

  @ApiPropertyOptional({ example: "We usually respond within 1 business day." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  responseSla?: string;

  @ApiPropertyOptional({ example: "https://maps.google.com/?q=1HandIndia" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^https?:\/\/.+/i)
  mapUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enableEmail?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enablePhone?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enableWhatsapp?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enableAddress?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enableMap?: boolean;
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
