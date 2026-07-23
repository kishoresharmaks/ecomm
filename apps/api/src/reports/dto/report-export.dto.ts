import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportExportStatus, ReportExportType } from "@indihub/database";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateReportExportDto {
  @ApiProperty({ enum: ReportExportType })
  @IsEnum(ReportExportType)
  exportType!: ReportExportType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentStatus?: string;
}

export class ReportExportListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ReportExportStatus })
  @IsOptional()
  @IsEnum(ReportExportStatus)
  status?: ReportExportStatus;

  @ApiPropertyOptional({ enum: ReportExportType })
  @IsOptional()
  @IsEnum(ReportExportType)
  exportType?: ReportExportType;
}
