"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, Check, Gauge, Loader2, Mic, Paperclip, Square, X, Zap } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/src/components/ai-elements/prompt-input";

type UploadState = "idle" | "uploading" | "success" | "error";

type ModelOption = {
  id: string;
  label: string;
  provider?: string;
};

type SpeedOption = {
  id: string;
  label: string;
};

export type ChatPromptComposerProps = {
  modelId: string;
  onModelIdChange: (id: string) => void;
  modelOptions: readonly ModelOption[];
  speedMode: string;
  onSpeedModeChange: (mode: string) => void;
  speedOptions: readonly SpeedOption[];
  status: ChatStatus;
  onStop: () => void;
  onSendMessage: (message: { text: string }) => void;
  onToggleVoice: () => void;
  placeholder: string;
  composerHint: string;
  composerContextHint?: string;
  inputAriaLabel?: string;
};

const CV_UPLOAD_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const CV_UPLOAD_MAX_SIZE = 20 * 1024 * 1024;

function ChatPromptAttachmentList() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 px-2 pt-2">
      {attachments.files.map((file) => (
        <div
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
          key={file.id}
        >
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="truncate">{file.filename}</span>
          <button
            aria-label={`Verwijder bijlage ${file.filename}`}
            className="rounded-full p-0.5 transition-colors hover:bg-accent hover:text-foreground"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function normalizeChatPromptMessage(message: PromptInputMessage) {
  const text = message.text.trim();
  return text ? { text } : null;
}

export function buildCvSummaryMessage({
  candidateId,
  duplicates,
  parsed,
}: {
  candidateId: string;
  duplicates: { exact?: { id: string } } | undefined;
  parsed: {
    name: string;
    role: string;
    skills: {
      hard: Array<{ name: string }>;
      soft: Array<{ name: string }>;
    };
  };
}) {
  const action = duplicates?.exact ? "bijgewerkt" : "toegevoegd aan talentpool";
  const skillsList = [...parsed.skills.hard, ...parsed.skills.soft]
    .map((skill) => skill.name)
    .slice(0, 8)
    .join(", ");

  return {
    action,
    text: `Ik heb zojuist een CV geüpload voor ${parsed.name} (${parsed.role}). Het profiel is automatisch ${action}. Vaardigheden: ${skillsList}. Kandidaat ID: ${candidateId}. Geef een samenvatting van dit profiel en zoek passende vacatures.`,
  };
}

export function ChatPromptComposer({
  modelId,
  onModelIdChange,
  modelOptions,
  speedMode,
  onSpeedModeChange,
  speedOptions,
  status,
  onStop,
  onSendMessage,
  onToggleVoice,
  placeholder,
  composerHint,
  composerContextHint,
  inputAriaLabel = "Bericht aan Motian AI",
}: ChatPromptComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const composerHintId = useId();
  const composerContextId = useId();
  const describedBy = [composerHintId, composerContextHint ? composerContextId : null]
    .filter(Boolean)
    .join(" ");

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const payload = normalizeChatPromptMessage(message);
      if (!payload) {
        return;
      }
      onSendMessage(payload);
    },
    [onSendMessage],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!validTypes.includes(file.type)) {
        setUploadState("error");
        setUploadResult("Alleen PDF en Word (.docx) bestanden");
        return;
      }

      if (file.size > CV_UPLOAD_MAX_SIZE) {
        setUploadState("error");
        setUploadResult("Bestand te groot (max 20MB)");
        return;
      }

      setUploadState("uploading");
      setUploadFileName(file.name);
      setUploadResult(null);

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

        const { parsed, fileUrl, duplicates } = await uploadRes.json();
        const saveRes = await fetch("/api/cv-upload/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parsed,
            fileUrl,
            existingCandidateId: duplicates?.exact?.id,
          }),
        });

        if (!saveRes.ok) {
          throw new Error("Opslaan mislukt");
        }

        const saveData = await saveRes.json();
        const summary = buildCvSummaryMessage({
          candidateId: saveData.candidateId,
          duplicates,
          parsed,
        });

        setUploadState("success");
        setUploadResult(`${parsed.name} ${summary.action}`);
        onSendMessage({ text: summary.text });

        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
        }

        resetTimerRef.current = window.setTimeout(() => {
          setUploadState("idle");
          setUploadFileName(null);
          setUploadResult(null);
          resetTimerRef.current = null;
        }, 4000);
      } catch (error) {
        setUploadState("error");
        setUploadResult(error instanceof Error ? error.message : "Upload mislukt");
      }
    },
    [onSendMessage],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFileUpload(file);
      }
      event.target.value = "";
    },
    [handleFileUpload],
  );

  return (
    <div className="shrink-0 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
        {composerContextHint ? (
          <div
            className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground"
            id={composerContextId}
          >
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{composerContextHint}</span>
          </div>
        ) : null}

        {uploadState !== "idle" ? (
          <div
            aria-live={uploadState === "error" ? "assertive" : "polite"}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm ${
              uploadState === "error"
                ? "bg-destructive/10 text-destructive"
                : uploadState === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/60 text-muted-foreground"
            }`}
            role={uploadState === "error" ? "alert" : "status"}
          >
            {uploadState === "uploading" ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                <span className="truncate">
                  <span className="font-medium">{uploadFileName}</span> — CV wordt verwerkt &
                  kandidaat wordt aangemaakt...
                </span>
              </>
            ) : null}
            {uploadState === "success" ? (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span className="truncate">{uploadResult}</span>
              </>
            ) : null}
            {uploadState === "error" ? (
              <>
                <X className="h-4 w-4 shrink-0" />
                <span className="truncate">{uploadResult}</span>
                <button
                  aria-label="Sluit uploadmelding"
                  className="ml-auto shrink-0 rounded p-0.5 hover:bg-destructive/10"
                  onClick={() => setUploadState("idle")}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        <input
          accept={CV_UPLOAD_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />

        <div className="rounded-[28px] border border-border/70 bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/20">
          <PromptInput multiple onSubmit={handleSubmit}>
            <PromptInputTextarea
              aria-describedby={describedBy}
              aria-label={inputAriaLabel}
              autoFocus
              className="min-h-[88px] text-sm sm:min-h-[96px]"
              placeholder={placeholder}
            />
            <ChatPromptAttachmentList />
            <PromptInputFooter className="flex-wrap gap-2 px-2 pb-2 pt-0 sm:flex-nowrap">
              <PromptInputTools className="flex-1 flex-wrap">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger tooltip="Bijlage toevoegen" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments label="Foto's of bestanden" />
                    <PromptInputActionMenuItem
                      disabled={uploadState === "uploading"}
                      onSelect={(event) => {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }}
                    >
                      CV uploaden (PDF, Word)
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>

                <PromptInputSelect onValueChange={onModelIdChange} value={modelId}>
                  <PromptInputSelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {modelOptions.map((model) => (
                      <PromptInputSelectItem key={model.id} value={model.id}>
                        <span>{model.label}</span>
                        {model.provider ? (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {model.provider}
                          </span>
                        ) : null}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>

                <PromptInputSelect onValueChange={onSpeedModeChange} value={speedMode}>
                  <PromptInputSelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                    <Gauge className="h-3.5 w-3.5" />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {speedOptions.map((mode) => (
                      <PromptInputSelectItem key={mode.id} value={mode.id}>
                        {mode.label}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>

              <PromptInputTools className="shrink-0">
                <PromptInputButton onClick={onToggleVoice} tooltip="Spraakassistent">
                  <Mic className="h-4 w-4" />
                </PromptInputButton>
                <PromptInputSubmit
                  className="rounded-full"
                  onStop={onStop}
                  size="icon-sm"
                  status={status}
                  variant="default"
                >
                  {status === "submitted" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : status === "streaming" ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </PromptInputSubmit>
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>
        </div>

        <p className="px-1 text-xs text-muted-foreground" id={composerHintId}>
          {composerHint}
        </p>
      </div>
    </div>
  );
}
