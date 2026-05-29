import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, CategoryStatus, ContentStatus, Prisma, ProductStatus, SellerStatus, SeoEntityType } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { createSlug } from "../common/slug";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeStorageImageReference } from "../storage/storage-image";
import { CreateBannerDto, UpdateBannerDto } from "./dto/banner.dto";
import { CreateCmsMediaDto, CmsMediaQueryDto, UpdateCmsMediaDto } from "./dto/cms-media.dto";
import { CreateCmsMenuItemDto, CmsMenuQueryDto, UpdateCmsMenuItemDto } from "./dto/cms-menu.dto";
import { CreateCmsPageDto, UpdateCmsPageDto } from "./dto/cms-page.dto";
import { CmsQueryDto } from "./dto/cms-query.dto";
import { CreateCmsRedirectDto, CmsRedirectQueryDto, UpdateCmsRedirectDto } from "./dto/cms-redirect.dto";
import { CmsRevisionQueryDto } from "./dto/cms-revision.dto";
import { CreateHomepageSectionDto, UpdateHomepageSectionDto } from "./dto/homepage-section.dto";
import { CreateSeoEntryDto, SeoEntryQueryDto, UpdateSeoEntryDto } from "./dto/seo-entry.dto";

const PRIVATE_SITEMAP_EXCLUSIONS = [
  "/admin",
  "/account",
  "/checkout",
  "/cart",
  "/delivery",
  "/finance",
  "/api",
  "/sign-in",
  "/sign-up",
  "/seller/products",
  "/seller/orders",
  "/seller/profile",
  "/seller/finance",
  "/seller/b2b-enquiries",
  "/seller/reports",
  "/seller/subscription",
  "/b2b/company-profile",
  "/b2b/enquiries",
  "/b2b/sign-in",
  "/b2b/sign-up"
];

const STATIC_SITEMAP_ENTRIES = [
  { path: "/", changeFrequency: "daily", priority: 1, source: "homepage" },
  { path: "/categories", changeFrequency: "daily", priority: 0.8, source: "categories" },
  { path: "/stores", changeFrequency: "daily", priority: 0.8, source: "stores" },
  { path: "/about", changeFrequency: "monthly", priority: 0.45, source: "about" },
  { path: "/contact", changeFrequency: "monthly", priority: 0.55, source: "support_landing" },
  { path: "/seller/register", changeFrequency: "weekly", priority: 0.65, source: "seller_landing" },
  { path: "/b2b/register", changeFrequency: "weekly", priority: 0.65, source: "b2b_landing" }
] as const;

@Injectable()
export class CmsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listPublishedBanners() {
    const now = new Date();
    return this.prisma.client.banner.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });
  }

  listPublishedHomepageSections() {
    return this.prisma.client.homepageSection.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });
  }

  async getPublishedPage(slug: string) {
    const page = await this.prisma.client.cmsPage.findFirst({
      where: {
        slug,
        status: ContentStatus.PUBLISHED,
        deletedAt: null
      }
    });

    if (!page) {
      throw new NotFoundException("Published page not found.");
    }

    return page;
  }

  listPublishedPages() {
    return this.prisma.client.cmsPage.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null
      },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        status: true,
        publishedAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  async resolveSeoEntry(query: Pick<SeoEntryQueryDto, "entityType" | "entityId" | "routePath">) {
    const routePath = query.routePath ? this.normalizePath(query.routePath) : undefined;
    const clauses: Prisma.SeoEntryWhereInput[] = [];

    if (query.entityType && query.entityId) {
      clauses.push({
        entityType: query.entityType,
        entityId: query.entityId,
        status: ContentStatus.PUBLISHED
      });
    }

    if (query.entityType && !query.entityId) {
      clauses.push({
        entityType: query.entityType,
        entityId: null,
        status: ContentStatus.PUBLISHED
      });
    }

    if (routePath) {
      clauses.push({
        routePath,
        status: ContentStatus.PUBLISHED
      });
    }

    if (!clauses.length) {
      throw new BadRequestException("Provide entityType, entityId, or routePath to resolve SEO.");
    }

    return this.prisma.client.seoEntry.findFirst({
      where: { OR: clauses },
      orderBy: [{ entityId: "desc" }, { updatedAt: "desc" }]
    });
  }

  async listAdminSeoEntries(query: SeoEntryQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const routePath = query.routePath ? this.normalizePath(query.routePath) : undefined;
    const where: Prisma.SeoEntryWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(routePath ? { routePath } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { metaTitle: { contains: query.search, mode: "insensitive" } },
              { metaDescription: { contains: query.search, mode: "insensitive" } },
              { routePath: { contains: query.search, mode: "insensitive" } },
              { focusKeyword: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total, duplicates] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.seoEntry.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take });
      const total = await tx.seoEntry.count({ where });
      const duplicates = await this.findSeoDuplicates(tx);

      return [items, total, duplicates] as const;
    });

    return { items, total, page, limit: take, duplicates };
  }

  async createSeoEntry(actor: RequestUser, dto: CreateSeoEntryDto) {
    const data = this.prepareSeoInput(dto);
    await this.ensureSeoTargetAvailable(data);
    const seoEntry = await this.prisma.client.seoEntry.create({ data });
    await this.audit(actor, "cms.seo.created", "seo_entry", seoEntry.id, undefined, seoEntry);
    await this.recordRevision(actor, "seo_entry", seoEntry.id, "created", seoEntry);
    return seoEntry;
  }

  async updateSeoEntry(actor: RequestUser, seoEntryId: string, dto: UpdateSeoEntryDto) {
    const existing = await this.getSeoEntryOrThrow(seoEntryId);
    const data = this.prepareSeoInput({ ...existing, ...dto } as CreateSeoEntryDto);

    if (data.key !== existing.key || data.routePath !== existing.routePath) {
      await this.ensureSeoTargetAvailable(data, seoEntryId);
    }

    const seoEntry = await this.prisma.client.seoEntry.update({
      where: { id: seoEntryId },
      data: {
        key: data.key,
        entityType: data.entityType,
        entityId: data.entityId,
        routePath: data.routePath,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        canonicalUrl: data.canonicalUrl,
        robotsDirective: data.robotsDirective,
        ogTitle: data.ogTitle,
        ogDescription: data.ogDescription,
        ogImageUrl: data.ogImageUrl,
        twitterTitle: data.twitterTitle,
        twitterDescription: data.twitterDescription,
        twitterImageUrl: data.twitterImageUrl,
        focusKeyword: data.focusKeyword,
        structuredDataType: data.structuredDataType,
        seoScore: data.seoScore,
        status: data.status,
        publishedAt: data.publishedAt,
        scheduledAt: data.scheduledAt,
        reviewNote: data.reviewNote
      }
    });
    await this.audit(actor, "cms.seo.updated", "seo_entry", seoEntry.id, existing, seoEntry);
    await this.recordRevision(actor, "seo_entry", seoEntry.id, "updated", seoEntry);
    return seoEntry;
  }

  async deleteSeoEntry(actor: RequestUser, seoEntryId: string) {
    const existing = await this.getSeoEntryOrThrow(seoEntryId);
    const seoEntry = await this.prisma.client.seoEntry.update({
      where: { id: seoEntryId },
      data: { status: ContentStatus.ARCHIVED }
    });
    await this.audit(actor, "cms.seo.archived", "seo_entry", seoEntry.id, existing, seoEntry);
    await this.recordRevision(actor, "seo_entry", seoEntry.id, "archived", seoEntry);
    return seoEntry;
  }

  async getSeoOverview() {
    const [total, published, draft, review, scheduled, lowScore, redirects, media, duplicates] = await this.prisma.client.$transaction(
      async (tx) => {
        const total = await tx.seoEntry.count();
        const published = await tx.seoEntry.count({ where: { status: ContentStatus.PUBLISHED } });
        const draft = await tx.seoEntry.count({ where: { status: ContentStatus.DRAFT } });
        const review = await tx.seoEntry.count({ where: { status: ContentStatus.IN_REVIEW } });
        const scheduled = await tx.seoEntry.count({ where: { status: ContentStatus.SCHEDULED } });
        const lowScore = await tx.seoEntry.count({ where: { seoScore: { lt: 70 }, status: { not: ContentStatus.ARCHIVED } } });
        const redirects = await tx.cmsRedirect.count({ where: { enabled: true } });
        const media = await tx.cmsMediaAsset.count();
        const duplicates = await this.findSeoDuplicates(tx);

        return [total, published, draft, review, scheduled, lowScore, redirects, media, duplicates] as const;
      }
    );

    return {
      total,
      published,
      draft,
      inReview: review,
      scheduled,
      lowScore,
      redirects,
      media,
      duplicateCount: duplicates.length,
      duplicates
    };
  }

  async listAdminRedirects(query: CmsRedirectQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.CmsRedirectWhereInput = {
      ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
      ...(query.search
        ? {
            OR: [
              { sourcePath: { contains: query.search, mode: "insensitive" } },
              { targetPath: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.cmsRedirect.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take });
      const total = await tx.cmsRedirect.count({ where });

      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async createRedirect(actor: RequestUser, dto: CreateCmsRedirectDto) {
    const data = this.prepareRedirectInput(dto);
    await this.ensureRedirectAvailable(data.sourcePath);
    const redirect = await this.prisma.client.cmsRedirect.create({ data });
    await this.audit(actor, "cms.redirect.created", "cms_redirect", redirect.id, undefined, redirect);
    await this.recordRevision(actor, "cms_redirect", redirect.id, "created", redirect);
    return redirect;
  }

  async updateRedirect(actor: RequestUser, redirectId: string, dto: UpdateCmsRedirectDto) {
    const existing = await this.getRedirectOrThrow(redirectId);
    const data = this.prepareRedirectInput({ ...existing, ...dto });

    if (data.sourcePath !== existing.sourcePath) {
      await this.ensureRedirectAvailable(data.sourcePath);
    }

    const redirect = await this.prisma.client.cmsRedirect.update({ where: { id: redirectId }, data });
    await this.audit(actor, "cms.redirect.updated", "cms_redirect", redirect.id, existing, redirect);
    await this.recordRevision(actor, "cms_redirect", redirect.id, "updated", redirect);
    return redirect;
  }

  async deleteRedirect(actor: RequestUser, redirectId: string) {
    const existing = await this.getRedirectOrThrow(redirectId);
    const redirect = await this.prisma.client.cmsRedirect.update({
      where: { id: redirectId },
      data: { enabled: false }
    });
    await this.audit(actor, "cms.redirect.disabled", "cms_redirect", redirect.id, existing, redirect);
    await this.recordRevision(actor, "cms_redirect", redirect.id, "disabled", redirect);
    return redirect;
  }

  async listAdminMedia(query: CmsMediaQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.CmsMediaAssetWhereInput = {
      ...(query.usageContext ? { usageContext: query.usageContext } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { url: { contains: query.search, mode: "insensitive" } },
              { publicId: { contains: query.search, mode: "insensitive" } },
              { altText: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.cmsMediaAsset.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take });
      const total = await tx.cmsMediaAsset.count({ where });

      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async createMedia(actor: RequestUser, dto: CreateCmsMediaDto) {
    const url = normalizeStorageImageReference(dto.url, "Media asset") ?? dto.url;
    const media = await this.prisma.client.cmsMediaAsset.create({
      data: {
        title: this.blankToNull(dto.title),
        url,
        publicId: this.blankToNull(dto.publicId),
        assetId: this.blankToNull(dto.assetId),
        mediaType: dto.mediaType ?? "image",
        altText: this.blankToNull(dto.altText),
        caption: this.blankToNull(dto.caption),
        usageContext: this.blankToNull(dto.usageContext),
        width: dto.width ?? null,
        height: dto.height ?? null,
        bytes: dto.bytes ?? null,
        createdById: actor.id
      }
    });
    await this.audit(actor, "cms.media.created", "cms_media_asset", media.id, undefined, media);
    await this.recordRevision(actor, "cms_media_asset", media.id, "created", media);
    return media;
  }

  async updateMedia(actor: RequestUser, mediaId: string, dto: UpdateCmsMediaDto) {
    const existing = await this.getMediaOrThrow(mediaId);
    const normalizedUrl =
      dto.url !== undefined
        ? (normalizeStorageImageReference(dto.url, "Media asset") ?? dto.url)
        : undefined;
    const media = await this.prisma.client.cmsMediaAsset.update({
      where: { id: mediaId },
      data: {
        ...(dto.title !== undefined ? { title: this.blankToNull(dto.title) } : {}),
        ...(normalizedUrl !== undefined ? { url: normalizedUrl } : {}),
        ...(dto.publicId !== undefined ? { publicId: this.blankToNull(dto.publicId) } : {}),
        ...(dto.assetId !== undefined ? { assetId: this.blankToNull(dto.assetId) } : {}),
        ...(dto.mediaType !== undefined ? { mediaType: dto.mediaType } : {}),
        ...(dto.altText !== undefined ? { altText: this.blankToNull(dto.altText) } : {}),
        ...(dto.caption !== undefined ? { caption: this.blankToNull(dto.caption) } : {}),
        ...(dto.usageContext !== undefined ? { usageContext: this.blankToNull(dto.usageContext) } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.bytes !== undefined ? { bytes: dto.bytes } : {})
      }
    });
    await this.audit(actor, "cms.media.updated", "cms_media_asset", media.id, existing, media);
    await this.recordRevision(actor, "cms_media_asset", media.id, "updated", media);
    return media;
  }

  async deleteMedia(actor: RequestUser, mediaId: string) {
    const existing = await this.getMediaOrThrow(mediaId);
    await this.prisma.client.cmsMediaAsset.delete({ where: { id: mediaId } });
    await this.audit(actor, "cms.media.deleted", "cms_media_asset", mediaId, existing);
    return { deleted: true };
  }

  async listAdminMenuItems(query: CmsMenuQueryDto) {
    return this.prisma.client.cmsMenuItem.findMany({
      where: {
        ...(query.area ? { area: this.normalizeMenuArea(query.area) } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        parent: { select: { id: true, label: true, area: true } },
        children: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }
      },
      orderBy: [{ area: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
  }

  async listPublishedMenuItems(area = "header") {
    return this.prisma.client.cmsMenuItem.findMany({
      where: { area: this.normalizeMenuArea(area), parentId: null, status: ContentStatus.PUBLISHED },
      include: { children: { where: { status: ContentStatus.PUBLISHED }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
  }

  async createMenuItem(actor: RequestUser, dto: CreateCmsMenuItemDto) {
    const area = this.normalizeMenuArea(dto.area);
    const parentId = this.blankToNull(dto.parentId);
    await this.ensureMenuParent({ parentId, area });

    const menuItem = await this.prisma.client.cmsMenuItem.create({
      data: {
        area,
        label: this.normalizeMenuLabel(dto.label),
        href: this.normalizeMenuHref(dto.href),
        parentId,
        status: dto.status ?? ContentStatus.DRAFT,
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.audit(actor, "cms.menu.created", "cms_menu_item", menuItem.id, undefined, menuItem);
    await this.recordRevision(actor, "cms_menu_item", menuItem.id, "created", menuItem);
    return menuItem;
  }

  async updateMenuItem(actor: RequestUser, menuItemId: string, dto: UpdateCmsMenuItemDto) {
    const existing = await this.getMenuItemOrThrow(menuItemId);
    const area = dto.area !== undefined ? this.normalizeMenuArea(dto.area) : existing.area;
    const parentId = dto.parentId !== undefined ? this.blankToNull(dto.parentId) : existing.parentId;
    await this.ensureMenuParent({ parentId, area, currentId: menuItemId });

    const menuItem = await this.prisma.client.cmsMenuItem.update({
      where: { id: menuItemId },
      data: {
        ...(dto.area !== undefined ? { area } : {}),
        ...(dto.label !== undefined ? { label: this.normalizeMenuLabel(dto.label) } : {}),
        ...(dto.href !== undefined ? { href: this.normalizeMenuHref(dto.href) } : {}),
        ...(dto.parentId !== undefined ? { parentId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
    await this.audit(actor, "cms.menu.updated", "cms_menu_item", menuItem.id, existing, menuItem);
    await this.recordRevision(actor, "cms_menu_item", menuItem.id, "updated", menuItem);
    return menuItem;
  }

  async deleteMenuItem(actor: RequestUser, menuItemId: string) {
    const existing = await this.getMenuItemOrThrow(menuItemId);
    const menuItem = await this.prisma.client.cmsMenuItem.update({
      where: { id: menuItemId },
      data: { status: ContentStatus.ARCHIVED }
    });
    await this.audit(actor, "cms.menu.archived", "cms_menu_item", menuItem.id, existing, menuItem);
    await this.recordRevision(actor, "cms_menu_item", menuItem.id, "archived", menuItem);
    return menuItem;
  }

  async listRevisions(query: CmsRevisionQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.CmsRevisionWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {})
    };
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.cmsRevision.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });
      const total = await tx.cmsRevision.count({ where });

      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async getSitemapOverview() {
    const entries = await this.buildSitemapEntries();
    const [seoEntries, redirects] = await Promise.all([
      this.prisma.client.seoEntry.count({ where: { status: ContentStatus.PUBLISHED } }),
      this.prisma.client.cmsRedirect.count({ where: { enabled: true } })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      totalEntries: entries.length,
      seoEntries,
      redirects,
      excludedRoutePrefixes: PRIVATE_SITEMAP_EXCLUSIONS,
      entries: entries.slice(0, 80),
      health: {
        status: entries.length > 0 ? "READY" : "NEEDS_CONTENT",
        warnings: entries.length > 0 ? [] : ["No public sitemap entries are currently available."]
      }
    };
  }

  async getPublicSitemapEntries() {
    return this.buildSitemapEntries();
  }

  async listAdminPages(query: CmsQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.CmsPageWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.cmsPage.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take });
      const total = await tx.cmsPage.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async createPage(actor: RequestUser, dto: CreateCmsPageDto) {
    const slug = createSlug(dto.slug);
    await this.ensurePageSlugAvailable(slug);
    const page = await this.prisma.client.cmsPage.create({
      data: {
        slug,
        title: dto.title,
        content: dto.content,
        status: dto.status ?? ContentStatus.DRAFT,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null
      }
    });
    await this.audit(actor, "cms.page.created", "cms_page", page.id, undefined, page);
    await this.recordRevision(actor, "cms_page", page.id, "created", page);
    return page;
  }

  async updatePage(actor: RequestUser, pageId: string, dto: UpdateCmsPageDto) {
    const existing = await this.getPageOrThrow(pageId);
    const slug = dto.slug ? createSlug(dto.slug) : undefined;

    if (slug && slug !== existing.slug) {
      await this.ensurePageSlugAvailable(slug);
    }

    const page = await this.prisma.client.cmsPage.update({
      where: { id: pageId },
      data: {
        ...(slug ? { slug } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              publishedAt: dto.status === ContentStatus.PUBLISHED ? existing.publishedAt ?? new Date() : existing.publishedAt
            }
          : {})
      }
    });

    await this.audit(actor, "cms.page.updated", "cms_page", page.id, existing, page);
    await this.recordRevision(actor, "cms_page", page.id, "updated", page);
    return page;
  }

  async archivePage(actor: RequestUser, pageId: string) {
    const existing = await this.getPageOrThrow(pageId);
    const page = await this.prisma.client.cmsPage.update({
      where: { id: pageId },
      data: {
        status: ContentStatus.ARCHIVED,
        deletedAt: new Date()
      }
    });
    await this.audit(actor, "cms.page.archived", "cms_page", page.id, existing, page);
    await this.recordRevision(actor, "cms_page", page.id, "archived", page);
    return page;
  }

  async listAdminBanners(query: CmsQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.BannerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {})
    };
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.banner.findMany({ where, orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }], skip, take });
      const total = await tx.banner.count({ where });

      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async createBanner(actor: RequestUser, dto: CreateBannerDto) {
    const imageUrl = normalizeStorageImageReference(dto.imageUrl, "Banner image");
    const mobileImageUrl = normalizeStorageImageReference(dto.mobileImageUrl, "Mobile banner image");
    const banner = await this.prisma.client.banner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        imageUrl: imageUrl || null,
        linkUrl: dto.linkUrl ?? null,
        eyebrow: dto.eyebrow ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        secondaryCtaLabel: dto.secondaryCtaLabel ?? null,
        secondaryLinkUrl: dto.secondaryLinkUrl ?? null,
        mobileImageUrl: mobileImageUrl || null,
        imageAlt: dto.imageAlt ?? null,
        textPosition: dto.textPosition ?? null,
        startsAt: this.parseOptionalDate(dto.startsAt, "Banner start date"),
        endsAt: this.parseOptionalDate(dto.endsAt, "Banner end date"),
        status: dto.status ?? ContentStatus.DRAFT,
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.audit(actor, "cms.banner.created", "banner", banner.id, undefined, banner);
    await this.recordRevision(actor, "banner", banner.id, "created", banner);
    return banner;
  }

  async updateBanner(actor: RequestUser, bannerId: string, dto: UpdateBannerDto) {
    const existing = await this.getBannerOrThrow(bannerId);
    const imageUrl = normalizeStorageImageReference(dto.imageUrl, "Banner image");
    const mobileImageUrl = normalizeStorageImageReference(dto.mobileImageUrl, "Mobile banner image");
    const banner = await this.prisma.client.banner.update({
      where: { id: bannerId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle ?? null } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl ?? null } : {}),
        ...(dto.eyebrow !== undefined ? { eyebrow: dto.eyebrow ?? null } : {}),
        ...(dto.ctaLabel !== undefined ? { ctaLabel: dto.ctaLabel ?? null } : {}),
        ...(dto.secondaryCtaLabel !== undefined
          ? { secondaryCtaLabel: dto.secondaryCtaLabel ?? null }
          : {}),
        ...(dto.secondaryLinkUrl !== undefined
          ? { secondaryLinkUrl: dto.secondaryLinkUrl ?? null }
          : {}),
        ...(dto.mobileImageUrl !== undefined ? { mobileImageUrl: mobileImageUrl || null } : {}),
        ...(dto.imageAlt !== undefined ? { imageAlt: dto.imageAlt ?? null } : {}),
        ...(dto.textPosition !== undefined ? { textPosition: dto.textPosition ?? null } : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: this.parseOptionalDate(dto.startsAt, "Banner start date") }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: this.parseOptionalDate(dto.endsAt, "Banner end date") }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
    await this.audit(actor, "cms.banner.updated", "banner", banner.id, existing, banner);
    await this.recordRevision(actor, "banner", banner.id, "updated", banner);
    return banner;
  }

  async deleteBanner(actor: RequestUser, bannerId: string) {
    const existing = await this.getBannerOrThrow(bannerId);
    await this.prisma.client.banner.delete({ where: { id: bannerId } });
    await this.audit(actor, "cms.banner.deleted", "banner", bannerId, existing);
    await this.recordRevision(actor, "banner", bannerId, "deleted", existing);
    return { deleted: true };
  }

  async listAdminHomepageSections(query: CmsQueryDto) {
    const { skip, take, page } = this.pagination(query);
    const where: Prisma.HomepageSectionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {})
    };
    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.homepageSection.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        skip,
        take
      });
      const total = await tx.homepageSection.count({ where });

      return [items, total] as const;
    });
    return { items, total, page, limit: take };
  }

  async createHomepageSection(actor: RequestUser, dto: CreateHomepageSectionDto) {
    const section = await this.prisma.client.homepageSection.create({
      data: {
        sectionType: dto.sectionType,
        title: dto.title,
        config: dto.config as Prisma.InputJsonValue,
        status: dto.status ?? ContentStatus.DRAFT,
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.audit(actor, "cms.homepage_section.created", "homepage_section", section.id, undefined, section);
    await this.recordRevision(actor, "homepage_section", section.id, "created", section);
    return section;
  }

  async updateHomepageSection(actor: RequestUser, sectionId: string, dto: UpdateHomepageSectionDto) {
    const existing = await this.getHomepageSectionOrThrow(sectionId);
    const section = await this.prisma.client.homepageSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.sectionType !== undefined ? { sectionType: dto.sectionType } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });
    await this.audit(actor, "cms.homepage_section.updated", "homepage_section", section.id, existing, section);
    await this.recordRevision(actor, "homepage_section", section.id, "updated", section);
    return section;
  }

  async deleteHomepageSection(actor: RequestUser, sectionId: string) {
    const existing = await this.getHomepageSectionOrThrow(sectionId);
    await this.prisma.client.homepageSection.delete({ where: { id: sectionId } });
    await this.audit(actor, "cms.homepage_section.deleted", "homepage_section", sectionId, existing);
    await this.recordRevision(actor, "homepage_section", sectionId, "deleted", existing);
    return { deleted: true };
  }

  private prepareSeoInput(dto: CreateSeoEntryDto) {
    const routePath = dto.routePath ? this.normalizePath(dto.routePath) : this.defaultRouteForSeoEntity(dto.entityType);
    const entityId = this.blankToNull(dto.entityId);
    const key = this.seoKey(dto.entityType, entityId, routePath);
    const status = dto.status ?? ContentStatus.DRAFT;
    const publishedAt = status === ContentStatus.PUBLISHED ? new Date() : null;
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    return {
      key,
      entityType: dto.entityType,
      entityId,
      routePath,
      metaTitle: this.blankToNull(dto.metaTitle),
      metaDescription: this.blankToNull(dto.metaDescription),
      canonicalUrl: this.blankToNull(dto.canonicalUrl),
      robotsDirective: this.normalizeRobotsDirective(dto.robotsDirective),
      ogTitle: this.blankToNull(dto.ogTitle),
      ogDescription: this.blankToNull(dto.ogDescription),
      ogImageUrl: this.blankToNull(dto.ogImageUrl),
      twitterTitle: this.blankToNull(dto.twitterTitle),
      twitterDescription: this.blankToNull(dto.twitterDescription),
      twitterImageUrl: this.blankToNull(dto.twitterImageUrl),
      focusKeyword: this.blankToNull(dto.focusKeyword),
      structuredDataType: this.blankToNull(dto.structuredDataType),
      seoScore: this.calculateSeoScore(dto),
      status,
      publishedAt,
      scheduledAt,
      reviewNote: this.blankToNull(dto.reviewNote)
    };
  }

  private prepareRedirectInput(dto: {
    sourcePath?: string | null;
    targetPath?: string | null;
    statusCode?: number | null;
    enabled?: boolean | null;
    note?: string | null;
  }) {
    if (!dto.sourcePath || !dto.targetPath) {
      throw new BadRequestException("Redirect source and target paths are required.");
    }
    const sourcePath = this.normalizePath(dto.sourcePath);
    const targetPath = this.normalizeRedirectTarget(dto.targetPath);

    if (sourcePath === targetPath) {
      throw new BadRequestException("Redirect source and target cannot be the same.");
    }

    if (this.isPrivateRoute(sourcePath)) {
      throw new BadRequestException("Private/admin routes cannot be used as redirect source paths.");
    }

    return {
      sourcePath,
      targetPath,
      statusCode: dto.statusCode ?? 301,
      enabled: dto.enabled ?? true,
      note: this.blankToNull(dto.note)
    };
  }

  private async buildSitemapEntries() {
    const [products, categories, sellers, pages] = await Promise.all([
      this.prisma.client.product.findMany({
        where: {
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          seller: { status: SellerStatus.APPROVED, approvalStatus: ApprovalStatus.APPROVED },
          category: { status: CategoryStatus.ACTIVE, deletedAt: null }
        },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000
      }),
      this.prisma.client.category.findMany({
        where: { status: CategoryStatus.ACTIVE, deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1000
      }),
      this.prisma.client.seller.findMany({
        where: { status: SellerStatus.APPROVED, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1000
      }),
      this.prisma.client.cmsPage.findMany({
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1000
      })
    ]);

    const generatedAt = new Date().toISOString();
    const entries = [
      ...STATIC_SITEMAP_ENTRIES.map((entry) => ({ ...entry, lastModified: generatedAt })),
      ...categories.map((category) => ({
        path: `/categories/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.75,
        source: "category",
        lastModified: category.updatedAt.toISOString()
      })),
      ...products.map((product) => ({
        path: `/products/${product.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
        source: "product",
        lastModified: product.updatedAt.toISOString()
      })),
      ...sellers.map((seller) => ({
        path: `/stores/${seller.slug}`,
        changeFrequency: "weekly",
        priority: 0.65,
        source: "store",
        lastModified: seller.updatedAt.toISOString()
      })),
      ...pages.map((page) => ({
        path: `/${page.slug}`,
        changeFrequency: "monthly",
        priority: 0.45,
        source: "cms_page",
        lastModified: page.updatedAt.toISOString()
      }))
    ];

    return entries.filter((entry) => !this.isPrivateRoute(entry.path));
  }

  private defaultRouteForSeoEntity(entityType: SeoEntityType) {
    switch (entityType) {
      case SeoEntityType.HOME:
        return "/";
      case SeoEntityType.B2B_LANDING:
        return "/b2b/register";
      case SeoEntityType.SELLER_LANDING:
        return "/seller/register";
      case SeoEntityType.SEARCH:
        return "/search";
      default:
        return null;
    }
  }

  private seoKey(entityType: SeoEntityType, entityId?: string | null, routePath?: string | null) {
    if (entityId) {
      return `${entityType}:${entityId}`;
    }
    if (routePath) {
      return `${entityType}:ROUTE:${routePath}`;
    }
    throw new BadRequestException("SEO entry must target an entity id or a route path.");
  }

  private calculateSeoScore(dto: Partial<CreateSeoEntryDto>) {
    let score = 0;
    const title = dto.metaTitle?.trim() ?? "";
    const description = dto.metaDescription?.trim() ?? "";

    if (title.length >= 30 && title.length <= 65) {
      score += 20;
    } else if (title.length > 0) {
      score += 10;
    }
    if (description.length >= 120 && description.length <= 170) {
      score += 20;
    } else if (description.length > 0) {
      score += 10;
    }
    if (dto.canonicalUrl?.trim()) {
      score += 15;
    }
    if (dto.ogTitle?.trim() || dto.ogDescription?.trim()) {
      score += 10;
    }
    if (dto.ogImageUrl?.trim() || dto.twitterImageUrl?.trim()) {
      score += 15;
    }
    if (dto.focusKeyword?.trim()) {
      score += 10;
    }
    if (dto.structuredDataType?.trim()) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private normalizeRobotsDirective(value?: string | null) {
    const directive = value?.trim().toLowerCase() || "index,follow";
    const allowed = new Set(["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow"]);
    if (!allowed.has(directive)) {
      throw new BadRequestException("Robots directive must be index/follow, noindex/follow, index/nofollow, or noindex/nofollow.");
    }
    return directive;
  }

  private normalizePath(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
      throw new BadRequestException("Route paths must start with /.");
    }
    const withoutQuery = trimmed.split("#")[0]?.split("?")[0] ?? "/";
    const collapsed = withoutQuery.replace(/\/{2,}/g, "/");
    return collapsed.length > 1 ? collapsed.replace(/\/$/, "") : "/";
  }

  private normalizeRedirectTarget(value: string) {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return this.normalizePath(trimmed);
  }

  private normalizeMenuArea(value?: string | null) {
    const area = value?.trim().toLowerCase() || "header";
    if (!/^[a-z0-9_-]+$/.test(area)) {
      throw new BadRequestException("Menu area can only contain letters, numbers, hyphens, and underscores.");
    }
    return area;
  }

  private normalizeMenuLabel(value: string) {
    const label = value.trim();
    if (!label) {
      throw new BadRequestException("Menu label is required.");
    }
    return label;
  }

  private normalizeMenuHref(value: string) {
    const href = value.trim();
    if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) {
      throw new BadRequestException("Menu links must be internal paths or absolute http(s) URLs.");
    }
    return href;
  }

  private async ensureMenuParent({ parentId, area, currentId }: { parentId?: string | null; area: string; currentId?: string }) {
    if (!parentId) {
      return;
    }

    if (parentId === currentId) {
      throw new BadRequestException("A menu item cannot be its own parent.");
    }

    const parent = await this.prisma.client.cmsMenuItem.findUnique({
      where: { id: parentId },
      select: { id: true, area: true, label: true, parentId: true, status: true }
    });

    if (!parent || parent.status === ContentStatus.ARCHIVED) {
      throw new BadRequestException("Menu parent must be an active menu item.");
    }

    if (parent.area !== area) {
      throw new BadRequestException("Child menu items must use the same menu area as their parent.");
    }

    if (parent.parentId) {
      throw new BadRequestException("Only two menu levels are supported.");
    }
  }

  private async ensureSeoTargetAvailable(target: { key: string; routePath?: string | null }, currentSeoEntryId?: string) {
    const existing = await this.prisma.client.seoEntry.findFirst({
      where: {
        OR: [{ key: target.key }, ...(target.routePath ? [{ routePath: target.routePath }] : [])],
        ...(currentSeoEntryId ? { NOT: { id: currentSeoEntryId } } : {})
      }
    });
    if (existing) {
      throw new ConflictException(
        existing.routePath === target.routePath
          ? "SEO entry already exists for this route path."
          : "SEO entry already exists for this route or entity."
      );
    }
  }

  private isPrivateRoute(path: string) {
    return PRIVATE_SITEMAP_EXCLUSIONS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  private async ensureRedirectAvailable(sourcePath: string) {
    const existing = await this.prisma.client.cmsRedirect.findUnique({ where: { sourcePath } });
    if (existing) {
      throw new ConflictException("A redirect already exists for this source path.");
    }
  }

  private async findSeoDuplicates(tx: Prisma.TransactionClient) {
    const entries = await tx.seoEntry.findMany({
      where: { status: { not: ContentStatus.ARCHIVED } },
      select: { metaTitle: true, metaDescription: true }
    });
    const titleCounts = this.countDuplicateStrings(entries.map((entry) => entry.metaTitle));
    const descriptionCounts = this.countDuplicateStrings(entries.map((entry) => entry.metaDescription));

    return [
      ...titleCounts.map((item) => ({ field: "metaTitle", ...item })),
      ...descriptionCounts.map((item) => ({ field: "metaDescription", ...item }))
    ];
  }

  private countDuplicateStrings(values: Array<string | null>) {
    const counts = new Map<string, number>();
    for (const value of values) {
      const normalized = value?.trim();
      if (normalized) {
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
  }

  private pagination(query: { page?: number; limit?: number }) {
    return paginationFromQuery(query);
  }

  private async getPageOrThrow(pageId: string) {
    const page = await this.prisma.client.cmsPage.findFirst({ where: { id: pageId, deletedAt: null } });
    if (!page) {
      throw new NotFoundException("CMS page not found.");
    }
    return page;
  }

  private async ensurePageSlugAvailable(slug: string) {
    const existing = await this.prisma.client.cmsPage.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException("CMS page slug already exists.");
    }
  }

  private async getBannerOrThrow(bannerId: string) {
    const banner = await this.prisma.client.banner.findUnique({ where: { id: bannerId } });
    if (!banner) {
      throw new NotFoundException("Banner not found.");
    }
    return banner;
  }

  private parseOptionalDate(value: string | undefined | null, label: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} is invalid.`);
    }

    return date;
  }

  private async getHomepageSectionOrThrow(sectionId: string) {
    const section = await this.prisma.client.homepageSection.findUnique({ where: { id: sectionId } });
    if (!section) {
      throw new NotFoundException("Homepage section not found.");
    }
    return section;
  }

  private async getSeoEntryOrThrow(seoEntryId: string) {
    const seoEntry = await this.prisma.client.seoEntry.findUnique({ where: { id: seoEntryId } });
    if (!seoEntry) {
      throw new NotFoundException("SEO entry not found.");
    }
    return seoEntry;
  }

  private async getRedirectOrThrow(redirectId: string) {
    const redirect = await this.prisma.client.cmsRedirect.findUnique({ where: { id: redirectId } });
    if (!redirect) {
      throw new NotFoundException("Redirect not found.");
    }
    return redirect;
  }

  private async getMediaOrThrow(mediaId: string) {
    const media = await this.prisma.client.cmsMediaAsset.findUnique({ where: { id: mediaId } });
    if (!media) {
      throw new NotFoundException("CMS media asset not found.");
    }
    return media;
  }

  private async getMenuItemOrThrow(menuItemId: string) {
    const menuItem = await this.prisma.client.cmsMenuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new NotFoundException("CMS menu item not found.");
    }
    return menuItem;
  }

  private async recordRevision(actor: RequestUser, entityType: string, entityId: string, action: string, snapshot: unknown, note?: string) {
    const latest = await this.prisma.client.cmsRevision.aggregate({
      where: { entityType, entityId },
      _max: { version: true }
    });

    await this.prisma.client.cmsRevision.create({
      data: {
        entityType,
        entityId,
        version: (latest._max.version ?? 0) + 1,
        action,
        snapshot: this.toJsonValue(snapshot),
        note: note ?? null,
        actorUserId: actor.id
      }
    });
  }

  private blankToNull(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private async audit(
    actor: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown
  ) {
    const data: Prisma.AuditLogCreateInput = {
      actor: { connect: { id: actor.id } },
      action,
      entityType,
      entityId
    };

    if (oldValue !== undefined) {
      data.oldValue = this.toJsonValue(oldValue);
    }

    if (newValue !== undefined) {
      data.newValue = this.toJsonValue(newValue);
    }

    await this.prisma.client.auditLog.create({
      data
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
