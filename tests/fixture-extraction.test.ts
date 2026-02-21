import { describe, it, expect } from "vitest";
import { z } from "zod";
import { unifiedJobSchema, extractProvince } from "../src/schemas/job";

// ===== parseSalary helper (extracted from indeed.step.ts) =====

function parseSalary(
  salary?: string,
): { min?: number; max?: number } | undefined {
  if (!salary) return undefined;
  const numbers = salary.match(/[\d.,]+/g)?.map((n) =>
    parseFloat(n.replace(/\./g, "").replace(",", ".")),
  );
  if (!numbers?.length) return undefined;
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

// ===== mapContractType helper (extracted from indeed.step.ts) =====

function mapContractType(
  type?: string,
): "freelance" | "interim" | "vast" | "opdracht" | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes("vast") || lower.includes("fulltime")) return "vast";
  if (lower.includes("tijdelijk") || lower.includes("interim")) return "interim";
  if (lower.includes("freelance") || lower.includes("zzp")) return "freelance";
  if (lower.includes("opdracht") || lower.includes("project")) return "opdracht";
  return undefined;
}

// ===== parseSalary tests =====

describe("parseSalary", () => {
  it("parses range with euro sign: €80 - €100 per uur", () => {
    const result = parseSalary("€80 - €100 per uur");
    expect(result).toEqual({ min: 80, max: 100 });
  });

  it("parses monthly salary with dots: €4.500 - €6.000 per maand", () => {
    const result = parseSalary("€4.500 - €6.000 per maand");
    expect(result).toEqual({ min: 4500, max: 6000 });
  });

  it("parses single value: €70 per uur", () => {
    const result = parseSalary("€70 per uur");
    expect(result).toEqual({ min: 70, max: 70 });
  });

  it("parses comma decimals: €85,50 per uur", () => {
    const result = parseSalary("€85,50 per uur");
    expect(result).toEqual({ min: 85.5, max: 85.5 });
  });

  it("returns undefined for no salary", () => {
    expect(parseSalary(undefined)).toBeUndefined();
    expect(parseSalary("")).toBeUndefined();
  });

  it("returns undefined for text without numbers", () => {
    expect(parseSalary("Marktconform")).toBeUndefined();
    expect(parseSalary("Nader overeen te komen")).toBeUndefined();
  });

  it("handles large range: €3.000 - €5.500", () => {
    const result = parseSalary("€3.000 - €5.500");
    expect(result).toEqual({ min: 3000, max: 5500 });
  });
});

// ===== mapContractType tests =====

describe("mapContractType", () => {
  it("maps fulltime to vast", () => {
    expect(mapContractType("Fulltime")).toBe("vast");
  });

  it("maps vast dienstverband to vast", () => {
    expect(mapContractType("Vast dienstverband")).toBe("vast");
  });

  it("maps tijdelijk to interim", () => {
    expect(mapContractType("Tijdelijk contract")).toBe("interim");
  });

  it("maps interim to interim", () => {
    expect(mapContractType("Interim")).toBe("interim");
  });

  it("maps freelance to freelance", () => {
    expect(mapContractType("Freelance")).toBe("freelance");
  });

  it("maps ZZP to freelance", () => {
    expect(mapContractType("Freelance / ZZP")).toBe("freelance");
  });

  it("maps opdracht to opdracht", () => {
    expect(mapContractType("Opdracht")).toBe("opdracht");
  });

  it("maps project to opdracht", () => {
    expect(mapContractType("Project-based")).toBe("opdracht");
  });

  it("returns undefined for unknown type", () => {
    expect(mapContractType("Onbekend")).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(mapContractType(undefined)).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(mapContractType("FULLTIME")).toBe("vast");
    expect(mapContractType("freelance")).toBe("freelance");
    expect(mapContractType("TIJDELIJK")).toBe("interim");
  });
});

// ===== Province extraction tests =====

describe("extractProvince", () => {
  it("extracts province from 'City - Province' format", () => {
    expect(extractProvince("Den Haag - Zuid-Holland")).toBe("Zuid-Holland");
    expect(extractProvince("Eindhoven - Noord-Brabant")).toBe("Noord-Brabant");
    expect(extractProvince("Amsterdam - Noord-Holland")).toBe("Noord-Holland");
  });

  it("returns undefined for city-only location", () => {
    expect(extractProvince("Amsterdam")).toBeUndefined();
    expect(extractProvince("Utrecht")).toBeUndefined();
  });

  it("handles extra whitespace", () => {
    expect(extractProvince("Rotterdam  -  Zuid-Holland")).toBe("Zuid-Holland");
  });
});

// ===== Zod schema validation with fixture data =====

describe("unifiedJobSchema with fixture-derived data", () => {
  it("validates a complete Indeed-derived job", () => {
    const job = {
      title: "Senior Java Developer",
      company: "Rabobank",
      location: "Utrecht",
      description: "Wij zoeken een ervaren Java developer voor ons backend team.",
      externalId: "abc123def",
      externalUrl: "https://nl.indeed.com/viewjob?jk=abc123def",
      contractType: "freelance" as const,
      rateMin: 80,
      rateMax: 100,
    };
    const result = unifiedJobSchema.safeParse(job);
    expect(result.success).toBe(true);
  });

  it("validates a LinkedIn-derived job with province", () => {
    const job = {
      title: "DevOps Engineer",
      company: "KPN",
      location: "Den Haag - Zuid-Holland",
      province: "Zuid-Holland",
      description: "Als DevOps Engineer bij KPN ben je verantwoordelijk voor cloud infrastructuur.",
      externalId: "3847291056",
      externalUrl: "https://www.linkedin.com/jobs/view/3847291056",
      contractType: "interim" as const,
    };
    const result = unifiedJobSchema.safeParse(job);
    expect(result.success).toBe(true);
  });

  it("validates a minimal job (only required fields)", () => {
    const job = {
      title: "Python Developer",
      description: "Zoekt Python developer voor ML project",
      externalId: "xyz789",
      externalUrl: "https://nl.indeed.com/viewjob?jk=xyz789",
    };
    const result = unifiedJobSchema.safeParse(job);
    expect(result.success).toBe(true);
  });

  it("rejects job with too-short description", () => {
    const job = {
      title: "Tester",
      description: "Kort",
      externalId: "t001",
      externalUrl: "https://example.com/job/1",
    };
    const result = unifiedJobSchema.safeParse(job);
    expect(result.success).toBe(false);
  });

  it("rejects invalid contractType", () => {
    const job = {
      title: "Engineer",
      description: "Infrastructure engineer voor cloud platform",
      externalId: "eng001",
      externalUrl: "https://example.com/job/3",
      contractType: "fulltime",
    };
    const result = unifiedJobSchema.safeParse(job);
    expect(result.success).toBe(false);
  });
});

// ===== Deduplication logic =====

describe("deduplication by externalId", () => {
  function deduplicateJobs<T extends { externalId: string }>(jobs: T[]): T[] {
    const seen = new Map<string, T>();
    for (const job of jobs) {
      seen.set(job.externalId, job); // last write wins = update
    }
    return Array.from(seen.values());
  }

  it("keeps unique jobs", () => {
    const jobs = [
      { externalId: "a", title: "Job A" },
      { externalId: "b", title: "Job B" },
    ];
    expect(deduplicateJobs(jobs)).toHaveLength(2);
  });

  it("deduplicates same externalId (last wins = update)", () => {
    const jobs = [
      { externalId: "a", title: "Job A v1" },
      { externalId: "a", title: "Job A v2" },
      { externalId: "b", title: "Job B" },
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(2);
    expect(result.find((j) => j.externalId === "a")?.title).toBe("Job A v2");
  });

  it("handles empty array", () => {
    expect(deduplicateJobs([])).toHaveLength(0);
  });
});
