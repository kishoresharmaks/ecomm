import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { ContentStatus } from "@indihub/database";

export class CmsMenuQueryDto {
  @ApiPropertyOptional({ example: "header" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class CreateCmsMenuItemDto {
  @ApiPropertyOptional({ example: "header", default: "header" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  area?: string;

  @ApiProperty({ example: "Stores" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: "/stores" })
  @IsString()
  @MaxLength(500)
  href!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentId?: string;

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

export class UpdateCmsMenuItemDto extends PartialType(CreateCmsMenuItemDto) {}

