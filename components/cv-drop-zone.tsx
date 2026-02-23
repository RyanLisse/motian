"use client";

import { Check, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface CvDropZoneProps {
  candidateId: string;
  children: React.ReactNode;
}

export function CvDropZone({ candidateId, children }: CvDropZoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Auto-dismiss success/error messages
  useEffect(() => {
    if (status === "success" || status === "error") {
      const timer = setTimeout(() => {
        setStatus("idle");
        setMessage(null);
      }, 3000);
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

        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsed, fileUrl, existingCandidateId: candidateId }),
        });
        if (!saveRes.ok) throw new Error("Opslaan mislukt");

        setStatus("success");
        setMessage("CV succesvol opgeslagen!");
        router.refresh();
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
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) processFile(droppedFile);
    },
    [processFile],
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

      {/* Status toast */}
      {status !== "idle" && message && (
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
