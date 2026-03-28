import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/src/lib/api-handler";
import { getJobsForRun, getRunById } from "@/src/services/scrape-results";

export const dynamic = "force-dynamic";

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

    // Validate jobs parameter: null/undefined = omit, "summary"/"full" = valid, otherwise 400 error
    let jobs: "summary" | "full" | undefined;

    if (jobsParam !== null) {
      const jobsSchema = z.enum(["summary", "full"]);
      const validationResult = jobsSchema.safeParse(jobsParam);

      if (!validationResult.success) {
        return Response.json(
          { error: 'Ongeldige waarde voor "jobs" parameter. Gebruik "summary" of "full".' },
          { status: 400 },
        );
      }

      jobs = validationResult.data;
    }

    let jobsData: Awaited<ReturnType<typeof getJobsForRun>> = [];
    const jobIds = Array.isArray(run.jobIds) ? (run.jobIds as string[]) : null;
    if (jobs === "summary" || jobs === "full") {
      jobsData = await getJobsForRun(jobIds, {
        includeRawPayload: jobs === "full",
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
          jobs: jobs ? jobsData : undefined,
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=30" },
      },
    );
  },
  {
    logPrefix: "GET /api/scrape-resultaten/[id]",
    errorMessage: "Kan scrape-run niet ophalen",
  },
);
