import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { describe, expect, it } from "vitest";
import { createMotianMCPServer, initializeMotianTools } from "@/src/mcp/create-server";
import { allTools } from "@/src/mcp/tools/index";

type HandlerFn = (...args: never[]) => unknown;

/**
 * Helper: invoke a registered request handler on a Server instance
 * by iterating the internal _requestHandlers map keyed by schema method string.
 */
async function invokeHandler(
  server: Server,
  method: string,
  // biome-ignore lint/suspicious/noExplicitAny: test helper needs dynamic request shape
  request: any,
) {
  // biome-ignore lint/suspicious/noExplicitAny: accessing SDK private API for testing
  const handlers = (server as any)._requestHandlers as Map<string, HandlerFn>;
  const handler = handlers.get(method);
  if (!handler) throw new Error(`No handler for ${method}`);
  return handler(request, {});
}

describe("createMotianMCPServer", () => {
  it("returns a Server instance with connect and close methods", () => {
    const server = createMotianMCPServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(Server);
    expect(typeof server.connect).toBe("function");
    expect(typeof server.close).toBe("function");
  });

  it("registers all expected tool names from allTools", async () => {
    const server = createMotianMCPServer();

    const listResult = await invokeHandler(server, "tools/list", {
      method: "tools/list",
    });

    expect(listResult).toBeDefined();
    expect(listResult.tools).toBeDefined();
    expect(Array.isArray(listResult.tools)).toBe(true);

    const registeredNames = listResult.tools.map((t: { name: string }) => t.name);
    const expectedNames = allTools.map((t) => t.name);

    expect(registeredNames).toEqual(expectedNames);
    expect(registeredNames.length).toBeGreaterThan(0);
  });

  it("returns error for unknown tool name", async () => {
    const server = createMotianMCPServer();

    const result = await invokeHandler(server, "tools/call", {
      method: "tools/call",
      params: { name: "nonexistent_tool_xyz", arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Onbekende tool");
  });
});

describe("initializeMotianTools", () => {
  it("is a function that accepts an McpServer-like object", () => {
    expect(typeof initializeMotianTools).toBe("function");
  });

  it("registers handlers on the underlying raw Server", () => {
    const rawServer = new Server(
      { name: "test", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );

    initializeMotianTools({ server: rawServer });

    // biome-ignore lint/suspicious/noExplicitAny: accessing SDK private API for testing
    const handlers = (rawServer as any)._requestHandlers as Map<string, HandlerFn>;
    expect(handlers.has("tools/list")).toBe(true);
    expect(handlers.has("tools/call")).toBe(true);
  });
});
