"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";

const TOOL_LABELS: Record<string, string> = {
  queryOpdrachten: "Opdrachten zoeken",
  getOpdrachtDetail: "Opdracht details ophalen",
  matchKandidaten: "Kandidaten matchen",
  analyseData: "Data analyseren",
  triggerScraper: "Scraper starten",
};

type ToolCallProps = {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
};

export function ChatToolCall({ toolName, state, input, output }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolName] ?? toolName;
  const isDone = state === "output-available";

  return (
    <div className="my-1.5 rounded-md border border-[#2d2d2d] bg-[#1a1a1a] text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#222]"
      >
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8e8e8e]" />
        )}
        <span className="flex-1 font-medium text-[#ccc]">{label}</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[#666]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[#666]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#2d2d2d] px-3 py-2 space-y-2">
          {input != null && (
            <div>
              <span className="text-[#666]">Input:</span>
              <pre className="mt-1 overflow-auto rounded bg-[#111] p-2 text-[#999]">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output != null && (
            <div>
              <span className="text-[#666]">Output:</span>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-[#111] p-2 text-[#999]">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
