import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSalesforceFeed } = vi.hoisted(() => ({
  mockGetSalesforceFeed: vi.fn(),
}));

vi.mock("../src/mcp/tools/advanced-matching.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/analytics.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/gdpr-ops.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/kandidaten.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/matches.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/pipeline.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/platforms.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/mcp/tools/vacatures.js", () => ({
  handlers: {},
  tools: [],
}));

vi.mock("../src/services/salesforce-feed", async () => {
  const actual = await vi.importActual<typeof import("../src/services/salesforce-feed")>(
    "../src/services/salesforce-feed",
  );

  return {
    ...actual,
    getSalesforceFeed: mockGetSalesforceFeed,
  };
});

import { allHandlers, allTools } from "../src/mcp/tools/index";

describe("salesforce MCP tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSalesforceFeed.mockResolvedValue([]);
  });

  it("registers an MCP Salesforce feed tool that returns XML from the shared feed service", async () => {
    mockGetSalesforceFeed.mockResolvedValue([
      {
        objectType: "Job__c",
        fields: {
          Id: "job-1",
          Name: "Architect & Integratie",
          LastModifiedDate: new Date("2026-03-02T12:00:00.000Z"),
        },
      },
    ]);

    const tool = allTools.find((entry) => entry.name === "salesforce_feed");
    const handler = allHandlers.salesforce_feed;

    expect(tool).toBeDefined();
    expect(handler).toBeTypeOf("function");

    const result = await handler({
      entity: "jobs",
      status: "open",
      updatedSince: "2026-03-01T00:00:00.000Z",
      limit: 10,
      offset: 20,
    });

    const args = mockGetSalesforceFeed.mock.calls[0]?.[0];

    expect(args).toMatchObject({
      entity: "jobs",
      status: "open",
      limit: 10,
      offset: 20,
    });
    expect(args.updatedSince.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(result).toMatchObject({
      entity: "jobs",
      count: 1,
    });
    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain("<type>Job__c</type>");
    expect(result.xml).toContain("<Name>Architect &amp; Integratie</Name>");
  });
});
