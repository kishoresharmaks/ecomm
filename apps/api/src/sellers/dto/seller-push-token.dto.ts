import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class RegisterSellerPushTokenDto {
  @Matches(/^ExponentPushToken\[[\w-]+\]$/)
  @MaxLength(160)
  token!: string;

  @IsIn(["android", "ios"])
  platform!: "android" | "ios";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  appVersion?: string;
}

export class RevokeSellerPushTokenDto {
  @Matches(/^ExponentPushToken\[[\w-]+\]$/)
  @MaxLength(160)
  token!: string;
}
