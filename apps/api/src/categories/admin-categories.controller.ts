import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/create-category.dto";

@ApiTags("Admin Categories")
@Roles(RoleCode.ADMIN)
@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List all non-archived categories for admin management." })
  listAdminCategories() {
    return this.categoriesService.listAdminCategories();
  }

  @Post()
  @ApiOperation({ summary: "Create a category or subcategory." })
  createCategory(@CurrentUser() actor: RequestUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto, actor);
  }

  @Patch(":categoryId")
  @ApiOperation({ summary: "Update category details, status, or hierarchy." })
  updateCategory(
    @CurrentUser() actor: RequestUser,
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.categoriesService.updateCategory(categoryId, dto, actor);
  }

  @Delete(":categoryId")
  @ApiOperation({ summary: "Archive a category when it has no active products." })
  archiveCategory(@CurrentUser() actor: RequestUser, @Param("categoryId") categoryId: string) {
    return this.categoriesService.archiveCategory(categoryId, actor);
  }
}
