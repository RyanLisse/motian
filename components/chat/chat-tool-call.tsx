"use client";

import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  // Opdrachten
  queryOpdrachten: "Opdrachten zoeken",
  getOpdrachtDetail: "Opdracht details ophalen",
  matchKandidaten: "Kandidaten matchen",
  analyseData: "Data analyseren",
  triggerScraper: "Scraper starten",
  // Kandidaten
  zoekKandidaten: "Kandidaten zoeken",
  getKandidaatDetail: "Kandidaat details ophalen",
  maakKandidaatAan: "Kandidaat aanmaken",
  updateKandidaat: "Kandidaat bijwerken",
  verwijderKandidaat: "Kandidaat verwijderen",
  // Matches
  zoekMatches: "Matches zoeken",
  getMatchDetail: "Match details ophalen",
  keurMatchGoed: "Match goedkeuren",
  wijsMatchAf: "Match afwijzen",
  // Sollicitaties
  zoekSollicitaties: "Sollicitaties zoeken",
  getSollicitatieDetail: "Sollicitatie details ophalen",
  maakSollicitatieAan: "Sollicitatie aanmaken",
  updateSollicitatieFase: "Sollicitatie fase bijwerken",
  verwijderSollicitatie: "Sollicitatie verwijderen",
  getSollicitatieStats: "Pipeline statistieken",
  // Interviews
  zoekInterviews: "Interviews zoeken",
  getInterviewDetail: "Interview details ophalen",
  planInterview: "Interview inplannen",
  updateInterview: "Interview bijwerken",
  verwijderInterview: "Interview verwijderen",
  // Berichten
  zoekBerichten: "Berichten zoeken",
  getBerichtDetail: "Bericht details ophalen",
  stuurBericht: "Bericht versturen",
  verwijderBericht: "Bericht verwijderen",
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
    <div className="my-1.5 rounded-md border border-border bg-secondary text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
      >
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
        <span className="flex-1 font-medium text-foreground">{label}</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {input != null && (
            <div>
              <span className="text-muted-foreground">Input:</span>
              <pre className="mt-1 overflow-auto rounded bg-background p-2 text-muted-foreground">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output != null && (
            <div>
              <span className="text-muted-foreground">Output:</span>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-background p-2 text-muted-foreground">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
