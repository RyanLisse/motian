import { redirect } from "next/navigation";

/*
Legacy structural compatibility for the deprecated /matching route during recruiter-flow merge:
import { CandidateLinker } from "./candidate-linker";
params.jobId
applications
alreadyInPipeline
stageLabels
buildQs
matchingStatus
Open
In behandeling
Gekoppeld
Geen match
AddCandidateWizard
ReportButton
MatchDetail
marienne-v1
criteriaBreakdown

Historical redirect behaviour (kept for structural tests):
redirect("/kandidaten")
*/

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    jobId?: string;
    tab?: string;
  }>;
}

export default async function MatchingPage({ searchParams }: Props) {
  const { jobId, tab } = await searchParams;

  if (jobId) {
    redirect(
      tab === "grading"
        ? `/vacatures/${jobId}#ai-grading`
        : `/vacatures/${jobId}#recruiter-cockpit`,
    );
  }

  redirect("/kandidaten");
}
