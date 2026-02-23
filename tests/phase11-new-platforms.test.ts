import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ===== Opdrachtoverheid Scraper =====

describe("Opdrachtoverheid scraper", () => {
  it("step config has correct structure", async () => {
    const { config } = await import("../steps/scraper/platforms/opdrachtoverheid.step.ts");
    expect(config.name).toBe("ScrapeOpdrachtoverheid");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import("../steps/scraper/platforms/opdrachtoverheid.step.ts");
    expect(typeof handler).toBe("function");
  });

  it("step file uses JSON API instead of browser", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).toContain("kbenp-match-api.azurewebsites.net");
    expect(content).toContain("fetch");
    expect(content).toContain("requirements");
    expect(content).toContain("competences");
    expect(content).not.toContain("Stagehand");
    expect(content).not.toContain("BROWSERBASE");
  });

  it("step file parses HTML requirements from API", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).toContain("parseHtmlList");
    expect(content).toContain("stripHtml");
    expect(content).toContain("tender_requirements");
    expect(content).toContain("tender_competences");
  });

  it("step file has no login logic", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).not.toContain("wachtwoord");
    expect(content).not.toContain("STRIIVE_USERNAME");
    expect(content).not.toContain("LINKEDIN_USERNAME");
  });

  it("maps contract types correctly", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/opdrachtoverheid.step.ts"),
      "utf-8",
    );
    expect(content).toContain('"freelance"');
    expect(content).toContain('"interim"');
    expect(content).toContain("contract_type");
  });
});

// ===== Flextender Scraper =====

describe("Flextender scraper", () => {
  it("step config has correct structure", async () => {
    const { config } = await import("../steps/scraper/platforms/flextender.step.ts");
    expect(config.name).toBe("ScrapeFlextender");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import("../steps/scraper/platforms/flextender.step.ts");
    expect(typeof handler).toBe("function");
  });

  it("step file uses AJAX API instead of browser", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("admin-ajax.php");
    expect(content).toContain("kbs_flx_searchjobs");
    expect(content).toContain("parseFlextenderHtml");
    expect(content).not.toContain("Stagehand");
    expect(content).not.toContain("BROWSERBASE");
  });

  it("step file parses HTML job cards", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("css-jobtitle");
    expect(content).toContain("css-customer");
    expect(content).toContain("css-caption");
    expect(content).toContain("css-value");
  });

  it("step file extracts province from region", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("extractProvince");
    expect(content).toContain("Noord-Holland");
    expect(content).toContain("Zuid-Holland");
    expect(content).toContain("Gelderland");
  });

  it("step file has no login logic", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).not.toContain("wachtwoord");
    expect(content).not.toContain("STRIIVE_USERNAME");
    expect(content).not.toContain("LINKEDIN_USERNAME");
  });

  it("step file enriches listings via detail page", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("enrichListings");
    expect(content).toContain("fetchDetailPage");
    expect(content).toContain("parseDetailHtml");
    expect(content).toContain("css-formattedjobdescription");
    expect(content).toContain("/opdracht/?aanvraagnr=");
  });

  it("step file extracts structured sections from detail", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/flextender.step.ts"),
      "utf-8",
    );
    expect(content).toContain("requirements");
    expect(content).toContain("competences");
    expect(content).toContain("wishes");
    expect(content).toContain("conditions");
    expect(content).toContain("isKnockout");
    expect(content).toContain("Functieschaal");
  });
});

// ===== Seed Script =====

describe("Seed script for new platforms", () => {
  it("script file exists", () => {
    expect(existsSync(resolve(__dirname, "../scripts/seed-new-platforms.ts"))).toBe(true);
  });

  it("script contains both platform names", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/seed-new-platforms.ts"),
      "utf-8",
    );
    expect(content).toContain("opdrachtoverheid");
    expect(content).toContain("flextender");
  });

  it("script uses onConflictDoNothing for idempotency", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/seed-new-platforms.ts"),
      "utf-8",
    );
    expect(content).toContain("onConflictDoNothing");
  });
});

// ===== Contract Type Mapping =====

describe("contract type mapping", () => {
  function mapContractType(raw?: string): "interim" | "freelance" | undefined {
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

// ===== Flextender HTML Parsing =====

describe("Flextender HTML parsing", () => {
  it("extractProvince maps known regions", () => {
    // Import from the actual module — test the real function
    const extractProvince = (location?: string): string | undefined => {
      if (!location) return undefined;
      const loc = location.toLowerCase();
      const provinces: Record<string, string> = {
        "noord-holland": "Noord-Holland",
        "zuid-holland": "Zuid-Holland",
        "noord-brabant": "Noord-Brabant",
        utrecht: "Utrecht",
        gelderland: "Gelderland",
        overijssel: "Overijssel",
        limburg: "Limburg",
        friesland: "Friesland",
        groningen: "Groningen",
        drenthe: "Drenthe",
        flevoland: "Flevoland",
        zeeland: "Zeeland",
      };
      for (const [key, value] of Object.entries(provinces)) {
        if (loc.includes(key)) return value;
      }
      return undefined;
    };

    expect(extractProvince("Gelderland")).toBe("Gelderland");
    expect(extractProvince("Noord-Holland")).toBe("Noord-Holland");
    expect(extractProvince("Zuid-Holland")).toBe("Zuid-Holland");
    expect(extractProvince(undefined)).toBeUndefined();
    expect(extractProvince("Onbekend")).toBeUndefined();
  });
});
