import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const fxProviderAdapterCodes = ["FRANKFURTER", "CURRENCYAPI"] as const;
export type FxProviderAdapterCode = (typeof fxProviderAdapterCodes)[number];

export class UpsertFxProviderDto {
  @ApiProperty({ enum: fxProviderAdapterCodes, example: "CURRENCYAPI" })
  @IsIn(fxProviderAdapterCodes)
  adapterCode!: FxProviderAdapterCode;

  @ApiPropertyOptional({ example: "CURRENCYAPI" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,40}$/)
  providerCode?: string;

  @ApiProperty({ example: "CurrencyAPI" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ example: "https://api.currencyapi.com/v3" })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https"] })
  @MaxLength(300)
  apiBaseUrl?: string;

  @ApiPropertyOptional({ description: "Write-only provider API key." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeoutMs?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  cacheTtlMinutes?: number;

  @ApiPropertyOptional({ example: "Primary production FX reference provider." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CompareFxQuotesDto {
  @ApiProperty({ example: "INR" })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  baseCurrency!: string;

  @ApiProperty({ example: "USD" })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  quoteCurrency!: string;

  @ApiPropertyOptional({ example: 10000, description: "Amount in base-currency minor units." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amountMinor?: number;
}

export class TestFxProviderDto extends CompareFxQuotesDto {}
