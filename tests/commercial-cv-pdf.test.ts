import { describe, expect, it } from "vitest";
import { renderCommercialCvHtml } from "../src/services/commercial-cv-pdf";

describe("renderCommercialCvHtml", () => {
  const baseDraft = {
    title: "Commercieel CV — Jan de Vries",
    body: [
      "# Jan de Vries",
      "",
      "**Rol:** Senior Software Engineer",
      "",
      "## Profiel",
      "Ervaren full-stack ontwikkelaar met 10+ jaar ervaring.",
      "",
      "## Kerncompetenties",
      "- TypeScript",
      "- React",
      "- Node.js",
      "",
      "## Ervaring (highlights)",
      "- Lead developer bij TechCo (2020–2024)",
      "- Senior engineer bij StartupX (2017–2020)",
      "",
      "## Beschikbaarheid & voorkeuren",
      "- Locatie: Amsterdam",
      "- Beschikbaarheid: Direct beschikbaar",
      "",
      "---",
      "_Concept gegenereerd door Motian — controleer altijd vóór verzending._",
    ].join("\n"),
  };

  it("returns a self-contained HTML document", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes candidate name in header", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("Jan de Vries");
  });

  it("includes role from the body", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("Senior Software Engineer");
  });

  it("converts markdown sections (##) into HTML headings", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<h2");
    expect(html).toContain("Profiel");
    expect(html).toContain("Kerncompetenties");
    expect(html).toContain("Ervaring (highlights)");
  });

  it("converts markdown list items into HTML list elements", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<li>");
    expect(html).toContain("TypeScript");
    expect(html).toContain("React");
  });

  it("converts bold markdown (**text**) into <strong> tags", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<strong>");
    expect(html).toContain("Rol:");
  });

  it("converts italic markdown (_text_) into <em> tags", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<em>");
  });

  it("includes print-friendly CSS with @media print", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("@media print");
  });

  it("includes Motian branding", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("Motian");
  });

  it("uses inline styles (no external stylesheets)", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).not.toContain('rel="stylesheet"');
    expect(html).not.toContain("<link");
    expect(html).toContain("<style>");
  });

  it("renders horizontal rules from ---", () => {
    const html = renderCommercialCvHtml(baseDraft);
    expect(html).toContain("<hr");
  });

  it("handles draft with minimal content", () => {
    const minimal = {
      title: "Commercieel CV — Test",
      body: "# Test\n\n**Rol:** —",
    };
    const html = renderCommercialCvHtml(minimal);
    expect(html).toContain("Test");
    expect(html).toContain("<!DOCTYPE html>");
  });
});
