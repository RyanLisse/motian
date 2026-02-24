"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { CvMatchCard } from "@/components/matching/cv-match-card";
import { CvPdfPanel } from "@/components/matching/cv-pdf-panel";
import {
  RecentAnalyses,
  type RecentAnalysis,
} from "@/components/matching/recent-analyses";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutoMatchResult } from "@/src/services/auto-matching";

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

function getRecommendation(
  result: AutoMatchResult,
): "go" | "no-go" | "conditional" | null {
  return result.structuredResult?.recommendation ?? null;
}

export function CvAnalyseTab({ recentAnalyses }: CvAnalyseTabProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<AutoMatchResult[]>([]);
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [pdfPanelOpen, setPdfPanelOpen] = useState(false);
  const [activeRecentId, setActiveRecentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isProcessing = status === "uploading";

  const processFile = useCallback(async (file: File) => {
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
    setMessage("CV wordt geanalyseerd...");
    setMatches([]);
    setCandidateInfo(null);
    setActiveRecentId(null);

    try {
      const formData = new FormData();
      formData.append("cv", file);

      const res = await fetch("/api/cv-analyse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Analyse mislukt");
      }

      const data = await res.json();

      setMatches(data.matches ?? []);
      setCandidateInfo({
        id: data.candidate.id,
        name: data.candidate.name,
        fileUrl: data.fileUrl,
      });
      setStatus("done");
      setMessage(null);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Onbekende fout opgetreden",
      );
    }
  }, []);

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

  const handleRecentSelect = useCallback((analysis: RecentAnalysis) => {
    setActiveRecentId(analysis.id);
    if (analysis.resumeUrl) {
      setCandidateInfo({
        id: analysis.id,
        name: analysis.name,
        fileUrl: analysis.resumeUrl,
      });
      setPdfPanelOpen(true);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
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
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isProcessing
              ? (message ?? "Bezig...")
              : isDragging
                ? "Laat het CV los om te uploaden"
                : "Sleep een CV hierheen of klik om te uploaden"}
          </p>
          {!isProcessing && (
            <p className="text-xs text-muted-foreground">PDF / DOCX · Max 20MB</p>
          )}
        </div>

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

      {/* Results section */}
      {status === "done" && (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold">
                {matches.length > 0
                  ? `${matches.length} passende vacature${matches.length === 1 ? "" : "s"} gevonden`
                  : "Geen passende vacatures gevonden"}
              </h3>
            </div>

            {candidateInfo && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfPanelOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <FileText className="h-4 w-4" />
                Bekijk CV
              </Button>
            )}
          </div>

          {/* Match cards grid */}
          {matches.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Dit CV kon niet worden gekoppeld aan actieve vacatures. Probeer een
              ander CV of controleer de beschikbare vacatures.
            </p>
          )}
        </div>
      )}

      {/* PDF panel */}
      {candidateInfo && (
        <CvPdfPanel
          url={candidateInfo.fileUrl}
          candidateName={candidateInfo.name}
          open={pdfPanelOpen}
          onClose={() => setPdfPanelOpen(false)}
        />
      )}
    </div>
  );
}
