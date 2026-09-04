import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

const { mockListScraperConfigsPage, mockCreateConfig } = vi.hoisted(() => ({
  mockListScraperConfigsPage: vi.fn(),
  mockCreateConfig: vi.fn(),
}));

vi.mock("../src/services/scrapers", () => ({
  listScraperConfigsPage: mockListScraperConfigsPage,
  createConfig: mockCreateConfig,
}));

import { GET } from "../app/api/scraper-configuraties/route";

describe("WP4 scraper config confidentiality (AE4 / R11 / R12)", () => {
  const previousApi = process.env.API_SECRET;

  beforeEach(() => {
    process.env.API_SECRET = TEST_API_SECRET;
    vi.clearAllMocks();
    mockListScraperConfigsPage.mockResolvedValue({
      data: [
        {
          id: "cfg-1",
          platform: "striive",
          baseUrl: "https://striive.example",
          hasAuthConfig: true,
          hasCredentialsRef: true,
        },
      ],
      total: 1,
    });
  });

  afterEach(() => {
    if (previousApi === undefined) delete process.env.API_SECRET;
    else process.env.API_SECRET = previousApi;
  });

  it("GET response omits credential keys and is not publicly cacheable", async () => {
    const response = await GET(
      new Request("http://localhost/api/scraper-configuraties", {
        headers: createTestAuthHeaders(),
      }),
    );
    const body = await response.json();
    const cacheControl = response.headers.get("Cache-Control") ?? "";

    expect(response.status).toBe(200);
    expect(cacheControl).toBe("private, no-store");
    expect(cacheControl).not.toMatch(/\bpublic\b/);

    const row = body.data[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty("authConfigEncrypted");
    expect(row).not.toHaveProperty("credentialsRef");
    expect(JSON.stringify(body)).not.toMatch(/authConfigEncrypted|credentialsRef|vault:\/\//);
  });

  it("listScraperConfigsPage maps rows through toPublicScraperConfig", () => {
    const source = readFileSync(new URL("../src/services/scrapers.ts", import.meta.url), "utf8");
    const listFn = source.slice(source.indexOf("export async function listScraperConfigsPage"));
    const listBody = listFn.slice(0, listFn.indexOf("export async function getConfigByPlatform"));

    expect(listBody).toContain("toPublicScraperConfig(row)");
    expect(listBody).not.toMatch(/return \{\s*data,\s*total/);
  });

  it("createConfig and updateConfig return public configs after save", () => {
    const source = readFileSync(new URL("../src/services/scrapers.ts", import.meta.url), "utf8");

    expect(source).toMatch(
      /export async function createConfig[\s\S]*?return toPublicScraperConfig\(config\);/,
    );
    expect(source).toMatch(
      /export async function updateConfig[\s\S]*?return toPublicScraperConfig\(updated\);/,
    );
  });
});
