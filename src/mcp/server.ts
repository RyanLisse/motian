#!/usr/bin/env node
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as Sentry from "@sentry/node";
import { allHandlers, allTools } from "./tools/index.js";

const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
  });
}

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
    if (SENTRY_DSN) Sentry.captureException(err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Fout: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
