"use client";

import { Check, Loader2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildCvSummaryMessage,
  CV_UPLOAD_MAX_SIZE_MB,
  validateCvUploadFile,
} from "@/src/lib/cv-upload";
import type { CandidateIntakeMatch } from "@/src/services/candidate-intake";
import { usePromptInputAttachments } from "./prompt-input";

type UploadState = "idle" | "uploading" | "success" | "error";

type PromptInputAttachmentError = {
  code: "accept" | "max_file_size" | "max_files";
  message: string;
};

export type ChatCvUploadController = {
  clearFeedback: () => void;
  handlePromptInputError: (error: PromptInputAttachmentError) => void;
  isDraggingFile: boolean;
  openFileDialog: () => void;
  uploadFileName: string | null;
  uploadMessage: string | null;
  uploadState: UploadState;
};

function mapPromptInputError(error: PromptInputAttachmentError): string {
  switch (error.code) {
    case "max_files":
      return "Upload één CV tegelijk.";
    case "max_file_size":
      return `Bestand te groot. Maximaal ${CV_UPLOAD_MAX_SIZE_MB}MB toegestaan.`;
    default:
      return "Alleen PDF en Word (.docx) bestanden zijn toegestaan. Oudere .doc-bestanden worden nog niet ondersteund.";
  }
}

export function ChatCvUploadStatusBanner({
  clearFeedback,
  uploadFileName,
  uploadMessage,
  uploadState,
  variant,
}: Pick<
  ChatCvUploadController,
  "clearFeedback" | "uploadFileName" | "uploadMessage" | "uploadState"
> & {
  variant: "page" | "widget";
}) {
  if (uploadState === "idle") {
    return null;
  }

  return (
    <div
      aria-live={uploadState === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-center gap-2 rounded-2xl",
        variant === "page" ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs",
        uploadState === "error"
          ? "bg-destructive/10 text-destructive"
          : uploadState === "success"
            ? "bg-primary/10 text-primary"
            : "bg-muted/60 text-muted-foreground",
      )}
      role={uploadState === "error" ? "alert" : "status"}
    >
      {uploadState === "uploading" ? (
        <Loader2
          className={cn("shrink-0 animate-spin", variant === "page" ? "h-4 w-4" : "h-3.5 w-3.5")}
        />
      ) : null}
      {uploadState === "success" ? (
        <Check className={cn("shrink-0", variant === "page" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      ) : null}
      {uploadState === "error" ? (
        <X className={cn("shrink-0", variant === "page" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      ) : null}

      <span className="truncate">
        {uploadState === "uploading" && uploadFileName ? (
          <>
            <span className="font-medium">{uploadFileName}</span> — {uploadMessage}
          </>
        ) : (
          uploadMessage
        )}
      </span>

      {uploadState !== "uploading" ? (
        <button
          aria-label="Sluit uploadmelding"
          className={cn(
            "ml-auto shrink-0 rounded p-0.5 transition-colors",
            uploadState === "error" ? "hover:bg-destructive/10" : "hover:bg-primary/10",
          )}
          onClick={clearFeedback}
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

export function ChatCvDropOverlay({
  active,
  variant,
}: {
  active: boolean;
  variant: "page" | "widget";
}) {
  if (!active) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary bg-background/85 text-center backdrop-blur-sm",
        variant === "page" ? "rounded-none" : "rounded-2xl",
      )}
    >
      <Upload className={cn("text-primary", variant === "page" ? "h-12 w-12" : "h-10 w-10")} />
      <div className="space-y-1 px-6">
        <p className={cn("font-medium text-primary", variant === "page" ? "text-lg" : "text-base")}>
          Sleep je CV hierheen
        </p>
        <p className="text-sm text-muted-foreground">PDF of Word (.docx) · Max 20MB</p>
      </div>
    </div>
  );
}

export function useChatCvUpload({
  onSendMessage,
  resetDelayMs = 4000,
}: {
  onSendMessage: (message: { text: string }) => void;
  resetDelayMs?: number;
}): ChatCvUploadController {
  const attachments = usePromptInputAttachments();
  const activeUploadControllerRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef(0);
  const dragDepthRef = useRef(0);
  const handledAttachmentIdsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(false);
  const onSendMessageRef = useRef(onSendMessage);
  const resetTimerRef = useRef<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const clearFeedback = useCallback(() => {
    clearResetTimer();

    setUploadState("idle");
    setUploadFileName(null);
    setUploadMessage(null);
  }, [clearResetTimer]);

  const scheduleReset = useCallback(() => {
    clearResetTimer();

    resetTimerRef.current = window.setTimeout(() => {
      setUploadState("idle");
      setUploadFileName(null);
      setUploadMessage(null);
      resetTimerRef.current = null;
    }, resetDelayMs);
  }, [clearResetTimer, resetDelayMs]);

  const isUploadCurrent = useCallback((uploadId: number, controller: AbortController) => {
    return (
      isMountedRef.current &&
      activeUploadIdRef.current === uploadId &&
      activeUploadControllerRef.current === controller &&
      !controller.signal.aborted
    );
  }, []);

  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearResetTimer();
      activeUploadControllerRef.current?.abort();
      activeUploadControllerRef.current = null;
    };
  }, [clearResetTimer]);

  useEffect(() => {
    if (attachments.files.length === 0) {
      handledAttachmentIdsRef.current.clear();
    }
  }, [attachments.files.length]);

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }

      dragDepthRef.current += 1;
      setIsDraggingFile(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDraggingFile(false);
      }
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragend", resetDragState);
    document.addEventListener("drop", resetDragState);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragend", resetDragState);
      document.removeEventListener("drop", resetDragState);
    };
  }, []);

  const uploadCvFile = useCallback(
    async (file: File) => {
      clearResetTimer();

      const validation = validateCvUploadFile(file);

      if (!validation.ok) {
        setUploadState("error");
        setUploadFileName(file.name);
        setUploadMessage(validation.message);
        scheduleReset();
        return;
      }

      // Cancel any pending reset timer before starting new upload
      clearResetTimer();

      activeUploadControllerRef.current?.abort();
      const controller = new AbortController();
      const uploadId = activeUploadIdRef.current + 1;
      activeUploadIdRef.current = uploadId;
      activeUploadControllerRef.current = controller;

      setUploadState("uploading");
      setUploadFileName(file.name);
      setUploadMessage("CV wordt verwerkt en kandidaat wordt bijgewerkt...");

      try {
        const formData = new FormData();
        formData.append("cv", file);

        const uploadRes = await fetch("/api/cv-upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        if (!uploadRes.ok) {
          const body = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
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

        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            existingCandidateId: duplicates?.exact?.id,
            fileUrl,
            parsed,
          }),
          signal: controller.signal,
        });

        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        if (!saveRes.ok) {
          const body = (await saveRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Opslaan mislukt");
        }

        const saveData = (await saveRes.json()) as {
          candidateId: string;
          matches?: CandidateIntakeMatch[];
          recommendation?: CandidateIntakeMatch | null;
          profile?: unknown;
        };

        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        const summary = buildCvSummaryMessage({
          candidateId: saveData.candidateId,
          duplicates,
          parsed,
          matches: saveData.matches,
          recommendation: saveData.recommendation,
        });

        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        setUploadState("success");
        setUploadMessage(`${parsed.name} ${summary.action}`);
        onSendMessageRef.current({ text: summary.text });
        scheduleReset();
      } catch (error) {
        if (!isUploadCurrent(uploadId, controller)) {
          return;
        }

        setUploadState("error");
        setUploadMessage(error instanceof Error ? error.message : "Upload mislukt");
        scheduleReset();
      } finally {
        if (activeUploadControllerRef.current === controller) {
          activeUploadControllerRef.current = null;
        }
      }
    },
    [clearResetTimer, isUploadCurrent, scheduleReset],
  );

  useEffect(() => {
    const nextAttachment = attachments.files.find(
      (file) => !handledAttachmentIdsRef.current.has(file.id),
    );

    if (!nextAttachment) {
      return;
    }

    handledAttachmentIdsRef.current.add(nextAttachment.id);

    if (uploadState === "uploading") {
      attachments.clear();
      clearResetTimer();
      setUploadState("error");
      setUploadFileName(nextAttachment.filename ?? null);
      setUploadMessage("Er wordt al een CV geüpload. Wacht even tot deze upload klaar is.");
      scheduleReset();
      return;
    }

    // Clear any pending reset timer before starting new upload
    clearResetTimer();

    attachments.clear();

    if (!(nextAttachment.file instanceof File)) {
      clearResetTimer();
      setUploadState("error");
      setUploadFileName(nextAttachment.filename ?? null);
      setUploadMessage("Bestand kon niet worden gelezen. Probeer het opnieuw.");
      scheduleReset();
      return;
    }

    void uploadCvFile(nextAttachment.file);
  }, [attachments, clearResetTimer, scheduleReset, uploadCvFile, uploadState]);

  const handlePromptInputError = useCallback(
    (error: PromptInputAttachmentError) => {
      clearResetTimer();
      setUploadState("error");
      setUploadFileName(null);
      setUploadMessage(mapPromptInputError(error));
      scheduleReset();
    },
    [clearResetTimer, scheduleReset],
  );

  return {
    clearFeedback,
    handlePromptInputError,
    isDraggingFile,
    openFileDialog: attachments.openFileDialog,
    uploadFileName,
    uploadMessage,
    uploadState,
  };
}
