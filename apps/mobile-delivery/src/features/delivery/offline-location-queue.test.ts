import { describe, expect, it } from "vitest";
import { freshLocationQueue, nextLocationQueue, type DeliveryLocationPing } from "./offline-location-queue";

const baseNow = Date.parse("2026-07-04T10:00:00.000Z");

function ping(index: number, ageMinutes = 0): DeliveryLocationPing {
  return {
    assignmentId: `assignment-${index}`,
    latitude: 11 + index / 1000,
    longitude: 78 + index / 1000,
    capturedAt: new Date(baseNow - ageMinutes * 60 * 1000).toISOString(),
  };
}

describe("offline location queue", () => {
  it("keeps only the newest 20 pings", () => {
    const queue = Array.from({ length: 25 }, (_, index) => ping(index));

    const next = nextLocationQueue(queue, ping(99), baseNow);

    expect(next).toHaveLength(20);
    expect(next[0]?.assignmentId).toBe("assignment-6");
    expect(next.at(-1)?.assignmentId).toBe("assignment-99");
  });

  it("drops stale pings older than ten minutes", () => {
    const queue = [ping(1, 11), ping(2, 10), ping(3, 2)];

    expect(freshLocationQueue(queue, baseNow).map((item) => item.assignmentId)).toEqual(["assignment-2", "assignment-3"]);
  });
});
