import { Activity, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PipelineHealthSnapshot } from "@/src/services/recruiter-insights";

const toneClasses = {
  goed: "border-primary/20 bg-primary/10 text-primary",
  "let-op": "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  actie: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
} as const;

export function PipelineHealthCard({ health }: { health: PipelineHealthSnapshot }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Pipeline health</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{health.summary}</p>
        </div>
        <Badge variant="outline" className={toneClasses[health.status]}>
          {health.status === "goed" ? "Gezond" : health.status === "let-op" ? "Let op" : "Actie nodig"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {health.items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="rounded-lg border border-border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{item.value}</p>
              </div>
              <Badge variant="outline" className={toneClasses[item.tone]}>
                {item.tone === "goed" ? "Ok" : item.tone === "let-op" ? "Check" : "Fix"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Open
              <ArrowRight className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>

      {health.items.some((item) => item.tone === "actie") ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Minstens één kernsignaal vraagt operationele opvolging voordat recruiters volledig op de ranking kunnen vertrouwen.</span>
        </div>
      ) : null}
    </div>
  );
}
