import { AlertTriangle, ArrowRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { TrendInsight, TrendInsightsResult } from "@/src/services/trend-insights";

const TYPE_STYLES: Record<
  TrendInsight["type"],
  { badge: string; iconClass: string; Icon: typeof Sparkles; label: string }
> = {
  kans: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    iconClass: "bg-emerald-500/10 text-emerald-600",
    Icon: Lightbulb,
    label: "Kans",
  },
  trend: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    iconClass: "bg-blue-500/10 text-blue-600",
    Icon: TrendingUp,
    label: "Trend",
  },
  risico: {
    badge: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    iconClass: "bg-red-500/10 text-red-600",
    Icon: AlertTriangle,
    label: "Risico",
  },
  actie: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    iconClass: "bg-amber-500/10 text-amber-600",
    Icon: Sparkles,
    label: "Actie",
  },
};

const PRIORITY_STYLES: Record<TrendInsight["priority"], string> = {
  hoog: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  gemiddeld: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  laag: "border-border bg-muted text-muted-foreground",
};

export function AiInsightsCard({ result }: { result: TrendInsightsResult }) {
  if (result.insights.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{result.summary}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{result.summary}</p>
        <Badge
          variant="outline"
          className="shrink-0 border-border text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          {result.source === "ai" ? "AI-analyse" : "Regel-analyse"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {result.insights.map((insight, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: AI-generated list is stable within a render and titles may repeat
          <InsightTile key={`${insight.type}-${index}-${insight.title}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightTile({ insight }: { insight: TrendInsight }) {
  const typeStyle = TYPE_STYLES[insight.type];
  const Icon = typeStyle.Icon;
  const body = (
    <div className="flex h-full flex-col rounded-lg border border-border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-accent">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeStyle.iconClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={typeStyle.badge}>
            {typeStyle.label}
          </Badge>
          <Badge variant="outline" className={PRIORITY_STYLES[insight.priority]}>
            {insight.priority === "hoog"
              ? "Hoog"
              : insight.priority === "gemiddeld"
                ? "Medium"
                : "Laag"}
          </Badge>
        </div>
      </div>

      <h4 className="mt-3 text-sm font-semibold text-foreground">{insight.title}</h4>
      <p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{insight.description}</p>

      {(insight.metricLabel || insight.metricValue) && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-muted/40 px-2 py-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {insight.metricLabel ?? "Metric"}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {insight.metricValue ?? "—"}
          </span>
        </div>
      )}

      {insight.href && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          Open
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  if (insight.href) {
    return (
      <Link href={insight.href} className="h-full">
        {body}
      </Link>
    );
  }

  return <div className="h-full">{body}</div>;
}
