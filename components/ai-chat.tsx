"use client";

import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import {
  Bot,
  Sparkles,
  X,
  Send,
  User,
  Loader2,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Search,
  Users,
  Briefcase,
  Zap,
  Calendar,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolEvent[];
}

interface ToolEvent {
  tool: string;
  args?: Record<string, unknown>;
  result?: unknown;
  status: "running" | "done" | "error";
}

// ── Tool display config ────────────────────────────

const TOOL_META: Record<string, { label: string; icon: typeof Search }> = {
  search_candidates: { label: "Kandidaten zoeken", icon: Search },
  search_jobs: { label: "Opdrachten zoeken", icon: Briefcase },
  get_candidate_details: { label: "Kandidaat details", icon: Users },
  get_job_details: { label: "Opdracht details", icon: Briefcase },
  match_candidate_to_job: { label: "Matching analyse", icon: Zap },
  update_candidate_status: { label: "Status wijzigen", icon: CheckCircle2 },
  schedule_interview: { label: "Interview plannen", icon: Calendar },
  send_message: { label: "Bericht versturen", icon: MessageSquare },
  get_pipeline_overview: { label: "Pipeline overzicht", icon: BarChart3 },
  get_platform_stats: { label: "Platform statistieken", icon: BarChart3 },
};

// ── Quick actions ──────────────────────────────────

const QUICK_ACTIONS = [
  "Wie zijn de beste kandidaten?",
  "Pipeline status",
  "Match Jan aan Full-Stack",
];

// ── Component ──────────────────────────────────────

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Ik ben je recruitment agent. Ik kan kandidaten zoeken, matchen, interviews plannen en berichten sturen. Wat wil je doen?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTools]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const trimmed = text.trim();

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setActiveTools([]);

      // Build history for API
      const history = [
        ...messages
          .filter((m) => m.id !== "init")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: trimmed },
      ];

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.ok) {
          const errData = await res.json();
          if (errData.error === "NO_API_KEY") {
            // Fallback to local mode
            setMessages((prev) => [
              ...prev,
              {
                id: `bot-${Date.now()}`,
                role: "assistant",
                content: "Geen API key geconfigureerd. Voeg ANTHROPIC_API_KEY of OPENAI_API_KEY toe aan .env.local om de AI agent te activeren.",
              },
            ]);
            setIsLoading(false);
            return;
          }
          throw new Error(errData.message || "API fout");
        }

        // Parse SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Geen stream beschikbaar");

        const decoder = new TextDecoder();
        let buffer = "";
        let finalText = "";
        const collectedTools: ToolEvent[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case "tool_use": {
                const toolEvent: ToolEvent = {
                  tool: data.tool,
                  args: data.args,
                  status: "running",
                };
                collectedTools.push(toolEvent);
                setActiveTools([...collectedTools]);
                break;
              }
              case "tool_result": {
                const last = [...collectedTools].reverse().find((t) => t.tool === data.tool && t.status === "running");
                if (last) {
                  last.status = "done";
                  last.result = data.result;
                  setActiveTools([...collectedTools]);
                }
                break;
              }
              case "text":
                finalText = data.content;
                break;
              case "error":
                finalText = `Fout: ${data.message}`;
                break;
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: finalText || "Klaar.",
            toolCalls: collectedTools.length > 0 ? collectedTools : undefined,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: "assistant",
            content: `Er ging iets mis: ${err instanceof Error ? err.message : "Onbekende fout"}`,
          },
        ]);
      } finally {
        setIsLoading(false);
        setActiveTools([]);
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ── Floating button ─────────────────────────────

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-[#10a37f] hover:bg-[#0d8c6d] text-white shadow-lg shadow-[#10a37f]/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Open AI chat"
      >
        <Bot className="h-5 w-5" />
      </button>
    );
  }

  // ── Chat panel ──────────────────────────────────

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[400px] flex flex-col bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      style={{ height: "75vh" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d2d] bg-[#171717] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#10a37f]/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#10a37f]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#ececec] leading-tight">
              Recruitment Agent
            </p>
            <p className="text-[10px] text-[#6b6b6b] leading-tight">
              Agent-native &bull; 10 tools beschikbaar
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="h-7 w-7 rounded-md flex items-center justify-center text-[#6b6b6b] hover:text-[#ececec] hover:bg-[#2d2d2d] transition-colors"
          aria-label="Sluit chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#2d2d2d] shrink-0 overflow-x-auto">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => sendMessage(action)}
            disabled={isLoading}
            className="text-[11px] px-2.5 py-1 rounded-full border border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] hover:border-[#10a37f] hover:bg-[#10a37f]/5 transition-colors whitespace-nowrap disabled:opacity-30"
          >
            {action}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`flex items-end gap-2 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-[#10a37f]/15 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-[#10a37f]" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-[#10a37f] text-white rounded-br-sm"
                    : "bg-[#171717] text-[#ececec] border border-[#2d2d2d] rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-[#2d2d2d] flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-[#8e8e8e]" />
                </div>
              )}
            </div>

            {/* Tool calls display */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="ml-8 mt-2 space-y-1">
                {msg.toolCalls.map((tc, i) => {
                  const meta = TOOL_META[tc.tool] || { label: tc.tool, icon: Wrench };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px] text-[#6b6b6b] px-2.5 py-1.5 rounded-lg bg-[#0d0d0d] border border-[#2d2d2d]"
                    >
                      <Icon className="h-3 w-3 text-[#10a37f] shrink-0" />
                      <span className="text-[#8e8e8e]">{meta.label}</span>
                      <CheckCircle2 className="h-3 w-3 text-[#10a37f] ml-auto shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Active tool execution */}
        {isLoading && activeTools.length > 0 && (
          <div className="ml-8 space-y-1">
            {activeTools.map((tc, i) => {
              const meta = TOOL_META[tc.tool] || { label: tc.tool, icon: Wrench };
              const Icon = meta.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px] text-[#6b6b6b] px-2.5 py-1.5 rounded-lg bg-[#0d0d0d] border border-[#2d2d2d]"
                >
                  <Icon className="h-3 w-3 text-[#10a37f] shrink-0" />
                  <span className="text-[#8e8e8e]">{meta.label}</span>
                  {tc.status === "running" ? (
                    <Loader2 className="h-3 w-3 text-[#10a37f] animate-spin ml-auto shrink-0" />
                  ) : tc.status === "done" ? (
                    <CheckCircle2 className="h-3 w-3 text-[#10a37f] ml-auto shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-400 ml-auto shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && activeTools.length === 0 && (
          <div className="flex items-end gap-2">
            <div className="h-6 w-6 rounded-full bg-[#10a37f]/15 flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3 text-[#10a37f]" />
            </div>
            <div className="bg-[#171717] border border-[#2d2d2d] rounded-xl rounded-bl-sm px-3 py-2 text-sm text-[#6b6b6b] flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Aan het denken...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-[#2d2d2d] bg-[#171717] shrink-0"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Vraag de agent iets..."
          className="flex-1 bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] text-sm placeholder:text-[#6b6b6b] focus-visible:ring-[#10a37f]/30"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || isLoading}
          className="h-8 w-8 p-0 bg-[#10a37f] hover:bg-[#0d8c6d] text-white disabled:opacity-30"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
