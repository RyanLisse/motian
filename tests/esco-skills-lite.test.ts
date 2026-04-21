import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetJobSkillsV2ForJobIds } = vi.hoisted(() => ({
  mockGetJobSkillsV2ForJobIds: vi.fn(),
}));

vi.mock("../src/services/skills", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/skills")>();
  return {
    ...actual,
    getJobSkillsV2ForJobIds: mockGetJobSkillsV2ForJobIds,
  };
});

import { withJobsSkillsLite } from "../src/services/esco";

describe("withJobsSkillsLite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects grouped job skills to exactly slug and label", async () => {
    mockGetJobSkillsV2ForJobIds.mockResolvedValueOnce(
      new Map([
        [
          "job-1",
          [
            {
              skillId: "skill-1",
              slug: "typescript",
              label: "TypeScript",
              rawLabel: "TS",
              source: "job.requirements",
              importance: "must",
              confidence: 0.92,
            },
          ],
        ],
      ]),
    );

    const result = await withJobsSkillsLite([{ id: "job-1", title: "TypeScript Developer" }]);

    expect(mockGetJobSkillsV2ForJobIds).toHaveBeenCalledWith(["job-1"]);
    expect(result).toEqual([
      {
        id: "job-1",
        title: "TypeScript Developer",
        canonicalSkills: [{ slug: "typescript", label: "TypeScript" }],
      },
    ]);
    expect(Object.keys(result[0].canonicalSkills[0]).sort()).toEqual(["label", "slug"]);
  });
});
