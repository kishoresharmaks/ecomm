import { Module } from "@nestjs/common";
import { ProductTemplatesController } from "./product-templates.controller";
import { ProductTemplatesService } from "./product-templates.service";

@Module({
  controllers: [ProductTemplatesController],
  providers: [ProductTemplatesService],
})
export class ProductTemplatesModule {}
