import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { RoleCode } from "@indihub/database";
import { IsValidPhoneNumber } from "../../common/validators/is-phone-number.validator";

export class SyncCurrentUserDto {
  @ApiPropertyOptional({ example: "customer@example.com", description: "Fallback email when Clerk backend lookup is not configured." })
  @IsOptional()
  @IsEmail()
  email?: string;

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
