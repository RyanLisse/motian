import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbExecute, mockGetSidebarMetadata } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  mockGetSidebarMetadata: vi.fn(),
}));

vi.mock("@/src/db", () => ({
  db: { execute: mockDbExecute },
  sql: (strings: TemplateStringsArray) => strings.join(""),
}));

vi.mock("@/src/db/schema", () => ({
  candidates: {},
  jobs: {},
}));

vi.mock("@/src/services/sidebar-metadata", () => ({
  getSidebarMetadata: mockGetSidebarMetadata,
}));

import { GET } from "@/app/api/debug-error/route";
import { UNAUTHORIZED_MESSAGE } from "@/src/lib/api-auth";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

describe("GET /api/debug-error (R4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbExecute.mockResolvedValue({ rows: [{ ok: 1 }] });
    mockGetSidebarMetadata.mockResolvedValue({ counts: {} });
  });

  it("returns 404 in production without leaking diagnostics", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await GET(new Request("http://localhost/api/debug-error"));
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Niet gevonden" });
      expect(mockDbExecute).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("rejects unauthenticated non-production callers with a Dutch 401", async () => {
    const previousNode = process.env.NODE_ENV;
    const previousApi = process.env.API_SECRET;
    process.env.NODE_ENV = "test";
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const response = await GET(new Request("http://localhost/api/debug-error"));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: UNAUTHORIZED_MESSAGE });
      expect(mockDbExecute).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousNode;
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  });

  it("returns only boolean/coarse fields when authenticated outside production", async () => {
    const previousNode = process.env.NODE_ENV;
    const previousApi = process.env.API_SECRET;
    process.env.NODE_ENV = "test";
    process.env.API_SECRET = TEST_API_SECRET;

    try {
      const response = await GET(
        new Request("http://localhost/api/debug-error", {
          headers: createTestAuthHeaders(TEST_API_SECRET),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;

      expect(body).toMatchObject({
        databaseConfigured: expect.any(Boolean),
        db: { connected: true },
        sidebar: { ok: true, hasData: true },
        schema: { ok: true },
      });
      expect(body).not.toHaveProperty("env");
      expect(body).not.toHaveProperty("message");
      expect(JSON.stringify(body)).not.toMatch(/stack|DATABASE_URL|tableCount|SELECT/i);
      expect(body.db).not.toHaveProperty("error");
      expect(body.db).not.toHaveProperty("result");
      expect(body.sidebar).not.toHaveProperty("error");
      expect(body.schema).not.toHaveProperty("error");
      expect(body.schema).not.toHaveProperty("tableCount");
    } finally {
      process.env.NODE_ENV = previousNode;
      if (previousApi === undefined) delete process.env.API_SECRET;
      else process.env.API_SECRET = previousApi;
    }
  }, 15_000);
});
