import { describe, expect, it } from "vitest";
import { normalizeSkillName, toSkillSlug } from "../src/services/skills";

describe("skills service helpers", () => {
  it("normalizes whitespace and preserves readable labels", () => {
    expect(normalizeSkillName("  React   Native  ")).toBe("React Native");
  });

  it("builds recruiter-friendly canonical slugs", () => {
    expect(toSkillSlug("C# / .NET")).toBe("c-net");
    expect(toSkillSlug("Stakeholder management")).toBe("stakeholder-management");
  });
});
