import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum CodVerificationDecision {
  VERIFY = "VERIFY",
  REJECT = "REJECT"
}

export class CodVerificationDto {
  @ApiProperty({ enum: CodVerificationDecision })
  @IsEnum(CodVerificationDecision)
  decision!: CodVerificationDecision;

  @ApiPropertyOptional({ example: "Cash received and matched with delivery partner report." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
