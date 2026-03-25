import { describe, expect, it } from "vitest";
import {
  collapseScoredJobsByVacancy,
  getJobDeduplicationKey,
} from "../src/services/jobs/deduplication";

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior React Developer",
    company: "Gemeente Utrecht",
    endClient: null,
    province: null,
    location: "Utrecht",
    ...overrides,
  };
}

describe("job vacancy deduplication", () => {
  it("normalizes title, end-client/company, and province/location into one vacancy key", () => {
    const firstKey = getJobDeduplicationKey(
      createJob({ title: "Senior React Developer!!", endClient: "Gemeente Utrecht" }),
    );
    const secondKey = getJobDeduplicationKey(
      createJob({
        title: " senior react developer ",
        company: "Gemeente Utrecht",
        province: "Utrecht",
      }),
    );

    expect(firstKey).toBe(secondKey);
  });

  it("collapses duplicate search hits into one vacancy and sums their scores", () => {
    const grouped = collapseScoredJobsByVacancy([
      { job: createJob({ id: "job-1", endClient: "Gemeente Utrecht" }), score: 0.42 },
      {
        job: createJob({
          id: "job-2",
          title: "Senior React Developer!!!",
          company: "Gemeente Utrecht",
          province: "Utrecht",
        }),
        score: 0.28,
      },
      {
        job: createJob({
          id: "job-3",
          title: "Java Developer",
          company: "Motian",
          location: "Amsterdam",
        }),
        score: 0.33,
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ job: { id: "job-1" }, score: 0.7 });
    expect(grouped[1]).toMatchObject({ job: { id: "job-3" }, score: 0.33 });
  });

  it("keeps a deterministic representative for duplicate vacancy keys with equal score", () => {
    const grouped = collapseScoredJobsByVacancy([
      {
        job: createJob({
          id: "job-a",
          scrapedAt: new Date("2025-01-01T00:00:00.000Z"),
          title: "Senior Frontend Developer",
        }),
        score: 0.4,
      },
      {
        job: createJob({
          id: "job-b",
          scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          title: "Senior Frontend Developer",
        }),
        score: 0.4,
      },
      {
        job: createJob({
          id: "job-c",
          scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          title: "Different title",
        }),
        score: 0.4,
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].job.id).toBe("job-b");
    expect(grouped[0].score).toBe(0.8);
  });
});
