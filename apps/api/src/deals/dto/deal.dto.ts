import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { DealStatus } from "@indihub/database";

export class DealQueryDto {
  @ApiPropertyOptional({ enum: DealStatus })
  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;

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
}

export class CreateDealDto {
  @ApiProperty({ example: "Monsoon Electronics Deal" })
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title!: string;

  @ApiPropertyOptional({ example: "Time-limited marketplace campaign for approved sellers." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: 2000, description: "Discount in basis points. 2000 = 20%." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(9000)
  discountBps?: number;

  @ApiPropertyOptional({ example: 20, description: "Discount percentage. Used when discountBps is not supplied." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  discountPercent?: number;

  @ApiProperty({ example: "2026-07-01T18:29:59.000Z" })
  @IsDateString()
  joinDeadline!: string;

  @ApiProperty({ example: "2026-07-02T00:00:00.000Z" })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: "2026-07-10T23:59:59.000Z" })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSellers?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxProducts?: number;
}

export class UpdateDealDto extends PartialType(CreateDealDto) {}

export class EnrollDealProductsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  productIds!: string[];
}
