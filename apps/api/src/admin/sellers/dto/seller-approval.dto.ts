import { IsBoolean, IsEnum, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ApprovalStatus, SellerStatus, SellerType } from "@indihub/database";

export enum SellerApprovalDecision {
  APPROVE = "APPROVE",
  REJECT = "REJECT"
}

export class SellerApprovalDto {
  @ApiProperty({ enum: SellerApprovalDecision })
  @IsEnum(SellerApprovalDecision)
  decision!: SellerApprovalDecision;

  @ApiPropertyOptional({ example: "Business details verified." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SellerQueryDto {
  @ApiPropertyOptional({ enum: SellerStatus })
  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({ enum: SellerType })
  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @ApiPropertyOptional({ example: "local" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SellerSuspensionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  suspended!: boolean;

  @ApiPropertyOptional({ example: "Missing required business documents." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
