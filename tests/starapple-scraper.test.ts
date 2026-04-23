import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseStarappleDetail, parseStarappleSitemap } from "../packages/scrapers/src/starapple";

const fixturesDir = join(__dirname, "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

describe("parseStarappleSitemap", () => {
  it("returns at least one URL from the fixture", () => {
    const xml = loadFixture("starapple-sitemap.xml");
    const urls = parseStarappleSitemap(xml);
    expect(urls.length).toBeGreaterThanOrEqual(1);
  });

  it("all returned URLs start with https://www.starapple.nl/vacatures/", () => {
    const xml = loadFixture("starapple-sitemap.xml");
    const urls = parseStarappleSitemap(xml);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/www\.starapple\.nl\/vacatures\//);
    }
  });

  it("filters out the /vacatures/ archive page", () => {
    const xml = loadFixture("starapple-sitemap.xml");
    const urls = parseStarappleSitemap(xml);
    expect(urls).not.toContain("https://www.starapple.nl/vacatures/");
  });

  it("includes individual vacancy slugs", () => {
    const xml = loadFixture("starapple-sitemap.xml");
    const urls = parseStarappleSitemap(xml);
    expect(urls).toContain("https://www.starapple.nl/vacatures/cloud-engineer-22/");
  });

  it("handles XML with only the archive page — returns empty array", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.starapple.nl/vacatures/</loc></url></urlset>`;
    expect(parseStarappleSitemap(xml)).toEqual([]);
  });

  it("handles empty XML gracefully", () => {
    expect(parseStarappleSitemap("")).toEqual([]);
  });
});

describe("parseStarappleDetail", () => {
  const detailUrl = "https://www.starapple.nl/vacatures/cloud-engineer-22/";

  it("extracts the correct title from the h1", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Cloud Engineer");
  });

  it("derives externalId from the slug", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result?.externalId).toBe("cloud-engineer-22");
  });

  it("sets externalUrl to the supplied URL", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result?.externalUrl).toBe(detailUrl);
  });

  it("description contains more than 100 characters", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result?.description.length).toBeGreaterThan(100);
  });

  it("description includes content from h3 sections", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result?.description).toContain("Organisatie");
    expect(result?.description).toContain("Functie");
  });

  it("extracts location when present", () => {
    const html = loadFixture("starapple-detail.html");
    const result = parseStarappleDetail(html, detailUrl);
    expect(result?.location).toBe("Schiedam");
  });

  it("returns null for empty HTML", () => {
    expect(parseStarappleDetail("", detailUrl)).toBeNull();
  });

  it("returns null when there is no usable h1", () => {
    const html = `<html><body><main><p>Deze vacature is verlopen.</p></main></body></html>`;
    expect(parseStarappleDetail(html, detailUrl)).toBeNull();
  });

  it("returns null when h1 is too short (< 3 chars)", () => {
    const html = `<html><body><main><h1>OK</h1></main></body></html>`;
    expect(parseStarappleDetail(html, detailUrl)).toBeNull();
  });
});
