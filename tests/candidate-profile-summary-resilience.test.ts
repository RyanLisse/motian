import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCandidateProfileSummaryMissingColumnError,
  resetCandidateProfileSummaryFallbackCacheForTests,
  withCandidateProfileSummaryFallback,
} from "../src/services/candidates.js";

describe("Candidate profile_summary resilience", () => {
  beforeEach(() => {
    resetCandidateProfileSummaryFallbackCacheForTests();
    vi.restoreAllMocks();
  });

  it("detects missing profile_summary column errors", () => {
    const error = Object.assign(new Error('column "profile_summary" does not exist'), {
      code: "42703",
    });

    expect(isCandidateProfileSummaryMissingColumnError(error)).toBe(true);
    expect(
      isCandidateProfileSummaryMissingColumnError(
        Object.assign(new Error('column "headline" does not exist'), { code: "42703" }),
      ),
    ).toBe(false);
  });

  it("retries once without profileSummary when the column is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const execute = vi.fn(async ({ includeProfileSummary }: { includeProfileSummary: boolean }) => {
      if (includeProfileSummary) {
        throw Object.assign(new Error('column "profile_summary" does not exist'), {
          code: "42703",
        });
      }

      return { id: "cand-1", profileSummary: null };
    });

    const result = await withCandidateProfileSummaryFallback({
      operation: "test-fallback",
      execute,
    });

    expect(result).toEqual({ id: "cand-1", profileSummary: null });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, { includeProfileSummary: true });
    expect(execute).toHaveBeenNthCalledWith(2, { includeProfileSummary: false });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("caches unsupported state after the first fallback", async () => {
    await withCandidateProfileSummaryFallback({
      operation: "prime-cache",
      execute: async ({ includeProfileSummary }) => {
        if (includeProfileSummary) {
          throw Object.assign(new Error('column "profile_summary" does not exist'), {
            code: "42703",
          });
        }

        return { ok: true };
      },
    });

    const execute = vi.fn(async ({ includeProfileSummary }: { includeProfileSummary: boolean }) => ({
      includeProfileSummary,
    }));

    const result = await withCandidateProfileSummaryFallback({
      operation: "cached-fallback",
      execute,
    });

    expect(result).toEqual({ includeProfileSummary: false });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ includeProfileSummary: false });
  });

  it("rethrows unrelated errors", async () => {
    await expect(
      withCandidateProfileSummaryFallback({
        operation: "non-profile-summary-error",
        execute: async () => {
          throw new Error("database offline");
        },
      }),
    ).rejects.toThrow("database offline");
  });
});