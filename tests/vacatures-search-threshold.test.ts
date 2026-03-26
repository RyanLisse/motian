import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchJobsPageUnified, mockSearchJobsUnified } = vi.hoisted(() => ({
  mockSearchJobsPageUnified: vi.fn(),
  mockSearchJobsUnified: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  searchJobsPageUnified: mockSearchJobsPageUnified,
  searchJobsUnified: mockSearchJobsUnified,
}));

import { runJobPageSearch } from "../src/lib/job-search-runner";
import { runVacaturesSearch } from "../src/lib/vacatures-search";

describe("vacatures search threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchJobsUnified.mockResolvedValue({ data: [], total: 0 });
    mockSearchJobsPageUnified.mockResolvedValue({ data: [], total: 0 });
  });

  it("treats a one-character query as the default vacatures listing in runVacaturesSearch", async () => {
    await runVacaturesSearch(new URLSearchParams("q=a&platform=opdrachtoverheid"));

    expect(mockSearchJobsUnified).toHaveBeenCalledWith(
      expect.objectContaining({
        q: undefined,
        platform: "opdrachtoverheid",
      }),
    );
  });

  it("treats a one-character query as the default vacatures listing in runJobPageSearch", async () => {
    await runJobPageSearch(new URLSearchParams("q=a&pagina=2&perPage=25"));

    expect(mockSearchJobsPageUnified).toHaveBeenCalledWith(
      expect.objectContaining({
        q: undefined,
        limit: 25,
        offset: 25,
      }),
    );
  });
});
