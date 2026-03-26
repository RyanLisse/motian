#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMotianMCPServer } from "./create-server.js";

const server = createMotianMCPServer();
const transport = new StdioServerTransport();
await server.connect(transport);
