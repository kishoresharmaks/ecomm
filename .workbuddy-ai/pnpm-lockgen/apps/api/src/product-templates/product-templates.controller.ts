import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CreateProductTemplateDto, UpdateProductTemplateDto } from "./dto/product-template.dto";
import { ProductTemplatesService } from "./product-templates.service";

@ApiTags("Admin Product Templates")
@Roles(RoleCode.ADMIN)
@Controller("admin/product-templates")
export class ProductTemplatesController {
  constructor(
    @Inject(ProductTemplatesService)
    private readonly productTemplatesService: ProductTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List dynamic product templates for category and seller form management." })
  listTemplates(): Promise<unknown> {
    return this.productTemplatesService.listTemplates();
  }

  @Post()
  @ApiOperation({ summary: "Create a dynamic product template." })
  createTemplate(@CurrentUser() actor: RequestUser, @Body() dto: CreateProductTemplateDto) {
    return this.productTemplatesService.createTemplate(actor, dto);
  }

  @Patch(":templateId")
  @ApiOperation({ summary: "Update a dynamic product template and its field builder." })
  updateTemplate(
    @CurrentUser() actor: RequestUser,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateProductTemplateDto,
  ) {
    return this.productTemplatesService.updateTemplate(actor, templateId, dto);
  }

  @Delete(":templateId")
  @ApiOperation({ summary: "Archive a dynamic product template when no categories use it." })
  archiveTemplate(@CurrentUser() actor: RequestUser, @Param("templateId") templateId: string) {
    return this.productTemplatesService.archiveTemplate(actor, templateId);
  }
}
