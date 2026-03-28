import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { getJobsForRun, getRunById } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  jobs: z.enum(["summary", "full"]).optional(),
});

/** Eén scrape-run met optioneel de bijbehorende vacatures (summary of full met rawPayload). */
export const GET = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const run = await getRunById(id);
    if (!run) {
      return Response.json({ error: "Scrape-run niet gevonden" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const jobsParam = searchParams.get("jobs");

    // Validate jobs parameter
    const parseResult = querySchema.safeParse({ jobs: jobsParam || undefined });
    if (!parseResult.success) {
      return Response.json(
        { error: "Ongeldige query parameter: jobs moet 'summary' of 'full' zijn" },
        { status: 400 },
      );
    }

    const { jobs: validatedJobs } = parseResult.data;

    let jobs: Awaited<ReturnType<typeof getJobsForRun>> = [];
    const jobIds = Array.isArray(run.jobIds) ? (run.jobIds as string[]) : null;
    if (validatedJobs) {
      jobs = await getJobsForRun(jobIds, {
        includeRawPayload: validatedJobs === "full",
      });
    }

    return Response.json(
      {
        data: {
          id: run.id,
          configId: run.configId,
          platform: run.platform,
          runAt: run.runAt,
          durationMs: run.durationMs,
          jobsFound: run.jobsFound,
          jobsNew: run.jobsNew,
          duplicates: run.duplicates,
          status: run.status,
          errors: run.errors,
          jobIds: run.jobIds,
          jobs: validatedJobs ? jobs : undefined,
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" },
      },
    );
  },
  {
    logPrefix: "GET /api/scrape-resultaten/[id]",
    errorMessage: "Kan scrape-run niet ophalen",
  },
);