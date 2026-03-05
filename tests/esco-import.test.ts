import { describe, expect, it } from "vitest";

import { buildEscoImportBundle, normalizeAlias } from "../src/services/esco-import.js";

describe("normalizeAlias", () => {
  it("normalizes whitespace, punctuation, and case for alias matching", () => {
    expect(normalizeAlias("  React.js / Front-End  ")).toBe("reactjs frontend");
  });
});

describe("buildEscoImportBundle", () => {
  it("builds canonical skill and deduplicated alias rows from an ESCO concept", () => {
    const bundle = buildEscoImportBundle({
      uri: "http://data.europa.eu/esco/skill/react",
      preferredLabel: {
        en: "React Developer",
        nl: "React ontwikkelaar",
      },
      altLabels: {
        en: ["React.js developer", "Frontend React engineer"],
        nl: ["React ontwikkelaar", " Front-end React engineer "],
      },
      broaderUri: "http://data.europa.eu/esco/skill/frontend",
      skillType: "skill/competence",
      reuseLevel: "transversal",
    });

    expect(bundle.skill).toEqual({
      uri: "http://data.europa.eu/esco/skill/react",
      preferredLabelEn: "React Developer",
      preferredLabelNl: "React ontwikkelaar",
      broaderUri: "http://data.europa.eu/esco/skill/frontend",
      skillType: "skill/competence",
      reuseLevel: "transversal",
    });

    expect(bundle.aliases).toEqual([
      {
        alias: "React Developer",
        normalizedAlias: "react developer",
        language: "en",
        source: "preferredLabel",
      },
      {
        alias: "React ontwikkelaar",
        normalizedAlias: "react ontwikkelaar",
        language: "nl",
        source: "preferredLabel",
      },
      {
        alias: "React.js developer",
        normalizedAlias: "reactjs developer",
        language: "en",
        source: "altLabel",
      },
      {
        alias: "Frontend React engineer",
        normalizedAlias: "frontend react engineer",
        language: "en",
        source: "altLabel",
      },
      {
        alias: "Front-end React engineer",
        normalizedAlias: "frontend react engineer",
        language: "nl",
        source: "altLabel",
      },
    ]);
  });
});
