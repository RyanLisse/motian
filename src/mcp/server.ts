#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/nextjs";
import { allHandlers, allTools } from "./tools/index.js";

Sentry.init({
  dsn: "https://f13da1ff32b7d1f499309c7040de8fae@o4507090437668864.ingest.de.sentry.io/4510936878481488",
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
});

const server = new Server(
  { name: "motian-recruitment", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = allHandlers[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Onbekende tool: ${name}` }],
      isError: true,
    };
  }
  try {
    const result = await handler(args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Fout: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
