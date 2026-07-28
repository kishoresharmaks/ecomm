import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelOrderDto {
  @ApiPropertyOptional({ example: "Customer requested cancellation before dispatch." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
