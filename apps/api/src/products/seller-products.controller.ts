import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ProductQueryDto } from "./dto/product-query.dto";
import { CreateSellerProductDto, UpdateSellerProductDto } from "./dto/product.dto";
import { ProductsService } from "./products.service";

@ApiTags("Seller Products")
@Roles(RoleCode.SELLER)
@Controller("seller/products")
export class SellerProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List products owned by the authenticated seller." })
  listSellerProducts(@CurrentUser() actor: RequestUser, @Query() query: ProductQueryDto) {
    return this.productsService.listSellerProducts(actor, query);
  }

  @Get(":productId")
  @ApiOperation({ summary: "Read a seller-owned product for edit screens." })
  getSellerProduct(@CurrentUser() actor: RequestUser, @Param("productId") productId: string) {
    return this.productsService.getSellerProduct(actor, productId);
  }

  @Post()
  @ApiOperation({ summary: "Submit a seller product for admin approval." })
  createSellerProduct(@CurrentUser() actor: RequestUser, @Body() dto: CreateSellerProductDto) {
    return this.productsService.createSellerProduct(actor, dto);
  }

  @Patch(":productId")
  @ApiOperation({ summary: "Update a seller-owned product and send it back for approval." })
  updateSellerProduct(
    @CurrentUser() actor: RequestUser,
    @Param("productId") productId: string,
    @Body() dto: UpdateSellerProductDto
  ) {
    return this.productsService.updateSellerProduct(actor, productId, dto);
  }

  @Delete(":productId")
  @ApiOperation({ summary: "Archive a seller-owned product." })
  archiveSellerProduct(@CurrentUser() actor: RequestUser, @Param("productId") productId: string) {
    return this.productsService.archiveSellerProduct(actor, productId);
  }
}
