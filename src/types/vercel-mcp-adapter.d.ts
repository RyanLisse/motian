declare module "@vercel/mcp-adapter" {
  import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

  type ServerOptions = {
    name: string;
    version: string;
  };

  type Capabilities = {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
  };

  type HandlerOptions = {
    basePath?: string;
    maxDuration?: number;
    redisUrl?: string;
  };

  type RouteHandler = (req: Request) => Response | Promise<Response>;

  export function createMcpHandler(
    initializeServer: (server: Server) => void,
    serverOptions?: { serverInfo?: ServerOptions; capabilities?: Capabilities },
    handlerOptions?: HandlerOptions,
  ): RouteHandler;
}
