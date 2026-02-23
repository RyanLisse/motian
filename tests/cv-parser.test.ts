import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsedCVSchema } from "../src/schemas/candidate-intelligence.js";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("CV parser service", () => {
  it("exports parseCV function", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("export async function parseCV");
  });

  it("uses Gemini model for structured output", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("gemini-");
    expect(source).toContain("generateText");
  });

  it("uses generateText with parsedCVSchema", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("generateText");
    expect(source).toContain("parsedCVSchema");
  });

  it("supports PDF via file attachment", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("application/pdf");
  });

  it("supports Word via mammoth extraction", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("mammoth");
  });

  it("uses withRetry for resilience", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("withRetry");
  });

  it("parsedCVSchema validates a well-formed object", () => {
    const sample = {
      name: "Jan de Vries",
      email: "jan@example.com",
      phone: "+31 6 1234 5678",
      dateOfBirth: "1980-03-15",
      nationality: "Nederlands",
      role: "Senior Projectmanager",
      location: "Utrecht",
      introduction:
        "Ervaren projectmanager met 15+ jaar ervaring in de bouw en infra sector. Gespecialiseerd in Prince2 en leidinggeven aan multidisciplinaire teams.",
      skills: {
        hard: [{ name: "Prince2", proficiency: 4, evidence: "Prince2 gecertificeerd sinds 2018" }],
        soft: [
          { name: "Leiderschap", proficiency: 5, evidence: "15 jaar leidinggevende ervaring" },
        ],
      },
      experience: [
        {
          title: "Senior PM",
          company: "Heijmans",
          period: { start: "2015", end: "heden" },
          responsibilities: ["Leiding 50-koppig team", "Budget €5M beheer"],
        },
      ],
      education: [{ degree: "MSc Bedrijfskunde", institution: "EUR", year: "2010" }],
      courses: ["VCA VOL", "BHV"],
      certifications: ["Prince2 Practitioner", "PMP"],
      languages: [
        { language: "Nederlands", level: "native" },
        { language: "Engels", level: "C1" },
      ],
      totalYearsExperience: 15,
      highestEducationLevel: "WO",
      industries: ["Bouw", "Infra"],
      preferredContractType: null,
      preferredWorkArrangement: null,
    };
    const result = parsedCVSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});
