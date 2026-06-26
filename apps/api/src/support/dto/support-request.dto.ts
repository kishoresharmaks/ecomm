import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { SupportRequestStatus } from "@indihub/database";
import {
  supportContactChannels,
  supportRequesterTypes,
  supportRequestTopics,
  type SupportContactChannel,
  type SupportRequesterType,
  type SupportRequestTopic,
} from "@indihub/shared-types";

export class CreateSupportRequestDto {
  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  phone?: string;

  @ApiProperty({ enum: supportRequestTopics, example: "ORDER" })
  @IsIn(supportRequestTopics)
  topic!: SupportRequestTopic;

  @ApiProperty({ enum: supportRequesterTypes, example: "CUSTOMER" })
  @IsIn(supportRequesterTypes)
  requesterType!: SupportRequesterType;

  @ApiProperty({ enum: supportContactChannels, example: "EMAIL" })
  @IsIn(supportContactChannels)
  preferredContactChannel!: SupportContactChannel;

  @ApiProperty({ example: "Order support" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @ApiPropertyOptional({ example: "ORD-2026-10001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;

  @ApiProperty({ example: "I need help with my order delivery status." })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  message!: string;
}

export class AuthenticatedSupportRequestDto {
  @ApiPropertyOptional({ example: "Vignesh Kumar" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: "customer@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @Matches(/^\+?[0-9][0-9\s()-]{6,24}$/)
  phone?: string;

  @ApiProperty({ enum: supportRequestTopics, example: "ORDER" })
  @IsIn(supportRequestTopics)
  topic!: SupportRequestTopic;

  @ApiPropertyOptional({ enum: supportRequesterTypes, example: "CUSTOMER" })
  @IsOptional()
  @IsIn(supportRequesterTypes)
  requesterType?: SupportRequesterType;

  @ApiProperty({ enum: supportContactChannels, example: "EMAIL" })
  @IsIn(supportContactChannels)
  preferredContactChannel!: SupportContactChannel;

  @ApiProperty({ example: "Order support" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @ApiPropertyOptional({ example: "ORD-2026-10001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;

  @ApiProperty({ example: "I need help with my order delivery status." })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  message!: string;
}

export class UpdateSupportRequestDto {
  @ApiPropertyOptional({ enum: SupportRequestStatus })
  @IsOptional()
  @IsEnum(SupportRequestStatus)
  status?: SupportRequestStatus;

  @ApiPropertyOptional({ example: "Customer was contacted and issue was resolved." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;

  @ApiPropertyOptional({ example: "Thanks for contacting us. We checked your order and shared the next step." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseMessage?: string;
}

export class SupportRequestQueryDto {
  @ApiPropertyOptional({ enum: SupportRequestStatus })
  @IsOptional()
  @IsEnum(SupportRequestStatus)
  status?: SupportRequestStatus;

  @ApiPropertyOptional({ enum: supportRequestTopics })
  @IsOptional()
  @IsIn(supportRequestTopics)
  topic?: SupportRequestTopic;

  @ApiPropertyOptional({ enum: supportRequesterTypes })
  @IsOptional()
  @IsIn(supportRequesterTypes)
  requesterType?: SupportRequesterType;

  @ApiPropertyOptional({ example: "delivery" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
