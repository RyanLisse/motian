import type { CriterionResult } from "@/src/schemas/matching";

interface ReportInput {
  candidate: {
    name: string;
    role?: string | null;
    location?: string | null;
    // Exclude email, phone for GDPR compliance
  };
  job: {
    title: string;
    company?: string | null;
    location?: string | null;
  };
  match: {
    criteriaBreakdown: CriterionResult[];
    overallScore: number;
    knockoutsPassed: boolean;
    riskProfile: string[];
    enrichmentSuggestions: string[];
    recommendation: string;
    recommendationReasoning: string;
    recommendationConfidence: number;
  };
}

export function generateReport(input: ReportInput): string {
  const { candidate, job, match } = input;
  const date = new Date().toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const recommendationLabel: Record<string, string> = {
    go: "Doorgaan",
    "no-go": "Niet doorgaan",
    conditional: "Voorwaardelijk",
  };

  // Split criteria by tier
  const knockouts = match.criteriaBreakdown.filter((c) => c.tier === "knockout");
  const gunning = match.criteriaBreakdown.filter((c) => c.tier === "gunning");
  const process = match.criteriaBreakdown.filter((c) => c.tier === "process");

  // Build star display
  const stars = (n: number | null) => {
    if (n == null) return "\u2014";
    return "\u2605".repeat(n) + "\u2606".repeat(5 - n);
  };

  const lines: string[] = [];

  // Header
  lines.push(`# Matchrapport: ${candidate.name} \u2014 ${job.title}`);
  lines.push("");
  lines.push(`**Datum:** ${date}`);
  if (job.company) lines.push(`**Opdrachtgever:** ${job.company}`);
  if (job.location) lines.push(`**Locatie:** ${job.location}`);
  lines.push(
    `**Beoordeling:** ${recommendationLabel[match.recommendation] ?? match.recommendation} (${match.recommendationConfidence}% zekerheid)`,
  );
  lines.push(`**Overall score:** ${match.overallScore}/100`);
  lines.push("");

  // Summary
  lines.push("## Samenvatting");
  lines.push("");
  lines.push(match.recommendationReasoning);
  lines.push("");

  // Knock-out criteria
  if (knockouts.length > 0) {
    lines.push("## Knock-out Criteria");
    lines.push("");
    lines.push("| Eis | Resultaat | Onderbouwing |");
    lines.push("|-----|-----------|-------------|");
    for (const k of knockouts) {
      const result = k.passed ? "Voldaan" : "Niet voldaan";
      lines.push(`| ${k.criterion} | ${result} | ${k.evidence} |`);
    }
    lines.push("");
  }

  // Gunningscriteria
  if (gunning.length > 0) {
    lines.push("## Gunningscriteria");
    lines.push("");
    lines.push("| Criterium | Score | Onderbouwing |");
    lines.push("|-----------|-------|-------------|");
    for (const g of gunning) {
      lines.push(`| ${g.criterion} | ${stars(g.stars)} | ${g.evidence} |`);
    }
    lines.push("");
  }

  // Process requirements
  if (process.length > 0) {
    lines.push("## Proceseisen");
    lines.push("");
    for (const p of process) {
      lines.push(`- **${p.criterion}**: ${p.evidence}`);
    }
    lines.push("");
  }

  // Risk profile
  if (match.riskProfile.length > 0) {
    lines.push("## Risicoprofiel");
    lines.push("");
    for (const risk of match.riskProfile) {
      lines.push(`- ${risk}`);
    }
    lines.push("");
  }

  // Enrichment suggestions
  if (match.enrichmentSuggestions.length > 0) {
    lines.push("## Aanbevelingen voor Verrijking");
    lines.push("");
    match.enrichmentSuggestions.forEach((suggestion, i) => {
      lines.push(`${i + 1}. ${suggestion}`);
    });
    lines.push("");
  }

  // GDPR notice
  lines.push("---");
  lines.push("");
  lines.push(
    "*Dit rapport bevat geen persoonlijke contactgegevens (e-mail, telefoon, adres) conform AVG/GDPR-richtlijnen. Gegenereerd door Motian Recruitment Platform.*",
  );

  return lines.join("\n");
}
