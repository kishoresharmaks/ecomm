import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";
import { DeliveryMode, DeliveryStatus } from "@indihub/database";

export class UpdateDeliveryDto {
  @ApiPropertyOptional({ enum: DeliveryMode })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiPropertyOptional({ example: "Local delivery partner or courier provider" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  partnerName?: string;

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  partnerPhone?: string;

  @ApiPropertyOptional({ example: "2d6f5f7c-0b6a-4d65-93b8-3c5b8c62d6f1" })
  @IsOptional()
  @IsUUID()
  deliveryPartnerUserId?: string | null;

  @ApiPropertyOptional({ example: "TRK123456789" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingReference?: string;

  @ApiPropertyOptional({ example: "2026-05-27" })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;

  @ApiPropertyOptional({ example: "Dispatched through third-party courier service." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  deliveryNote?: string;

  @ApiPropertyOptional({ example: "Ramesh Kumar" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiverName?: string;

  @ApiPropertyOptional({ example: "Delivered to customer at front desk." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  proofNote?: string;

  @ApiPropertyOptional({ example: "Manual signature collected in register #42." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  proofReference?: string;

  @ApiPropertyOptional({ enum: DeliveryStatus })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  codCollected?: boolean;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  codCollectedAmountPaise?: number;

  @ApiPropertyOptional({ example: "Collected exact COD amount from customer." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  codCollectionNote?: string;
}
