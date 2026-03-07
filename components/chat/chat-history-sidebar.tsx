"use client";

import { Clock, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ChatSessionSummary = {
  id: string;
  sessionId: string;
  title: string | null;
  lastMessagePreview: string | null;
  messageCount: number | null;
  updatedAt: string | null;
};

type Props = {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onClose?: () => void;
  refreshToken?: number;
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d geleden`;
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function ChatHistorySidebar({
  activeSessionId,
  onSelectSession,
  onNewSession,
  onClose,
  refreshToken,
}: Props) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (refreshToken != null) {
        params.set("refresh", String(refreshToken));
      }

      const res = await fetch(`/api/chat-sessies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch (err) {
      console.error("[ChatHistorySidebar] Fetch sessions failed:", err);
    }
  }, [refreshToken]);

  useEffect(() => {
    let cancelled = false;

    void fetchSessions().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchSessions]);

  const handleDelete = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Dit gesprek verwijderen?")) return;

    try {
      const res = await fetch(`/api/chat-sessies/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      }
    } catch (err) {
      console.error("[ChatHistorySidebar] Delete session failed:", err);
    }
  }, []);

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold text-foreground">Gesprekken</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onNewSession}
            title="Nieuw gesprek"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              title="Sluiten"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-muted-foreground">Laden...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
            <span className="text-xs">Nog geen gesprekken</span>
          </div>
        ) : (
          <div className="py-1">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session.sessionId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession(session.sessionId);
                  }
                }}
                className={`group flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                  activeSessionId === session.sessionId ? "bg-accent" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {session.title || "Nieuw gesprek"}
                  </p>
                  {session.lastMessagePreview ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {session.lastMessagePreview}
                    </p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {timeAgo(session.updatedAt)}
                    </span>
                    {session.messageCount ? <span>{session.messageCount} berichten</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, session.sessionId)}
                  className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Verwijderen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
