import { structuredSkillsSchema, type ParsedCV, type StructuredSkill } from "../schemas/candidate-intelligence";
import { listApplications } from "./applications";
import { autoMatchCandidateToJobs, type AutoMatchResult } from "./auto-matching";
import {
  type Candidate,
  type CandidateMatchingStatus,
  createCandidate,
  enrichCandidateFromCV,
  getCandidateById,
  isCandidateMatchingStatus,
  updateCandidateMatchingStatus,
  type CreateCandidateData,
} from "./candidates";

type CandidateStructuredProfileMeta = {
  hard: StructuredSkill[];
  soft: StructuredSkill[];
  totalYearsExperience: number | null;
  highestEducationLevel: string | null;
  industries: string[];
  preferredContractType: string | null;
  preferredWorkArrangement: string | null;
};

export type CandidateIntakeMatch = {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  quickScore: number;
  matchId: string;
  reasoning: string | null;
  recommendation: "go" | "no-go" | "conditional" | null;
  recommendationConfidence: number | null;
  isLinked: boolean;
};

export type CandidateProfile = {
  summary: string | null;
  headline: string | null;
  role: string | null;
  hardSkills: StructuredSkill[];
  softSkills: StructuredSkill[];
  totalYearsExperience: number | null;
  highestEducationLevel: string | null;
  industries: string[];
  preferredContractType: string | null;
  preferredWorkArrangement: string | null;
  experience: Candidate["experience"];
  education: Candidate["education"];
  certifications: Candidate["certifications"];
  languageSkills: Candidate["languageSkills"];
};

export type CandidateMatchReviewResult = {
  candidate: Candidate;
  profile: CandidateProfile;
  matches: CandidateIntakeMatch[];
  recommendation: CandidateIntakeMatch | null;
  matchingStatus: CandidateMatchingStatus;
  alreadyLinked: string[];
};

export type CandidateIntakeInput = {
  existingCandidateId?: string;
  candidate?: Partial<CreateCandidateData>;
  parsed?: ParsedCV;
  resumeRaw?: string;
  fileUrl?: string;
};

function getStructuredProfileMeta(candidate: Candidate): CandidateStructuredProfileMeta {
  const raw = candidate.skillsStructured;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      hard: [],
      soft: [],
      totalYearsExperience: null,
      highestEducationLevel: null,
      industries: [],
      preferredContractType: null,
      preferredWorkArrangement: null,
    };
  }

  const value = raw as Record<string, unknown>;
  const structuredSkills = structuredSkillsSchema.safeParse({
    hard: value.hard ?? [],
    soft: value.soft ?? [],
  });

  return {
    hard: structuredSkills.success ? structuredSkills.data.hard : [],
    soft: structuredSkills.success ? structuredSkills.data.soft : [],
    totalYearsExperience:
      typeof value.totalYearsExperience === "number" ? value.totalYearsExperience : null,
    highestEducationLevel:
      typeof value.highestEducationLevel === "string" ? value.highestEducationLevel : null,
    industries: Array.isArray(value.industries)
      ? value.industries.filter((item): item is string => typeof item === "string")
      : [],
    preferredContractType:
      typeof value.preferredContractType === "string" ? value.preferredContractType : null,
    preferredWorkArrangement:
      typeof value.preferredWorkArrangement === "string" ? value.preferredWorkArrangement : null,
  };
}

function buildCandidateProfile(candidate: Candidate): CandidateProfile {
  const structured = getStructuredProfileMeta(candidate);
  return {
    summary: candidate.profileSummary ?? null,
    headline: candidate.headline ?? null,
    role: candidate.role ?? null,
    hardSkills: structured.hard,
    softSkills: structured.soft,
    totalYearsExperience: structured.totalYearsExperience,
    highestEducationLevel: structured.highestEducationLevel,
    industries: structured.industries,
    preferredContractType: structured.preferredContractType,
    preferredWorkArrangement: structured.preferredWorkArrangement,
    experience: candidate.experience,
    education: candidate.education,
    certifications: candidate.certifications,
    languageSkills: candidate.languageSkills,
  };
}

function getEffectiveScore(match: AutoMatchResult): number {
  return match.judgeVerdict?.adjustedScore ?? match.structuredResult?.overallScore ?? match.quickScore;
}

function getEffectiveRecommendation(match: AutoMatchResult): CandidateIntakeMatch["recommendation"] {
  return match.judgeVerdict?.adjustedRecommendation ?? match.structuredResult?.recommendation ?? null;
}

function selectRecommendation(matches: AutoMatchResult[]): AutoMatchResult | null {
  const byScore = [...matches].sort((left, right) => getEffectiveScore(right) - getEffectiveScore(left));
  return (
    byScore.find((match) => getEffectiveRecommendation(match) === "go") ??
    byScore.find((match) => getEffectiveRecommendation(match) === "conditional") ??
    byScore[0] ??
    null
  );
}

function mapMatch(match: AutoMatchResult, linkedJobIds: Set<string>): CandidateIntakeMatch {
  return {
    jobId: match.jobId,
    jobTitle: match.jobTitle,
    company: match.company,
    location: match.location,
    quickScore: match.quickScore,
    matchId: match.matchId,
    reasoning: match.judgeVerdict?.reasoning ?? match.structuredResult?.recommendationReasoning ?? null,
    recommendation: getEffectiveRecommendation(match),
    recommendationConfidence:
      match.structuredResult?.recommendationConfidence ?? match.judgeVerdict?.confidence ?? null,
    isLinked: linkedJobIds.has(match.jobId),
  };
}

function buildCreateCandidateData(input: CandidateIntakeInput): CreateCandidateData {
  const { candidate, parsed } = input;
  const name = candidate?.name ?? parsed?.name;
  const parsedSkills = parsed
    ? [...parsed.skills.hard, ...parsed.skills.soft].map((skill) => skill.name)
    : undefined;

  if (!name) {
    throw new Error("Naam is verplicht voor intake");
  }

  return {
    name,
    email: candidate?.email ?? parsed?.email ?? undefined,
    phone: candidate?.phone ?? parsed?.phone ?? undefined,
    role: candidate?.role ?? parsed?.role,
    skills: candidate?.skills ?? parsedSkills,
    location: candidate?.location ?? parsed?.location ?? undefined,
    source: candidate?.source ?? (parsed ? "cv-upload" : "manual-intake"),
    linkedinUrl: candidate?.linkedinUrl,
    headline: candidate?.headline,
    profileSummary: candidate?.profileSummary ?? parsed?.introduction,
    hourlyRate: candidate?.hourlyRate,
    availability: candidate?.availability,
    notes: candidate?.notes,
    experience: candidate?.experience,
    education: candidate?.education,
  };
}

export async function reviewCandidateMatches(
  candidateId: string,
  options: {
    topN?: number;
    matchingStatus?: CandidateMatchingStatus;
  } = {},
): Promise<CandidateMatchReviewResult> {
  const now = new Date();
  const matches = await autoMatchCandidateToJobs(candidateId, options.topN ?? 5);
  const [existingApplications, updatedCandidate] = await Promise.all([
    listApplications({ candidateId }),
    updateCandidateMatchingStatus(candidateId, options.matchingStatus ?? "open", {
      lastMatchedAt: now,
      matchingStatusUpdatedAt: now,
    }),
  ]);

  const candidate = updatedCandidate ?? (await getCandidateById(candidateId));
  if (!candidate) {
    throw new Error("Kandidaat niet gevonden");
  }

  const alreadyLinked = existingApplications
    .map((application) => application.jobId)
    .filter((jobId): jobId is string => jobId != null);
  const linkedJobIds = new Set(alreadyLinked);
  const recommendation = selectRecommendation(matches);
  const matchingStatus = isCandidateMatchingStatus(candidate.matchingStatus)
    ? candidate.matchingStatus
    : "open";

  return {
    candidate,
    profile: buildCandidateProfile(candidate),
    matches: matches.map((match) => mapMatch(match, linkedJobIds)),
    recommendation: recommendation ? mapMatch(recommendation, linkedJobIds) : null,
    matchingStatus,
    alreadyLinked,
  };
}

export async function intakeCandidate(input: CandidateIntakeInput): Promise<CandidateMatchReviewResult> {
  let candidate = input.existingCandidateId ? await getCandidateById(input.existingCandidateId) : null;

  if (input.existingCandidateId && !candidate) {
    throw new Error("Kandidaat niet gevonden");
  }

  if (!candidate) {
    candidate = await createCandidate(buildCreateCandidateData(input));
  }

  if (input.parsed) {
    candidate = await enrichCandidateFromCV(
      candidate.id,
      input.parsed,
      input.resumeRaw ?? "",
      input.fileUrl,
    );
    if (!candidate) {
      throw new Error("Kandidaat niet gevonden");
    }
  }

  return reviewCandidateMatches(candidate.id, { topN: 5, matchingStatus: "open" });
}