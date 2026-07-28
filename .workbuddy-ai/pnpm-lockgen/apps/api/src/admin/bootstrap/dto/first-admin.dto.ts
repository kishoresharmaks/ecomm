import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { IsValidPhoneNumber } from "../../../common/validators/is-phone-number.validator";

export class FirstAdminDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Use a secure admin password." })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ example: "1HandIndia Admin" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsValidPhoneNumber()
  phone?: string;
}
