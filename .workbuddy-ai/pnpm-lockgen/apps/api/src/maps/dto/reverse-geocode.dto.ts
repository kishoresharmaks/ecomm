import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsLatitude, IsLongitude } from "class-validator";

export class ReverseGeocodeDto {
  @ApiProperty({ example: 11.6643 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 78.146 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}
