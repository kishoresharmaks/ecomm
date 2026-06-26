import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { RoleCode, UserStatus } from "@indihub/database";
import { IsValidPhoneNumber } from "../../../common/validators/is-phone-number.validator";

export class AdminUserQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  roleCode?: RoleCode;

  @ApiPropertyOptional({ example: "admin@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ["CUSTOMER", "SELLER", "BUSINESS_BUYER"] })
  @IsOptional()
  @IsIn(["CUSTOMER", "SELLER", "BUSINESS_BUYER"])
  profile?: "CUSTOMER" | "SELLER" | "BUSINESS_BUYER";

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;

  @ApiPropertyOptional({ example: "Account disabled by admin after review." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: RoleCode })
  @IsEnum(RoleCode)
  roleCode!: RoleCode;

  @ApiPropertyOptional({ example: "Associated work reviewed before changing role access." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SetBackOfficePasswordDto {
  @ApiProperty({ example: "StrongFinancePassword123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @ApiPropertyOptional({ example: "Credential created for finance workspace access." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateDeliveryPartnerProfileDto {
  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsValidPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: "TN 30 AB 1234" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehicleNumber?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  priority?: number;

  @ApiPropertyOptional({ example: "IN" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  serviceCountryCode?: string;

  @ApiPropertyOptional({ example: "IN-TN" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceStateCode?: string;

  @ApiPropertyOptional({ example: "IN-TN-SLM" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceCityCode?: string;

  @ApiPropertyOptional({ example: ["636304", "636001"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicePincodes?: string[];

  @ApiPropertyOptional({ example: ["IN-TN-SLM-MUTHU", "IN-TN-SLM-ANNA"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceLocalAreaCodes?: string[];

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100000000)
  codCashLimitPaise?: number;

  @ApiPropertyOptional({ example: "Covers Salem local routes." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
