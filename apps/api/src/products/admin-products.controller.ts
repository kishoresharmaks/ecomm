import { Body, Controller, Delete, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ProductApprovalDto } from "./dto/product-approval.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { ProductsService } from "./products.service";

@ApiTags("Admin Products")
@Roles(RoleCode.ADMIN)
@Controller("admin/products")
export class AdminProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List products for admin management and filtering." })
  listProducts(@Query() query: ProductQueryDto) {
    return this.productsService.listAdminProducts(query);
  }

  @Get("approvals")
  @ApiOperation({ summary: "List products waiting for admin moderation." })
  listPendingProducts() {
    return this.productsService.listPendingAdminProducts();
  }

  @Patch(":productId/approval")
  @ApiOperation({ summary: "Approve or reject a seller-submitted product." })
  updateProductApproval(
    @CurrentUser() actor: RequestUser,
    @Param("productId") productId: string,
    @Body() dto: ProductApprovalDto
  ) {
    return this.productsService.updateProductApproval(productId, dto, actor);
  }

  @Delete(":productId")
  @ApiOperation({ summary: "Archive a product from admin catalogue management." })
  archiveProduct(@CurrentUser() actor: RequestUser, @Param("productId") productId: string) {
    return this.productsService.archiveAdminProduct(actor, productId);
  }
}
