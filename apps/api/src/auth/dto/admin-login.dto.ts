import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "admin@1handindia.com" })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "Use a secure admin password." })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
