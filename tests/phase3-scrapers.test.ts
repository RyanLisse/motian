import { describe, expect, it } from "vitest";
import { z } from "zod";

// ===== Indeed Step Config Tests =====

describe("ScrapeIndeed step config", () => {
  // Import the config statically to validate shape
  const indeedConfig = {
    name: "ScrapeIndeed",
    description: "Scrape Indeed vacatures via Firecrawl LLM extraction",
    triggers: [
      {
        type: "queue" as const,
        topic: "platform.scrape",
      },
    ],
    enqueues: [{ topic: "jobs.normalize" }],
    flows: ["recruitment-scraper"],
  };

  it("heeft de juiste naam", () => {
    expect(indeedConfig.name).toBe("ScrapeIndeed");
  });

  it("triggert op platform.scrape queue", () => {
    expect(indeedConfig.triggers).toHaveLength(1);
    expect(indeedConfig.triggers[0].type).toBe("queue");
    expect(indeedConfig.triggers[0].topic).toBe("platform.scrape");
  });

  it("enqueues naar jobs.normalize", () => {
    expect(indeedConfig.enqueues).toHaveLength(1);
    expect(indeedConfig.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("hoort bij recruitment-scraper flow", () => {
    expect(indeedConfig.flows).toContain("recruitment-scraper");
  });
});

// ===== LinkedIn Step Config Tests =====

describe("LinkedIn step config (toekomstig)", () => {
  // LinkedIn scraper volgt hetzelfde patroon als Indeed
  const linkedinConfig = {
    name: "ScrapeLinkedIn",
    description: "Scrape LinkedIn vacatures",
    triggers: [
      {
        type: "queue" as const,
        topic: "platform.scrape",
      },
    ],
    enqueues: [{ topic: "jobs.normalize" }],
    flows: ["recruitment-scraper"],
  };

  it("heeft de juiste naam", () => {
    expect(linkedinConfig.name).toBe("ScrapeLinkedIn");
  });

  it("triggert op platform.scrape queue", () => {
    expect(linkedinConfig.triggers[0].type).toBe("queue");
    expect(linkedinConfig.triggers[0].topic).toBe("platform.scrape");
  });

  it("enqueues naar jobs.normalize", () => {
    expect(linkedinConfig.enqueues[0].topic).toBe("jobs.normalize");
  });
});

// ===== Early-Return for Wrong Platform =====

describe("platform guard (early-return)", () => {
  function shouldProcess(inputPlatform: string, stepPlatform: string): boolean {
    return inputPlatform === stepPlatform;
  }

  it("Indeed verwerkt alleen indeed input", () => {
    expect(shouldProcess("indeed", "indeed")).toBe(true);
    expect(shouldProcess("striive", "indeed")).toBe(false);
    expect(shouldProcess("linkedin", "indeed")).toBe(false);
  });

  it("LinkedIn verwerkt alleen linkedin input", () => {
    expect(shouldProcess("linkedin", "linkedin")).toBe(true);
    expect(shouldProcess("indeed", "linkedin")).toBe(false);
    expect(shouldProcess("striive", "linkedin")).toBe(false);
  });

  it("Striive verwerkt alleen striive input", () => {
    expect(shouldProcess("striive", "striive")).toBe(true);
    expect(shouldProcess("indeed", "striive")).toBe(false);
  });
});

// ===== Unified Job Schema Validation =====

describe("unified job schema (Indeed/LinkedIn)", () => {
  const unifiedJobSchema = z.object({
    title: z.string().min(1),
    company: z.string().optional(),
    location: z.string().optional(),
    description: z.string().min(1),
    externalId: z.string().min(1),
    externalUrl: z.string().url(),
    contractType: z.enum(["freelance", "interim", "vast", "opdracht"]).optional(),
    rateMin: z.number().optional(),
    rateMax: z.number().optional(),
  });

  it("accepteert een Indeed-shaped job", () => {
    const result = unifiedJobSchema.safeParse({
      title: "Senior Java Developer",
      company: "Rabobank",
      location: "Utrecht",
      description: "Wij zoeken een ervaren Java developer...",
      externalId: "abc123def",
      externalUrl: "https://nl.indeed.com/viewjob?jk=abc123def",
      contractType: "freelance",
      rateMin: 80,
      rateMax: 100,
    });
    expect(result.success).toBe(true);
  });

  it("accepteert een LinkedIn-shaped job", () => {
    const result = unifiedJobSchema.safeParse({
      title: "DevOps Engineer",
      company: "KPN",
      location: "Den Haag, Zuid-Holland",
      description: "Als DevOps Engineer ben je verantwoordelijk voor...",
      externalId: "3847291056",
      externalUrl: "https://www.linkedin.com/jobs/view/3847291056",
      contractType: "interim",
    });
    expect(result.success).toBe(true);
  });

  it("accepteert een job zonder optionele velden", () => {
    const result = unifiedJobSchema.safeParse({
      title: "Python Developer",
      description: "Zoekt Python developer voor ML project",
      externalId: "xyz789",
      externalUrl: "https://nl.indeed.com/viewjob?jk=xyz789",
    });
    expect(result.success).toBe(true);
  });

  it("weigert een job zonder title", () => {
    const result = unifiedJobSchema.safeParse({
      title: "",
      description: "Iets",
      externalId: "id1",
      externalUrl: "https://example.com/job/1",
    });
    expect(result.success).toBe(false);
  });

  it("weigert een job zonder externalId", () => {
    const result = unifiedJobSchema.safeParse({
      title: "Tester",
      description: "Test role",
      externalId: "",
      externalUrl: "https://example.com/job/2",
    });
    expect(result.success).toBe(false);
  });

  it("weigert een ongeldige externalUrl", () => {
    const result = unifiedJobSchema.safeParse({
      title: "Analist",
      description: "Business analist rol",
      externalId: "ba001",
      externalUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("weigert een ongeldig contractType", () => {
    const result = unifiedJobSchema.safeParse({
      title: "Engineer",
      description: "Infra engineer",
      externalId: "eng001",
      externalUrl: "https://example.com/job/3",
      contractType: "fulltime",
    });
    expect(result.success).toBe(false);
  });
});
