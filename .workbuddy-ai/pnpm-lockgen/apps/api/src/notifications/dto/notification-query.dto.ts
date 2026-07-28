import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { EmailRecipientType, EmailTemplateCategory, NotificationStatus } from "@indihub/database";
import { Type } from "class-transformer";

export class NotificationQueryDto {
  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ example: "ORDER_PLACED_CUSTOMER" })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiPropertyOptional({ enum: EmailTemplateCategory })
  @IsOptional()
  @IsEnum(EmailTemplateCategory)
  category?: EmailTemplateCategory;

  @ApiPropertyOptional({ example: "CUSTOMER_REGISTERED" })
  @IsOptional()
  @IsString()
  eventCode?: string;

  @ApiPropertyOptional({ enum: EmailRecipientType })
  @IsOptional()
  @IsEnum(EmailRecipientType)
  recipientType?: EmailRecipientType;

  @ApiPropertyOptional({ example: "customer@example.com" })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous list response." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}
