import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ProductListingMode, ProductTemplateStatus, Prisma } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductTemplateDto, ProductTemplateFieldDto, UpdateProductTemplateDto } from "./dto/product-template.dto";

const templateInclude = {
  fields: {
    orderBy: [{ scope: "asc" as const }, { sortOrder: "asc" as const }, { label: "asc" as const }],
  },
  _count: {
    select: { categories: true },
  },
};

@Injectable()
export class ProductTemplatesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listTemplates() {
    return this.prisma.client.productTemplate.findMany({
      where: { deletedAt: null },
      include: templateInclude,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async createTemplate(actor: RequestUser, dto: CreateProductTemplateDto) {
    this.ensureUniqueFields(dto.fields ?? []);
    const code = this.normalizeCode(dto.code);
    const existing = await this.prisma.client.productTemplate.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException("Product template code already exists.");
    }

    const template = await this.prisma.client.productTemplate.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() || null,
        status: dto.status ?? ProductTemplateStatus.ACTIVE,
        listingMode: dto.listingMode ?? ProductListingMode.CART,
        sortOrder: dto.sortOrder ?? 0,
        fields: {
          create: this.fieldCreateInputs(dto.fields ?? []),
        },
      },
      include: templateInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "product_template.created",
        entityType: "product_template",
        entityId: template.id,
        newValue: template as Prisma.InputJsonValue,
      },
    });

    return template;
  }

  async updateTemplate(actor: RequestUser, templateId: string, dto: UpdateProductTemplateDto) {
    const existing = await this.getTemplateOrThrow(templateId);
    if (dto.fields) {
      this.ensureUniqueFields(dto.fields);
    }

    const code = dto.code ? this.normalizeCode(dto.code) : undefined;
    if (code && code !== existing.code) {
      const conflict = await this.prisma.client.productTemplate.findUnique({ where: { code } });
      if (conflict) {
        throw new ConflictException("Product template code already exists.");
      }
    }

    const template = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.productTemplate.update({
        where: { id: templateId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(code ? { code } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.listingMode !== undefined ? { listingMode: dto.listingMode } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.status && dto.status !== ProductTemplateStatus.ARCHIVED ? { deletedAt: null } : {}),
        },
      });

      if (dto.fields !== undefined) {
        await tx.productTemplateField.deleteMany({ where: { productTemplateId: templateId } });
        if (dto.fields.length) {
          await tx.productTemplateField.createMany({
            data: this.fieldCreateInputs(dto.fields).map((field) => ({
              ...field,
              productTemplateId: templateId,
            })),
          });
        }
      }

      return tx.productTemplate.findUniqueOrThrow({
        where: { id: updated.id },
        include: templateInclude,
      });
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "product_template.updated",
        entityType: "product_template",
        entityId: template.id,
        oldValue: existing as Prisma.InputJsonValue,
        newValue: template as Prisma.InputJsonValue,
      },
    });

    return template;
  }

  async archiveTemplate(actor: RequestUser, templateId: string) {
    const existing = await this.getTemplateOrThrow(templateId);
    const categoryCount = await this.prisma.client.category.count({
      where: { productTemplateId: templateId, deletedAt: null },
    });
    if (categoryCount > 0) {
      throw new ConflictException("Template is assigned to categories. Reassign those categories before archiving.");
    }

    const template = await this.prisma.client.productTemplate.update({
      where: { id: templateId },
      data: {
        status: ProductTemplateStatus.ARCHIVED,
        deletedAt: new Date(),
      },
      include: templateInclude,
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "product_template.archived",
        entityType: "product_template",
        entityId: template.id,
        oldValue: existing as Prisma.InputJsonValue,
        newValue: template as Prisma.InputJsonValue,
      },
    });

    return template;
  }

  private async getTemplateOrThrow(templateId: string) {
    const template = await this.prisma.client.productTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
      include: templateInclude,
    });
    if (!template) {
      throw new NotFoundException("Product template not found.");
    }

    return template;
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/_+/g, "_");
    if (!normalized || !/^[A-Z][A-Z0-9_]*$/.test(normalized)) {
      throw new BadRequestException("Template code must start with a letter and use uppercase letters, numbers, or underscores.");
    }

    return normalized;
  }

  private ensureUniqueFields(fields: ProductTemplateFieldDto[]) {
    const seen = new Set<string>();
    for (const field of fields) {
      const key = `${field.scope}:${field.fieldKey}`;
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate field key "${field.fieldKey}" for ${field.scope.toLowerCase()} scope.`);
      }
      seen.add(key);
    }
  }

  private fieldCreateInputs(fields: ProductTemplateFieldDto[]) {
    return fields.map((field, index) => ({
      label: field.label.trim(),
      fieldKey: field.fieldKey.trim(),
      fieldType: field.fieldType,
      scope: field.scope,
      isRequired: field.isRequired ?? false,
      options: (field.options ?? []).map((option) => option.trim()).filter(Boolean),
      placeholder: field.placeholder?.trim() || null,
      helpText: field.helpText?.trim() || null,
      isFilterable: field.isFilterable ?? false,
      isSearchable: field.isSearchable ?? false,
      sortOrder: field.sortOrder ?? index * 10,
    }));
  }
}
