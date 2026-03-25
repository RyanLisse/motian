"use client";

import { Check, FileUp, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { validateCvUploadFile } from "@/src/lib/cv-upload";

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

export function SidebarCvDropZone({
  onUploadComplete,
}: {
  onUploadComplete?: (candidateId: string) => void;
} = {}) {
  const router = useRouter();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setUploadState("idle");
      setMessage(null);
      resetTimerRef.current = null;
    }, 4000);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragDepthRef.current += 1;
    setUploadState((prev) =>
      prev === "uploading" || prev === "success" || prev === "error" ? prev : "dragging",
    );
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setUploadState((prev) => (prev === "dragging" ? "idle" : prev));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const validation = validateCvUploadFile(file);
      if (!validation.ok) {
        setUploadState("error");
        setMessage(validation.message);
        scheduleReset();
        return;
      }

      setUploadState("uploading");
      setMessage("CV wordt verwerkt...");

      try {
        const formData = new FormData();
        formData.append("cv", file);

        const uploadRes = await fetch("/api/cv-upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const body = (await uploadRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Upload mislukt");
        }

        const { parsed, fileUrl, duplicates } = (await uploadRes.json()) as {
          duplicates?: { exact?: { id: string } };
          fileUrl: string;
          parsed: {
            name: string;
            role: string;
            skills: {
              hard: Array<{ name: string }>;
              soft: Array<{ name: string }>;
            };
          };
        };

        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            existingCandidateId: duplicates?.exact?.id,
            fileUrl,
            parsed,
          }),
        });

        if (!saveRes.ok) {
          const body = (await saveRes.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Opslaan mislukt");
        }

        const saveData = (await saveRes.json()) as { candidateId: string };

        const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd";
        setUploadState("success");
        setMessage(`${parsed.name} ${action}`);
        scheduleReset();
        onUploadComplete?.(saveData.candidateId);
        router.push(`/kandidaten/${saveData.candidateId}`);
      } catch (error) {
        setUploadState("error");
        setMessage(error instanceof Error ? error.message : "Upload mislukt");
        scheduleReset();
      }
    },
    [onUploadComplete, router, scheduleReset],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;

      if (uploadState === "uploading") {
        setUploadState("error");
        setMessage("Er wordt al een CV verwerkt.");
        scheduleReset();
        return;
      }

      const file = e.dataTransfer?.files?.[0];
      if (!file) {
        setUploadState("idle");
        return;
      }

      void uploadFile(file);
    },
    [scheduleReset, uploadFile, uploadState],
  );

  const stateIcon = {
    idle: (
      <FileUp className={cn("shrink-0 text-muted-foreground", collapsed ? "h-4 w-4" : "h-4 w-4")} />
    ),
    dragging: <FileUp className={cn("shrink-0 text-primary", collapsed ? "h-4 w-4" : "h-4 w-4")} />,
    uploading: <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />,
    success: <Check className="h-4 w-4 shrink-0 text-emerald-500" />,
    error: <X className="h-4 w-4 shrink-0 text-destructive" />,
  };

  return (
    <section
      aria-label="CV uploaden via drag-and-drop"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "mx-3 mb-3 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
        uploadState === "dragging"
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/40",
        uploadState === "uploading" && "border-primary/50 bg-primary/5",
        uploadState === "success" && "border-emerald-500/50 bg-emerald-500/5",
        uploadState === "error" && "border-destructive/50 bg-destructive/5",
        collapsed ? "p-2" : "p-3",
      )}
    >
      {stateIcon[uploadState]}
      {!collapsed && (
        <span
          className={cn(
            "text-center text-xs",
            uploadState === "error"
              ? "text-destructive"
              : uploadState === "success"
                ? "text-emerald-600"
                : "text-muted-foreground",
          )}
        >
          {message ?? "Sleep CV"}
        </span>
      )}
      {collapsed && message && uploadState !== "idle" && uploadState !== "dragging" && (
        <span className="sr-only">{message}</span>
      )}
    </section>
  );
}
