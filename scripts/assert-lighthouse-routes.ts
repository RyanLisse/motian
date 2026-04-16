import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type LighthouseManifestEntry = {
  jsonPath: string;
  url: string;
};

type LighthouseResult = {
  categories: {
    performance: {
      score: number;
    };
  };
  audits: {
    "first-contentful-paint": { numericValue: number };
    "largest-contentful-paint": { numericValue: number };
    "total-blocking-time": { numericValue: number };
    "cumulative-layout-shift": { numericValue: number };
  };
  finalDisplayedUrl?: string;
};

type RouteMetrics = {
  score: number;
  lcp: number;
  tbt: number;
  fcp: number;
  cls: number;
};

type RouteBudget = {
  lcpMaxMs: number;
  performanceMin: number;
  tbtWarnMs: number;
};

type RouteSummary = {
  route: string;
  runs: number;
  perfMedian: number;
  lcpMedian: number;
  tbtMedian: number;
  fcpMedian: number;
  clsMedian: number;
  budget: RouteBudget;
  failures: string[];
  warnings: string[];
};

type BudgetSummary = {
  generatedAt: string;
  failureCount: number;
  warningCount: number;
  routes: RouteSummary[];
};

export const LIGHTHOUSE_ROUTE_BUDGETS: Record<string, RouteBudget> = {
  "/overzicht": {
    performanceMin: 0.76,
    lcpMaxMs: 2500,
    tbtWarnMs: 1000,
  },
  "/kandidaten": {
    performanceMin: 0.64,
    lcpMaxMs: 4300,
    tbtWarnMs: 950,
  },
  "/vacatures": {
    performanceMin: 0.62,
    lcpMaxMs: 4500,
    tbtWarnMs: 800,
  },
  "/chat": {
    performanceMin: 0.65,
    lcpMaxMs: 3800,
    tbtWarnMs: 1250,
  },
};

export function computeMedian(values: number[]) {
  if (values.length === 0) {
    throw new Error("Cannot compute median of an empty array");
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function normalizeRoute(route: string) {
  if (route === "/") return "/overzicht";
  return route.replace(/\/$/, "") || "/";
}

export function evaluateRouteBudgets(
  routeRuns: Partial<Record<string, RouteMetrics[]>>,
): BudgetSummary {
  const routes = Object.entries(LIGHTHOUSE_ROUTE_BUDGETS).map(([route, budget]) => {
    const runs = routeRuns[route] ?? [];
    const failures: string[] = [];
    const warnings: string[] = [];

    if (runs.length === 0) {
      failures.push("No Lighthouse runs collected for route");
    }

    const summary: RouteSummary = {
      route,
      runs: runs.length,
      perfMedian:
        runs.length > 0 ? Number(computeMedian(runs.map((run) => run.score)).toFixed(2)) : 0,
      lcpMedian: runs.length > 0 ? Math.round(computeMedian(runs.map((run) => run.lcp))) : 0,
      tbtMedian: runs.length > 0 ? Math.round(computeMedian(runs.map((run) => run.tbt))) : 0,
      fcpMedian: runs.length > 0 ? Math.round(computeMedian(runs.map((run) => run.fcp))) : 0,
      clsMedian: runs.length > 0 ? Number(computeMedian(runs.map((run) => run.cls)).toFixed(3)) : 0,
      budget,
      failures,
      warnings,
    };

    if (runs.length > 0) {
      if (summary.perfMedian < budget.performanceMin) {
        failures.push(
          `Performance median ${summary.perfMedian.toFixed(2)} below ${budget.performanceMin.toFixed(2)}`,
        );
      }

      if (summary.lcpMedian > budget.lcpMaxMs) {
        failures.push(`LCP median ${summary.lcpMedian}ms above ${budget.lcpMaxMs}ms`);
      }

      if (summary.tbtMedian > budget.tbtWarnMs) {
        warnings.push(`TBT median ${summary.tbtMedian}ms above ${budget.tbtWarnMs}ms`);
      }
    }

    return summary;
  });

  return {
    generatedAt: new Date().toISOString(),
    failureCount: routes.reduce((count, route) => count + route.failures.length, 0),
    warningCount: routes.reduce((count, route) => count + route.warnings.length, 0),
    routes,
  };
}

function buildResultsFromEntries(entries: LighthouseManifestEntry[]) {
  const results: Partial<Record<string, RouteMetrics[]>> = {};

  for (const entry of entries) {
    const result = JSON.parse(fs.readFileSync(entry.jsonPath, "utf8")) as LighthouseResult;
    const displayedUrl = result.finalDisplayedUrl ?? entry.url;
    const route = normalizeRoute(new URL(displayedUrl).pathname);

    if (!(route in LIGHTHOUSE_ROUTE_BUDGETS)) continue;

    const metrics: RouteMetrics = {
      score: result.categories.performance.score,
      lcp: result.audits["largest-contentful-paint"].numericValue,
      tbt: result.audits["total-blocking-time"].numericValue,
      fcp: result.audits["first-contentful-paint"].numericValue,
      cls: result.audits["cumulative-layout-shift"].numericValue,
    };

    if (!results[route]) {
      results[route] = [];
    }

    results[route].push(metrics);
  }

  return results;
}

export function loadManifestResults(manifestPath: string) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as LighthouseManifestEntry[];
  return buildResultsFromEntries(manifest);
}

export function loadResultsFromDirectory(directoryPath: string) {
  const entries = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => file !== "manifest.json" && file !== "route-budget-summary.json")
    .map((file) => {
      const jsonPath = path.join(directoryPath, file);
      const result = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as LighthouseResult;
      return {
        jsonPath,
        url: result.finalDisplayedUrl ?? "http://127.0.0.1/unknown",
      };
    });

  if (entries.length === 0) {
    throw new Error(`No Lighthouse report JSON files found in ${directoryPath}`);
  }

  return buildResultsFromEntries(entries);
}

function printSummary(summary: BudgetSummary) {
  console.log("Route Lighthouse budgets");
  for (const route of summary.routes) {
    const status = route.failures.length === 0 ? "PASS" : "FAIL";
    const warningSuffix = route.warnings.length > 0 ? ` (${route.warnings.join("; ")})` : "";
    console.log(
      `${status} ${route.route} perf ${route.perfMedian.toFixed(2)} / ${route.budget.performanceMin.toFixed(2)} | ` +
        `LCP ${route.lcpMedian}ms / ${route.budget.lcpMaxMs}ms | ` +
        `TBT ${route.tbtMedian}ms / ${route.budget.tbtWarnMs}ms${warningSuffix}`,
    );
  }
}

function main() {
  const manifestPath = path.join(process.cwd(), ".lighthouseci", "manifest.json");
  const summaryPath = path.join(process.cwd(), ".lighthouseci", "route-budget-summary.json");
  const lighthouseDir = path.dirname(manifestPath);
  const routeRuns = fs.existsSync(manifestPath)
    ? loadManifestResults(manifestPath)
    : loadResultsFromDirectory(lighthouseDir);
  const summary = evaluateRouteBudgets(routeRuns);

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  printSummary(summary);

  if (summary.failureCount > 0) {
    process.exitCode = 1;
  }
}

const entrypointPath = process.argv[1];
if (entrypointPath && import.meta.url === pathToFileURL(entrypointPath).href) {
  main();
}
