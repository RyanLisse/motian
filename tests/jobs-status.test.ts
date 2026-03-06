import { describe, expect, it } from "vitest";
import { deriveJobStatus, normalizeJobStatusFilter } from "../src/services/jobs";

describe("job status helpers", () => {
  it("marks vacatures with a future deadline as open", () => {
    const now = new Date("2026-03-06T12:00:00.000Z");

    expect(
      deriveJobStatus({
        applicationDeadline: new Date("2026-03-10T00:00:00.000Z"),
        endDate: null,
        now,
      }),
    ).toBe("open");
  });

  it("marks vacatures as closed when both deadline and end date are voorbij", () => {
    const now = new Date("2026-03-06T12:00:00.000Z");

    expect(
      deriveJobStatus({
        applicationDeadline: new Date("2026-03-01T00:00:00.000Z"),
        endDate: new Date("2026-03-05T00:00:00.000Z"),
        now,
      }),
    ).toBe("closed");
  });

  it("treats vacatures without known end markers as open so they stay visible", () => {
    expect(
      deriveJobStatus({
        applicationDeadline: null,
        endDate: null,
        now: new Date("2026-03-06T12:00:00.000Z"),
      }),
    ).toBe("open");
  });

  it("normalizes Dutch and English status filters", () => {
    expect(normalizeJobStatusFilter("closed")).toBe("closed");
    expect(normalizeJobStatusFilter("gesloten")).toBe("closed");
    expect(normalizeJobStatusFilter("open")).toBe("open");
    expect(normalizeJobStatusFilter("all")).toBe("all");
  });
});
