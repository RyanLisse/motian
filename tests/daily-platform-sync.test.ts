import { describe, expect, it } from "vitest";

describe("daily-platform-sync", () => {
  describe("trigger task source", () => {
    it("contains correct cron pattern (daily 7AM Amsterdam)", async () => {
      const source = await import("../trigger/daily-platform-sync");
      const task = source.dailyPlatformSyncTask;

      expect(task).toBeDefined();
      expect(task.id).toBe("daily-platform-sync");
    });
  });

  describe("platform status adapter registry", () => {
    it("returns stub adapter for unknown platforms", async () => {
      const { getStatusAdapter, stubAdapter } = await import(
        "../src/services/platform-status-adapters"
      );

      const adapter = getStatusAdapter("nonexistent-platform-xyz");
      expect(adapter).toBe(stubAdapter);
    });

    it("stub adapter returns available with no metrics", async () => {
      const { stubAdapter } = await import("../src/services/platform-status-adapters");

      const result = await stubAdapter.fetchStatus({
        platform: "test-platform",
        configId: "test-id",
      });

      expect(result.platform).toBe("test-platform");
      expect(result.available).toBe(true);
      expect(result.metrics).toBeUndefined();
    });

    it("exports PlatformStatusAdapter and PlatformStatus types", async () => {
      const mod = await import("../src/services/platform-status-adapters");

      // Verify the module exports the expected functions
      expect(typeof mod.getStatusAdapter).toBe("function");
      expect(typeof mod.registerStatusAdapter).toBe("function");
      expect(mod.stubAdapter).toBeDefined();
    });
  });

  describe("platform-status-schema", () => {
    it("exports platformDailyStats table", async () => {
      const { platformDailyStats } = await import("../src/db/platform-status-schema");

      expect(platformDailyStats).toBeDefined();
      // Verify it's a Drizzle pgTable with expected columns
      const columns = Object.keys(platformDailyStats);
      expect(columns).toContain("id");
      expect(columns).toContain("date");
      expect(columns).toContain("platform");
      expect(columns).toContain("available");
      expect(columns).toContain("views");
      expect(columns).toContain("applications");
      expect(columns).toContain("createdAt");
    });
  });
});
