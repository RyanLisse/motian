import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/node";
import { allHandlers, allTools } from "./tools/index";

const SENTRY_DSN = process.env.SENTRY_DSN;

/**
 * Registers ListTools and CallTool request handlers on a raw MCP Server.
 * Shared between the stdio entrypoint and the Vercel HTTP adapter.
 */
function registerToolHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = allHandlers[name];
    if (!handler) {
      return {
        content: [{ type: "text" as const, text: `Onbekende tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const result = await handler(args ?? {});
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      if (SENTRY_DSN) Sentry.captureException(err);
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Fout: ${message}` }],
        isError: true,
      };
    }
  });
}

/**
 * Creates a configured MCP Server with all Motian recruitment tools registered.
 * Used by the stdio transport entrypoint (`server.ts`).
 */
export function createMotianMCPServer(): Server {
  if (SENTRY_DSN) {
    Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });
  }

  const server = new Server(
    { name: "motian-recruitment", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerToolHandlers(server);
  return server;
}

/**
 * Initializes Motian tools on an McpServer instance (high-level API).
 * Used by the Vercel MCP adapter which provides its own McpServer.
 *
 * Registers tools via the underlying raw Server to reuse existing
 * tool definitions without converting to the McpServer.tool() format.
 */
export function initializeMotianTools(mcpServerOrRaw: Server | { server: Server }): void {
  const server = "server" in mcpServerOrRaw ? mcpServerOrRaw.server : mcpServerOrRaw;
  registerToolHandlers(server);
}
