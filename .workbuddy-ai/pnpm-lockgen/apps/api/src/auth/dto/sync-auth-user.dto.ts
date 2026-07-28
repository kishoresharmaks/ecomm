import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { RoleCode } from "@indihub/database";
import { IsValidPhoneNumber } from "../../common/validators/is-phone-number.validator";

export class SyncAuthUserDto {
  @ApiProperty({ example: "user_2abc123" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  clerkUserId!: string;

  @ApiProperty({ example: "customer@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsValidPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: "Vignesh Kumar" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ enum: RoleCode, default: RoleCode.CUSTOMER })
  @IsOptional()
  @IsEnum(RoleCode)
  defaultRole?: RoleCode;
}
