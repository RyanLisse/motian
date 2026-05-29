import { describe, expect, it } from "vitest";
import { getScrapeScheduleDecision } from "../src/lib/scrape-schedule";

describe("getScrapeScheduleDecision", () => {
  it("marks never-run configs due with observable reason", () => {
    const decision = getScrapeScheduleDecision("0 * * * *", null, new Date("2026-05-29T08:00:00Z"));

    expect(decision).toMatchObject({
      due: true,
      reason: "never_run",
      cronExpression: "0 * * * *",
      lastRunAt: null,
      nextRunAt: null,
    });
  });

  it("returns not_due with nextRunAt when schedule is still in the future", () => {
    const decision = getScrapeScheduleDecision(
      "0 * * * *",
      new Date("2026-05-29T08:00:00Z"),
      new Date("2026-05-29T08:30:00Z"),
    );

    expect(decision.due).toBe(false);
    expect(decision.reason).toBe("not_due");
    expect(decision.nextRunAt).not.toBeNull();
  });

  it("marks schedules due inside the five-minute grace window", () => {
    const decision = getScrapeScheduleDecision(
      "0 * * * *",
      new Date("2026-05-29T08:00:00Z"),
      new Date("2026-05-29T08:56:00Z"),
    );

    expect(decision.due).toBe(true);
    expect(decision.reason).toBe("within_grace");
  });

  it("keeps invalid schedules observable and due instead of silently skipping", () => {
    const decision = getScrapeScheduleDecision(
      "geen cron",
      new Date("2026-05-29T08:00:00Z"),
      new Date("2026-05-29T08:30:00Z"),
    );

    expect(decision).toMatchObject({ due: true, reason: "unknown_schedule" });
  });
});
