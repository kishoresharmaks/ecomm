import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class RegisterSellerPushTokenDto {
  @Matches(/^Expo(nent)?PushToken\[[\w-]+\]$/)
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
  @Matches(/^Expo(nent)?PushToken\[[\w-]+\]$/)
  @MaxLength(160)
  token!: string;
}
