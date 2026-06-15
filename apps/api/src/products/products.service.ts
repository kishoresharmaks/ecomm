import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  EmailRecipientType,
  InventoryMovementType,
  Prisma,
  ProductAttributeFieldType,
  ProductAttributeScope,
  ProductListingMode,
  ProductReviewStatus,
  ProductStatus,
  ProductTemplateStatus,
  SellerStatus,
  VariantStatus,
} from "@indihub/database";
import {
  isSoldResaleProduct,
  marketplaceProductEssentialFields,
  marketplaceProductRequiredEssentialFields,
  resaleProductConditions,
  type MarketplaceProductEssentialField,
} from "@indihub/shared-types";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  createdAtCursorOrderBy,
  createdAtCursorWhere,
  cursorPageFromItems,
  cursorPaginationFromQuery,
  decodeCursorPayload,
  encodeCursorPayload,
  paginationFromQuery,
} from "../common/pagination";
import { createSlug } from "../common/slug";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { SearchIndexService } from "../search/search-index.service";
import { readBooleanSetting } from "../settings/setting-value-utils";
import { SellerSubscriptionsService } from "../sellers/seller-subscriptions.service";
import { DealPricingService } from "../deals/deal-pricing.service";
import {
  normalizeStorageImageReference,
  safeStorageFolderSegment,
} from "../storage/storage-image";
import { ProductApprovalDecision, ProductApprovalDto } from "./dto/product-approval.dto";
import {
  CreateSellerProductDto,
  ProductVariantDto,
  UpdateProductVariantDto,
  UpdateSellerProductDto,
} from "./dto/product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";

const productInclude = {
  category: {
    include: {
      productTemplate: {
        include: {
          fields: {
            orderBy: [{ scope: "asc" as const }, { sortOrder: "asc" as const }, { label: "asc" as const }],
          },
        },
      },
    },
  },
  seller: {
    include: {
      profile: true,
      user: true,
    },
  },
  hsnMaster: true,
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  variants: {
    orderBy: [{ createdAt: "asc" as const }],
  },
};

const publicSellerProfileSelect = {
  logoUrl: true,
  bannerUrl: true,
  description: true,
};

const publicProductInclude = {
  category: {
    include: {
      productTemplate: {
        include: {
          fields: {
            orderBy: [{ scope: "asc" as const }, { sortOrder: "asc" as const }, { label: "asc" as const }],
          },
        },
      },
    },
  },
  seller: {
    select: {
      id: true,
      storeName: true,
      slug: true,
      sellerType: true,
      profile: {
        select: publicSellerProfileSelect,
      },
    },
  },
  hsnMaster: true,
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
  variants: {
    orderBy: [{ createdAt: "asc" as const }],
  },
};

const productAutoApproveSettingKey = "products.auto_approve.enabled";

type ProductSearchCursor = {
  rank: number | string;
  createdAt: string;
  id: string;
};

type ProductSearchRow = {
  id: string;
  rank: number;
  createdAt: Date;
};

type ProductListRow = {
  id: string;
  createdAt: Date;
};

type ProductReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Optional()
    @Inject(SellerSubscriptionsService)
    private readonly sellerSubscriptions?: SellerSubscriptionsService,
    @Optional()
    @Inject(DealPricingService)
    private readonly dealPricing?: DealPricingService,
    @Optional()
    @Inject(SearchIndexService)
    private readonly searchIndex?: SearchIndexService,
  ) {}

  async listPublicProducts(query: ProductQueryDto) {
    const search = query.search?.trim();
    if (search) {
      return this.listPublicProductsByFullTextSearch(query, search);
    }

    if (this.shouldUseCursorPagination(query)) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const rows = await this.findPublicProductListRows(query, take + 1, { cursor });
      const pageRows = cursorPageFromItems(rows, take);
      const items = await this.findPublicProductsByIds(pageRows.items.map((row) => row.id));

      return { items, pageInfo: pageRows.pageInfo, limit: take };
    }

    const { page, skip, take } = this.pagination(query);
    const [rows, total] = await Promise.all([
      this.findPublicProductListRows(query, take, { skip }),
      this.countPublicProductListRows(query),
    ]);
    const items = await this.findPublicProductsByIds(rows.map((row) => row.id));

    return { items, total, page, limit: take };
  }

  async getPublicProduct(slug: string) {
    const product = await this.prisma.client.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        seller: {
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      },
      include: publicProductInclude,
    });

    if (!product || isSoldResaleProduct(product)) {
      throw new NotFoundException("Product not found.");
    }

    const [decoratedProduct] = await this.decoratePublicProducts([product]);
    return decoratedProduct ?? product;
  }

  async listSellerProducts(actor: RequestUser, query: ProductQueryDto) {
    const seller = await this.resolveSeller(actor);
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      sellerId: seller.id,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { searchText: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.ProductWhereInput | undefined;
      const items = await this.prisma.client.product.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: productInclude,
        orderBy: createdAtCursorOrderBy(),
        take: take + 1,
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = this.pagination(query);
    const items = await this.prisma.client.product.findMany({
      where,
      include: productInclude,
      orderBy: createdAtCursorOrderBy(),
      skip,
      take,
    });
    const total = await this.prisma.client.product.count({ where });

    return { items, total, page, limit: take };
  }

  async getSellerProduct(actor: RequestUser, productId: string) {
    const seller = await this.resolveSeller(actor);
    const product = await this.prisma.client.product.findFirst({
      where: {
        id: productId,
        sellerId: seller.id,
        deletedAt: null,
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Seller product not found.");
    }

    return product;
  }

  async createSellerProduct(actor: RequestUser, dto: CreateSellerProductDto) {
    const seller = await this.resolveApprovedSeller(actor);
    await this.sellerSubscriptions?.ensureCanCreateProduct(seller.id);
    const images = this.normalizeProductImages(
      dto.images,
      "Product images",
      this.sellerUploadFolder(actor.id, "products"),
    );
    const category = await this.ensureActiveCategory(dto.categoryId);
    const attributes = this.applyCategoryTaxDefaults(
      category,
      this.validateAttributes(
        category.productTemplate?.fields ?? [],
        ProductAttributeScope.PRODUCT,
        dto.attributes,
        "Product attributes",
      ),
    );
    const productTaxFields = await this.resolveProductTaxFields(category, attributes);
    const variants = dto.variants.map((variant) => ({
      ...variant,
      attributes: this.validateAttributes(
        category.productTemplate?.fields ?? [],
        ProductAttributeScope.VARIANT,
        variant.attributes,
        `Variant ${variant.variantName ?? variant.sku ?? ""}`.trim() || "Variant attributes",
      ),
    }));
    const listingMode = category.productTemplate?.listingMode ?? ProductListingMode.CART;
    const slug = await this.createUniqueProductSlug(dto.name);
    const variantInputs = await this.prepareVariantInputs(dto.name, variants);
    const autoApproveProduct = await this.isProductAutoApprovalEnabled();
    const nextProductStatus = autoApproveProduct ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;
    const nextApprovalStatus = autoApproveProduct
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.PENDING_APPROVAL;

    if (autoApproveProduct) {
      this.ensureProductApprovalReadiness({
        attributes,
        hsnCode: productTaxFields.hsnCode,
        gstRatePercent: productTaxFields.gstRatePercent,
      });
    }

    const productId = await this.prisma.client.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: seller.id,
          categoryId: dto.categoryId,
          name: dto.name,
          slug,
          description: dto.description,
          status: nextProductStatus,
          approvalStatus: nextApprovalStatus,
          listingMode,
          attributes: this.jsonObjectOrNull(attributes),
          hsnCode: productTaxFields.hsnCode,
          gstRatePercent: productTaxFields.gstRatePercent,
          hsnMasterId: productTaxFields.hsnMasterId,
          searchText: this.createSearchText(dto.name, dto.description, attributes),
        },
      });

      if (images.length) {
        await tx.productImage.createMany({
          data: images.map((image, index) => ({
            productId: product.id,
            url: image.url,
            altText: image.altText ?? product.name,
            sortOrder: image.sortOrder ?? index,
            isPrimary: image.isPrimary ?? index === 0,
          })),
        });
      }

      for (const variantInput of variantInputs) {
        const variant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variantInput.sku,
            variantName: variantInput.variantName ?? null,
            pricePaise: variantInput.pricePaise,
            mrpPaise: variantInput.mrpPaise ?? null,
            stockQuantity: variantInput.stockQuantity ?? 0,
            packageWeightGrams: variantInput.packageWeightGrams ?? null,
            packageLengthCm: variantInput.packageLengthCm ?? null,
            packageBreadthCm: variantInput.packageBreadthCm ?? null,
            packageHeightCm: variantInput.packageHeightCm ?? null,
            status: variantInput.status ?? VariantStatus.ACTIVE,
            attributes: this.jsonObjectOrNull(variantInput.attributes),
          },
        });

        if (variant.stockQuantity > 0) {
          await tx.inventoryMovement.create({
            data: {
              productVariantId: variant.id,
              movementType: InventoryMovementType.INCREMENT,
              quantity: variant.stockQuantity,
              reason: "Initial seller stock",
              referenceType: "product",
              referenceId: product.id,
              createdById: actor.id,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: autoApproveProduct ? "product.auto_approved" : "product.submitted",
          entityType: "product",
          entityId: product.id,
          newValue: {
            name: product.name,
            sellerId: seller.id,
            status: product.status,
            approvalStatus: product.approvalStatus,
            autoApproved: autoApproveProduct,
          },
        },
      });

      return product.id;
    });

    const product = await this.getProductByIdOrThrow(productId);
    await this.enqueueProductSearchIndex(
      product.id,
      autoApproveProduct ? "product-auto-approved" : "product-submitted",
      product.sellerId,
      product.categoryId,
    );
    await this.notifyProductSubmission(product, autoApproveProduct);

    return product;
  }

  async updateSellerProduct(actor: RequestUser, productId: string, dto: UpdateSellerProductDto) {
    const seller = await this.resolveApprovedSeller(actor);
    const existing = await this.getSellerProductOrThrow(seller.id, productId);
    const images = this.normalizeProductImages(
      dto.images,
      "Product images",
      this.sellerUploadFolder(actor.id, "products"),
    );
    const category = await this.ensureActiveCategory(dto.categoryId ?? existing.categoryId);
    const attributes =
      dto.attributes !== undefined || dto.categoryId !== undefined
        ? this.applyCategoryTaxDefaults(
            category,
            this.validateAttributes(
              category.productTemplate?.fields ?? [],
              ProductAttributeScope.PRODUCT,
              dto.attributes ?? (existing.attributes as Record<string, unknown> | undefined),
              "Product attributes",
            ),
          )
        : (existing.attributes as Record<string, unknown> | null);
    const productTaxFields =
      dto.attributes !== undefined || dto.categoryId !== undefined
        ? await this.resolveProductTaxFields(category, attributes ?? {})
        : null;
    const variantDtos = dto.variants?.map((variant) => {
      if (variant.attributes === undefined) {
        return variant;
      }

      return {
        ...variant,
        attributes: this.validateAttributes(
          category.productTemplate?.fields ?? [],
          ProductAttributeScope.VARIANT,
          variant.attributes,
          `Variant ${variant.variantName ?? variant.sku ?? ""}`.trim() || "Variant attributes",
        ),
      };
    });
    const listingMode = category.productTemplate?.listingMode ?? ProductListingMode.CART;
    const autoApproveProduct = await this.isProductAutoApprovalEnabled();
    const nextProductStatus = autoApproveProduct ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;
    const nextApprovalStatus = autoApproveProduct
      ? ApprovalStatus.APPROVED
      : ApprovalStatus.PENDING_APPROVAL;

    if (autoApproveProduct) {
      this.ensureProductApprovalReadiness({
        attributes: attributes ?? existing.attributes,
        hsnCode: productTaxFields?.hsnCode ?? existing.hsnCode,
        gstRatePercent: productTaxFields?.gstRatePercent ?? existing.gstRatePercent,
      });
    }

    const updatedProductId = await this.prisma.client.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: productId },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.categoryId !== undefined ? { listingMode } : {}),
          ...(dto.attributes !== undefined || dto.categoryId !== undefined
            ? { attributes: this.jsonObjectOrNull(attributes) }
            : {}),
          ...(productTaxFields
            ? {
                hsnCode: productTaxFields.hsnCode,
                gstRatePercent: productTaxFields.gstRatePercent,
                hsnMasterId: productTaxFields.hsnMasterId,
              }
            : {}),
          ...(dto.name !== undefined || dto.description !== undefined || dto.attributes !== undefined || dto.categoryId !== undefined
            ? {
                searchText: this.createSearchText(
                  dto.name ?? existing.name,
                  dto.description ?? existing.description,
                  attributes ?? {},
                ),
              }
            : {}),
          status: nextProductStatus,
          approvalStatus: nextApprovalStatus,
        },
      });

      if (dto.images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((image, index) => ({
              productId,
              url: image.url,
              altText: image.altText ?? product.name,
              sortOrder: image.sortOrder ?? index,
              isPrimary: image.isPrimary ?? index === 0,
            })),
          });
        }
      }

      if (variantDtos?.length) {
        for (const variantDto of variantDtos) {
          await this.upsertVariant(tx, actor, productId, product.name, variantDto);
        }
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "product.updated",
          entityType: "product",
          entityId: product.id,
          oldValue: {
            name: existing.name,
            status: existing.status,
            approvalStatus: existing.approvalStatus,
          },
          newValue: {
            name: product.name,
            status: product.status,
            approvalStatus: product.approvalStatus,
            autoApproved: autoApproveProduct,
          },
        },
      });

      return product.id;
    });

    const product = await this.getProductByIdOrThrow(updatedProductId);
    await this.enqueueProductSearchIndex(
      product.id,
      autoApproveProduct ? "product-auto-approved-update" : "product-updated",
      product.sellerId,
      product.categoryId,
    );
    await this.notifyProductSubmission(product, autoApproveProduct);

    return product;
  }

  async archiveSellerProduct(actor: RequestUser, productId: string) {
    const seller = await this.resolveSeller(actor);
    const existing = await this.getSellerProductOrThrow(seller.id, productId);
    const product = await this.prisma.client.product.update({
      where: { id: productId },
      data: {
        status: ProductStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "product.archived",
        entityType: "product",
        entityId: product.id,
        oldValue: existing,
        newValue: product,
      },
    });

    await this.enqueueProductSearchIndex(product.id, "product-archived", product.sellerId, product.categoryId);
    return product;
  }

  async archiveAdminProduct(actor: RequestUser, productId: string) {
    const existing = await this.prisma.client.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: productInclude,
    });

    if (!existing) {
      throw new NotFoundException("Product not found.");
    }

    const updatedProduct = await this.prisma.client.product.update({
      where: { id: productId },
      data: {
        status: ProductStatus.ARCHIVED,
        deletedAt: new Date(),
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.product.archived",
        entityType: "product",
        entityId: productId,
        oldValue: {
          status: existing.status,
          approvalStatus: existing.approvalStatus,
          deletedAt: existing.deletedAt,
        },
        newValue: {
          status: updatedProduct.status,
          approvalStatus: updatedProduct.approvalStatus,
          deletedAt: updatedProduct.deletedAt,
        },
      },
    });

    await this.enqueueProductSearchIndex(updatedProduct.id, "admin-product-archived", updatedProduct.sellerId, updatedProduct.categoryId);
    return this.getProductByIdOrThrow(productId);
  }

  async listAdminProducts(query: ProductQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { searchText: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    if (query.cursor) {
      const { take, cursor } = cursorPaginationFromQuery(query);
      const cursorWhere = createdAtCursorWhere(cursor) as Prisma.ProductWhereInput | undefined;
      const items = await this.prisma.client.product.findMany({
        where: cursorWhere ? { AND: [where, cursorWhere] } : where,
        include: productInclude,
        orderBy: createdAtCursorOrderBy(),
        take: take + 1,
      });
      const pageResult = cursorPageFromItems(items, take);

      return { ...pageResult, limit: take };
    }

    const { page, skip, take } = this.pagination(query);
    const items = await this.prisma.client.product.findMany({
      where,
      include: productInclude,
      orderBy: createdAtCursorOrderBy(),
      skip,
      take,
    });
    const total = await this.prisma.client.product.count({ where });

    return { items, total, page, limit: take };
  }

  listPendingAdminProducts() {
    return this.prisma.client.product.findMany({
      where: {
        deletedAt: null,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      },
      include: productInclude,
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async updateProductApproval(productId: string, dto: ProductApprovalDto, actor: RequestUser) {
    const existing = await this.prisma.client.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: productInclude,
    });

    if (!existing) {
      throw new NotFoundException("Product not found.");
    }

    const approved = dto.decision === ProductApprovalDecision.APPROVE;
    if (approved) {
      this.ensureProductApprovalReadiness(existing);
    }

    const updatedProduct = await this.prisma.client.product.update({
      where: { id: productId },
      data: {
        approvalStatus: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        status: approved ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
      },
    });
    const product = await this.getProductByIdOrThrow(updatedProduct.id);

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: approved ? "product.approved" : "product.rejected",
        entityType: "product",
        entityId: product.id,
        oldValue: {
          status: existing.status,
          approvalStatus: existing.approvalStatus,
        },
        newValue: {
          status: updatedProduct.status,
          approvalStatus: updatedProduct.approvalStatus,
          note: dto.note,
        },
      },
    });

    await this.notifications.notifyEvent({
      eventCode: approved
        ? EMAIL_TRIGGER_EVENTS.PRODUCT_APPROVED
        : EMAIL_TRIGGER_EVENTS.PRODUCT_REJECTED,
      recipientType: EmailRecipientType.SELLER,
      recipient: product.seller.user.email,
      userId: product.seller.userId,
      variables: {
        productName: product.name,
        sellerName: product.seller.storeName,
        note: dto.note ?? "",
      },
    });

    await this.enqueueProductSearchIndex(product.id, approved ? "product-approved" : "product-rejected", product.sellerId, product.categoryId);
    return product;
  }

  private pagination(query: ProductQueryDto) {
    return paginationFromQuery(query);
  }

  private async enqueueProductSearchIndex(
    productId: string,
    reason: string,
    sellerId?: string | null,
    categoryId?: string | null,
  ) {
    try {
      await Promise.all([
        this.searchIndex?.enqueueProduct(productId, { reason }),
        sellerId ? this.searchIndex?.enqueueSeller(sellerId, { reason: `${reason}:seller-rollup` }) : undefined,
        categoryId ? this.searchIndex?.enqueueCategory(categoryId, { reason: `${reason}:category-rollup` }) : undefined,
      ]);
    } catch {
      // Search indexing is retryable background work; product writes remain the source of truth.
    }
  }

  private shouldUseCursorPagination(query: ProductQueryDto) {
    return query.pagination === "cursor" || Boolean(query.cursor);
  }

  private async listPublicProductsByFullTextSearch(query: ProductQueryDto, search: string) {
    if (this.shouldUseCursorPagination(query)) {
      const { take } = cursorPaginationFromQuery(query);
      const searchCursor = query.cursor ? this.decodeProductSearchCursor(query.cursor) : null;
      const rows = await this.findPublicProductSearchRows(search, query, take + 1, {
        cursor: searchCursor,
      });
      const pageRows = rows.slice(0, take);
      const items = await this.findPublicProductsByIds(pageRows.map((row) => row.id));
      const lastRow = pageRows[pageRows.length - 1] ?? null;

      return {
        items,
        limit: take,
        pageInfo: {
          hasNextPage: rows.length > take,
          nextCursor: rows.length > take && lastRow ? this.encodeProductSearchCursor(lastRow) : null,
        },
      };
    }

    const { page, skip, take } = this.pagination(query);
    const [rows, total] = await Promise.all([
      this.findPublicProductSearchRows(search, query, take, { skip }),
      this.countPublicProductSearchRows(search, query),
    ]);
    const items = await this.findPublicProductsByIds(rows.map((row) => row.id));

    return { items, total, page, limit: take };
  }

  private async findPublicProductListRows(
    query: ProductQueryDto,
    limit: number,
    options: { skip?: number; cursor?: { createdAt: Date; id: string } | null } = {},
  ) {
    const clauses = this.publicProductListWhereClauses(query);
    if (options.cursor) {
      clauses.push(
        Prisma.sql`(p.created_at, p.id) < (${options.cursor.createdAt}, ${options.cursor.id}::uuid)`,
      );
    }

    return this.prisma.client.$queryRaw<ProductListRow[]>`
      SELECT p.id, p.created_at AS "createdAt"
      FROM products p
      INNER JOIN sellers s ON s.id = p.seller_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE ${Prisma.join(clauses, " AND ")}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}
      ${options.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.empty}
    `;
  }

  private async countPublicProductListRows(query: ProductQueryDto) {
    const clauses = this.publicProductListWhereClauses(query);
    const rows = await this.prisma.client.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM products p
      INNER JOIN sellers s ON s.id = p.seller_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE ${Prisma.join(clauses, " AND ")}
    `;

    return rows[0]?.count ?? 0;
  }

  private publicProductListWhereClauses(query: ProductQueryDto) {
    const clauses = [
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.status = ${ProductStatus.ACTIVE}`,
      Prisma.sql`p.approval_status = ${ApprovalStatus.APPROVED}`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`s.status = ${SellerStatus.APPROVED}`,
      Prisma.sql`s.approval_status = ${ApprovalStatus.APPROVED}`,
      Prisma.sql`c.deleted_at IS NULL`,
      Prisma.sql`c.status = ${CategoryStatus.ACTIVE}`,
      this.publicProductAvailabilitySql(),
    ];

    if (query.categoryId) {
      clauses.push(Prisma.sql`p.category_id = ${query.categoryId}::uuid`);
    }
    if (query.sellerId) {
      clauses.push(Prisma.sql`p.seller_id = ${query.sellerId}::uuid`);
    }

    return clauses;
  }

  private async findPublicProductSearchRows(
    search: string,
    query: ProductQueryDto,
    limit: number,
    options: { skip?: number; cursor?: ProductSearchRow | null } = {},
  ) {
    const searchDocument = this.productSearchDocumentSql();
    const searchQuery = Prisma.sql`plainto_tsquery('simple', ${search})`;
    const rankExpression = Prisma.sql`ts_rank(${searchDocument}, ${searchQuery})`;
    const clauses = this.publicProductSearchWhereClauses(search, query, searchDocument, searchQuery);
    if (options.cursor) {
      clauses.push(
        Prisma.sql`(${rankExpression}, p.created_at, p.id) < (${options.cursor.rank}, ${options.cursor.createdAt}, ${options.cursor.id}::uuid)`,
      );
    }

    return this.prisma.client.$queryRaw<ProductSearchRow[]>`
      SELECT p.id, ${rankExpression}::float8 AS rank, p.created_at AS "createdAt"
      FROM products p
      INNER JOIN sellers s ON s.id = p.seller_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE ${Prisma.join(clauses, " AND ")}
      ORDER BY ${rankExpression} DESC, p.created_at DESC, p.id DESC
      LIMIT ${limit}
      ${options.skip ? Prisma.sql`OFFSET ${options.skip}` : Prisma.empty}
    `;
  }

  private async countPublicProductSearchRows(search: string, query: ProductQueryDto) {
    const searchDocument = this.productSearchDocumentSql();
    const searchQuery = Prisma.sql`plainto_tsquery('simple', ${search})`;
    const clauses = this.publicProductSearchWhereClauses(search, query, searchDocument, searchQuery);
    const rows = await this.prisma.client.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM products p
      INNER JOIN sellers s ON s.id = p.seller_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE ${Prisma.join(clauses, " AND ")}
    `;

    return rows[0]?.count ?? 0;
  }

  private publicProductSearchWhereClauses(
    search: string,
    query: ProductQueryDto,
    searchDocument: Prisma.Sql,
    searchQuery: Prisma.Sql,
  ) {
    const likeSearch = `%${search}%`;
    const clauses = [
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.status = ${ProductStatus.ACTIVE}`,
      Prisma.sql`p.approval_status = ${ApprovalStatus.APPROVED}`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`s.status = ${SellerStatus.APPROVED}`,
      Prisma.sql`s.approval_status = ${ApprovalStatus.APPROVED}`,
      Prisma.sql`c.deleted_at IS NULL`,
      Prisma.sql`c.status = ${CategoryStatus.ACTIVE}`,
      this.publicProductAvailabilitySql(),
      Prisma.sql`(
        ${searchDocument} @@ ${searchQuery}
        OR p.name ILIKE ${likeSearch}
        OR p.description ILIKE ${likeSearch}
        OR p.search_text ILIKE ${likeSearch}
      )`,
    ];

    if (query.categoryId) {
      clauses.push(Prisma.sql`p.category_id = ${query.categoryId}::uuid`);
    }
    if (query.sellerId) {
      clauses.push(Prisma.sql`p.seller_id = ${query.sellerId}::uuid`);
    }

    return clauses;
  }

  private publicProductAvailabilitySql() {
    return Prisma.sql`NOT (
      lower(coalesce(p.attributes->>'condition', '')) IN (${Prisma.join(
        resaleProductConditions.map((condition) => condition.toLowerCase()),
      )})
      AND NOT EXISTS (
        SELECT 1
        FROM product_variants pv
        WHERE pv.product_id = p.id
          AND pv.status = ${VariantStatus.ACTIVE}
          AND pv.stock_quantity > 0
      )
    )`;
  }

  private productSearchDocumentSql() {
    return Prisma.sql`to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.search_text, ''))`;
  }

  private async findPublicProductsByIds(productIds: string[]) {
    if (!productIds.length) {
      return [];
    }

    const products = await this.prisma.client.product.findMany({
      where: { id: { in: productIds } },
      include: publicProductInclude,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    const orderedProducts = productIds.flatMap((productId) => {
      const product = productById.get(productId);
      return product && !isSoldResaleProduct(product) ? [product] : [];
    });

    return this.decoratePublicProducts(orderedProducts);
  }

  private async decoratePublicProducts<T extends { id: string; variants: Array<{ pricePaise: number } & Record<string, unknown>> }>(
    products: T[],
  ) {
    const decoratedProducts = this.dealPricing ? await this.dealPricing.applyActiveDealsToProducts(products) : products;
    const reviewSummaries = await this.reviewSummariesForProducts(decoratedProducts.map((product) => product.id));

    return decoratedProducts.map((product) => ({
      ...product,
      reviewSummary: reviewSummaries.get(product.id) ?? this.emptyReviewSummary(),
    }));
  }

  private async reviewSummariesForProducts(productIds: string[]) {
    const summaries = new Map<string, ProductReviewSummary>();
    if (!productIds.length) {
      return summaries;
    }

    const where = {
      productId: { in: productIds },
      status: ProductReviewStatus.APPROVED,
    };
    const [aggregates, distributionRows] = await Promise.all([
      this.prisma.client.productReview.groupBy({
        by: ["productId"],
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.client.productReview.groupBy({
        by: ["productId", "rating"],
        where,
        _count: { _all: true },
      }),
    ]);

    for (const aggregate of aggregates) {
      summaries.set(aggregate.productId, {
        ...this.emptyReviewSummary(),
        averageRating:
          aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
        reviewCount: aggregate._count._all,
      });
    }

    for (const row of distributionRows) {
      const summary = summaries.get(row.productId) ?? this.emptyReviewSummary();
      if (row.rating >= 1 && row.rating <= 5) {
        summary.distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
      }
      summaries.set(row.productId, summary);
    }

    return summaries;
  }

  private emptyReviewSummary(): ProductReviewSummary {
    return {
      averageRating: null,
      reviewCount: 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };
  }

  private encodeProductSearchCursor(row: ProductSearchRow) {
    return encodeCursorPayload({
      rank: row.rank,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    });
  }

  private decodeProductSearchCursor(cursor: string) {
    const payload = decodeCursorPayload<Record<string, unknown>>(cursor) as ProductSearchCursor | null;
    if (!payload) {
      return null;
    }

    const rank = Number(payload.rank);
    const createdAt = new Date(payload.createdAt);
    if (
      !Number.isFinite(rank) ||
      Number.isNaN(createdAt.getTime()) ||
      typeof payload.id !== "string" ||
      !payload.id
    ) {
      throw new BadRequestException("cursor is invalid.");
    }

    return {
      rank,
      createdAt,
      id: payload.id,
    };
  }

  private async resolveSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
    });

    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }

    return seller;
  }

  private async resolveApprovedSeller(actor: RequestUser) {
    const seller = await this.resolveSeller(actor);

    if (
      seller.status !== SellerStatus.APPROVED ||
      seller.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new ForbiddenException("Seller approval is required for product operations.");
    }

    return seller;
  }

  private async ensureActiveCategory(categoryId: string) {
    const category = await this.prisma.client.category.findFirst({
      where: {
        id: categoryId,
        status: CategoryStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        productTemplate: {
          include: {
            fields: {
              orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Active category not found.");
    }

    if (
      category.productTemplate &&
      (category.productTemplate.status === ProductTemplateStatus.ARCHIVED ||
        category.productTemplate.deletedAt)
    ) {
      throw new BadRequestException("Category product template is archived.");
    }

    return category;
  }

  private async getSellerProductOrThrow(sellerId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: {
        id: productId,
        sellerId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException("Seller product not found.");
    }

    return product;
  }

  private async getProductByIdOrThrow(productId: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found.");
    }

    return product;
  }

  private async isProductAutoApprovalEnabled() {
    const setting = await this.prisma.client.setting.findUnique({
      where: { key: productAutoApproveSettingKey },
      select: { value: true },
    });

    return readBooleanSetting(setting?.value, false);
  }

  private notifyProductSubmission(
    product: {
      name: string;
      seller: { storeName: string; userId: string; user: { email: string } };
    },
    autoApproved: boolean,
  ) {
    if (autoApproved) {
      return this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.PRODUCT_APPROVED,
        recipientType: EmailRecipientType.SELLER,
        recipient: product.seller.user.email,
        userId: product.seller.userId,
        variables: {
          productName: product.name,
          sellerName: product.seller.storeName,
          note: "Auto approved by marketplace product settings.",
        },
      });
    }

    return Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.PRODUCT_SUBMITTED_SELLER,
        recipientType: EmailRecipientType.SELLER,
        recipient: product.seller.user.email,
        userId: product.seller.userId,
        variables: {
          productName: product.name,
          sellerName: product.seller.storeName,
        },
      }),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.PRODUCT_SUBMITTED_ADMIN, {
        productName: product.name,
        sellerName: product.seller.storeName,
      }),
    ]);
  }

  private async prepareVariantInputs(productName: string, variants: ProductVariantDto[]) {
    const prepared: Array<ProductVariantDto & { sku: string }> = [];

    for (const [index, variant] of variants.entries()) {
      const skuBase = variant.sku ?? `${productName}-${variant.variantName ?? index + 1}`;
      prepared.push({
        ...variant,
        sku: await this.createUniqueSku(skuBase),
      });
    }

    return prepared;
  }

  private normalizeProductImages(
    images:
      | Array<{ url: string; altText?: string; sortOrder?: number; isPrimary?: boolean }>
      | undefined,
    fieldName: string,
    requiredFolder: string,
  ) {
    return (images ?? []).map((image) => ({
      ...image,
      url: normalizeStorageImageReference(image.url, fieldName, requiredFolder) ?? image.url,
    }));
  }

  private async upsertVariant(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    productId: string,
    productName: string,
    variantDto: ProductVariantDto | UpdateProductVariantDto,
  ) {
    const existingVariant = variantDto.id
      ? await tx.productVariant.findFirst({
          where: { id: variantDto.id, productId },
        })
      : null;

    if (variantDto.id && !existingVariant) {
      throw new NotFoundException("Product variant not found.");
    }

    if (existingVariant) {
      const nextStock = variantDto.stockQuantity ?? existingVariant.stockQuantity;
      const stockDifference = nextStock - existingVariant.stockQuantity;
      const variant = await tx.productVariant.update({
        where: { id: existingVariant.id },
        data: {
          ...(variantDto.sku !== undefined
            ? { sku: await this.createUniqueSku(variantDto.sku) }
            : {}),
          ...(variantDto.variantName !== undefined
            ? { variantName: variantDto.variantName ?? null }
            : {}),
          ...(variantDto.pricePaise !== undefined ? { pricePaise: variantDto.pricePaise } : {}),
          ...(variantDto.mrpPaise !== undefined ? { mrpPaise: variantDto.mrpPaise ?? null } : {}),
          ...(variantDto.stockQuantity !== undefined
            ? { stockQuantity: variantDto.stockQuantity }
            : {}),
          ...(variantDto.packageWeightGrams !== undefined
            ? { packageWeightGrams: variantDto.packageWeightGrams ?? null }
            : {}),
          ...(variantDto.packageLengthCm !== undefined
            ? { packageLengthCm: variantDto.packageLengthCm ?? null }
            : {}),
          ...(variantDto.packageBreadthCm !== undefined
            ? { packageBreadthCm: variantDto.packageBreadthCm ?? null }
            : {}),
          ...(variantDto.packageHeightCm !== undefined
            ? { packageHeightCm: variantDto.packageHeightCm ?? null }
            : {}),
          ...(variantDto.status !== undefined ? { status: variantDto.status } : {}),
          ...(variantDto.attributes !== undefined
            ? { attributes: this.jsonObjectOrNull(variantDto.attributes) }
            : {}),
        },
      });

      if (stockDifference !== 0) {
        await tx.inventoryMovement.create({
          data: {
            productVariantId: variant.id,
            movementType:
              stockDifference > 0
                ? InventoryMovementType.INCREMENT
                : InventoryMovementType.DECREMENT,
            quantity: Math.abs(stockDifference),
            reason: "Seller product stock update",
            referenceType: "product",
            referenceId: productId,
            createdById: actor.id,
          },
        });
      }

      return variant;
    }

    if (variantDto.pricePaise === undefined) {
      throw new BadRequestException("Variant price is required when adding a new product variant.");
    }

    const sku = await this.createUniqueSku(
      variantDto.sku ?? `${productName}-${variantDto.variantName ?? "variant"}`,
    );
    const variant = await tx.productVariant.create({
      data: {
        productId,
        sku,
        variantName: variantDto.variantName ?? null,
        pricePaise: variantDto.pricePaise,
        mrpPaise: variantDto.mrpPaise ?? null,
        stockQuantity: variantDto.stockQuantity ?? 0,
        packageWeightGrams: variantDto.packageWeightGrams ?? null,
        packageLengthCm: variantDto.packageLengthCm ?? null,
        packageBreadthCm: variantDto.packageBreadthCm ?? null,
        packageHeightCm: variantDto.packageHeightCm ?? null,
        status: variantDto.status ?? VariantStatus.ACTIVE,
        attributes: this.jsonObjectOrNull(variantDto.attributes),
      },
    });

    if (variant.stockQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          productVariantId: variant.id,
          movementType: InventoryMovementType.INCREMENT,
          quantity: variant.stockQuantity,
          reason: "Seller added product variant stock",
          referenceType: "product",
          referenceId: productId,
          createdById: actor.id,
        },
      });
    }

    return variant;
  }

  private validateAttributes(
    fields: Array<{
      fieldKey: string;
      label: string;
      fieldType: ProductAttributeFieldType;
      scope: ProductAttributeScope;
      isRequired: boolean;
      options: unknown;
    }>,
    scope: ProductAttributeScope,
    input: Record<string, unknown> | undefined,
    context: string,
  ) {
    const scopedFields = fields.filter((field) => field.scope === scope);
    const source = input ?? {};
    const normalized: Record<string, unknown> = {};
    const marketplaceEssentials =
      scope === ProductAttributeScope.PRODUCT
        ? this.validateMarketplaceEssentialAttributes(source, context)
        : {};

    for (const field of scopedFields) {
      const value = source[field.fieldKey];
      const missing = this.isMissingAttributeValue(value);

      if (field.isRequired && missing) {
        throw new BadRequestException(`${context}: ${field.label} is required.`);
      }

      if (missing) {
        continue;
      }

      normalized[field.fieldKey] = this.normalizeAttributeValue(field, value, context);
    }

    return scope === ProductAttributeScope.PRODUCT
      ? { ...marketplaceEssentials, ...normalized }
      : normalized;
  }

  private validateMarketplaceEssentialAttributes(
    source: Record<string, unknown>,
    context: string,
  ) {
    const normalized: Record<string, unknown> = {};

    for (const field of marketplaceProductEssentialFields) {
      const value = source[field.key];

      if (this.isMissingAttributeValue(value)) {
        continue;
      }

      normalized[field.key] = this.normalizeMarketplaceEssentialValue(field, value, context);
    }

    return normalized;
  }

  private applyCategoryTaxDefaults(
    category: {
      defaultHsnCode?: string | null;
      defaultGstRatePercent?: unknown;
    },
    attributes: Record<string, unknown>,
  ) {
    const normalized = { ...attributes };

    if (this.isMissingAttributeValue(normalized.hsnCode) && category.defaultHsnCode) {
      normalized.hsnCode = category.defaultHsnCode;
    }

    if (
      this.isMissingAttributeValue(normalized.gstRatePercent) &&
      category.defaultGstRatePercent !== null &&
      category.defaultGstRatePercent !== undefined
    ) {
      normalized.gstRatePercent = Number(String(category.defaultGstRatePercent));
    }

    return normalized;
  }

  private async resolveProductTaxFields(
    category: { id: string; defaultHsnCode?: string | null; defaultGstRatePercent?: unknown },
    attributes: Record<string, unknown>,
  ) {
    const hsnCode = this.normalizedHsnCodeFromValue(attributes.hsnCode ?? category.defaultHsnCode);
    const gstRatePercent = this.normalizedGstRateFromValue(attributes.gstRatePercent ?? category.defaultGstRatePercent);
    const hsnMaster = hsnCode
      ? await this.prisma.client.hsnMaster.findFirst({
          where: {
            hsnCode,
            isActive: true,
            OR: [{ categoryId: category.id }, { categoryId: null }],
          },
          orderBy: [{ categoryId: "desc" }, { updatedAt: "desc" }],
        })
      : null;

    return {
      hsnCode,
      gstRatePercent,
      hsnMasterId: hsnMaster?.id ?? null,
    };
  }

  private ensureProductApprovalReadiness(product: {
    attributes: unknown;
    hsnCode?: string | null;
    gstRatePercent?: unknown;
  }) {
    const source = this.attributeRecord(product.attributes);
    if (this.isMissingAttributeValue(source.hsnCode) && product.hsnCode) {
      source.hsnCode = product.hsnCode;
    }
    if (
      this.isMissingAttributeValue(source.gstRatePercent) &&
      product.gstRatePercent !== null &&
      product.gstRatePercent !== undefined
    ) {
      source.gstRatePercent = Number(String(product.gstRatePercent));
    }

    const missing = marketplaceProductRequiredEssentialFields
      .filter((field) => this.isMissingAttributeValue(source[field.key]))
      .map((field) => field.label);

    if (missing.length) {
      throw new BadRequestException(`Product approval requires marketplace essentials: ${missing.join(", ")}.`);
    }
  }

  private attributeRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private normalizedHsnCodeFromValue(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return /^\d{4,8}$/.test(trimmed) ? trimmed : null;
  }

  private normalizedGstRateFromValue(value: unknown) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numberValue = typeof value === "number" ? value : Number(String(value));
    if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100) {
      return null;
    }

    return Number(numberValue.toFixed(2));
  }

  private normalizeMarketplaceEssentialValue(
    field: MarketplaceProductEssentialField,
    value: unknown,
    context: string,
  ) {
    switch (field.inputType) {
      case "TEXT":
      case "TEXTAREA": {
        if (typeof value !== "string") {
          throw new BadRequestException(`${context}: ${field.label} must be text.`);
        }
        const trimmed = value.trim();
        if (field.key === "hsnCode" && !/^\d{4,8}$/.test(trimmed)) {
          throw new BadRequestException(`${context}: ${field.label} must be a 4 to 8 digit code.`);
        }
        return trimmed;
      }

      case "NUMBER": {
        const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
        if (!Number.isFinite(numberValue) || numberValue < 0) {
          throw new BadRequestException(`${context}: ${field.label} must be a positive number.`);
        }
        if (field.key === "gstRatePercent" && numberValue > 100) {
          throw new BadRequestException(`${context}: ${field.label} must be between 0 and 100.`);
        }
        return Number(numberValue.toFixed(3));
      }

      case "SELECT": {
        if (typeof value !== "string") {
          throw new BadRequestException(`${context}: ${field.label} must be one selected value.`);
        }
        const selected = value.trim();
        const options = field.options ?? [];
        if (options.length && !options.includes(selected)) {
          throw new BadRequestException(`${context}: ${field.label} must be one of ${options.join(", ")}.`);
        }
        return selected;
      }

      case "MULTI_TEXT": {
        const values = Array.isArray(value)
          ? value.map((item) => String(item))
          : typeof value === "string"
            ? value.split(/[\n,]/)
            : null;
        if (!values) {
          throw new BadRequestException(`${context}: ${field.label} must be a list of text values.`);
        }
        return values.map((item) => item.trim()).filter(Boolean).slice(0, 30);
      }

      default:
        return value;
    }
  }

  private normalizeAttributeValue(
    field: {
      fieldKey: string;
      label: string;
      fieldType: ProductAttributeFieldType;
      options: unknown;
    },
    value: unknown,
    context: string,
  ) {
    switch (field.fieldType) {
      case ProductAttributeFieldType.TEXT:
      case ProductAttributeFieldType.TEXTAREA:
        if (typeof value !== "string") {
          throw new BadRequestException(`${context}: ${field.label} must be text.`);
        }
        return value.trim();

      case ProductAttributeFieldType.NUMBER: {
        const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
        if (!Number.isFinite(numberValue)) {
          throw new BadRequestException(`${context}: ${field.label} must be a number.`);
        }
        return numberValue;
      }

      case ProductAttributeFieldType.BOOLEAN:
        if (typeof value === "boolean") {
          return value;
        }
        if (value === "true") {
          return true;
        }
        if (value === "false") {
          return false;
        }
        throw new BadRequestException(`${context}: ${field.label} must be yes or no.`);

      case ProductAttributeFieldType.DATE:
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
          throw new BadRequestException(`${context}: ${field.label} must be a valid date.`);
        }
        return value;

      case ProductAttributeFieldType.SELECT: {
        if (typeof value !== "string") {
          throw new BadRequestException(`${context}: ${field.label} must be one selected value.`);
        }
        const selected = value.trim();
        this.ensureAllowedOption(field, selected, context);
        return selected;
      }

      case ProductAttributeFieldType.MULTI_SELECT: {
        const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : null;
        if (!selected) {
          throw new BadRequestException(`${context}: ${field.label} must be a list of selected values.`);
        }
        const normalizedValues = selected.map((item) => String(item).trim()).filter(Boolean);
        for (const item of normalizedValues) {
          this.ensureAllowedOption(field, item, context);
        }
        return normalizedValues;
      }

      default:
        return value;
    }
  }

  private ensureAllowedOption(
    field: { label: string; options: unknown },
    value: string,
    context: string,
  ) {
    const options = Array.isArray(field.options)
      ? field.options.map((option) => String(option).trim()).filter(Boolean)
      : [];
    if (options.length && !options.includes(value)) {
      throw new BadRequestException(`${context}: ${field.label} must be one of ${options.join(", ")}.`);
    }
  }

  private isMissingAttributeValue(value: unknown) {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value === "string") {
      return value.trim() === "";
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  private jsonObjectOrNull(value: Record<string, unknown> | undefined | null) {
    if (!value || Object.keys(value).length === 0) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonObject;
  }

  private async createUniqueProductSlug(name: string) {
    const baseSlug = createSlug(name) || "product";
    let candidate = baseSlug;
    let suffix = 1;

    while (await this.prisma.client.product.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private async createUniqueSku(value: string) {
    const baseSku = (createSlug(value) || "indihub-sku").toUpperCase();
    let candidate = baseSku;
    let suffix = 1;

    while (await this.prisma.client.productVariant.findUnique({ where: { sku: candidate } })) {
      suffix += 1;
      candidate = `${baseSku}-${suffix}`;
    }

    return candidate;
  }

  private createSearchText(name: string, description: string, attributes: Record<string, unknown> = {}) {
    const attributeText = Object.values(attributes)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value) => typeof value === "string" || typeof value === "number")
      .join(" ");

    return `${name} ${description} ${attributeText}`.trim().slice(0, 1000);
  }

  private sellerUploadFolder(userId: string, suffix: string) {
    return `indihub/sellers/${safeStorageFolderSegment(userId)}/${suffix}`;
  }
}
