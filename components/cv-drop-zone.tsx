"use client";

import { Check, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AutoMatchResults } from "./auto-match-results";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface CvDropZoneProps {
  candidateId: string;
  children: React.ReactNode;
}

export function CvDropZone({ candidateId, children }: CvDropZoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "matching" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [matchCandidateId, setMatchCandidateId] = useState<string | null>(null);
  const [skillsPreview, setSkillsPreview] = useState<{
    candidateId: string;
    hard: string[];
    soft: string[];
  } | null>(null);

  // Auto-dismiss success/error messages (but not matching)
  useEffect(() => {
    if (status === "success" || status === "error") {
      const timer = setTimeout(() => {
        setStatus("idle");
        setMessage(null);
        setMatchCandidateId(null);
        setSkillsPreview(null);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [status]);

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
      setMessage("CV wordt verwerkt...");

      try {
        // Phase 1: Upload & parse
        const formData = new FormData();
        formData.append("cv", file);
        const uploadRes = await fetch("/api/cv-upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const json = await uploadRes.json();
          throw new Error(json.error ?? "Upload mislukt");
        }
        const { parsed, fileUrl } = await uploadRes.json();

        // Phase 2: Save candidate
        setMessage("Profiel wordt bijgewerkt...");
        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsed, fileUrl, existingCandidateId: candidateId }),
        });
        if (!saveRes.ok) throw new Error("Opslaan mislukt");
        const saveData = await saveRes.json();

        router.refresh();

        // Phase 3: Auto-matching
        const resolvedCandidateId = saveData.candidateId ?? candidateId;
        setSkillsPreview({
          candidateId: resolvedCandidateId,
          hard: (parsed.skills?.hard ?? [])
            .map((skill: { name: string }) => skill.name)
            .filter(Boolean),
          soft: (parsed.skills?.soft ?? [])
            .map((skill: { name: string }) => skill.name)
            .filter(Boolean),
        });
        setStatus("matching");
        setMessage("Vacatures worden gescand...");
        setMatchCandidateId(resolvedCandidateId);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Onbekende fout");
      }
    },
    [candidateId, router],
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
      if (status !== "idle") return;
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) processFile(droppedFile);
    },
    [processFile, status],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target requires div wrapper
    <div
      className="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="h-12 w-12 text-primary" />
          <p className="text-lg font-medium text-primary">Sleep je CV hierheen</p>
          <p className="text-sm text-muted-foreground">PDF of Word (.docx) &middot; Max 20MB</p>
        </div>
      )}

      {/* Auto-match results panel (shown after CV upload) */}
      {status === "matching" && matchCandidateId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4">
          <div className="rounded-xl border bg-card p-4 shadow-xl">
            {skillsPreview && (
              <div className="mb-4 space-y-3 rounded-xl border border-border/60 bg-background/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Geëxtraheerde vaardigheden
                  </p>
                  <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                    <Link href={`/kandidaten/${skillsPreview.candidateId}#vaardigheden`}>
                      Naar profielskills
                    </Link>
                  </Button>
                </div>
                {skillsPreview.hard.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Hard skills
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {skillsPreview.hard.slice(0, 12).map((skill) => (
                        <Badge key={`hard-${skill}`} variant="secondary" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {skillsPreview.soft.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Soft skills
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {skillsPreview.soft.slice(0, 8).map((skill) => (
                        <Badge key={`soft-${skill}`} variant="outline" className="text-[10px]">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            <AutoMatchResults candidateId={matchCandidateId} />
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage(null);
                setMatchCandidateId(null);
                setSkillsPreview(null);
              }}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {/* Status toast (for uploading/error states only) */}
      {status !== "idle" && status !== "matching" && message && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-sm font-medium ${
              status === "uploading"
                ? "bg-primary/10 border border-primary/20 text-primary"
                : status === "success"
                  ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400"
                  : "bg-destructive/10 border border-destructive/20 text-destructive"
            }`}
          >
            {status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "success" && <Check className="h-4 w-4" />}
            {status === "error" && <X className="h-4 w-4" />}
            {message}
          </div>
        </div>
      )}
    </div>
  );
}
