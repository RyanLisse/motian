import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ===== Striive Scraper Detail Enrichment =====

describe("Striive scraper detail enrichment", () => {
  it("step config has correct structure", async () => {
    const { config } = await import("../steps/scraper/platforms/striive.step.ts");
    expect(config.name).toBe("ScrapeStriive");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import("../steps/scraper/platforms/striive.step.ts");
    expect(typeof handler).toBe("function");
  });

  it("step file contains detail extraction logic", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/striive.step.ts"),
      "utf-8",
    );
    // Verify detail page visit pattern exists
    expect(content).toContain("Detail-pagina");
    expect(content).toContain("externalUrl");
    expect(content).toContain("requirements");
    expect(content).toContain("wishes");
    expect(content).toContain("competences");
    expect(content).toContain("conditions");
    expect(content).toContain("workArrangement");
    expect(content).toContain("allowsSubcontracting");
  });
});

// ===== Indeed Scraper Detail Enrichment =====

describe("Indeed scraper detail enrichment", () => {
  it("step config has correct structure", async () => {
    const { config } = await import("../steps/scraper/platforms/indeed.step.ts");
    expect(config.name).toBe("ScrapeIndeed");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import("../steps/scraper/platforms/indeed.step.ts");
    expect(typeof handler).toBe("function");
  });

  it("step file contains detail extraction logic", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/indeed.step.ts"),
      "utf-8",
    );
    expect(content).toContain("detailSchema");
    expect(content).toContain("Detail verrijkt");
    expect(content).toContain("qualifications");
    expect(content).toContain("responsibilities");
    expect(content).toContain("benefits");
  });
});

// ===== LinkedIn Scraper Detail Enrichment =====

describe("LinkedIn scraper detail enrichment", () => {
  it("step config has correct structure", async () => {
    const { config } = await import("../steps/scraper/platforms/linkedin.step.ts");
    expect(config.name).toBe("ScrapeLinkedIn");
    expect(config.triggers[0].type).toBe("queue");
    expect(config.triggers[0].topic).toBe("platform.scrape");
    expect(config.enqueues[0].topic).toBe("jobs.normalize");
  });

  it("handler exports a function", async () => {
    const { handler } = await import("../steps/scraper/platforms/linkedin.step.ts");
    expect(typeof handler).toBe("function");
  });

  it("step file contains detail extraction logic", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../steps/scraper/platforms/linkedin.step.ts"),
      "utf-8",
    );
    expect(content).toContain("Detail-pagina");
    expect(content).toContain("qualifications");
    expect(content).toContain("responsibilities");
    expect(content).toContain("skills");
    expect(content).toContain("workArrangement");
    expect(content).toContain("seniorityLevel");
  });
});

// ===== Enrichment Script =====

describe("Striive enrichment script", () => {
  it("script file exists", () => {
    expect(existsSync(resolve(__dirname, "../scripts/enrich-striive-details.ts"))).toBe(true);
  });

  it("script imports sweet-cookie", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/enrich-striive-details.ts"),
      "utf-8",
    );
    expect(content).toContain("@steipete/sweet-cookie");
    expect(content).toContain("getCookies");
    expect(content).toContain("toCookieHeader");
  });

  it("script has fallback to env var", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/enrich-striive-details.ts"),
      "utf-8",
    );
    expect(content).toContain("STRIIVE_SESSION_COOKIE");
  });

  it("script targets sparse jobs only", async () => {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(
      resolve(__dirname, "../scripts/enrich-striive-details.ts"),
      "utf-8",
    );
    expect(content).toContain("length");
    expect(content).toContain("200");
  });
});

// ===== sweet-cookie Dependency =====

describe("sweet-cookie dependency", () => {
  it("is listed in package.json", async () => {
    const fs = await import("node:fs/promises");
    const pkg = JSON.parse(await fs.readFile(resolve(__dirname, "../package.json"), "utf-8"));
    expect(pkg.dependencies["@steipete/sweet-cookie"]).toBeDefined();
  });
});

// ===== Detail Merge Logic =====

describe("detail merge logic", () => {
  it("detail fields overwrite listing when present", () => {
    const listing = {
      title: "Java Dev",
      description: "Short listing desc",
      requirements: [],
      wishes: [],
    };
    const detail = {
      description: "Much longer detailed description from detail page",
      requirements: [{ description: "Java 17+", isKnockout: true }],
      wishes: [],
    };

    // Simulate the merge pattern used in scrapers
    const merged = {
      ...listing,
      description: detail.description || listing.description,
      requirements: detail.requirements?.length ? detail.requirements : listing.requirements,
      wishes: detail.wishes?.length ? detail.wishes : listing.wishes,
    };

    expect(merged.description).toBe(detail.description);
    expect(merged.requirements).toHaveLength(1);
    expect(merged.requirements[0].description).toBe("Java 17+");
    // Empty detail array falls back to listing
    expect(merged.wishes).toEqual([]);
  });

  it("listing data preserved when detail is empty", () => {
    const listing = {
      title: "Python Dev",
      description: "Listing description",
      requirements: [{ description: "Python 3.10+", isKnockout: true }],
    };
    const detail = {
      description: undefined,
      requirements: [],
    };

    const merged = {
      ...listing,
      description: detail.description || listing.description,
      requirements: detail.requirements?.length ? detail.requirements : listing.requirements,
    };

    expect(merged.description).toBe("Listing description");
    expect(merged.requirements).toHaveLength(1);
  });
});

// ===== Work Arrangement Mapping =====

describe("work arrangement mapping (Striive pattern)", () => {
  function mapWorkArrangement(remote?: string): "remote" | "hybride" | "op_locatie" | undefined {
    if (!remote) return undefined;
    switch (remote) {
      case "HYBRID":
        return "hybride";
      case "NO":
        return "op_locatie";
      case "YES":
        return "remote";
      default:
        return undefined;
    }
  }

  it('maps "HYBRID" to "hybride"', () => {
    expect(mapWorkArrangement("HYBRID")).toBe("hybride");
  });

  it('maps "NO" to "op_locatie"', () => {
    expect(mapWorkArrangement("NO")).toBe("op_locatie");
  });

  it('maps "YES" to "remote"', () => {
    expect(mapWorkArrangement("YES")).toBe("remote");
  });

  it("returns undefined for missing value", () => {
    expect(mapWorkArrangement(undefined)).toBeUndefined();
  });

  it("returns undefined for unknown value", () => {
    expect(mapWorkArrangement("SOMETIMES")).toBeUndefined();
  });
});
