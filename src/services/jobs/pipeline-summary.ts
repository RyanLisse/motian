import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { applications } from "@/src/db/schema";

type PipelineSummaryRow = {
  jobId: string;
  pipelineCount: number;
};

export async function getJobPipelineSummary(jobIds: string[]) {
  if (jobIds.length === 0) {
    return {
      hasPipelineByJobId: new Set<string>(),
      pipelineCountByJobId: new Map<string, number>(),
    };
  }

  const pipelineRows: PipelineSummaryRow[] = await db
    .select({
      jobId: sql<string>`${applications.jobId}`,
      pipelineCount: sql<number>`sum(case when ${applications.stage} != 'rejected' then 1 else 0 end)::int`,
    })
    .from(applications)
    .where(
      and(
        inArray(applications.jobId, jobIds),
        isNotNull(applications.jobId),
        isNull(applications.deletedAt),
      ),
    )
    .groupBy(applications.jobId);

  return {
    hasPipelineByJobId: new Set(pipelineRows.map((row) => row.jobId)),
    pipelineCountByJobId: new Map(pipelineRows.map((row) => [row.jobId, row.pipelineCount])),
  };
}
