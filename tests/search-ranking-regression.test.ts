/**
 * Regressietests voor search/ranking (Fase 4).
 * Controleert dat listJobs en hybridSearch het verwachte response-shape behouden.
 * Vereist geldige DATABASE_URL (zoals in CI).
 */
import { describe, expect, it } from "vitest";
import { hybridSearch, listJobs } from "../src/services/jobs";

describe("search/ranking API shape regression", () => {
  it("listJobs returns { data: Job[], total: number }", async () => {
    const result = await listJobs({ limit: 2, offset: 0 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
    if (result.data.length > 0) {
      const first = result.data[0] as Record<string, unknown>;
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("platform");
    }
  });

  it("hybridSearch returns array of Job & { score }", async () => {
    const result = await hybridSearch("test", { limit: 2 });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const first = result[0] as Record<string, unknown>;
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("title");
      expect(first).toHaveProperty("score");
      expect(typeof (first as { score?: number }).score).toBe("number");
    }
  });
});
