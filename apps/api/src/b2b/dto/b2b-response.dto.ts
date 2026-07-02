import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateB2BResponseDto {
  @ApiProperty({ example: "We can supply 100 units at the quoted wholesale rate." })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  responseMessage!: string;

  @ApiPropertyOptional({ example: 45000, description: "Quoted unit price in paise." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "quotedPricePaise must represent a positive price (minimum 1 paise)" })
  quotedPricePaise?: number;

  @ApiPropertyOptional({ example: 250000, description: "Seller-arranged B2B transport charge in paise." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  transportChargePaise?: number;

  @ApiPropertyOptional({ example: "Dispatch within 3-5 working days after payment clearance." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  transportEta?: string;

  @ApiPropertyOptional({ example: "Courier charge is approximate and included in the proforma payable total." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  transportNote?: string;
}
