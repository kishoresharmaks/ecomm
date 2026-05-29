import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CmsService } from "./cms.service";
import { CreateBannerDto, UpdateBannerDto } from "./dto/banner.dto";
import { CreateCmsMediaDto, CmsMediaQueryDto, UpdateCmsMediaDto } from "./dto/cms-media.dto";
import { CreateCmsMenuItemDto, CmsMenuQueryDto, UpdateCmsMenuItemDto } from "./dto/cms-menu.dto";
import { CreateCmsPageDto, UpdateCmsPageDto } from "./dto/cms-page.dto";
import { CmsQueryDto } from "./dto/cms-query.dto";
import { CreateCmsRedirectDto, CmsRedirectQueryDto, UpdateCmsRedirectDto } from "./dto/cms-redirect.dto";
import { CmsRevisionQueryDto } from "./dto/cms-revision.dto";
import { CreateHomepageSectionDto, UpdateHomepageSectionDto } from "./dto/homepage-section.dto";
import { CreateSeoEntryDto, SeoEntryQueryDto, UpdateSeoEntryDto } from "./dto/seo-entry.dto";

@ApiTags("Admin CMS")
@Roles(RoleCode.ADMIN)
@Controller("admin/cms")
export class AdminCmsController {
  constructor(@Inject(CmsService) private readonly cmsService: CmsService) {}

  @Get("pages")
  @ApiOperation({ summary: "List CMS pages for admin." })
  listPages(@Query() query: CmsQueryDto) {
    return this.cmsService.listAdminPages(query);
  }

  @Post("pages")
  @ApiOperation({ summary: "Create a CMS or policy page." })
  createPage(@CurrentUser() actor: RequestUser, @Body() dto: CreateCmsPageDto) {
    return this.cmsService.createPage(actor, dto);
  }

  @Patch("pages/:pageId")
  @ApiOperation({ summary: "Update a CMS or policy page." })
  updatePage(@CurrentUser() actor: RequestUser, @Param("pageId") pageId: string, @Body() dto: UpdateCmsPageDto) {
    return this.cmsService.updatePage(actor, pageId, dto);
  }

  @Delete("pages/:pageId")
  @ApiOperation({ summary: "Archive a CMS or policy page." })
  archivePage(@CurrentUser() actor: RequestUser, @Param("pageId") pageId: string) {
    return this.cmsService.archivePage(actor, pageId);
  }

  @Get("banners")
  @ApiOperation({ summary: "List banners for admin." })
  listBanners(@Query() query: CmsQueryDto) {
    return this.cmsService.listAdminBanners(query);
  }

  @Post("banners")
  @ApiOperation({ summary: "Create a homepage banner." })
  createBanner(@CurrentUser() actor: RequestUser, @Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(actor, dto);
  }

  @Patch("banners/:bannerId")
  @ApiOperation({ summary: "Update a homepage banner." })
  updateBanner(@CurrentUser() actor: RequestUser, @Param("bannerId") bannerId: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(actor, bannerId, dto);
  }

  @Delete("banners/:bannerId")
  @ApiOperation({ summary: "Delete a homepage banner." })
  deleteBanner(@CurrentUser() actor: RequestUser, @Param("bannerId") bannerId: string) {
    return this.cmsService.deleteBanner(actor, bannerId);
  }

  @Get("homepage-sections")
  @ApiOperation({ summary: "List homepage sections for admin." })
  listHomepageSections(@Query() query: CmsQueryDto) {
    return this.cmsService.listAdminHomepageSections(query);
  }

  @Post("homepage-sections")
  @ApiOperation({ summary: "Create a homepage section." })
  createHomepageSection(@CurrentUser() actor: RequestUser, @Body() dto: CreateHomepageSectionDto) {
    return this.cmsService.createHomepageSection(actor, dto);
  }

  @Patch("homepage-sections/:sectionId")
  @ApiOperation({ summary: "Update a homepage section." })
  updateHomepageSection(
    @CurrentUser() actor: RequestUser,
    @Param("sectionId") sectionId: string,
    @Body() dto: UpdateHomepageSectionDto
  ) {
    return this.cmsService.updateHomepageSection(actor, sectionId, dto);
  }

  @Delete("homepage-sections/:sectionId")
  @ApiOperation({ summary: "Delete a homepage section." })
  deleteHomepageSection(@CurrentUser() actor: RequestUser, @Param("sectionId") sectionId: string) {
    return this.cmsService.deleteHomepageSection(actor, sectionId);
  }

  @Get("seo/overview")
  @ApiOperation({ summary: "Read SEO workspace overview metrics." })
  getSeoOverview() {
    return this.cmsService.getSeoOverview();
  }

  @Get("seo")
  @ApiOperation({ summary: "List managed SEO entries." })
  listSeoEntries(@Query() query: SeoEntryQueryDto) {
    return this.cmsService.listAdminSeoEntries(query);
  }

  @Post("seo")
  @ApiOperation({ summary: "Create a managed SEO entry." })
  createSeoEntry(@CurrentUser() actor: RequestUser, @Body() dto: CreateSeoEntryDto) {
    return this.cmsService.createSeoEntry(actor, dto);
  }

  @Patch("seo/:seoEntryId")
  @ApiOperation({ summary: "Update a managed SEO entry." })
  updateSeoEntry(@CurrentUser() actor: RequestUser, @Param("seoEntryId") seoEntryId: string, @Body() dto: UpdateSeoEntryDto) {
    return this.cmsService.updateSeoEntry(actor, seoEntryId, dto);
  }

  @Delete("seo/:seoEntryId")
  @ApiOperation({ summary: "Archive a managed SEO entry." })
  deleteSeoEntry(@CurrentUser() actor: RequestUser, @Param("seoEntryId") seoEntryId: string) {
    return this.cmsService.deleteSeoEntry(actor, seoEntryId);
  }

  @Get("redirects")
  @ApiOperation({ summary: "List SEO redirects." })
  listRedirects(@Query() query: CmsRedirectQueryDto) {
    return this.cmsService.listAdminRedirects(query);
  }

  @Post("redirects")
  @ApiOperation({ summary: "Create an SEO redirect." })
  createRedirect(@CurrentUser() actor: RequestUser, @Body() dto: CreateCmsRedirectDto) {
    return this.cmsService.createRedirect(actor, dto);
  }

  @Patch("redirects/:redirectId")
  @ApiOperation({ summary: "Update an SEO redirect." })
  updateRedirect(@CurrentUser() actor: RequestUser, @Param("redirectId") redirectId: string, @Body() dto: UpdateCmsRedirectDto) {
    return this.cmsService.updateRedirect(actor, redirectId, dto);
  }

  @Delete("redirects/:redirectId")
  @ApiOperation({ summary: "Disable an SEO redirect." })
  deleteRedirect(@CurrentUser() actor: RequestUser, @Param("redirectId") redirectId: string) {
    return this.cmsService.deleteRedirect(actor, redirectId);
  }

  @Get("media")
  @ApiOperation({ summary: "List CMS media assets." })
  listMedia(@Query() query: CmsMediaQueryDto) {
    return this.cmsService.listAdminMedia(query);
  }

  @Post("media")
  @ApiOperation({ summary: "Create a CMS media asset record." })
  createMedia(@CurrentUser() actor: RequestUser, @Body() dto: CreateCmsMediaDto) {
    return this.cmsService.createMedia(actor, dto);
  }

  @Patch("media/:mediaId")
  @ApiOperation({ summary: "Update a CMS media asset record." })
  updateMedia(@CurrentUser() actor: RequestUser, @Param("mediaId") mediaId: string, @Body() dto: UpdateCmsMediaDto) {
    return this.cmsService.updateMedia(actor, mediaId, dto);
  }

  @Delete("media/:mediaId")
  @ApiOperation({ summary: "Delete a CMS media asset record." })
  deleteMedia(@CurrentUser() actor: RequestUser, @Param("mediaId") mediaId: string) {
    return this.cmsService.deleteMedia(actor, mediaId);
  }

  @Get("menus")
  @ApiOperation({ summary: "List CMS menu items." })
  listMenuItems(@Query() query: CmsMenuQueryDto) {
    return this.cmsService.listAdminMenuItems(query);
  }

  @Post("menus")
  @ApiOperation({ summary: "Create a CMS menu item." })
  createMenuItem(@CurrentUser() actor: RequestUser, @Body() dto: CreateCmsMenuItemDto) {
    return this.cmsService.createMenuItem(actor, dto);
  }

  @Patch("menus/:menuItemId")
  @ApiOperation({ summary: "Update a CMS menu item." })
  updateMenuItem(@CurrentUser() actor: RequestUser, @Param("menuItemId") menuItemId: string, @Body() dto: UpdateCmsMenuItemDto) {
    return this.cmsService.updateMenuItem(actor, menuItemId, dto);
  }

  @Delete("menus/:menuItemId")
  @ApiOperation({ summary: "Archive a CMS menu item." })
  deleteMenuItem(@CurrentUser() actor: RequestUser, @Param("menuItemId") menuItemId: string) {
    return this.cmsService.deleteMenuItem(actor, menuItemId);
  }

  @Get("revisions")
  @ApiOperation({ summary: "List CMS revision history." })
  listRevisions(@Query() query: CmsRevisionQueryDto) {
    return this.cmsService.listRevisions(query);
  }

  @Get("sitemap")
  @ApiOperation({ summary: "Read sitemap and robots health for admin." })
  getSitemapOverview() {
    return this.cmsService.getSitemapOverview();
  }
}
