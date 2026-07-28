import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class ReportQueryDto {
  @ApiPropertyOptional({ example: "2026-05-01" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-05-31" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

