import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum ProductReviewModerationDecision {
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  HIDE = "HIDE",
}

export class ModerateProductReviewDto {
  @ApiProperty({ enum: ProductReviewModerationDecision })
  @IsEnum(ProductReviewModerationDecision)
  decision!: ProductReviewModerationDecision;

  @ApiPropertyOptional({ example: "Approved after checking verified purchase context." })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  moderationNote?: string;
}
