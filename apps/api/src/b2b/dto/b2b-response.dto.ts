import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

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
}
