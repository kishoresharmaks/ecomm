import {
  ReportExportAudience,
  ReportExportType,
  RoleCode,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import {
  ReportExportService,
  reportExportContentType,
  reportExportRunsImmediately,
  reportExportTypeAllowed,
} from "./report-export.service";

describe("report export service", () => {
  it("keeps audience report types isolated", () => {
    expect(
      reportExportTypeAllowed(
        ReportExportAudience.ADMIN,
        ReportExportType.ADMIN_SALES,
      ),
    ).toBe(true);
    expect(
      reportExportTypeAllowed(
        ReportExportAudience.SELLER,
        ReportExportType.ADMIN_SALES,
      ),
    ).toBe(false);
    expect(
      reportExportTypeAllowed(
        ReportExportAudience.SELLER,
        ReportExportType.GSTR1_REVIEW_SELLER_XLSX,
      ),
    ).toBe(true);
    expect(
      reportExportTypeAllowed(
        ReportExportAudience.SELLER,
        ReportExportType.GSTR1_REVIEW_PLATFORM_XLSX,
      ),
    ).toBe(false);
  });

  it("uses workbook and archive content types for GSTR-1 review exports", () => {
    expect(
      reportExportContentType(ReportExportType.GSTR1_REVIEW_SELLER_XLSX),
    ).toContain("spreadsheetml");
    expect(
      reportExportContentType(ReportExportType.GSTR1_REVIEW_ALL_SELLERS_ZIP),
    ).toBe("application/zip");
  });

  it("queues only reports above the immediate row threshold", () => {
    expect(reportExportRunsImmediately(25_000)).toBe(true);
    expect(reportExportRunsImmediately(25_001)).toBe(false);
  });

  it("scopes seller export history to the signed-in seller", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const service = new ReportExportService(
      {
        client: {
          seller: {
            findUnique: vi.fn().mockResolvedValue({ id: "seller_1" }),
          },
          reportExportJob: { findMany, count },
        },
      } as never,
      {} as never,
    );

    await service.list(
      {
        id: "user_1",
        clerkUserId: "clerk_1",
        email: "seller@example.com",
        roles: [RoleCode.SELLER],
      },
      ReportExportAudience.SELLER,
      {},
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          audience: ReportExportAudience.SELLER,
          sellerId: "seller_1",
        },
      }),
    );
  });
});
