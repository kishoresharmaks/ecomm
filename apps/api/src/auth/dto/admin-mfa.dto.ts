import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AdminVerifyMfaDto {
  @ApiProperty({ example: "ih_mfa_eyJ..." })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  mfaTicket!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isRecoveryCode?: boolean;
}

export class AdminConfirmMfaDto {
  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @ApiProperty({ example: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" })
  @IsString()
  @MinLength(16)
  @MaxLength(100)
  secret!: string;
}

export class AdminDisableMfaDto {
  @ApiProperty({ example: "CurrentPassword123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  code!: string;
}

export class AdminRegenerateMfaCodesDto {
  @ApiProperty({ example: "CurrentPassword123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ example: "123456" })
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  code!: string;
}

