import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContentStatus } from "@indihub/database";

export class CreateCmsAnnouncementDto {
  @ApiProperty({ example: "Free delivery on selected local orders above ₹499" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: "/categories/groceries" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @ApiPropertyOptional({ example: "#ED3500" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  backgroundColor?: string;

  @ApiPropertyOptional({ example: "#FFFFFF" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  textColor?: string;

  @ApiPropertyOptional({ example: "2026-06-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59.000Z" })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCmsAnnouncementDto extends PartialType(CreateCmsAnnouncementDto) {}
