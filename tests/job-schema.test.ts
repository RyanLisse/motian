import { describe, expect, it } from "vitest";
import { extractProvince, unifiedJobSchema } from "../src/schemas/job";

describe("Unified Job Schema", () => {
  it("should accept a valid Striive opdracht (all fields)", () => {
    const striiveJob = {
      title: "Junior Projectleider",
      company: "Belastingdienst Non-ICT",
      contractLabel: "Between",
      location: "Utrecht - Utrecht",
      province: "Utrecht",
      description:
        "Kandidaat heeft minimaal 1 jaar werkervaring in de rol van junior Projectleider...",
      externalId: "BTBDN000695",
      externalUrl: "https://supplier.striive.com/dashboard/opdrachten/BTBDN000695",
      clientReferenceCode: "SRQ187726",
      rateMax: 84.5,
      positionsAvailable: 1,
      startDate: "2026-02-19",
      endDate: "2026-12-31",
      applicationDeadline: "2026-02-24",
      workArrangement: "hybride",
      allowsSubcontracting: false,
      requirements: [
        {
          description: "Minimaal 1 jaar werkervaring als junior Projectleider",
          isKnockout: true,
        },
        {
          description: "Ervaring bij overheidsorganisaties",
          isKnockout: false,
        },
      ],
      wishes: [
        {
          description: "Ervaring met Agile/Scrum methodieken",
          evaluationCriteria: "De mate waarin de kandidaat...",
        },
      ],
      competences: ["Resultaatgerichtheid", "Flexibiliteit", "Plannen en organiseren"],
      conditions: ["WKA", "G-rekening", "SNA-certificering"],
    };

    const result = unifiedJobSchema.safeParse(striiveJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.positionsAvailable).toBe(1);
      expect(result.data.workArrangement).toBe("hybride");
      expect(result.data.requirements).toHaveLength(2);
      expect(result.data.competences).toContain("Flexibiliteit");
    }
  });

  it("should accept a simple Indeed job (string requirements)", () => {
    const valid = {
      title: "Senior Frontend Developer",
      company: "TechCorp",
      location: "Amsterdam",
      description: "We zoeken een ervaren developer met React kennis.",
      externalId: "job-12345",
      externalUrl: "https://nl.indeed.com/viewjob?jk=abc123",
      requirements: ["React", "TypeScript"],
    };
    expect(unifiedJobSchema.safeParse(valid).success).toBe(true);
  });

  it("should reject job without title", () => {
    const invalid = { title: "", externalId: "123", description: "kort" };
    expect(unifiedJobSchema.safeParse(invalid).success).toBe(false);
  });

  it("should reject job without description (min 10 chars)", () => {
    const invalid = {
      title: "Dev",
      externalId: "123",
      externalUrl: "https://example.com/job/123",
      description: "kort",
    };
    expect(unifiedJobSchema.safeParse(invalid).success).toBe(false);
  });

  it("should default requirements, wishes, competences to empty arrays", () => {
    const job = {
      title: "Backend Dev",
      externalId: "456",
      externalUrl: "https://example.com/job/456",
      description: "Een mooie baan voor een backend developer.",
    };
    const result = unifiedJobSchema.parse(job);
    expect(result.requirements).toEqual([]);
    expect(result.wishes).toEqual([]);
    expect(result.competences).toEqual([]);
    expect(result.conditions).toEqual([]);
  });

  it("should accept endClient and default status to open", () => {
    const result = unifiedJobSchema.parse({
      title: "Data Engineer",
      externalId: "status-1",
      externalUrl: "https://example.com/job/status-1",
      description: "Een mooie opdracht voor een ervaren data engineer.",
      company: "Between",
      endClient: "Gemeente Utrecht",
    });

    expect(result.endClient).toBe("Gemeente Utrecht");
    expect(result.status).toBe("open");
  });

  it("should coerce date strings to Date objects", () => {
    const job = {
      title: "PM",
      externalId: "789",
      externalUrl: "https://example.com/job/789",
      description: "Project management opdracht bij grote organisatie.",
      startDate: "2026-03-01",
      applicationDeadline: "2026-02-28",
    };
    const result = unifiedJobSchema.parse(job);
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.applicationDeadline).toBeInstanceOf(Date);
  });
});

describe("extractProvince", () => {
  it("should extract province from 'City - Province' format", () => {
    expect(extractProvince("Utrecht - Utrecht")).toBe("Utrecht");
    expect(extractProvince("Den Haag - Zuid-Holland")).toBe("Zuid-Holland");
  });

  it("should return undefined for city-only format", () => {
    expect(extractProvince("Amsterdam")).toBeUndefined();
  });
});
