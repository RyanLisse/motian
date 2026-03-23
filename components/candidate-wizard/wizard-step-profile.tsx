"use client";

import { FileUp, Loader2, Sparkles, WandSparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedCV } from "@/src/schemas/candidate-intelligence";
import type { ExperienceEntry } from "./experience-input";
import { ExperienceInput } from "./experience-input";
import { SkillsInput } from "./skills-input";
import type {
  CandidateExperiencePreview,
  CandidateProfilePreview,
  CandidateSkillPreview,
  IntakeMode,
  MatchRecommendation,
  MatchSuggestionItem,
  RecommendationSource,
  WizardIntakeResult,
} from "./types";

const ALLOWED_CV_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_CV_SIZE_MB = 20;

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

type UploadPreview = {
  parsed: ParsedCV;
  fileUrl: string;
  duplicates?: {
    exact?: unknown[];
    similar?: unknown[];
  };
};

export interface ProfileFormData {
  name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  hourlyRate: string;
  availability: string;
  linkedinUrl: string;
  notes: string;
  skills: string[];
  experience: ExperienceEntry[];
}

const defaultFormData: ProfileFormData = {
  name: "",
  role: "",
  email: "",
  phone: "",
  location: "",
  hourlyRate: "",
  availability: "",
  linkedinUrl: "",
  notes: "",
  skills: [],
  experience: [],
};

interface WizardStepProfileProps {
  onSubmit: (result: WizardIntakeResult) => void;
  onCancel: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toUniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function normalizeSkillList(value: unknown): CandidateSkillPreview[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = asString(item.name);
      if (!name) return null;

      return {
        name,
        proficiency: Math.min(5, Math.max(1, asNumber(item.proficiency) ?? 3)),
        evidence: asString(item.evidence) ?? "Geen expliciet bewijs beschikbaar",
      } satisfies CandidateSkillPreview;
    })
    .filter((item): item is CandidateSkillPreview => item !== null);
}

function normalizeExperienceList(value: unknown): CandidateExperiencePreview[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const title = asString(item.title) ?? "Onbekende rol";
      const company = asString(item.company) ?? "Onbekende organisatie";
      const duration =
        asString(item.duration) ??
        (isRecord(item.period)
          ? [asString(item.period.start), asString(item.period.end)].filter(Boolean).join(" – ")
          : null) ??
        "Periode onbekend";

      return { title, company, duration } satisfies CandidateExperiencePreview;
    })
    .filter((item): item is CandidateExperiencePreview => item !== null);
}

function normalizeProfilePreview(
  candidateData: Record<string, unknown> | null,
  formData: ProfileFormData,
  parsedCv: ParsedCV | null,
  intakeMode: IntakeMode,
): CandidateProfilePreview {
  const structuredSkills = isRecord(candidateData?.skillsStructured)
    ? candidateData.skillsStructured
    : parsedCv?.skills;

  const hardSkills = normalizeSkillList(
    isRecord(structuredSkills) ? structuredSkills.hard : parsedCv?.skills.hard,
  );
  const softSkills = normalizeSkillList(
    isRecord(structuredSkills) ? structuredSkills.soft : parsedCv?.skills.soft,
  );
  const languages = Array.isArray(candidateData?.languageSkills)
    ? candidateData.languageSkills
        .map((item) => {
          if (!isRecord(item)) return null;
          const language = asString(item.language);
          const level = asString(item.level);
          if (!language || !level) return language;
          return `${language} (${level})`;
        })
        .filter((item): item is string => Boolean(item))
    : (parsedCv?.languages.map((item) => `${item.language} (${item.level})`).filter(Boolean) ?? []);

  return {
    name:
      asString(candidateData?.name) ?? formData.name.trim() ?? parsedCv?.name ?? "Naam onbekend",
    role: asString(candidateData?.role) ?? formData.role.trim() ?? parsedCv?.role ?? "Rol onbekend",
    email: asString(candidateData?.email) ?? asString(formData.email) ?? parsedCv?.email ?? null,
    phone: asString(candidateData?.phone) ?? asString(formData.phone) ?? parsedCv?.phone ?? null,
    location:
      asString(candidateData?.location) ??
      asString(formData.location) ??
      parsedCv?.location ??
      null,
    availability: asString(candidateData?.availability) ?? asString(formData.availability) ?? null,
    hourlyRate:
      asNumber(candidateData?.hourlyRate) ??
      (formData.hourlyRate ? Number.parseInt(formData.hourlyRate, 10) : null),
    linkedinUrl: asString(candidateData?.linkedinUrl) ?? asString(formData.linkedinUrl) ?? null,
    headline:
      asString(candidateData?.profileSummary) ??
      asString(candidateData?.headline) ??
      asString(formData.notes) ??
      parsedCv?.introduction ??
      null,
    notes: asString(candidateData?.notes) ?? asString(formData.notes) ?? null,
    totalYearsExperience:
      asNumber(candidateData?.totalYearsExperience) ?? parsedCv?.totalYearsExperience ?? null,
    highestEducationLevel:
      asString(candidateData?.highestEducationLevel) ?? parsedCv?.highestEducationLevel ?? null,
    hardSkills,
    softSkills,
    experience:
      normalizeExperienceList(candidateData?.experience) ||
      normalizeExperienceList(parsedCv?.experience) ||
      normalizeExperienceList(formData.experience),
    languages,
    certifications: Array.isArray(candidateData?.certifications)
      ? candidateData.certifications.filter((item): item is string => typeof item === "string")
      : (parsedCv?.certifications ?? []),
    industries: Array.isArray(candidateData?.industries)
      ? candidateData.industries.filter((item): item is string => typeof item === "string")
      : (parsedCv?.industries ?? []),
    source: parsedCv && intakeMode === "manual" ? "hybrid" : intakeMode,
  };
}

function normalizeMatchSuggestions(
  value: unknown,
  linkedJobIds: string[] = [],
): MatchSuggestionItem[] {
  if (!Array.isArray(value)) return [];

  const linkedSet = new Set(linkedJobIds);
  const matches = value
    .map<MatchSuggestionItem | null>((item) => {
      if (!isRecord(item)) return null;

      const jobId = asString(item.jobId);
      if (!jobId) return null;

      const structuredResult = isRecord(item.structuredResult) ? item.structuredResult : null;
      const recommendationRaw =
        asString(item.recommendation) ??
        asString(structuredResult?.recommendation) ??
        (item.isRecommended === true ? "go" : null);
      const recommendation =
        recommendationRaw === "go" ||
        recommendationRaw === "no-go" ||
        recommendationRaw === "conditional"
          ? (recommendationRaw as MatchRecommendation)
          : null;
      const recommendationSource: RecommendationSource =
        item.isRecommended === true || recommendation !== null ? "backend" : null;
      const criteriaBreakdown = Array.isArray(item.criteriaBreakdown)
        ? item.criteriaBreakdown
        : Array.isArray(structuredResult?.criteriaBreakdown)
          ? structuredResult.criteriaBreakdown
          : undefined;

      return {
        jobId,
        jobTitle: asString(item.jobTitle) ?? "Onbekende opdracht",
        company: asString(item.company),
        location: asString(item.location),
        quickScore: asNumber(item.quickScore) ?? asNumber(item.matchScore) ?? 0,
        matchId: asString(item.matchId) ?? jobId,
        reasoning:
          asString(item.reasoning) ?? asString(structuredResult?.recommendationReasoning) ?? null,
        isLinked: linkedSet.has(jobId),
        recommendation,
        recommendationConfidence:
          asNumber(item.recommendationConfidence) ??
          asNumber(structuredResult?.recommendationConfidence),
        isRecommended: item.isRecommended === true || recommendation === "go",
        recommendationSource,
        criteriaBreakdown,
        riskProfile: Array.isArray(item.riskProfile)
          ? item.riskProfile.filter((risk): risk is string => typeof risk === "string")
          : Array.isArray(structuredResult?.riskProfile)
            ? structuredResult.riskProfile.filter(
                (risk): risk is string => typeof risk === "string",
              )
            : undefined,
        enrichmentSuggestions: Array.isArray(item.enrichmentSuggestions)
          ? item.enrichmentSuggestions.filter((risk): risk is string => typeof risk === "string")
          : Array.isArray(structuredResult?.enrichmentSuggestions)
            ? structuredResult.enrichmentSuggestions.filter(
                (risk): risk is string => typeof risk === "string",
              )
            : undefined,
        assessmentModel: asString(item.assessmentModel),
        status: asString(item.status),
        reviewedAt: asString(item.reviewedAt),
      };
    })
    .filter((item): item is MatchSuggestionItem => item !== null)
    .sort((left, right) => right.quickScore - left.quickScore);

  const explicitRecommendation = matches.find((match) => match.isRecommended && !match.isLinked);
  const fallbackRecommendation =
    explicitRecommendation ?? matches.find((match) => !match.isLinked) ?? null;

  return matches.map((match) => ({
    ...match,
    isRecommended: fallbackRecommendation
      ? match.matchId === fallbackRecommendation.matchId
      : false,
    recommendationSource:
      fallbackRecommendation && match.matchId === fallbackRecommendation.matchId
        ? (match.recommendationSource ?? "score")
        : null,
  }));
}

function buildManualPayload(formData: ProfileFormData, source: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: formData.name.trim(),
    role: formData.role.trim() || undefined,
    source,
  };

  if (formData.email.trim()) payload.email = formData.email.trim();
  if (formData.phone.trim()) payload.phone = formData.phone.trim();
  if (formData.location.trim()) payload.location = formData.location.trim();
  if (formData.hourlyRate.trim()) payload.hourlyRate = Number.parseInt(formData.hourlyRate, 10);
  if (formData.availability) payload.availability = formData.availability;
  if (formData.linkedinUrl.trim()) payload.linkedinUrl = formData.linkedinUrl.trim();
  if (formData.notes.trim()) payload.notes = formData.notes.trim();
  if (formData.skills.length) payload.skills = formData.skills;
  if (formData.experience.length) {
    payload.experience = formData.experience.filter(
      (entry) => entry.title.trim() || entry.company.trim() || entry.duration.trim(),
    );
  }

  return payload;
}

function buildPatchPayload(
  formData: ProfileFormData,
  intakeMode: IntakeMode,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    source: intakeMode === "cv" ? "cv" : "manual",
  };

  if (formData.name.trim()) payload.name = formData.name.trim();
  if (formData.role.trim()) payload.role = formData.role.trim();
  if (formData.email.trim()) payload.email = formData.email.trim();
  if (formData.phone.trim()) payload.phone = formData.phone.trim();
  if (formData.location.trim()) payload.location = formData.location.trim();
  if (formData.hourlyRate.trim()) payload.hourlyRate = Number.parseInt(formData.hourlyRate, 10);
  if (formData.availability) payload.availability = formData.availability;
  if (formData.linkedinUrl.trim()) payload.linkedinUrl = formData.linkedinUrl.trim();
  if (formData.notes.trim()) payload.notes = formData.notes.trim();
  if (formData.skills.length) payload.skills = formData.skills;

  return payload;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(body) ? asString(body.error) : null;
    throw new Error(message ?? `Fout: ${response.status}`);
  }
  return body;
}

function renderSkillList(title: string, skills: CandidateSkillPreview[], accentClass: string) {
  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        {title}: geen signalen gevonden
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {skills.slice(0, 4).map((skill) => (
          <div key={skill.name} className="rounded-lg border border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{skill.name}</span>
              <span className={`text-xs font-medium ${accentClass}`}>{skill.proficiency}/5</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{skill.evidence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WizardStepProfile({ onSubmit, onCancel }: WizardStepProfileProps) {
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("manual");
  const [formData, setFormData] = useState<ProfileFormData>(defaultFormData);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exactDuplicateCount = Array.isArray(uploadPreview?.duplicates?.exact)
    ? uploadPreview.duplicates.exact.length
    : 0;
  const similarDuplicateCount = Array.isArray(uploadPreview?.duplicates?.similar)
    ? uploadPreview.duplicates.similar.length
    : 0;

  const applyParsedDataToForm = (parsed: ParsedCV) => {
    setFormData((previous) => ({
      ...previous,
      name: previous.name || parsed.name,
      role: previous.role || parsed.role,
      email: previous.email || parsed.email || "",
      phone: previous.phone || parsed.phone || "",
      location: previous.location || parsed.location || "",
      notes: previous.notes || parsed.introduction || "",
      skills: toUniqueStrings([
        ...previous.skills,
        ...parsed.skills.hard.map((skill) => skill.name),
        ...parsed.skills.soft.map((skill) => skill.name),
      ]),
      experience:
        previous.experience.length > 0
          ? previous.experience
          : parsed.experience.map((entry) => ({
              title: entry.title,
              company: entry.company,
              duration: `${entry.period.start} – ${entry.period.end}`,
            })),
    }));
  };

  const parseCvFile = async (file: File) => {
    setParsing(true);
    setError("");
    try {
      const cvFormData = new FormData();
      cvFormData.append("cv", file);
      const body = (await fetchJson("/api/cv-upload", {
        method: "POST",
        body: cvFormData,
      })) as Record<string, unknown>;

      const parsed = body.parsed as ParsedCV | undefined;
      const fileUrl = asString(body.fileUrl);

      if (!parsed || !fileUrl) {
        throw new Error("CV-analyse leverde geen bruikbaar profiel op.");
      }

      setUploadPreview({
        parsed,
        fileUrl,
        duplicates: isRecord(body.duplicates)
          ? {
              exact: Array.isArray(body.duplicates.exact) ? body.duplicates.exact : [],
              similar: Array.isArray(body.duplicates.similar) ? body.duplicates.similar : [],
            }
          : undefined,
      });
      applyParsedDataToForm(parsed);
    } catch (err) {
      setUploadPreview(null);
      setError(err instanceof Error ? err.message : "CV-analyse mislukt.");
    } finally {
      setParsing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_CV_TYPES.includes(file.type)) {
      setError("Alleen PDF en Word (.docx) zijn toegestaan.");
      return;
    }
    if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
      setError(`Maximaal ${MAX_CV_SIZE_MB}MB.`);
      return;
    }

    setCvFile(file);
    void parseCvFile(file);
  };

  const fetchCandidateMatches = async (
    candidateId: string,
    forceFresh = false,
  ): Promise<MatchSuggestionItem[]> => {
    if (!forceFresh) {
      try {
        const persisted = await fetchJson(`/api/candidates/${candidateId}/matches`);
        if (Array.isArray(persisted)) {
          const normalized = normalizeMatchSuggestions(persisted);
          if (normalized.length > 0) return normalized;
        }

        if (isRecord(persisted) && Array.isArray(persisted.matches)) {
          const normalized = normalizeMatchSuggestions(persisted.matches);
          if (normalized.length > 0) return normalized;
        }
      } catch {
        // Fall back to the existing POST match route below.
      }
    }

    const generated = (await fetchJson(`/api/kandidaten/${candidateId}/match`, {
      method: "POST",
    })) as Record<string, unknown>;

    return normalizeMatchSuggestions(
      Array.isArray(generated.matches) ? generated.matches : [],
      Array.isArray(generated.alreadyLinked)
        ? generated.alreadyLinked.filter((item): item is string => typeof item === "string")
        : [],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveName = formData.name.trim() || uploadPreview?.parsed.name || "";
    const effectiveRole = formData.role.trim() || uploadPreview?.parsed.role || "";

    if (!effectiveName) {
      setError("Naam is verplicht.");
      return;
    }
    if (!effectiveRole) {
      setError("Rol is verplicht.");
      return;
    }
    if (intakeMode === "cv" && !uploadPreview) {
      setError("Upload eerst een CV om de intake te starten.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let candidateId = "";

      if (intakeMode === "cv" && uploadPreview) {
        setLoadingMessage("CV-profiel opslaan...");
        const saveBody = (await fetchJson("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parsed: uploadPreview.parsed,
            fileUrl: uploadPreview.fileUrl,
          }),
        })) as Record<string, unknown>;

        candidateId =
          asString(saveBody.candidateId) ??
          (isRecord(saveBody.candidate) ? asString(saveBody.candidate.id) : null) ??
          "";
      } else {
        setLoadingMessage("Kandidaat aanmaken...");
        const createBody = (await fetchJson("/api/kandidaten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildManualPayload(formData, uploadPreview ? "hybrid" : "manual")),
        })) as Record<string, unknown>;

        candidateId = isRecord(createBody.data) ? (asString(createBody.data.id) ?? "") : "";

        if (candidateId && uploadPreview) {
          setLoadingMessage("CV verrijkt het profiel...");
          await fetchJson("/api/cv-upload/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parsed: uploadPreview.parsed,
              fileUrl: uploadPreview.fileUrl,
              existingCandidateId: candidateId,
            }),
          });
        }
      }

      if (!candidateId) {
        throw new Error("De kandidaat kon niet worden opgeslagen.");
      }

      setLoadingMessage("Recruiter-aanvullingen bewaren...");
      await fetchJson(`/api/kandidaten/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchPayload(formData, intakeMode)),
      });

      setLoadingMessage("Profiel en topmatches laden...");
      const candidateBody = (await fetchJson(`/api/kandidaten/${candidateId}`)) as Record<
        string,
        unknown
      >;
      const candidateData = isRecord(candidateBody.data) ? candidateBody.data : null;
      const matches = await fetchCandidateMatches(candidateId, Boolean(uploadPreview));
      const recommendedMatch = matches.find((match) => match.isRecommended) ?? null;
      const profile = normalizeProfilePreview(
        candidateData,
        formData,
        uploadPreview?.parsed ?? null,
        intakeMode,
      );

      onSubmit({
        candidateId,
        candidateName: profile.name,
        profile,
        matches,
        recommendedMatchId: recommendedMatch?.matchId ?? null,
        intakeMode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setIntakeMode("manual")}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            intakeMode === "manual"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <p className="text-sm font-semibold text-foreground">Handmatig</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start met basisgegevens en verrijk optioneel met een CV zonder de wizard te verlaten.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setIntakeMode("cv")}
          className={`rounded-xl border px-4 py-3 text-left transition-colors ${
            intakeMode === "cv"
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <p className="text-sm font-semibold text-foreground">CV upload</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Parse direct een gestructureerd profiel met hard skills, soft skills en matchvoorstel.
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {intakeMode === "cv" ? "CV upload als startpunt" : "CV verrijken (optioneel)"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {intakeMode === "cv"
                ? "Analyseer eerst het CV zodat je vóór opslaan al een profielpreview ziet."
                : "Upload optioneel een CV om het handmatige profiel automatisch te verrijken."}
            </p>
          </div>
          {parsing ? (
            <span className="inline-flex items-center gap-2 text-xs text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              CV wordt geanalyseerd...
            </span>
          ) : null}
        </div>

        {!cvFile ? (
          <label
            htmlFor="wzp-cv"
            className="flex items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-4 cursor-pointer transition-colors hover:border-primary/40"
          >
            <FileUp className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">
                Sleep een CV hierheen of klik om te selecteren
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                PDF of Word &middot; Max {MAX_CV_SIZE_MB}MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              id="wzp-cv"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
            <FileUp className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-foreground truncate flex-1">{cvFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setCvFile(null);
                setUploadPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {uploadPreview ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                CV-profielpreview gereed
              </span>
              {exactDuplicateCount > 0 ? (
                <span className="text-xs text-amber-600">
                  {exactDuplicateCount} mogelijke duplic{exactDuplicateCount === 1 ? "aat" : "aten"}
                </span>
              ) : null}
              {similarDuplicateCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {similarDuplicateCount} vergelijkbare profielen gevonden
                </span>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{uploadPreview.parsed.name}</p>
              <p className="text-sm text-muted-foreground">{uploadPreview.parsed.role}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {uploadPreview.parsed.introduction}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {renderSkillList(
                "Hard skills",
                normalizeSkillList(uploadPreview.parsed.skills.hard),
                "text-amber-600",
              )}
              {renderSkillList(
                "Soft skills",
                normalizeSkillList(uploadPreview.parsed.skills.soft),
                "text-blue-600",
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="wzp-name" className="text-sm font-medium text-foreground">
                Naam <span className="text-destructive">*</span>
              </label>
              <Input
                id="wzp-name"
                value={formData.name}
                onChange={(e) => setFormData((previous) => ({ ...previous, name: e.target.value }))}
                placeholder="Volledige naam"
                required={intakeMode === "manual"}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wzp-role" className="text-sm font-medium text-foreground">
                Rol / functietitel <span className="text-destructive">*</span>
              </label>
              <Input
                id="wzp-role"
                value={formData.role}
                onChange={(e) => setFormData((previous) => ({ ...previous, role: e.target.value }))}
                placeholder="Bijv. Senior Java Developer"
                required={intakeMode === "manual"}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wzp-email" className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <Input
                id="wzp-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((previous) => ({ ...previous, email: e.target.value }))
                }
                placeholder="naam@voorbeeld.nl"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wzp-phone" className="text-sm font-medium text-foreground">
                Telefoon
              </label>
              <Input
                id="wzp-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((previous) => ({ ...previous, phone: e.target.value }))
                }
                placeholder="+31 6 ..."
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wzp-location" className="text-sm font-medium text-foreground">
                Locatie
              </label>
              <Input
                id="wzp-location"
                value={formData.location}
                onChange={(e) =>
                  setFormData((previous) => ({ ...previous, location: e.target.value }))
                }
                placeholder="Bijv. Utrecht"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="wzp-rate" className="text-sm font-medium text-foreground">
                Uurtarief (&euro;)
              </label>
              <Input
                id="wzp-rate"
                type="number"
                min={0}
                value={formData.hourlyRate}
                onChange={(e) =>
                  setFormData((previous) => ({ ...previous, hourlyRate: e.target.value }))
                }
                placeholder="85"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wzp-skills" className="text-sm font-medium text-foreground">
              Vaardigheden
            </label>
            <SkillsInput
              id="wzp-skills"
              value={formData.skills}
              onChange={(skills) => setFormData((previous) => ({ ...previous, skills }))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wzp-experience-title" className="text-sm font-medium text-foreground">
              Werkervaring
            </label>
            <ExperienceInput
              idPrefix="wzp-experience"
              value={formData.experience}
              onChange={(experience) => setFormData((previous) => ({ ...previous, experience }))}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <WandSparkles className="h-4 w-4 text-primary" />
            Recruiter-controle
          </div>
          <p className="text-xs text-muted-foreground">
            Deze velden blijven bewerkbaar vóórdat de topmatches worden geladen.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="wzp-availability" className="text-sm font-medium text-foreground">
              Beschikbaarheid
            </label>
            <Select
              value={formData.availability}
              onValueChange={(value) =>
                setFormData((previous) => ({ ...previous, availability: value }))
              }
            >
              <SelectTrigger id="wzp-availability" className="w-full">
                <SelectValue placeholder="Selecteer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct beschikbaar</SelectItem>
                <SelectItem value="1_maand">Binnen 1 maand</SelectItem>
                <SelectItem value="3_maanden">Binnen 3 maanden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wzp-linkedin" className="text-sm font-medium text-foreground">
              LinkedIn URL
            </label>
            <Input
              id="wzp-linkedin"
              type="url"
              value={formData.linkedinUrl}
              onChange={(e) =>
                setFormData((previous) => ({ ...previous, linkedinUrl: e.target.value }))
              }
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="wzp-notes" className="text-sm font-medium text-foreground">
              Notities
            </label>
            <Textarea
              id="wzp-notes"
              value={formData.notes}
              onChange={(e) => setFormData((previous) => ({ ...previous, notes: e.target.value }))}
              placeholder="Bijzonderheden, tariefcontext of recruiter-opmerkingen..."
              rows={8}
            />
          </div>

          <div className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            {formData.availability
              ? `Beschikbaarheid: ${availabilityLabels[formData.availability] ?? formData.availability}`
              : "Beschikbaarheid nog niet ingevuld"}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          De kandidaat wordt direct opgeslagen in de talentpool. Daarna tonen we de topmatches in
          deze wizard.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuleren
          </Button>
          <Button type="submit" disabled={loading || parsing}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingMessage || "Opslaan..."}
              </>
            ) : (
              "Kandidaat opslaan en topmatches tonen"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
