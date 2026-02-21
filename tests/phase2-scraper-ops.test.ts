import { describe, it, expect } from "vitest";
import { z } from "zod";

// ===== Schema Tests =====

describe("scraperConfigs schema", () => {
  const scraperConfigSchema = z.object({
    platform: z.string().min(1),
    baseUrl: z.string().url(),
    isActive: z.boolean().default(true),
    parameters: z.record(z.unknown()).default({}),
    cronExpression: z.string().optional(),
  });

  it("accepteert geldige Striive config", () => {
    const result = scraperConfigSchema.safeParse({
      platform: "striive",
      baseUrl: "https://striive.com/nl/opdrachten",
      isActive: true,
      parameters: { maxPages: 5, maxRetries: 2 },
      cronExpression: "0 0 */4 * * *",
    });
    expect(result.success).toBe(true);
  });

  it("weigert config zonder platform", () => {
    const result = scraperConfigSchema.safeParse({
      platform: "",
      baseUrl: "https://example.com",
    });
    expect(result.success).toBe(false);
  });

  it("weigert ongeldige URL", () => {
    const result = scraperConfigSchema.safeParse({
      platform: "indeed",
      baseUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("gebruikt default waarden", () => {
    const result = scraperConfigSchema.parse({
      platform: "linkedin",
      baseUrl: "https://linkedin.com/jobs",
    });
    expect(result.isActive).toBe(true);
    expect(result.parameters).toEqual({});
  });
});

describe("scrapeResults schema", () => {
  const scrapeResultSchema = z.object({
    platform: z.string(),
    durationMs: z.number().int().nonnegative(),
    jobsFound: z.number().int().nonnegative(),
    jobsNew: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    status: z.enum(["success", "partial", "failed"]),
    errors: z.array(z.string()).default([]),
  });

  it("accepteert succesvol scrape resultaat", () => {
    const result = scrapeResultSchema.safeParse({
      platform: "striive",
      durationMs: 4500,
      jobsFound: 25,
      jobsNew: 12,
      duplicates: 13,
      status: "success",
      errors: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepteert partial met fouten", () => {
    const result = scrapeResultSchema.safeParse({
      platform: "indeed",
      durationMs: 8200,
      jobsFound: 50,
      jobsNew: 30,
      duplicates: 15,
      status: "partial",
      errors: ["Timeout op pagina 3"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.errors).toHaveLength(1);
    }
  });

  it("accepteert gefaald resultaat", () => {
    const result = scrapeResultSchema.safeParse({
      platform: "linkedin",
      durationMs: 1000,
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
      status: "failed",
      errors: ["Login gefaald", "Session verlopen"],
    });
    expect(result.success).toBe(true);
  });

  it("weigert ongeldige status", () => {
    const result = scrapeResultSchema.safeParse({
      platform: "striive",
      durationMs: 100,
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
      status: "unknown",
      errors: [],
    });
    expect(result.success).toBe(false);
  });
});

// ===== Health Logic Tests =====

describe("gezondheid status logic", () => {
  function calculateStatus(
    failures24h: number,
    isActive: boolean,
  ): "gezond" | "waarschuwing" | "kritiek" | "inactief" {
    if (!isActive) return "inactief";
    if (failures24h > 3) return "kritiek";
    if (failures24h > 0) return "waarschuwing";
    return "gezond";
  }

  it("gezond als geen failures", () => {
    expect(calculateStatus(0, true)).toBe("gezond");
  });

  it("waarschuwing bij 1-3 failures", () => {
    expect(calculateStatus(1, true)).toBe("waarschuwing");
    expect(calculateStatus(3, true)).toBe("waarschuwing");
  });

  it("kritiek bij >3 failures", () => {
    expect(calculateStatus(4, true)).toBe("kritiek");
    expect(calculateStatus(10, true)).toBe("kritiek");
  });

  it("inactief als niet actief", () => {
    expect(calculateStatus(0, false)).toBe("inactief");
    expect(calculateStatus(5, false)).toBe("inactief");
  });
});

// ===== API Update Validation =====

describe("scraper config update validatie", () => {
  const updateSchema = z.object({
    isActive: z.boolean().optional(),
    cronExpression: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
  });

  it("accepteert toggle isActive", () => {
    const result = updateSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("accepteert cron update", () => {
    const result = updateSchema.safeParse({
      cronExpression: "0 0 */2 * * *",
    });
    expect(result.success).toBe(true);
  });

  it("accepteert parameters update", () => {
    const result = updateSchema.safeParse({
      parameters: { maxPages: 10, timeout: 30000 },
    });
    expect(result.success).toBe(true);
  });

  it("accepteert gecombineerde update", () => {
    const result = updateSchema.safeParse({
      isActive: true,
      cronExpression: "0 0 */6 * * *",
      parameters: { maxPages: 3 },
    });
    expect(result.success).toBe(true);
  });

  it("accepteert lege update", () => {
    const result = updateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
