import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  PushNotificationCampaignStatus,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import {
  CreatePushCampaignDto,
  PushCampaignQueryDto,
  PushCampaignSegmentFilterDto,
  UpdatePushCampaignDto,
} from "./dto/push-campaign.dto";

type NormalizedSegmentFilter = {
  countryCode?: string;
  stateCode?: string;
  city?: string;
  limit?: number;
};

type CampaignData = {
  title: string;
  body: string;
  imageAssetKey: string | null;
  imageUrl: string | null;
  href: string | null;
  segmentFilter: NormalizedSegmentFilter;
  scheduledAt: Date | null;
};

const allowedHrefPatterns = [
  /^\/deals$/,
  /^\/orders\/[A-Za-z0-9._-]+$/,
  /^\/products?\/[A-Za-z0-9._-]+$/,
  /^\/stores?\/[A-Za-z0-9._-]+$/,
  /^\/categories?\/[A-Za-z0-9._-]+$/,
];

@Injectable()
export class PushCampaignsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async listCampaigns(query: PushCampaignQueryDto) {
    const { page, take, skip } = paginationFromQuery(query, { defaultLimit: 25, maxLimit: 100 });
    const where: Prisma.PushNotificationCampaignWhereInput = {
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.pushNotificationCampaign.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        skip,
      }),
      this.prisma.client.pushNotificationCampaign.count({ where }),
    ]);

    return { items, total, page, limit: take, pageCount: Math.ceil(total / take) };
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.client.pushNotificationCampaign.findUnique({
      where: { id },
      include: {
        batches: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Push campaign not found.");
    }
    return campaign;
  }

  async createCampaign(actor: RequestUser, dto: CreatePushCampaignDto) {
    const data = await this.campaignData(dto);
    const previewCount = await this.previewCount(data.segmentFilter);
    const campaign = await this.prisma.client.pushNotificationCampaign.create({
      data: {
        ...data,
        previewCount,
        createdById: actor.id,
        updatedById: actor.id,
        status: dto.scheduledAt ? PushNotificationCampaignStatus.SCHEDULED : PushNotificationCampaignStatus.DRAFT,
      },
    });
    await this.audit(actor, "push_campaign.created", campaign.id, { previewCount });
    return campaign;
  }

  async updateCampaign(actor: RequestUser, id: string, dto: UpdatePushCampaignDto) {
    const existing = await this.getDraftLikeCampaign(id);
    const input: CreatePushCampaignDto = {
      title: dto.title ?? existing.title,
      body: dto.body ?? existing.body,
      segmentFilter: dto.segmentFilter ?? this.segmentFilterFromJson(existing.segmentFilter),
    };
    const imageAssetKey = dto.imageAssetKey === null ? undefined : dto.imageAssetKey ?? existing.imageAssetKey ?? undefined;
    const href = dto.href === null ? undefined : dto.href ?? existing.href ?? undefined;
    const scheduledAt = dto.scheduledAt === null ? undefined : dto.scheduledAt ?? existing.scheduledAt?.toISOString();
    if (imageAssetKey !== undefined) {
      input.imageAssetKey = imageAssetKey;
    }
    if (href !== undefined) {
      input.href = href;
    }
    if (scheduledAt !== undefined) {
      input.scheduledAt = scheduledAt;
    }
    const data = await this.campaignData(input);
    const previewCount = await this.previewCount(data.segmentFilter);
    const campaign = await this.prisma.client.pushNotificationCampaign.update({
      where: { id },
      data: {
        ...data,
        previewCount,
        updatedById: actor.id,
        status: data.scheduledAt ? PushNotificationCampaignStatus.SCHEDULED : PushNotificationCampaignStatus.DRAFT,
      },
    });
    await this.audit(actor, "push_campaign.updated", id, { previewCount });
    return campaign;
  }

  async previewCampaign(dto: CreatePushCampaignDto | UpdatePushCampaignDto) {
    const filter = this.normalizeSegmentFilter(dto.segmentFilter);
    return { count: await this.previewCount(filter), segmentFilter: filter };
  }

  async sendNow(actor: RequestUser, id: string) {
    const campaign = await this.prepareCampaignForSend(actor, id, null);
    await this.audit(actor, "push_campaign.send_now", id, { previewCount: campaign.previewCount });
    return campaign;
  }

  async schedule(actor: RequestUser, id: string, scheduledAt: string) {
    const date = this.parseScheduledAt(scheduledAt);
    const campaign = await this.prepareCampaignForSend(actor, id, date);
    await this.audit(actor, "push_campaign.scheduled", id, { scheduledAt: date.toISOString() });
    return campaign;
  }

  async cancel(actor: RequestUser, id: string) {
    const campaign = await this.prisma.client.pushNotificationCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Push campaign not found.");
    }
    if (campaign.status === PushNotificationCampaignStatus.SENT || campaign.status === PushNotificationCampaignStatus.CANCELLED) {
      return campaign;
    }
    const cancelled = await this.prisma.client.pushNotificationCampaign.update({
      where: { id },
      data: {
        status: PushNotificationCampaignStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: actor.id,
      },
    });
    await this.prisma.client.pushNotificationCampaignBatch.updateMany({
      where: { campaignId: id, status: { in: ["PENDING", "CLAIMED"] } },
      data: { status: "DONE", doneAt: new Date() },
    });
    await this.audit(actor, "push_campaign.cancelled", id);
    return cancelled;
  }

  async auditLog(id: string) {
    await this.getCampaign(id);
    return this.prisma.client.auditLog.findMany({
      where: { entityType: "push_notification_campaign", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  private async prepareCampaignForSend(actor: RequestUser, id: string, scheduledAt: Date | null) {
    const existing = await this.getDraftLikeCampaign(id);
    const tokens = await this.recipientTokens(this.segmentFilterFromJson(existing.segmentFilter));
    if (!tokens.length) {
      throw new BadRequestException("Campaign segment has no eligible customer push tokens.");
    }

    const batches = chunk(tokens.map((token) => token.id), 100);
    const previewCount = await this.previewCount(this.segmentFilterFromJson(existing.segmentFilter));
    return this.prisma.client.$transaction(async (tx) => {
      await tx.pushNotificationCampaignBatch.deleteMany({ where: { campaignId: id } });
      const updated = await tx.pushNotificationCampaign.update({
        where: { id },
        data: {
          status: scheduledAt ? PushNotificationCampaignStatus.SCHEDULED : PushNotificationCampaignStatus.SENDING,
          scheduledAt,
          previewCount,
          targetedCount: tokens.length,
          sentCount: 0,
          failedCount: 0,
          revokedCount: 0,
          sentAt: null,
          cancelledAt: null,
          updatedById: actor.id,
        },
      });
      await tx.pushNotificationCampaignBatch.createMany({
        data: batches.map((recipientTokenIds) => ({
          campaignId: id,
          recipientTokenIds,
        })),
      });
      return updated;
    });
  }

  private async getDraftLikeCampaign(id: string) {
    const campaign = await this.prisma.client.pushNotificationCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException("Push campaign not found.");
    }
    if (campaign.status !== PushNotificationCampaignStatus.DRAFT && campaign.status !== PushNotificationCampaignStatus.SCHEDULED) {
      throw new BadRequestException("Only draft or scheduled campaigns can be changed.");
    }
    return campaign;
  }

  private async campaignData(dto: CreatePushCampaignDto): Promise<CampaignData> {
    const segmentFilter = this.normalizeSegmentFilter(dto.segmentFilter);
    const imageAssetKey = this.normalizeImageKey(dto.imageAssetKey);
    const imageUrl = imageAssetKey ? await this.storage.publicImageUrl(imageAssetKey) : null;
    this.assertHref(dto.href);

    return {
      title: dto.title.trim(),
      body: dto.body.trim(),
      imageAssetKey,
      imageUrl,
      href: dto.href?.trim() || null,
      segmentFilter,
      scheduledAt: dto.scheduledAt ? this.parseScheduledAt(dto.scheduledAt) : null,
    };
  }

  private normalizeSegmentFilter(filter: PushCampaignSegmentFilterDto | undefined): NormalizedSegmentFilter {
    return {
      ...(filter?.countryCode?.trim() ? { countryCode: filter.countryCode.trim().toUpperCase() } : {}),
      ...(filter?.stateCode?.trim() ? { stateCode: filter.stateCode.trim() } : {}),
      ...(filter?.city?.trim() ? { city: filter.city.trim() } : {}),
      ...(filter?.limit ? { limit: Math.min(100000, Math.max(1, Math.trunc(filter.limit))) } : {}),
    };
  }

  private async previewCount(filter: NormalizedSegmentFilter) {
    return this.prisma.client.customerPushToken.count({ where: this.segmentWhere(filter) });
  }

  private async recipientTokens(filter: NormalizedSegmentFilter) {
    return this.prisma.client.customerPushToken.findMany({
      where: this.segmentWhere(filter),
      select: { id: true },
      orderBy: [{ customerId: "asc" }, { id: "asc" }],
      ...(filter.limit ? { take: filter.limit } : {}),
    });
  }

  private segmentWhere(filter: NormalizedSegmentFilter): Prisma.CustomerPushTokenWhereInput {
    return {
      enabled: true,
      revokedAt: null,
      customer: {
        status: UserStatus.ACTIVE,
        marketingCampaignsEnabled: true,
        ...(filter.countryCode ? { browsingCountryCode: filter.countryCode } : {}),
        ...(filter.stateCode ? { browsingStateCode: filter.stateCode } : {}),
        ...(filter.city ? { addresses: { some: { city: { equals: filter.city, mode: "insensitive" } } } } : {}),
      },
    };
  }

  private normalizeImageKey(value: string | null | undefined) {
    const key = value?.trim();
    if (!key) {
      return null;
    }
    if (key.includes("://") || key.startsWith("/api/storage/public-image")) {
      throw new BadRequestException("Campaign image must be a managed public image asset key.");
    }
    if (!/^indihub\/.+\.(jpe?g|png|webp)$/i.test(key) || key.includes("..")) {
      throw new BadRequestException("Campaign image must be a public JPG, PNG, or WebP asset key.");
    }
    return key.replaceAll("\\", "/");
  }

  private assertHref(value: string | null | undefined) {
    const href = value?.trim();
    if (!href) {
      return;
    }
    if (!allowedHrefPatterns.some((pattern) => pattern.test(href))) {
      throw new BadRequestException("Campaign deep link is not allowed.");
    }
  }

  private parseScheduledAt(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new BadRequestException("scheduledAt must be a future ISO date.");
    }
    return date;
  }

  private segmentFilterFromJson(value: Prisma.JsonValue): NormalizedSegmentFilter {
    return value && typeof value === "object" && !Array.isArray(value)
      ? this.normalizeSegmentFilter(value as PushCampaignSegmentFilterDto)
      : {};
  }

  private async audit(actor: RequestUser, action: string, entityId: string, newValue?: Prisma.InputJsonValue) {
    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action,
        entityType: "push_notification_campaign",
        entityId,
        ...(newValue ? { newValue } : {}),
      },
    });
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
