import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class SubmitProductReviewDto {
  @ApiProperty({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Good quality" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: "The product matched the description and arrived in good condition." })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
