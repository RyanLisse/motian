"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CvMatchCard } from "@/components/matching/cv-match-card";
import { CvProfileCard } from "@/components/matching/cv-profile-card";
import {
  PipelineProgress,
  type PipelineStep,
  type StepStatus,
} from "@/components/matching/pipeline-progress";
import {
  PipelineWorkflowCanvas,
  type PipelineWorkflowStepId,
} from "@/components/matching/pipeline-workflow-canvas";
import { RecentAnalyses, type RecentAnalysis } from "@/components/matching/recent-analyses";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ParsedCV } from "@/src/schemas/candidate-intelligence";
import type { AutoMatchResult } from "@/src/services/auto-matching";

const CvDocumentViewer = dynamic(
  () => import("@/components/cv-document-viewer").then((m) => m.CvDocumentViewer),
  { ssr: false },
);

interface CvAnalyseTabProps {
  recentAnalyses: RecentAnalysis[];
}

type Status = "idle" | "uploading" | "done" | "error";

interface CandidateInfo {
  id: string;
  name: string;
  fileUrl: string;
}

function extractStrengths(result: AutoMatchResult): string[] {
  if (!result.structuredResult) return [];
  return result.structuredResult.criteriaBreakdown
    .filter(
      (c) =>
        (c.tier === "knockout" && c.passed === true) ||
        (c.tier === "gunning" && c.stars !== null && c.stars >= 4),
    )
    .map((c) => c.evidence)
    .filter(Boolean)
    .slice(0, 3);
}

function extractRisks(result: AutoMatchResult): string[] {
  if (!result.structuredResult) return [];
  return result.structuredResult.riskProfile.slice(0, 3);
}

function getScore(result: AutoMatchResult): number {
  return result.structuredResult?.overallScore ?? result.quickScore;
}

function getRecommendation(result: AutoMatchResult): "go" | "no-go" | "conditional" | null {
  return result.structuredResult?.recommendation ?? null;
}

/** Drie stappen voor de visuele pipeline: Analyse → Grade → Match. */
const PIPELINE_STEP_IDS: { id: "analyse" | "grade" | "match"; label: string }[] = [
  { id: "analyse", label: "CV analyseren..." },
  { id: "grade", label: "CV beoordelen..." },
  { id: "match", label: "Matchen met vacatures..." },
];

const INITIAL_STEPS: PipelineStep[] = PIPELINE_STEP_IDS.map((s) => ({
  id: s.id,
  label: s.label,
  status: "pending" as const,
}));

/** Map backend SSE step naar pipeline-step id. */
function toPipelineStepId(backendStep: string): "analyse" | "grade" | "match" | null {
  if (backendStep === "upload" || backendStep === "parse") return "analyse";
  if (backendStep === "grade") return "grade";
  if (backendStep === "deduplicate" || backendStep === "match") return "match";
  return null;
}

export function CvAnalyseTab({ recentAnalyses }: CvAnalyseTabProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<AutoMatchResult[]>([]);
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [parsedCv, setParsedCv] = useState<ParsedCV | null>(null);
  const [isExistingCandidate, setIsExistingCandidate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isProcessing = status === "uploading";

  /** Huidige actieve pipeline-stap voor de workflow-canvas. */
  const activeWorkflowStepId = useMemo((): PipelineWorkflowStepId | null => {
    const active = pipelineSteps.find((s) => s.status === "active");
    if (active) return active.id as PipelineWorkflowStepId;
    const lastComplete = [...pipelineSteps].reverse().find((s) => s.status === "complete");
    return lastComplete ? (lastComplete.id as PipelineWorkflowStepId) : null;
  }, [pipelineSteps]);

  const processFile = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!validTypes.includes(file.type)) {
        setStatus("error");
        setMessage("Alleen PDF en Word (.docx) bestanden zijn toegestaan");
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setStatus("error");
        setMessage("Bestand is te groot. Maximaal 20MB.");
        return;
      }

      setStatus("uploading");
      setMessage(null);
      setMatches([]);
      setCandidateInfo(null);
      setActiveRecentId(null);
      setPipelineSteps(INITIAL_STEPS.map((s) => ({ ...s, detail: undefined })));

      try {
        const formData = new FormData();
        formData.append("cv", file);

        const res = await fetch("/api/cv-analyse", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          // Non-SSE error responses (validation errors) are JSON
          const json = await res.json();
          throw new Error(json.error ?? "Analyse mislukt");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Kon stream niet lezen");

        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;

        const processLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const event = JSON.parse(line.slice(6));

          if (event.step === "done") {
            const data = event.result;
            setMatches(data.matches ?? []);
            setParsedCv(data.parsed ?? null);
            setIsExistingCandidate(!!data.isExistingCandidate);
            setCandidateInfo({
              id: data.candidate.id,
              name: data.candidate.name,
              fileUrl: data.fileUrl,
            });
            streamDone = true;
            setStatus("done");
            setMessage(null);
            router.refresh();
          } else if (event.step === "error") {
            throw new Error(event.label);
          } else {
            const pipelineId = toPipelineStepId(event.step);
            if (pipelineId) {
              setPipelineSteps((prev) =>
                prev.map((s) => {
                  if (s.id === pipelineId) {
                    return {
                      ...s,
                      status: event.status as StepStatus,
                      label: event.label,
                      detail: event.detail,
                    };
                  }
                  return s;
                }),
              );
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            processLine(line);
          }
        }

        // Flush remaining buffer (handles edge case where final event lacks trailing newline)
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            processLine(line);
          }
        }

        // If stream ended without a done event, something went wrong server-side
        if (!streamDone) {
          throw new Error("Analyse stream onverwacht beëindigd");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Onbekende fout opgetreden");
      }
    },
    [router],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isProcessing) return;
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) processFile(droppedFile);
    },
    [isProcessing, processFile],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleDropZoneClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleDropZoneClick();
      }
    },
    [handleDropZoneClick],
  );

  const handleCloseResults = useCallback(() => {
    setStatus("idle");
    setMatches([]);
    setParsedCv(null);
    setIsExistingCandidate(false);
    setCandidateInfo(null);
    setActiveRecentId(null);
  }, []);

  const handleRecentSelect = useCallback(async (analysis: RecentAnalysis) => {
    setActiveRecentId(analysis.id);
    setCandidateInfo({
      id: analysis.id,
      name: analysis.name,
      fileUrl: analysis.resumeUrl ?? "",
    });
    // Fetch persisted match results from DB
    setStatus("uploading");
    setMessage("Resultaten ophalen...");
    setMatches([]);

    try {
      const res = await fetch(`/api/candidates/${analysis.id}/matches`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      const data: AutoMatchResult[] = await res.json();
      setMatches(data);
      setStatus("done");
      setMessage(null);
    } catch {
      setStatus("error");
      setMessage("Kon eerdere resultaten niet ophalen");
    }
  }, []);

  // Close full-screen on Escape
  useEffect(() => {
    if (status !== "done") return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseResults();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [status, handleCloseResults]);

  // Full-screen results overlay
  if (status === "done") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleCloseResults} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Terug
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold">
                {candidateInfo?.name ?? "Analyse"} — {matches.length} vacature
                {matches.length === 1 ? "" : "s"}
              </h3>
            </div>
          </div>
        </div>

        {/* Split content */}
        <div
          className={cn(
            "flex-1 min-h-0",
            candidateInfo?.fileUrl ? "grid grid-cols-1 lg:grid-cols-2" : "",
          )}
        >
          {/* Left: match cards (scrollable) */}
          <div className="overflow-y-auto p-6 space-y-4">
            {/* Workflow: Analyse → Grade → Match (alle stappen voltooid) */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Pipeline</p>
              <PipelineWorkflowCanvas
                activeStepId="match"
                isRunning={false}
                className="h-[160px]"
              />
            </div>

            {/* CV Profile — always shown */}
            {parsedCv && (
              <CvProfileCard parsed={parsedCv} isExistingCandidate={isExistingCandidate} />
            )}

            {/* Top 3 matches met score ring */}
            {matches.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold text-foreground pt-2">
                  Top 3 vacatures — matchpercentage
                </h3>
                {matches.map((match) => (
                  <CvMatchCard
                    key={match.matchId}
                    jobId={match.jobId}
                    jobTitle={match.jobTitle}
                    company={match.company}
                    location={match.location}
                    score={getScore(match)}
                    recommendation={getRecommendation(match)}
                    strengths={extractStrengths(match)}
                    risks={extractRisks(match)}
                    matchId={match.matchId}
                    reasoning={match.structuredResult?.recommendationReasoning}
                    criteriaBreakdown={match.structuredResult?.criteriaBreakdown}
                    enrichmentSuggestions={match.structuredResult?.enrichmentSuggestions}
                    judgeVerdict={match.judgeVerdict}
                  />
                ))}
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Geen actieve vacatures gevonden die boven de matchdrempel scoren.
              </div>
            )}
          </div>

          {/* Right: PDF viewer (scrollable) */}
          {candidateInfo?.fileUrl && (
            <div className="overflow-y-auto border-l border-border p-6">
              <CvDocumentViewer url={candidateInfo.fileUrl} candidateName={candidateInfo.name} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Drop zone: div so React Flow Controls (buttons) are not nested inside a button */}
      {/* biome-ignore lint/a11y/useSemanticElements: avoid button nesting with React Flow zoom controls */}
      <div
        role="button"
        tabIndex={0}
        aria-label="CV uploaden"
        onClick={handleDropZoneClick}
        onKeyDown={handleDropZoneKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          isProcessing
            ? "cursor-not-allowed opacity-60 border-border bg-muted/30"
            : isDragging
              ? "border-primary bg-primary/5 cursor-copy"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/20 cursor-pointer",
        )}
      >
        {isProcessing ? (
          <div className="w-full space-y-4">
            <PipelineWorkflowCanvas
              activeStepId={activeWorkflowStepId}
              isRunning={true}
              className="max-w-xl mx-auto"
            />
            <PipelineProgress steps={pipelineSteps} />
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragging
                  ? "Laat het CV los om te uploaden"
                  : "Sleep een CV hierheen of klik om te uploaden"}
              </p>
              <p className="text-xs text-muted-foreground">PDF / DOCX · Max 20MB</p>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={handleFileInputChange}
          tabIndex={-1}
        />
      </div>

      {/* Error state */}
      {status === "error" && message && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      {/* Recent analyses */}
      <RecentAnalyses
        analyses={recentAnalyses}
        onSelect={handleRecentSelect}
        activeId={activeRecentId}
      />
    </div>
  );
}
