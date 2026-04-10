import { describe, expect, it } from "vitest";
import {
  deriveRefreshTags,
  mergeRefreshTags,
  normalizeDataRefreshEvent,
  shouldRefreshPath,
} from "../src/lib/data-refresh";

describe("data refresh routing", () => {
  it("maps application updates onto pipeline-related tags", () => {
    expect(deriveRefreshTags("application:updated")).toEqual(["pipeline", "candidates", "jobs"]);
  });

  it("normalizes streamed events and backfills missing tags from the event type", () => {
    const event = normalizeDataRefreshEvent({
      type: "match:updated",
      data: { matchId: "match-1" },
      timestamp: "2026-04-10T00:00:00.000Z",
    });

    expect(event).toEqual({
      type: "match:updated",
      data: { matchId: "match-1" },
      timestamp: "2026-04-10T00:00:00.000Z",
      tags: ["matches", "candidates", "jobs", "pipeline"],
    });
  });

  it("refreshes only routes that intersect the event tags", () => {
    const tags = mergeRefreshTags([
      { tags: ["pipeline", "jobs"] },
      { tags: ["pipeline", "candidates"] },
    ]);

    expect(shouldRefreshPath("/pipeline", tags)).toBe(true);
    expect(shouldRefreshPath("/kandidaten/abc", tags)).toBe(true);
    expect(shouldRefreshPath("/ontwikkelaar", tags)).toBe(false);
  });
});
