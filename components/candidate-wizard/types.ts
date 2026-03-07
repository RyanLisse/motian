import type { CriterionResult } from "@/src/schemas/matching";

export type IntakeMode = "manual" | "cv";

export type MatchRecommendation = "go" | "no-go" | "conditional";

export type RecommendationSource = "backend" | "score" | null;

export interface CandidateSkillPreview {
  name: string;
  proficiency: number;
  evidence: string;
}

export interface CandidateExperiencePreview {
  title: string;
  company: string;
  duration: string;
}

export interface CandidateProfilePreview {
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  availability: string | null;
  hourlyRate: number | null;
  linkedinUrl: string | null;
  headline: string | null;
  notes: string | null;
  totalYearsExperience: number | null;
  highestEducationLevel: string | null;
  hardSkills: CandidateSkillPreview[];
  softSkills: CandidateSkillPreview[];
  experience: CandidateExperiencePreview[];
  languages: string[];
  certifications: string[];
  industries: string[];
  source: IntakeMode | "hybrid";
}

export interface MatchSuggestionItem {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  quickScore: number;
  matchId: string;
  reasoning: string | null;
  isLinked?: boolean;
  recommendation?: MatchRecommendation | null;
  recommendationConfidence?: number | null;
  isRecommended?: boolean;
  recommendationSource?: RecommendationSource;
  criteriaBreakdown?: CriterionResult[];
  riskProfile?: string[];
  enrichmentSuggestions?: string[];
  assessmentModel?: string | null;
  status?: string | null;
  reviewedAt?: string | null;
}

export interface WizardIntakeResult {
  candidateId: string;
  candidateName: string;
  profile: CandidateProfilePreview;
  matches: MatchSuggestionItem[];
  recommendedMatchId: string | null;
  intakeMode: IntakeMode;
}

export interface ManualJobSuggestion {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform?: string | null;
}