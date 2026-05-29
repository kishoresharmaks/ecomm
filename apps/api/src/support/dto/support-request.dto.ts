import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { SupportRequestStatus } from "@indihub/database";

export class CreateSupportRequestDto {
  @ApiProperty({ example: "Vignesh Kumar" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  phone?: string;

  @ApiProperty({ example: "Order support" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @ApiProperty({ example: "I need help with my order delivery status." })
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
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
  @MaxLength(2000)
  adminNote?: string;
}

export class SupportRequestQueryDto extends PartialType(UpdateSupportRequestDto) {
  @ApiPropertyOptional({ example: "delivery" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

