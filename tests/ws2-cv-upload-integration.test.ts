import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parsedCVSchema,
  structuredSkillSchema,
  structuredSkillsSchema,
} from "../src/schemas/candidate-intelligence.js";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

// ========== DB Schema: candidates table columns ==========

describe("DB schema — candidates CV columns", () => {
  it("has resumeRaw column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("resumeRaw");
  });

  it("has resumeParsedAt column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("resumeParsedAt");
  });

  it("has skillsStructured column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("skillsStructured");
  });

  it("has education column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("education");
  });

  it("has certifications column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("certifications");
  });

  it("has languageSkills column", () => {
    const source = readFile("src/db/schema.ts");
    expect(source).toContain("languageSkills");
  });
});

// ========== Zod schemas: structuredSkillSchema ==========

describe("structuredSkillSchema", () => {
  it("accepts valid skill with name, proficiency, evidence", () => {
    const result = structuredSkillSchema.safeParse({
      name: "TypeScript",
      proficiency: 4,
      evidence: "5 jaar ervaring als lead developer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects proficiency below 1", () => {
    const result = structuredSkillSchema.safeParse({
      name: "TypeScript",
      proficiency: 0,
      evidence: "no evidence",
    });
    expect(result.success).toBe(false);
  });

  it("rejects proficiency above 5", () => {
    const result = structuredSkillSchema.safeParse({
      name: "TypeScript",
      proficiency: 6,
      evidence: "no evidence",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = structuredSkillSchema.safeParse({
      proficiency: 3,
      evidence: "some evidence",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing evidence", () => {
    const result = structuredSkillSchema.safeParse({
      name: "Python",
      proficiency: 2,
    });
    expect(result.success).toBe(false);
  });

  it("accepts proficiency boundary value 1", () => {
    const result = structuredSkillSchema.safeParse({
      name: "Excel",
      proficiency: 1,
      evidence: "basic usage",
    });
    expect(result.success).toBe(true);
  });

  it("accepts proficiency boundary value 5", () => {
    const result = structuredSkillSchema.safeParse({
      name: "Java",
      proficiency: 5,
      evidence: "10+ jaren enterprise ervaring",
    });
    expect(result.success).toBe(true);
  });
});

// ========== Zod schemas: structuredSkillsSchema ==========

describe("structuredSkillsSchema", () => {
  it("accepts object with hard and soft arrays", () => {
    const result = structuredSkillsSchema.safeParse({
      hard: [{ name: "SQL", proficiency: 3, evidence: "dagelijks gebruik" }],
      soft: [{ name: "Communicatie", proficiency: 4, evidence: "leidinggevende rol" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty hard and soft arrays", () => {
    const result = structuredSkillsSchema.safeParse({ hard: [], soft: [] });
    expect(result.success).toBe(true);
  });

  it("rejects missing hard array", () => {
    const result = structuredSkillsSchema.safeParse({
      soft: [{ name: "Teamwork", proficiency: 3, evidence: "team projects" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing soft array", () => {
    const result = structuredSkillsSchema.safeParse({
      hard: [{ name: "Docker", proficiency: 2, evidence: "basic containers" }],
    });
    expect(result.success).toBe(false);
  });
});

// ========== parsedCVSchema: invalid input rejection ==========

describe("parsedCVSchema — invalid input rejection", () => {
  it("rejects invalid email format", () => {
    const result = parsedCVSchema.safeParse({
      name: "Jan de Vries",
      email: "not-an-email",
      phone: null,
      dateOfBirth: null,
      nationality: null,
      role: "Developer",
      location: null,
      introduction: "A developer.",
      skills: { hard: [], soft: [] },
      experience: [],
      education: [],
      courses: [],
      certifications: [],
      languages: [],
      totalYearsExperience: null,
      highestEducationLevel: null,
      industries: [],
      preferredContractType: null,
      preferredWorkArrangement: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required name field", () => {
    const result = parsedCVSchema.safeParse({
      email: null,
      phone: null,
      dateOfBirth: null,
      nationality: null,
      role: "Developer",
      location: null,
      introduction: "A developer.",
      skills: { hard: [], soft: [] },
      experience: [],
      education: [],
      courses: [],
      certifications: [],
      languages: [],
      totalYearsExperience: null,
      highestEducationLevel: null,
      industries: [],
      preferredContractType: null,
      preferredWorkArrangement: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required introduction field", () => {
    const result = parsedCVSchema.safeParse({
      name: "Jan de Vries",
      email: null,
      phone: null,
      dateOfBirth: null,
      nationality: null,
      role: "Developer",
      location: null,
      skills: { hard: [], soft: [] },
      experience: [],
      education: [],
      courses: [],
      certifications: [],
      languages: [],
      totalYearsExperience: null,
      highestEducationLevel: null,
      industries: [],
      preferredContractType: null,
      preferredWorkArrangement: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts null email", () => {
    const result = parsedCVSchema.safeParse({
      name: "Anoniem Kandidaat",
      email: null,
      phone: null,
      dateOfBirth: null,
      nationality: null,
      role: "Consultant",
      location: null,
      introduction: "Anonieme kandidaat zonder email.",
      skills: { hard: [], soft: [] },
      experience: [],
      education: [],
      courses: [],
      certifications: [],
      languages: [],
      totalYearsExperience: 5,
      highestEducationLevel: "HBO",
      industries: ["IT"],
      preferredContractType: null,
      preferredWorkArrangement: null,
    });
    expect(result.success).toBe(true);
  });
});

// ========== cv-parser: import wiring ==========

describe("cv-parser import wiring", () => {
  it("imports parsedCVSchema from schemas/candidate-intelligence", () => {
    const source = readFile("src/services/cv-parser.ts");
    expect(source).toContain("parsedCVSchema");
    expect(source).toContain("candidate-intelligence");
  });
});

// ========== cv-upload/route.ts: import wiring ==========

describe("cv-upload route import wiring", () => {
  it("imports parseCV from cv-parser service", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("parseCV");
    expect(source).toContain("cv-parser");
  });

  it("imports from file-storage (not directly from @vercel/blob)", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("file-storage");
    expect(source).not.toContain("@vercel/blob");
  });

  it("imports findDuplicateCandidate from candidates service", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("findDuplicateCandidate");
    expect(source).toContain("candidates");
  });
});

// ========== cv-upload/save/route.ts: import wiring ==========

describe("cv-upload save route import wiring", () => {
  it("imports parsedCVSchema from schemas", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("parsedCVSchema");
    expect(source).toContain("candidate-intelligence");
  });

  it("imports createCandidate from candidates service", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("createCandidate");
    expect(source).toContain("candidates");
  });

  it("imports enrichCandidateFromCV from candidates service", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("enrichCandidateFromCV");
  });
});

// ========== cv-upload-sidebar: /api/cv-upload/save endpoint ==========

describe("cv-upload-sidebar save endpoint integration", () => {
  it("calls /api/cv-upload/save endpoint", () => {
    const source = readFile("components/cv-upload-sidebar.tsx");
    expect(source).toContain("/api/cv-upload/save");
  });
});

// ========== file-storage: exports ==========

describe("file-storage service exports", () => {
  it("exports uploadFile function", () => {
    const source = readFile("src/lib/file-storage.ts");
    expect(source).toContain("export async function uploadFile");
  });

  it("exports downloadFile function", () => {
    const source = readFile("src/lib/file-storage.ts");
    expect(source).toContain("export async function downloadFile");
  });

  it("exports deleteFile function", () => {
    const source = readFile("src/lib/file-storage.ts");
    expect(source).toContain("export async function deleteFile");
  });

  it("uses @vercel/blob internally", () => {
    const source = readFile("src/lib/file-storage.ts");
    expect(source).toContain("@vercel/blob");
  });

  it("uploadFile returns url and pathname", () => {
    const source = readFile("src/lib/file-storage.ts");
    expect(source).toContain("url");
    expect(source).toContain("pathname");
  });
});
