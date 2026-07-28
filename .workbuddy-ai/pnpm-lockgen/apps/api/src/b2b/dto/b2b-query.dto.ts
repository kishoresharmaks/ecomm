import { Transform, Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { B2BEnquiryStatus } from "@indihub/database";

export class B2BEnquiryQueryDto {
  @ApiPropertyOptional({ example: "bulk rice" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: B2BEnquiryStatus })
  @IsOptional()
  @Transform(({ value }) => (value === "PENDING" ? B2BEnquiryStatus.SUBMITTED : value))
  @IsEnum(B2BEnquiryStatus)
  status?: B2BEnquiryStatus;

  @ApiPropertyOptional({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-5555-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

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
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque cursor for large result sets." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}
