import { createMcpHandler } from "mcp-handler";
import { initializeMotianTools } from "@/src/mcp/create-server";

const handler = createMcpHandler(
  (server: Parameters<typeof initializeMotianTools>[0]) => {
    initializeMotianTools(server);
  },
  {
    serverInfo: {
      name: "motian-recruitment",
      version: "0.1.0",
    },
    capabilities: { tools: {} },
  },
  {
    basePath: "/api/mcp",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
