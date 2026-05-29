import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EmailTemplateCategory } from "@indihub/database";
import {
  IsIn,
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class EmailThemeTokensDto {
  @ApiPropertyOptional({ example: "https://cdn.1handindia.com/logo.png" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^https?:\/\/.+/i)
  logoUrl?: string;

  @ApiPropertyOptional({ example: "#ED3500" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  brandColor?: string;

  @ApiPropertyOptional({ example: "#163B5C" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @ApiPropertyOptional({ example: "#FFFCFB" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  backgroundColor?: string;

  @ApiPropertyOptional({ example: "#FFFFFF" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  surfaceColor?: string;

  @ApiPropertyOptional({ example: "#1F2933" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  textColor?: string;

  @ApiPropertyOptional({ example: "#667085" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  mutedTextColor?: string;

  @ApiPropertyOptional({ example: "#ED3500" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  buttonBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#FFFFFF" })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  buttonTextColor?: string;

  @ApiPropertyOptional({ enum: ["SOLID", "OUTLINE"] })
  @IsOptional()
  @IsIn(["SOLID", "OUTLINE"])
  buttonStyle?: "SOLID" | "OUTLINE";

  @ApiPropertyOptional({ example: "You received this because you use 1HandIndia." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  footerText?: string;

  @ApiPropertyOptional({ example: 8, minimum: 0, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  borderRadius?: number;

  @ApiPropertyOptional({ enum: ["Arial", "Inter", "Georgia", "Verdana", "Tahoma"] })
  @IsOptional()
  @IsIn(["Arial", "Inter", "Georgia", "Verdana", "Tahoma"])
  fontFamily?: "Arial" | "Inter" | "Georgia" | "Verdana" | "Tahoma";
}

export class CreateEmailThemeDto {
  @ApiProperty({ example: "ORDER_DEFAULT" })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z0-9_]+$/)
  code!: string;

  @ApiProperty({ example: "Default transactional theme" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  @ApiPropertyOptional({ type: EmailThemeTokensDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailThemeTokensDto)
  tokens?: EmailThemeTokensDto;
}

export class UpdateEmailThemeDto {
  @ApiPropertyOptional({ example: "Default transactional theme" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  @ApiPropertyOptional({ type: EmailThemeTokensDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailThemeTokensDto)
  tokens?: EmailThemeTokensDto;
}

export class EmailTemplateQueryDto {
  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  @IsOptional()
  @IsEnum(EmailTemplateCategory)
  category?: EmailTemplateCategory;

  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  @ApiPropertyOptional({ example: "welcome" })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateEmailTemplateDto {
  @ApiProperty({ example: "Customer welcome email" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: EmailTemplateCategory })
  @IsEnum(EmailTemplateCategory)
  category!: EmailTemplateCategory;

  @ApiProperty({ example: "Welcome to 1HandIndia, {{ customerName }}" })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  subject!: string;

  @ApiProperty({ example: "Hello {{ customerName }}, thanks for joining 1HandIndia." })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  @ApiPropertyOptional({ example: "1d49ca17-3cfd-4b11-8d8f-1b9df6fb2583", nullable: true })
  @IsOptional()
  @IsUUID()
  themeId?: string | null;

  @ApiPropertyOptional({ type: EmailThemeTokensDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailThemeTokensDto)
  styleOverrides?: EmailThemeTokensDto;
}

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({ example: "Customer welcome email" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  @IsOptional()
  @IsEnum(EmailTemplateCategory)
  category?: EmailTemplateCategory;

  @ApiPropertyOptional({ example: "Your order {{ orderNumber }} is confirmed" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  subject?: string;

  @ApiPropertyOptional({ example: "Hello {{ customerName }}, your order is confirmed." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body?: string;

  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";

  @ApiPropertyOptional({ example: "1d49ca17-3cfd-4b11-8d8f-1b9df6fb2583", nullable: true })
  @IsOptional()
  @IsUUID()
  themeId?: string | null;

  @ApiPropertyOptional({ type: EmailThemeTokensDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmailThemeTokensDto)
  styleOverrides?: EmailThemeTokensDto;
}
