import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SendB2BMessageDto {
  @ApiProperty({ example: "Can you improve the delivery timeline for this quantity?" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class B2BEnquiryDetailQueryDto {
  @ApiPropertyOptional({
    description: "Return messages created before this ISO timestamp.",
    example: "2026-06-28T10:30:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  messageCursor?: string;

  @ApiPropertyOptional({ example: 50, default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  messageLimit?: number;
}
