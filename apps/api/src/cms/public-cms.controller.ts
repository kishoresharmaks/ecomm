import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { CmsService } from "./cms.service";
import { SeoEntryQueryDto } from "./dto/seo-entry.dto";

@ApiTags("Public CMS")
@Public()
@Controller("cms")
export class PublicCmsController {
  constructor(@Inject(CmsService) private readonly cmsService: CmsService) {}

  @Get("banners")
  @ApiOperation({ summary: "List published storefront banners." })
  listBanners() {
    return this.cmsService.listPublishedBanners();
  }

  @Get("homepage-sections")
  @ApiOperation({ summary: "List published homepage sections." })
  listHomepageSections() {
    return this.cmsService.listPublishedHomepageSections();
  }

  @Get("pages")
  @ApiOperation({ summary: "List published CMS or policy pages." })
  listPages() {
    return this.cmsService.listPublishedPages();
  }

  @Get("seo/resolve")
  @ApiOperation({ summary: "Resolve a published SEO entry by entity or route path." })
  resolveSeo(@Query() query: SeoEntryQueryDto) {
    return this.cmsService.resolveSeoEntry(query);
  }

  @Get("menus")
  @ApiOperation({ summary: "List published CMS menu items." })
  listMenus(@Query("area") area?: string) {
    return this.cmsService.listPublishedMenuItems(area);
  }

  @Get("sitemap")
  @ApiOperation({ summary: "List public sitemap entries." })
  sitemap() {
    return this.cmsService.getPublicSitemapEntries();
  }

  @Get("pages/:slug")
  @ApiOperation({ summary: "Read a published CMS or policy page by slug." })
  getPage(@Param("slug") slug: string) {
    return this.cmsService.getPublishedPage(slug);
  }
}
