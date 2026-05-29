import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ContentStatus } from "@indihub/database";

export class CreateCmsPageDto {
  @ApiProperty({ example: "privacy-policy" })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  slug!: string;

  @ApiProperty({ example: "Privacy Policy" })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: "Policy content will be finalized before launch." })
  @IsString()
  @MinLength(10)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ enum: ContentStatus, default: ContentStatus.DRAFT })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class UpdateCmsPageDto extends PartialType(CreateCmsPageDto) {}

