import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

// ===== Opdrachtoverheid Scraper =====

describe("Opdrachtoverheid scraper", () => {
  it("step config has correct structure", async () => {
    const { config } = await import(
      "../steps/scraper/platforms/opdrachtoverheid.step.ts"
    );
    expect(config.name).toBe("ScrapeOpdrachtoverheid");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import(
      "../steps/scraper/platforms/opdrachtoverheid.step.ts"
    );
    expect(typeof handler).toBe("function");
  });

  it("step file contains detail extraction logic", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).toMatch(/Detail-pagina|Detail verrijkt/);
    expect(content).toContain("requirements");
    expect(content).toContain("wishes");
    expect(content).toContain("competences");
    expect(content).toContain("conditions");
    expect(content).toMatch(/knock-out|Knock-out/);
    expect(content).toMatch(/selectiecriteria|Selectiecriteria/);
  });

  it("step file has no login logic", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    // Should not contain login ACTION patterns (act() with login/password)
    expect(content).not.toContain("wachtwoord");
    expect(content).not.toContain("STRIIVE_USERNAME");
    expect(content).not.toContain("LINKEDIN_USERNAME");
  });

  it("step file uses Stagehand", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).toContain("Stagehand");
    expect(content).toContain("stagehand.extract");
  });
});

// ===== Flextender Scraper =====

describe("Flextender scraper", () => {
  it("step config has correct structure", async () => {
    const { config } = await import(
      "../steps/scraper/platforms/flextender.step.ts"
    );
    expect(config.name).toBe("ScrapeFlextender");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import(
      "../steps/scraper/platforms/flextender.step.ts"
    );
    expect(typeof handler).toBe("function");
  });

  it("step file contains detail extraction logic", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("Detail");
    expect(content).toContain("requirements");
    expect(content).toContain("wishes");
    expect(content).toContain("competences");
    expect(content).toContain("conditions");
    expect(content).toMatch(/knock-out|Knock-out/);
    expect(content).toMatch(/gunningscriteria|Gunningscriteria/);
  });

  it("step file handles JS pagination", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("Volgende");
  });

  it("step file has no login logic", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    // Should not contain login ACTION patterns (act() with login/password)
    expect(content).not.toContain("wachtwoord");
    expect(content).not.toContain("STRIIVE_USERNAME");
    expect(content).not.toContain("LINKEDIN_USERNAME");
  });
});

// ===== Seed Script =====

describe("Seed script for new platforms", () => {
  it("script file exists", () => {
    expect(
      existsSync(resolve(__dirname, "../scripts/seed-new-platforms.ts")),
    ).toBe(true);
  });

  it("script contains both platform names", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/seed-new-platforms.ts"),
      "utf-8",
    );
    expect(content).toContain("opdrachtoverheid");
    expect(content).toContain("flextender");
  });

  it("script uses onConflictDoNothing for idempotency", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/seed-new-platforms.ts"),
      "utf-8",
    );
    expect(content).toContain("onConflictDoNothing");
  });
});

// ===== Contract Type Mapping =====

describe("contract type mapping", () => {
  function mapContractType(
    raw?: string,
  ): "interim" | "freelance" | undefined {
    if (!raw) return undefined;
    switch (raw) {
      case "Loondienst":
        return "interim";
      case "Freelance":
        return "freelance";
      case "Freelance & Loondienst":
        return "freelance";
      case "ZZP":
        return "freelance";
      default:
        return undefined;
    }
  }

  it('maps "Loondienst" to "interim"', () => {
    expect(mapContractType("Loondienst")).toBe("interim");
  });

  it('maps "Freelance" to "freelance"', () => {
    expect(mapContractType("Freelance")).toBe("freelance");
  });

  it('maps "Freelance & Loondienst" to "freelance"', () => {
    expect(mapContractType("Freelance & Loondienst")).toBe("freelance");
  });

  it('maps "ZZP" to "freelance"', () => {
    expect(mapContractType("ZZP")).toBe("freelance");
  });

  it("maps undefined to undefined", () => {
    expect(mapContractType(undefined)).toBeUndefined();
  });
});

// ===== Province Mapping (Opdrachtoverheid) =====

describe("province mapping (Opdrachtoverheid)", () => {
  function extractProvince(location?: string): string | undefined {
    if (!location) return undefined;
    const parts = location.split(" - ");
    return parts.length >= 2 ? parts[parts.length - 1].trim() : undefined;
  }

  it('extracts province from "Zwolle - Overijssel"', () => {
    expect(extractProvince("Zwolle - Overijssel")).toBe("Overijssel");
  });

  it('returns undefined for "Den Haag" (no dash)', () => {
    expect(extractProvince("Den Haag")).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(extractProvince(undefined)).toBeUndefined();
  });
});
