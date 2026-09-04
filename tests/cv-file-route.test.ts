import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNAUTHORIZED_MESSAGE } from "@/src/lib/api-auth";
import { createTestAuthHeaders, TEST_API_SECRET } from "./helpers/session";

const {
  mockGetCandidateById,
  mockFindCandidateByResumeUrl,
  mockAssertCanReadCandidate,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetCandidateById: vi.fn(),
  mockFindCandidateByResumeUrl: vi.fn(),
  mockAssertCanReadCandidate: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
  findCandidateByResumeUrl: mockFindCandidateByResumeUrl,
}));

vi.mock("@/src/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/api-auth")>();
  return {
    ...actual,
    assertCanReadCandidate: mockAssertCanReadCandidate,
  };
});

import { GET } from "@/app/api/cv-file/route";

const STORED_URL = "https://abc123.public.blob.vercel-storage.com/cv/resume.pdf";
const CANDIDATE_ID = "11111111-1111-1111-1111-111111111111";

function authRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: createTestAuthHeaders(TEST_API_SECRET),
  });
}

describe("GET /api/cv-file (WP3 R6/R7)", () => {
  const previousApi = process.env.API_SECRET;
  const previousBlob = process.env.BLOB_READ_WRITE_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_SECRET = TEST_API_SECRET;
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token-test";
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockAssertCanReadCandidate.mockResolvedValue("allow");
    mockGetCandidateById.mockResolvedValue(null);
    mockFindCandidateByResumeUrl.mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (previousApi === undefined) delete process.env.API_SECRET;
    else process.env.API_SECRET = previousApi;
    if (previousBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousBlob;
  });

  it("returns 401 without a principal and never fetches upstream", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/cv-file?kandidaatId=${CANDIDATE_ID}`),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: UNAUTHORIZED_MESSAGE });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockGetCandidateById).not.toHaveBeenCalled();
  });

  it("returns 400 when neither kandidaatId nor url is provided", async () => {
    const response = await GET(authRequest("/api/cv-file"));
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Ontbrekende kandidaat-identificatie");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown or soft-deleted candidate with zero upstream fetch", async () => {
    mockGetCandidateById.mockResolvedValue(null);

    const response = await GET(authRequest(`/api/cv-file?kandidaatId=${CANDIDATE_ID}`));
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Bestand niet gevonden");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when candidate has no resumeUrl with zero upstream fetch", async () => {
    mockGetCandidateById.mockResolvedValue({ id: CANDIDATE_ID, resumeUrl: null });

    const response = await GET(authRequest(`/api/cv-file?kandidaatId=${CANDIDATE_ID}`));
    expect(response.status).toBe(404);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 for unbound storage url with zero upstream fetch (AE2)", async () => {
    mockFindCandidateByResumeUrl.mockResolvedValue(null);

    const response = await GET(authRequest(`/api/cv-file?url=${encodeURIComponent(STORED_URL)}`));
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Geen toegang tot dit bestand");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFindCandidateByResumeUrl).toHaveBeenCalledWith(STORED_URL);
  });

  it("returns 403 when assertCanReadCandidate denies, with zero upstream fetch", async () => {
    mockGetCandidateById.mockResolvedValue({ id: CANDIDATE_ID, resumeUrl: STORED_URL });
    mockAssertCanReadCandidate.mockResolvedValue("deny");

    const response = await GET(authRequest(`/api/cv-file?kandidaatId=${CANDIDATE_ID}`));
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches upstream with server token for an authorized kandidaatId", async () => {
    mockGetCandidateById.mockResolvedValue({ id: CANDIDATE_ID, resumeUrl: STORED_URL });
    mockFetch.mockResolvedValue(
      new Response("pdf-bytes", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );

    const response = await GET(authRequest(`/api/cv-file?kandidaatId=${CANDIDATE_ID}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(STORED_URL, {
      headers: { Authorization: "Bearer blob-token-test" },
    });
    await expect(response.text()).resolves.toBe("pdf-bytes");
  });

  it("allows temporary ?url= when it maps to a persisted resumeUrl", async () => {
    mockFindCandidateByResumeUrl.mockResolvedValue({
      id: CANDIDATE_ID,
      resumeUrl: STORED_URL,
    });
    mockFetch.mockResolvedValue(
      new Response("pdf-bytes", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );

    const response = await GET(authRequest(`/api/cv-file?url=${encodeURIComponent(STORED_URL)}`));
    expect(response.status).toBe(200);
    expect(mockAssertCanReadCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "service" }),
      CANDIDATE_ID,
    );
    expect(mockFetch).toHaveBeenCalledWith(STORED_URL, {
      headers: { Authorization: "Bearer blob-token-test" },
    });
  });

  it("returns a safe status on upstream failure without leaking token or provider detail", async () => {
    mockGetCandidateById.mockResolvedValue({ id: CANDIDATE_ID, resumeUrl: STORED_URL });
    mockFetch.mockResolvedValue(new Response("secret-blob-error", { status: 500 }));

    const response = await GET(authRequest(`/api/cv-file?kandidaatId=${CANDIDATE_ID}`));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toBe("Bestand niet gevonden");
    expect(body).not.toContain("blob-token");
    expect(body).not.toContain("vercel");
    expect(body).not.toContain("secret-blob-error");
  });
});
