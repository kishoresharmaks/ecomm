import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { RoleCode } from "@indihub/database";

export class SyncCurrentUserDto {
  @ApiPropertyOptional({ example: "customer@example.com", description: "Fallback email when Clerk backend lookup is not configured." })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
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
