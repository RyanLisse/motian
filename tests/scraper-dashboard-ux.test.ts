import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("scraper dashboard UX", () => {
  it("surfaces richer databronnen monitoring sections on the scraper page", () => {
    const source = readFile("app", "scraper", "page.tsx");

    expect(source).toContain(
      "Volg databronnen, overlap tussen platforms en operationele gezondheid vanuit één overzicht",
    );
    expect(source).toContain("Overlapgroepen");
    expect(source).toContain("Platforms met aandacht");
    expect(source).toContain("Per-platform gezondheid");
    expect(source).toContain("Trigger.dev zichtbaarheid");
    expect(source).toContain("CrossPlatformListings");
    expect(source).toContain("RecentActivityFeed");
  });

  it("explains overlap, updates, nieuw, and skipped in plain Dutch", () => {
    const source = readFile("components", "scraper", "scrape-metrics-explainer.tsx");

    expect(source).toContain("Overlap tussen bronnen");
    expect(source).toContain("Bijgewerkt (zelfde bron)");
    expect(source).toContain("Nieuw toegevoegd");
    expect(source).toContain("Overgeslagen");
    expect(source).toContain(
      "De databronnen-UX maakt onderscheid tussen overlap tussen platforms en updates binnen één",
    );
  });

  it("renders cross-platform groups with direct links and platform badges", () => {
    const source = readFile("components", "scraper", "cross-platform-listings.tsx");

    expect(source).toContain("Platform-overlap tussen bronnen");
    expect(source).toContain("Open opdracht");
    expect(source).toContain("Externe bron");
    expect(source).toContain("PlatformBadge");
    expect(source).toContain("Match op:");
  });
});
