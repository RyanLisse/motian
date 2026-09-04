import { describe, expect, it } from "vitest";

import { normalizeText } from "../src/services/normalize";

describe("normalizeText", () => {
  it("preserves technical punctuation for skill and role matching by default", () => {
    expect(normalizeText("  C# / .NET + caf\u00e9\u2013QA  ")).toBe("c# / .net + cafe qa");
  });

  it("can use overlap-safe punctuation removal and null empty results", () => {
    const options = { preserveTechnicalPunctuation: false, nullWhenEmpty: true } as const;

    expect(normalizeText("  C# / .NET + caf\u00e9\u2013QA  ", options)).toBe("c net cafe qa");
    expect(normalizeText("  !!!  ", options)).toBeNull();
    expect(normalizeText(null, options)).toBeNull();
  });
});
