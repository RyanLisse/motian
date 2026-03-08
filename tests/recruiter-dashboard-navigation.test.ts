import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Recruiter-first navigation", () => {
  it("keeps recruiter workflow routes prominent in the sidebar", () => {
    const source = readFile("components", "app-sidebar.tsx");

    expect(source).toContain('title: "Overzicht"');
    expect(source).toContain('title: "Vacatures"');
    expect(source).toContain('title: "Kandidaten"');
    expect(source).toContain('title: "Pipeline"');
    expect(source).toContain('title: "Interviews"');

    expect(source).toContain('url: "/overzicht"');
    expect(source).toContain('url: "/opdrachten"');
    expect(source).toContain('url: "/professionals"');
    expect(source).toContain('url: "/pipeline"');
    expect(source).toContain('url: "/interviews"');
    expect(source).toContain('url: "/chat"');

    expect(source).not.toContain('title: "Aanbevelingen"');
    expect(source).not.toContain('url: "/matching"');
    expect(source).not.toContain('title: "Berichten"');
    expect(source).not.toContain('url: "/messages"');
    expect(source).not.toContain('title: "Matching"');
  });
});

describe("Recruiter-first overview", () => {
  it("frames the dashboard as a recruiter command center", () => {
    const source = readFile("app", "overzicht", "page.tsx");

    expect(source).toContain("Je command center voor vacatures, kandidaten en opvolging");
    expect(source).toContain("Wat vraagt nu aandacht?");
    expect(source).toContain("Aankomende interviews");
    expect(source).toContain("Nieuwe vacatures opvolgen");
    expect(source).toContain("Databronnen");

    expect(source).not.toContain("Aanbevelingen");
    expect(source).not.toContain("Open aanbevelingen");
    expect(source).not.toContain("Recente berichten");
    expect(source).not.toContain('label: "Berichten"');
    expect(source).not.toContain("Dashboard — realtime inzicht in vacatures en scrapers");
  });

  it("keeps empty-state navigation inside candidate and vacancy flows", () => {
    const pipelineSource = readFile("app", "pipeline", "page.tsx");
    const candidateSource = readFile("app", "professionals", "[id]", "page.tsx");

    expect(pipelineSource).toContain('href: "/professionals"');
    expect(pipelineSource).toContain(`href: \`/opdrachten/\${vacatureId}\``);
    expect(pipelineSource).not.toContain(
      `href: vacature ? \`/matching?jobId=\${vacatureId}\` : "/matching"`,
    );
    expect(candidateSource).toContain(`href: \`/professionals/\${candidate.id}#matches\``);
    expect(candidateSource).toContain('label: "Bekijk matchkansen"');
    expect(candidateSource).toContain('<section id="matches">');
    expect(candidateSource).not.toContain(': { href: "/matching", label: "Bekijk matches" }');
  });
});
