import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum ProductApprovalDecision {
  APPROVE = "APPROVE",
  REJECT = "REJECT"
}

export class ProductApprovalDto {
  @ApiProperty({ enum: ProductApprovalDecision })
  @IsEnum(ProductApprovalDecision)
  decision!: ProductApprovalDecision;

  @ApiPropertyOptional({ example: "Image and price details verified." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

