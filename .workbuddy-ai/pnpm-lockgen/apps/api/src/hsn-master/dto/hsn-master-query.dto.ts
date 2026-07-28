import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class HsnMasterQueryDto {
  @ApiPropertyOptional({ example: "Bluetooth speaker" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "f2c7311c-3333-4444-8888-1b9c960acabc" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
