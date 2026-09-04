import { describe, expect, it } from "vitest";
import { escapeHtml, markdownToHtml } from "../app/reports/[id]/page";
import type { CriterionResult } from "../src/schemas/matching";
import { generateReport } from "../src/services/report-generator";

/** True when an unescaped HTML tag with an event handler attribute is present. */
function hasExecutableEventAttr(html: string): boolean {
  return /<[a-z][^>]*\sonerror\s*=/i.test(html);
}

describe("report HTML escaping (AE7)", () => {
  it('escapeHtml encodes &, <, >, and "', () => {
    expect(escapeHtml(`a&b<c>d"e`)).toBe("a&amp;b&lt;c&gt;d&quot;e");
  });

  it("injected markup in a paragraph renders as escaped text, not attributes (AE7)", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const html = markdownToHtml(payload);

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(hasExecutableEventAttr(html)).toBe(false);
  });

  it("injected markup in headings and list items is escaped", () => {
    const md = [
      "# Title <script>alert(1)</script>",
      "## Sub <img src=x onerror=alert(1)>",
      "- item <b>bold</b>",
      "1. ordered <iframe>",
    ].join("\n");

    const html = markdownToHtml(md);

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("&lt;iframe&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img ");
    expect(html).not.toContain("<iframe>");
    expect(hasExecutableEventAttr(html)).toBe(false);
  });

  it("table cells escape untrusted field values", () => {
    const md = [
      "| Eis | Resultaat | Onderbouwing |",
      "|-----|-----------|-------------|",
      "| JS <img src=x onerror=alert(1)> | Voldaan | ok |",
    ].join("\n");

    const html = markdownToHtml(md);

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(hasExecutableEventAttr(html)).toBe(false);
    expect(html).toContain("<table>");
    expect(html).toContain("<td>");
  });

  it("emphasis still renders after escaping", () => {
    const html = markdownToHtml("**vet** en *cursief*");
    expect(html).toContain("<strong>vet</strong>");
    expect(html).toContain("<em>cursief</em>");
  });

  it("generateReport fields with XSS payloads are escaped when rendered", () => {
    const xss = "<img src=x onerror=alert(1)>";
    const criteria: CriterionResult[] = [
      {
        criterion: xss,
        tier: "knockout",
        passed: true,
        stars: null,
        evidence: `Bewijs ${xss}`,
        confidence: "high",
      },
    ];

    const markdown = generateReport({
      candidate: { name: xss, role: xss, location: xss },
      job: { title: "Role", company: xss, location: "NL" },
      match: {
        criteriaBreakdown: criteria,
        overallScore: 50,
        knockoutsPassed: true,
        riskProfile: [xss],
        enrichmentSuggestions: [xss],
        recommendation: "go",
        recommendationReasoning: xss,
        recommendationConfidence: 70,
      },
    });

    const html = markdownToHtml(markdown);

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(hasExecutableEventAttr(html)).toBe(false);
  });
});
