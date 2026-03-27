"use client";

import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

// ---------- Types ----------

interface AgentEvent {
  id: string;
  sourceAgent: string;
  eventType: string;
  candidateId: string | null;
  jobId: string | null;
  matchId: string | null;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ---------- Constants ----------

const AGENT_COLORS: Record<string, string> = {
  intake: "bg-blue-500/10 text-blue-600 border-blue-200",
  matcher: "bg-purple-500/10 text-purple-600 border-purple-200",
  screener: "bg-amber-500/10 text-amber-600 border-amber-200",
  scheduler: "bg-green-500/10 text-green-600 border-green-200",
  sourcing: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  communicator: "bg-pink-500/10 text-pink-600 border-pink-200",
  orchestrator: "bg-gray-500/10 text-gray-600 border-gray-200",
};

const AGENT_ICONS: Record<string, typeof Bot> = {
  intake: Users,
  matcher: Zap,
  screener: Phone,
  scheduler: Calendar,
  sourcing: Search,
  communicator: Mail,
  orchestrator: Bot,
};

const EVENT_LABELS: Record<string, string> = {
  "candidate.parsed": "Kandidaat verwerkt",
  "candidate.enriched": "Kandidaat verrijkt",
  "candidate.embedded": "Embedding gegenereerd",
  "match.created": "Match aangemaakt",
  "match.updated": "Match bijgewerkt",
  "match.batch_completed": "Match batch voltooid",
  "screening.requested": "Screening aangevraagd",
  "screening.started": "Screening gestart",
  "screening.completed": "Screening afgerond",
  "interview.scheduled": "Interview ingepland",
  "interview.reminder_sent": "Herinnering verzonden",
  "sourcing.search_completed": "Zoekactie voltooid",
  "sourcing.candidate_found": "Kandidaat gevonden",
  "notification.email_sent": "E-mail verzonden",
  "notification.whatsapp_sent": "WhatsApp verzonden",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  pending: Clock,
  processing: RefreshCw,
  failed: AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-green-500",
  pending: "text-gray-400",
  processing: "text-blue-500 animate-spin",
  failed: "text-red-500",
};

// ---------- Component ----------

export function AgentActivityFeed() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (filter) params.set("sourceAgent", filter);

      const res = await fetch(`/api/agent-events?${params}`);
      if (res.ok) {
        const json = await res.json();
        setEvents(json.data ?? []);
      }
    } catch {
      // Silently fail — SSE will provide real-time updates
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial fetch + polling every 10s
  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Also listen to SSE for instant updates
  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("message", () => {
      // Refetch on any event
      fetchEvents();
    });

    // Listen for specific agent events
    for (const eventType of Object.keys(EVENT_LABELS)) {
      es.addEventListener(`agent:${eventType}`, () => {
        fetchEvents();
      });
    }

    return () => es.close();
  }, [fetchEvents]);

  const agents = ["intake", "matcher", "screener", "scheduler", "sourcing", "communicator"];

  function formatTime(isoString: string): string {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return "zojuist";
    if (diffMin < 60) return `${diffMin}m geleden`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}u geleden`;
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  return (
    <div className="space-y-4">
      {/* Agent filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filter === null
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Alle agents
        </button>
        {agents.map((agent) => {
          const Icon = AGENT_ICONS[agent] ?? Bot;
          return (
            <button
              key={agent}
              type="button"
              onClick={() => setFilter(filter === agent ? null : agent)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === agent
                  ? "bg-gray-900 text-white"
                  : `${AGENT_COLORS[agent]} hover:opacity-80`
              }`}
            >
              <Icon className="h-3 w-3" />
              {agent.charAt(0).toUpperCase() + agent.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <div key={`skeleton-${i}`} className="h-14 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Bot className="mb-2 h-8 w-8" />
          <p className="text-sm">Nog geen agent activiteit</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const AgentIcon = AGENT_ICONS[event.sourceAgent] ?? Bot;
            const StatusIcon = STATUS_ICON[event.status] ?? Clock;
            const agentColor = AGENT_COLORS[event.sourceAgent] ?? "";
            const statusColor = STATUS_COLOR[event.status] ?? "text-gray-400";
            const label = EVENT_LABELS[event.eventType] ?? event.eventType;
            const payload = event.payload as Record<string, unknown>;

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:bg-gray-50"
              >
                <div className={`rounded-lg p-2 ${agentColor}`}>
                  <AgentIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {event.sourceAgent}
                    </Badge>
                  </div>

                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {payload.candidateName && `${payload.candidateName}`}
                    {payload.jobTitle && ` → ${payload.jobTitle}`}
                    {payload.score && ` (${payload.score}%)`}
                    {payload.matchCount != null && ` • ${payload.matchCount} matches`}
                    {payload.emailId && ` • verzonden`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                  <span className="whitespace-nowrap text-[10px] text-gray-400">
                    {formatTime(event.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
