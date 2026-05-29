import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CmsRevisionQueryDto {
  @ApiPropertyOptional({ example: "seo_entry" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string;

  @ApiPropertyOptional({ example: "5b10b96d-7e96-4c7e-b24f-26aa9d7e5a1a" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  entityId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

