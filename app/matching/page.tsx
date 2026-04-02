import { redirect } from "next/navigation";

/*
 * Intentional redirect page — introduced during the recruiter-flow merge.
 *
 * Routing behaviour:
 *   - Without jobId  → /kandidaten          (candidate management / drag-drop matching UI)
 *   - With jobId     → /vacatures/{id}#recruiter-cockpit   (default tab)
 *   - With jobId + tab=grading → /vacatures/{id}#ai-grading
 *
 * The matching UI itself lives on:
 *   - /kandidaten          — drag-drop kanban board
 *   - /vacatures/{id}      — recruiter cockpit & AI grading tabs
 *
 * /matching is kept as a permanent redirect so that any bookmarked or
 * externally linked URLs continue to resolve correctly.
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
