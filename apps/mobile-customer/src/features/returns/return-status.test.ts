import { describe, expect, it } from "vitest";
import { returnStatusPresentationFor, returnTimeline } from "./return-status";

describe("mobile return status mapping", () => {
  it("maps known statuses to customer labels and unknown statuses to neutral fallback", () => {
    expect(returnStatusPresentationFor("PENDING_REVIEW")).toMatchObject({
      label: "Under review",
      tone: "warning",
    });
    expect(returnStatusPresentationFor("CUSTOM_STATUS")).toMatchObject({
      label: "Custom Status",
      tone: "neutral",
    });
  });

  it("marks the current status in the timeline", () => {
    const timeline = returnTimeline("PICKED_UP");
    expect(timeline.find((item) => item.status === "PICKED_UP")).toMatchObject({
      completed: true,
      current: true,
    });
    expect(timeline.find((item) => item.status === "IN_TRANSIT")).toMatchObject({
      completed: false,
      current: false,
    });
  });

  it("does not mark successful milestones as complete for rejected or failed returns", () => {
    const rejectedTimeline = returnTimeline("REJECTED");
    expect(rejectedTimeline.map((item) => item.status)).toEqual(["PENDING_REVIEW", "REJECTED"]);
    expect(rejectedTimeline.find((item) => item.status === "REJECTED")).toMatchObject({
      completed: true,
      current: true,
    });

    const failedTimeline = returnTimeline("QC_FAILED");
    expect(failedTimeline.find((item) => item.status === "QC_PASSED")).toBeUndefined();
    expect(failedTimeline.find((item) => item.status === "QC_FAILED")).toMatchObject({
      completed: true,
      current: true,
    });
  });
});
