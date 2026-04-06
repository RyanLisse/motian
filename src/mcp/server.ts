#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAiPlatformRuntimeEnv } from "@motian/ai-platform";
import { createMotianMCPServer } from "./create-server.js";

loadAiPlatformRuntimeEnv(import.meta.url);

const server = createMotianMCPServer();
const transport = new StdioServerTransport();
await server.connect(transport);
