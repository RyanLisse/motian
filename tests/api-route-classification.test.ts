import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd());
const API_ROOT = join(ROOT, "app", "api");
const LEDGER_PATH = join(ROOT, "docs", "security", "api-route-classification.md");
const PROXY_PATH = join(ROOT, "proxy.ts");

function walkRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkRouteFiles(full));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

/** `app/api/kandidaten/[id]/route.ts` → `/api/kandidaten/{id}` */
function filePathToRoute(filePath: string): string {
  const rel = filePath.slice(API_ROOT.length).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  const segments = withoutRoute
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith("[") && segment.endsWith("]")) {
        return `{${segment.slice(1, -1)}}`;
      }
      return segment;
    });
  return `/api/${segments.join("/")}`;
}

function parseLedgerRoutes(markdown: string): Map<string, { classification: string }> {
  const routes = new Map<string, { classification: string }>();
  const allowed = new Set(["public", "first-party-browser", "service-bearer"]);
  const mainTable = markdown.split(/\n## Residuals\n/)[0] ?? markdown;

  for (const line of mainTable.split("\n")) {
    if (!line.startsWith("| `/api/") && !line.startsWith("| /api/")) continue;
    const cells = line.split("|").map((cell) => cell.trim().replace(/^`|`$/g, ""));
    // | Route | Classification | Owner | Enforced by | Reason |
    const route = cells[1];
    const classification = cells[2];
    if (!route?.startsWith("/api/") || !classification) continue;
    if (!allowed.has(classification)) continue;
    routes.set(route, { classification });
  }
  return routes;
}

function parseStringArrayBlock(source: string, name: string): string[] {
  const match = source.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) {
    throw new Error(`Expected ${name} block in proxy.ts`);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("api route classification ledger (R5)", () => {
  const routeFiles = walkRouteFiles(API_ROOT);
  const diskRoutes = routeFiles.map(filePathToRoute).sort();
  const ledger = parseLedgerRoutes(readFileSync(LEDGER_PATH, "utf8"));
  const proxySource = readFileSync(PROXY_PATH, "utf8");
  const publicPaths = parseStringArrayBlock(proxySource, "PUBLIC_PATHS");
  const publicGetPaths = parseStringArrayBlock(proxySource, "PUBLIC_GET_PATHS");

  it("enumerates every app/api/**/route.ts in the ledger", () => {
    const missing = diskRoutes.filter((route) => !ledger.has(route));
    expect(missing, `Routes on disk missing from ledger: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not list ledger routes that have no route.ts on disk", () => {
    const diskSet = new Set(diskRoutes);
    const stale = [...ledger.keys()].filter((route) => !diskSet.has(route));
    expect(stale, `Ledger routes with no route file: ${stale.join(", ")}`).toEqual([]);
  });

  it("classifies public routes only when they appear in PUBLIC_PATHS or PUBLIC_GET_PATHS", () => {
    const publicLedger = [...ledger.entries()].filter(
      ([, meta]) => meta.classification === "public",
    );

    for (const [route] of publicLedger) {
      const inPublicPaths = publicPaths.some(
        (path) => route === path || route.startsWith(`${path}/`),
      );
      const inPublicGet = publicGetPaths.some(
        (path) => route === path || route.startsWith(`${path}/`),
      );
      expect(
        inPublicPaths || inPublicGet,
        `Ledger marks ${route} public but it is absent from PUBLIC_PATHS/PUBLIC_GET_PATHS`,
      ).toBe(true);
    }
  });

  it("keeps debug-error non-public and does not list a login /api/sessie route", () => {
    expect(ledger.get("/api/debug-error")?.classification).not.toBe("public");
    expect(ledger.has("/api/sessie")).toBe(false);
  });
});
