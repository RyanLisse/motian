import { getCandidateById } from "./candidates";
import { getJobById } from "./jobs/repository";

export type CommercialCvRequest = {
  candidateId: string;
  jobId?: string;
};

/**
 * Stub/template commercial CV (issue #147): returns markdown recruiters can refine.
 * Full template library and PDF export are follow-ups.
 */
export async function buildCommercialCvDraft(
  input: CommercialCvRequest,
): Promise<{ title: string; body: string; format: "markdown" }> {
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    throw new Error("Kandidaat niet gevonden");
  }

  const job = input.jobId ? await getJobById(input.jobId) : null;

  const lines: string[] = [
    `# ${candidate.name}`,
    "",
    `**Rol:** ${candidate.role ?? "—"}`,
    "",
    "## Profiel",
    candidate.profileSummary?.trim()
      ? candidate.profileSummary.trim()
      : "_Voeg een korte commerciële pitch toe._",
    "",
  ];

  if (job) {
    lines.push("## Afgestemd op vacature", "", `- **${job.title}** — ${job.company ?? "—"}`, "");
  }

  lines.push(
    "## Kerncompetenties",
    "_Vul aan op basis van intake en CV._",
    "",
    "## Ervaring (highlights)",
    "_Selecteer 3–5 relevante punten voor deze opdracht._",
    "",
    "## Beschikbaarheid & voorkeuren",
    `- Locatie: ${candidate.location ?? "—"}`,
    `- Beschikbaarheid: ${candidate.availability ?? "—"}`,
    "",
    "---",
    "_Concept gegenereerd door Motian — controleer altijd vóór verzending._",
  );

  return {
    title: `Commercieel CV — ${candidate.name}`,
    body: lines.join("\n"),
    format: "markdown",
  };
}
