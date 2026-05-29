import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class TrackOrderDto {
  @ApiProperty({ example: "1HI20260523123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  orderNumber!: string;

  @ApiProperty({ example: "9876543210", description: "Customer email or delivery phone used on the order." })
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  contact!: string;
}
