import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateB2BEnquiryDto {
  @ApiPropertyOptional({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: "f2c7311c-5555-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @ApiProperty({ example: "Need wholesale quotation for monthly supply." })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
