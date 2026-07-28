import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  CategoryStatus,
  ProductTaxClassification,
  ProductTemplateStatus,
} from "@indihub/database";
import { createSlug } from "../common/slug";
import { PrismaService } from "../prisma/prisma.service";
import { SearchIndexService } from "../search/search-index.service";
import { normalizePublicImageReference } from "../storage/storage-image";
import { StorefrontCacheService } from "../storefront/storefront-cache.service";
import type { RequestUser } from "../auth/types/indihub-request";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/create-category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorefrontCacheService) private readonly cache: StorefrontCacheService,
    @Optional()
    @Inject(SearchIndexService)
    private readonly searchIndex?: SearchIndexService,
  ) {}

  private async invalidateHomepageCache() {
    if (this.cache.isAvailable()) {
      await this.cache.deletePattern("home:*");
    }
  }

  private readonly productTemplateInclude = {
    fields: {
      orderBy: [{ scope: "asc" as const }, { sortOrder: "asc" as const }, { label: "asc" as const }]
    }
  };

  listPublicCategories(): Promise<unknown> {
    return this.prisma.client.category.findMany({
      where: {
        status: CategoryStatus.ACTIVE,
        deletedAt: null,
        parentId: null
      },
      include: {
        productTemplate: {
          include: this.productTemplateInclude
        },
        children: {
          where: {
            status: CategoryStatus.ACTIVE,
            deletedAt: null
          },
          include: {
            productTemplate: {
              include: this.productTemplateInclude
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        },
        _count: {
          select: { products: true }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async getPublicCategory(slug: string) {
    const category = await this.prisma.client.category.findFirst({
      where: {
        slug,
        status: CategoryStatus.ACTIVE,
        deletedAt: null
      },
      include: {
        productTemplate: {
          include: this.productTemplateInclude
        },
        parent: true,
        children: {
          where: {
            status: CategoryStatus.ACTIVE,
            deletedAt: null
          },
          include: {
            productTemplate: {
              include: this.productTemplateInclude
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      }
    });

    if (!category) {
      throw new NotFoundException("Category not found.");
    }

    return category;
  }

  listAdminCategories(): Promise<unknown> {
    return this.prisma.client.category.findMany({
      where: {
        deletedAt: null
      },
      include: {
        productTemplate: {
          include: this.productTemplateInclude
        },
        parent: true,
        _count: {
          select: { children: true, products: true }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async createCategory(dto: CreateCategoryDto, actor: RequestUser) {
    await this.ensureParentExists(dto.parentId);
    await this.ensureProductTemplateExists(dto.productTemplateId);
    const slug = await this.createUniqueSlug(dto.name);

    const imageUrl = normalizePublicImageReference(dto.imageUrl, "Category image");
    const taxDefaults = this.normalizeCategoryTaxDefaults(
      dto.defaultTaxClassification ?? ProductTaxClassification.TAXABLE,
      dto.defaultHsnCode,
      dto.defaultGstRatePercent,
    );
    const defaultSac = await this.resolveActiveSac(dto.defaultSacCode);

    const category = await this.prisma.client.category.create({
      data: {
        parentId: dto.parentId ?? null,
        productTemplateId: dto.productTemplateId ?? null,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        imageUrl: imageUrl || null,
        defaultTaxClassification: taxDefaults.classification,
        defaultHsnCode: taxDefaults.hsnCode,
        defaultSacCode: defaultSac?.sacCode ?? null,
        defaultSacMasterId: defaultSac?.id ?? null,
        defaultGstRatePercent: taxDefaults.gstRatePercent,
        defaultTaxDescription: this.normalizeOptionalText(dto.defaultTaxDescription),
        status: dto.status ?? CategoryStatus.ACTIVE,
        sortOrder: dto.sortOrder ?? 0
      }
    });

    await this.syncCategoryHsnMaster(category);

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "category.created",
        entityType: "category",
        entityId: category.id,
        newValue: category
      }
    });

    await this.enqueueCategorySearchIndex(category.id, "category-created");
    await this.invalidateHomepageCache();
    return category;
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto, actor: RequestUser) {
    const existing = await this.getCategoryOrThrow(categoryId);
    await this.ensureParentExists(dto.parentId, categoryId);
    await this.ensureProductTemplateExists(dto.productTemplateId);

    const slug = dto.slug ? createSlug(dto.slug) : undefined;

    if (slug && slug !== existing.slug) {
      const conflict = await this.prisma.client.category.findUnique({ where: { slug } });
      if (conflict) {
        throw new ConflictException("Category slug already exists.");
      }
    }

    const imageUrl = normalizePublicImageReference(dto.imageUrl, "Category image");
    const taxDefaults = this.normalizeCategoryTaxDefaults(
      dto.defaultTaxClassification ?? existing.defaultTaxClassification,
      dto.defaultHsnCode !== undefined ? dto.defaultHsnCode : existing.defaultHsnCode,
      dto.defaultGstRatePercent !== undefined
        ? dto.defaultGstRatePercent
        : existing.defaultGstRatePercent,
    );
    const defaultSac =
      dto.defaultSacCode !== undefined
        ? await this.resolveActiveSac(dto.defaultSacCode)
        : undefined;

    const category = await this.prisma.client.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.productTemplateId !== undefined ? { productTemplateId: dto.productTemplateId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(slug ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
        ...(dto.defaultTaxClassification !== undefined ||
        dto.defaultHsnCode !== undefined ||
        dto.defaultGstRatePercent !== undefined
          ? {
              defaultTaxClassification: taxDefaults.classification,
              defaultHsnCode: taxDefaults.hsnCode,
              defaultGstRatePercent: taxDefaults.gstRatePercent,
            }
          : {}),
        ...(dto.defaultSacCode !== undefined
          ? {
              defaultSacCode: defaultSac?.sacCode ?? null,
              defaultSacMasterId: defaultSac?.id ?? null,
            }
          : {}),
        ...(dto.defaultTaxDescription !== undefined
          ? { defaultTaxDescription: this.normalizeOptionalText(dto.defaultTaxDescription) }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {})
      }
    });

    await this.syncCategoryHsnMaster(category);

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "category.updated",
        entityType: "category",
        entityId: category.id,
        oldValue: existing,
        newValue: category
      }
    });

    await this.enqueueCategorySearchIndex(category.id, "category-updated");
    await this.invalidateHomepageCache();
    return category;
  }

  async archiveCategory(categoryId: string, actor: RequestUser) {
    const existing = await this.getCategoryOrThrow(categoryId);
    const activeProducts = await this.prisma.client.product.count({
      where: {
        categoryId,
        deletedAt: null
      }
    });

    if (activeProducts > 0) {
      throw new ConflictException("Category has products. Move or archive products before archiving the category.");
    }

    const category = await this.prisma.client.category.update({
      where: { id: categoryId },
      data: {
        status: CategoryStatus.ARCHIVED,
        deletedAt: new Date()
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "category.archived",
        entityType: "category",
        entityId: category.id,
        oldValue: existing,
        newValue: category
      }
    });

    await this.enqueueCategorySearchIndex(category.id, "category-archived");
    await this.invalidateHomepageCache();
    return category;
  }

  private async enqueueCategorySearchIndex(categoryId: string, reason: string) {
    try {
      await this.searchIndex?.enqueueCategory(categoryId, { reason });
      const products = await this.prisma.client.product.findMany({
        where: { categoryId },
        select: { id: true, sellerId: true },
      });
      await Promise.all(
        products.flatMap((product) => [
          this.searchIndex?.enqueueProduct(product.id, { reason: `${reason}:product-rollup` }),
          this.searchIndex?.enqueueSeller(product.sellerId, { reason: `${reason}:seller-rollup` }),
        ]),
      );
    } catch {
      // Search indexing is retryable background work; category writes remain the source of truth.
    }
  }

  private async getCategoryOrThrow(categoryId: string) {
    const category = await this.prisma.client.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null
      }
    });

    if (!category) {
      throw new NotFoundException("Category not found.");
    }

    return category;
  }

  private async ensureParentExists(parentId?: string | null, currentCategoryId?: string) {
    if (!parentId) {
      return;
    }

    if (parentId === currentCategoryId) {
      throw new ConflictException("Category cannot be its own parent.");
    }

    const parent = await this.prisma.client.category.findFirst({
      where: {
        id: parentId,
        deletedAt: null
      }
    });

    if (!parent) {
      throw new NotFoundException("Parent category not found.");
    }

    let ancestor = parent;
    while (ancestor.parentId) {
      if (ancestor.parentId === currentCategoryId) {
        throw new ConflictException("Category cannot be moved under one of its own child categories.");
      }

      const nextAncestor = await this.prisma.client.category.findFirst({
        where: {
          id: ancestor.parentId,
          deletedAt: null
        }
      });

      if (!nextAncestor) {
        break;
      }

      ancestor = nextAncestor;
    }
  }

  private async ensureProductTemplateExists(productTemplateId?: string | null) {
    if (!productTemplateId) {
      return;
    }

    const template = await this.prisma.client.productTemplate.findFirst({
      where: {
        id: productTemplateId,
        status: { not: ProductTemplateStatus.ARCHIVED },
        deletedAt: null
      }
    });

    if (!template) {
      throw new NotFoundException("Product template not found.");
    }
  }

  private async createUniqueSlug(name: string) {
    const baseSlug = createSlug(name) || "category";
    let candidate = baseSlug;
    let suffix = 1;

    while (await this.prisma.client.category.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private normalizeHsnCode(value: string | null | undefined) {
    if (value === undefined) {
      return null;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeGstRate(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const numberValue = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100) {
      throw new BadRequestException("Default GST rate must be between 0 and 100.");
    }

    return Number(numberValue.toFixed(2));
  }

  private normalizeOptionalText(value: string | null | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  private normalizeCategoryTaxDefaults(
    classification: ProductTaxClassification,
    defaultHsnCode: string | null | undefined,
    defaultGstRatePercent: unknown,
  ) {
    const hsnCode = this.normalizeHsnCode(defaultHsnCode);
    const requestedRate = this.normalizeGstRate(defaultGstRatePercent);
    const gstRatePercent =
      classification === ProductTaxClassification.TAXABLE ? requestedRate : 0;

    if (
      classification === ProductTaxClassification.TAXABLE &&
      Boolean(hsnCode) !== (gstRatePercent !== null)
    ) {
      throw new BadRequestException("Default HSN code and GST rate must be set together.");
    }
    if (
      classification === ProductTaxClassification.TAXABLE &&
      gstRatePercent !== null &&
      gstRatePercent <= 0
    ) {
      throw new BadRequestException("A taxable category default must use a GST rate greater than zero.");
    }
    if (classification === ProductTaxClassification.NIL_RATED && !hsnCode) {
      throw new BadRequestException("A nil-rated category default requires an HSN code.");
    }

    return { classification, hsnCode, gstRatePercent };
  }

  private async syncCategoryHsnMaster(category: {
    id: string;
    name: string;
    description?: string | null;
    defaultHsnCode?: string | null;
    defaultGstRatePercent?: unknown;
    defaultTaxDescription?: string | null;
  }) {
    if (!category.defaultHsnCode || category.defaultGstRatePercent === null || category.defaultGstRatePercent === undefined) {
      return;
    }

    const gstRatePercent = this.normalizeGstRate(String(category.defaultGstRatePercent));
    if (gstRatePercent === null) {
      return;
    }

    await this.prisma.client.hsnMaster.upsert({
      where: {
        hsnCode_categoryId: {
          hsnCode: category.defaultHsnCode,
          categoryId: category.id,
        },
      },
      update: {
        description:
          category.defaultTaxDescription?.trim() ||
          category.description?.trim() ||
          `${category.name} default HSN`,
        gstRatePercent,
        isActive: true,
      },
      create: {
        hsnCode: category.defaultHsnCode,
        description:
          category.defaultTaxDescription?.trim() ||
          category.description?.trim() ||
          `${category.name} default HSN`,
        gstRatePercent,
        categoryId: category.id,
        isActive: true,
      },
    });
  }

  private async resolveActiveSac(value: string | null | undefined) {
    const sacCode = value?.trim() || null;
    if (!sacCode) {
      return null;
    }
    if (!/^\d{6}$/.test(sacCode)) {
      throw new BadRequestException("Default SAC code must contain exactly 6 digits.");
    }
    const sac = await this.prisma.client.sacMaster.findFirst({
      where: { sacCode, isActive: true },
      select: { id: true, sacCode: true },
    });
    if (!sac) {
      throw new BadRequestException("Select an active SAC code from the SAC master.");
    }
    return sac;
  }
}
