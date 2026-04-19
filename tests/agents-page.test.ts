import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Agents page", () => {
  const pagePath = resolve(__dirname, "../app/agents/page.tsx");

  it("renders the agents dashboard route", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toContain("export default function AgentsPage()");
    expect(source).toContain("getAgentDashboardData");
  });

  it("forces dynamic rendering for live dashboard data", () => {
    const source = readFileSync(pagePath, "utf-8");
    expect(source).toMatch(/export\s+const\s+dynamic\s*=\s*"force-dynamic"/);
    expect(source).not.toContain("export const revalidate");
  });
});
