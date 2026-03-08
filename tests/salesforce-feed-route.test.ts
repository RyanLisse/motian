import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSalesforceFeed } = vi.hoisted(() => ({
  mockGetSalesforceFeed: vi.fn(),
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

import { GET } from "../app/api/salesforce-feed/route";

describe("GET /api/salesforce-feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSalesforceFeed.mockResolvedValue([]);
  });

  it("defaults to applications and forwards filters with XML response headers", async () => {
    const request = new Request(
      "http://localhost/api/salesforce-feed?status=screening&updatedSince=2026-03-01T10:00:00.000Z&page=2&limit=25",
    );

    const response = await GET(request);
    const body = await response.text();
    const args = mockGetSalesforceFeed.mock.calls[0]?.[0];

    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain("<sObjects>");
    expect(args.entity).toBe("applications");
    expect(args.status).toBe("screening");
    expect(args.limit).toBe(25);
    expect(args.offset).toBe(25);
    expect(args.updatedSince.toISOString()).toBe("2026-03-01T10:00:00.000Z");
  });

  it("renders Salesforce XML with sObject entries and escaped values", async () => {
    mockGetSalesforceFeed.mockResolvedValue([
      {
        objectType: "Job__c",
        fields: {
          Id: "job-1",
          Name: "R&D <Lead>",
          Status__c: "open",
          LastModifiedDate: new Date("2026-03-01T00:00:00.000Z"),
          Remote__c: true,
        },
      },
    ]);

    const response = await GET(new Request("http://localhost/api/salesforce-feed?entity=jobs"));
    const body = await response.text();

    expect(body).toContain("<sObject>");
    expect(body).toContain("<type>Job__c</type>");
    expect(body).toContain("<Id>job-1</Id>");
    expect(body).toContain("<Name>R&amp;D &lt;Lead&gt;</Name>");
    expect(body).toContain("<Remote__c>true</Remote__c>");
    expect(body).toContain("<LastModifiedDate>2026-03-01T00:00:00.000Z</LastModifiedDate>");
  });

  it("rejects unsupported entities", async () => {
    const response = await GET(new Request("http://localhost/api/salesforce-feed?entity=contacts"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ongeldige entity. Gebruik jobs, candidates of applications.",
    });
  });
});
