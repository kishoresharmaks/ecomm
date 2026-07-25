import { RoleCode } from "@indihub/database";
import { describe, expect, it } from "vitest";
import { ROLES_KEY } from "../auth/auth.constants";
import { ReportsController } from "./reports.controller";

describe("ReportsController GST access", () => {
  it("allows standalone admin and finance sessions to operate the GST workspace", () => {
    const methods = [
      "gstOverview",
      "gstDocuments",
      "downloadGstDocument",
      "exportEInvoice",
      "exportEWayBill",
      "recordCompliance",
    ] as const;

    for (const method of methods) {
      expect(
        Reflect.getMetadata(ROLES_KEY, ReportsController.prototype[method]),
      ).toEqual([RoleCode.ADMIN, RoleCode.FINANCE]);
    }
  });
});
