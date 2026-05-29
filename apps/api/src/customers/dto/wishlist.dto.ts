import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class WishlistItemDto {
  @ApiProperty({ example: "f2c7311c-4444-4444-8888-1b9c960acabc" })
  @IsUUID()
  productId!: string;
}

