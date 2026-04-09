import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobs } = vi.hoisted(() => ({
  mockListJobs: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  listJobs: mockListJobs,
}));

import { type FeedJob, toJobRss, toJobXml } from "../src/lib/feed-formatters";

// ───── Feed Formatters ─────

const sampleJob: FeedJob = {
  id: "abc-123",
  title: "Senior Developer",
  company: "Acme BV",
  location: "Amsterdam",
  description: "Build stuff",
  platform: "huxley",
  postedAt: new Date("2025-06-01T12:00:00Z"),
  externalUrl: "https://example.com/job/1",
};

describe("toJobXml", () => {
  it("produces valid XML wrapping each job", () => {
    const xml = toJobXml([sampleJob]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<jobs>");
    expect(xml).toContain("</jobs>");
    expect(xml).toContain("<id>abc-123</id>");
    expect(xml).toContain("<title>Senior Developer</title>");
    expect(xml).toContain("<company>Acme BV</company>");
    expect(xml).toContain("<location>Amsterdam</location>");
    expect(xml).toContain("<url>https://motian.vercel.app/vacatures/abc-123</url>");
    expect(xml).toContain("<description>Build stuff</description>");
    expect(xml).toContain("<platform>huxley</platform>");
    expect(xml).toContain("<postedAt>2025-06-01T12:00:00.000Z</postedAt>");
  });

  it("handles empty array", () => {
    const xml = toJobXml([]);
    expect(xml).toContain("<jobs>");
    expect(xml).toContain("</jobs>");
    expect(xml).not.toContain("<job>");
  });

  it("escapes XML special characters", () => {
    const job: FeedJob = {
      ...sampleJob,
      title: 'Dev & Design <"Team">',
      company: "O'Reilly",
    };
    const xml = toJobXml([job]);
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).not.toContain("Dev & Design <");
  });

  it("handles null fields gracefully", () => {
    const job: FeedJob = {
      ...sampleJob,
      company: null,
      location: null,
      description: null,
      postedAt: null,
    };
    const xml = toJobXml([job]);
    expect(xml).toContain("<company />");
    expect(xml).toContain("<location />");
    expect(xml).toContain("<description />");
    expect(xml).toContain("<postedAt />");
  });
});

describe("toJobRss", () => {
  it("produces valid RSS 2.0 structure", () => {
    const rss = toJobRss([sampleJob]);
    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<rss version="2.0">');
    expect(rss).toContain("<channel>");
    expect(rss).toContain("<title>Motian Vacatures Feed</title>");
    expect(rss).toContain("<item>");
    expect(rss).toContain("<title>Senior Developer</title>");
    expect(rss).toContain("<link>https://motian.vercel.app/vacatures/abc-123</link>");
    expect(rss).toContain("<description>Build stuff</description>");
    expect(rss).toContain("<guid>abc-123</guid>");
    expect(rss).toContain("<pubDate>");
    expect(rss).toContain("</item>");
    expect(rss).toContain("</channel>");
    expect(rss).toContain("</rss>");
  });

  it("handles empty array", () => {
    const rss = toJobRss([]);
    expect(rss).toContain("<channel>");
    expect(rss).not.toContain("<item>");
  });
});

// ───── Route handler ─────

describe("GET /api/feed/vacatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobs.mockResolvedValue({ data: [sampleJob], total: 1 });
  });

  async function callRoute(searchParams: Record<string, string> = {}) {
    // Dynamic import so vi.mock is applied
    const mod = await import("../app/api/feed/vacatures/route");
    const url = new URL("http://localhost/api/feed/vacatures");
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
    const request = new Request(url.toString());
    return mod.GET(request);
  }

  it("returns XML by default with correct content-type", async () => {
    const res = await callRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const body = await res.text();
    expect(body).toContain("<jobs>");
    expect(body).toContain("<id>abc-123</id>");
  });

  it("returns JSON when format=json", async () => {
    const res = await callRoute({ format: "json" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe("abc-123");
  });

  it("returns RSS when format=rss", async () => {
    const res = await callRoute({ format: "rss" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const body = await res.text();
    expect(body).toContain("<rss");
  });

  it("sets Cache-Control header", async () => {
    const res = await callRoute();
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });

  it("passes platform filter to listJobs", async () => {
    await callRoute({ platform: "huxley" });
    expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ platform: "huxley" }));
  });

  it("passes status filter to listJobs (defaults to open)", async () => {
    await callRoute();
    expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
  });

  it("passes location as province to listJobs", async () => {
    await callRoute({ location: "Noord-Holland" });
    expect(mockListJobs).toHaveBeenCalledWith(
      expect.objectContaining({ province: "Noord-Holland" }),
    );
  });

  it("rejects limit over 500 with 400", async () => {
    const res = await callRoute({ limit: "999" });
    expect(res.status).toBe(400);
  });

  it("accepts limit at 500", async () => {
    await callRoute({ limit: "500" });
    expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
  });

  it("defaults limit to 100", async () => {
    await callRoute();
    expect(mockListJobs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  it("returns 400 for invalid format", async () => {
    const res = await callRoute({ format: "csv" });
    expect(res.status).toBe(400);
  });
});
