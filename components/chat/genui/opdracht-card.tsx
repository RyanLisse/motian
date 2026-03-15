"use client";

import { JobCard } from "@/components/job-card";
import { getToolErrorMessage, isToolError, toDate } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type JobOutput = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  contractType?: string | null;
  workArrangement?: string | null;
  rateMin?: number | null;
  rateMax?: number | null;
  applicationDeadline?: string | Date | null;
  postedAt?: string | Date | null;
  pipelineCount?: number;
};

function isJobOutput(o: unknown): o is JobOutput {
  return typeof o === "object" && o !== null && "id" in o && "title" in o && "platform" in o;
}

export function OpdrachtGenUICard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Opdracht niet gevonden")} />;
  if (!isJobOutput(output)) return null;
  const job = {
    id: output.id,
    title: output.title,
    company: output.company ?? null,
    location: output.location ?? null,
    platform: output.platform,
    contractType: output.contractType ?? null,
    workArrangement: output.workArrangement ?? null,
    rateMin: output.rateMin ?? null,
    rateMax: output.rateMax ?? null,
    applicationDeadline: toDate(output.applicationDeadline),
    postedAt: toDate(output.postedAt),
  };
  const pipelineCount =
    typeof (output as JobOutput).pipelineCount === "number"
      ? (output as JobOutput).pipelineCount
      : undefined;
  return (
    <div className="my-1.5">
      <JobCard job={job} pipelineCount={pipelineCount} />
    </div>
  );
}
