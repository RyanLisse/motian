import { type NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getOpdrachtenServiceSort,
  hasExplicitOpdrachtenSort,
  MAX_OPDRACHTEN_LIMIT,
  parseOpdrachtenFilters,
  validateOpdrachtenQueryParams,
} from "@/src/lib/opdrachten-filters";
import { parsePagination } from "@/src/lib/pagination";
import { searchJobsUnified } from "@/src/services/jobs";
import { getJobPipelineSummary } from "@/src/services/jobs/pipeline-summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const validatedQuery = validateOpdrachtenQueryParams(params);

  if (!validatedQuery.success) {
    return NextResponse.json(
      { error: "Ongeldige parameters", details: validatedQuery.error.flatten() },
      { status: 400 },
    );
  }

  const filters = parseOpdrachtenFilters(params);
  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(
    filters.sort,
    Boolean(filters.q?.trim()),
    hasExplicitOpdrachtenSort(params),
  );
  const result = await searchJobsUnified({
    q: filters.q,
    platform: filters.platform,
    endClient: filters.endClient,
    categories: filters.categories,
    status: filters.status,
    province: filters.province,
    regions: filters.regions,
    rateMin: filters.rateMin,
    rateMax: filters.rateMax,
    contractType: filters.contractType,
    hoursPerWeekBucket: filters.hoursPerWeek,
    minHoursPerWeek: filters.hoursPerWeekMin,
    maxHoursPerWeek: filters.hoursPerWeekMax,
    radiusKm: filters.radiusKm,
    sortBy,
    limit,
    offset,
  });

  const { hasPipelineByJobId, pipelineCountByJobId } = await getJobPipelineSummary(
    result.data.map((job) => job.id),
  );

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
