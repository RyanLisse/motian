import { describe, expect, it } from "vitest";

import { extractEscoSkillConcepts } from "../src/services/esco-dataset.js";

describe("extractEscoSkillConcepts", () => {
  it("returns concepts from a top-level array payload", () => {
    const concepts = extractEscoSkillConcepts([
      { uri: "skill:react" },
      { uri: "skill:typescript" },
    ]);

    expect(concepts).toEqual([{ uri: "skill:react" }, { uri: "skill:typescript" }]);
  });

  it("returns concepts from object payload wrappers", () => {
    expect(
      extractEscoSkillConcepts({
        skills: [{ uri: "skill:react" }],
      }),
    ).toEqual([{ uri: "skill:react" }]);

    expect(
      extractEscoSkillConcepts({
        concepts: [{ uri: "skill:typescript" }],
      }),
    ).toEqual([{ uri: "skill:typescript" }]);
  });

  it("throws when the payload does not contain a concept list", () => {
    expect(() => extractEscoSkillConcepts({ results: [] })).toThrow(
      /does not contain a supported concept list/i,
    );
  });
});
