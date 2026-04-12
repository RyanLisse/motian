import { geminiFlashLite, tracedGenerateText as generateText } from "../lib/ai-models";
import { withRetry } from "../lib/retry";
import { structuredSkillsSchema } from "../schemas/candidate-intelligence";
import { getCandidateById } from "./candidates";
import { getJobById } from "./jobs/repository";

export type CommercialCvRequest = {
  candidateId: string;
  jobId?: string;
};

type CandidateLike = Awaited<ReturnType<typeof getCandidateById>>;
type JobLike = Awaited<ReturnType<typeof getJobById>>;

type ExperienceEntry = {
  title?: string;
  company?: string;
  duration?: string;
  period?: { start?: string; end?: string };
  responsibilities?: string[];
};

type EducationEntry = {
  degree?: string;
  institution?: string | null;
  year?: string | null;
};

type LanguageEntry = {
  language?: string;
  level?: string;
};

type StructuredSkill = {
  name: string;
  proficiency: number;
  evidence: string;
};

function hasAiRewriteConfig() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
}

function parseExperienceEntries(input: unknown): ExperienceEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        title: typeof record.title === "string" ? record.title : undefined,
        company: typeof record.company === "string" ? record.company : undefined,
        duration: typeof record.duration === "string" ? record.duration : undefined,
        period:
          record.period && typeof record.period === "object"
            ? {
                start:
                  typeof (record.period as Record<string, unknown>).start === "string"
                    ? ((record.period as Record<string, unknown>).start as string)
                    : undefined,
                end:
                  typeof (record.period as Record<string, unknown>).end === "string"
                    ? ((record.period as Record<string, unknown>).end as string)
                    : undefined,
              }
            : undefined,
        responsibilities: Array.isArray(record.responsibilities)
          ? record.responsibilities.filter((item): item is string => typeof item === "string")
          : undefined,
      },
    ];
  });
}

function parseEducationEntries(input: unknown): EducationEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        degree: typeof record.degree === "string" ? record.degree : undefined,
        institution:
          typeof record.institution === "string"
            ? record.institution
            : record.institution == null
              ? null
              : undefined,
        year:
          typeof record.year === "string" ? record.year : record.year == null ? null : undefined,
      },
    ];
  });
}

function parseLanguageEntries(input: unknown): LanguageEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        language: typeof record.language === "string" ? record.language : undefined,
        level: typeof record.level === "string" ? record.level : undefined,
      },
    ];
  });
}

function parseStructuredSkills(input: unknown): {
  hard: StructuredSkill[];
  soft: StructuredSkill[];
} {
  const parsed = structuredSkillsSchema.safeParse(input);
  return parsed.success ? parsed.data : { hard: [], soft: [] };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function formatAvailabilityLabel(availability: string | null | undefined): string {
  switch (availability) {
    case "direct":
      return "Direct beschikbaar";
    case "1_maand":
      return "Binnen 1 maand beschikbaar";
    case "3_maanden":
      return "Binnen 3 maanden beschikbaar";
    default:
      return "Nog te bevestigen";
  }
}

function formatWorkArrangementLabel(value: string | null | undefined): string | null {
  switch (value) {
    case "remote":
      return "Remote";
    case "hybride":
    case "hybrid":
      return "Hybride";
    case "op_locatie":
      return "Op locatie";
    default:
      return value ?? null;
  }
}

function formatContractTypeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ");
}

function formatPeriod(entry: ExperienceEntry): string | null {
  if (entry.duration) return entry.duration;
  const start = entry.period?.start;
  const end = entry.period?.end;
  if (!start && !end) return null;
  return [start, end].filter(Boolean).join(" – ");
}

function collectJobKeywords(job: NonNullable<JobLike>): string[] {
  return unique(
    [
      job.title,
      ...parseStringArray(job.requirements),
      ...parseStringArray(job.wishes),
      ...parseStringArray(job.competences),
      job.company ?? undefined,
      job.location ?? undefined,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => normalizeText(value)),
  );
}

function scoreExperienceEntry(entry: ExperienceEntry, jobKeywords: string[]): number {
  if (jobKeywords.length === 0) return 0;
  const haystack = normalizeText(
    [
      entry.title,
      entry.company,
      ...(entry.responsibilities ?? []),
      formatPeriod(entry) ?? undefined,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return jobKeywords.reduce(
    (score, keyword) => (haystack.includes(keyword) ? score + 1 : score),
    0,
  );
}

function selectExperienceHighlights(
  experience: ExperienceEntry[],
  job: JobLike,
): Array<{ heading: string; details: string }> {
  const jobKeywords = job ? collectJobKeywords(job) : [];
  const ranked = [...experience]
    .map((entry, index) => ({
      entry,
      score: scoreExperienceEntry(entry, jobKeywords),
      index,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map(({ entry }) => entry);

  return ranked.map((entry) => {
    const headingParts = [entry.title, entry.company].filter(Boolean);
    const period = formatPeriod(entry);
    const details = [period, ...(entry.responsibilities ?? []).slice(0, 2)]
      .filter(Boolean)
      .join(" — ");
    return {
      heading: headingParts.join(" bij "),
      details,
    };
  });
}

function selectCoreCompetencies(candidate: NonNullable<CandidateLike>, job: JobLike): string[] {
  const structured = parseStructuredSkills(candidate.skillsStructured);
  const flatSkills = parseStringArray(candidate.skills);
  const preferred = structured.hard
    .sort((a, b) => b.proficiency - a.proficiency)
    .map((skill) => skill.name);
  const jobKeywords = job ? collectJobKeywords(job) : [];
  const ranked = unique([...preferred, ...flatSkills]).sort((a, b) => {
    const aScore = jobKeywords.some((keyword) => normalizeText(a).includes(keyword)) ? 1 : 0;
    const bScore = jobKeywords.some((keyword) => normalizeText(b).includes(keyword)) ? 1 : 0;
    return bScore - aScore;
  });
  return ranked.slice(0, 8);
}

function buildProfilePitch(candidate: NonNullable<CandidateLike>, job: JobLike): string[] {
  const snippets = [];
  if (candidate.profileSummary?.trim()) snippets.push(candidate.profileSummary.trim());
  else if (candidate.headline?.trim()) snippets.push(candidate.headline.trim());

  const structured = parseStructuredSkills(candidate.skillsStructured);
  if (structured.hard.length > 0) {
    snippets.push(
      `Brengt aantoonbare ervaring mee in ${structured.hard
        .slice(0, 3)
        .map((skill) => skill.name)
        .join(", ")}.`,
    );
  } else {
    const flatSkills = parseStringArray(candidate.skills);
    if (flatSkills.length > 0) {
      snippets.push(`Heeft relevante skills in ${flatSkills.slice(0, 4).join(", ")}.`);
    }
  }

  if (job) {
    const overlaps = selectCoreCompetencies(candidate, job).filter((skill) =>
      collectJobKeywords(job).some((keyword) => normalizeText(skill).includes(keyword)),
    );
    if (overlaps.length > 0) {
      snippets.push(
        `Sluit inhoudelijk goed aan op ${job.title} dankzij overlap op ${overlaps.slice(0, 3).join(", ")}.`,
      );
    }
  }

  return unique(snippets).slice(0, 3);
}

function buildVacatureAlignment(
  candidate: NonNullable<CandidateLike>,
  job: NonNullable<JobLike>,
): string[] {
  const overlaps = selectCoreCompetencies(candidate, job).filter((skill) =>
    collectJobKeywords(job).some((keyword) => normalizeText(skill).includes(keyword)),
  );
  const lines: string[] = [];

  if (overlaps.length > 0) {
    lines.push(`Sluit aan op de vacature via ${overlaps.slice(0, 4).join(", ")}.`);
  }

  const workArrangement = formatWorkArrangementLabel(job.workArrangement ?? null);
  if (workArrangement) {
    lines.push(`Werkvorm in aanvraag: ${workArrangement}.`);
  }

  if (job.rateMin || job.rateMax) {
    lines.push(
      `Tariefbandbreedte vacature: €${job.rateMin ?? "?"} – €${job.rateMax ?? "?"} per uur.`,
    );
  }

  if (candidate.location || candidate.province || job.location || job.province) {
    lines.push(
      `Locatie-fit: ${[candidate.location ?? candidate.province, job.location ?? job.province]
        .filter(Boolean)
        .join(" ↔ ")}.`,
    );
  }

  return lines.slice(0, 4);
}

function buildDeterministicFacts(
  candidate: NonNullable<CandidateLike>,
  job: JobLike,
): { title: string; body: string; factSheet: string } {
  const intro = buildProfilePitch(candidate, job);
  const coreCompetencies = selectCoreCompetencies(candidate, job);
  const experienceHighlights = selectExperienceHighlights(
    parseExperienceEntries(candidate.experience),
    job,
  );
  const education = parseEducationEntries(candidate.education)
    .map((entry) => [entry.degree, entry.institution, entry.year].filter(Boolean).join(" — "))
    .filter(Boolean)
    .slice(0, 4);
  const languages = parseLanguageEntries(candidate.languageSkills)
    .map((entry) => [entry.language, entry.level].filter(Boolean).join(" "))
    .filter(Boolean)
    .slice(0, 4);
  const certifications = unique(parseStringArray(candidate.certifications)).slice(0, 4);
  const availability = formatAvailabilityLabel(candidate.availability);
  const preferences = [
    candidate.location ? `Locatie: ${candidate.location}` : null,
    candidate.hourlyRate ? `Tariefindicatie: €${candidate.hourlyRate} per uur` : null,
    availability ? `Beschikbaarheid: ${availability}` : null,
    formatContractTypeLabel(candidate.source ?? null)
      ? `Bron/profielcontext: ${formatContractTypeLabel(candidate.source ?? null)}`
      : null,
  ].filter(Boolean);

  const jobAlignment = job ? buildVacatureAlignment(candidate, job) : [];

  const lines: string[] = [
    `# ${candidate.name}`,
    "",
    `**Rol:** ${candidate.role ?? "Nog aan te scherpen"}`,
    "",
    "## Profiel",
    ...(intro.length > 0
      ? intro
      : [
          "Sterke kandidaat met profielinformatie die nog verder commercieel aangescherpt kan worden.",
        ]),
    "",
  ];

  if (job) {
    lines.push(
      "## Afgestemd op vacature",
      `- **${job.title}** — ${job.company ?? "Onbekende opdrachtgever"}`,
      ...jobAlignment.map((line) => `- ${line}`),
      "",
    );
  }

  lines.push(
    "## Kerncompetenties",
    ...(coreCompetencies.length > 0
      ? coreCompetencies.map((skill) => `- ${skill}`)
      : ["- Vaardigheden verder aanscherpen op basis van intake en CV."]),
    "",
    "## Ervaring (highlights)",
    ...(experienceHighlights.length > 0
      ? experienceHighlights.map(
          ({ heading, details }) =>
            `- **${heading || "Ervaring"}**${details ? ` — ${details}` : ""}`,
        )
      : ["- Selecteer 3–5 relevante projecten of opdrachten voor deze kandidaat."]),
    "",
    "## Opleiding & certificeringen",
    ...(education.length > 0 || certifications.length > 0
      ? [...education.map((item) => `- ${item}`), ...certifications.map((item) => `- ${item}`)]
      : ["- Voeg relevante opleiding of certificeringen toe."]),
    "",
    "## Talen & voorkeuren",
    ...(languages.length > 0 ? languages.map((item) => `- ${item}`) : []),
    ...preferences.map((item) => `- ${item}`),
    "",
    "---",
    "_Concept gegenereerd door Motian — controleer altijd vóór verzending._",
  );

  const factSheetLines = [
    `Naam: ${candidate.name}`,
    `Rol: ${candidate.role ?? "Onbekend"}`,
    `Headline: ${candidate.headline ?? "—"}`,
    `Profielsamenvatting: ${candidate.profileSummary ?? "—"}`,
    `Locatie: ${candidate.location ?? candidate.province ?? "—"}`,
    `Beschikbaarheid: ${availability}`,
    `Tariefindicatie: ${candidate.hourlyRate ? `€${candidate.hourlyRate}/uur` : "—"}`,
    `Kerncompetenties: ${coreCompetencies.join(", ") || "—"}`,
    `Ervaring highlights: ${experienceHighlights.map((item) => `${item.heading}${item.details ? ` (${item.details})` : ""}`).join(" | ") || "—"}`,
    `Opleiding/certificeringen: ${[...education, ...certifications].join(" | ") || "—"}`,
    `Talen: ${languages.join(", ") || "—"}`,
    job
      ? `Vacaturecontext: ${job.title} / ${job.company ?? "—"} / ${buildVacatureAlignment(candidate, job).join(" | ") || "geen directe alignment gevonden"}`
      : "Vacaturecontext: geen vacature meegegeven",
  ];

  return {
    title: `Commercieel CV — ${candidate.name}`,
    body: lines.join("\n"),
    factSheet: factSheetLines.join("\n"),
  };
}

async function maybeEnhanceCommercialCvMarkdown(
  deterministicDraft: { title: string; body: string; factSheet: string },
  job: JobLike,
): Promise<string> {
  if (!hasAiRewriteConfig()) {
    return deterministicDraft.body;
  }

  try {
    const { text } = await withRetry(
      () =>
        generateText({
          model: geminiFlashLite,
          system:
            "Je bent een recruiter die een commercieel CV aanscherpt. Gebruik uitsluitend feiten uit de aangeleverde factsheet en het concept. Hallucineer niets. Houd het in het Nederlands, concreet, recruiter-waardig en in markdown.",
          prompt: `Herschrijf dit commerciële CV-concept naar een scherp recruiter-document.\n\nREGELS:\n- Houd dezelfde globale markdown-structuur aan.\n- Maak de profielsectie overtuigender en concreter.\n- Kies alleen competenties en highlights die door de factsheet ondersteund worden.\n- Als vacaturecontext aanwezig is, benoem de match zonder te overdrijven.\n- Voeg geen nieuwe feiten, werkgevers, certificaten of resultaten toe.\n- Gebruik geen AI-disclaimer anders dan de bestaande Motian footer.\n- Houd het compact: geschikt als direct deelbaar commercieel CV.\n\nFACTSHEET:\n${deterministicDraft.factSheet}\n\nVACATURE MEEGEGEVEN: ${job ? "ja" : "nee"}\n\nCONCEPT:\n${deterministicDraft.body}`,
        }),
      { label: "Commercial CV rewrite", maxAttempts: 2, baseDelayMs: 750 },
    );

    const normalized = text?.trim();
    return normalized?.startsWith("# ") ? normalized : deterministicDraft.body;
  } catch {
    return deterministicDraft.body;
  }
}

export async function buildCommercialCvDraft(
  input: CommercialCvRequest,
): Promise<{ title: string; body: string; format: "markdown" }> {
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) {
    throw new Error("Kandidaat niet gevonden");
  }

  const job = input.jobId ? await getJobById(input.jobId) : null;
  const deterministicDraft = buildDeterministicFacts(candidate, job);
  const body = await maybeEnhanceCommercialCvMarkdown(deterministicDraft, job);

  return {
    title: deterministicDraft.title,
    body,
    format: "markdown",
  };
}
