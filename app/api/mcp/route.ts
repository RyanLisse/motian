import { createMcpHandler } from "mcp-handler";
import { requirePrincipal } from "@/src/lib/api-auth";
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

async function withPrincipal(...args: Parameters<typeof handler>): Promise<Response> {
  const [request] = args;
  const principalOrResponse = await requirePrincipal(request);
  if (principalOrResponse instanceof Response) {
    return principalOrResponse;
  }
  return handler(...args);
}

export const GET = withPrincipal;
export const POST = withPrincipal;
export const DELETE = withPrincipal;
