import { downloadFile } from "../lib/file-storage";
import { computeGradeFromParsed } from "../lib/grading-utils";
import type { ParsedCV } from "../schemas/candidate-intelligence";
import type { AutoMatchResult } from "./auto-matching";
import { autoMatchCandidateToJobs } from "./auto-matching";
import { createCandidate, enrichCandidateFromCV, findDuplicateCandidate } from "./candidates";
import { parseCV } from "./cv-parser";

export const CV_ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedMimeType = (typeof CV_ALLOWED_TYPES)[number];

export type CvPipelineStep = "parse" | "grade" | "deduplicate" | "match";
export type CvPipelineStepStatus = "active" | "complete" | "error";

export type CvPipelineEvent = {
  step: CvPipelineStep;
  status: CvPipelineStepStatus;
  label: string;
  detail?: string;
  gradeScore?: number;
  gradeLabel?: string;
};

export type CvPipelineCandidate = {
  id: string;
  name: string;
};

export type CvPipelineResult = {
  candidate: CvPipelineCandidate;
  matches: AutoMatchResult[];
  fileUrl: string;
  parsed: ParsedCV;
  isExistingCandidate: boolean;
  gradeScore: number;
  gradeLabel: string;
};

export async function processStoredCV(
  {
    fileUrl,
    mimeType,
    source = "cv-analyse",
    topN,
  }: {
    fileUrl: string;
    mimeType: AllowedMimeType;
    source?: string;
    topN?: number;
  },
  onStep?: (event: CvPipelineEvent) => Promise<void> | void,
): Promise<CvPipelineResult> {
  const emit = async (event: CvPipelineEvent) => {
    await onStep?.(event);
  };

  await emit({ step: "parse", status: "active", label: "CV analyseren met AI..." });
  const buffer = await downloadFile(fileUrl);
  const parsed = await parseCV(buffer, mimeType);
  await emit({
    step: "parse",
    status: "complete",
    label: "CV geanalyseerd",
    detail: `${parsed.name}${parsed.role ? ` — ${parsed.role}` : ""}`,
  });

  await emit({ step: "grade", status: "active", label: "CV beoordelen..." });
  const { score: gradeScore, label: gradeLabel } = computeGradeFromParsed(parsed);
  await emit({
    step: "grade",
    status: "complete",
    label: "CV beoordeeld",
    detail: `${gradeScore}/100 — ${gradeLabel}`,
    gradeScore,
    gradeLabel,
  });

  await emit({ step: "deduplicate", status: "active", label: "Kandidaat controleren..." });
  const duplicates = await findDuplicateCandidate(parsed);

  let candidate: CvPipelineCandidate | null = null;
  if (duplicates.exact) {
    candidate = await enrichCandidateFromCV(
      duplicates.exact.id,
      parsed,
      JSON.stringify(parsed),
      fileUrl,
    );

    if (!candidate) {
      await emit({
        step: "deduplicate",
        status: "error",
        label: "Bestaande kandidaat kon niet worden verrijkt",
      });
      throw new Error("Bestaande kandidaat kon niet worden verrijkt");
    }

    await emit({
      step: "deduplicate",
      status: "complete",
      label: "Bestaande kandidaat gevonden",
      detail: candidate.name,
    });
  } else {
    candidate = await createCandidate({
      name: parsed.name,
      email: parsed.email ?? undefined,
      phone: parsed.phone ?? undefined,
      role: parsed.role,
      skills: [
        ...parsed.skills.hard.map((skill) => skill.name),
        ...parsed.skills.soft.map((skill) => skill.name),
      ],
      location: parsed.location ?? undefined,
      notes: parsed.introduction,
      source,
    });

    await enrichCandidateFromCV(candidate.id, parsed, JSON.stringify(parsed), fileUrl);
    await emit({
      step: "deduplicate",
      status: "complete",
      label: "Nieuwe kandidaat aangemaakt",
      detail: candidate.name,
    });
  }

  await emit({ step: "match", status: "active", label: "Matchen met vacatures..." });
  let matches: AutoMatchResult[] = [];
  try {
    matches = await autoMatchCandidateToJobs(candidate.id, topN);
  } catch (error) {
    console.error("[CV Analyse Pipeline] Auto-matching mislukt:", error);
  }

  await emit({
    step: "match",
    status: "complete",
    label: `${matches.length} vacature${matches.length === 1 ? "" : "s"} gematcht`,
  });

  return {
    candidate,
    matches,
    fileUrl,
    parsed,
    isExistingCandidate: !!duplicates.exact,
    gradeScore,
    gradeLabel,
  };
}
