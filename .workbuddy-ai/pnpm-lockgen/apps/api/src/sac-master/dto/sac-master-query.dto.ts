import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SacMasterQueryDto {
  @ApiPropertyOptional({ example: "repair services" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
