import { structuredSkillsSchema } from "../schemas/candidate-intelligence";

export type RecruiterRecommendationLabel = "Go" | "Twijfel" | "No-go";
export type RecruiterScoreTone = "goed" | "let-op" | "actie";
export type CandidateNextActionKey = "verrijk" | "bel" | "afwijzen" | "auto-match";

export type CandidateNextAction = {
  key: CandidateNextActionKey;
  label: string;
  reason: string;
};

export type ScorecardChip = {
  label: string;
  value: string;
  tone: RecruiterScoreTone;
};

export type MatchBrief = {
  summary: string;
  whyThisMatchExists: string[];
  mustHavesMet: string[];
  mustHavesMissing: string[];
  escoOverlap: {
    sharedLabels: string[];
    sharedCount: number;
  };
  rawSkillOverlap: {
    sharedSkills: string[];
    sharedCount: number;
  };
  commercialBlockers: string[];
  recommendation: {
    label: RecruiterRecommendationLabel;
    confidence: number | null;
    reason: string;
  };
};

export type CandidateIntakeScorecard = {
  summary: string;
  completenessScore: number;
  completenessLabel: string;
  completenessItems: ScorecardChip[];
  parsedSkillsQuality: ScorecardChip;
  escoCoverage: ScorecardChip;
  likelySeniority: ScorecardChip;
  nextAction: CandidateNextAction;
};

export type VacatureTriageScorecard = {
  summary: string;
  mustHaveCount: number;
  niceToHaveCount: number;
  seniority: ScorecardChip;
  workConstraints: string[];
  sourcingDifficulty: ScorecardChip;
  readiness: ScorecardChip;
};

export type PipelineHealthItem = {
  key:
    | "scraper_freshness"
    | "scrape_failures"
    | "jobs_missing_summary"
    | "jobs_missing_embedding"
    | "candidates_missing_embedding"
    | "matches_missing_structured_review";
  label: string;
  value: number;
  tone: RecruiterScoreTone;
  detail: string;
  href: string;
};

export type PipelineHealthSnapshot = {
  status: RecruiterScoreTone;
  summary: string;
  items: PipelineHealthItem[];
};

type CanonicalSkillLike = Record<string, unknown>;

type MatchCriterionLike = {
  criterion: string;
  tier: string;
  passed: boolean | null;
};

type MatchLike = {
  matchScore: number;
  reasoning?: string | null;
  recommendation?: string | null;
  recommendationConfidence?: number | null;
  criteriaBreakdown?: unknown;
};

type CandidateLike = {
  role?: string | null;
  location?: string | null;
  province?: string | null;
  skills?: unknown;
  skillsStructured?: unknown;
  resumeUrl?: string | null;
  resumeRaw?: string | null;
  experience?: unknown;
  education?: unknown;
  languageSkills?: unknown;
  hourlyRate?: number | null;
  availability?: string | null;
};

type JobLike = {
  title: string;
  location?: string | null;
  province?: string | null;
  requirements?: unknown;
  wishes?: unknown;
  competences?: unknown;
  description?: string | null;
  descriptionSummary?: unknown;
  workArrangement?: string | null;
  contractType?: string | null;
  rateMin?: number | null;
  rateMax?: number | null;
};

type ScraperConfigLike = {
  platform: string;
  lastRunAt: Date | string | null;
};

type ScrapeResultLike = {
  platform: string;
  runAt: Date | string | null;
  status: string;
  errors?: string[];
};

export type PipelineHealthInput = {
  activeScrapers: ScraperConfigLike[];
  recentScrapes: ScrapeResultLike[];
  jobsMissingSummary: number;
  jobsMissingEmbedding: number;
  candidatesMissingEmbedding: number;
  matchesMissingStructuredReview: number;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const value =
          typeof record.description === "string"
            ? record.description
            : typeof record.name === "string"
              ? record.name
              : typeof record.title === "string"
                ? record.title
                : null;
        return value?.trim() ?? "";
      }
      return "";
    })
    .filter(Boolean);
}

function getStructuredHardSkills(candidate: CandidateLike): string[] {
  const structured = candidate.skillsStructured;
  if (!structured || typeof structured !== "object" || Array.isArray(structured)) return [];

  const parsed = structuredSkillsSchema.safeParse({
    hard: (structured as Record<string, unknown>).hard ?? [],
    soft: (structured as Record<string, unknown>).soft ?? [],
  });

  if (!parsed.success) return [];
  return parsed.data.hard.map((skill) => skill.name.trim()).filter(Boolean);
}

function getYearsOfExperience(candidate: CandidateLike): number | null {
  const structured = candidate.skillsStructured;
  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    const years = (structured as Record<string, unknown>).totalYearsExperience;
    if (typeof years === "number" && Number.isFinite(years)) return years;
  }

  const experienceEntries = Array.isArray(candidate.experience) ? candidate.experience : [];
  if (experienceEntries.length === 0) return null;
  return experienceEntries.length >= 6 ? 8 : experienceEntries.length >= 4 ? 5 : 2;
}

function inferSeniorityLabel(candidate: CandidateLike): { label: string; tone: RecruiterScoreTone } {
  const years = getYearsOfExperience(candidate);
  const role = normalizeText(candidate.role ?? "");

  if (years != null) {
    if (years >= 8) return { label: `Senior (${years}+ jaar)`, tone: "goed" };
    if (years >= 4) return { label: `Medior (${years}+ jaar)`, tone: "let-op" };
    if (years >= 1) return { label: `Junior (${years}+ jaar)`, tone: "actie" };
  }

  if (/(senior|lead|principal)/.test(role)) return { label: "Senior", tone: "goed" };
  if (/(medior|consultant|specialist)/.test(role)) return { label: "Medior", tone: "let-op" };
  if (role) return { label: "Junior/Onbekend", tone: "actie" };
  return { label: "Onbekend", tone: "actie" };
}

function extractCanonicalSkillKey(skill: CanonicalSkillLike): string | null {
  const candidates = [
    skill.uri,
    skill.escoUri,
    skill.skillUri,
    skill.id,
    skill.skillId,
    skill.code,
    skill.name,
    skill.label,
    skill.preferredLabel,
    skill.skillName,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return normalizeText(value);
  }

  return null;
}

function extractCanonicalSkillLabel(skill: CanonicalSkillLike): string | null {
  const candidates = [skill.preferredLabel, skill.label, skill.name, skill.skillName, skill.uri];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getCanonicalSkillOverlap(
  candidateSkills: CanonicalSkillLike[] = [],
  jobSkills: CanonicalSkillLike[] = [],
) {
  const candidateMap = new Map<string, string>();
  for (const skill of candidateSkills) {
    const key = extractCanonicalSkillKey(skill);
    const label = extractCanonicalSkillLabel(skill);
    if (key && label) candidateMap.set(key, label);
  }

  const sharedLabels: string[] = [];
  for (const skill of jobSkills) {
    const key = extractCanonicalSkillKey(skill);
    if (key && candidateMap.has(key)) {
      sharedLabels.push(candidateMap.get(key) ?? key);
    }
  }

  const uniqueSharedLabels = Array.from(new Set(sharedLabels));

  return {
    sharedLabels: uniqueSharedLabels.slice(0, 6),
    sharedCount: uniqueSharedLabels.length,
  };
}

function getRawSkillOverlap(candidate: CandidateLike, job: JobLike) {
  const candidateSkills = [
    ...parseStringArray(candidate.skills),
    ...getStructuredHardSkills(candidate),
  ].map(normalizeText);
  const jobSkills = [
    ...parseStringArray(job.requirements),
    ...parseStringArray(job.wishes),
    ...parseStringArray(job.competences),
  ].map(normalizeText);

  const shared = Array.from(new Set(candidateSkills)).filter(
    (candidateSkill) =>
      candidateSkill.length > 1 &&
      jobSkills.some(
        (jobSkill) =>
          jobSkill.includes(candidateSkill) || candidateSkill.includes(jobSkill),
      ),
  );

  return {
    sharedSkills: shared
      .slice(0, 6)
      .map((value) => value.replace(/\b\w/g, (char) => char.toUpperCase())),
    sharedCount: shared.length,
  };
}

function getCommercialBlockers(candidate: CandidateLike, job: JobLike): string[] {
  const blockers: string[] = [];

  if (
    typeof candidate.hourlyRate === "number" &&
    typeof job.rateMax === "number" &&
    candidate.hourlyRate > job.rateMax
  ) {
    blockers.push(`Tarief kandidaat (${candidate.hourlyRate}) ligt boven max (${job.rateMax})`);
  }

  const candidateRegion = normalizeText(candidate.province ?? candidate.location ?? "");
  const jobRegion = normalizeText(job.province ?? job.location ?? "");
  if (candidateRegion && jobRegion && candidateRegion !== jobRegion) {
    blockers.push(
      `Locatie wijkt af (${candidate.location ?? candidate.province} vs ${job.location ?? job.province})`,
    );
  }

  if (candidate.availability === "3_maanden") {
    blockers.push("Beschikbaarheid is pas over 3 maanden");
  } else if (candidate.availability === "1_maand") {
    blockers.push("Beschikbaarheid vraagt circa 1 maand lead time");
  }

  return blockers;
}

function parseCriteria(criteriaBreakdown: unknown): MatchCriterionLike[] {
  if (!Array.isArray(criteriaBreakdown)) return [];

  return criteriaBreakdown.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const criterion = (item as Record<string, unknown>).criterion;
    const tier = (item as Record<string, unknown>).tier;
    const passed = (item as Record<string, unknown>).passed;

    if (typeof criterion !== "string" || typeof tier !== "string") return [];

    return [
      {
        criterion,
        tier,
        passed: typeof passed === "boolean" ? passed : null,
      },
    ];
  });
}

function mapRecommendation(
  match: MatchLike,
  blockers: string[],
  missingMustHaves: string[],
): { label: RecruiterRecommendationLabel; reason: string } {
  const recommendation = normalizeText(match.recommendation ?? "");

  if (recommendation === "go") {
    return { label: "Go", reason: "De bestaande structured match adviseert doorgaan." };
  }

  if (recommendation === "no go" || recommendation === "no-go") {
    return { label: "No-go", reason: "De bestaande structured match adviseert niet doorgaan." };
  }

  if (recommendation === "conditional") {
    return { label: "Twijfel", reason: "De structured match geeft een voorwaardelijk advies." };
  }

  if (missingMustHaves.length >= 2 || blockers.length >= 2 || match.matchScore < 45) {
    return {
      label: "No-go",
      reason: "Te veel harde gaten of commerciële blokkades voor directe opvolging.",
    };
  }

  if (missingMustHaves.length > 0 || blockers.length > 0 || match.matchScore < 70) {
    return {
      label: "Twijfel",
      reason: "De match heeft potentie, maar vraagt recruiterbeoordeling of verrijking.",
    };
  }

  return {
    label: "Go",
    reason: "De match heeft voldoende inhoudelijke en commerciële fit voor een volgende stap.",
  };
}

export function buildMatchBrief(input: {
  match: MatchLike;
  candidate: CandidateLike;
  job: JobLike;
  candidateCanonicalSkills?: CanonicalSkillLike[];
  jobCanonicalSkills?: CanonicalSkillLike[];
}): MatchBrief {
  const criteria = parseCriteria(input.match.criteriaBreakdown);
  const mustHavesMet = criteria
    .filter((criterion) => criterion.tier === "knockout" && criterion.passed === true)
    .map((criterion) => criterion.criterion);
  const mustHavesMissing = criteria
    .filter((criterion) => criterion.tier === "knockout" && criterion.passed === false)
    .map((criterion) => criterion.criterion);

  const escoOverlap = getCanonicalSkillOverlap(
    input.candidateCanonicalSkills,
    input.jobCanonicalSkills,
  );
  const rawSkillOverlap = getRawSkillOverlap(input.candidate, input.job);
  const commercialBlockers = getCommercialBlockers(input.candidate, input.job);
  const recommendation = mapRecommendation(input.match, commercialBlockers, mustHavesMissing);

  const whyThisMatchExists = [
    input.match.reasoning,
    escoOverlap.sharedCount > 0 ? `${escoOverlap.sharedCount} gedeelde ESCO-skills` : null,
    rawSkillOverlap.sharedCount > 0
      ? `${rawSkillOverlap.sharedCount} directe skill-overeenkomsten`
      : null,
    input.match.matchScore >= 75 ? "Sterke initiële matchscore" : null,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const summary =
    whyThisMatchExists[0] ??
    `${recommendation.label} op basis van ${Math.round(input.match.matchScore)}% matchscore en recruiter-fit.`;

  return {
    summary,
    whyThisMatchExists,
    mustHavesMet,
    mustHavesMissing,
    escoOverlap,
    rawSkillOverlap,
    commercialBlockers,
    recommendation: {
      label: recommendation.label,
      confidence: input.match.recommendationConfidence ?? null,
      reason: recommendation.reason,
    },
  };
}

export function buildCandidateIntakeScorecard(input: {
  candidate: CandidateLike;
  candidateCanonicalSkills?: CanonicalSkillLike[];
}): CandidateIntakeScorecard {
  const { candidate } = input;
  const hardSkills = getStructuredHardSkills(candidate);
  const flatSkills = parseStringArray(candidate.skills);
  const experienceEntries = Array.isArray(candidate.experience) ? candidate.experience.length : 0;
  const educationEntries = Array.isArray(candidate.education) ? candidate.education.length : 0;
  const languageEntries = Array.isArray(candidate.languageSkills) ? candidate.languageSkills.length : 0;
  const hasResume = Boolean(candidate.resumeUrl || candidate.resumeRaw);

  const completenessItems: ScorecardChip[] = [
    {
      label: "Rol",
      value: candidate.role ? "Aanwezig" : "Ontbreekt",
      tone: candidate.role ? "goed" : "actie",
    },
    {
      label: "Locatie",
      value: candidate.location || candidate.province ? "Aanwezig" : "Ontbreekt",
      tone: candidate.location || candidate.province ? "goed" : "actie",
    },
    {
      label: "CV",
      value: hasResume ? "Aanwezig" : "Ontbreekt",
      tone: hasResume ? "goed" : "actie",
    },
    {
      label: "Skills",
      value: hardSkills.length > 0 ? `${hardSkills.length} gestructureerd` : `${flatSkills.length} basis`,
      tone: hardSkills.length >= 3 ? "goed" : flatSkills.length > 0 ? "let-op" : "actie",
    },
    {
      label: "Ervaring",
      value: experienceEntries > 0 ? `${experienceEntries} regels` : "Ontbreekt",
      tone: experienceEntries > 0 ? "goed" : "actie",
    },
    {
      label: "Opleiding/talen",
      value: educationEntries + languageEntries > 0 ? "Aanwezig" : "Beperkt",
      tone: educationEntries + languageEntries > 0 ? "goed" : "let-op",
    },
  ];

  const completenessScore = Math.round(
    (completenessItems.filter((item) => item.tone !== "actie").length /
      completenessItems.length) *
      100,
  );
  const completenessLabel =
    completenessScore >= 80
      ? "Sterk profiel"
      : completenessScore >= 55
        ? "Werkbaar profiel"
        : "Profiel vraagt verrijking";

  const parsedSkillsQuality: ScorecardChip =
    hardSkills.length >= 5
      ? {
          label: "Skillskwaliteit",
          value: `${hardSkills.length} hard skills met bewijs`,
          tone: "goed",
        }
      : hardSkills.length >= 2
        ? {
            label: "Skillskwaliteit",
            value: `${hardSkills.length} hard skills, deels bruikbaar`,
            tone: "let-op",
          }
        : {
            label: "Skillskwaliteit",
            value: "Te weinig gestructureerde skills",
            tone: "actie",
          };

  const canonicalCount = input.candidateCanonicalSkills?.length ?? 0;
  const escoCoverageRatio = hardSkills.length > 0 ? canonicalCount / hardSkills.length : 0;
  const escoCoverage: ScorecardChip =
    canonicalCount >= 3 && escoCoverageRatio >= 0.5
      ? { label: "ESCO-dekking", value: `${canonicalCount} canonieke skills`, tone: "goed" }
      : canonicalCount > 0
        ? { label: "ESCO-dekking", value: `${canonicalCount} canonieke skills`, tone: "let-op" }
        : {
            label: "ESCO-dekking",
            value: "Nog geen canonieke skills",
            tone: "actie",
          };

  const seniority = inferSeniorityLabel(candidate);
  const likelySeniority: ScorecardChip = {
    label: "Senioriteit",
    value: seniority.label,
    tone: seniority.tone,
  };

  let nextAction: CandidateNextAction;
  if (!hasResume || hardSkills.length === 0) {
    nextAction = {
      key: "verrijk",
      label: "Verrijk eerst",
      reason: "CV of skill-structuur is nog te dun voor betrouwbare matching.",
    };
  } else if (completenessScore < 45) {
    nextAction = {
      key: "afwijzen",
      label: "Twijfel / afwijzen",
      reason: "Het profiel mist te veel basisinformatie voor een zinvolle opvolging.",
    };
  } else if (canonicalCount >= 3 && hardSkills.length >= 3) {
    nextAction = {
      key: "auto-match",
      label: "Auto-match klaar",
      reason: "Het profiel heeft genoeg skill- en ESCO-signaal om matching direct te laten renderen.",
    };
  } else {
    nextAction = {
      key: "bel",
      label: "Bel kandidaat",
      reason: "Profiel is werkbaar, maar vraagt menselijke verificatie op context of beschikbaarheid.",
    };
  }

  return {
    summary: `${completenessLabel}. ${nextAction.reason}`,
    completenessScore,
    completenessLabel,
    completenessItems,
    parsedSkillsQuality,
    escoCoverage,
    likelySeniority,
    nextAction,
  };
}

function inferJobSeniority(job: JobLike): ScorecardChip {
  const haystack = normalizeText([job.title, job.description].filter(Boolean).join(" "));
  if (/(senior|lead|architect|principal)/.test(haystack)) {
    return { label: "Senioriteit", value: "Senior", tone: "goed" };
  }
  if (/(medior|consultant|specialist)/.test(haystack)) {
    return { label: "Senioriteit", value: "Medior", tone: "let-op" };
  }
  if (haystack) {
    return { label: "Senioriteit", value: "Junior/algemeen", tone: "actie" };
  }
  return { label: "Senioriteit", value: "Onbekend", tone: "actie" };
}

export function buildVacatureTriageScorecard(input: {
  job: JobLike;
  jobCanonicalSkills?: CanonicalSkillLike[];
}): VacatureTriageScorecard {
  const mustHaves = parseStringArray(input.job.requirements);
  const niceToHaves = parseStringArray(input.job.wishes);
  const seniority = inferJobSeniority(input.job);
  const workConstraints = [
    input.job.workArrangement ? `Werkvorm: ${input.job.workArrangement}` : null,
    input.job.contractType ? `Contract: ${input.job.contractType}` : null,
    input.job.rateMin || input.job.rateMax
      ? `Tarief: ${input.job.rateMin ?? "?"}-${input.job.rateMax ?? "?"}`
      : null,
  ].filter((value): value is string => Boolean(value));

  const readinessNeedsCleanup =
    !input.job.description ||
    mustHaves.length === 0 ||
    !input.job.descriptionSummary ||
    (input.jobCanonicalSkills?.length ?? 0) === 0;

  const readiness: ScorecardChip = readinessNeedsCleanup
    ? {
        label: "Matching readiness",
        value: "Heeft opschoning nodig",
        tone: "actie",
      }
    : {
        label: "Matching readiness",
        value: "Klaar voor matching",
        tone: "goed",
      };

  const difficultyScore =
    (mustHaves.length >= 5 ? 2 : mustHaves.length >= 3 ? 1 : 0) +
    (input.job.workArrangement === "op_locatie" ? 1 : 0) +
    (typeof input.job.rateMax === "number" && input.job.rateMax < 90 ? 1 : 0);

  const sourcingDifficulty: ScorecardChip =
    difficultyScore >= 3
      ? { label: "Sourcing difficulty", value: "Hoog", tone: "actie" }
      : difficultyScore >= 1
        ? { label: "Sourcing difficulty", value: "Gemiddeld", tone: "let-op" }
        : { label: "Sourcing difficulty", value: "Beheersbaar", tone: "goed" };

  return {
    summary:
      readiness.value === "Klaar voor matching"
        ? "Vacature heeft genoeg structuur om recruiters en matching direct te ondersteunen."
        : "Vacature vraagt nog verrijking voordat matchingresultaten volledig betrouwbaar zijn.",
    mustHaveCount: mustHaves.length,
    niceToHaveCount: niceToHaves.length,
    seniority,
    workConstraints,
    sourcingDifficulty,
    readiness,
  };
}

function toDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildPipelineHealthSnapshot(input: PipelineHealthInput): PipelineHealthSnapshot {
  const now = Date.now();
  const stalePlatformCount = input.activeScrapers.filter((scraper) => {
    const lastRunAt = toDate(scraper.lastRunAt);
    if (!lastRunAt) return true;
    return now - lastRunAt.getTime() > 36 * 60 * 60 * 1000;
  }).length;

  const scrapeFailureCount = input.recentScrapes.filter(
    (scrape) => scrape.status === "failed" || (scrape.errors?.length ?? 0) > 0,
  ).length;

  const items: PipelineHealthItem[] = [
    {
      key: "scraper_freshness",
      label: "Bronnen niet vers",
      value: stalePlatformCount,
      tone: stalePlatformCount === 0 ? "goed" : stalePlatformCount <= 2 ? "let-op" : "actie",
      detail:
        stalePlatformCount === 0
          ? "Alle actieve bronnen draaiden recent."
          : `${stalePlatformCount} platformen hebben geen recente run geregistreerd.`,
      href: "/scraper",
    },
    {
      key: "scrape_failures",
      label: "Scrape fouten",
      value: scrapeFailureCount,
      tone: scrapeFailureCount === 0 ? "goed" : scrapeFailureCount <= 2 ? "let-op" : "actie",
      detail:
        scrapeFailureCount === 0
          ? "Geen recente storingen in de bronruns."
          : `${scrapeFailureCount} recente scrape-runs meldden fouten of mislukten.`,
      href: "/scraper",
    },
    {
      key: "jobs_missing_summary",
      label: "Vacatures zonder AI samenvatting",
      value: input.jobsMissingSummary,
      tone:
        input.jobsMissingSummary === 0
          ? "goed"
          : input.jobsMissingSummary <= 10
            ? "let-op"
            : "actie",
      detail:
        input.jobsMissingSummary === 0
          ? "Alle zichtbare vacatures hebben verrijkte samenvatting."
          : `${input.jobsMissingSummary} vacatures missen nog verrijkte samenvatting.`,
      href: "/vacatures",
    },
    {
      key: "jobs_missing_embedding",
      label: "Vacatures zonder embedding",
      value: input.jobsMissingEmbedding,
      tone:
        input.jobsMissingEmbedding === 0
          ? "goed"
          : input.jobsMissingEmbedding <= 10
            ? "let-op"
            : "actie",
      detail:
        input.jobsMissingEmbedding === 0
          ? "Alle zichtbare vacatures zijn semantisch doorzoekbaar."
          : `${input.jobsMissingEmbedding} vacatures missen nog semantische embedding.`,
      href: "/vacatures",
    },
    {
      key: "candidates_missing_embedding",
      label: "Kandidaten zonder embedding",
      value: input.candidatesMissingEmbedding,
      tone:
        input.candidatesMissingEmbedding === 0
          ? "goed"
          : input.candidatesMissingEmbedding <= 10
            ? "let-op"
            : "actie",
      detail:
        input.candidatesMissingEmbedding === 0
          ? "Alle actieve kandidaten hebben een embedding."
          : `${input.candidatesMissingEmbedding} actieve kandidaten missen nog embedding.`,
      href: "/kandidaten",
    },
    {
      key: "matches_missing_structured_review",
      label: "Matches zonder briefing",
      value: input.matchesMissingStructuredReview,
      tone:
        input.matchesMissingStructuredReview === 0
          ? "goed"
          : input.matchesMissingStructuredReview <= 10
            ? "let-op"
            : "actie",
      detail:
        input.matchesMissingStructuredReview === 0
          ? "Alle recente matches hebben structured context."
          : `${input.matchesMissingStructuredReview} matches missen nog structured reviewdata.`,
      href: "/kandidaten",
    },
  ];

  const status = items.some((item) => item.tone === "actie")
    ? "actie"
    : items.some((item) => item.tone === "let-op")
      ? "let-op"
      : "goed";

  const summary =
    status === "goed"
      ? "De matching- en intakepijplijn oogt gezond en actueel."
      : status === "let-op"
        ? "De pijplijn is bruikbaar, maar heeft zichtbare gaten die recruiters moeten meewegen."
        : "De pijplijn vraagt operationele aandacht voordat recruiters volledig op de signalen kunnen vertrouwen.";

  return { status, summary, items };
}
