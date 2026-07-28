import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  Prisma,
  ReportExportAudience,
  ReportExportStatus,
  ReportExportType,
  SellerStatus,
  SellerTaxRegistrationStatus,
  countReportExportRows,
  gstr1ReviewPeriod,
  isGstr1ReviewExportType,
  reportExportCsvHeader,
  reportExportCsvRow,
  reportExportFileName,
  reportExportRows,
  reportExportTablePage,
  type ReportExportFilters,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CreateReportExportDto, ReportExportListQueryDto } from "./dto/report-export.dto";
import { OperationalReportQueryDto } from "./dto/operational-report-query.dto";

const immediateRowLimit = 25_000;
const maxExportBytes = 250 * 1024 * 1024;
const retentionMs = 30 * 24 * 60 * 60 * 1000;

const audienceTypes: Record<ReportExportAudience, ReadonlySet<ReportExportType>> = {
  [ReportExportAudience.ADMIN]: new Set([
    ReportExportType.ADMIN_SALES,
    ReportExportType.ADMIN_SELLERS,
    ReportExportType.ADMIN_PRODUCTS,
    ReportExportType.ADMIN_ENQUIRIES,
    ReportExportType.GSTR1_REVIEW_SELLER_XLSX,
    ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP,
    ReportExportType.GSTR1_REVIEW_PLATFORM_XLSX,
  ]),
  [ReportExportAudience.FINANCE]: new Set([
    ReportExportType.FINANCE_PAYMENTS,
    ReportExportType.FINANCE_COD_COLLECTIONS,
    ReportExportType.FINANCE_ORDER_SETTLEMENTS,
    ReportExportType.FINANCE_SERVICE_SETTLEMENTS,
    ReportExportType.FINANCE_PAYOUTS,
    ReportExportType.FINANCE_SERVICE_RECEIVABLES,
    ReportExportType.GSTR1_REVIEW_SELLER_XLSX,
    ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP,
    ReportExportType.GSTR1_REVIEW_PLATFORM_XLSX,
  ]),
  [ReportExportAudience.SELLER]: new Set([
    ReportExportType.SELLER_SALES,
    ReportExportType.SELLER_INVENTORY,
    ReportExportType.SELLER_FINANCE,
    ReportExportType.SELLER_TAX,
    ReportExportType.SELLER_RETURNS,
    ReportExportType.GSTR1_REVIEW_SELLER_XLSX,
  ]),
};

@Injectable()
export class ReportExportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async create(
    actor: RequestUser,
    audience: ReportExportAudience,
    dto: CreateReportExportDto,
  ) {
    this.assertAllowedType(audience, dto.exportType);
    const reviewExport = isGstr1ReviewExportType(dto.exportType);
    const sellerId = await this.exportSellerId(actor, audience, dto);
    const filters = this.filters(dto);
    if (reviewExport) {
      try {
        gstr1ReviewPeriod(filters);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid GSTR-1 review period.",
        );
      }
    }
    const rowCount = reviewExport
      ? 0
      : await countReportExportRows(
          this.prisma.client,
          dto.exportType,
          filters,
          sellerId,
        );
    const fileName = reportExportFileName(dto.exportType);
    const contentType = reportExportContentType(dto.exportType);
    const job = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.reportExportJob.create({
        data: {
          audience,
          exportType: dto.exportType,
          actorUserId: actor.id,
          sellerId,
          filters: filters as Prisma.InputJsonObject,
          fileName,
          contentType,
          rowCount,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: reviewExport
            ? "report.gstr1_review.requested"
            : "report.export.requested",
          entityType: "report_export_job",
          entityId: created.id,
          newValue: {
            audience,
            exportType: dto.exportType,
            sellerId,
            ...filters,
          },
        },
      });
      return created;
    });

    if (reviewExport || !reportExportRunsImmediately(rowCount)) {
      return this.present(job);
    }

    return this.present(
      await this.completeImmediate(
        job.id,
        actor.id,
        dto.exportType,
        filters,
        sellerId,
      ),
    );
  }

  async list(
    actor: RequestUser,
    audience: ReportExportAudience,
    query: ReportExportListQueryDto,
  ) {
    const { page, take, skip } = paginationFromQuery(query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const where = await this.authorizedWhere(actor, audience, {
      ...(query.status ? { status: query.status } : {}),
      ...(query.exportType ? { exportType: query.exportType } : {}),
    });
    const [items, total] = await Promise.all([
      this.prisma.client.reportExportJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.client.reportExportJob.count({ where }),
    ]);
    return {
      items: items.map((item) => this.present(item)),
      pageInfo: {
        page,
        limit: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    };
  }

  async detail(
    actor: RequestUser,
    audience: ReportExportAudience,
    jobId: string,
  ) {
    return this.present(await this.requireJob(actor, audience, jobId));
  }

  async page(
    actor: RequestUser,
    audience: ReportExportAudience,
    exportType: ReportExportType,
    query: OperationalReportQueryDto,
  ) {
    this.assertAllowedType(audience, exportType);
    if (isGstr1ReviewExportType(exportType)) {
      throw new BadRequestException(
        "GSTR-1 review workbooks are available through export history, not the tabular report API.",
      );
    }
    const sellerId =
      audience === ReportExportAudience.SELLER
        ? await this.sellerIdForActor(actor)
        : null;
    return reportExportTablePage(
      this.prisma.client,
      exportType,
      this.filters(query),
      query.page,
      query.limit,
      sellerId,
    );
  }

  async retry(
    actor: RequestUser,
    audience: ReportExportAudience,
    jobId: string,
  ) {
    const job = await this.requireJob(actor, audience, jobId);
    if (
      job.status !== ReportExportStatus.FAILED &&
      job.status !== ReportExportStatus.EXPIRED
    ) {
      throw new BadRequestException("Only failed or expired exports can be retried.");
    }
    return this.present(await this.prisma.client.reportExportJob.update({
      where: { id: job.id },
      data: {
        status: ReportExportStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        errorMessage: null,
        storageKey: null,
        sha256: null,
        byteSize: 0,
        completedAt: null,
        expiresAt: null,
      },
    }));
  }

  async download(
    actor: RequestUser,
    audience: ReportExportAudience,
    jobId: string,
  ) {
    const job = await this.requireJob(actor, audience, jobId);
    if (
      job.status !== ReportExportStatus.COMPLETED ||
      !job.storageKey ||
      !job.fileName
    ) {
      throw new BadRequestException("This export is not ready for download.");
    }
    if (job.expiresAt && job.expiresAt <= new Date()) {
      await this.prisma.client.reportExportJob.update({
        where: { id: job.id },
        data: { status: ReportExportStatus.EXPIRED },
      });
      throw new BadRequestException("This export has expired. Retry it to create a new file.");
    }
    return {
      job,
      access: await this.storage.reportExportDocumentAccess(job.storageKey),
    };
  }

  private async completeImmediate(
    jobId: string,
    actorUserId: string,
    exportType: ReportExportType,
    filters: ReportExportFilters,
    sellerId: string | null,
  ) {
    await this.prisma.client.reportExportJob.update({
      where: { id: jobId },
      data: {
        status: ReportExportStatus.PROCESSING,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    try {
      const header = `\uFEFF${reportExportCsvHeader(exportType)}`;
      const chunks = [header];
      let byteSize = Buffer.byteLength(header, "utf8");
      let rowCount = 0;
      for await (const row of reportExportRows(
        this.prisma.client,
        exportType,
        filters,
        sellerId,
      )) {
        const line = reportExportCsvRow(exportType, row);
        byteSize += Buffer.byteLength(line, "utf8");
        if (byteSize > maxExportBytes) {
          throw new BadRequestException(
            "The report exceeds the 250 MB export limit. Narrow the filters and try again.",
          );
        }
        chunks.push(line);
        rowCount += 1;
      }

      const buffer = Buffer.from(chunks.join(""), "utf8");
      const fileName = reportExportFileName(exportType);
      const saved = await this.storage.saveReportExport(
        { jobId, actorUserId },
        { fileName, contentType: "text/csv; charset=utf-8" },
        buffer,
      );
      return this.prisma.client.reportExportJob.update({
        where: { id: jobId },
        data: {
          status: ReportExportStatus.COMPLETED,
          fileName,
          contentType: "text/csv; charset=utf-8",
          storageKey: saved.assetKey,
          sha256: createHash("sha256").update(buffer).digest("hex"),
          rowCount,
          byteSize: buffer.length,
          lockedAt: null,
          errorMessage: null,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + retentionMs),
        },
      });
    } catch (error) {
      await this.prisma.client.reportExportJob.update({
        where: { id: jobId },
        data: {
          status: ReportExportStatus.FAILED,
          lockedAt: null,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async requireJob(
    actor: RequestUser,
    audience: ReportExportAudience,
    jobId: string,
  ) {
    const where = await this.authorizedWhere(actor, audience, { id: jobId });
    const job = await this.prisma.client.reportExportJob.findFirst({ where });
    if (!job) {
      throw new NotFoundException("Report export was not found.");
    }
    return job;
  }

  private async authorizedWhere(
    actor: RequestUser,
    audience: ReportExportAudience,
    extra: Prisma.ReportExportJobWhereInput,
  ): Promise<Prisma.ReportExportJobWhereInput> {
    if (audience === ReportExportAudience.SELLER) {
      const sellerId = await this.sellerIdForActor(actor);
      return { audience, sellerId, ...extra };
    }
    return { audience, ...extra };
  }

  private async sellerIdForActor(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }
    return seller.id;
  }

  private filters(
    dto: Pick<
      CreateReportExportDto,
      "dateFrom" | "dateTo" | "search" | "status" | "provider" | "paymentStatus"
    >,
  ): ReportExportFilters {
    return {
      ...(dto.dateFrom ? { dateFrom: dto.dateFrom } : {}),
      ...(dto.dateTo ? { dateTo: dto.dateTo } : {}),
      ...(dto.search?.trim() ? { search: dto.search.trim() } : {}),
      ...(dto.status?.trim() ? { status: dto.status.trim() } : {}),
      ...(dto.provider?.trim() ? { provider: dto.provider.trim() } : {}),
      ...(dto.paymentStatus?.trim()
        ? { paymentStatus: dto.paymentStatus.trim() }
        : {}),
    };
  }

  private assertAllowedType(
    audience: ReportExportAudience,
    exportType: ReportExportType,
  ) {
    if (!reportExportTypeAllowed(audience, exportType)) {
      throw new BadRequestException("The selected report is not available in this workspace.");
    }
  }

  private async exportSellerId(
    actor: RequestUser,
    audience: ReportExportAudience,
    dto: CreateReportExportDto,
  ) {
    if (audience === ReportExportAudience.SELLER) {
      const sellerId = await this.sellerIdForActor(actor);
      if (isGstr1ReviewExportType(dto.exportType)) {
        await this.requireReviewSeller(sellerId);
      }
      return sellerId;
    }
    if (dto.exportType === ReportExportType.GSTR1_REVIEW_SELLER_XLSX) {
      if (!dto.sellerId) {
        throw new BadRequestException("Select a GST-registered seller for this workbook.");
      }
      await this.requireReviewSeller(dto.sellerId);
      return dto.sellerId;
    }
    if (isGstr1ReviewExportType(dto.exportType) && dto.sellerId) {
      throw new BadRequestException(
        "A seller can only be selected for an individual seller workbook.",
      );
    }
    return null;
  }

  private async requireReviewSeller(sellerId: string) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { id: sellerId },
      select: {
        status: true,
        profile: {
          select: {
            taxRegistrationStatus: true,
            gstNumber: true,
          },
        },
        addresses: {
          select: { countryCode: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!seller || seller.status !== SellerStatus.APPROVED) {
      throw new BadRequestException("Select an approved seller.");
    }
    if (
      seller.profile?.taxRegistrationStatus !==
        SellerTaxRegistrationStatus.GST_REGISTERED ||
      !validGstin(seller.profile.gstNumber)
    ) {
      throw new BadRequestException(
        "The selected seller must have a valid regular GST registration.",
      );
    }
    if (seller.addresses[0]?.countryCode !== "IN") {
      throw new BadRequestException("GSTR-1 workbooks are available for India sellers.");
    }
  }

  private present<T extends { storageKey?: string | null }>(job: T) {
    const { storageKey: _storageKey, ...visible } = job;
    return visible;
  }
}

export function reportExportRunsImmediately(rowCount: number) {
  return rowCount <= immediateRowLimit;
}

export function reportExportTypeAllowed(
  audience: ReportExportAudience,
  exportType: ReportExportType,
) {
  return audienceTypes[audience].has(exportType);
}

export function reportExportContentType(exportType: ReportExportType) {
  if (exportType === ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP) {
    return "application/zip";
  }
  if (isGstr1ReviewExportType(exportType)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "text/csv; charset=utf-8";
}

function validGstin(value: string | null | undefined) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
    value?.trim().toUpperCase() ?? "",
  );
}
