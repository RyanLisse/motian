import { and, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { applications } from "@/src/db/schema";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getOpdrachtenServiceSort,
  MAX_OPDRACHTEN_LIMIT,
  parseOpdrachtenFilters,
} from "@/src/lib/opdrachten-filters";
import { parsePagination } from "@/src/lib/pagination";
import { searchJobsUnified } from "@/src/services/jobs";

export const dynamic = "force-dynamic";

type PipelineCountRow = {
  jobId: string;
  pipelineCount: number;
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const filters = parseOpdrachtenFilters(params);
  const { page, limit, offset } = parsePagination(params, {
    limit: DEFAULT_OPDRACHTEN_LIMIT,
    maxLimit: MAX_OPDRACHTEN_LIMIT,
  });
  const sortBy = getOpdrachtenServiceSort(filters.sort, Boolean(filters.q?.trim()));
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

  const jobIds = result.data.map((job) => job.id);
  const pipelineRows: PipelineCountRow[] =
    jobIds.length === 0
      ? []
      : await db
          .select({
            jobId: sql<string>`${applications.jobId}`,
            pipelineCount: sql<number>`count(*)::int`,
          })
          .from(applications)
          .where(
            and(
              inArray(applications.jobId, jobIds),
              isNotNull(applications.jobId),
              isNull(applications.deletedAt),
              ne(applications.stage, "rejected"),
            ),
          )
          .groupBy(applications.jobId);

  const pipelineCountByJobId = new Map(
    pipelineRows.map((row: PipelineCountRow) => [row.jobId, row.pipelineCount]),
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
