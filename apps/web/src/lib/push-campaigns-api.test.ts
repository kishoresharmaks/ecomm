import { describe, expect, it } from "vitest";
import {
  buildPushCampaignListPath,
  emptyPushCampaignForm,
  isAllowedPushCampaignHref,
  pushCampaignPayloadFromForm,
  validatePushCampaignForm,
  validatePushCampaignImageFile,
} from "./push-campaigns-api";

describe("push campaign API helpers", () => {
  it("keeps campaign links on the customer route allow-list", () => {
    expect(isAllowedPushCampaignHref("/deals")).toBe(true);
    expect(isAllowedPushCampaignHref("/orders/1HI202606190001")).toBe(true);
    expect(isAllowedPushCampaignHref("/product/cotton-shirt")).toBe(true);
    expect(isAllowedPushCampaignHref("/stores/main-street-store")).toBe(true);
    expect(isAllowedPushCampaignHref("https://example.com/deals")).toBe(false);
    expect(isAllowedPushCampaignHref("/admin/orders")).toBe(false);
  });

  it("builds trimmed campaign payloads with segment filters", () => {
    expect(
      pushCampaignPayloadFromForm({
        ...emptyPushCampaignForm(),
        title: "  Festive deals  ",
        body: "  Fresh prices are live  ",
        imageAssetKey: " indihub/admin/admin_1/banners/push.webp ",
        href: "/deals",
        countryCode: " in ",
        stateCode: "TN",
        city: " Salem ",
        limit: "25",
      }),
    ).toEqual({
      title: "Festive deals",
      body: "Fresh prices are live",
      imageAssetKey: "indihub/admin/admin_1/banners/push.webp",
      href: "/deals",
      segmentFilter: {
        countryCode: "IN",
        stateCode: "TN",
        city: "Salem",
        limit: 25,
      },
    });
  });

  it("validates form and image rules before admin mutations", () => {
    expect(validatePushCampaignForm({ ...emptyPushCampaignForm(), title: "", body: "Body" })).toBe("Campaign title is required.");
    expect(validatePushCampaignForm({ ...emptyPushCampaignForm(), title: "Title", body: "Body", href: "/bad/path" })).toBe(
      "Deep link must match an approved customer app route.",
    );
    expect(
      validatePushCampaignImageFile({
        name: "push.gif",
        size: 100,
        type: "image/gif",
      } as File),
    ).toBe("Campaign image must be JPG, PNG, or WebP.");
  });

  it("builds stable admin list paths", () => {
    expect(buildPushCampaignListPath({ status: "SENT", page: 2, limit: 25 })).toBe(
      "/api/admin/push-campaigns?status=SENT&page=2&limit=25",
    );
  });
});
