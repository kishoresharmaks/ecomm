import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class UpdateEmailTriggerRuleDto {
  @ApiPropertyOptional({ example: "1d49ca17-3cfd-4b11-8d8f-1b9df6fb2583", nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 10080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  delayMinutes?: number;
}
