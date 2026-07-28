import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PushNotificationCampaignStatus } from "@indihub/database";

export class PushCampaignSegmentFilterDto {
  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @ApiPropertyOptional({ example: "KA" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  stateCode?: string;

  @ApiPropertyOptional({ example: "Bengaluru" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  limit?: number;
}

export class CreatePushCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(240)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageAssetKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  href?: string;

  @IsOptional()
  @IsObject()
  segmentFilter?: PushCampaignSegmentFilterDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdatePushCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageAssetKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  href?: string | null;

  @IsOptional()
  @IsObject()
  segmentFilter?: PushCampaignSegmentFilterDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
}

export class PushCampaignQueryDto {
  @ApiPropertyOptional({ enum: PushNotificationCampaignStatus })
  @IsOptional()
  @IsIn(Object.values(PushNotificationCampaignStatus))
  status?: PushNotificationCampaignStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
