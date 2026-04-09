import { describe, expect, it } from "vitest";

describe("kpiSnapshots schema", () => {
  it("exports kpiSnapshots table definition", async () => {
    const mod = await import("../src/db/kpi-snapshots-schema");
    expect(mod.kpiSnapshots).toBeDefined();
    expect(typeof mod.kpiSnapshots).toBe("object");
  });
});

describe("daily-kpi-snapshot trigger task", () => {
  it("contains the correct cron pattern for 23:00 Amsterdam", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("trigger/daily-kpi-snapshot.ts", "utf-8");
    expect(source).toContain("0 23 * * *");
    expect(source).toContain("Europe/Amsterdam");
  });

  it("exports a named task", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("trigger/daily-kpi-snapshot.ts", "utf-8");
    expect(source).toContain("schedules.task");
    expect(source).toContain("daily-kpi-snapshot");
  });
});
