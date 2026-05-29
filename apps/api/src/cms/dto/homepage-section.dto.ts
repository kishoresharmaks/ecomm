import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { ContentStatus } from "@indihub/database";

export class CreateHomepageSectionDto {
  @ApiProperty({ example: "featured_categories" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sectionType!: string;

  @ApiProperty({ example: "Shop by Category" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: { categorySlugs: ["groceries", "fashion"] } })
  @IsObject()
  config!: Record<string, unknown>;

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

export class UpdateHomepageSectionDto extends PartialType(CreateHomepageSectionDto) {}

