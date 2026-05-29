import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { CategoriesService } from "./categories.service";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List active public categories for storefront browsing." })
  listPublicCategories() {
    return this.categoriesService.listPublicCategories();
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Read one active public category by slug." })
  getPublicCategory(@Param("slug") slug: string) {
    return this.categoriesService.getPublicCategory(slug);
  }
}

