"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, Gauge, Loader2, Mic, Plus, Square, Upload, Zap } from "lucide-react";
import { useCallback, useId } from "react";
import {
  PromptInput,
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
} from "@/components/ai-elements/prompt-input";
import { CV_UPLOAD_ACCEPT, CV_UPLOAD_MAX_SIZE_BYTES } from "@/src/lib/cv-upload";
import { type ChatCvUploadController, ChatCvUploadStatusBanner } from "./use-chat-cv-upload";

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
  cvUpload: ChatCvUploadController;
};

export function normalizeChatPromptMessage(message: PromptInputMessage) {
  const text = message.text.trim();
  return text ? { text } : null;
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
  cvUpload,
}: ChatPromptComposerProps) {
  const composerHintId = useId();
  const composerContextId = useId();
  const describedBy = [composerHintId, composerContextHint ? composerContextId : null]
    .filter(Boolean)
    .join(" ");

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

  return (
    <div className="shrink-0 border-t border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-4">
        {composerContextHint ? (
          <div
            className="hidden items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground lg:flex"
            id={composerContextId}
          >
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{composerContextHint}</span>
          </div>
        ) : null}

        <ChatCvUploadStatusBanner
          clearFeedback={cvUpload.clearFeedback}
          uploadFileName={cvUpload.uploadFileName}
          uploadMessage={cvUpload.uploadMessage}
          uploadState={cvUpload.uploadState}
          variant="page"
        />

        <div className="rounded-3xl border border-border/70 bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring/20 lg:rounded-[28px]">
          <PromptInput
            accept={CV_UPLOAD_ACCEPT}
            globalDrop
            maxFileSize={CV_UPLOAD_MAX_SIZE_BYTES}
            maxFiles={1}
            onError={cvUpload.handlePromptInputError}
            onSubmit={handleSubmit}
          >
            <PromptInputTextarea
              aria-describedby={describedBy}
              aria-label={inputAriaLabel}
              autoFocus
              className="min-h-[56px] text-sm sm:min-h-[96px]"
              placeholder={placeholder}
            />
            <PromptInputFooter className="flex-wrap gap-2 px-2 pb-2 pt-0 sm:flex-nowrap">
              <PromptInputTools className="flex-1 flex-wrap">
                <PromptInputButton
                  aria-label="CV uploaden (PDF of Word)"
                  className="gap-1.5 rounded-full px-2 text-xs lg:px-3"
                  disabled={cvUpload.uploadState === "uploading"}
                  onClick={cvUpload.openFileDialog}
                  tooltip="CV uploaden (PDF of Word)"
                >
                  <Plus className="h-4 w-4 lg:hidden" />
                  <Upload className="hidden h-3.5 w-3.5 lg:inline-block" />
                  <span className="hidden lg:inline">CV uploaden</span>
                </PromptInputButton>

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
                  <PromptInputSelectTrigger className="hidden h-8 w-auto gap-1 px-2 text-xs lg:inline-flex">
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

        <p className="hidden px-1 text-xs text-muted-foreground lg:block" id={composerHintId}>
          {composerHint}
        </p>
      </div>
    </div>
  );
}
