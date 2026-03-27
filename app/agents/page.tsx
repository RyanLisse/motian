import { Activity, AlertTriangle, Bot, CheckCircle2, Clock, TrendingUp, Zap } from "lucide-react";
import { Suspense } from "react";
import { AgentActivityFeed } from "@/components/agents/activity-feed";
import { PipelineVisualization } from "@/components/agents/pipeline-visualization";
import { KPICard } from "@/components/shared/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentDashboardData } from "./data";

export const revalidate = 30;

// ---------- Server Data Component ----------

async function AgentDashboardContent() {
  const { kpi, agentCounts24h, typeCounts24h } = await getAgentDashboardData();

  // Map event types to pipeline step counts
  const stepCounts: Record<string, number> = {
    cv_drop: typeCounts24h["candidate.parsed"] ?? 0,
    parse_enrich:
      (typeCounts24h["candidate.enriched"] ?? 0) + (typeCounts24h["candidate.embedded"] ?? 0),
    match: (typeCounts24h["match.created"] ?? 0) + (typeCounts24h["match.batch_completed"] ?? 0),
    screen:
      (typeCounts24h["screening.requested"] ?? 0) + (typeCounts24h["screening.completed"] ?? 0),
    schedule: typeCounts24h["interview.scheduled"] ?? 0,
    notify:
      (typeCounts24h["notification.email_sent"] ?? 0) +
      (typeCounts24h["notification.whatsapp_sent"] ?? 0),
    sourcing: typeCounts24h["sourcing.candidate_found"] ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          label="Events (24u)"
          value={kpi.events24h}
          icon={<Activity className="h-4 w-4" />}
        />
        <KPICard
          label="Totaal verwerkt"
          value={kpi.totalEvents}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard label="In wachtrij" value={kpi.pending} icon={<Clock className="h-4 w-4" />} />
        <KPICard
          label="Voltooid"
          value={kpi.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KPICard label="Mislukt" value={kpi.failed} icon={<AlertTriangle className="h-4 w-4" />} />
        <KPICard
          label="Slagingspercentage"
          value={`${kpi.successRate}%`}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* Pipeline Visualization */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <PipelineVisualization stepCounts={stepCounts} />
      </div>

      {/* Agent Activity Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Agent Activiteit (24 uur)</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {["intake", "matcher", "screener", "scheduler", "sourcing", "communicator"].map(
            (agent) => (
              <div
                key={agent}
                className="flex flex-col items-center rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <span className="text-2xl font-bold text-gray-900">
                  {agentCounts24h[agent] ?? 0}
                </span>
                <span className="mt-1 text-xs capitalize text-gray-500">{agent}</span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Bot className="h-4 w-4" />
          Live Activiteit Feed
        </h3>
        <AgentActivityFeed />
      </div>
    </div>
  );
}

// ---------- Loading skeleton ----------

function AgentDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`kpi-${i}`} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

// ---------- Page ----------

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overzicht van alle autonome agents en hun activiteit
        </p>
      </div>

      <Suspense fallback={<AgentDashboardSkeleton />}>
        <AgentDashboardContent />
      </Suspense>
    </div>
  );
}
