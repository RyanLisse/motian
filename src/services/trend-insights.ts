import { unstable_cache } from "next/cache";
import { z } from "zod";
import { and, db, desc, eq, gte, isNull, lt, ne, sql } from "../db";
import {
  applications,
  candidates,
  interviews,
  jobMatches,
  jobs,
  scrapeResults,
} from "../db/schema";
import { gemini31FlashLite, tracedGenerateObject as generateObject } from "../lib/ai-models";

// ── Types ────────────────────────────────────────────────────────────

export type TrendInsightType = "kans" | "trend" | "risico" | "actie";
export type TrendInsightPriority = "hoog" | "gemiddeld" | "laag";

export type TrendInsight = {
  type: TrendInsightType;
  title: string;
  description: string;
  priority: TrendInsightPriority;
  metricLabel?: string;
  metricValue?: string;
  href?: string;
};

export type TrendInsightsResult = {
  generatedAt: string;
  source: "ai" | "fallback";
  summary: string;
  insights: TrendInsight[];
};

// ── Metrics ──────────────────────────────────────────────────────────

export type PlatformInflow = {
  platform: string;
  lastWeek: number;
  previousWeek: number;
  deltaPct: number | null;
};

export type StageConversion = {
  fromStage: string;
  toStage: string;
  conversionPct: number | null;
  fromCount: number;
  toCount: number;
};

export type TopOpenClient = {
  client: string;
  openCount: number;
};

export type TopOpenTitle = {
  title: string;
  openCount: number;
};

export type TrendMetrics = {
  window: {
    now: string;
    sevenDaysAgo: string;
    fourteenDaysAgo: string;
    thirtyDaysAgo: string;
  };
  totals: {
    openJobs: number;
    activeCandidates: number;
    applications30d: number;
    applications7d: number;
    placements30d: number;
    matches30d: number;
  };
  platformInflow: PlatformInflow[];
  stageCounts: Record<string, number>;
  stageConversion: StageConversion[];
  staleScreenings: number;
  staleInterviews: number;
  highScoreUnreviewedMatches: {
    total: number;
    averageScore: number | null;
  };
  upcomingInterviews7d: number;
  recentScrapeFailures: number;
  topOpenClients: TopOpenClient[];
  topOpenTitles: TopOpenTitle[];
  newCandidatesWithoutApplication: number;
  matchScoreTrend: {
    last7dAvg: number | null;
    previous7dAvg: number | null;
    deltaPoints: number | null;
  };
};

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function collectTrendMetrics(database: typeof db = db): Promise<TrendMetrics> {
  const now = new Date();
  const sevenDaysAgo = daysAgo(7);
  const fourteenDaysAgo = daysAgo(14);
  const thirtyDaysAgo = daysAgo(30);
  const visible = and(ne(jobs.status, "archived"), isNull(jobs.deletedAt));

  const [
    openJobsRes,
    activeCandidatesRes,
    applications30dRes,
    applications7dRes,
    placements30dRes,
    matches30dRes,
    platformInflowRaw,
    stageCountsRaw,
    stageTransitionsRaw,
    staleScreeningsRes,
    staleInterviewsRes,
    highScoreUnreviewedRes,
    upcomingInterviews7dRes,
    recentScrapeFailuresRes,
    topOpenClientsRaw,
    topOpenTitlesRaw,
    newCandidatesNoAppRes,
    matchScoreLast7Res,
    matchScorePrev7Res,
  ] = await Promise.all([
    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobs)
      .where(and(eq(jobs.status, "open"), isNull(jobs.deletedAt))),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(candidates)
      .where(and(isNull(candidates.deletedAt), eq(candidates.matchingStatus, "open"))),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(and(isNull(applications.deletedAt), gte(applications.createdAt, thirtyDaysAgo))),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(and(isNull(applications.deletedAt), gte(applications.createdAt, sevenDaysAgo))),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          eq(applications.stage, "hired"),
          gte(applications.updatedAt, thirtyDaysAgo),
        ),
      ),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobMatches)
      .where(gte(jobMatches.createdAt, thirtyDaysAgo)),

    database
      .select({
        platform: jobs.platform,
        lastWeek: sql<number>`cast(count(*) filter (where ${jobs.scrapedAt} >= ${sevenDaysAgo}) as integer)`,
        previousWeek: sql<number>`cast(count(*) filter (where ${jobs.scrapedAt} >= ${fourteenDaysAgo} and ${jobs.scrapedAt} < ${sevenDaysAgo}) as integer)`,
      })
      .from(jobs)
      .where(visible)
      .groupBy(jobs.platform),

    database
      .select({
        stage: applications.stage,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(applications)
      .where(isNull(applications.deletedAt))
      .groupBy(applications.stage),

    database
      .select({
        stage: applications.stage,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(applications)
      .where(and(isNull(applications.deletedAt), gte(applications.createdAt, thirtyDaysAgo)))
      .groupBy(applications.stage),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          eq(applications.stage, "screening"),
          lt(applications.updatedAt, fourteenDaysAgo),
        ),
      ),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(
        and(
          isNull(applications.deletedAt),
          eq(applications.stage, "interview"),
          lt(applications.updatedAt, fourteenDaysAgo),
        ),
      ),

    database
      .select({
        count: sql<number>`cast(count(*) as integer)`,
        averageScore: sql<number | null>`avg(${jobMatches.matchScore})`,
      })
      .from(jobMatches)
      .where(and(gte(jobMatches.matchScore, 80), eq(jobMatches.status, "pending"))),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(interviews)
      .where(
        and(
          isNull(interviews.deletedAt),
          eq(interviews.status, "scheduled"),
          gte(interviews.scheduledAt, now),
          lt(interviews.scheduledAt, daysAgo(-7)),
        ),
      ),

    database
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(scrapeResults)
      .where(and(gte(scrapeResults.runAt, sevenDaysAgo), eq(scrapeResults.status, "failed"))),

    database
      .select({
        client: sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`,
        openCount: sql<number>`cast(count(*) as integer)`,
      })
      .from(jobs)
      .where(and(eq(jobs.status, "open"), isNull(jobs.deletedAt)))
      .groupBy(sql`coalesce(${jobs.endClient}, ${jobs.company})`)
      .orderBy(desc(sql`count(*)`))
      .limit(5),

    database
      .select({
        title: jobs.title,
        openCount: sql<number>`cast(count(*) as integer)`,
      })
      .from(jobs)
      .where(and(eq(jobs.status, "open"), isNull(jobs.deletedAt)))
      .groupBy(jobs.title)
      .orderBy(desc(sql`count(*)`))
      .limit(5),

    database
      .select({ count: sql<number>`cast(count(distinct ${candidates.id}) as integer)` })
      .from(candidates)
      .leftJoin(
        applications,
        and(eq(applications.candidateId, candidates.id), isNull(applications.deletedAt)),
      )
      .where(
        and(
          isNull(candidates.deletedAt),
          gte(candidates.createdAt, sevenDaysAgo),
          isNull(applications.id),
        ),
      ),

    database
      .select({ avgScore: sql<number | null>`avg(${jobMatches.matchScore})` })
      .from(jobMatches)
      .where(gte(jobMatches.createdAt, sevenDaysAgo)),

    database
      .select({ avgScore: sql<number | null>`avg(${jobMatches.matchScore})` })
      .from(jobMatches)
      .where(
        and(gte(jobMatches.createdAt, fourteenDaysAgo), lt(jobMatches.createdAt, sevenDaysAgo)),
      ),
  ]);

  const stageCounts: Record<string, number> = {};
  for (const row of stageCountsRaw) stageCounts[row.stage] = row.count;

  const stageTransitions: Record<string, number> = {};
  for (const row of stageTransitionsRaw) stageTransitions[row.stage] = row.count;

  const stageOrderList = ["new", "screening", "interview", "offer", "hired"] as const;
  const reachedBy = (stage: (typeof stageOrderList)[number]) => {
    const startIdx = stageOrderList.indexOf(stage);
    return stageOrderList.slice(startIdx).reduce((sum, s) => sum + (stageTransitions[s] ?? 0), 0);
  };

  const stageConversion: StageConversion[] = [
    ["new", "screening"],
    ["screening", "interview"],
    ["interview", "offer"],
    ["offer", "hired"],
  ].map(([from, to]) => {
    const fromCount = reachedBy(from as (typeof stageOrderList)[number]);
    const toCount = reachedBy(to as (typeof stageOrderList)[number]);

    return {
      fromStage: from,
      toStage: to,
      fromCount,
      toCount,
      conversionPct: fromCount === 0 ? null : Math.round((toCount / fromCount) * 100),
    };
  });

  const platformInflow: PlatformInflow[] = platformInflowRaw
    .map((row) => ({
      platform: row.platform,
      lastWeek: row.lastWeek ?? 0,
      previousWeek: row.previousWeek ?? 0,
      deltaPct: pctChange(row.lastWeek ?? 0, row.previousWeek ?? 0),
    }))
    .sort((a, b) => b.lastWeek - a.lastWeek);

  const last7dAvg = matchScoreLast7Res[0]?.avgScore ?? null;
  const prev7dAvg = matchScorePrev7Res[0]?.avgScore ?? null;
  const deltaPoints =
    last7dAvg !== null && prev7dAvg !== null ? Math.round((last7dAvg - prev7dAvg) * 10) / 10 : null;

  return {
    window: {
      now: now.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      fourteenDaysAgo: fourteenDaysAgo.toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
    },
    totals: {
      openJobs: openJobsRes[0]?.count ?? 0,
      activeCandidates: activeCandidatesRes[0]?.count ?? 0,
      applications30d: applications30dRes[0]?.count ?? 0,
      applications7d: applications7dRes[0]?.count ?? 0,
      placements30d: placements30dRes[0]?.count ?? 0,
      matches30d: matches30dRes[0]?.count ?? 0,
    },
    platformInflow,
    stageCounts,
    stageConversion,
    staleScreenings: staleScreeningsRes[0]?.count ?? 0,
    staleInterviews: staleInterviewsRes[0]?.count ?? 0,
    highScoreUnreviewedMatches: {
      total: highScoreUnreviewedRes[0]?.count ?? 0,
      averageScore:
        highScoreUnreviewedRes[0]?.averageScore != null
          ? Math.round(Number(highScoreUnreviewedRes[0].averageScore) * 10) / 10
          : null,
    },
    upcomingInterviews7d: upcomingInterviews7dRes[0]?.count ?? 0,
    recentScrapeFailures: recentScrapeFailuresRes[0]?.count ?? 0,
    topOpenClients: topOpenClientsRaw
      .filter((row): row is { client: string; openCount: number } => Boolean(row.client))
      .map((row) => ({ client: row.client, openCount: row.openCount })),
    topOpenTitles: topOpenTitlesRaw.map((row) => ({
      title: row.title,
      openCount: row.openCount,
    })),
    newCandidatesWithoutApplication: newCandidatesNoAppRes[0]?.count ?? 0,
    matchScoreTrend: {
      last7dAvg: last7dAvg !== null ? Math.round(last7dAvg * 10) / 10 : null,
      previous7dAvg: prev7dAvg !== null ? Math.round(prev7dAvg * 10) / 10 : null,
      deltaPoints,
    },
  };
}

// ── AI generation ────────────────────────────────────────────────────

const insightSchema = z.object({
  type: z
    .enum(["kans", "trend", "risico", "actie"])
    .describe("Classificatie: kans, trend (neutrale observatie), risico, of concrete actie"),
  title: z.string().min(3).max(80).describe("Korte pakkende titel in het Nederlands"),
  description: z
    .string()
    .min(20)
    .max(280)
    .describe("1-2 zinnen uitleg met concrete cijfers, in het Nederlands"),
  priority: z.enum(["hoog", "gemiddeld", "laag"]),
  metricLabel: z.string().max(40).optional(),
  metricValue: z.string().max(40).optional(),
  href: z
    .string()
    .regex(/^\/[a-z0-9/?=&_-]*$/i)
    .optional()
    .describe("Optionele deep-link binnen de app, bijv. /pipeline?fase=screening"),
});

const trendInsightsOutputSchema = z.object({
  summary: z
    .string()
    .min(20)
    .max(240)
    .describe("Eén zin samenvatting van de belangrijkste signalen"),
  insights: z.array(insightSchema).min(3).max(6),
});

const SYSTEM_PROMPT = `Je bent een recruitment-analist voor Motian, een Nederlands uitzend- en detacheringsplatform. Je krijgt ruwe trenddata en moet 3-6 korte, concrete inzichten formuleren die een recruiter helpen vandaag betere beslissingen te nemen.

Regels:
- Schrijf alles in helder Nederlands.
- Baseer elk inzicht op de gegeven cijfers. Geen speculatie of verzonnen data.
- Zoek expliciet naar:
  * Kansen: platforms met stijgende instroom, klanten met veel open vacatures, hoogscorende matches die nog niet zijn opgevolgd, nieuwe kandidaten zonder sollicitatie.
  * Risico's: achterblijvende conversie, lang stilstaande kandidaten in een fase, dalende instroom, scrape-fouten.
  * Trends: significante stijging of daling week-over-week.
  * Acties: concrete next steps waar de recruiter vandaag tijd aan moet besteden.
- Gebruik prioriteit 'hoog' alleen voor signalen die direct omzet- of conversie-impact hebben.
- Laat inzichten weg als er onvoldoende data is (bijv. totalen op 0). Verzin dan geen insight.
- Gebruik waar mogelijk href deep-links: /pipeline, /pipeline?fase=new|screening|interview|offer, /kandidaten, /vacatures, /scraper, /interviews.
- Maak titels kort en actionable ("Hoogscorende matches wachten op review", niet "Er zijn matches").`;

export async function generateTrendInsights(metrics: TrendMetrics): Promise<TrendInsightsResult> {
  const generatedAt = new Date().toISOString();

  if (metrics.totals.openJobs === 0 && metrics.totals.applications30d === 0) {
    return {
      generatedAt,
      source: "fallback",
      summary:
        "Er is nog te weinig data om trends te analyseren. Voeg vacatures en kandidaten toe.",
      insights: [],
    };
  }

  try {
    const result = await generateObject({
      model: gemini31FlashLite,
      schema: trendInsightsOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: `Analyseer onderstaande trenddata en genereer 3-6 inzichten voor de recruiter.

${JSON.stringify(metrics, null, 2)}

Focus op concrete opportunities die vandaag actie vragen. Noem in elke description concrete getallen uit de data.`,
      providerOptions: {
        google: {
          structuredOutputs: true,
        },
      },
      abortSignal: AbortSignal.timeout(15_000),
    });

    return {
      generatedAt,
      source: "ai",
      summary: result.object.summary,
      insights: result.object.insights,
    };
  } catch (error) {
    console.warn("[trend-insights] AI generation failed, using fallback", error);
    return {
      generatedAt,
      source: "fallback",
      ...buildFallbackInsights(metrics),
    };
  }
}

export function buildFallbackInsights(
  metrics: TrendMetrics,
): Pick<TrendInsightsResult, "summary" | "insights"> {
  const insights: TrendInsight[] = [];

  if (metrics.highScoreUnreviewedMatches.total > 0) {
    insights.push({
      type: "kans",
      title: "Hoogscorende matches wachten op review",
      description: `${metrics.highScoreUnreviewedMatches.total} matches met score ≥ 80 staan nog op 'pending'. Beoordeel ze eerst voor het hoogste conversiepotentieel.`,
      priority: "hoog",
      metricLabel: "Wachtende matches",
      metricValue: String(metrics.highScoreUnreviewedMatches.total),
      href: "/kandidaten",
    });
  }

  if (metrics.staleScreenings + metrics.staleInterviews > 0) {
    insights.push({
      type: "risico",
      title: "Pipeline-fases staan te lang stil",
      description: `${metrics.staleScreenings} kandidaten zitten >14 dagen in screening, ${metrics.staleInterviews} in interview. Plan een vervolgstap of sluit af.`,
      priority: "gemiddeld",
      metricLabel: "Lang stilstaand",
      metricValue: String(metrics.staleScreenings + metrics.staleInterviews),
      href: "/pipeline?fase=screening&weergave=lijst",
    });
  }

  const topGrowth = metrics.platformInflow.find(
    (row) => row.deltaPct !== null && row.deltaPct >= 25 && row.lastWeek >= 5,
  );
  if (topGrowth) {
    insights.push({
      type: "trend",
      title: `Instroom stijgt op ${topGrowth.platform}`,
      description: `${topGrowth.platform} heeft deze week ${topGrowth.lastWeek} nieuwe vacatures (+${topGrowth.deltaPct}% t.o.v. vorige week). Prioriteer sourcing op dit platform.`,
      priority: "gemiddeld",
      metricLabel: topGrowth.platform,
      metricValue: `+${topGrowth.deltaPct}%`,
      href: "/vacatures",
    });
  }

  if (metrics.newCandidatesWithoutApplication > 0) {
    insights.push({
      type: "actie",
      title: "Nieuwe kandidaten zonder sollicitatie",
      description: `${metrics.newCandidatesWithoutApplication} kandidaten zijn de laatste 7 dagen toegevoegd maar hebben nog geen match of sollicitatie. Draai auto-matching of koppel handmatig.`,
      priority: "gemiddeld",
      metricLabel: "Nieuwe instroom",
      metricValue: String(metrics.newCandidatesWithoutApplication),
      href: "/kandidaten",
    });
  }

  if (metrics.topOpenClients[0] && metrics.topOpenClients[0].openCount >= 3) {
    const top = metrics.topOpenClients[0];
    insights.push({
      type: "kans",
      title: `${top.client} heeft ${top.openCount} open vacatures`,
      description: `${top.client} is momenteel de klant met de meeste openstaande rollen. Focus sourcing op dit account voor maximale hit-rate.`,
      priority: "gemiddeld",
      metricLabel: "Open vacatures",
      metricValue: String(top.openCount),
      href: "/vacatures",
    });
  }

  if (metrics.recentScrapeFailures >= 3) {
    insights.push({
      type: "risico",
      title: "Scrape-storingen lopen op",
      description: `${metrics.recentScrapeFailures} scrape-runs liepen vast in de laatste 7 dagen. Controleer de bronconfiguratie voordat sourcing gaten laat vallen.`,
      priority: "hoog",
      metricLabel: "Fouten (7d)",
      metricValue: String(metrics.recentScrapeFailures),
      href: "/scraper",
    });
  }

  const summary =
    insights.length === 0
      ? "Geen urgente signalen in de laatste 30 dagen."
      : `${insights.length} signalen uit de trenddata vragen aandacht.`;

  return { summary, insights };
}

// ── Orchestrator (cached) ────────────────────────────────────────────

const EMPTY_METRICS_RESULT: TrendInsightsResult = {
  generatedAt: new Date(0).toISOString(),
  source: "fallback",
  summary: "Trenddata is tijdelijk niet beschikbaar.",
  insights: [],
};

async function getTrendInsightsUncached(database: typeof db = db): Promise<TrendInsightsResult> {
  try {
    const metrics = await collectTrendMetrics(database);
    return generateTrendInsights(metrics);
  } catch (error) {
    console.warn("[trend-insights] metrics collection failed", error);
    return { ...EMPTY_METRICS_RESULT, generatedAt: new Date().toISOString() };
  }
}

const getCached = unstable_cache(
  async () => getTrendInsightsUncached(db),
  ["trend-insights", "v1"],
  { revalidate: 15 * 60 },
);

export async function getTrendInsights(database: typeof db = db): Promise<TrendInsightsResult> {
  if (database === db) return getCached();
  return getTrendInsightsUncached(database);
}
