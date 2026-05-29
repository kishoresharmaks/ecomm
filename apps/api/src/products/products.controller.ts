import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { ProductQueryDto } from "./dto/product-query.dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List approved active products for storefront browsing." })
  listProducts(@Query() query: ProductQueryDto) {
    return this.productsService.listPublicProducts(query);
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Read approved active product detail by slug." })
  getProduct(@Param("slug") slug: string) {
    return this.productsService.getPublicProduct(slug);
  }
}

