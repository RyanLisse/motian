type SkillSeedSource =
  | "candidate.skills"
  | "candidate.skillsStructured.hard"
  | "candidate.skillsStructured.soft"
  | "job.requirements"
  | "job.wishes"
  | "job.competences";

type ConfidenceHint = "legacy-flat" | "structured" | "requirement" | "wish" | "competence";

export type SkillSeed = {
  rawSkill: string;
  source: SkillSeedSource;
  confidenceHint: ConfidenceHint;
  critical: boolean;
  evidence?: string;
};

type StructuredSkill = {
  name?: string;
  evidence?: string;
};

type CandidateSkillSource = {
  skills?: unknown;
  skillsStructured?: {
    hard?: StructuredSkill[];
    soft?: StructuredSkill[];
  } | null;
};

type RequirementLike =
  | string
  | {
      description?: string;
      isKnockout?: boolean;
    };

type WishLike =
  | string
  | {
      description?: string;
    };

type JobSkillSource = {
  requirements?: RequirementLike[] | null;
  wishes?: WishLike[] | null;
  competences?: string[] | null;
};

function normalizeSkillName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function upsertSeed(seeds: SkillSeed[], nextSeed: SkillSeed): SkillSeed[] {
  const normalizedName = nextSeed.rawSkill.toLocaleLowerCase("nl-NL");
  const existingIndex = seeds.findIndex(
    (seed) => seed.rawSkill.toLocaleLowerCase("nl-NL") === normalizedName,
  );

  if (existingIndex === -1) {
    seeds.push(nextSeed);
    return seeds;
  }

  const existing = seeds[existingIndex];
  const nextHasEvidence = Boolean(nextSeed.evidence?.trim());
  const existingHasEvidence = Boolean(existing.evidence?.trim());

  if (nextHasEvidence && !existingHasEvidence) {
    seeds[existingIndex] = nextSeed;
  }

  return seeds;
}

export function extractCandidateSkillSeeds(candidate: CandidateSkillSource): SkillSeed[] {
  const seeds: SkillSeed[] = [];

  if (Array.isArray(candidate.skills)) {
    for (const skill of candidate.skills) {
      if (typeof skill !== "string") continue;

      const rawSkill = normalizeSkillName(skill);
      if (!rawSkill) continue;

      upsertSeed(seeds, {
        rawSkill,
        source: "candidate.skills",
        confidenceHint: "legacy-flat",
        critical: false,
      });
    }
  }

  const structuredGroups = [
    {
      skills: candidate.skillsStructured?.hard ?? [],
      source: "candidate.skillsStructured.hard" as const,
    },
    {
      skills: candidate.skillsStructured?.soft ?? [],
      source: "candidate.skillsStructured.soft" as const,
    },
  ];

  for (const group of structuredGroups) {
    for (const skill of group.skills) {
      if (typeof skill?.name !== "string") continue;

      const rawSkill = normalizeSkillName(skill.name);
      if (!rawSkill) continue;

      upsertSeed(seeds, {
        rawSkill,
        source: group.source,
        confidenceHint: "structured",
        critical: false,
        evidence: skill.evidence ? normalizeSkillName(skill.evidence) : undefined,
      });
    }
  }

  return seeds;
}

export function extractJobSkillSeeds(job: JobSkillSource): SkillSeed[] {
  const seeds: SkillSeed[] = [];

  for (const requirement of job.requirements ?? []) {
    const rawSkill =
      typeof requirement === "string"
        ? normalizeSkillName(requirement)
        : normalizeSkillName(requirement.description ?? "");
    if (!rawSkill) continue;

    upsertSeed(seeds, {
      rawSkill,
      source: "job.requirements",
      confidenceHint: "requirement",
      critical: typeof requirement === "string" ? false : Boolean(requirement.isKnockout),
    });
  }

  for (const wish of job.wishes ?? []) {
    const rawSkill =
      typeof wish === "string"
        ? normalizeSkillName(wish)
        : normalizeSkillName(wish.description ?? "");
    if (!rawSkill) continue;

    upsertSeed(seeds, {
      rawSkill,
      source: "job.wishes",
      confidenceHint: "wish",
      critical: false,
    });
  }

  for (const competence of job.competences ?? []) {
    const rawSkill = normalizeSkillName(competence);
    if (!rawSkill) continue;

    upsertSeed(seeds, {
      rawSkill,
      source: "job.competences",
      confidenceHint: "competence",
      critical: false,
    });
  }

  return seeds;
}
