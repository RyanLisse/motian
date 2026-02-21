import { describe, test, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

// ========== 1. Messages Service Exports ==========

describe("Messages service exports", () => {
  test("listMessages is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(typeof svc.listMessages).toBe("function");
  });

  test("getMessageById is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(typeof svc.getMessageById).toBe("function");
  });

  test("createMessage is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(typeof svc.createMessage).toBe("function");
  });

  test("getMessagesByApplication is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(typeof svc.getMessagesByApplication).toBe("function");
  });
});

// ========== 2. Messages API Routes ==========

describe("Messages API routes exist", () => {
  test("GET/POST /api/messages", () => {
    expect(existsSync(resolve(ROOT, "app/api/messages/route.ts"))).toBe(true);
  });

  test("GET /api/messages/[id]", () => {
    expect(existsSync(resolve(ROOT, "app/api/messages/[id]/route.ts"))).toBe(true);
  });
});

// ========== 3. Messages API Handlers ==========

describe("Messages API route handlers", () => {
  test("messages route exports GET and POST", async () => {
    const mod = await import("../app/api/messages/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });

  test("messages/[id] route exports GET", async () => {
    const mod = await import("../app/api/messages/[id]/route");
    expect(typeof mod.GET).toBe("function");
  });
});

// ========== 4. CLI ==========

describe("CLI commands for messages", () => {
  test("messages CLI file exists", () => {
    expect(existsSync(resolve(ROOT, "cli/commands/messages.ts"))).toBe(true);
  });

  test("messages CLI exports registerMessagesCommand", async () => {
    const mod = await import("../cli/commands/messages");
    expect(typeof mod.registerMessagesCommand).toBe("function");
  });
});

// ========== 5. Constants ==========

describe("Messages constants", () => {
  test("VALID_DIRECTIONS is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(svc.VALID_DIRECTIONS).toBeDefined();
    expect(svc.VALID_DIRECTIONS).toContain("inbound");
    expect(svc.VALID_DIRECTIONS).toContain("outbound");
  });

  test("VALID_CHANNELS is exported", async () => {
    const svc = await import("../src/services/messages");
    expect(svc.VALID_CHANNELS).toBeDefined();
    expect(svc.VALID_CHANNELS).toContain("email");
    expect(svc.VALID_CHANNELS).toContain("phone");
    expect(svc.VALID_CHANNELS).toContain("platform");
  });
});
