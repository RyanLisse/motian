import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  candidateSkills,
  escoSkills,
  jobSkills,
  skillAliases,
  skillMappings,
} from "../src/db/schema.js";

describe("ESCO schema foundation", () => {
  it("exports the canonical ESCO tables", () => {
    expect(getTableName(escoSkills)).toBe("esco_skills");
    expect(getTableName(skillAliases)).toBe("skill_aliases");
    expect(getTableName(candidateSkills)).toBe("candidate_skills");
    expect(getTableName(jobSkills)).toBe("job_skills");
    expect(getTableName(skillMappings)).toBe("skill_mappings");
  });

  it("exposes key canonical columns for links and audit data", () => {
    expect(candidateSkills.candidateId).toBeDefined();
    expect(candidateSkills.escoUri).toBeDefined();
    expect(jobSkills.jobId).toBeDefined();
    expect(jobSkills.critical).toBeDefined();
    expect(skillMappings.strategy).toBeDefined();
    expect(skillMappings.sentToReview).toBeDefined();
  });
});
