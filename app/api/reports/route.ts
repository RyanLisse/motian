import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, eq } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";
import { publishReport } from "@/src/lib/markdown-fast";
import type { CriterionResult } from "@/src/schemas/matching";
import { generateReport } from "@/src/services/report-generator";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  matchId: z.string().uuid(),
  publish: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Ongeldige invoer", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { matchId, publish: shouldPublish } = parsed.data;

    // Load match with candidate + job via joins
    const rows = await db
      .select({
        match: jobMatches,
        job: {
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
        },
        candidate: {
          name: candidates.name,
          role: candidates.role,
          location: candidates.location,
        },
      })
      .from(jobMatches)
      .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
      .where(eq(jobMatches.id, matchId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return Response.json({ error: "Match niet gevonden" }, { status: 404 });
    }

    if (!row.candidate || !row.job) {
      return Response.json(
        { error: "Kandidaat of opdracht niet meer beschikbaar" },
        { status: 422 },
      );
    }

    const criteriaBreakdown = (row.match.criteriaBreakdown as CriterionResult[]) ?? [];
    const riskProfile = (row.match.riskProfile as string[]) ?? [];
    const enrichmentSuggestions = (row.match.enrichmentSuggestions as string[]) ?? [];

    const markdown = generateReport({
      candidate: {
        name: row.candidate.name,
        role: row.candidate.role,
        location: row.candidate.location,
      },
      job: {
        title: row.job.title,
        company: row.job.company,
        location: row.job.location,
      },
      match: {
        criteriaBreakdown,
        overallScore: row.match.matchScore,
        knockoutsPassed: !riskProfile.some((r) => r.toLowerCase().includes("knock")),
        riskProfile,
        enrichmentSuggestions,
        recommendation: (row.match.recommendation as string) ?? "conditional",
        recommendationReasoning: row.match.reasoning ?? "",
        recommendationConfidence: (row.match.recommendationConfidence as number) ?? 0,
      },
    });

    // Optionally publish to markdown.fast
    let url: string | undefined;
    let reportId: string | undefined;

    if (shouldPublish) {
      const result = await publishReport(
        markdown,
        `Matchrapport: ${row.candidate.name} — ${row.job.title}`,
      );
      url = result.url;
      reportId = result.id;
    }

    return Response.json(
      { markdown, url, reportId },
      {
        headers: { "Cache-Control": "private, no-cache, no-store" },
      },
    );
  } catch (_err) {
    console.error("[Report API POST]", _err);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return Response.json({ error: "matchId query parameter is vereist" }, { status: 400 });
    }

    const uuidSchema = z.string().uuid();
    if (!uuidSchema.safeParse(matchId).success) {
      return Response.json({ error: "Ongeldig matchId formaat" }, { status: 400 });
    }

    // Load match with candidate + job
    const rows = await db
      .select({
        match: jobMatches,
        job: {
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
        },
        candidate: {
          name: candidates.name,
          role: candidates.role,
          location: candidates.location,
        },
      })
      .from(jobMatches)
      .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
      .where(eq(jobMatches.id, matchId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return Response.json({ error: "Match niet gevonden" }, { status: 404 });
    }

    if (!row.candidate || !row.job) {
      return Response.json(
        { error: "Kandidaat of opdracht niet meer beschikbaar" },
        { status: 422 },
      );
    }

    const criteriaBreakdown = (row.match.criteriaBreakdown as CriterionResult[]) ?? [];
    const riskProfile = (row.match.riskProfile as string[]) ?? [];
    const enrichmentSuggestions = (row.match.enrichmentSuggestions as string[]) ?? [];

    const markdown = generateReport({
      candidate: {
        name: row.candidate.name,
        role: row.candidate.role,
        location: row.candidate.location,
      },
      job: {
        title: row.job.title,
        company: row.job.company,
        location: row.job.location,
      },
      match: {
        criteriaBreakdown,
        overallScore: row.match.matchScore,
        knockoutsPassed: !riskProfile.some((r) => r.toLowerCase().includes("knock")),
        riskProfile,
        enrichmentSuggestions,
        recommendation: (row.match.recommendation as string) ?? "conditional",
        recommendationReasoning: row.match.reasoning ?? "",
        recommendationConfidence: (row.match.recommendationConfidence as number) ?? 0,
      },
    });

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (_err) {
    console.error("[Report API GET]", _err);
    return Response.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
