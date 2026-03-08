import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getOpenApi } from "../app/api/openapi/route";
import { GET as getApiDocs } from "../app/api-docs/route";
import {
  buildCorsHeaders,
  getAllowedCorsOrigin,
  getCorsAllowlist,
  shouldRejectCorsPreflight,
} from "../src/lib/api-cors";

describe("API docs routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("serves an OpenAPI document with the current server URL", async () => {
    const response = await getOpenApi(new Request("http://localhost:3001/api/openapi"));
    const body = (await response.json()) as {
      openapi: string;
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(body.servers[0]?.url).toBe("http://localhost:3001");
    expect(body.paths["/api/gezondheid"]).toBeDefined();
    expect(body.paths["/api/opdrachten"]).toBeDefined();
  });

  it("prefers PUBLIC_API_BASE_URL when generating the OpenAPI server URL", async () => {
    vi.stubEnv("PUBLIC_API_BASE_URL", "https://api.example.com/");

    const response = await getOpenApi(new Request("http://localhost:3001/api/openapi"));
    const body = (await response.json()) as { servers: Array<{ url: string }> };

    expect(body.servers[0]?.url).toBe("https://api.example.com");
  });

  it("serves a Scalar HTML shell wired to the local OpenAPI route", async () => {
    const response = await getApiDocs(new Request("http://localhost:3001/api-docs"));
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Scalar.createApiReference");
    expect(body).toContain("http://localhost:3001/api/openapi");
  });
});

describe("API CORS helpers", () => {
  it("uses localhost and 127.0.0.1 as development fallbacks", () => {
    const allowlist = getCorsAllowlist({ NODE_ENV: "development", ALLOWED_ORIGINS: "" });

    expect(allowlist).toContain("http://localhost:3001");
    expect(allowlist).toContain("http://127.0.0.1:3001");
  });

  it("respects configured allowlists and rejects unknown preflight origins", () => {
    const env = {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://docs.example.com, https://app.example.com",
    };

    expect(getAllowedCorsOrigin("https://docs.example.com", env)).toBe("https://docs.example.com");
    expect(getAllowedCorsOrigin("https://evil.example.com", env)).toBeNull();
    expect(shouldRejectCorsPreflight("https://evil.example.com", env)).toBe(true);
    expect(buildCorsHeaders("https://docs.example.com", env)["Access-Control-Allow-Origin"]).toBe(
      "https://docs.example.com",
    );
  });
});
