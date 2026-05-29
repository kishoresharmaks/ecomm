import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class MarketCurrencyQueryDto {
  @ApiPropertyOptional({ example: "GB" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
}
