import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ReportExportAudience,
  ReportExportStatus,
  ReportExportType,
  RoleCode,
} from "@indihub/database";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CreateReportExportDto,
  ReportExportListQueryDto,
} from "./dto/report-export.dto";
import { ReportExportService } from "./report-export.service";
import { OperationalReportQueryDto } from "./dto/operational-report-query.dto";

@ApiTags("Admin Report Exports")
@Roles(RoleCode.ADMIN)
@Controller("admin/reports/exports")
export class AdminReportExportController {
  constructor(
    @Inject(ReportExportService) private readonly exports: ReportExportService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an admin operational report export." })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateReportExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const job = await this.exports.create(actor, ReportExportAudience.ADMIN, dto);
    res.status(job.status === ReportExportStatus.COMPLETED ? 200 : 202);
    return job;
  }

  @Get()
  @ApiOperation({ summary: "List admin report export jobs." })
  list(@CurrentUser() actor: RequestUser, @Query() query: ReportExportListQueryDto) {
    return this.exports.list(actor, ReportExportAudience.ADMIN, query);
  }

  @Get(":jobId")
  @ApiOperation({ summary: "Get admin report export job detail." })
  detail(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.detail(actor, ReportExportAudience.ADMIN, jobId);
  }

  @Post(":jobId/retry")
  @ApiOperation({ summary: "Retry admin report export job." })
  retry(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.retry(actor, ReportExportAudience.ADMIN, jobId);
  }

  @Get(":jobId/download")
  @ApiOperation({ summary: "Download an admin report export file." })
  download(
    @CurrentUser() actor: RequestUser,
    @Param("jobId") jobId: string,
    @Res() res: Response,
  ) {
    return sendExport(this.exports, actor, ReportExportAudience.ADMIN, jobId, res);
  }
}

@ApiTags("Finance Report Exports")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance/report-exports")
export class FinanceReportExportController {
  constructor(
    @Inject(ReportExportService) private readonly exports: ReportExportService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a finance report export." })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateReportExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const job = await this.exports.create(actor, ReportExportAudience.FINANCE, dto);
    res.status(job.status === ReportExportStatus.COMPLETED ? 200 : 202);
    return job;
  }

  @Get()
  @ApiOperation({ summary: "List finance report export jobs." })
  list(@CurrentUser() actor: RequestUser, @Query() query: ReportExportListQueryDto) {
    return this.exports.list(actor, ReportExportAudience.FINANCE, query);
  }

  @Get(":jobId")
  @ApiOperation({ summary: "Get finance report export job detail." })
  detail(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.detail(actor, ReportExportAudience.FINANCE, jobId);
  }

  @Post(":jobId/retry")
  @ApiOperation({ summary: "Retry finance report export job." })
  retry(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.retry(actor, ReportExportAudience.FINANCE, jobId);
  }

  @Get(":jobId/download")
  @ApiOperation({ summary: "Download a finance report export file." })
  download(
    @CurrentUser() actor: RequestUser,
    @Param("jobId") jobId: string,
    @Res() res: Response,
  ) {
    return sendExport(this.exports, actor, ReportExportAudience.FINANCE, jobId, res);
  }
}

@ApiTags("Finance Reports")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance/report-data")
export class FinanceReportDataController {
  constructor(
    @Inject(ReportExportService) private readonly exports: ReportExportService,
  ) {}

  @Get(":exportType")
  @ApiOperation({ summary: "Get paginated report data table rows." })
  async page(
    @CurrentUser() actor: RequestUser,
    @Param("exportType", new ParseEnumPipe(ReportExportType))
    exportType: ReportExportType,
    @Query() query: OperationalReportQueryDto,
  ) {
    return {
      table: await this.exports.page(
        actor,
        ReportExportAudience.FINANCE,
        exportType,
        query,
      ),
    };
  }
}

@ApiTags("Seller Report Exports")
@Roles(RoleCode.SELLER)
@Controller("seller/reports/exports")
export class SellerReportExportController {
  constructor(
    @Inject(ReportExportService) private readonly exports: ReportExportService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a seller report export." })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateReportExportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const job = await this.exports.create(actor, ReportExportAudience.SELLER, dto);
    res.status(job.status === ReportExportStatus.COMPLETED ? 200 : 202);
    return job;
  }

  @Get()
  @ApiOperation({ summary: "List seller report export jobs." })
  list(@CurrentUser() actor: RequestUser, @Query() query: ReportExportListQueryDto) {
    return this.exports.list(actor, ReportExportAudience.SELLER, query);
  }

  @Get(":jobId")
  @ApiOperation({ summary: "Get seller report export job detail." })
  detail(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.detail(actor, ReportExportAudience.SELLER, jobId);
  }

  @Post(":jobId/retry")
  @ApiOperation({ summary: "Retry seller report export job." })
  retry(@CurrentUser() actor: RequestUser, @Param("jobId") jobId: string) {
    return this.exports.retry(actor, ReportExportAudience.SELLER, jobId);
  }

  @Get(":jobId/download")
  @ApiOperation({ summary: "Download a seller report export file." })
  download(
    @CurrentUser() actor: RequestUser,
    @Param("jobId") jobId: string,
    @Res() res: Response,
  ) {
    return sendExport(this.exports, actor, ReportExportAudience.SELLER, jobId, res);
  }
}

async function sendExport(
  service: ReportExportService,
  actor: RequestUser,
  audience: ReportExportAudience,
  jobId: string,
  res: Response,
) {
  const { job, access } = await service.download(actor, audience, jobId);
  res.setHeader("Cache-Control", "private, max-age=0, no-store");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${job.fileName?.replaceAll('"', "") ?? "report.csv"}"`,
  );
  if (access.provider === "s3") {
    return res.redirect(access.url);
  }
  res.type(access.contentType);
  return res.sendFile(access.filePath);
}
