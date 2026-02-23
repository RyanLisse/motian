import { describe, expect, it } from "vitest";
import { unifiedJobSchema } from "../src/schemas/job";

// ─── 1. Scraper Adapter Config Contracts ─────────────────────────────

const PLATFORM_STEPS = [
  { file: "striive", expectedName: "ScrapeStriive" },
  { file: "indeed", expectedName: "ScrapeIndeed" },
  { file: "linkedin", expectedName: "ScrapeLinkedIn" },
  { file: "opdrachtoverheid", expectedName: "ScrapeOpdrachtoverheid" },
  { file: "flextender", expectedName: "ScrapeFlextender" },
] as const;

describe("Phase 16 — Contract tests", () => {
  describe("Scraper adapter contracts", () => {
    for (const { file, expectedName } of PLATFORM_STEPS) {
      describe(`${file} adapter`, () => {
        it("config.name is a non-empty string", async () => {
          const mod = await import(`../steps/scraper/platforms/${file}.step.ts`);
          expect(typeof mod.config.name).toBe("string");
          expect(mod.config.name.length).toBeGreaterThan(0);
          expect(mod.config.name).toBe(expectedName);
        });

        it("config.triggers exists with at least 1 trigger", async () => {
          const { config } = await import(`../steps/scraper/platforms/${file}.step.ts`);
          expect(Array.isArray(config.triggers)).toBe(true);
          expect(config.triggers.length).toBeGreaterThanOrEqual(1);
        });

        it('each trigger has type "queue" and topic "platform.scrape"', async () => {
          const { config } = await import(`../steps/scraper/platforms/${file}.step.ts`);
          for (const trigger of config.triggers) {
            expect(trigger.type).toBe("queue");
            expect(trigger.topic).toBe("platform.scrape");
          }
        });

        it('config.enqueues includes { topic: "jobs.normalize" }', async () => {
          const { config } = await import(`../steps/scraper/platforms/${file}.step.ts`);
          expect(Array.isArray(config.enqueues)).toBe(true);
          const topics = config.enqueues.map((e: any) => e.topic);
          expect(topics).toContain("jobs.normalize");
        });

        it('config.flows includes "recruitment-scraper"', async () => {
          const { config } = await import(`../steps/scraper/platforms/${file}.step.ts`);
          expect(Array.isArray(config.flows)).toBe(true);
          expect(config.flows).toContain("recruitment-scraper");
        });

        it("handler is exported and is a function", async () => {
          const mod = await import(`../steps/scraper/platforms/${file}.step.ts`);
          expect(mod.handler).toBeDefined();
          expect(typeof mod.handler).toBe("function");
        });
      });
    }
  });

  // ─── 2. Master Scrape Config Contract ────────────────────────────

  describe("Master scrape contract", () => {
    it("has a cron trigger", async () => {
      const { config } = await import("../steps/scraper/master-scrape.step.ts");
      expect(Array.isArray(config.triggers)).toBe(true);
      const cronTriggers = config.triggers.filter((t: any) => t.type === "cron");
      expect(cronTriggers.length).toBeGreaterThanOrEqual(1);
      expect(cronTriggers[0].expression).toBeDefined();
      expect(typeof cronTriggers[0].expression).toBe("string");
    });

    it('enqueues "platform.scrape"', async () => {
      const { config } = await import("../steps/scraper/master-scrape.step.ts");
      const topics = config.enqueues.map((e: any) => e.topic);
      expect(topics).toContain("platform.scrape");
    });

    it('has "recruitment-scraper" flow', async () => {
      const { config } = await import("../steps/scraper/master-scrape.step.ts");
      expect(config.flows).toContain("recruitment-scraper");
    });

    it("handler is exported and is a function", async () => {
      const { handler } = await import("../steps/scraper/master-scrape.step.ts");
      expect(typeof handler).toBe("function");
    });
  });

  // ─── 3. Normalize Step Contract ──────────────────────────────────

  describe("Normalize step contract", () => {
    it('subscribes to "jobs.normalize" queue', async () => {
      const { config } = await import("../steps/jobs/normalize.step.ts");
      const queueTriggers = config.triggers.filter((t: any) => t.type === "queue");
      expect(queueTriggers.length).toBeGreaterThanOrEqual(1);
      expect(queueTriggers[0].topic).toBe("jobs.normalize");
    });

    it('enqueues "scrape.completed"', async () => {
      const { config } = await import("../steps/jobs/normalize.step.ts");
      const topics = config.enqueues.map((e: any) => e.topic);
      expect(topics).toContain("scrape.completed");
    });

    it('has "recruitment-scraper" flow', async () => {
      const { config } = await import("../steps/jobs/normalize.step.ts");
      expect(config.flows).toContain("recruitment-scraper");
    });

    it("handler is exported and is a function", async () => {
      const { handler } = await import("../steps/jobs/normalize.step.ts");
      expect(typeof handler).toBe("function");
    });
  });

  // ─── 4. Record Scrape Result Contract ────────────────────────────

  describe("Record scrape result contract", () => {
    it('subscribes to "scrape.completed" queue', async () => {
      const { config } = await import("../steps/jobs/record-scrape-result.step.ts");
      const queueTriggers = config.triggers.filter((t: any) => t.type === "queue");
      expect(queueTriggers.length).toBeGreaterThanOrEqual(1);
      expect(queueTriggers[0].topic).toBe("scrape.completed");
    });

    it('has "recruitment-scraper" flow', async () => {
      const { config } = await import("../steps/jobs/record-scrape-result.step.ts");
      expect(config.flows).toContain("recruitment-scraper");
    });

    it("handler is exported and is a function", async () => {
      const { handler } = await import("../steps/jobs/record-scrape-result.step.ts");
      expect(typeof handler).toBe("function");
    });
  });

  // ─── 5. API Step Contracts ───────────────────────────────────────

  describe("API step contracts", () => {
    describe("opdrachten.step — GET /api/opdrachten", () => {
      it("has an HTTP GET trigger on /api/opdrachten", async () => {
        const { config } = await import("../steps/api/opdrachten.step.ts");
        const httpTriggers = config.triggers.filter((t: any) => t.type === "http");
        expect(httpTriggers.length).toBeGreaterThanOrEqual(1);
        const getTrigger = httpTriggers.find((t: any) => t.method === "GET");
        expect(getTrigger).toBeDefined();
        expect(getTrigger?.path).toBe("/api/opdrachten");
      });

      it('has "recruitment-pipeline" flow', async () => {
        const { config } = await import("../steps/api/opdrachten.step.ts");
        expect(config.flows).toContain("recruitment-pipeline");
      });

      it("handler is exported and is a function", async () => {
        const { handler } = await import("../steps/api/opdrachten.step.ts");
        expect(typeof handler).toBe("function");
      });
    });

    describe("opdracht-detail.step — GET+PATCH+DELETE /api/opdrachten/:id", () => {
      it("has GET, PATCH, and DELETE triggers on /api/opdrachten/:id", async () => {
        const { config } = await import("../steps/api/opdracht-detail.step.ts");
        const httpTriggers = config.triggers.filter((t: any) => t.type === "http");
        expect(httpTriggers.length).toBeGreaterThanOrEqual(3);

        const methods = httpTriggers.map((t: any) => t.method);
        expect(methods).toContain("GET");
        expect(methods).toContain("PATCH");
        expect(methods).toContain("DELETE");

        for (const trigger of httpTriggers) {
          expect(trigger.path).toBe("/api/opdrachten/:id");
        }
      });

      it('has "recruitment-pipeline" flow', async () => {
        const { config } = await import("../steps/api/opdracht-detail.step.ts");
        expect(config.flows).toContain("recruitment-pipeline");
      });

      it("handler is exported and is a function", async () => {
        const { handler } = await import("../steps/api/opdracht-detail.step.ts");
        expect(typeof handler).toBe("function");
      });
    });

    describe("candidates.step — GET+POST /api/kandidaten", () => {
      it("has GET and POST triggers on /api/kandidaten", async () => {
        const { config } = await import("../steps/api/candidates.step.ts");
        const httpTriggers = config.triggers.filter((t: any) => t.type === "http");
        expect(httpTriggers.length).toBeGreaterThanOrEqual(2);

        const methods = httpTriggers.map((t: any) => t.method);
        expect(methods).toContain("GET");
        expect(methods).toContain("POST");

        for (const trigger of httpTriggers) {
          expect(trigger.path).toBe("/api/kandidaten");
        }
      });

      it('has "recruitment-pipeline" flow', async () => {
        const { config } = await import("../steps/api/candidates.step.ts");
        expect(config.flows).toContain("recruitment-pipeline");
      });

      it("handler is exported and is a function", async () => {
        const { handler } = await import("../steps/api/candidates.step.ts");
        expect(typeof handler).toBe("function");
      });
    });

    describe("matches.step — GET /api/matches", () => {
      it("has an HTTP GET trigger on /api/matches", async () => {
        const { config } = await import("../steps/api/matches.step.ts");
        const httpTriggers = config.triggers.filter((t: any) => t.type === "http");
        expect(httpTriggers.length).toBeGreaterThanOrEqual(1);
        const getTrigger = httpTriggers.find((t: any) => t.method === "GET");
        expect(getTrigger).toBeDefined();
        expect(getTrigger?.path).toBe("/api/matches");
      });

      it('has "recruitment-pipeline" flow', async () => {
        const { config } = await import("../steps/api/matches.step.ts");
        expect(config.flows).toContain("recruitment-pipeline");
      });

      it("handler is exported and is a function", async () => {
        const { handler } = await import("../steps/api/matches.step.ts");
        expect(typeof handler).toBe("function");
      });
    });

    describe("generate-matches.step — POST /api/matches/genereren", () => {
      it("has an HTTP POST trigger on /api/matches/genereren", async () => {
        const { config } = await import("../steps/api/generate-matches.step.ts");
        const httpTriggers = config.triggers.filter((t: any) => t.type === "http");
        expect(httpTriggers.length).toBeGreaterThanOrEqual(1);
        const postTrigger = httpTriggers.find((t: any) => t.method === "POST");
        expect(postTrigger).toBeDefined();
        expect(postTrigger?.path).toBe("/api/matches/genereren");
      });

      it('enqueues "matches.generate"', async () => {
        const { config } = await import("../steps/api/generate-matches.step.ts");
        expect(Array.isArray(config.enqueues)).toBe(true);
        const topics = config.enqueues.map((e: any) => e.topic);
        expect(topics).toContain("matches.generate");
      });

      it('has "recruitment-pipeline" flow', async () => {
        const { config } = await import("../steps/api/generate-matches.step.ts");
        expect(config.flows).toContain("recruitment-pipeline");
      });

      it("handler is exported and is a function", async () => {
        const { handler } = await import("../steps/api/generate-matches.step.ts");
        expect(typeof handler).toBe("function");
      });
    });
  });

  // ─── 6. Zod Schema Validation ────────────────────────────────────

  describe("Zod schema validation (unifiedJobSchema)", () => {
    const validJob = {
      externalId: "TEST-001",
      externalUrl: "https://example.com/job/TEST-001",
      title: "Senior Developer",
      platform: "striive",
      description: "A great opportunity for a senior developer to join our team",
    };

    it("valid complete job object passes", () => {
      const result = unifiedJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
    });

    it("valid job with all optional fields passes", () => {
      const full = {
        ...validJob,
        company: "Acme Corp",
        contractLabel: "Striive Premium",
        location: "Amsterdam - Noord-Holland",
        province: "Noord-Holland",
        clientReferenceCode: "REF-123",
        rateMin: 80,
        rateMax: 120,
        currency: "EUR",
        positionsAvailable: 2,
        startDate: "2026-03-01",
        endDate: "2026-09-01",
        applicationDeadline: "2026-02-28",
        postedAt: "2026-02-20",
        contractType: "freelance" as const,
        workArrangement: "hybride" as const,
        allowsSubcontracting: true,
        requirements: [{ description: "5+ jaar ervaring", isKnockout: true }],
        wishes: [{ description: "Scrum ervaring" }],
        competences: ["Communicatie", "Teamwork"],
        conditions: ["WKA", "G-rekening"],
      };
      const result = unifiedJobSchema.safeParse(full);
      expect(result.success).toBe(true);
    });

    it("missing required title fails", () => {
      const { title, ...noTitle } = validJob;
      const result = unifiedJobSchema.safeParse(noTitle);
      expect(result.success).toBe(false);
    });

    it("empty title string fails", () => {
      const result = unifiedJobSchema.safeParse({ ...validJob, title: "" });
      expect(result.success).toBe(false);
    });

    it("missing required externalId fails", () => {
      const { externalId, ...noId } = validJob;
      const result = unifiedJobSchema.safeParse(noId);
      expect(result.success).toBe(false);
    });

    it("empty externalId string fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        externalId: "",
      });
      expect(result.success).toBe(false);
    });

    it("missing required externalUrl fails", () => {
      const { externalUrl, ...noUrl } = validJob;
      const result = unifiedJobSchema.safeParse(noUrl);
      expect(result.success).toBe(false);
    });

    it("invalid URL format for externalUrl fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        externalUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("description under 10 chars fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        description: "Too short",
      });
      expect(result.success).toBe(false);
    });

    it("invalid date string for startDate fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        startDate: "not-a-date",
      });
      expect(result.success).toBe(false);
    });

    it("invalid date string for endDate fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        endDate: "yesterday",
      });
      expect(result.success).toBe(false);
    });

    it("invalid contractType enum value fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        contractType: "invalid-type",
      });
      expect(result.success).toBe(false);
    });

    it("invalid workArrangement enum value fails", () => {
      const result = unifiedJobSchema.safeParse({
        ...validJob,
        workArrangement: "invalid-arrangement",
      });
      expect(result.success).toBe(false);
    });

    it("defaults arrays to empty when not provided", () => {
      const result = unifiedJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requirements).toEqual([]);
        expect(result.data.wishes).toEqual([]);
        expect(result.data.competences).toEqual([]);
        expect(result.data.conditions).toEqual([]);
      }
    });

    it("defaults currency to EUR when not provided", () => {
      const result = unifiedJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe("EUR");
      }
    });

    it("defaults positionsAvailable to 1 when not provided", () => {
      const result = unifiedJobSchema.safeParse(validJob);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.positionsAvailable).toBe(1);
      }
    });
  });
});
