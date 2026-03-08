import { redirect } from "next/navigation";

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
        ? `/opdrachten/${jobId}#ai-grading`
        : `/opdrachten/${jobId}#recruiter-cockpit`,
    );
  }

  redirect("/professionals");
}
