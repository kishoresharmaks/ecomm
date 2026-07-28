import { BadRequestException } from "@nestjs/common";
import { ContentStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsService } from "./cms.service";

describe("CmsService promotional popups", () => {
  const popup = {
    id: "d2131468-950c-4312-b3a6-54f093d931e8",
    title: "Monsoon offers",
    desktopImageUrl: "indihub/admin/admin-1/banners/popup.webp",
    mobileImageUrl: null,
    imageAlt: "Monsoon marketplace offers",
    primaryLinkUrl: "/deals",
    primaryCtaLabel: "Shop offers",
    secondaryLinkUrl: null,
    secondaryCtaLabel: null,
    startsAt: null,
    endsAt: null,
    status: ContentStatus.PUBLISHED,
    sortOrder: 0,
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
    updatedAt: new Date("2026-07-26T10:00:00.000Z"),
  };
  const client = {
    cmsPopupAnnouncement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    cmsRevision: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
  const service = new CmsService(
    { client } as never,
    { isAvailable: () => false, deletePattern: vi.fn() } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    client.cmsPopupAnnouncement.create.mockResolvedValue(popup);
    client.cmsPopupAnnouncement.findMany.mockResolvedValue([popup]);
    client.auditLog.create.mockResolvedValue({});
    client.cmsRevision.aggregate.mockResolvedValue({ _max: { version: null } });
    client.cmsRevision.create.mockResolvedValue({});
  });

  it("rejects invalid schedules and incomplete CTA pairs before writing", async () => {
    await expect(service.createPopupAnnouncement({ id: "admin-1" } as never, {
      title: popup.title,
      desktopImageUrl: popup.desktopImageUrl,
      imageAlt: popup.imageAlt,
      startsAt: "2026-07-27T10:00:00.000Z",
      endsAt: "2026-07-27T09:00:00.000Z",
    })).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.createPopupAnnouncement({ id: "admin-1" } as never, {
      title: popup.title,
      desktopImageUrl: popup.desktopImageUrl,
      imageAlt: popup.imageAlt,
      secondaryCtaLabel: "Browse categories",
    })).rejects.toThrow("Secondary button label and destination link must be provided together.");

    expect(client.cmsPopupAnnouncement.create).not.toHaveBeenCalled();
  });

  it("normalizes managed images and records a valid popup", async () => {
    await service.createPopupAnnouncement({ id: "admin-1" } as never, {
      title: ` ${popup.title} `,
      desktopImageUrl: `/${popup.desktopImageUrl}`,
      mobileImageUrl: "indihub/admin/admin-1/banners/popup-mobile.webp",
      imageAlt: ` ${popup.imageAlt} `,
      primaryLinkUrl: "/deals",
      primaryCtaLabel: "Shop offers",
      status: ContentStatus.PUBLISHED,
      sortOrder: 2,
    });

    expect(client.cmsPopupAnnouncement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: popup.title,
        desktopImageUrl: popup.desktopImageUrl,
        imageAlt: popup.imageAlt,
        status: ContentStatus.PUBLISHED,
        sortOrder: 2,
      }),
    });
    expect(client.auditLog.create).toHaveBeenCalled();
    expect(client.cmsRevision.create).toHaveBeenCalled();
  });

  it("returns only active published or scheduled popups in carousel order", async () => {
    await expect(service.listPublishedPopupAnnouncements()).resolves.toEqual([popup]);

    expect(client.cmsPopupAnnouncement.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [ContentStatus.PUBLISHED, ContentStatus.SCHEDULED] },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: expect.any(Date) } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: expect.any(Date) } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  });
});
