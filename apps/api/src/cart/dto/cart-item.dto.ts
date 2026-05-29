import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Max, Min } from "class-validator";

export class AddCartItemDto {
  @ApiProperty({ example: "f2c7311c-5555-4444-8888-1b9c960acabc" })
  @IsUUID()
  productVariantId!: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

