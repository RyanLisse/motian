import { describe, expect, it } from "vitest";
import { getMonitoredTask, getSloStatus, MONITORED_TASKS } from "../src/lib/cron-slo-thresholds";

describe("MONITORED_TASKS", () => {
  it("includes the scrape pipeline with the historical 6h gap and aggressive failure threshold", () => {
    const scrapePipeline = getMonitoredTask("scrape-pipeline");
    expect(scrapePipeline).toBeDefined();
    expect(scrapePipeline?.expectedMaxGapHours).toBe(6);
    // Critical pipelines must page on the very first regression — RJC-226 must
    // not silently soften this back to the default of 3.
    expect(scrapePipeline?.criticalFailureThreshold).toBe(1);
  });

  it("has unique task ids so the lookup map is unambiguous", () => {
    const ids = MONITORED_TASKS.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns undefined for unknown ids — callers should not synthesize a default SLO", () => {
    expect(getMonitoredTask("not-a-real-task")).toBeUndefined();
  });
});

describe("getSloStatus", () => {
  const now = new Date("2026-04-25T12:00:00Z");

  it("returns red when no run has been recorded", () => {
    expect(getSloStatus(null, 6, now)).toBe("red");
  });

  it("returns green when the last run is well within the gap", () => {
    const lastRunAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(getSloStatus(lastRunAt, 6, now)).toBe("green");
  });

  it("treats exactly the gap boundary as green", () => {
    const lastRunAt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    expect(getSloStatus(lastRunAt, 6, now)).toBe("green");
  });

  it("returns amber once the gap is exceeded but within 1.5x", () => {
    const lastRunAt = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    expect(getSloStatus(lastRunAt, 6, now)).toBe("amber");
  });

  it("treats exactly 1.5x the gap as still amber, not red", () => {
    const lastRunAt = new Date(now.getTime() - 9 * 60 * 60 * 1000);
    expect(getSloStatus(lastRunAt, 6, now)).toBe("amber");
  });

  it("returns red when the last run is older than 1.5x the gap", () => {
    const lastRunAt = new Date(now.getTime() - 10 * 60 * 60 * 1000);
    expect(getSloStatus(lastRunAt, 6, now)).toBe("red");
  });
});
