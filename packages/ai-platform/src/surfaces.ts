export type AiPlatformSurfaceRole = "owner" | "consumer" | "adapter";

export type AiPlatformSurface = {
  id: string;
  name: string;
  runtime: string;
  role: AiPlatformSurfaceRole;
  entrypoint: string;
};

export const MOTIAN_AI_PLATFORM_SURFACES: readonly AiPlatformSurface[] = [
  {
    id: "chat",
    name: "Chat agent",
    runtime: "Next.js web runtime",
    role: "owner",
    entrypoint: "src/ai/agent.ts",
  },
  {
    id: "mcp",
    name: "MCP server",
    runtime: "Node stdio runtime",
    role: "adapter",
    entrypoint: "src/mcp/server.ts",
  },
  {
    id: "voice",
    name: "Voice agent",
    runtime: "LiveKit voice runtime",
    role: "adapter",
    entrypoint: "src/voice-agent/agent.ts",
  },
  {
    id: "autopilot",
    name: "Autopilot",
    runtime: "Background analysis/runtime",
    role: "owner",
    entrypoint: "src/autopilot/index.ts",
  },
] as const;
