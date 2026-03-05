"use client";

import {
  type AgentState,
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
} from "@livekit/components-react";
import { TokenSource } from "livekit-client";
import { Mic } from "lucide-react";
import { useMemo, useState } from "react";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { AgentChatTranscript } from "@/components/agents-ui/agent-chat-transcript";
import { AgentControlBar } from "@/components/agents-ui/agent-control-bar";
import { StartAudioButton } from "@/components/agents-ui/start-audio-button";

// ---------- State label (Dutch UI) ----------

const STATE_LABELS: Record<AgentState, string> = {
  disconnected: "Verbinding verbroken",
  connecting: "Verbinden...",
  "pre-connect-buffering": "Luisteren...",
  initializing: "Agent laden...",
  idle: "Klaar",
  listening: "Luistert...",
  thinking: "Denkt na...",
  speaking: "Spreekt...",
  failed: "Verbinding mislukt",
};

// ---------- Connected voice UI ----------

function ConnectedVoiceUI({ onEnd }: { onEnd: () => void }) {
  const agent = useAgent();
  const { messages } = useSessionMessages();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 border-b border-border px-4 py-2">
        <span
          className={`h-2 w-2 rounded-full ${
            agent.isConnected
              ? "bg-green-500"
              : agent.isPending
                ? "bg-amber-500 animate-pulse"
                : "bg-red-500"
          }`}
        />
        <span className="text-xs text-muted-foreground">{STATE_LABELS[agent.state]}</span>
      </div>

      {/* Visualizer + Transcript area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-4">
        <AgentAudioVisualizerAura
          size="xl"
          state={agent.state}
          color="#6366F1"
          audioTrack={agent.microphoneTrack}
          className="max-h-[50vh] shrink-0"
        />

        {/* Live transcript */}
        {messages.length > 0 && (
          <AgentChatTranscript
            agentState={agent.state}
            messages={messages}
            className="max-h-[30vh] w-full max-w-lg overflow-y-auto"
          />
        )}

        {/* Browser autoplay permission */}
        <StartAudioButton label="Klik om audio in te schakelen" variant="outline" />
      </div>

      {/* Control bar */}
      <div className="flex justify-center border-t border-border p-4">
        <AgentControlBar
          variant="livekit"
          isConnected={agent.isConnected || agent.isPending}
          isChatOpen={chatOpen}
          onIsChatOpenChange={setChatOpen}
          onDisconnect={onEnd}
          controls={{
            microphone: true,
            camera: false,
            screenShare: false,
            chat: true,
            leave: true,
          }}
          className="w-full max-w-md"
        />
      </div>
    </div>
  );
}

// ---------- View controller (inside SessionProvider) ----------

function VoiceViewController({ onClose }: { onClose: () => void }) {
  const { isConnected, start } = useSessionContext();

  const handleEnd = async () => {
    onClose();
  };

  // Pre-connect: show start button
  if (!isConnected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <AgentAudioVisualizerAura
          size="lg"
          state="disconnected"
          color="#6366F1"
          className="opacity-40"
        />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Motian Spraakassistent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Praat met je AI-recruiter over vacatures, kandidaten en matches
          </p>
        </div>
        <button
          type="button"
          onClick={() => start()}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Mic className="h-4 w-4" />
          Start gesprek
        </button>
      </div>
    );
  }

  // Connected: show voice UI
  return <ConnectedVoiceUI onEnd={handleEnd} />;
}

// ---------- Main voice session component ----------

export function VoiceSession({ onClose }: { onClose: () => void }) {
  const tokenSource = useMemo(
    () => TokenSource.endpoint("/api/livekit-token", { method: "POST" }),
    [],
  );

  const session = useSession(tokenSource, { agentName: "motian-voice-agent" });

  return (
    <SessionProvider session={session}>
      <VoiceViewController onClose={onClose} />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}
