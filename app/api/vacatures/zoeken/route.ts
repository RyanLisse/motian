import { type NextRequest, NextResponse } from "next/server";
import { runVacaturesSearch } from "@/src/lib/vacatures-search";
import { getJobPipelineSummary } from "@/src/services/jobs/pipeline-summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const out = await runVacaturesSearch(params);

  if (!out.ok) {
    return NextResponse.json(out.error.body, { status: out.error.status });
  }

  const { result, page, limit } = out.data;
  const includePipeline = params.get("includePipeline") !== "false";
  const { hasPipelineByJobId, pipelineCountByJobId } = includePipeline
    ? await getJobPipelineSummary(result.data.map((job) => job.id))
    : { hasPipelineByJobId: new Set<string>(), pipelineCountByJobId: new Map<string, number>() };

  const jobs = result.data.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.endClient ?? job.company,
    location: job.location,
    platform: job.platform,
    workArrangement: job.workArrangement,
    contractType: job.contractType,
    applicationDeadline: job.applicationDeadline,
    hasPipeline: hasPipelineByJobId.has(job.id),
    pipelineCount: pipelineCountByJobId.get(job.id) ?? 0,
  }));

  return NextResponse.json({
    jobs,
    total: result.total,
    page,
    perPage: limit,
    totalPages: Math.ceil(result.total / limit),
  });
}
