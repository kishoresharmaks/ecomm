import { describe, expect, it } from "vitest";
import { defaultSubjectForTopic, supportTopicFromQuery } from "./contact-utils";

describe("contact utils", () => {
  it("maps public topic query params to support request topics", () => {
    expect(supportTopicFromQuery("download-app")).toBe("DOWNLOAD_APP");
    expect(supportTopicFromQuery("B2B")).toBe("B2B");
    expect(supportTopicFromQuery("shipping")).toBe("DELIVERY");
    expect(supportTopicFromQuery("unknown")).toBe("GENERAL");
    expect(supportTopicFromQuery(null)).toBe("GENERAL");
  });

  it("creates topic-shaped default subjects", () => {
    expect(defaultSubjectForTopic("DOWNLOAD_APP")).toBe("App download support");
    expect(defaultSubjectForTopic("PAYMENT")).toBe("Payment or refund request");
  });
});
