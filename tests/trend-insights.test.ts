import { describe, expect, it } from "vitest";
import { buildFallbackInsights, type TrendMetrics } from "../src/services/trend-insights";

function baseMetrics(overrides: Partial<TrendMetrics> = {}): TrendMetrics {
  const now = new Date();
  return {
    window: {
      now: now.toISOString(),
      sevenDaysAgo: now.toISOString(),
      fourteenDaysAgo: now.toISOString(),
      thirtyDaysAgo: now.toISOString(),
    },
    totals: {
      openJobs: 120,
      activeCandidates: 40,
      applications30d: 50,
      applications7d: 12,
      placements30d: 2,
      matches30d: 80,
    },
    platformInflow: [
      { platform: "striive", lastWeek: 20, previousWeek: 10, deltaPct: 100 },
      { platform: "magnet.me", lastWeek: 5, previousWeek: 5, deltaPct: 0 },
    ],
    stageCounts: { new: 10, screening: 5, interview: 3, offer: 1, hired: 2 },
    stageConversion: [],
    staleScreenings: 4,
    staleInterviews: 2,
    highScoreUnreviewedMatches: { total: 7, averageScore: 85.3 },
    upcomingInterviews7d: 3,
    recentScrapeFailures: 0,
    topOpenClients: [
      { client: "ABN AMRO", openCount: 8 },
      { client: "ING", openCount: 5 },
    ],
    topOpenTitles: [{ title: "Senior Data Engineer", openCount: 4 }],
    newCandidatesWithoutApplication: 6,
    matchScoreTrend: { last7dAvg: 72.4, previous7dAvg: 68.1, deltaPoints: 4.3 },
    ...overrides,
  };
}

describe("trend-insights fallback", () => {
  it("surfaces high-score unreviewed matches as a high-priority opportunity", () => {
    const { insights } = buildFallbackInsights(baseMetrics());
    const hit = insights.find((i) => i.title.includes("Hoogscorende matches"));
    expect(hit).toBeDefined();
    expect(hit?.priority).toBe("hoog");
    expect(hit?.type).toBe("kans");
    expect(hit?.metricValue).toBe("7");
  });

  it("flags stale pipeline stages as risico", () => {
    const { insights } = buildFallbackInsights(baseMetrics());
    const stale = insights.find((i) => i.type === "risico" && i.title.includes("stil"));
    expect(stale).toBeDefined();
    expect(stale?.description).toContain("4");
    expect(stale?.description).toContain("2");
  });

  it("highlights platforms with strong week-over-week growth", () => {
    const { insights } = buildFallbackInsights(baseMetrics());
    const growth = insights.find((i) => i.type === "trend");
    expect(growth).toBeDefined();
    expect(growth?.title).toContain("striive");
    expect(growth?.metricValue).toBe("+100%");
  });

  it("proposes auto-matching for new candidates without applications", () => {
    const { insights } = buildFallbackInsights(baseMetrics());
    const action = insights.find((i) => i.type === "actie");
    expect(action).toBeDefined();
    expect(action?.title).toContain("Nieuwe kandidaten");
    expect(action?.href).toBe("/kandidaten");
  });

  it("highlights top client with multiple open vacancies", () => {
    const { insights } = buildFallbackInsights(baseMetrics());
    const client = insights.find((i) => i.type === "kans" && i.title.includes("ABN AMRO"));
    expect(client).toBeDefined();
    expect(client?.metricValue).toBe("8");
  });

  it("adds scrape failure risk when recent failures exceed threshold", () => {
    const metrics = baseMetrics({ recentScrapeFailures: 5 });
    const { insights } = buildFallbackInsights(metrics);
    const risk = insights.find((i) => i.title.includes("Scrape-storingen"));
    expect(risk).toBeDefined();
    expect(risk?.priority).toBe("hoog");
  });

  it("returns an empty insight list and neutral summary when the pipeline is idle", () => {
    const metrics = baseMetrics({
      highScoreUnreviewedMatches: { total: 0, averageScore: null },
      staleScreenings: 0,
      staleInterviews: 0,
      platformInflow: [{ platform: "striive", lastWeek: 2, previousWeek: 2, deltaPct: 0 }],
      newCandidatesWithoutApplication: 0,
      topOpenClients: [],
      recentScrapeFailures: 0,
    });

    const { summary, insights } = buildFallbackInsights(metrics);
    expect(insights).toHaveLength(0);
    expect(summary).toMatch(/Geen urgente signalen/i);
  });
});
