import {
  ReportExportAudience,
  ReportExportType,
  RoleCode,
} from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import {
  ReportExportService,
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
