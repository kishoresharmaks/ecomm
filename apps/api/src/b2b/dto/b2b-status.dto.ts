import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { B2BEnquiryStatus } from "@indihub/database";

export class UpdateB2BEnquiryStatusDto {
  @ApiProperty({ enum: B2BEnquiryStatus })
  @IsEnum(B2BEnquiryStatus)
  status!: B2BEnquiryStatus;

  @ApiPropertyOptional({ example: "Admin reviewed this enquiry." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

