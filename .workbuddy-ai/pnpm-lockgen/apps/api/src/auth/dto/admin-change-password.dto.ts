import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class AdminChangePasswordDto {
  @ApiProperty({ example: "Current secure admin password." })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ example: "New secure admin password." })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
